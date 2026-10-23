"use client";

import { motion, useReducedMotion } from "motion/react";

export type Slice = { label: string; value: number; color: string };

/** Donut with the total in the middle. Each arc draws in once. */
export function Donut({ slices, caption = "Total", size = 150 }: { slices: Slice[]; caption?: string; size?: number }) {
  const reduce = useReducedMotion();
  const total = slices.reduce((a, s) => a + s.value, 0);
  const r = 52;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
      <svg width={size} height={size} viewBox="0 0 140 140" role="img" aria-label={`${total} ${caption}`}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" />
        {total > 0 &&
          slices.map((s, i) => {
            const len = (s.value / total) * c;
            const off = acc;
            acc += len;
            return (
              <motion.circle
                key={s.label}
                cx="70"
                cy="70"
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth="14"
                strokeDasharray={`${Math.max(len - 3, 0)} ${c}`}
                strokeDashoffset={-off}
                transform="rotate(-90 70 70)"
                initial={reduce ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.9, delay: 0.1 * i, ease: [0.16, 1, 0.3, 1] }}
              />
            );
          })}
        <text x="70" y="68" textAnchor="middle" fill="var(--text)" fontSize="26" fontWeight="600">
          {total}
        </text>
        <text x="70" y="86" textAnchor="middle" fill="var(--muted)" fontSize="11">
          {caption}
        </text>
      </svg>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8, fontSize: 14 }}>
        {slices.map((s) => (
          <li key={s.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="dot" style={{ background: s.color }} />
            <span className="muted" style={{ minWidth: 70 }}>{s.label}</span>
            <b className="mono">{s.value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Progress ring for "x of y checks". Shows numerator and denominator, never a bare percentage. */
export function CheckRing({ done, total, size = 120 }: { done: number; total: number; size?: number }) {
  const reduce = useReducedMotion();
  const r = 48;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={`${done} of ${total} checks passed`}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="9" />
      <motion.circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={c}
        transform="rotate(-90 60 60)"
        initial={reduce ? false : { strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - done / total) }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
      />
      <text x="60" y="58" textAnchor="middle" fill="var(--text)" fontSize="24" fontWeight="600">
        {done}/{total}
      </text>
      <text x="60" y="76" textAnchor="middle" fill="var(--muted)" fontSize="10">
        checks passed
      </text>
    </svg>
  );
}

/** Small area line, drawn in on view. */
export function Trend({ points, height = 120 }: { points: number[]; height?: number }) {
  const reduce = useReducedMotion();
  const w = 320;
  const max = Math.max(...points, 1);
  const step = w / (points.length - 1);
  const xy = points.map((p, i) => [i * step, height - 12 - (p / max) * (height - 28)] as const);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none" role="img" aria-label="Trend">
      <defs>
        <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.28" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w} ${height} L0 ${height} Z`} fill="url(#trend-fill)" />
      <motion.path
        d={line}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  );
}
