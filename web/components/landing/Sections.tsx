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
          <a href="#how">How it works</a>
          <a href="#product">Product</a>
          <a href="#boundaries">Boundaries</a>
        </nav>
        <div className="acts">
          <Link href="/login" className="muted">Sign in</Link>
          <Link href="/login?mode=signup" className="btn btn-primary btn-sm">Get started <ArrowRight size={14} weight="bold" /></Link>
        </div>
      </div>
    </header>
  );
}

function ScanCard() {
  const reduce = useReducedMotion();
  const rows = [
    { c: "var(--crit)", n: 3, l: "Critical" },
    { c: "var(--warn)", n: 5, l: "Material" },
    { c: "var(--info)", n: 2, l: "Minor" },
  ];
  return (
    <motion.aside
      className="scan"
      aria-label="Sample preflight scan"
      initial={reduce ? false : { opacity: 0, y: 30, rotate: 0 }}
      animate={{ opacity: 1, y: 0, rotate: -3 }}
      transition={{ delay: 0.5, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
    >
      <h4><CheckCircle size={20} weight="fill" color="var(--accent)" /> Preflight scan complete</h4>
      <ul>
        {rows.map((r) => (
          <li key={r.l}>
            <span className="dot" style={{ background: r.c }} />
            <b className="mono">{r.n}</b> {r.l}
          </li>
        ))}
      </ul>
      <p className="hint" style={{ marginTop: 12 }}>Sample data</p>
    </motion.aside>
  );
}

export function Hero() {
  return (
    <section className="wrap hero" aria-labelledby="hero-h">
      <div>
        <Reveal y={16}>
          <h1 id="hero-h">Catch issues <em>before</em> they cost you time and credits.</h1>
        </Reveal>
        <Reveal delay={0.1} y={16}>
          <p className="lead">Preflight checks your monitoring data, calculations and evidence against methodology rules, with a source for every finding.</p>
        </Reveal>
        <Reveal delay={0.2} y={16}>
          <div className="cta">
            <Link href="/login?mode=signup" className="btn btn-primary btn-lg">Get started <ArrowRight size={16} weight="bold" /></Link>
            <Link href="/sample" className="btn btn-lg">View sample report</Link>
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
        <Link href="/login?mode=signup" className="btn btn-primary btn-lg">Get started <ArrowRight size={16} weight="bold" /></Link>
      </Reveal>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="foot">
      <div className="wrap">
        <p>CarbonFlow Preflight provides a preparedness assessment only. It is not a verification or certification, and it does not guarantee the issuance of carbon credits.</p>
        <Link href="/login" className="muted"><UploadSimple size={14} style={{ verticalAlign: "-2px" }} /> Sign in</Link>
      </div>
    </footer>
  );
}
