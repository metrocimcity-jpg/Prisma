import { CATEGORY_COLORS } from "@/visualization/palettes";

export interface CategoryGroup {
  id: string;
  label: string;
  color: string;
  members: string[];
}

export const CATEGORY_GROUPS: CategoryGroup[] = [
  { id: "BIM", label: "BIM", color: CATEGORY_COLORS.BIM, members: ["BIM", "CAD"] },
  {
    id: "Document",
    label: "Document",
    color: CATEGORY_COLORS.Documents,
    members: ["Documents", "Spreadsheets", "Presentations", "PDF"],
  },
  { id: "Programming", label: "Programming", color: CATEGORY_COLORS.Programming, members: ["Programming"] },
  { id: "GIS", label: "GIS", color: CATEGORY_COLORS.GIS, members: ["GIS"] },
  { id: "Images", label: "Images", color: CATEGORY_COLORS.Images, members: ["Images"] },
  { id: "Video", label: "Video", color: CATEGORY_COLORS.Video, members: ["Video"] },
  { id: "Audio", label: "Audio", color: CATEGORY_COLORS.Audio, members: ["Audio"] },
  { id: "Data", label: "Data", color: CATEGORY_COLORS.Data, members: ["Data"] },
];

export function categoryGroupActive(selected: string[], members: string[]): boolean {
  return members.some((member) => selected.includes(member));
}

export function toggleCategoryGroup(selected: string[], members: string[]): string[] {
  if (categoryGroupActive(selected, members)) {
    const drop = new Set(members);
    return selected.filter((item) => !drop.has(item));
  }
  return [...new Set([...selected, ...members])];
}
