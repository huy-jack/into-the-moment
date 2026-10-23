'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { getJob, type ApiJob, type Problem } from '@/src/ui/api';
import { extraCount } from '@/src/ui/hero';
import { errorRoute, focusBlur, ledgerRows, resultSummary, stageView, stepIndex, thumbLabel, versionsForDisplay, type VersionView } from '@/src/ui/flow';
import type { Photo } from './photos';
import { findFaces, type Found } from './faces';
import { faceCrop, type FaceBox } from '@/src/ui/face';
import type { Seen } from './useJob';
import { Head, Icon, Tile } from './parts';
import { Brush, PanelBoard, Spark } from './art';
import { Loader, Mark } from './Logo';
import s from './flow.module.css';

export type Local = { template: Photo | null; users: Photo[] };

type Props = {
  job: ApiJob | null;
  seen: Seen[];
  loadError: string | null;
  local: Local;
  onStartOver: () => void;
  /** Back to a compose step, keeping the photos when this browser still has them. */
  onFix: (step: 'moment' | 'you') => void;
  onRetry: (() => void) | null;
  onRerun: (p: Problem) => void;
  rerunning: Problem | null;
  rerunError: string | null;
};

export function JobView(p: Props) {
  const { job } = p;
  if (!job) {
    return (
      <>
        <Head onHome={p.onStartOver} />
        <main className={s.solo}>
          {p.loadError ? (
            <>
              <h1>We can’t open this photo</h1>
              <p className={s.error} role="alert">
                {p.loadError}
              </p>
              <button className={s.btn} type="button" onClick={p.onStartOver}>
                Start a new photo <Icon name="arrow" />
              </button>
            </>
          ) : (
            <Loader label="Opening your photo" />
          )}
        </main>
      </>
    );
  }
  const versions = versionsForDisplay(job.candidates);
  if (job.status === 'done' || (job.status === 'failed' && versions.some((v) => v.url))) return <Result {...p} job={job} versions={versions} />;
  if (job.status === 'failed') return <Failed {...p} job={job} />;
  return <Waiting {...p} job={job} />;
}

function useElapsed(since: string): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const secs = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}

function CopyLink() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(window.location.href).catch(() => undefined);
    setCopied(true);
  };
  return (
    <button className={`${s.btnLine} ${s.spaced}`} type="button" onClick={copy}>
      {copied ? 'Link copied' : 'Copy the link'}
    </button>
  );
}

function Waiting({ job, seen, local, onStartOver }: Props & { job: ApiJob }) {
  const stage = stageView(job.stage);
  const rows = ledgerRows(seen, new Date(job.createdAt).getTime());
  const elapsed = useElapsed(job.createdAt);
  const moment = job.inputs?.template ?? local.template?.previewUrl;
  return (
    <>
      <Head guide="Making your photo" onHome={onStartOver} />
      <main className={`${s.page} ${s.textFirst}`}>
        <h1 className={`${s.title} ${s.shimmer}`} aria-live="polite">
          {stage.label}
        </h1>
        <section className={s.text}>
          <p className={s.srOnly} role="status">
            Now: {stage.label}
          </p>
          <p className={s.lede}>{stage.detail}</p>
          <ol className={s.ledger} aria-label="Steps">
            {rows.map((r, i) => (
              <li key={i} className={s[r.state]} aria-current={r.state === 'now' ? 'step' : undefined}>
                <span>
                  <span className={s.srOnly}>{r.state === 'done' ? 'Done: ' : r.state === 'now' ? 'Now: ' : 'Next: '}</span>
                  {r.label}
                </span>
                {r.at && <span className={s.ledgerAt}>{r.at}</span>}
              </li>
            ))}
          </ol>
          <p className={s.elapsed}>
            <span className={s.num}>{elapsed}</span> so far. This can take a few minutes.
          </p>
          <p className={s.help}>You can leave this page. The link in your address bar brings you back to this photo.</p>
          <CopyLink />
        </section>
        {/* The moment you chose, out of focus. Each finished stage brings it closer to sharp; only the real result is sharp. */}
        <PanelBoard strokes={3} className={s.waitBoard}>
          <Tile caption="You in the moment" alt={`In progress: ${stage.label}`}>
            {moment && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={s.focusPull} src={moment} alt="" style={{ '--b': `${focusBlur(rows)}px` } as React.CSSProperties} />
            )}
            <span className={s.waitMark}>
              <Mark size={72} mode="loading" invert={!!moment} />
            </span>
            <span className={`${s.emptyNote} ${s.waitNote}`}>{stage.label}</span>
          </Tile>
        </PanelBoard>
      </main>
    </>
  );
}

function Failed({ job, local, onStartOver, onFix, onRetry }: Props & { job: ApiJob }) {
  const err = job.error ?? { code: 'PROVIDER_ERROR' as const, message: 'Something went wrong. Try again.' };
  const route = errorRoute(err.code);
  return (
    <>
      <Head guide="Your photo" onHome={onStartOver} />
      <main className={s.solo}>
        <h1>{route === 'closed' ? 'The demo is closed' : route === 'you' ? 'None of your photos could be used' : 'This photo could not be made'}</h1>
        <p className={s.error} role="alert">
          {err.message}
        </p>
        {route === 'you' && (
          <p className={s.help}>
            Your photos passed the quick check on this device, but the closer check before making the photo did not accept them.
          </p>
        )}
        <div className={s.actionsInline}>
          {route === 'you' && (
            <button className={s.btn} type="button" onClick={() => onFix('you')}>
              Change your photos <Icon name="arrow" />
            </button>
          )}
          {route === 'moment' && (
            <button className={s.btn} type="button" onClick={() => onFix('moment')}>
              Choose another moment <Icon name="arrow" />
            </button>
          )}
          {route === 'retry' && onRetry && (
            <button className={s.btn} type="button" onClick={onRetry}>
              Try again <Icon name="arrow" />
            </button>
          )}
          {route !== 'closed' && (
            <button className={s.btnLine} type="button" onClick={onStartOver}>
              Start over with a new moment
            </button>
          )}
        </div>
        {route !== 'closed' && (
          <p className={s.help}>
            {route === 'you' && local.template ? 'Change your photos keeps your moment chosen. ' : ''}Start over clears the photos in this
            browser.
          </p>
        )}
        {(job.inputs || local.template) && (
          <PanelBoard className={s.failedBoard}>
            <div className={`${s.grid2} ${s.failedTiles}`}>
              <Tile caption="The moment" src={job.inputs?.template ?? local.template?.previewUrl} alt="The moment you chose" crop />
              {(job.inputs?.users ?? local.users.map((u) => u.previewUrl)).map((u, i) => (
                <div key={u}>
                  <Tile caption={`You, photo ${i + 1}`} src={u} alt={`Your photo ${i + 1}`} crop />
                  {/* The job stops on a photo problem only when every photo failed, so each one is marked. */}
                  {route === 'you' && (
                    <p className={`${s.status} ${s.bad}`}>
                      <Icon name="cross" /> Not used
                    </p>
                  )}
                </div>
              ))}
            </div>
          </PanelBoard>
        )}
      </main>
    </>
  );
}

async function save(url: string, name: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const href = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement('a'), { href, download: name });
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
  } catch {
    // Storage may refuse a cross-site download; opening the photo still lets the user save it.
    window.open(url, '_blank', 'noopener');
  }
}

const FIXES: { problem: Problem; label: string; detail: string }[] = [
  { problem: 'face', label: 'The face is not me', detail: 'Make it again with a new approach to your face' },
  { problem: 'body', label: 'Wrong age or body', detail: 'Make it again with a stronger note on age and build' },
  { problem: 'scene', label: 'Something in the scene is wrong', detail: 'Make it again with more weight on the pose and place' },
];

/** The job a quick fix came from, so its versions stay on the page to compare. */
function useParent(id: string | null): ApiJob | null {
  const [parent, setParent] = useState<ApiJob | null>(null);
  useEffect(() => {
    if (!id) return;
    let live = true;
    getJob(id).then(
      (j) => live && setParent(j),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [id]);
  return parent?.id === id ? parent : null;
}

const PHONE = '(max-width: 820px)';
const subscribePhone = (cb: () => void) => {
  const m = window.matchMedia(PHONE);
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
};
const usePhone = () => useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE).matches, () => false);

/** "Version 1 · Most like you" without the best label, which the panel shows as a pill. */
const plainTitle = (v: VersionView) => v.title.replace(' · Most like you', '');

/**
 * The result as a photo studio: one large photo with a filmstrip of every version (same size thumbnails,
 * nothing hidden), and one side panel for the chosen version: is it you, save it, or say what is wrong.
 */
function Result({ job, versions, local, onStartOver, onRerun, rerunning, rerunError }: Props & { job: ApiJob; versions: VersionView[] }) {
  const best = versions[0];
  const template = job.inputs?.template ?? local.template?.previewUrl;
  const you = job.inputs?.users ?? local.users.map((u) => u.previewUrl);
  const yourFace = useYourFace(local.users, job.inputs?.users);
  const parent = useParent(job.parentJobId);
  const before = parent ? versionsForDisplay(parent.candidates) : [];
  const child = job.route === 'child';
  const all = [...versions, ...before];
  const [pick, setPick] = useState(0);
  const cur = all[pick] ?? versions[0];
  const curNo = pick + 1;
  // The full-size viewer shows every made version, then the moment, so action and scene compare at the same size.
  const shots: Shot[] = [
    ...all.flatMap((v) => (v.url ? [{ src: v.url, label: v.title, best: v.best }] : [])),
    ...(template ? [{ src: template, label: 'The moment' }] : []),
  ];
  const [view, setView] = useState<number | null>(null);
  const openShot = (src: string) => setView(Math.max(0, shots.findIndex((x) => x.src === src)));
  return (
    <>
      <Head guide="Your photo" onHome={onStartOver} />
      <main className={s.result}>
        <div className={s.resultHead}>
          <h1>{best?.url ? 'Here you are' : 'No version came out'}</h1>
          <p className={s.lede}>{resultSummary(versions)}</p>
          <p className={s.srOnly} role="status">
            Your photo is ready.
          </p>
          {job.error && (
            <p className={s.error} role="alert">
              {job.error.message}
            </p>
          )}
        </div>
        <div className={s.studio}>
          <Stage v={cur} moment={template} onOpen={openShot}>
            {/* Desktop: the moment and your first photo as stickers on either side of the filmstrip. Phone: every input in a row. */}
            <div className={s.stageFoot}>
              {template && (
                <a className={`${s.sticker} ${s.resSticker} ${s.wideOnly}`} style={{ '--tilt': '-5deg' } as React.CSSProperties} href={template} target="_blank" rel="noopener" aria-label="Open the moment full size">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={template} alt="" />
                  <span className={s.stickerKey}>The moment</span>
                </a>
              )}
              <div className={s.filmstrip} role="group" aria-label="Every version">
                {versions.map((v, i) => (
                  <Thumb key={v.slot + i} v={v} on={i === pick} onPick={() => setPick(i)} />
                ))}
                {before.length > 0 && <span className={s.filmLabel}>Before the fix</span>}
                {before.map((v, i) => (
                  <Thumb key={'p' + v.slot + i} v={v} on={versions.length + i === pick} onPick={() => setPick(versions.length + i)} />
                ))}
              </div>
              {you[0] && (
                <a className={`${s.sticker} ${s.resSticker} ${s.wideOnly}`} style={{ '--tilt': '4deg' } as React.CSSProperties} href={you[0]} target="_blank" rel="noopener" aria-label="Open your photo 1 full size">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={you[0]} alt="" />
                  <span className={s.stickerKey}>You</span>
                  {extraCount(you.length) && (
                    <span className={s.stickerBadge} aria-label={`and ${you.length - 1} more`}>
                      {extraCount(you.length)}
                    </span>
                  )}
                </a>
              )}
              <div className={`${s.inputRow} ${s.phoneOnly}`} role="group" aria-label="Made from">
                {template && (
                  <a href={template} target="_blank" rel="noopener" aria-label="Open the moment full size">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={template} alt="" />
                    <span className={s.stickerKey}>The moment</span>
                  </a>
                )}
                {you.map((u, i) => (
                  <a key={u} href={u} target="_blank" rel="noopener" aria-label={`Open your photo ${i + 1} full size`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="" />
                    <span className={s.stickerKey}>You {i + 1}</span>
                  </a>
                ))}
              </div>
            </div>
          </Stage>
          <aside className={s.panel} aria-label={`About ${plainTitle(cur)}`}>
            <div className={s.panelHead}>
              <h2>{plainTitle(cur)}</h2>
              {cur.best && <span className={s.pill}>Most like you</span>}
            </div>
            {cur.notes.length > 0 && (
              <ul className={s.notes}>
                {cur.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
                {child && cur.outcome === 'refused' && <li>Photos with a child are refused more often. Try a different moment.</li>}
              </ul>
            )}
            {cur.url && <FaceDetail you={yourFace} src={cur.url} title={plainTitle(cur)} />}
            {cur.url && (
              <div className={s.saveRow}>
                <button type="button" className={s.btn} onClick={() => void save(cur.url!, `into-the-moment-${curNo}.png`)}>
                  Save photo <Icon name="download" />
                </button>
                <button type="button" className={s.linkBtn} onClick={() => openShot(cur.url!)}>
                  Open full size
                </button>
              </div>
            )}
            {cur.url && <p className={`${s.help} ${s.phoneOnly}`}>On a phone: open full size, press and hold the photo, then choose Save to Photos.</p>}
            <section className={s.fixList} aria-labelledby="fix-title">
              <h3 id="fix-title">Not right?</h3>
              <p className={s.help}>We make a new photo from your own photos. It takes 1 to 3 minutes, and these versions stay here.</p>
              {FIXES.map((f) => (
                <button key={f.problem} type="button" className={s.fixItem} disabled={!!rerunning} onClick={() => onRerun(f.problem)}>
                  <span>
                    <strong>{f.label}</strong>
                    <span>{rerunning === f.problem ? 'Starting a new photo' : f.detail}</span>
                  </span>
                  <span className={s.fixChip}>{rerunning === f.problem ? <Mark size={20} mode="loading" /> : <Icon name="arrow" />}</span>
                </button>
              ))}
              {rerunError && (
                <p className={s.error} role="alert">
                  {rerunError}
                </p>
              )}
            </section>
            <p className={s.help}>
              <button className={s.linkBtn} type="button" onClick={onStartOver}>
                Start over with a new moment
              </button>{' '}
              clears the photos in this browser. These versions stay at this page&apos;s link.
            </p>
          </aside>
        </div>
        {view !== null && shots.length > 0 && <Viewer shots={shots} at={view} onMove={setView} onClose={() => setView(null)} />}
      </main>
    </>
  );
}

/** One version in the filmstrip: a same-size thumbnail with its number; a version not made shows a cross. */
function Thumb({ v, on, onPick }: { v: VersionView; on: boolean; onPick: () => void }) {
  return (
    <button type="button" className={s.thumbBtn} aria-pressed={on} onClick={onPick} aria-label={v.url ? v.title : `${v.title}: not made`}>
      <span className={`${s.thumbImg} ${v.url ? '' : s.thumbMissing}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {v.url && <img src={v.url} alt="" />}
        {v.best && <span className={s.bestDot} aria-hidden="true" />}
      </span>
      <span className={s.thumbCap}>
        {thumbLabel(v)
          .split(' · ')
          .map((part) => (
            <span key={part}>{part}</span>
          ))}
      </span>
    </button>
  );
}

/**
 * The large photo. A visible switch shows the moment in the same frame (press and hold does the same);
 * a tap opens it full size. A version that was not made shows why.
 */
function Stage({ v, moment, onOpen, children }: { v: VersionView; moment?: string; onOpen: (src: string) => void; children: ReactNode }) {
  const [momentOn, setMomentOn] = useState(false);
  const { holding, handlers, endedHold } = useHold();
  const showMoment = !!moment && !!v.url && (momentOn || holding);
  const open = () => {
    if (!endedHold() && v.url) onOpen(showMoment && moment ? moment : v.url);
  };
  return (
    <section className={`${s.stage} ${s.vpanel}`} aria-label="Your photo">
      <Brush x="-4%" y="16%" w={460} angle={-5} />
      <Brush x="56%" y="44%" w={440} angle={4} flip />
      <Brush x="6%" y="74%" w={420} angle={-2} />
      <Spark size={30} tone="white" style={{ right: 28, top: 84 }} />
      <div className={s.stageTop}>
        {v.url && moment ? (
          <div className={s.segment} role="group" aria-label="Show">
            <button type="button" aria-pressed={!showMoment} onClick={() => setMomentOn(false)}>
              {plainTitle(v).split(' · ')[0]}
            </button>
            <button type="button" aria-pressed={showMoment} onClick={() => setMomentOn(true)}>
              The moment
            </button>
          </div>
        ) : (
          <span />
        )}
        {v.url && (
          <button type="button" className={s.roundBtn} aria-label="Open full size" onClick={() => onOpen(showMoment && moment ? moment : v.url!)}>
            <Icon name="expand" />
          </button>
        )}
      </div>
      {v.url ? (
        <div
          className={`${s.stagePhoto} ${s.print}`}
          role="button"
          tabIndex={0}
          aria-label={`${v.title}. Press to open full size. Press and hold to see the moment it came from.`}
          {...handlers}
          onClick={open}
          onKeyDown={(e) => {
            if (e.key === 'Enter') open();
            handlers.onKeyDown(e);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={showMoment ? 'moment' : v.url} src={showMoment ? moment : v.url} alt={showMoment ? 'The moment you chose' : `You in the moment, ${v.title}`} />
          <span className={`${s.hand} ${s.printCap}`} aria-hidden="true">
            {showMoment ? 'the moment' : 'you, in the moment'}
          </span>
        </div>
      ) : (
        <div className={s.stageEmpty}>
          <Icon name="cross" />
          <strong>Not made</strong>
          <span>{v.notes[0] ?? 'This version could not be made.'} Your other versions are fine.</span>
        </div>
      )}
      {children}
    </section>
  );
}

const HOLD_DELAY_MS = 250;
const HOLD_SLOP_PX = 8;

/**
 * Press and hold to compare. The swap waits 250 ms and a move of 8 px cancels it, so scrolling past
 * a tile never flashes the moment. No touch-action lock: the page still scrolls under a finger.
 */
function useHold() {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Set when a hold happened, so the click that ends it does not also open the photo.
  const held = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const release = () => {
    clearTimeout(timer.current);
    start.current = null;
    setHolding(false);
  };
  return {
    holding,
    /** True once when a click ends a hold: the caller then skips its tap action. */
    endedHold: () => {
      const h = held.current;
      held.current = false;
      return h;
    },
    handlers: {
      onPointerDown: (e: PointerEvent) => {
        start.current = { x: e.clientX, y: e.clientY };
        held.current = false;
        timer.current = setTimeout(() => {
          held.current = true;
          setHolding(true);
        }, HOLD_DELAY_MS);
      },
      onPointerMove: (e: PointerEvent) => {
        const p = start.current;
        if (p && !holding && Math.hypot(e.clientX - p.x, e.clientY - p.y) > HOLD_SLOP_PX) release();
      },
      onPointerUp: release,
      onPointerCancel: release,
      onPointerLeave: release,
      onContextMenu: (e: { preventDefault(): void }) => e.preventDefault(),
      onKeyDown: (e: KeyboardEvent) => {
        if (e.key !== ' ') return;
        e.preventDefault();
        setHolding(true);
      },
      onKeyUp: (e: KeyboardEvent) => {
        if (e.key === ' ') release();
      },
      onBlur: release,
    },
  };
}

type Face = { src: string; box: FaceBox; width: number; height: number };

const largest = (f: Found) => f.faces.reduce<FaceBox | null>((a, b) => (!a || b.score > a.score ? b : a), null);

/**
 * Your face for the close-ups: the biggest face among this browser's photos (found at upload), or,
 * when the link was opened elsewhere, the first stored photo the finder can read.
 */
function useYourFace(users: Photo[], stored: string[] | undefined): Face | null {
  const local = users
    .filter((u) => u.face)
    .map((u) => ({ src: u.previewUrl, ...u.face! }))
    .sort((a, b) => b.box.h / b.height - a.box.h / a.height)[0];
  const remote = useFound(local ? undefined : stored?.[0]);
  return local ?? remote;
}

/** Finds the main face in one image once. Null while loading or when it cannot be read. */
function useFound(src: string | null | undefined): Face | null {
  const [face, setFace] = useState<Face | null>(null);
  useEffect(() => {
    if (!src) return;
    let live = true;
    void findFaces(src).then((f) => {
      const box = f && largest(f);
      if (live && f && box) setFace({ src, box, width: f.width, height: f.height });
    });
    return () => {
      live = false;
    };
  }, [src]);
  return face?.src === src ? face : null;
}

/** One square crop around a face, eyes on the same line as its partner. */
function Crop({ face, label }: { face: Face; label: string }) {
  // Tighter on a phone, so the face is about 120 px tall in a 160 px tile.
  const c = faceCrop(face.box, face.width, face.height, usePhone() ? 1.3 : 2);
  return (
    <figure className={s.crop}>
      <div
        className={s.cropImg}
        role="img"
        aria-label={label}
        style={{ backgroundImage: `url("${face.src}")`, backgroundSize: `${c.size}%`, backgroundPosition: `${c.posX}% ${c.posY}%` }}
      />
      <figcaption>{label}</figcaption>
    </figure>
  );
}

/** Your face beside this version's face, same size: the quickest way to answer "is that me?". */
function FaceDetail({ you, src, title }: { you: Face | null; src: string; title: string }) {
  const theirs = useFound(src);
  if (!you || !theirs) return null;
  return (
    <div role="group" aria-label={`Face close-up: you and ${title}`}>
      <p className={s.detailLabel}>Is this you?</p>
      <div className={s.detail}>
        <Crop face={you} label="You" />
        <Crop face={theirs} label="This version" />
      </div>
    </div>
  );
}

type Shot = { src: string; label: string; best?: boolean };

/**
 * Full size, inside the app: one photo at a time on a dark ground, thumbnails to switch, arrow keys and
 * Escape. The photo changes with a short focus pull. "Open the original" keeps the phone save path.
 */
function Viewer({ shots, at, onMove, onClose }: { shots: Shot[]; at: number; onMove: (i: number) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const shot = shots[at] ?? shots[0];
  const move = (dir: 1 | -1) => onMove(stepIndex(at, shots.length, dir));
  return (
    <dialog
      ref={ref}
      className={s.viewer}
      aria-label={`Full size: ${shot.label}`}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') move(1);
        if (e.key === 'ArrowLeft') move(-1);
      }}
    >
      <div className={s.viewerTop}>
        <span className={`${s.viewerCap} ${shot.best ? s.viewerBest : ''}`}>{shot.label}</span>
        <a className={s.viewerLink} href={shot.src} target="_blank" rel="noopener">
          Open the original
        </a>
        <button type="button" className={s.viewerClose} aria-label="Close" onClick={() => ref.current?.close()}>
          <Icon name="cross" />
        </button>
      </div>
      <div className={s.viewerStage}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={shot.src} src={shot.src} alt={shot.label} />
        {shots.length > 1 && (
          <>
            <button type="button" className={`${s.viewerNav} ${s.viewerPrev}`} aria-label="Previous photo" onClick={() => move(-1)}>
              <Icon name="back" />
            </button>
            <button type="button" className={`${s.viewerNav} ${s.viewerNext}`} aria-label="Next photo" onClick={() => move(1)}>
              <Icon name="arrow" />
            </button>
          </>
        )}
      </div>
      <div className={s.viewerThumbs}>
        {shots.map((x, i) => (
          <button key={x.src} type="button" aria-pressed={i === at} aria-label={x.label} onClick={() => onMove(i)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={x.src} alt="" />
          </button>
        ))}
      </div>
    </dialog>
  );
}
