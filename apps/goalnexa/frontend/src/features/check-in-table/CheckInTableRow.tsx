import type { ReactNode } from "react";
import RowMenu, { type RowMenuItem } from "../../components/RowMenu";
import { CollapseToggle } from "../../components/GoalFilterList";
import type { useSiblingDrag } from "../../lib/ordering";
import type { Row } from "./buildTable";

const PlusIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 5l0 14" />
    <path d="M5 12l14 0" />
  </svg>
);

/** One row's drag props, from `useSiblingDrag`. */
export type RowDrag = ReturnType<ReturnType<typeof useSiblingDrag>>;

export interface CheckInTableRowProps {
  row: Row;
  columns: string[];
  drag: RowDrag;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** A goal row's team/"Total" tag, if any. */
  tag: ReactNode;
  /** The "+" menu's entries. */
  menuItems: RowMenuItem[];
  /** A metric row's input in the new check-in column. */
  draftValue: string;
  draftPlaceholder: string;
  onDraftChange: (value: string) => void;
  /** Enter in the input: save the column. */
  onDraftSubmit: () => void;
}

/**
 * A goal or metric row: its name (the drag handle, with collapse toggle,
 * tag and "+" menu), target, one cell per column and - for a metric - its
 * input in the new check-in column.
 */
export function CheckInTableRow({
  row,
  columns,
  drag,
  collapsed,
  onToggleCollapsed,
  tag,
  menuItems,
  draftValue,
  draftPlaceholder,
  onDraftChange,
  onDraftSubmit,
}: CheckInTableRowProps) {
  return (
    <tr
      className={
        row.kind === "goal" ? "gn-goal-row" : undefined
      }
      {...drag.target}
    >
      <th
        className="gn-sticky"
        scope="row"
        style={{
          paddingLeft: `${0.6 + row.depth * 1.1}rem`,
          fontWeight: row.kind === "goal" ? 600 : 400,
        }}
        title={`${row.label}\nDrag to reorder`}
        {...drag.source}
      >
        <span className="d-flex align-items-center gap-1">
          {row.hasChildren ? (
            <CollapseToggle
              collapsed={collapsed}
              name={row.label}
              onToggle={onToggleCollapsed}
            />
          ) : (
            <span
              className="gn-collapse-gap"
              aria-hidden="true"
            />
          )}
          <span className="flex-grow-1 text-truncate">
            {row.label}
            {tag}
          </span>
          <RowMenu
            label={`Add to ${row.label}`}
            icon={PlusIcon}
            items={menuItems}
          />
        </span>
      </th>
      <td className="gn-target" title={row.targetTitle}>
        {row.target ?? ""}
      </td>
      {columns.map((col) => {
        const cell = row.cells.get(col);
        return (
          <td
            key={col}
            className="gn-cell"
            title={cell?.title}
          >
            {cell && (
              <>
                {cell.main}
                {cell.sub && (
                  <span className="gn-sub">{cell.sub}</span>
                )}
              </>
            )}
          </td>
        );
      })}
      <td className="gn-fill" />
      <td className="gn-draft">
        {row.kind === "metric" && (
          <input
            type="number"
            step="any"
            className="form-control form-control-sm text-end"
            aria-label={`New check-in for ${row.label}`}
            placeholder={draftPlaceholder}
            value={draftValue}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onDraftSubmit();
            }}
          />
        )}
      </td>
    </tr>
  );
}
