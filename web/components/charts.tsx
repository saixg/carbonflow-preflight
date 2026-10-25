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

/** Readiness trend chart with axes and month labels matching the design mockup */
export function ReadinessTrendChart({
  points = [45, 52, 60, 68, 72, 78],
  months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
  height = 140,
}: {
  points?: number[];
  months?: string[];
  height?: number;
}) {
  const reduce = useReducedMotion();
  const w = 340;
  const chartH = height - 26;
  const max = 100;
  const step = (w - 40) / (points.length - 1);

  const xy = points.map((p, i) => [30 + i * step, chartH - 8 - (p / max) * (chartH - 24)] as const);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");

  return (
    <div style={{ width: "100%", display: "grid", gap: 8 }}>
      <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} role="img" aria-label="Readiness score trend">
        <defs>
          <linearGradient id="readiness-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3ddc97" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#3ddc97" stopOpacity="0.0" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#3ddc97" floodOpacity="0.6" />
          </filter>
        </defs>

        {/* Y-axis grid guides */}
        <line x1="30" y1="14" x2={w - 10} y2="14" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
        <line x1="30" y1={chartH / 2} x2={w - 10} y2={chartH / 2} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
        <line x1="30" y1={chartH} x2={w - 10} y2={chartH} stroke="rgba(255,255,255,0.08)" />

        {/* Y-axis labels */}
        <text x="10" y="16" fill="var(--dim)" fontSize="10" fontFamily="var(--mono)">100</text>
        <text x="10" y={chartH / 2 + 3} fill="var(--dim)" fontSize="10" fontFamily="var(--mono)">50</text>
        <text x="18" y={chartH} fill="var(--dim)" fontSize="10" fontFamily="var(--mono)">0</text>

        {/* Gradient fill */}
        <path d={`${line} L${30 + (points.length - 1) * step} ${chartH} L30 ${chartH} Z`} fill="url(#readiness-fill)" />

        {/* Glowing smooth stroke */}
        <motion.path
          d={line}
          fill="none"
          stroke="#3ddc97"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#glow)"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
        />

        {/* Month labels on X axis */}
        {months.map((m, i) => (
          <text
            key={m}
            x={30 + i * step}
            y={height - 4}
            textAnchor="middle"
            fill="var(--dim)"
            fontSize="10"
            fontFamily="var(--sans)"
          >
            {m}
          </text>
        ))}

        {/* Highlight dot on last data point */}
        <circle
          cx={xy[xy.length - 1][0]}
          cy={xy[xy.length - 1][1]}
          r="4.5"
          fill="#3ddc97"
          stroke="#06100d"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}

/** Mini sparkline for KPI cards */
export function Sparkline({
  points = [62, 65, 63, 70, 74, 72, 78],
  width = 64,
  height = 24,
  color = "#3ddc97",
}: {
  points?: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const pts = points.map((p, i) => [i * step, height - 3 - ((p - min) / range) * (height - 6)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: "visible" }}>
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
