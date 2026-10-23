'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { driftSparks, HERO_MOTION, sparkCount, type DriftSpark } from '@/src/ui/hero';
import s from './flow.module.css';

const TONES = { violet: 'var(--violet)', light: 'var(--violet-200)', white: '#fff' };

/**
 * The first screen's living layer. It sits first in the hero stage, so the CSS can start the idle
 * loops on its siblings once the build-in is over (`.heroIdle ~ ...`). It adds the drifting sparks
 * and the big soft spark that passes close to the camera, and it feeds the mouse position to the
 * stage as --mx and --my (-1 to 1) for the depth shift. With reduced motion it does nothing.
 */
export function HeroMotion() {
  const layer = useRef<HTMLDivElement>(null);
  const near = useRef<SVGSVGElement>(null);
  const [idle, setIdle] = useState(false);
  const [sparks, setSparks] = useState<DriftSpark[]>([]);

  useEffect(() => {
    const stage = layer.current?.parentElement;
    if (!stage || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const panel = stage.querySelector<HTMLElement>(`.${s.heroPanel}`);

    const place = () => {
      const top = panel?.offsetTop ?? stage.offsetHeight;
      const bottom = top + (panel?.offsetHeight ?? 0);
      // On a phone the code form sits under the panel, so the sparks stay above the panel's bottom edge.
      const height = window.innerWidth <= HERO_MOTION.phoneMaxWidth ? bottom : stage.offsetHeight;
      setSparks(driftSparks(sparkCount(window.innerWidth), { width: stage.offsetWidth, height }, { top, bottom }));
    };
    place();
    // Only a width change moves the sparks: a phone's address bar fires resize on scroll, and they must not jump.
    let placedWidth = window.innerWidth;
    let resizeTimer: number | undefined;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (window.innerWidth === placedWidth) return;
        placedWidth = window.innerWidth;
        place();
      }, 200);
    };
    window.addEventListener('resize', onResize);

    const introTimer = window.setTimeout(() => setIdle(true), HERO_MOTION.introMs);

    // The big soft spark: one pass across the stage, skipped while the tab is hidden.
    const pass = () => {
      if (document.hidden || !near.current) return;
      const W = stage.offsetWidth;
      const y = (0.1 + Math.random() * 0.6) * stage.offsetHeight;
      const ltr = Math.random() < 0.5;
      near.current.animate(
        [
          { transform: `translate(${ltr ? -160 : W + 30}px, ${y}px) rotate(0deg) scale(0.8)`, opacity: 0 },
          { opacity: 0.6, offset: 0.2 },
          { opacity: 0.6, offset: 0.8 },
          { transform: `translate(${ltr ? W + 30 : -160}px, ${y - 60 - Math.random() * 100}px) rotate(${ltr ? 220 : -220}deg) scale(1.2)`, opacity: 0 },
        ],
        { duration: 2600, easing: 'cubic-bezier(0.45, 0, 0.55, 1)' },
      );
    };
    const firstPass = window.setTimeout(pass, HERO_MOTION.introMs + 200);
    const passes = window.setInterval(pass, HERO_MOTION.nearEveryMs);

    // Depth shift: only with a real mouse. The loop runs while the layers are still catching up, then stops.
    const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
    let tx = 0, ty = 0, cx = 0, cy = 0, frame = 0;
    const step = () => {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      stage.style.setProperty('--mx', cx.toFixed(4));
      stage.style.setProperty('--my', cy.toFixed(4));
      frame = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.002 ? requestAnimationFrame(step) : 0;
    };
    const aim = (x: number, y: number) => {
      tx = x;
      ty = y;
      if (!frame) frame = requestAnimationFrame(step);
    };
    const onMove = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      const clamp = (v: number) => Math.max(-1, Math.min(1, v));
      aim(clamp(((e.clientX - r.left) / r.width - 0.5) * 2), clamp(((e.clientY - r.top) / r.height - 0.5) * 2));
    };
    const onLeave = () => aim(0, 0);
    if (fine) {
      window.addEventListener('pointermove', onMove);
      document.documentElement.addEventListener('pointerleave', onLeave);
    }

    return () => {
      window.removeEventListener('resize', onResize);
      window.clearTimeout(resizeTimer);
      window.clearTimeout(introTimer);
      window.clearTimeout(firstPass);
      window.clearInterval(passes);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      <div ref={layer} className={`${s.heroDrift} ${idle ? s.heroIdle : ''}`} aria-hidden="true">
        {sparks.map((p, i) => (
          <svg
            key={i}
            width={p.size}
            height={p.size}
            style={
              {
                left: p.x,
                top: p.y,
                color: TONES[p.tone],
                '--dx': `${p.dx}px`,
                '--dy': `${p.dy}px`,
                animationDuration: `${p.durationMs}ms`,
                animationDelay: `${p.delayMs}ms`,
              } as CSSProperties
            }
          >
            <use href="#art-spark" />
          </svg>
        ))}
      </div>
      <svg ref={near} className={s.heroNear} width="130" height="130" aria-hidden="true" focusable="false">
        <use href="#art-spark" />
      </svg>
    </>
  );
}
