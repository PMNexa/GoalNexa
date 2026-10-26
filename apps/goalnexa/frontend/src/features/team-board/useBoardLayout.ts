import { useEffect, useRef, useState, type RefObject } from "react";
import type { Board } from "../../api/teamBoard";
import type { Snap } from "../../lib/periods";
import { stickyTop, type Mode, type View } from "./boardHelpers";

/** Full screen: the board's card (grid and save bar) through the browser's Fullscreen API; Esc leaves. */
export function useFullscreen(boardRef: RefObject<HTMLDivElement | null>): [boolean, () => void] {
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === boardRef.current && boardRef.current !== null);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [boardRef]);
  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void boardRef.current?.requestFullscreen?.().catch(() => undefined);
  }
  return [fullscreen, toggleFullscreen];
}

/**
 * The board's grid as the page scrolls: Over time opens scrolled to its
 * latest periods, Targets' tick columns stick next to the team column, and
 * the header rows stay under the app's top bar.
 */
export function useBoardLayout(
  wrapRef: RefObject<HTMLDivElement | null>,
  { board, mode, historyPer, boardAt, view, fullscreen }: {
    board: Board | null;
    mode: Mode;
    historyPer: Snap | null;
    boardAt: string;
    view: View;
    fullscreen: boolean;
  },
) {
  // "Over time" opens on the latest periods (the right end) - once per board
  // shown, so saving a cell (which reloads it) keeps the scroll where it was.
  const scrolledFor = useRef("");
  useEffect(() => {
    const wrap = wrapRef.current;
    const key = `${mode}:${board?.template.id}:${board?.cycle}:${historyPer}:${boardAt}:${view}`;
    // Not before the board with the periods is in (switching keeps the previous one meanwhile).
    const hasHistory = !!board && Object.values(board.instances).some((i) => Object.values(i.metrics).some((n) => n.history));
    if (!wrap || mode !== "history" || !hasHistory || scrolledFor.current === key) return;
    scrolledFor.current = key;
    wrap.scrollLeft = wrap.scrollWidth;
  }, [wrapRef, board, mode, historyPer, boardAt, view]);

  // Targets mode's tick columns stick next to the team column, whose width
  // follows its longest name - so their offset is measured (`--gn-team-w`).
  useEffect(() => {
    const wrap = wrapRef.current;
    const team = wrap?.querySelector<HTMLElement>("thead .gn-team");
    if (!wrap || !team) return;
    const observer = new ResizeObserver(() => wrap.style.setProperty("--gn-team-w", `${team.offsetWidth}px`));
    observer.observe(team);
    return () => observer.disconnect();
  }, [wrapRef, board, mode]);

  // The page scrolls, not the board (it only scrolls sideways, for many
  // columns) - and a sideways scroll box would pin a CSS-sticky header to
  // itself, not the page. So the header rows are moved down to just under
  // the app's top bar as the page scrolls (`--gn-head-y`). Full screen:
  // the board scrolls itself again and CSS sticky does it.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const table = wrap.querySelector("table");
      const head = wrap.querySelector("thead");
      let y = 0;
      if (table && head && !document.fullscreenElement) {
        const top = table.getBoundingClientRect().top;
        y = Math.min(Math.max(0, stickyTop() - top), table.offsetHeight - head.offsetHeight);
      }
      wrap.style.setProperty("--gn-head-y", `${Math.max(0, y)}px`);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, [wrapRef, board, fullscreen]);
}
