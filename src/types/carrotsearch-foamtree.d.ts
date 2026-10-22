declare module "@carrotsearch/foamtree" {
  export interface FoamTreeGroup {
    id?: string;
    label?: string;
    weight?: number;
    groups?: FoamTreeGroup[];
    selected?: boolean;
    open?: boolean;
    exposed?: boolean;
    color?: string;
    [key: string]: unknown;
  }

  export interface FoamTreeDataObject {
    groups?: FoamTreeGroup[];
  }

  export interface FoamTreeEvent {
    group?: FoamTreeGroup;
    groups?: FoamTreeGroup[];
    preventDefault?: () => void;
    secondary?: boolean;
    [key: string]: unknown;
  }

  export interface FoamTreeColorVars {
    groupColor: Record<string, unknown> | string;
    labelColor: string;
  }

  export interface FoamTreeOptions {
    element?: HTMLElement | null;
    id?: string;
    pixelRatio?: number;
    wireframePixelRatio?: number;
    dataObject?: FoamTreeDataObject | null;
    layout?: "relaxed" | "ordered" | "squarified";
    stacking?: "hierarchical" | "flattened";
    relaxationInitializer?: "fisheye" | "blackhole" | "ordered" | "squarified" | "random";
    relaxationVisible?: boolean;
    relaxationQualityThreshold?: number;
    layoutByWeightOrder?: boolean;
    groupFillType?: "none" | "plain" | "gradient";
    groupStrokeType?: "none" | "plain" | "gradient";
    groupBorderWidth?: number;
    groupInsetWidth?: number;
    groupStrokeWidth?: number;
    groupMinDiameter?: number;
    groupLabelMinFontSize?: number;
    groupLabelMaxFontSize?: number;
    groupLabelFontFamily?: string;
    groupLabelFontWeight?: number | string;
    groupBorderRadius?: number;
    descriptionGroupType?: "stab" | "floating";
    descriptionGroupSize?: number;
    descriptionGroupMaxHeight?: number;
    attributionTheme?: "dark" | "light";
    rolloutDuration?: number;
    pullbackDuration?: number;
    fadeDuration?: number;
    zoomMouseWheelFactor?: number;
    backgroundColor?: string;
    maxGroupLevelsDrawn?: number;
    maxGroupLabelLevelsDrawn?: number;
    descriptionGroup?: "auto" | "always";
    parentFillOpacity?: number;
    parentLabelOpacity?: number;
    parentStrokeOpacity?: number;
    groupLabelMaxTotalHeight?: number;
    groupLabelHorizontalPadding?: number;
    groupLabelVerticalPadding?: number;
    groupLabelLineHeight?: number;
    groupLabelDecorator?: (
      options: unknown,
      properties: { open?: boolean; hasChildren?: boolean; description?: boolean },
      variables: { labelText: string },
    ) => void;
    groupSelectionOutlineWidth?: number;
    groupHoverFillLightnessShift?: number;
    [key: string]: unknown;
  }

  export class FoamTree {
    constructor(options: FoamTreeOptions);
    set(options: FoamTreeOptions): void;
    set(option: string, value: unknown): void;
    get(option: string, extra?: unknown): unknown;
    resize(): void;
    redraw(force?: boolean): void;
    dispose(): void;
    reset(): Promise<unknown>;
    select(groups: unknown): Promise<unknown>;
    expose(groups: unknown): Promise<unknown>;
    open(groups: unknown): Promise<unknown>;
    trigger(eventType: string, details: Record<string, unknown>): void;
  }
}
