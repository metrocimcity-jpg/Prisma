import { useMemo, useRef, useState } from "react";
import type { GroupLevel } from "@/visualization/types";
import {
  ensureCatalog,
  hierarchyCatalog,
  hierarchyGroupBy,
  mergeHierarchyOrder,
  moveHierarchyItem,
} from "@/ui/layout/hierarchy";

interface HierarchyListProps {
  metadataKeys: readonly string[];
  groupBy: readonly GroupLevel[];
  onChange: (groupBy: GroupLevel[]) => void;
}

function GripIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="7" r="1.3" fill="currentColor" />
      <circle cx="15" cy="7" r="1.3" fill="currentColor" />
      <circle cx="9" cy="12" r="1.3" fill="currentColor" />
      <circle cx="15" cy="12" r="1.3" fill="currentColor" />
      <circle cx="9" cy="17" r="1.3" fill="currentColor" />
      <circle cx="15" cy="17" r="1.3" fill="currentColor" />
    </svg>
  );
}

export function HierarchyList({ metadataKeys, groupBy, onChange }: HierarchyListProps): JSX.Element {
  const catalog = useMemo(() => hierarchyCatalog(metadataKeys), [metadataKeys]);
  const catalogIds = useMemo(() => catalog.map((field) => field.id), [catalog]);
  const groupKey = groupBy.join("|");
  const [customOrder, setCustomOrder] = useState<string[] | null>(null);
  const [seenGroup, setSeenGroup] = useState(groupKey);
  const [draggingId, setDraggingId] = useState<string | null>(null);

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
      <p className="hierarchy-hint">Drag to order. Checked fields group the map from top to bottom.</p>
      <ul className="hierarchy-list" id="hierarchy" aria-label="Grouping hierarchy">
        {order.map((id) => {
          const checked = active.has(id);
          if (checked) {
            rank += 1;
          }
          const itemRank = checked ? rank : 0;
          return (
            <li
              key={id}
              draggable
              data-dragging={draggingId === id ? "true" : "false"}
              onDragStart={(event) => {
                if ((event.target as HTMLElement).closest("input")) {
                  event.preventDefault();
                  return;
                }
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
              <span className="hierarchy-grip" title="Drag to reorder">
                <GripIcon />
              </span>
              <span className="hierarchy-rank">{itemRank > 0 ? itemRank : ""}</span>
              <span className="hierarchy-label">{labels.get(id as GroupLevel) ?? id}</span>
              <input
                type="checkbox"
                checked={checked}
                aria-label={`Include ${labels.get(id as GroupLevel) ?? id} in the hierarchy`}
                onPointerDown={(event) => event.stopPropagation()}
                onChange={(event) => {
                  const nextActive = event.target.checked
                    ? [...groupBy, id]
                    : groupBy.filter((level) => level !== id);
                  publish(order, nextActive);
                }}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
