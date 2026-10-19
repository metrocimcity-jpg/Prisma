import { requireAccAccessToken } from "@/acc/auth";
import { withProjectIdPrefix } from "@/acc/urls";
import { versionSizesFromNodes, type AccVersionSize } from "@/acc/versions";

const PROJECT_API = "https://developer.api.autodesk.com/project/v1";
const DATA_API = "https://developer.api.autodesk.com/data/v1";

export interface AccFolderContentItem {
  type: "folders" | "items" | string;
  id: string;
  displayName: string;
  /** Latest version URN, used to read the ACC data sheet. */
  tipVersionId?: string;
  createUserName?: string;
  lastModifiedUserName?: string;
  lastModifiedTime?: string;
}

interface AccRawNode {
  type: string;
  id: string;
  attributes?: {
    displayName?: string;
    name?: string;
    createUserName?: string;
    lastModifiedUserName?: string;
    lastModifiedTime?: string;
  };
  relationships?: {
    tip?: { data?: { id?: string } };
  };
}

export function mapAccNode(item: AccRawNode): AccFolderContentItem {
  const tipVersionId = item.relationships?.tip?.data?.id;
  return {
    type: item.type,
    id: item.id,
    displayName: item.attributes?.displayName ?? item.attributes?.name ?? item.id,
    ...(tipVersionId ? { tipVersionId } : {}),
    ...(item.attributes?.createUserName ? { createUserName: item.attributes.createUserName } : {}),
    ...(item.attributes?.lastModifiedUserName ? { lastModifiedUserName: item.attributes.lastModifiedUserName } : {}),
    ...(item.attributes?.lastModifiedTime ? { lastModifiedTime: item.attributes.lastModifiedTime } : {}),
  };
}

async function apsFetch(url: string): Promise<Response> {
  const token = requireAccAccessToken();
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ACC API ${response.status}: ${text.slice(0, 300)}`);
  }
  return response;
}

export async function listTopFolders(projectId: string): Promise<AccFolderContentItem[]> {
  const id = withProjectIdPrefix(projectId);
  // Hub id is not needed for topFolders when using project endpoint via Data Management companion:
  // GET project/v1/hubs/:hub_id/projects/:project_id/topFolders — requires hub.
  // Alternative: use GET data/v1/projects/:project_id/folders/:folder_id/contents after discovering root.
  // Discover hub+project via hubs list.
  const hubs = await listHubs();
  for (const hub of hubs) {
    const projects = await listProjects(hub.id);
    const match = projects.find((project) => project.id === id || project.id === projectId || project.id.endsWith(projectId));
    if (!match) {
      continue;
    }
    const response = await apsFetch(`${PROJECT_API}/hubs/${encodeURIComponent(hub.id)}/projects/${encodeURIComponent(match.id)}/topFolders`);
    const json = (await response.json()) as {
      data?: Array<{ type: string; id: string; attributes?: { displayName?: string; name?: string } }>;
    };
    return (json.data ?? []).map((item) => mapAccNode(item));
  }
  throw new Error(`ACC project ${projectId} was not found in your hubs. Check the Project ID.`);
}

export async function listHubs(): Promise<Array<{ id: string; name: string }>> {
  const response = await apsFetch(`${PROJECT_API}/hubs`);
  const json = (await response.json()) as {
    data?: Array<{ id: string; attributes?: { name?: string } }>;
  };
  return (json.data ?? []).map((hub) => ({
    id: hub.id,
    name: hub.attributes?.name ?? hub.id,
  }));
}

export async function listProjects(hubId: string): Promise<Array<{ id: string; name: string }>> {
  const response = await apsFetch(`${PROJECT_API}/hubs/${encodeURIComponent(hubId)}/projects`);
  const json = (await response.json()) as {
    data?: Array<{ id: string; attributes?: { name?: string } }>;
  };
  return (json.data ?? []).map((project) => ({
    id: project.id,
    name: project.attributes?.name ?? project.id,
  }));
}

export async function listFolderContents(
  projectId: string,
  folderId: string,
): Promise<AccFolderContentItem[]> {
  const id = withProjectIdPrefix(projectId);
  const items: AccFolderContentItem[] = [];
  // ACC page numbers are 0-based. Page 1 is the second page, so starting there skips every folder of 200 items or fewer.
  for (let page = 0; ; page += 1) {
    const url = new URL(`${DATA_API}/projects/${encodeURIComponent(id)}/folders/${encodeURIComponent(folderId)}/contents`);
    url.searchParams.set("page[number]", String(page));
    url.searchParams.set("page[limit]", "200");
    const response = await apsFetch(url.toString());
    const json = (await response.json()) as { data?: AccRawNode[] };
    const batch = json.data ?? [];
    for (const item of batch) {
      items.push(mapAccNode(item));
    }
    if (batch.length < 200) {
      break;
    }
  }
  return items;
}

/** Every stored version of one ACC document, with its size. */
export async function listItemVersions(projectId: string, itemId: string): Promise<AccVersionSize[]> {
  const id = withProjectIdPrefix(projectId);
  const nodes: Array<{ id?: string; attributes?: { versionNumber?: number | string; storageSize?: number | string } }> = [];
  for (let page = 0; ; page += 1) {
    const url = new URL(`${DATA_API}/projects/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}/versions`);
    url.searchParams.set("page[number]", String(page));
    url.searchParams.set("page[limit]", "100");
    const response = await apsFetch(url.toString());
    const json = (await response.json()) as {
      data?: Array<{ id?: string; attributes?: { versionNumber?: number | string; storageSize?: number | string } }>;
    };
    const batch = json.data ?? [];
    nodes.push(...batch);
    if (batch.length < 100) {
      break;
    }
  }
  return versionSizesFromNodes(nodes);
}
