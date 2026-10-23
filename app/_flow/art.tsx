import type { CSSProperties, ReactNode } from 'react';
import s from './flow.module.css';

/**
 * The art layer, drawn once: one tapered brush stroke with a dry-brush filter (rough edges and
 * bristle lines), two paints, and a 4-point sparkle. Every screen reuses them through <use>,
 * so the strokes cost no images and no requests.
 */
export function ArtDefs() {
  return (
    <svg width="0" height="0" className={s.artDefs} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="art-paint" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity=".42" />
          <stop offset=".6" stopColor="#fff" stopOpacity=".22" />
          <stop offset="1" stopColor="#fff" stopOpacity=".06" />
        </linearGradient>
        <linearGradient id="art-paint-ink" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#c9b8f6" stopOpacity=".9" />
          <stop offset="1" stopColor="#e9e1fb" stopOpacity=".5" />
        </linearGradient>
        <filter id="art-brush" x="-6%" y="-40%" width="112%" height="180%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.08" numOctaves="3" seed="4" result="warp" />
          <feDisplacementMap in="SourceGraphic" in2="warp" scale="16" xChannelSelector="R" yChannelSelector="G" result="shape" />
          <feTurbulence type="fractalNoise" baseFrequency="0.003 0.55" numOctaves="2" seed="9" result="hair" />
          <feColorMatrix in="hair" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  -2.6 0 0 0 2.1" result="bristles" />
          <feComposite in="shape" in2="bristles" operator="in" />
        </filter>
        <symbol id="art-stroke" viewBox="0 0 400 80">
          <path d="M6 44 C40 20 140 8 250 10 C320 11 380 18 394 30 C400 37 392 45 378 47 C300 55 190 61 90 65 C40 67 8 60 6 44 Z" filter="url(#art-brush)" />
        </symbol>
        <symbol id="art-spark" viewBox="0 0 24 24">
          <path d="M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0 Z" fill="currentColor" />
        </symbol>
      </defs>
    </svg>
  );
}

type BrushProps = { x: string; y: string; w: number; angle?: number; flip?: boolean; tone?: 'white' | 'ink' };

/** One paint stroke, placed absolutely inside a positioned parent. White on violet, lavender on white. */
export function Brush({ x, y, w, angle = 0, flip = false, tone = 'white' }: BrushProps) {
  return (
    <svg
      className={s.brush}
      style={{ left: x, top: y, transform: `rotate(${angle}deg)${flip ? ' scaleX(-1)' : ''}` }}
      width={w}
      height={w / 5}
      fill={tone === 'white' ? 'url(#art-paint)' : 'url(#art-paint-ink)'}
      aria-hidden="true"
      focusable="false"
    >
      <use href="#art-stroke" />
    </svg>
  );
}

const SPARK_TONES = { violet: 'var(--violet)', white: '#fff', light: 'var(--violet-200)' };

export function Spark({ size, tone = 'violet', style }: { size: number; tone?: keyof typeof SPARK_TONES; style?: CSSProperties }) {
  return (
    <svg className={s.spark} style={{ color: SPARK_TONES[tone], ...style }} width={size} height={size} aria-hidden="true" focusable="false">
      <use href="#art-spark" />
    </svg>
  );
}

/**
 * A thin white ring with a dot on its right end. The caller places it behind the person's head.
 * The dot sits in two groups, one for x and one for y, so the CSS can send it round the ring
 * (--rx and --ry are the ring's radii).
 */
export function Orbit({ width, style }: { width: number; style?: CSSProperties }) {
  const h = Math.round(width * 0.28);
  const rx = width / 2 - 8;
  const ry = h / 2 - 8;
  return (
    <svg
      className={s.orbit}
      style={{ '--rx': `${rx}px`, '--ry': `${ry}px`, ...style } as CSSProperties}
      width={width}
      height={h}
      viewBox={`0 0 ${width} ${h}`}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <ellipse cx={width / 2} cy={h / 2} rx={rx} ry={ry} pathLength={1} stroke="#fff" strokeOpacity=".75" strokeWidth="1.8" />
      <g className={s.orbitX}>
        <g className={s.orbitY}>
          <circle cx={width / 2} cy={h / 2} r="5" fill="#fff" />
        </g>
      </g>
    </svg>
  );
}

// Two strokes cross the panel's wide top band; a third runs out of the bottom edge.
const BOARD_STROKES = [
  <Brush key="a" x="-6%" y="-6px" w={320} angle={-4} />,
  <Brush key="b" x="46%" y="2px" w={300} angle={3} flip />,
  <Brush key="c" x="30%" y="calc(100% - 40px)" w={340} angle={-2} />,
];

/**
 * The photo board on a violet panel: brush strokes in the panel's edge, and a white sheet on top,
 * so every photo edge still touches only white.
 */
export function PanelBoard({ strokes = 2, className = '', children }: { strokes?: 2 | 3; className?: string; children: ReactNode }) {
  return (
    <section className={`${s.board} ${s.vpanel} ${s.panelBoard} ${className}`}>
      {BOARD_STROKES.slice(0, strokes)}
      <div className={s.sheet}>{children}</div>
    </section>
  );
}
