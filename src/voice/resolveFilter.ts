import { CATEGORY_GROUPS } from "@/filtering/categoryGroups";

export interface ResolvedFilter {
  label: string;
  categories: string[];
  extensions: string[];
  search: string;
}

const SPOKEN_ALIASES: Record<string, string> = {
  pdfs: "pdf",
  pictures: "images",
  picture: "images",
  photos: "images",
  photo: "images",
  videos: "video",
  audios: "audio",
  docs: "documents",
  doc: "documents",
};

/** Map a spoken filter onto a category, an extension, or a name search. */
export function resolveFilter(query: string): ResolvedFilter {
  const spoken = query.trim().toLowerCase();
  const needle = SPOKEN_ALIASES[spoken] ?? spoken;
  const group = CATEGORY_GROUPS.find(
    (item) => item.label.toLowerCase() === needle || item.id.toLowerCase() === needle,
  );
  if (group) {
    return { label: group.label, categories: [...group.members], extensions: [], search: "" };
  }
  const member = CATEGORY_GROUPS.flatMap((item) => item.members).find((item) => item.toLowerCase() === needle);
  if (member) {
    return { label: member, categories: [member], extensions: [], search: "" };
  }
  if (/^[a-z0-9]{1,8}$/.test(needle)) {
    return { label: `.${needle}`, categories: [], extensions: [needle], search: "" };
  }
  return { label: query.trim(), categories: [], extensions: [], search: query.trim() };
}
