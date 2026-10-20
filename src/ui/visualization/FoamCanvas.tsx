import { actions, usePrisma } from "@/state/store";
import { formatBytes } from "@/utils/format";
import { findFoamGroupBySourceId, toFoamTreeData } from "@/visualization/foamtree/dataObject";
import { setFoamTreeInstance } from "@/visualization/foamtree/host";
import { foamTreeViewOptions } from "@/visualization/foamtree/options";
import type { PrismaFoamGroup } from "@/visualization/foamtree/dataObject";
import { FoamTree, type FoamTreeEvent } from "@carrotsearch/foamtree";
import { useEffect, useRef } from "react";

function cssColor(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value.length > 0 ? value : fallback;
}

function sourceIdFrom(group: PrismaFoamGroup | undefined): string | null {
  return group?.sourceId ?? group?.id ?? null;
}

function foamInteractionOptions() {
  return {
    onGroupClick: (event: FoamTreeEvent) => {
      actions.select(sourceIdFrom(event.group as PrismaFoamGroup | undefined));
    },
    onGroupDoubleClick: (event: FoamTreeEvent) => {
      const group = event.group as PrismaFoamGroup | undefined;
      if (!group) {
        return;
      }
      const isFile = group.isFile === true || group.nodeType === "file";
      if (!isFile) {
        return;
      }
      event.preventDefault?.();
      const id = sourceIdFrom(group);
      if (!id) {
        return;
      }
      actions.select(id);
      void actions.openNode(id);
    },
    onGroupHover(this: FoamTree | void, event: FoamTreeEvent) {
      actions.hover(event.group ? String((event.group as PrismaFoamGroup).id) : null);
      const foam = this;
      if (!foam || typeof foam.redraw !== "function") {
        return;
      }
      queueMicrotask(() => {
        foam.redraw();
      });
    },
    onGroupSelectionChanged: (event: FoamTreeEvent) => {
      const first = event.groups?.[0] as PrismaFoamGroup | undefined;
      actions.select(sourceIdFrom(first));
    },
    onGroupExposureChanged: (event: FoamTreeEvent) => {
      const exposed = (event.groups ?? []) as PrismaFoamGroup[];
      if (exposed.length === 0) {
        actions.setFocusPath([]);
        return;
      }
      actions.setFocusPath(exposed.map((group) => String(group.id)));
    },
    titleBarDecorator: (
      _options: unknown,
      properties: { group?: PrismaFoamGroup },
      variables: { titleBarText?: string },
    ) => {
      const group = properties.group;
      if (!group) {
        return;
      }
      variables.titleBarText = `${group.label} · ${formatBytes(group.size)}`;
    },
  };
}

export function FoamCanvas(): JSX.Element {
  const { vizTree, config, selectedId } = usePrisma();
  const hostRef = useRef<HTMLDivElement>(null);
  const foamRef = useRef<FoamTree | null>(null);

  useEffect(() => {
    const element = hostRef.current;
    if (!element) {
      return;
    }

    const foamtree = new FoamTree({
      element,
      ...foamTreeViewOptions(config.visualization, cssColor("--bg", "#0f1115")),
      pixelRatio: window.devicePixelRatio || 1,
      ...foamInteractionOptions(),
    });

    foamRef.current = foamtree;
    setFoamTreeInstance(foamtree);

    const observer = new ResizeObserver(() => {
      foamtree.resize();
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
      foamtree.dispose();
      foamRef.current = null;
      setFoamTreeInstance(null);
    };
  }, []);

  useEffect(() => {
    const foamtree = foamRef.current;
    if (!foamtree) {
      return;
    }
    const viz = config.visualization;
    if (!vizTree) {
      foamtree.set("dataObject", null);
      return;
    }
    foamtree.set("dataObject", toFoamTreeData(vizTree, viz));
  }, [
    vizTree,
    config.visualization.sizeBy,
    config.visualization.colorBy,
    config.visualization.groupBy,
    config.visualization.palette,
    config.visualization.customProperty,
    config.visualization.style.colorModel,
  ]);

  useEffect(() => {
    const foamtree = foamRef.current;
    if (!foamtree) {
      return;
    }
    foamtree.set(foamTreeViewOptions(config.visualization, cssColor("--bg", "#0f1115")));
    foamtree.set(foamInteractionOptions());
  }, [config.theme, config.visualization]);

  useEffect(() => {
    const foamtree = foamRef.current;
    if (!foamtree) {
      return;
    }
    if (selectedId === null) {
      void foamtree.select([]);
      return;
    }
    const data = foamtree.get("dataObject") as { groups?: PrismaFoamGroup[] } | null;
    const group = findFoamGroupBySourceId(data?.groups, selectedId);
    if (group) {
      void foamtree.select(group);
    }
  }, [selectedId]);

  return <div className="viz-stage foamtree-host" ref={hostRef} />;
}
