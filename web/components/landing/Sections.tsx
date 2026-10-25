"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useRef } from "react";
import {
  ArrowRight, CheckCircle, Fingerprint, FileText, GitBranch, Leaf, ListChecks, MagnifyingGlass,
  ShieldCheck, Table, UploadSimple, XCircle, ClockCounterClockwise, Package,
} from "@phosphor-icons/react/ssr";
import Scene from "@/components/three/Scene";
import { Reveal, ScrollRail } from "@/components/motion";
import { AUTH_ENABLED } from "@/lib/flags";

const START = AUTH_ENABLED ? "/login?mode=signup" : "/dashboard";

export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="CarbonFlow Preflight home">
      <span className="brand-mark"><Leaf size={20} weight="fill" /></span>
      <span>
        <b>CarbonFlow</b>
        <span>Preflight</span>
      </span>
    </Link>
  );
}

export function Nav() {
  return (
    <header className="lnav">
      <div className="wrap">
        <Brand />
        <nav aria-label="Primary">
          <a href="#product">Product</a>
          <a href="#how">How it works</a>
          <a href="#use-cases">Use cases</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <div className="acts">
          <Link href="/login" className="muted">Sign in</Link>
          <Link href={START} className="btn btn-primary btn-sm">Get started <ArrowRight size={14} weight="bold" /></Link>
        </div>
      </div>
    </header>
  );
}

function ScanCard() {
  const reduce = useReducedMotion();
  const rows = [
    { c: "#ff6b6b", bg: "rgba(255, 107, 107, 0.15)", n: 3, l: "Critical" },
    { c: "#f0b64a", bg: "rgba(240, 182, 74, 0.15)", n: 6, l: "Need Attention" },
    { c: "#5aa9ff", bg: "rgba(90, 169, 255, 0.15)", n: 3, l: "Minor" },
  ];
  return (
    <motion.aside
      className="scan holo-tablet"
      aria-label="Sample preflight scan"
      style={{
        border: "1px solid rgba(61, 220, 151, 0.45)",
        boxShadow: "0 25px 60px rgba(0, 0, 0, 0.65), 0 0 35px rgba(61, 220, 151, 0.2)",
        borderRadius: "20px",
      }}
      initial={reduce ? false : { opacity: 0, y: 35, rotate: 0 }}
      animate={{ opacity: 1, y: 0, rotate: -2 }}
      transition={{ delay: 0.4, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <CheckCircle size={22} weight="fill" color="var(--accent)" />
        <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Preflight Scan Complete</h4>
      </div>

      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Total Findings</span>
        <span className="mono" style={{ color: "var(--text)", fontWeight: 700, fontSize: 15 }}>12 Findings</span>
      </div>

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8, fontSize: 13 }}>
        {rows.map((r) => (
          <li key={r.l} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", borderRadius: 8, background: "rgba(255, 255, 255, 0.03)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="dot" style={{ background: r.c }} />
              <span style={{ color: "var(--text)" }}>{r.l}</span>
            </div>
            <span className="mono badge-count" style={{ background: r.bg, color: r.c, border: `1px solid ${r.c}44` }}>
              {r.n}
            </span>
          </li>
        ))}
      </ul>

      <div style={{ marginTop: 16 }}>
        <Link
          href="/sample"
          className="btn btn-sm"
          style={{
            width: "100%",
            borderRadius: 999,
            borderColor: "rgba(61, 220, 151, 0.4)",
            background: "rgba(61, 220, 151, 0.08)",
            color: "var(--accent)",
            fontWeight: 600,
          }}
        >
          View Report <ArrowRight size={13} weight="bold" />
        </Link>
      </div>
    </motion.aside>
  );
}

export function Hero() {
  return (
    <section className="wrap hero" aria-labelledby="hero-h" style={{ position: "relative" }}>
      <div>
        <Reveal y={16}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 16px",
              borderRadius: 999,
              background: "rgba(61, 220, 151, 0.08)",
              border: "1px solid rgba(61, 220, 151, 0.28)",
              color: "#3ddc97",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.08em",
              marginBottom: 20,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3ddc97", boxShadow: "0 0 8px #3ddc97" }} />
            AI-ASSISTED · EVIDENCE-BACKED · VERIFICATION READY
          </div>
        </Reveal>

        <Reveal delay={0.08} y={16}>
          <h1 id="hero-h" style={{ maxWidth: "16ch" }}>
            Catch issues <em style={{ color: "var(--accent)", textShadow: "0 0 24px rgba(61,220,151,0.35)" }}>before</em> they cost you time, money and <em style={{ color: "var(--accent)", textShadow: "0 0 24px rgba(61,220,151,0.35)" }}>credits.</em>
          </h1>
        </Reveal>

        <Reveal delay={0.16} y={16}>
          <p className="lead" style={{ fontSize: 16, lineHeight: 1.6, maxWidth: "52ch" }}>
            CarbonFlow Preflight helps you prepare your carbon project documents, data and calculations for independent verification — faster, cleaner and with full traceability.
          </p>
        </Reveal>

        <Reveal delay={0.24} y={16}>
          <div className="cta" style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <Link href={START} className="btn btn-primary btn-lg" style={{ borderRadius: 999, padding: "0 28px", fontWeight: 600 }}>
              Get started <ArrowRight size={16} weight="bold" />
            </Link>
            <Link
              href="/sample"
              className="btn btn-lg"
              style={{
                borderRadius: 999,
                padding: "0 24px",
                background: "rgba(255, 255, 255, 0.04)",
                borderColor: "rgba(255, 255, 255, 0.15)",
                display: "inline-flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              <span style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(255, 255, 255, 0.1)", display: "grid", placeItems: "center" }}>
                ▶
              </span>
              Watch demo
            </Link>
          </div>
        </Reveal>

        <Reveal delay={0.32} y={16}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 16,
              marginTop: 48,
              paddingTop: 32,
              borderTop: "1px solid var(--line)",
            }}
          >
            <div>
              <strong style={{ fontSize: 32, fontWeight: 700, color: "var(--text)", display: "block" }}>60%</strong>
              <span style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.4 }}>Faster verification preparation</span>
            </div>
            <div>
              <strong style={{ fontSize: 32, fontWeight: 700, color: "var(--text)", display: "block" }}>40%</strong>
              <span style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.4 }}>Lower consultant effort</span>
            </div>
            <div>
              <strong style={{ fontSize: 32, fontWeight: 700, color: "var(--text)", display: "block" }}>90%</strong>
              <span style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.4 }}>Issues caught early</span>
            </div>
            <div>
              <strong style={{ fontSize: 32, fontWeight: 700, color: "var(--text)", display: "block" }}>100%</strong>
              <span style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.4 }}>Evidence traceability</span>
            </div>
          </div>
        </Reveal>
      </div>

      <div className="stage">
        <Scene kind="hero" />
        <ScanCard />
      </div>
    </section>
  );
}

export function Principles() {
  const items = [
    { i: <Fingerprint size={26} />, t: "Hash-verified evidence", d: "Every uploaded document is fingerprinted and never overwritten." },
    { i: <MagnifyingGlass size={26} />, t: "Traceable to the source", d: "Each value points to a page and passage you can open." },
    { i: <ListChecks size={26} />, t: "Rules, not guesses", d: "Deterministic checks decide. AI only reads and explains." },
    { i: <ClockCounterClockwise size={26} />, t: "Reproducible runs", d: "Rulepack, engine and inputs are frozen with every run." },
  ];
  return (
    <div className="band">
      <div className="wrap">
        {items.map((x, n) => (
          <Reveal key={x.t} delay={n * 0.07} className="cell">
            {x.i}
            <b>{x.t}</b>
            <span>{x.d}</span>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

const STEPS = [
  { t: "Upload", d: "Add monitoring reports, meter logs and agreements for a monitoring period. Files are stored privately and hashed." },
  { t: "Extract", d: "Key values are read from each document and kept with their page and passage. Anything uncertain goes to a person." },
  { t: "Validate", d: "Versioned rules check completeness, units, dates, calculations and consistency across documents." },
  { t: "Review", d: "Your team works through findings, corrects inputs and records a reason for every decision." },
  { t: "Report", d: "Export a preflight report and an evidence manifest that a verifier can follow back to the source." },
];

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <section id="how" className="sec wrap">
      <div className="flow">
        <div className="sticky">
          <h2>From raw files to a reviewable record.</h2>
          <p className="sub">Five stages, each leaving a trail you can inspect later.</p>
        </div>
        <div className="steps" ref={ref}>
          <ScrollRail target={ref} />
          {STEPS.map((s) => (
            <Reveal key={s.t} className="step">
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Bento() {
  return (
    <section id="product" className="sec wrap" style={{ paddingTop: 0 }}>
      <Reveal>
        <h2>Every finding shows its evidence.</h2>
        <p className="sub">No black box. Open any result and see the rule, the input and the passage behind it.</p>
      </Reveal>
      <div className="bento">
        <Reveal className="card b-a grad-a">
          <div>
            <h3>Evidence beside every value</h3>
            <p>Read the extracted figure next to the exact passage it came from, then accept or correct it.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr)", gap: 14 }}>
            <div className="paper" style={{ minHeight: 0, padding: 22, fontSize: 13 }}>
              <h4 style={{ marginTop: 0 }}>2.4 Electricity generation</h4>
              The total net electricity exported to the grid during the monitoring period is <mark data-active="true">152,345 MWh</mark>.
            </div>
            <div className="fieldcard" style={{ cursor: "default" }}>
              <small>Net electricity exported</small>
              <b>152,345 <span className="muted" style={{ fontSize: 13 }}>MWh</span></b>
              <span><span className="chip ok">High confidence</span></span>
              <small>Source: page 12</small>
            </div>
          </div>
        </Reveal>
        <Reveal delay={0.06} className="card b-b grad-b">
          <ListChecks size={24} color="var(--info)" />
          <h3>Versioned rule checks</h3>
          <p>Completeness, units, dates, calculations and cross-document consistency.</p>
        </Reveal>
        <Reveal delay={0.12} className="card b-c">
          <GitBranch size={24} color="var(--accent)" />
          <h3>Reviewable decisions</h3>
          <p>Acknowledge, resolve or dismiss a finding with a recorded reason. History stays.</p>
        </Reveal>
        <Reveal className="card b-d">
          <Package size={24} color="var(--accent)" />
          <h3>Report and evidence manifest</h3>
          <p>A readable report plus a manifest of document hashes and source locations.</p>
          <div style={{ display: "grid", gap: 8 }}>
            {["Preflight report (PDF)", "Findings (CSV)", "Evidence manifest (JSON)"].map((f) => (
              <div key={f} className="chip" style={{ justifySelf: "start" }}><FileText size={14} /> {f}</div>
            ))}
          </div>
        </Reveal>
        <Reveal delay={0.06} className="card b-e" >
          <Table size={24} color="var(--accent)" />
          <h3>Frozen inputs per run</h3>
          <p>Re-run after corrections without losing the original. Compare runs side by side.</p>
        </Reveal>
      </div>
    </section>
  );
}

export function Boundaries() {
  const does = [
    "Checks data and calculations against versioned rules",
    "Links each finding to its source document and passage",
    "Keeps a history of reviews and corrections",
    "Produces a report and an evidence manifest",
  ];
  const doesNot = [
    "Certify or verify a project",
    "Predict whether credits will be issued",
    "Replace an accredited verifier",
    "Let an AI model decide compliance",
  ];
  return (
    <section id="boundaries" className="sec wrap" style={{ paddingTop: 0 }}>
      <Reveal>
        <h2>A preparedness tool, not a verifier.</h2>
        <p className="sub">Independent verifiers make the verification decision. Preflight helps you arrive with fewer surprises.</p>
      </Reveal>
      <div className="cols2">
        <Reveal className="card">
          <h3>What it does</h3>
          <ul>{does.map((t) => <li key={t}><CheckCircle size={18} weight="fill" color="var(--accent)" />{t}</li>)}</ul>
        </Reveal>
        <Reveal delay={0.08} className="card">
          <h3>What it does not do</h3>
          <ul>{doesNot.map((t) => <li key={t}><XCircle size={18} weight="fill" color="var(--crit)" />{t}</li>)}</ul>
        </Reveal>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="wrap">
      <Reveal className="final">
        <ShieldCheck size={32} color="var(--accent)" />
        <h2>Run your first preflight.</h2>
        <p className="sub" style={{ marginTop: 0 }}>Create a project, add a monitoring period and bring your evidence.</p>
        <Link href={START} className="btn btn-primary btn-lg">Get started <ArrowRight size={16} weight="bold" /></Link>
      </Reveal>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="foot">
      <div className="wrap">
        <p>CarbonFlow Preflight provides a preparedness assessment only. It is not a verification or certification, and it does not guarantee the issuance of carbon credits.</p>
        {AUTH_ENABLED && <Link href="/login" className="muted"><UploadSimple size={14} style={{ verticalAlign: "-2px" }} /> Sign in</Link>}
      </div>
    </footer>
  );
}
