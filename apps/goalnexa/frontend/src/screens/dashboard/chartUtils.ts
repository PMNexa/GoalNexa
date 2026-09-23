import { useEffect, useRef, useState } from "react";

/** A goal's fixed color slot (1-8) - assigned at selection time and kept while selected, so a filter change never repaints the survivors. */
export function seriesColor(slot: number): string {
  return `var(--gn-series-${slot})`;
}

export function formatPct(pct: number): string {
  return `${Math.round(pct)}%`;
}

/** Container width via ResizeObserver; `fallback` covers SSR/first paint. */
export function useElementWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(Math.max(240, Math.floor(el.getBoundingClientRect().width)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** 0 up to at least 100%, rounded up to the next 25% step - over-target progress stays in view. */
export function pctDomainMax(values: number[]): number {
  return Math.max(100, Math.ceil(Math.max(0, ...values) / 25) * 25);
}

/** Every 25/50/100% - the smallest step that keeps ticks >= `minGapPx` apart across `lengthPx`. */
export function pctTicks(max: number, lengthPx: number, minGapPx = 36): number[] {
  const step = [25, 50, 100, 250, 500].find((s) => (lengthPx / max) * s >= minGapPx) ?? 1000;
  const ticks: number[] = [];
  for (let v = 0; v <= max; v += step) ticks.push(v);
  return ticks;
}

/** Shorten a label to fit roughly `maxChars` (SVG text can't ellipsize itself). */
export function truncate(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : `${text.slice(0, Math.max(1, maxChars - 1))}…`;
}
