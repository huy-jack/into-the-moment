import type { ReactNode } from 'react';
import { HERO, heroCopy } from '@/src/ui/hero';
import { Brush, Orbit, Spark } from './art';
import { HeroMotion } from './HeroMotion';
import s from './flow.module.css';

const copy = heroCopy(HERO.real);

/**
 * One result, shown before anything is uploaded: the person cut out of the photo and breaking out of
 * a violet panel, and the two photos it came from. `full` is the first screen; `children` sit in the
 * panel's dark lower-left corner. `compact` keeps the proof small above the step 1 choices.
 */
export function Hero({ size, children }: { size: 'full' | 'compact'; children?: ReactNode }) {
  if (size === 'compact') {
    // Step 1 shows the result as it came out of the app, background and all: the proof, not the poster.
    return (
      <figure className={s.heroCompact}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={s.heroResult} src={HERO.result} alt={`${copy.tag}: one selfie put into the moment "${HERO.momentLabel}"`} />
        <figcaption className={s.heroTag}>
          <Spark size={12} tone="white" style={{ position: 'static' }} /> {copy.tag}
        </figcaption>
      </figure>
    );
  }

  return (
    <section className={s.hero}>
      <div className={s.heroStage}>
        <HeroMotion />
        <p className={`${s.heroWords} ${s.heroWordsL}`} aria-hidden="true">
          <span>Step into</span>
          <b>ANY</b>
          <b className={s.phoneOnly}>MOMENT</b>
        </p>
        <p className={`${s.heroWords} ${s.heroWordsR}`} aria-hidden="true">
          <span>Keep your</span>
          <b>FACE</b>
        </p>
        <Spark size={44} style={{ right: 40, top: 8 }} />
        <Spark size={20} tone="light" style={{ left: '34%', top: 150 }} />
        <Brush x="24%" y="122px" w={300} tone="ink" />

        <div className={`${s.vpanel} ${s.heroPanel} ${s.grain}`}>
          <Brush x="27.7%" y="6%" w={420} angle={-4} />
          <Brush x="43.6%" y="26%" w={380} angle={3} flip />
          <Brush x="24.3%" y="45%" w={360} angle={-2} />
          <Brush x="47%" y="64%" w={330} angle={5} flip />
          <Brush x="35.2%" y="79%" w={300} angle={-3} />
        </div>
        <Orbit width={400} style={{ left: 'calc(50% + 63px)', top: 146, transform: 'translateX(-50%) rotate(-8deg)' }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={s.heroPerson} src={HERO.person} alt="" />

        <div className={s.heroCopy}>
          <p className={s.heroTag}>
            <Spark size={14} tone="white" style={{ position: 'static' }} /> {copy.tag}
          </p>
          <h2>Your face. Their moment.</h2>
          <p className={s.heroLine}>Upload a photo of a moment and a few of yourself. You get the same moment back, with you in it.</p>
          {children}
        </div>

        <div className={s.heroInputs}>
          <figure className={`${s.sticker} ${s.heroMoment}`} style={{ '--tilt': '3deg' } as React.CSSProperties}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={HERO.moment} alt={`The moment: ${HERO.momentLabel}`} />
            <figcaption>
              <span className={s.stickerKey}>The moment</span>
              <span>{HERO.momentLabel}</span>
            </figcaption>
          </figure>
          <figure className={`${s.sticker} ${s.heroYou}`} style={{ '--tilt': '-2deg' } as React.CSSProperties}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={HERO.you} alt="The selfie" />
            <figcaption>
              <span className={s.stickerKey}>You</span>
              <span>1 selfie</span>
            </figcaption>
          </figure>
        </div>

        {copy.showNote && (
          <p className={`${s.hand} ${s.heroNote}`} aria-hidden="true">
            made from these two
            <svg width="60" height="70" viewBox="0 0 80 70" fill="none">
              <path d="M6 6 C30 10 52 26 64 56" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              <path d="M54 50 L65 60 L70 46" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </p>
        )}
        {copy.proof && <p className={s.heroProof}>{copy.proof}</p>}
      </div>
    </section>
  );
}
