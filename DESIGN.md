---
name: Into the Moment
description: Put yourself into any photo moment. One real result breaks out of a violet panel on the first screen; photos sit on white sheets and prints over painted violet.
colors:
  ground: "#f1edf8"
  aurora-1: "#e0d5fd"
  aurora-2: "#f9d3ee"
  aurora-3: "#ffd8bd"
  tile: "#ffffff"
  ink: "#16131c"
  ink-2: "#3a3446"
  soft: "#5f586b"
  line: "#e4dcf3"
  well: "#ece6fb"
  dash: "#cfc2ea"
  violet: "#7c5cd6"
  violet-deep: "#5b3fb8"
  violet-50: "#ece6fb"
  violet-200: "#b9a6ee"
  on-violet: "#ffffff"
  panel-1: "#a68ef0"
  panel-2: "#8366df"
  panel-3: "#6646cc"
  panel-4: "#5638bd"
  word-end: "#a77cf0"
  paint-ink-1: "#c9b8f6"
  paint-ink-2: "#e9e1fb"
  focus-lock: "#c6a8ff"
  ok: "#1a6e3f"
  bad: "#b42318"
  viewer-ground: "#1e1a1c"
gradients:
  panel: "linear-gradient(205deg, #a68ef0 0%, #8366df 38%, #6646cc 72%, #5638bd 100%)"
  word: "linear-gradient(100deg, #5b3fb8 0%, #7c5cd6 45%, #a77cf0 100%)"
  aurora: "three radial clouds, radial-gradient(closest-side, <aurora-n> 20-30%, transparent), drifting over #f1edf8"
typography:
  display-word:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "clamp(72px, 9.2vw, 132px)"
    fontWeight: 900
    lineHeight: 0.9
    letterSpacing: "-0.05em"
  display-lead:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "clamp(32px, 3.9vw, 56px)"
    fontWeight: 900
    fontStyle: "italic"
    letterSpacing: "-0.035em"
  display:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "clamp(32px, 3.4vw, 44px)"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.025em"
  hero-heading:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "44px"
    fontWeight: 800
    lineHeight: 1.04
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 800
    lineHeight: 1.2
  title:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 800
    fontFeature: "tnum"
  brand:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.6
  body-small:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  status:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "tnum"
  label:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  sticker-key:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 800
    letterSpacing: "0.1em"
    textTransform: "uppercase"
  button:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
  hand:
    fontFamily: "Caveat, cursive"
    fontSize: "26px to 30px"
    fontWeight: 700
    lineHeight: 1
rounded:
  big: "36px"
  panel: "28px"
  card: "24px"
  sticker: "22px"
  tile: "20px"
  sheet: "20px"
  photo: "14px"
  crop: "12px"
  print: "8px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "10px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  section: "48px"
  gutter: "clamp(16px, 5vw, 96px)"
  measure: "58ch"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "#ffffff"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "0 6px 0 24px"
    height: "52px"
  button-primary-hover:
    backgroundColor: "#2b2533"
  button-primary-chip:
    border: "1.5px rgb(255 255 255 / 0.6) ring"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    size: "40px"
  button-line:
    backgroundColor: "{colors.tile}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "52px"
  hero:
    backgroundColor: "{colors.tile}"
    rounded: "{rounded.big}"
    padding: "24px"
    stageHeight: "720px"
    panelHeight: "470px"
    personHeight: "clamp(480px, 43vw, 620px)"
  violet-panel:
    background: "{gradients.panel}"
    rounded: "{rounded.panel}"
  panel-board:
    background: "{gradients.panel}"
    rounded: "{rounded.panel}"
    padding: "48px 22px 22px"
  sheet:
    backgroundColor: "{colors.tile}"
    rounded: "{rounded.sheet}"
    padding: "clamp(12px, 1.6vw, 20px)"
  sticker:
    backgroundColor: "{colors.tile}"
    rounded: "{rounded.sticker}"
    padding: "10px"
    tilt: "-5deg to 4deg"
  print:
    backgroundColor: "{colors.tile}"
    rounded: "{rounded.print}"
    padding: "12px 12px 44px"
    tilt: "-2deg (0 on a phone)"
  choice-card:
    backgroundColor: "{colors.tile}"
    rounded: "{rounded.tile}"
    padding: "10px 10px 14px"
  fix-chip:
    backgroundColor: "{colors.tile}"
    border: "1.5px solid {colors.violet-200}"
    rounded: "16px"
    padding: "12px 12px 12px 16px"
  input-code:
    backgroundColor: "{colors.tile}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    height: "52px"
  code-error:
    backgroundColor: "{colors.tile}"
    textColor: "{colors.bad}"
    rounded: "12px"
    padding: "8px 12px"
  viewer:
    backgroundColor: "{colors.viewer-ground}"
    textColor: "{colors.tile}"
    rounded: "{rounded.card}"
    padding: "14px"
---

# Design System: Into the Moment

## Overview

**Creative North Star: "Cut-out, Violet"**

The first screen proves the app works. One result person is cut out of their photo and breaks out of the top of a violet panel. Two small stickers show the photos the result came from: the moment and the selfie. Very big display words sit behind the person. A visitor sees "these two in, this one out" before they upload anything.

The rest of the app keeps that look. Photo boards are white sheets on a painted violet panel. The result is a white print, tilted a little, on the panel. Soft white brush strokes, one orbit line, a few sparkles and a light film grain make the page feel made by hand.

Photos stay honest. Every photo the user judges sits on white, keeps its own shape, and is never covered by grain, strokes or stickers.

**Key Characteristics:**
- Pale lavender ground under a slow aurora: violet, pink and peach clouds. White cards with 36 px corners.
- Violet gradient panels, lit from the top right and darkest at the bottom left.
- Huge Figtree 900 words in a violet sweep, with a black italic lead-in.
- Hand-painted brush strokes behind people and photos, never over them.
- Stickers: small tilted white cards that hold input photos.
- Ink pill for the one forward action. Violet is the one accent.
- The camera-focus motion from before stays: hunt, lock, sharpen, pull.

## Colors

A cool lavender palette with one violet accent and violet gradient panels. Photos still carry the strongest colour on screen.

### Primary
- **Violet** (`violet`): sparkles, the selected choice ring, step check marks, the upload ring, the current stage bar, the best-version dot and pill, text selection and the caret.
- **Deep Violet** (`violet-deep`): small accent text on white: sticker keys, the hero tag on a phone, the add icon.
- **Violet Mist** (`violet-50`): the current stage card, wells, the phone input cards.
- **Violet Line** (`violet-200`): ghost pill borders, fix chip borders, the light sparkle.
- **Focus-Lock Lilac** (`focus-lock`): the one-frame blink when the face box locks. Nothing else.

### Gradients
- **Panel** (`gradients.panel`): every violet panel. 205°, from `#a68ef0` at the top right to `#5638bd` at the bottom left.
- **Word** (`gradients.word`): the display words only. 100°, `#5b3fb8` to `#a77cf0`.
- **Aurora** (`gradients.aurora`): three soft clouds behind every screen, fixed to the window. Violet top left, pink top right, peach in the middle at 60% opacity. They drift for 18, 22 and 26 s, there and back. Each cloud stays light enough that Help Grey text keeps 4.5:1 or more on its darkest point (measured 4.64:1).

### Neutral
- **Ground** (`ground`): the page and the browser theme colour.
- **Tile** (`tile`): cards, sheets, prints, stickers, chips, the code field, the error box.
- **Ink** (`ink`): text, the primary pill, the logo corners, the focus outline.
- **Secondary Ink** (`ink-2`), **Help Grey** (`soft`), **Line** (`line`), **Well** (`well`), **Dash** (`dash`): as before, in cool tones.
- **Viewer Ground** (`viewer-ground`): the full-size viewer only.

### Status
- **Ready Green** (`ok`) and **Error Red** (`bad`): on white only. On violet, an error sits in a white box.

### Named Rules
**The Dark Corner Rule.** White text goes only on the lower-left half of a panel, `#6646cc` or darker (6.3:1 and up). Never on the `#a68ef0` corner (2.7:1).

**The One Accent Rule.** Violet is the only accent hue. The gradients are violet too. No second hue.

**The Blink Rule.** Focus-lock lilac exists only as the short blink when the face box locks.

## Typography

**Display and body font:** Figtree (400, 600, 800, 900; 900 also italic).
**Handwriting font:** Caveat 700.

### Hierarchy
- **Display word** (900, clamp(72px, 9.2vw, 132px), 0.9, −0.05em, word gradient): "ANY", "FACE". 66 px on a phone.
- **Display lead** (900 italic, clamp(32px, 3.9vw, 56px)): "Step into", "Keep your".
- **Display** (800, clamp(32px, 3.4vw, 44px)): the page heading on step screens.
- **Hero heading** (800, 44 px; 36 px at 821 px to 1199 px; 28 px on a phone): "Your face. Their moment."
- **Headline**, **Title**, **Brand**, **Body**, **Body small**, **Status**, **Label**, **Button**: as before.
- **Sticker key** (800, 11 px, 0.1em, uppercase): "THE MOMENT", "YOU" on stickers.
- **Hand** (Caveat 700, 26 px to 30 px): "made from these two", "you, in the moment".

### Named Rules
**The Handwriting Rule.** Caveat is for one short note per screen. It never labels a control and never carries an instruction.

**The 11 px Floor.** No functional text below 11 px.

## Layout

The page is a centred shell, 1360 px wide at most, with a fluid gutter (clamp(16px, 5vw, 96px)).

**Code screen.** One white hero card (36 px corners, 24 px padding). Its stage is 720 px tall. The violet panel fills the bottom 470 px. The person stands on the panel's bottom edge, shifted 40% left of centre, so arms and held objects break out above the panel's top. The words sit at the top corners, behind the person. The copy column (340 px) sits 44 px from the panel's left and bottom edges and holds the access code form. The stickers sit at the right.

**Step screens.** The two-column grid stays: a text column up to 600 px, and the photo board. Step 1 shows two choice cards in the text column. Its board shows the small hero until a moment is chosen, then the chosen photo. Steps 2 and 3, the wait screen and the failed screen put the board on a violet panel.

**Result.** The violet stage panel holds the switch, the print and a foot row: the moment sticker, the filmstrip, and the "You" sticker. The white side panel sits on the right, sticky.

**821 px to 1199 px.** The two step columns are equal. The hero person shifts 26%, the stickers shrink, and the handwriting note hides.

**820 px and below.** One column. The hero becomes a grid: words, then the person and panel in one cell, then the copy and code form, then the two input cards. The code field starts above 844 px. The result stickers turn into an untilted row with the moment and every selfie. The actions become a sticky bar.

### Named Rules
**The Mat Rule.** A photo edge touches only white. Photos sit on white sheets, in white prints and in white stickers, never on bare violet.

**The Uncut Rule.** A result photo keeps its own aspect ratio, up to 68dvh tall, in its print. It is never cropped.

## Elevation & Depth

Depth is soft and neutral. Cards float a little on wide ink shadows. Stickers and prints sit higher.

### Shadow Vocabulary
- **Card** (`0 1px 0 rgb(22 19 28 / 0.04), 0 30px 60px -36px rgb(22 19 28 / 0.28)`): cards, boards, choice cards.
- **Lift** (`0 1px 0 rgb(22 19 28 / 0.05), 0 34px 60px -32px rgb(22 19 28 / 0.32)`): a hovered choice card.
- **Sticker** (`0 20px 40px -20px rgb(22 19 28 / 0.45)`): stickers and the print.
- **Person** (`drop-shadow(0 24px 24px rgb(22 19 28 / 0.22))`): the hero cut-out.
- **Focus outline** (`outline: 2px solid` ink, 3px offset): every focusable control.

### Named Rules
**The Neutral Shadow Rule.** Shadows are ink-tinted (rgb 22 19 28), never violet, never a glow.

**The Grain Rule.** Film grain (an SVG noise texture at 9%) covers big cards and panels. Photos the user judges sit above it.

## Shapes

- **Big** (36 px): the hero card.
- **Panel** (28 px; 24 px on a phone): violet panels and panel boards.
- **Card** (24 px): the result side panel, the viewer.
- **Sticker** (22 px), **Tile** (20 px), **Sheet** (20 px): stickers, choice cards, sheets.
- **Photo** (14 px), **Crop** (12 px), **Print** (8 px outer, 3 px on the photo).
- **Pill** (999 px): buttons, the segment switch, the code field.

The **Focus Lock** mark keeps its four open corners. Its dot now takes the panel gradient.

## Components

### Hero (signature)
`full` on the code screen, `compact` on step 1 while nothing is chosen. The person image is a transparent PNG from `public/hero/`, made as a die-cut sticker: a 14 px white outline (about 9 px on screen) round the figure and along the photo's cropped edges, with a flat bottom that sits on the panel edge. The tag reads "Example" while `HERO.real` is false, and "A real result" when it is true. Only a real hero shows the note "made from these two" and the pill "Real output. Only the background is removed."

### Brush strokes
One tapered SVG stroke with a dry-brush filter, reused through `<use>`. White paint (42% to 6% opacity) on violet, lavender paint on white. They sit behind people and photos.

### Panel board
A violet panel with a 48 px top band where two strokes cross, and a white sheet that holds the photos and status lines.

### Stickers
Tilted white cards with a photo and a sticker key. On the result, the "You" sticker carries an ink "+N" badge when there are 2 to 4 selfies.

### Print
The result photo in a white frame with a Caveat caption, tilted −2° (0° on a phone). Press and hold, tap to open, and the moment switch work as before.

### Buttons
- **Primary:** ink pill, white text, the arrow in a 40 px chip with a white 60% ring. Hover `#2b2533`. One per screen.
- **Secondary:** white pill, ink text, back arrow in a well chip.
- **Link button:** underlined text.

### Choice cards (step 1)
Two white cards: "Try this moment" with the hero moment, and "Use my own photo" with a plus in a well. The chosen card gets a 2 px violet ring and a "Chosen" line.

### Code field and error
A white pill field with ink text. A wrong code shows red text in a white box with 12 px corners, so it reads on violet.

### Fix chips
White, 1.5 px violet-200 border, 16 px corners, title 15 px 600, help line 13 px.

### Unchanged
Step control, photo tiles and uploads, the face box, the Focus Lock loaders, stage cards, the filmstrip (captions turn white on violet, the selected ring turns white) and the full-size viewer keep their behaviour and motion.

### Motion and reduced motion
The first screen (the code screen) is the only screen with hero motion. It has four layers:

1. **Build-in, once per load, about 2.6 s.** The words go from blurred to sharp in four groups (0.1 to 0.75 s). The panel rises at 0.2 s. The code copy fades up from 0.3 to 0.54 s, so the form is usable from the start. The strokes paint in from left to right (0.45 to 1.07 s). The person rises out of the panel at 0.75 s with a small overshoot. The orbit draws at 1.25 s, the stickers drop at 1.35 and 1.5 s, the note writes itself at 1.95 s, and the proof pill comes last at 2.1 s.
2. **Floating sparks.** 14 sparks on desktop, 6 on a phone, 8 to 26 px. Each drifts up and sideways for 7 to 12 s and twinkles. A spark is white only on the violet panel; on the light ground it is violet or Violet Line. On a phone they stay above the panel's bottom edge, clear of the code form. Every 6.5 s one large spark (130 px, blurred 5 px, 60% opacity) passes across the stage close to the camera.
3. **Depth shift, only with a real mouse.** Each layer moves with the pointer by its depth: words 10 px, panel 6 px, orbit 12 px, person 16 px, stickers 26 px, sparks 34 px. A sticker under the pointer lifts 12 px, turns straight and grows 6%. Touch screens get none of this.
4. **Idle loops, after the build-in.** The person floats 10 px over 6 s. The stickers sway 1.2° (wider than a phone only). The two violet sparks twinkle, the panel strokes breathe, the panel light drifts over 14 s, and the orbit dot circles the head every 7 s.

The aurora drifts on every screen. With reduced motion, the hero shows its final state at once, the sparks are not drawn, and the aurora stands still. Every older animation keeps its reduced-motion fallback.

## Do's and Don'ts

### Do:
- **Do** keep the one hero result on the first screen, and keep it honest: placeholder copy until the real set is in.
- **Do** put white text only in the dark lower-left half of a panel.
- **Do** keep every photo on white, uncut, and above the grain.
- **Do** use one ink pill per screen for the forward action.
- **Do** keep brush strokes to 6 or fewer per screen.

### Don't:
- **Don't** put a brush stroke, a sticker or the grain over a face or a photo the user judges.
- **Don't** use Caveat for a button, a label or an instruction.
- **Don't** add a second accent hue, a violet glow shadow, or a gradient outside the panel, the display words and the aurora. The aurora's pink and peach are ground colours, never accents.
- **Don't** crop the result photo to fit a frame.
- **Don't** let the stock placeholder claim "A real result".
