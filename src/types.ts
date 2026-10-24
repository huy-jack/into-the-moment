import type { ErrorCode } from './errors';

/** Box in 0..1 ratios of the image size. */
export type Box = { left: number; top: number; width: number; height: number };

export type FaceInfo = { box: Box; ageLow: number; ageHigh: number; sharpness: number };

export type PhotoRef = { path: string; width: number; height: number };

export type GateResult = { ok: true } | { ok: false; code: ErrorCode };

export type IdentityKit = {
  text: string;
  gender: string;
  ageBand: string;
  build: string;
  refPaths: string[];
  hasVisibleBody?: boolean;
  nationality?: string;
};

export type SceneCard = {
  text: string;
  expression: string;
  personGender: string;
  personAgeBand: string;
  personBuild: string;
};

export type Route = 'adult' | 'child';

// Both routes: GPT Image 2.5 on MachGen. Child route: Seedream 5.0 Lite for a refused version. FLUX.2 dev is kept
// in the list so stored jobs still parse; no route uses it.
export type ModelId = 'gpt-image-2.5-flare' | 'gpt-image-2.5-sunburst' | 'seedream-5-lite' | 'flux-2-dev';

export type Quality = 'high' | 'medium';

export type JobOptions = {
  quality: Quality;
  /** Kept so stored jobs still parse. MachGen takes no mask, so nothing reads it. */
  maskOn: boolean;
  strongBodyNote: boolean;
  sceneEmphasis: boolean;
  swapAdultOrder: boolean;
};

export type BodyCheck = {
  genderMatch: boolean;
  ageBandMatch: boolean;
  buildMatch: boolean;
  /** Face as wide and full as the real person's. Rekognition and ArcFace barely see width, so Gemini judges it. */
  faceShapeMatch: boolean;
  stillTemplatePerson: boolean;
  reasons: string;
};

export type Slot = 'a' | 'b' | 'retry' | 'repair';

export type Candidate = {
  slot: Slot;
  model: ModelId;
  attempt: number;
  path: string | null;
  refused: boolean;
  refusalText: string | null;
  failed: boolean;
  bodyCheck: BodyCheck | null;
  score: number | null;
  /** Why a failed version failed, when known (for example SPEND_CAP or TIMEOUT). */
  error?: ErrorCode;
};

export type StepCost = { jobId: string; step: string; attempt: number; provider: string; usd: number; ms: number };

// kit: set when a rerun carries the parent job's identity kit, so the same words describe the person.
export type JobInput = { jobId: string; templatePath: string; userPaths: string[]; options: JobOptions; kit?: IdentityKit };

export const DEFAULT_OPTIONS: JobOptions = {
  quality: 'high',
  maskOn: false,
  strongBodyNote: false,
  sceneEmphasis: false,
  swapAdultOrder: false,
};
