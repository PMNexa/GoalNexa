import { Fragment, useRef, useState } from "react";
import { FormControl, useT } from "platform-core";
import type { Board, BoardMetric, CellNumbers, ShownNumbers } from "../../api/teamBoard";
import type { Snap } from "../../lib/periods";
import { fmt, fmtChange, heat, periodEditable, shownPct, type HistoryShow } from "./boardHelpers";
import { foldBlocks, historyStarts, periodTipLines, goalOrder, type BoardBlock } from "./boardRows";
import { ChevronIcon } from "./boardIcons";
import { readStored, writeStored } from "../../lib/storedState";
import messages from "./messages";

/** Folded Over time rows, per template: block keys (`goalnexa:board-folded`). */
const FOLDED_KEY = "goalnexa:board-folded";

/** The floating details under a hovered "Over time" cell. */
export interface PeriodTip {
  left: number;
  top: number;
  lines: string[];
}

export interface HistoryTableProps {
  board: Board;
  /** The board's teams and totals with their cells (`boardBlocks`). */
  blocks: BoardBlock[];
  /** One column per this period. */
  per: Snap;
  /** A save is running - no cell can be edited meanwhile. */
  busy: boolean;
  /** The hovered cell's details - kept by the screen, which hides them when the board scrolls. */
  tip: PeriodTip | null;
  onTip: (tip: PeriodTip | null) => void;
  /** A cell typed into and left: set that period to `typed` (see `savePeriod`). */
  onSavePeriod: (metric: BoardMetric, numbers: CellNumbers, cell: ShownNumbers, per: Snap, typed: string) => void;
  /**
   * What the cells hold (`shownBlocks`): "value" (editable), or each period's
   * change from the one before / distance from the start (signed, no %
   * shading), or its % of target (shaded by it). Only "value" is editable.
   */
  show?: HistoryShow;
}

/**
 * "Over time": rows are teams (and totals) -> their goals -> metrics,
 * columns the periods up to the picked day; a cell is what was done in
 * that period (or its last reading), against its target per that period.
 * A team's cell the caller may check in on is edited in place.
 */
function HistoryTable({ board, blocks, per, busy, tip: periodTip, onTip, onSavePeriod, show = "value" }: HistoryTableProps) {
  const signed = show === "change" || show === "start";
  const t = useT(messages);
  // The cell being typed into.
  const [periodEdit, setPeriodEdit] = useState<{ key: string; value: string } | null>(null);
  // Esc drops the typed number - the input's blur then mustn't save it.
  const periodCancel = useRef(false);
  const templateId = board.template.id;
  const [folded, setFolded] = useState<Set<string>>(() => new Set(readStored<Record<string, string[]>>(FOLDED_KEY, {})[templateId] ?? []));
  const [foldedFor, setFoldedFor] = useState(templateId);
  if (foldedFor !== templateId) {
    setFoldedFor(templateId);
    setFolded(new Set(readStored<Record<string, string[]>>(FOLDED_KEY, {})[templateId] ?? []));
  }

  function toggleFold(key: string) {
    const next = new Set(folded);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setFolded(next);
    writeStored(FOLDED_KEY, { ...readStored<Record<string, string[]>>(FOLDED_KEY, {}), [templateId]: [...next] });
  }

  function savePeriod(metric: BoardMetric, numbers: CellNumbers, cell: ShownNumbers, typed: string) {
    setPeriodEdit(null);
    onSavePeriod(metric, numbers, cell, per, typed);
  }

  function showPeriodTip(target: HTMLElement, lines: string[]) {
    const rect = target.getBoundingClientRect();
    onTip({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 280)), top: rect.bottom + 4, lines });
  }

  const { starts, label } = historyStarts(blocks, per);
  const span = Math.max(starts.length, 1);
  const goals = goalOrder(board);
  const metricDepth = (metric: BoardMetric): number => {
    let depth = 0;
    let parent = metric.parent;
    while (parent) {
      depth += 1;
      parent = board.metrics.find((m) => m.id === parent)?.parent ?? null;
    }
    return depth;
  };
  return (
    <>
    <table className="gn-board gn-history">
      <thead>
        <tr>
          <th className="gn-team">{t("historyHead")}</th>
          {starts.length ? starts.map((start) => <th key={start} className="gn-num">{label(start)}</th>) : <th>{t("noHistory")}</th>}
        </tr>
      </thead>
      <tbody>
        {foldBlocks(blocks, folded).map(({ block, folded: isFolded }) => (
          <Fragment key={block.key}>
            <tr className={block.sub ? "gn-total" : "gn-group"}>
              <th className="gn-team" style={{ paddingLeft: `${0.55 + block.depth * 1.1}rem` }}>
                <button
                  type="button"
                  className="gn-row-fold"
                  aria-expanded={!isFolded}
                  title={t(isFolded ? "expandRow" : "collapseRow", { name: block.sub ? `${block.label} ${block.sub}` : block.label })}
                  onClick={() => toggleFold(block.key)}
                >
                  {ChevronIcon(!isFolded)}
                  <span>
                    {block.label}
                    {block.sub && <span className="gn-sub">{block.sub}</span>}
                  </span>
                </button>
              </th>
              <td colSpan={span}></td>
            </tr>
            {!isFolded && goals.map((goal) => {
              const metrics = board.metrics.filter((m) => m.template_goal === goal.id);
              if (metrics.length === 0) return null;
              return (
                <Fragment key={goal.id}>
                  <tr>
                    <th className="gn-team gn-history-goal" style={{ paddingLeft: `${1.2 + (block.depth + goal.depth) * 1.1}rem` }}>
                      {goal.title}
                    </th>
                    <td colSpan={span}></td>
                  </tr>
                  {metrics.map((metric) => {
                    const numbers = block.metrics[metric.id];
                    return (
                      <tr key={metric.id}>
                        <th
                          className="gn-team gn-history-metric"
                          style={{ paddingLeft: `${2.3 + (block.depth + goal.depth + metricDepth(metric)) * 1.1}rem` }}
                        >
                          {metric.name}
                          {metric.unit && <span className="text-secondary"> ({metric.unit})</span>}
                        </th>
                        {starts.map((start, index) => {
                          const cell = numbers?.history?.[index] ?? null;
                          const pct = show === "pct" ? cell?.value ?? null : cell && numbers && show === "value" ? shownPct(cell, numbers, metric) : null;
                          const key = `${block.key}:${metric.id}:${index}`;
                          const editable = show === "value" && !!block.canCheckIn && !!numbers && !!cell && !busy && periodEditable(metric, per);
                          if (periodEdit?.key === key && numbers && cell) {
                            return (
                              <td key={start} className="gn-cell gn-num">
                                <FormControl
                                  autoFocus
                                  inputMode="decimal"
                                  aria-label={`${metric.name}, ${block.label}, ${label(start)}`}
                                  value={periodEdit.value}
                                  onChange={(e) => setPeriodEdit({ key, value: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") e.currentTarget.blur();
                                    else if (e.key === "Escape") {
                                      periodCancel.current = true;
                                      setPeriodEdit(null);
                                    }
                                  }}
                                  onBlur={(e) => {
                                    if (periodCancel.current) periodCancel.current = false;
                                    else savePeriod(metric, numbers, cell, e.currentTarget.value);
                                  }}
                                />
                              </td>
                            );
                          }
                          const tip = () => periodTipLines(block, metric, cell, label(start), editable, per, show);
                          const startEdit = () => {
                            periodCancel.current = false;
                            onTip(null);
                            setPeriodEdit({ key, value: cell?.value === null || !cell ? "" : String(cell.value) });
                          };
                          return (
                            <td
                              key={start}
                              className={`gn-cell gn-num ${heat(pct)}${editable ? " gn-period-edit" : ""}`}
                              tabIndex={editable ? 0 : undefined}
                              onClick={editable ? startEdit : undefined}
                              onKeyDown={
                                editable
                                  ? (e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        startEdit();
                                      }
                                    }
                                  : undefined
                              }
                              onMouseEnter={(e) => showPeriodTip(e.currentTarget, tip())}
                              onMouseLeave={() => onTip(null)}
                              onFocus={(e) => showPeriodTip(e.currentTarget, tip())}
                              onBlur={() => onTip(null)}
                            >
                              {signed ? (
                                <span className={cell?.value ? (cell.value > 0 ? "text-success" : "text-danger") : undefined}>
                                  {fmtChange(cell?.value)}
                                </span>
                              ) : cell?.value === null || cell === null ? "—" : show === "pct" ? `${fmt(Math.round(cell.value))}%` : fmt(cell.value)}
                              {cell?.quota !== null && cell?.quota !== undefined && (
                                <span className="text-secondary"> / {fmt(cell.quota)}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </Fragment>
        ))}
      </tbody>
    </table>
    {periodTip && (
      <div className="gn-period-tip" style={{ left: periodTip.left, top: periodTip.top }} role="tooltip">
        {periodTip.lines.map((line, i) => <div key={i}>{line}</div>)}
      </div>
    )}
    </>
  );
}

export default HistoryTable;
