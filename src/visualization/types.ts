export type SizeBy =
  | "fileSize"
  | "fileCount"
  | "folderSize"
  | "equal"
  | "age"
  | "custom";

export type ColorBy =
  | "extension"
  | "fileType"
  | "category"
  | "mimeType"
  | "folder"
  | "fileSize"
  | "modifiedDate"
  | "createdDate"
  | "age"
  | "attributes"
  | "custom";

export type GroupBy =
  | "folder"
  | "extension"
  | "fileType"
  | "category"
  | "subcategory"
  | "mimeType"
  | "date"
  | "size"
  | "owner"
  | "drive"
  | "path"
  | "custom"
  | "accPortfolio"
  | "accProgram"
  | "accSubProgram"
  | "accOriginator"
  | "accLocation"
  | "accDiscipline"
  | "accDocumentType";

/** A grouping level: a built-in field, or `meta:` plus a key from JSON or ACC metadata. */
export type GroupLevel = GroupBy | `meta:${string}`;

export type LayoutMode = "foam" | "treemap" | "circles" | "sunburst";

/** Which canvas renderer draws the map */
export type VizRenderer = "foamtree" | "circlePacking" | "sequencesSunburst" | "sunburst";

export type PaletteId =
  | "professional"
  | "dark"
  | "light"
  | "monochrome"
  | "engineering"
  | "bim"
  | "cad"
  | "rainbow"
  | "heatmap"
  | "pastel"
  | "highContrast";

export type ColorModel = "rainbow" | "prisma";
export type FoamLayout = "relaxed" | "ordered" | "squarified";
export type FoamStacking = "hierarchical" | "flattened";
export type FoamFillType = "none" | "plain" | "gradient";

export interface VisualizationStyle {
  colorModel: ColorModel;
  stageBackground: string;
  foamLayout: FoamLayout;
  stacking: FoamStacking;
  layoutByWeightOrder: boolean;
  groupMinDiameter: number;
  relaxationInitializer: "fisheye" | "blackhole" | "ordered" | "squarified" | "random";
  relaxationQualityThreshold: number;
  relaxationVisible: boolean;
  descriptionGroup: "auto" | "always";
  descriptionGroupType: "stab" | "floating";
  descriptionGroupSize: number;
  descriptionGroupMaxHeight: number;
  groupBorderRadius: number;
  groupBorderWidth: number;
  groupInsetWidth: number;
  groupBorderWidthScaling: number;
  groupFillType: FoamFillType;
  groupFillGradientRadius: number;
  groupFillGradientCenterLightnessShift: number;
  groupFillGradientRimLightnessShift: number;
  groupStrokeType: FoamFillType;
  groupStrokeWidth: number;
  groupStrokePlainLightnessShift: number;
  groupSelectionOutlineWidth: number;
  groupSelectionOutlineColor: string;
  groupSelectionOutlineShadowSize: number;
  groupSelectionOutlineShadowColor: string;
  groupHoverFillLightnessShift: number;
  groupLabelFontFamily: string;
  groupLabelFontWeight: string;
  groupLabelMinFontSize: number;
  groupLabelMaxFontSize: number;
  groupLabelVerticalPadding: number;
  groupLabelHorizontalPadding: number;
  groupLabelLineHeight: number;
  maxGroupLevelsDrawn: number;
  maxGroupLabelLevelsDrawn: number;
  parentFillOpacity: number;
  parentLabelOpacity: number;
  rainbowStartColor: string;
  rainbowEndColor: string;
  rainbowColorDistribution: "radial" | "linear";
  rainbowColorDistributionAngle: number;
  rainbowLightnessShift: number;
  rainbowSaturationCorrection: number;
  rainbowLightnessCorrection: number;
  rolloutDuration: number;
  pullbackDuration: number;
  fadeDuration: number;
  rolloutEasing: string;
  rolloutMethod: string;
  pullbackEasing: string;
  pullbackMethod: string;
  rolloutScalingStrength: number;
  rolloutRotationStrength: number;
  zoomMouseWheelFactor: number;
  attributionTheme: "light" | "dark";
  groupUnexposureLightnessShift: number;
  groupExposureShadowColor: string;
}

export interface VisualizationConfig {
  layout: LayoutMode;
  /** FoamTree (default) or D3 zoomable circle packing */
  renderer: VizRenderer;
  sizeBy: SizeBy;
  colorBy: ColorBy;
  groupBy: GroupLevel[];
  customProperty: string;
  palette: PaletteId;
  showLabels: boolean;
  labelThreshold: number;
  animation: boolean;
  style: VisualizationStyle;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface VizNode {
  id: string;
  sourceId: string | null;
  label: string;
  weight: number;
  colorKey: string;
  nodeType: "file" | "folder" | "group";
  category: string | null;
  extension: string | null;
  fileType: string | null;
  size: number;
  fileCount: number;
  modifiedAt?: string | null;
  children: VizNode[];
}

export interface LayoutCell {
  id: string;
  sourceId: string | null;
  label: string;
  rect: Rect;
  depth: number;
  color: string;
  weight: number;
  size: number;
  nodeType: VizNode["nodeType"];
  parentId: string | null;
  inner?: LayoutCell[];
}

export interface VisualizationEngine {
  readonly id: LayoutMode;
  layout(root: VizNode, bounds: Rect, config: VisualizationConfig): LayoutCell[];
}
