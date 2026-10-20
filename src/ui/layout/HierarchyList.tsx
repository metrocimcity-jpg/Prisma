import { useMemo, useRef, useState } from "react";
import {
  ensureCatalog,
  hierarchyCatalog,
  hierarchyGroupBy,
  mergeHierarchyOrder,
  moveHierarchyItem,
  promoteHierarchySelection,
} from "@/ui/layout/hierarchy";
import type { GroupLevel } from "@/visualization/types";

interface HierarchyListProps {
  metadataKeys: readonly string[];
  groupBy: readonly GroupLevel[];
  onChange: (groupBy: GroupLevel[]) => void;
}

export function HierarchyList({ metadataKeys, groupBy, onChange }: HierarchyListProps): JSX.Element {
  const catalog = useMemo(() => hierarchyCatalog(metadataKeys), [metadataKeys]);
  const catalogIds = useMemo(() => catalog.map((field) => field.id), [catalog]);
  const groupKey = groupBy.join("|");
  const [customOrder, setCustomOrder] = useState<string[] | null>(null);
  const [seenGroup, setSeenGroup] = useState(groupKey);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const draggedRef = useRef(false);

  if (seenGroup !== groupKey) {
    setSeenGroup(groupKey);
    setCustomOrder(null);
  }

  const order = ensureCatalog(customOrder ?? mergeHierarchyOrder([], catalogIds, groupBy), catalogIds);
  const orderRef = useRef(order);
  orderRef.current = order;
  const labels = new Map(catalog.map((field) => [field.id, field.label]));
  const active = new Set<string>(groupBy);
  let rank = 0;

  function publish(nextOrder: string[], nextActive: readonly string[]): void {
    const levels = hierarchyGroupBy(nextOrder, nextActive);
    setCustomOrder(nextOrder);
    setSeenGroup(levels.join("|"));
    if (levels.join("|") !== groupKey) {
      onChange(levels);
    }
  }

  return (
    <div className="hierarchy">
      <ul ref={listRef} className="hierarchy-list" id="hierarchy" aria-label="Multi-level hierarchy">
        {order.map((id) => {
          const checked = active.has(id);
          if (checked) {
            rank += 1;
          }
          const itemRank = checked ? rank : 0;
          return (
            <li
              key={id}
              className={checked ? "is-on" : undefined}
              draggable
              data-dragging={draggingId === id ? "true" : "false"}
              onClick={() => {
                if (draggedRef.current) {
                  draggedRef.current = false;
                  return;
                }
                const selected = !checked;
                const nextActive = selected
                  ? [id, ...groupBy.filter((level) => level !== id)]
                  : groupBy.filter((level) => level !== id);
                publish(promoteHierarchySelection(order, id, selected, catalogIds, groupBy), nextActive);
                if (selected) {
                  listRef.current?.scrollTo({ top: 0 });
                }
              }}
              onDragStart={(event) => {
                if ((event.target as HTMLElement).closest("input")) {
                  event.preventDefault();
                  return;
                }
                draggedRef.current = true;
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", id);
                window.setTimeout(() => setDraggingId(id), 0);
              }}
              onDragEnd={() => {
                setDraggingId(null);
                const levels = hierarchyGroupBy(orderRef.current, groupBy);
                const key = levels.join("|");
                setSeenGroup(key);
                setCustomOrder(orderRef.current);
                if (key !== groupKey) {
                  onChange(levels);
                }
              }}
              onDragOver={(event) => {
                event.preventDefault();
                if (!draggingId || draggingId === id) {
                  return;
                }
                const rect = event.currentTarget.getBoundingClientRect();
                const placeBefore = event.clientY < rect.top + rect.height / 2;
                const next = moveHierarchyItem(orderRef.current, draggingId, id, placeBefore);
                if (next === orderRef.current) {
                  return;
                }
                orderRef.current = next;
                setCustomOrder(next);
              }}
            >
              <span className="hierarchy-label">{labels.get(id as GroupLevel) ?? id}</span>
              {itemRank > 0 ? <span className="cnt">{itemRank}</span> : null}
              <input
                type="checkbox"
                checked={checked}
                tabIndex={-1}
                aria-hidden="true"
                onPointerDown={(event) => event.stopPropagation()}
                onChange={() => undefined}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
