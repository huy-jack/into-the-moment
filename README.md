# Character Swap

Put a person from your own photos into a template photo, keeping the template's action, pose and scene.
Aurify take-home, photo track.

> **Status (2026-10-21):** the backend and the web app ("Into the Moment") are built and tested (220 tests), but
> they have not run live end to end yet: the AWS key is missing. Image models run on MachGen (fal.ai is out). Child
> photos go to Seedream 5.0 Lite and FLUX.2 dev on MachGen; neither has run live yet. There is no live URL yet. The
> measured numbers below come from the likeness spike, not from the app.

> **Prompts in this repository.** The prompt text here is a short generic version. The app's structure, the
> routing, the checks and the ranking are the real ones. The tuned prompt wording runs on the live app only. I can
> walk through it, and the tests behind each line, in the interview.

## Run locally

Needs Node 20.9+ (the floor of Next 16) and pnpm.

```sh
pnpm install
cp .env.example .env.local     # fill in the keys (names and uses are listed in the file)
pnpm photos                    # download the stock test photos listed in fixtures/photos/CREDITS.md
pnpm test                      # 220 tests, no network, no keys
pnpm dev                       # web app and API on http://localhost:3000
```

Test the pipeline without the web app:

```sh
pnpm calibrate                                    # Rekognition scores on known pairs → FACE_T
pnpm harness --mode record --max-spend 6          # all 6 cases, live calls, stops at $6
pnpm harness --mode replay                        # same run from the saved cache, $0
```

## Deploy

Vercel Hobby, Neon Postgres (compute capped at 0.25), private Vercel Blob, Vercel Workflow.
Step by step, with the checks to run after: `docs/deploy.md`.

## Architecture

```
 Browser / test script ──► Next.js API on Vercel
   1 POST /api/access        access code → signed cookie
   2 POST /api/upload        cookie → private Blob upload
   3 POST /api/jobs          job cap + spend cap → job row in Neon → start workflow
   4 GET  /api/jobs/:id      stage, ranked versions, scores, signed links (polled)
   5 POST /api/jobs/:id/rerun {problem: face|body|scene}  new job from the same photos

 Workflow (one step per function call, each under 300 s):
   prepare   Rekognition: faces, age, person box → reject bad photos, pick the route
   analyze   Qwen3 VL Plus (xKiro): identity kit (person) + scene card (template)
   generate  2 versions in parallel through MachGen (child route: Seedream 5.0 Lite + FLUX.2 dev)
   evaluate  Rekognition CompareFaces score + Qwen body and face-shape check per version
   retry     adult route only: 1 more version if the best score is under FACE_T
   repair    template face under 15% of image height → redraw the face crop, paste back
   finalize  rank every version (none hidden), save to Neon
```

Rejected designs are under **Tried or dropped** below.

**Web app.** One client screen (`app/_flow/`): access code, choose the moment (5 Pexels samples or your own
photo), add 1 to 4 photos of you, check and start, waiting, result. Photos upload straight from the browser to
private Blob. The job id sits in the URL (`?job=`), so the link brings the user back on any device. The result
shows every version at the same size, best first, with plain notes on what failed; scores and model names stay
hidden. Under each version, your face and the result's face sit side by side at the same size; press and hold a
version to see the moment it came from. A face finder runs in the browser (MediaPipe, on the device) to check each
photo as it uploads and to cut those close-ups. The rules behind the screens are in `src/ui/flow.ts` and
`src/ui/face.ts` and are unit tested. Design system: `DESIGN.md`.

## Models

| Role | Model | Why |
|---|---|---|
| Adult, version A | GPT Image 2.5 Flare (MachGen) | best ArcFace score in 6 of 6 paired spike runs vs Sunburst; 2× faster (44 to 48 s) |
| Adult, version B (a face rerun swaps A and B) | GPT Image 2.5 Sunburst (MachGen) | the owner's favourite face shape once (run #8); very stable with fixed text |
| Child route, version A | Seedream 5.0 Lite (ByteDance, partner-hosted on MachGen) | $0.038 per image flat. Up to 14 inputs. **Not run live yet** |
| Child route, version B | FLUX.2 dev (open model, on MachGen's own GPUs) | $0.004 per output MP: $0.003 to $0.007 at the sizes used (1024x768, 1024x1024, 1024x1808). Up to 3 inputs (template + 2 photos). **Not run live yet** |
| Photo gate, age, likeness score | AWS Rekognition | $0.001 per image, 0–100 face score |
| Identity kit, scene mood, body and face-shape check | Qwen3 VL Plus on xKiro (`qwen/qwen3-vl-plus:free`; backups qwen3.7-flash, qwen3.5-omni-flash on 429/503) | free tier, 6 to 8 s per call. Gemini dropped: its key hit quota (429) |

**Child photos never go to OpenAI or Google.** Both block edits of realistic child photos by written policy, so the
route is chosen from the youngest face Rekognition finds in any photo. No fallbacks: a refused child version stays
refused.

**Where child photos go.** Seedream 5.0 Lite is partner-hosted: MachGen passes the photos through to ByteDance.
Only FLUX.2 dev keeps the photos on MachGen's own GPUs. The FLUX.2 dev weights carry a non-commercial license;
check MachGen's terms before commercial use.

**Tried or dropped**

- **fal.ai:** dropped by the owner on 2026-10-21. MachGen sells the adult models and was already paid for.
- **GPT Image 2:** dropped. ArcFace scored it well, but the owner rejected its faces by eye.
- **Nano Banana Pro / 2:** weakest published face scores, and it blocks children.
- **Generated angle views as extra references:** dropped. The model would not turn the head, and the face drifted.
- **Face lock** (a face-swap model after generation): dropped in design v2. It replaces only the inner face, so
  the template person's head and hair stay; the common model works at 128 px and has a non-commercial license.
- **Covering the template face:** dropped in design v2. It removes the light, head-angle and expression cues.
- **Free-text identity kit:** replaced by fixed face-shape choices. The free text changed between calls, and the
  face shape followed it.

## Measured cost and time

**Likeness spike (MachGen, 1280×848, 17 runs (18 paid image calls), 2026-10-20).** The spike is a small local tool that ran
one swap per call and scored it. It is not part of this repository.

| Call | Time | Cost per image (net / gross) |
|---|---|---|
| GPT Image 2 swap | 82–119 s | $0.071 / $0.084 |
| GPT Image 2.5 Sunburst swap | 94–123 s | $0.100 / $0.118 |
| GPT Image 2.5 Flare swap | 49–66 s | $0.100 / $0.118 |
| Face repair, 1280×1280 | 124 s | $0.126 / $0.148 |
| Vision kit, Qwen on xKiro (2 photos) | 7–8 s | free tier |

**App pipeline (MachGen):** not measured yet. Fill in from `pnpm harness` (cost per case, time per case, CompareFaces
score per version).

## Honesty notes

- The likeness verdicts so far are the photo owner's own judgment on 1 person, plus a local ArcFace rescore of the
  same results. No Rekognition scores yet. ArcFace and the owner disagree on the middle of the ranking: ArcFace
  measures the inner face, the owner judged face shape.
- Most spike cells have 1 run. Image models give a different result each run.
- The body shape of the template stayed in every run, even when the text asked for a broader build.

## Repository

| Path | What |
|---|---|
| `src/` | pipeline, providers, database, server helpers, workflow |
| `app/api/` | API routes |
| `scripts/` | harness, calibration, smoke test, photo fetch |
| `fixtures/` | test cases and photo credits (photos are fetched, not committed) |
| `docs/` | deploy notes |

## How I use AI

I built this with an AI coding agent (Claude Code). The agent writes most of the code. I set the direction, check
the work and make every product and model decision.

1. **Design first.** For each feature I describe the goal. The agent asks questions, then writes a short design
   document. I approve it before any code is written.
2. **Plan.** The agent turns the design into small steps, each with its own tests.
3. **Tests first.** For each step the agent writes a failing test, then the code that makes it pass.
4. **Review.** A second agent reviews the change for bugs. A third reviews the screens from screenshots at 1440,
   1024 and 390 px wide. I read their findings and choose what to fix.
5. **Design system.** An AI design tool helped me write `DESIGN.md` and `PRODUCT.md`. I picked the direction from
   mockups it built.
6. **Likeness tuning.** The agent ran the spike tool for me: one swap per prompt or model change, scored with ArcFace.
   I judged every face by eye. Where my eye and the score disagreed, my eye won (see **Honesty notes**).

The agent's working files (design documents, plans, review reports, its tool settings) are not in this repository.

