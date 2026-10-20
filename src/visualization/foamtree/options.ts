import { FOLDER_FILL } from "@/visualization/palettes";
import type { VisualizationConfig } from "@/visualization/types";
import type { FoamTreeOptions } from "@carrotsearch/foamtree";
import { foamLayoutOptions } from "./dataObject";
import type { PrismaFoamGroup } from "./dataObject";
import { applyHoverColor, drawHoveredCell, type HoverDrawProperties } from "./hover";

export function foamTreeViewOptions(
  config: VisualizationConfig,
  fallbackBackground: string,
): FoamTreeOptions {
  const style = config.style;
  const layout = foamLayoutOptions(config.layout);
  const animate = config.animation;
  const prismaColors = style.colorModel === "prisma";
  return {
    layout: style.foamLayout ?? layout.layout,
    stacking: style.stacking ?? layout.stacking,
    relaxationInitializer: style.relaxationInitializer ?? layout.relaxationInitializer,
    layoutByWeightOrder: style.layoutByWeightOrder,
    pixelRatio: typeof window === "undefined" ? 1 : window.devicePixelRatio || 1,
    wireframePixelRatio: 1,
    backgroundColor: style.stageBackground || fallbackBackground,
    groupFillType: style.groupFillType,
    groupStrokeType: style.groupStrokeType,
    groupBorderRadius: style.groupBorderRadius,
    groupBorderWidth: style.groupBorderWidth,
    groupInsetWidth: style.groupInsetWidth,
    groupBorderWidthScaling: style.groupBorderWidthScaling,
    groupStrokeWidth: style.groupStrokeWidth,
    groupStrokePlainLightnessShift: style.groupStrokePlainLightnessShift,
    groupFillGradientRadius: style.groupFillGradientRadius,
    groupFillGradientCenterLightnessShift: style.groupFillGradientCenterLightnessShift,
    groupFillGradientRimLightnessShift: style.groupFillGradientRimLightnessShift,
    groupMinDiameter: style.groupMinDiameter,
    groupLabelMinFontSize: config.showLabels ? style.groupLabelMinFontSize : 1000,
    groupLabelMaxFontSize: style.groupLabelMaxFontSize,
    groupLabelFontFamily: style.groupLabelFontFamily,
    groupLabelFontWeight: style.groupLabelFontWeight,
    groupLabelVerticalPadding: style.groupLabelVerticalPadding,
    groupLabelHorizontalPadding: style.groupLabelHorizontalPadding,
    groupLabelLineHeight: style.groupLabelLineHeight,
    rolloutDuration: animate ? style.rolloutDuration : 0,
    pullbackDuration: animate ? style.pullbackDuration : 0,
    fadeDuration: animate ? style.fadeDuration : 0,
    rolloutEasing: style.rolloutEasing,
    rolloutMethod: style.rolloutMethod,
    pullbackEasing: style.pullbackEasing,
    pullbackMethod: style.pullbackMethod,
    rolloutScalingStrength: style.rolloutScalingStrength,
    rolloutRotationStrength: style.rolloutRotationStrength,
    zoomMouseWheelFactor: style.zoomMouseWheelFactor,
    maxGroupLevelsDrawn: style.maxGroupLevelsDrawn,
    maxGroupLabelLevelsDrawn: config.showLabels ? style.maxGroupLabelLevelsDrawn : 0,
    descriptionGroup: style.descriptionGroup,
    descriptionGroupType: style.descriptionGroupType,
    descriptionGroupSize: style.descriptionGroupSize,
    descriptionGroupMaxHeight: style.descriptionGroupMaxHeight,
    attributionTheme: style.attributionTheme,
    parentFillOpacity: style.parentFillOpacity,
    parentLabelOpacity: style.parentLabelOpacity,
    parentStrokeOpacity: 1,
    groupSelectionOutlineWidth: style.groupSelectionOutlineWidth,
    groupSelectionOutlineColor: style.groupSelectionOutlineColor,
    groupSelectionOutlineShadowSize: style.groupSelectionOutlineShadowSize,
    groupSelectionOutlineShadowColor: style.groupSelectionOutlineShadowColor,
    groupHoverFillHueShift: 0,
    groupHoverFillSaturationShift: 0,
    groupHoverFillLightnessShift: 0,
    groupHoverStrokeHueShift: 0,
    groupHoverStrokeSaturationShift: 10,
    groupHoverStrokeLightnessShift: -16,
    incrementalDraw: "none",
    groupContentDecoratorTriggering: "onSurfaceDirty",
    wireframeContentDecorationDrawing: "always",
    groupUnexposureLightnessShift: style.groupUnexposureLightnessShift,
    groupExposureShadowColor: style.groupExposureShadowColor,
    relaxationVisible: style.relaxationVisible,
    relaxationQualityThreshold: style.relaxationQualityThreshold,
    rainbowStartColor: style.rainbowStartColor,
    rainbowEndColor: style.rainbowEndColor,
    rainbowColorDistribution: style.rainbowColorDistribution,
    rainbowColorDistributionAngle: style.rainbowColorDistributionAngle,
    rainbowLightnessShift: style.rainbowLightnessShift,
    rainbowSaturationCorrection: style.rainbowSaturationCorrection,
    rainbowLightnessCorrection: style.rainbowLightnessCorrection,
    groupColorDecorator: (
      _options: unknown,
      properties: { group?: PrismaFoamGroup; hovered?: boolean },
      variables: { groupColor: unknown; labelColor: string },
    ) => {
      const group = properties.group;
      if (prismaColors && group) {
        if (group.isFile && group.color) {
          variables.groupColor = group.color;
          variables.labelColor = "auto";
        } else {
          variables.groupColor = FOLDER_FILL;
        }
      }
      applyHoverColor(properties, variables);
    },
    groupContentDecorator: (
      options: { stacking?: string },
      properties: HoverDrawProperties,
    ) => {
      drawHoveredCell(options.stacking, properties);
    },
    groupLabelDecorator: prismaColors
      ? (
          _options: unknown,
          properties: { group?: PrismaFoamGroup; open?: boolean; hasChildren?: boolean; description?: boolean },
          variables: { labelText: string },
        ) => {
          const group = properties.group;
          if (group?.isFile && variables.labelText) {
            variables.labelText = group.label;
          }
        }
      : () => undefined,
  };
}
