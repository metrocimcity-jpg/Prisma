import { requireAccAccessToken } from "@/acc/auth";
import { stripProjectIdPrefix } from "@/acc/urls";
import { promoteAccAttributeKeys } from "@/metadata/accTaxonomy";

const DOCS_API = "https://developer.api.autodesk.com/bim360/docs/v1";
const BATCH_SIZE = 50;

export interface AccCustomAttribute {
  id?: number | string;
  name?: string;
  value?: unknown;
}

export interface AccVersionSheet {
  urn?: string;
  itemUrn?: string;
  title?: string;
  number?: string;
  description?: string;
  customAttributes?: AccCustomAttribute[];
}

/** Version number encoded on an ACC tip URN (`...?version=3`). */
export function versionFromTipUrn(urn: string | undefined): string | null {
  if (!urn) {
    return null;
  }
  const match = /[?&]version=(\d+)/i.exec(urn);
  return match?.[1] ?? null;
}

export function attributeValueText(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const parts = value.map((entry) => attributeValueText(entry)).filter((entry): entry is string => entry !== null);
    return parts.length > 0 ? parts.join(", ") : null;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return attributeValueText(record.displayValue ?? record.label ?? record.name ?? record.value ?? record.text);
  }
  return null;
}

export function valuesFromCustomAttributes(
  attributes: AccCustomAttribute[] | undefined,
  namesById?: ReadonlyMap<string, string>,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const attribute of attributes ?? []) {
    const fromId = attribute.id === undefined ? undefined : namesById?.get(String(attribute.id));
    const name = attribute.name?.trim() || fromId;
    const text = attributeValueText(attribute.value);
    if (!name || text === null) {
      continue;
    }
    values[name] = text;
  }
  return values;
}

export function standardAccValues(item: {
  tipVersionId?: string;
  createUserName?: string;
  lastModifiedUserName?: string;
  lastModifiedTime?: string;
}): Record<string, string> {
  const values: Record<string, string> = {};
  const version = versionFromTipUrn(item.tipVersionId);
  if (version) {
    values.Version = version;
  }
  const createdBy = item.createUserName?.trim();
  if (createdBy) {
    values["Created By"] = createdBy;
  }
  const modifiedBy = item.lastModifiedUserName?.trim();
  if (modifiedBy) {
    values["Modified By"] = modifiedBy;
  }
  const modified = item.lastModifiedTime?.trim();
  if (modified) {
    values.Modified = modified;
  }
  return values;
}

export function valuesFromVersionSheet(
  sheet: AccVersionSheet,
  namesById?: ReadonlyMap<string, string>,
): Record<string, string> {
  const values = valuesFromCustomAttributes(sheet.customAttributes, namesById);
  const builtins: Array<[string, unknown]> = [
    ["Title", sheet.title],
    ["Number", sheet.number],
    ["Description", sheet.description],
  ];
  for (const [key, raw] of builtins) {
    const text = attributeValueText(raw);
    if (text && values[key] === undefined) {
      values[key] = text;
    }
  }
  const version = versionFromTipUrn(sheet.urn);
  if (version && values.Version === undefined && values.version === undefined) {
    values.Version = version;
  }
  return values;
}

export function mergeAccSheet(
  metadata: Record<string, unknown> | undefined,
  values: Record<string, string>,
): Record<string, unknown> {
  return promoteAccAttributeKeys({ ...(metadata ?? {}), ...values });
}

function accHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${requireAccAccessToken()}`,
    Accept: "application/json",
  };
}

/** Folder column names (id → name), including columns inherited from parent folders. */
export async function fetchAttributeDefinitionNames(
  projectId: string,
  folderIds: readonly string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const project = stripProjectIdPrefix(projectId);
  const projectDefinitions = await fetch(
    `${DOCS_API}/projects/${encodeURIComponent(project)}/custom-attribute-definitions`,
    { headers: accHeaders() },
  );
  if (projectDefinitions.ok) {
    rememberAttributeNames(names, await projectDefinitions.json());
  }
  const unique = [...new Set(folderIds.map((id) => id.trim()).filter((id) => id.length > 0))];
  for (const folderId of unique) {
    const response = await fetch(
      `${DOCS_API}/projects/${encodeURIComponent(project)}/folders/${encodeURIComponent(folderId)}/custom-attribute-definitions`,
      { headers: accHeaders() },
    );
    if (!response.ok) {
      continue;
    }
    rememberAttributeNames(names, await response.json());
  }
  return names;
}

function rememberAttributeNames(
  names: Map<string, string>,
  json: { results?: Array<{ id?: number | string; name?: string }> },
): void {
  for (const definition of json.results ?? []) {
    const name = definition.name?.trim();
    if (definition.id === undefined || !name) {
      continue;
    }
    names.set(String(definition.id), name);
  }
}

/**
 * Read ACC custom-attribute values for document ids.
 * Accepts a lineage URN (the file id) or a version URN. Keys include both.
 */
export async function fetchCustomAttributesByVersion(
  projectId: string,
  versionUrns: readonly string[],
  namesById?: ReadonlyMap<string, string>,
): Promise<Map<string, Record<string, string>>> {
  const map = new Map<string, Record<string, string>>();
  const unique = [...new Set(versionUrns.map((urn) => urn.trim()).filter((urn) => urn.length > 0))];
  const project = stripProjectIdPrefix(projectId);
  for (let index = 0; index < unique.length; index += BATCH_SIZE) {
    const urns = unique.slice(index, index + BATCH_SIZE);
    const response = await fetch(`${DOCS_API}/projects/${encodeURIComponent(project)}/versions:batch-get`, {
      method: "POST",
      headers: {
        ...accHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ urns }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`ACC metadata ${response.status}: ${text.slice(0, 300)}`);
    }
    const json = (await response.json()) as { results?: AccVersionSheet[] };
    const results = json.results ?? [];
    const aligned = results.length === urns.length;
    results.forEach((result, resultIndex) => {
      const values = valuesFromVersionSheet(result, namesById);
      if (aligned) {
        map.set(urns[resultIndex], values);
      }
      if (result.urn) {
        map.set(result.urn, values);
      }
      if (result.itemUrn) {
        map.set(result.itemUrn, values);
      }
    });
  }
  return map;
}
