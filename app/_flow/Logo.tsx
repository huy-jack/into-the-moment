'use client';

import s from './logo.module.css';

const BRACKETS = ['M8 22V16A8 8 0 0 1 16 8H22', 'M42 8H48A8 8 0 0 1 56 16V22', 'M56 42V48A8 8 0 0 1 48 56H42', 'M22 56H16A8 8 0 0 1 8 48V42'];

type MarkProps = {
  /** Width and height in px. */
  size?: number;
  /** still: the logo. loading: hunts for focus and locks, on a loop. intro: brackets fly in, the dot steps in and locks, once. */
  mode?: 'still' | 'loading' | 'intro';
  /** White brackets and dot, for violet or photo grounds. */
  invert?: boolean;
};

/**
 * Focus Lock: four autofocus corners (the same ones the face check draws) and a violet dot for the person.
 * Rules that keep it clear of known marks: no face in the dot, and the corners never close into a square.
 */
export function Mark({ size = 28, mode = 'still', invert }: MarkProps) {
  return (
    <span
      className={[s.mark, mode !== 'still' && s[mode], invert && s.invert, size <= 20 && s.thick].filter(Boolean).join(' ')}
      style={{ '--size': `${size}px` } as React.CSSProperties}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 64">
        <g className={s.corners}>
          {BRACKETS.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      </svg>
      <span className={s.dot} />
    </span>
  );
}

/** The name with the mark. With `intro`, the mark plays its intro and the letters sharpen one by one after it. */
export function Brand({ intro }: { intro?: boolean }) {
  const letters = [...'Into the Moment'];
  return (
    <span className={`${s.brand} ${intro ? s.brandIntro : ''}`}>
      <Mark size={30} mode={intro ? 'intro' : 'still'} />
      <span className={s.name} aria-label="Into the Moment">
        {letters.map((c, i) => (
          <span key={i} className={i >= 5 && i <= 7 ? s.thin : undefined} style={{ '--n': i } as React.CSSProperties} aria-hidden="true">
            {c === ' ' ? ' ' : c}
          </span>
        ))}
      </span>
    </span>
  );
}

/** A short wait: the hunting mark in a white pill with what is happening. */
export function Loader({ label }: { label: string }) {
  return (
    <span className={s.pill} role="status">
      <Mark size={26} mode="loading" />
      {label}
    </span>
  );
}
