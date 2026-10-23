"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const Hero = dynamic(() => import("./HeroIsland"), { ssr: false });
const Docs = dynamic(() => import("./DocsStack"), { ssr: false });

const subscribe = (cb: () => void) => {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
export const useReducedMotion3D = () =>
  useSyncExternalStore(
    subscribe,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );

/** Lazy 3D stage. Renders only while visible, and renders a single static frame under reduced motion. */
export default function Scene({ kind, className }: { kind: "hero" | "docs"; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const reduced = useReducedMotion3D();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "100px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const loop = visible && !reduced ? "always" : "demand";
  return (
    <div ref={ref} className={className} style={{ width: "100%", height: "100%" }} aria-hidden="true">
      {kind === "hero" ? <Hero frameloop={loop} reduced={reduced} /> : <Docs frameloop={loop} reduced={reduced} />}
    </div>
  );
}
