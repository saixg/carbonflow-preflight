"use client";

import { animate, motion, useInView, useReducedMotion, useScroll, useSpring } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Enter-on-scroll. Reveals content in reading order so the eye follows the page. */
export function Reveal({ children, delay = 0, y = 24, className }: { children: ReactNode; delay?: number; y?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Counts up once when scrolled into view, so a changed number draws attention. */
export function CountUp({ to, className }: { to: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce ? to : 0);
  useEffect(() => {
    if (!inView || reduce) return;
    const c = animate(0, to, { duration: 1.1, ease: EASE, onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [inView, to, reduce]);
  return (
    <span ref={ref} className={className}>
      {reduce ? to : v}
    </span>
  );
}

/** Vertical rail that fills as the process list scrolls past. */
export function ScrollRail({ target }: { target: React.RefObject<HTMLElement | null> }) {
  const { scrollYProgress } = useScroll({ target, offset: ["start 70%", "end 60%"] });
  const scaleY = useSpring(scrollYProgress, { stiffness: 120, damping: 24, mass: 0.4 });
  return (
    <div className="rail" aria-hidden="true">
      <motion.i style={{ scaleY }} />
    </div>
  );
}

export function Pop({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 300, damping: 22 }}>
      {children}
    </motion.div>
  );
}
