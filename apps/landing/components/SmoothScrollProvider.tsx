"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";

/**
 * Wraps the whole app in an inertia-based smooth scroll (Lenis).
 * We drive Lenis from our own requestAnimationFrame loop rather than
 * lenis.autoRaf so every scroll-linked animation in the tree (Framer
 * Motion's useScroll, our custom hooks, Three.js scroll-scrubs) reads
 * from the *same* frame — no drift between scroll position and motion.
 */
export default function SmoothScrollProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.15,
      easing: (t: number) => 1 - Math.pow(1 - t, 4), // quart-out: heavy, deliberate — a drafting arm settling, not a bouncy scroll
      smoothWheel: true,
      touchMultiplier: 1.1,
    });
    lenisRef.current = lenis;

    // Expose for any component that wants to scrollTo() programmatically
    (window as unknown as { __lenis?: Lenis }).__lenis = lenis;

    let rafId = 0;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
