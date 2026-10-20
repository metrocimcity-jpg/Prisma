import { actions, usePrisma } from "@/state/store";
import { exposeFoamTreeGroup, resetFoamTreeView } from "@/visualization/foamtree/host";
import { vizPathById, vizPathBySourceId } from "@/visualization/tree";
import type { VizNode } from "@/visualization/types";

export function Breadcrumbs(): JSX.Element {
  const { vizTree, focusPath, selectedId } = usePrisma();
  const selectedPath = vizTree && selectedId ? vizPathBySourceId(vizTree, selectedId) : [];
  const focusedId = focusPath.length > 0 ? focusPath[focusPath.length - 1] : null;
  const focusedPath =
    selectedPath.length === 0 && vizTree && focusedId ? vizPathById(vizTree, focusedId) : [];
  const crumbs = selectedPath.length > 0 ? selectedPath : focusedPath;

  function openCrumb(index: number): void {
    const node = crumbs[index];
    if (!node) {
      return;
    }
    const through = crumbs.slice(0, index + 1).map((item) => item.id);
    if (node.nodeType === "file" && node.sourceId) {
      actions.setFocusPath(through.slice(0, -1));
      actions.select(node.sourceId);
      return;
    }
    actions.setFocusPath(through);
    exposeFoamTreeGroup(node.id);
  }

  return (
    <nav className="crumbbar" aria-label="Hierarchy">
      <button
        className={crumbs.length === 0 ? "crumb current" : "crumb"}
        type="button"
        onClick={() => {
          actions.setFocusPath([]);
          resetFoamTreeView();
        }}
      >
        ⌂ all files
      </button>
      {crumbs.map((crumb, index) => (
        <Crumb key={crumb.id} crumb={crumb} current={index === crumbs.length - 1} onOpen={() => openCrumb(index)} />
      ))}
    </nav>
  );
}

function Crumb({
  crumb,
  current,
  onOpen,
}: {
  crumb: VizNode;
  current: boolean;
  onOpen: () => void;
}): JSX.Element {
  return (
    <span style={{ display: "contents" }}>
      <span className="crumb-sep">›</span>
      <button className={current ? "crumb current" : "crumb"} type="button" title={crumb.label} onClick={onOpen}>
        {crumb.label}
      </button>
    </span>
  );
}
