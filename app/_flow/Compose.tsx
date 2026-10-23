'use client';

import { useEffect } from 'react';
import { USER_PHOTOS_MAX } from '@/src/config';
import { warmFaces } from './faces';
import { HERO, fileFromUrl } from '@/src/ui/hero';
import { addPhoto, type Photo } from './photos';
import { PanelBoard } from './art';
import { Hero } from './Hero';
import { Head, Icon, Tile } from './parts';
import { Mark } from './Logo';
import s from './flow.module.css';

export type ComposeStep = 'moment' | 'you' | 'check';

const ACCEPT = 'image/jpeg,image/png,image/webp';

// No retention promise here: deleting photos after the evaluation is planned, not built.
const PRIVACY = 'Your photos are sent to AI image services to make this photo. We store them privately.';
// Made from owned stock (credits in fixtures/photos/CREDITS.md). The filtered one is the good photo, edited on purpose.
const EXAMPLES = [
  { src: '/examples/good.jpg', caption: 'Good: clear, calm, unedited', alt: 'Example of a good photo: a clear, calm face', good: true },
  { src: '/examples/filtered.jpg', caption: 'Not this: a filter', alt: 'Example of a bad photo: the same face with a beauty filter' },
  { src: '/examples/far.jpg', caption: 'Not this: too far away', alt: 'Example of a bad photo: the face is too far away' },
];
/** Upload progress 0 to 1 while a photo uploads; undefined once it is done, so the photo shows sharp. */
const uploading = (ph: Photo | null) => (ph?.status === 'uploading' ? (ph.pct ?? 0) / 100 : undefined);

const STEPS: ComposeStep[] = ['moment', 'you', 'check'];
const STEP_LABELS = ['Moment', 'Your photos', 'Check and start'];

type Props = {
  step: ComposeStep;
  template: Photo | null;
  users: Photo[];
  setTemplate: (p: Photo | null) => void;
  setUsers: (fn: (ps: Photo[]) => Photo[]) => void;
  /** Sees every photo update, so a refused upload can send the user to the code screen. */
  watch: (p: Photo) => void;
  go: (step: ComposeStep) => void;
  onStart: () => void;
  starting: boolean;
  startError: string | null;
  notice: string | null;
};

export function Compose(p: Props) {
  return (
    <>
      <Head steps={{ labels: STEP_LABELS, current: STEPS.indexOf(p.step), onPick: (i) => p.go(STEPS[i]) }} />
      {p.notice && (
        <p className={s.notice} role="alert">
          {p.notice}
        </p>
      )}
      {/* On a phone, steps 1 and 2 show their choices and advice before the photos. */}
      <main className={`${s.page} ${p.step === 'check' ? '' : s.textFirst}`} key={p.step}>
        {p.step === 'moment' && <Moment {...p} />}
        {p.step === 'you' && <You {...p} />}
        {p.step === 'check' && <Check {...p} />}
      </main>
    </>
  );
}

function Status({ photo }: { photo: Photo }) {
  if (photo.status === 'uploading') return <p className={s.status}>Uploading {Math.round(photo.pct ?? 0)}%</p>;
  if (photo.status === 'ready') {
    return (
      <>
        <p className={`${s.status} ${s.ok}`}>
          <Icon name="check" /> {photo.face && !photo.warn ? 'Ready · face found' : 'Ready'}
        </p>
        {photo.warn && <p className={`${s.status} ${s.bad}`}>{photo.warn}</p>}
      </>
    );
  }
  return (
    <p className={`${s.status} ${s.bad}`}>
      <Icon name="cross" /> {photo.reason}
    </p>
  );
}

function Moment({ template, setTemplate, go }: Props) {
  const tryHero = async () => {
    try {
      await addPhoto(await fileFromUrl(HERO.moment, 'moment.jpg'), setTemplate, { label: HERO.momentLabel });
    } catch (err) {
      setTemplate({ id: crypto.randomUUID(), previewUrl: '', status: 'bad', reason: (err as Error).message, label: HERO.momentLabel });
    }
  };
  const own = (files: FileList | null) => {
    if (files?.[0]) void addPhoto(files[0], setTemplate, { label: 'Your own photo' });
  };
  const heroOn = template?.label === HERO.momentLabel && template.status !== 'bad';
  return (
    <>
      <h1 className={s.title}>Choose the moment</h1>
      <section className={s.text}>
        <p className={s.lede}>A photo of one person doing something. You take their place. The pose, the light and the place stay.</p>
        <div className={s.choices}>
          <button type="button" className={s.choice} aria-pressed={heroOn} onClick={() => void tryHero()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={HERO.moment} alt="" />
            <span>
              {heroOn && (
                <strong className={s.chosen}>
                  <Icon name="check" /> Chosen
                </strong>
              )}
              <b>Try this moment</b>
              {HERO.momentLabel}
            </span>
          </button>
          <label className={s.choice}>
            <span className={s.choiceAdd} aria-hidden="true">
              <Icon name="plus" />
            </span>
            <span>
              <b>Use my own photo</b>
              One person doing something
            </span>
            <input className={s.file} type="file" accept={ACCEPT} onChange={(e) => own(e.target.files)} />
          </label>
        </div>
      </section>
      <section className={s.board}>
        {template ? (
          <>
            <Tile caption={`The moment: ${template.label}`} src={template.previewUrl} alt={`The moment: ${template.label}`} size="large" progress={uploading(template)} badge={template.status} />
            <Status photo={template} />
          </>
        ) : (
          <Hero size="compact" />
        )}
      </section>
      <div className={s.actions}>
        <button className={s.btn} type="button" disabled={template?.status !== 'ready'} onClick={() => go('you')}>
          Next: your photos <Icon name="arrow" />
        </button>
      </div>
    </>
  );
}

function You({ template, users, setUsers, go, watch }: Props) {
  // Start the face finder download as soon as this step opens, so the first photo does not wait on it.
  useEffect(() => {
    void warmFaces();
  }, []);
  const ready = users.filter((u) => u.status === 'ready');
  const busy = users.some((u) => u.status === 'uploading');
  const room = USER_PHOTOS_MAX - users.length;
  const add = (files: FileList | null) => {
    for (const f of Array.from(files ?? []).slice(0, room)) {
      void addPhoto(
        f,
        (ph) => {
          watch(ph);
          setUsers((ps) => (ps.some((x) => x.id === ph.id) ? ps.map((x) => (x.id === ph.id ? ph : x)) : [...ps, ph]));
        },
        { face: true },
      );
    }
  };
  return (
    <>
      <h1 className={s.title}>Add photos of you</h1>
      <section className={s.text}>
        <p className={s.lede}>
          We keep <span className={s.marker}>your face, age and build</span>, and take the pose, light and place from the moment you chose.
        </p>
        <ol className={s.tips}>
          <li>A clear face, no sunglasses</li>
          <li>Only you in the photo</li>
          <li>One photo that shows your whole body</li>
          <li>Unedited: no filters or beauty mode</li>
          <li>A calm face, not a big smile</li>
        </ol>
      </section>
      {/* Examples and small print: below the photos on a phone, so adding a photo comes first. */}
      <section className={s.more}>
        <ul className={s.examples} aria-label="Example photos">
          {EXAMPLES.map((ex) => (
            <li key={ex.src}>
              <figure className={s.example}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ex.src} alt={ex.alt} />
                <figcaption className={ex.good ? undefined : s.notThis}>{ex.caption}</figcaption>
              </figure>
            </li>
          ))}
        </ul>
        <p className={s.help}>Add 1 to {USER_PHOTOS_MAX} photos. More photos of you give a closer likeness.</p>
        <p className={s.help}>{PRIVACY}</p>
        {users.some((u) => u.status === 'bad') && <p className={s.help}>Photos with a cross are left out. Remove them or add better ones.</p>}
      </section>
      <PanelBoard>
        {/* The moment is a small reference row, so your photos read as their own set below it. */}
        <MomentRef template={template} onChange={() => go('moment')} />
        <p className={s.boardLabel}>
          Your photos <span>{users.length ? `· ${users.length} of ${USER_PHOTOS_MAX}` : ''}</span>
        </p>
        <div className={s.grid2}>
        {users.map((u, i) => (
          <div key={u.id} className={s.slot}>
            <Tile caption={`You, photo ${i + 1}`} src={u.previewUrl} alt={`Your photo ${i + 1}`} crop face={u.face} progress={uploading(u)} badge={u.status}>
              <button
                type="button"
                className={s.removeBtn}
                aria-label={`Remove photo ${i + 1}`}
                onClick={() => setUsers((ps) => ps.filter((x) => x.id !== u.id))}
              >
                <Icon name="trash" />
              </button>
            </Tile>
            <Status photo={u} />
          </div>
        ))}
        {room > 0 && (
          <label className={s.addTile}>
            <span className={s.addFace}>
              <Icon name="plus" />
              {users.length ? 'Add another photo' : 'Add a photo of you'}
            </span>
            <span className={s.addCaption}>{users.length ? `Photo ${users.length + 1} of ${USER_PHOTOS_MAX}, optional` : 'You'}</span>
            <input className={s.file} type="file" accept={ACCEPT} multiple onChange={(e) => add(e.target.files)} />
          </label>
        )}
        </div>
      </PanelBoard>
      <div className={s.actions}>
        <button className={s.btnLine} type="button" onClick={() => go('moment')}>
          <Icon name="back" /> Back
        </button>
        <button className={s.btn} type="button" disabled={!ready.length || busy} onClick={() => go('check')}>
          Check and start <Icon name="arrow" />
        </button>
      </div>
    </>
  );
}

function Check({ template, users, go, onStart, starting, startError }: Props) {
  const ready = users.filter((u) => u.status === 'ready');
  const left = users.map((u, i) => ({ u, n: i + 1 })).filter(({ u }) => u.status === 'bad');
  return (
    <>
      <div className={s.title}>
        <h1>Check and start</h1>
        {left.map(({ u, n }) => (
          <p key={u.id} className={s.error}>
            Photo {n} is left out. {u.reason}{' '}
            <button type="button" className={s.linkBtn} onClick={() => go('you')}>
              Change photos
            </button>
          </p>
        ))}
      </div>
      <section className={s.text}>
        <p className={s.lede}>
          We make 2 versions of you in this moment, check each one against your photos, and put the one most like you first. This
          takes a few minutes.
        </p>
        <p className={s.help}>You can leave the page while it works. The link in your address bar brings you back.</p>
        <p className={s.help}>{PRIVACY}</p>
        {startError && (
          <p className={s.error} role="alert">
            {startError}
          </p>
        )}
      </section>
      <PanelBoard>
        <MomentRef template={template} onChange={() => go('moment')} />
        <p className={s.boardLabel}>
          Your photos <span>· {ready.length} used</span>
        </p>
        <div className={s.grid2}>
          {ready.map((u, i) => (
            <Tile key={u.id} caption={`You, photo ${i + 1}`} src={u.previewUrl} alt={`Your photo ${i + 1}`} crop face={u.face} />
          ))}
        </div>
      </PanelBoard>
      <div className={s.actions}>
        <button className={s.btnLine} type="button" onClick={() => go('you')}>
          <Icon name="back" /> Back
        </button>
        <button className={s.btn} type="button" disabled={starting} onClick={onStart}>
          {starting ? 'Starting' : 'Make my photo'}{' '}
          {starting ? (
            <span className={s.chipMark}>
              <Mark size={24} mode="loading" />
            </span>
          ) : (
            <Icon name="arrow" />
          )}
        </button>
      </div>
    </>
  );
}

/** The chosen moment as one small row: thumbnail, name, and a way back to change it. */
function MomentRef({ template, onChange }: { template: Photo | null; onChange: () => void }) {
  return (
    <div className={s.momentRef}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {template?.previewUrl && <img src={template.previewUrl} alt={`The moment you chose: ${template.label ?? ''}`} />}
      <span className={s.momentText}>
        <span>Your moment</span>
        <strong>{template?.label ?? 'Not chosen'}</strong>
      </span>
      <button type="button" className={s.linkBtn} onClick={onChange}>
        Change
      </button>
    </div>
  );
}
