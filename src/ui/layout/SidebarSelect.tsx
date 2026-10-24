import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface SidebarSelectOption {
  value?: string;
  label: string;
  children?: readonly SidebarSelectOption[];
}

function selectedLabel(options: readonly SidebarSelectOption[], value: string): string {
  for (const option of options) {
    if (option.value === value) {
      return option.label;
    }
    const child = option.children?.find((item) => item.value === value);
    if (child) {
      return `${option.label} · ${child.label}`;
    }
  }
  return value;
}

interface SidebarSelectProps {
  id: string;
  value: string;
  options: readonly SidebarSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function SidebarSelect({
  id,
  value,
  options,
  onChange,
  disabled = false,
  className,
  ariaLabel,
}: SidebarSelectProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const [box, setBox] = useState({ top: 0, left: 0, width: 0, maxHeight: 240 });
  const current = selectedLabel(options, value);

  function place(): void {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const below = window.innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    const openUp = below < 160 && above > below;
    const maxHeight = Math.max(120, Math.min(240, openUp ? above : below));
    setBox({
      top: openUp ? Math.max(8, rect.top - 4 - maxHeight) : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      maxHeight,
    });
  }

  useEffect(() => {
    if (!open) {
      return;
    }
    place();
    const closeOnOutside = (event: MouseEvent): void => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", place);
    document.addEventListener("scroll", place, true);
    menuRef.current?.querySelector<HTMLButtonElement>("[aria-selected='true']")?.scrollIntoView({ block: "nearest" });
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", place);
      document.removeEventListener("scroll", place, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={["sidebar-select", open ? "is-open" : "", className].filter(Boolean).join(" ")}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="sidebar-select-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => setOpen((currentOpen) => !currentOpen)}
      >
        <span>{current}</span>
        <span className="sidebar-select-chevron" aria-hidden="true" />
      </button>
      {open
        ? createPortal(
            <ul
              ref={menuRef}
              id={listId}
              className="sidebar-select-menu"
              role="listbox"
              aria-labelledby={ariaLabel ? undefined : id}
              aria-label={ariaLabel}
              style={{ top: box.top, left: box.left, width: box.width, maxHeight: box.maxHeight }}
            >
              {options.flatMap((option) => {
                const rows = option.children?.length
                  ? [
                      <li key={`${option.label}-group`} className="sidebar-select-group" role="presentation">
                        {option.label}
                      </li>,
                      ...option.children.map((child) => optionRow(child, value, true, onChange, () => setOpen(false))),
                    ]
                  : [optionRow(option, value, false, onChange, () => setOpen(false))];
                return rows;
              })}
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
}

function optionRow(
  option: SidebarSelectOption,
  value: string,
  child: boolean,
  onChange: (value: string) => void,
  close: () => void,
): JSX.Element {
  const selected = option.value === value;
  return (
    <li key={option.value ?? option.label}>
      <button
        type="button"
        role="option"
        aria-selected={selected}
        className={[selected ? "is-on" : "", child ? "is-child" : ""].filter(Boolean).join(" ") || undefined}
        onClick={() => {
          if (option.value) {
            onChange(option.value);
          }
          close();
        }}
      >
        {option.label}
      </button>
    </li>
  );
}
