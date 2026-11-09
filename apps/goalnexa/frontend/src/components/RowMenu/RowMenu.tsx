import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface RowMenuItem {
  label: string;
  onSelect: () => void;
  /** Draw a divider above this item (to set it apart, e.g. Edit / Delete after the adds). */
  divider?: boolean;
  /** A destructive action, drawn in red. */
  danger?: boolean;
}

export interface RowMenuProps {
  /** The toggle's accessible name, e.g. "Add to Game Udi". */
  label: string;
  icon: ReactNode;
  items: RowMenuItem[];
}

/**
 * A tree row's "+" button as a small dropdown (Tabler's `dropdown-menu`
 * markup, opened by React state - Bootstrap's JS isn't loaded). The menu
 * is `position: fixed` at the toggle's corner (inline, since Bootstrap's
 * `.dropdown-menu` sets `absolute`; flips above the toggle near the viewport's bottom), not absolute: the goal
 * tree is a scroll box, which would clip a menu opened near its bottom.
 * A disclosure like platform-core's `UserMenu`; closes on an outside
 * click, Escape, a scroll or resize (the fixed menu would drift), or a pick.
 */
function RowMenu({ label, icon, items }: RowMenuProps) {
  const [position, setPosition] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const open = position !== null;

  useEffect(() => {
    if (!open) return;
    const close = () => setPosition(null);
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) close();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      close();
      toggleRef.current?.focus();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  function toggle() {
    const rect = toggleRef.current?.getBoundingClientRect();
    if (open || !rect) return setPosition(null);
    const right = window.innerWidth - rect.right;
    // Not enough room below for the menu (~36px per item): open upward.
    const needed = items.length * 36 + 16;
    setPosition(
      window.innerHeight - rect.bottom < needed && rect.top > needed
        ? { bottom: window.innerHeight - rect.top + 2, right }
        : { top: rect.bottom + 2, right },
    );
  }

  return (
    <div className="gn-row-menu" ref={rootRef}>
      <button
        ref={toggleRef}
        type="button"
        className="btn btn-icon btn-sm btn-ghost-primary gn-row-btn"
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={toggle}
      >
        {icon}
      </button>
      {position && createPortal(
        <div
          ref={menuRef}
          id={menuId}
          className="dropdown-menu show gn-row-menu-list"
          style={{ position: "fixed", top: position.top, bottom: position.bottom, right: position.right, left: "auto", zIndex: 1050, minWidth: "10rem" }}
        >
          {items.map((item) => (
            <Fragment key={item.label}>
              {item.divider && <div className="dropdown-divider" />}
              <button
                type="button"
                className={`dropdown-item${item.danger ? " text-danger" : ""}`}
                onClick={() => {
                  setPosition(null);
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            </Fragment>
          ))}
        </div>,
        // In <body>: a transformed or clipping ancestor (the team board's
        // sticky header cells use `transform`) would trap a fixed menu.
        document.body,
      )}
    </div>
  );
}

export default RowMenu;
