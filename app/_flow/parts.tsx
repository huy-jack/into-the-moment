'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { logOut } from '@/src/ui/api';
import { faceInSquare } from '@/src/ui/face';
import { Brand } from './Logo';
import type { Photo } from './photos';
import s from './flow.module.css';

type Steps = { labels: string[]; current: number; /** Done steps are buttons that go back to them. */ onPick?: (i: number) => void };

/** The top bar: name on the left; in the three compose steps, a segmented control naming where you are. */
export function Head({ guide, steps, onHome, intro }: { guide?: ReactNode; steps?: Steps; onHome?: () => void; /** Play the logo intro (first screen only). */ intro?: boolean }) {
  return (
    <header className={s.head}>
      {onHome ? (
        <button type="button" className={s.brand} onClick={onHome} aria-label="Into the Moment: start a new photo">
          <Brand />
        </button>
      ) : (
        <span className={s.brand}>
          <Brand intro={intro} />
        </span>
      )}
      <span className={s.headRight}>
        {steps ? <StepControl {...steps} /> : guide && <span className={s.guide}>{guide}</span>}
        {!intro && <LogOut />}
      </span>
    </header>
  );
}

/** Ends the session and returns to the code screen. Photos made so far stay at their links. */
function LogOut() {
  const out = async () => {
    await logOut().catch(() => undefined);
    // A full load on purpose: it drops ?job= and every photo held in memory, and the app asks for the code again.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign('/');
  };
  return (
    <button type="button" className={s.logOut} onClick={() => void out()}>
      Log out
    </button>
  );
}

/** The white thumb slides to the current step, so the move shows the direction: forward or back. */
function StepControl({ labels, current, onPick }: Steps) {
  const list = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const place = () => {
      const cur = list.current?.querySelector<HTMLElement>('[aria-current="step"]');
      if (cur && thumb.current) {
        thumb.current.style.left = `${cur.offsetLeft}px`;
        thumb.current.style.width = `${cur.offsetWidth}px`;
      }
    };
    place();
    window.addEventListener('resize', place);
    void document.fonts?.ready.then(place);
    return () => window.removeEventListener('resize', place);
  }, [current]);
  return (
    <div ref={list} className={s.steps}>
      <span ref={thumb} className={s.thumb} aria-hidden="true" />
      <ol aria-label={`Step ${current + 1} of ${labels.length}`}>
      {labels.map((label, i) => (
        <li key={label} aria-current={i === current ? 'step' : undefined} className={i < current ? s.stepDone : undefined}>
          {i < current && onPick ? (
            <button type="button" onClick={() => onPick(i)} aria-label={`${label}, done. Go back to this step`}>
              <Icon name="check" /> {label}
            </button>
          ) : (
            label
          )}
        </li>
      ))}
      </ol>
    </div>
  );
}

type TileProps = {
  caption: string;
  src?: string | null;
  alt: string;
  /** Square crop for small grids; full photo otherwise, so nothing the user judges is cut. */
  crop?: boolean;
  /** The version most like the user: its caption becomes a pill. */
  best?: boolean;
  size?: 'small' | 'large';
  /** The face the browser found; drawn as an autofocus box on a square crop. */
  face?: Photo['face'];
  /** An upload in progress: the photo sharpens from blurred as this goes 0 to 1, and a ring fills in the corner. */
  progress?: number;
  /** Corner badge: a ring while uploading, a check when ready, a cross when refused. */
  badge?: Photo['status'];
  children?: ReactNode;
};

const RING = 2 * Math.PI * 11;

/** A photo in a rounded tile. The only colour on the page lives inside these. */
export function Tile({ caption, src, alt, crop, best, size, face, progress, badge, children }: TileProps) {
  const box = crop && src && face && badge !== 'uploading' ? faceInSquare(face.box, face.width, face.height) : null;
  const p = progress ?? 1;
  return (
    <figure className={[s.tile, best && s.best, size === 'small' && s.tileSmall, size === 'large' && s.tileLarge].filter(Boolean).join(' ')}>
      <div className={crop ? s.photoCrop : s.photoFull} style={{ '--p': p } as React.CSSProperties}>
        {/* Signed, short-lived storage links and local previews: the image optimizer adds nothing here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {src ? <img src={src} alt={alt} className={progress !== undefined ? s.developing : undefined} /> : <div className={s.empty} role="img" aria-label={alt} />}
        {box && (
          <span
            className={s.faceBox}
            aria-hidden="true"
            style={{ left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%` }}
          >
            <i />
            <i />
            <i />
            <i />
          </span>
        )}
        {badge && src && (
          <span className={`${s.badge} ${badge === 'ready' ? s.badgeOk : badge === 'bad' ? s.badgeBad : ''}`} aria-hidden="true">
            {badge === 'uploading' ? (
              <svg viewBox="0 0 30 30" width="30" height="30">
                <circle className={s.ring} cx="15" cy="15" r="11" strokeDasharray={RING} strokeDashoffset={RING * (1 - p)} />
              </svg>
            ) : (
              <Icon name={badge === 'ready' ? 'check' : 'cross'} />
            )}
          </span>
        )}
        {children}
      </div>
      <figcaption>{best ? <span className={s.pill}>{caption}</span> : caption}</figcaption>
    </figure>
  );
}

type IconName = 'check' | 'cross' | 'arrow' | 'download' | 'plus' | 'back' | 'trash' | 'expand';

const PATHS: Record<IconName, string> = {
  check: 'M4 10.5l4 4 8-9',
  cross: 'M5 5l10 10M15 5L5 15',
  arrow: 'M4 10h11M11 6l4 4-4 4',
  back: 'M16 10H5M9 6l-4 4 4 4',
  download: 'M10 3v10M6 9l4 4 4-4M4 16h12',
  plus: 'M10 4v12M4 10h12',
  trash: 'M4.5 6h11M8 6V4.5h4V6M6 6l.8 9.5h6.4L14 6',
  expand: 'M12 4h4v4M8 16H4v-4M16 4l-5 5M4 16l5-5',
};

export function Icon({ name }: { name: IconName }) {
  return (
    <svg className={`${s.icon} ${s[`i_${name}`] ?? ''}`} viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      <path d={PATHS[name]} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
