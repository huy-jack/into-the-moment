import { FatalError } from '../errors';
import type { ModelId, Quality } from '../types';

export type GenerateRequest = {
  model: ModelId;
  prompt: string;
  images: Buffer[];
  size: { width: number; height: number };
  quality: Quality;
};

/** A task the provider has accepted (and will bill). Saved so a replayed step resumes it instead of paying again. */
export type SavedRequest = { taskId: string };

export type Resume = { request?: SavedRequest; onSubmitted?: (r: SavedRequest) => Promise<void> };

export interface ImageProvider {
  supports(model: ModelId): boolean;
  generate(req: GenerateRequest, resume?: Resume): Promise<{ image: Buffer; usd: number }>;
}

/**
 * One provider per model. A model with no provider reports unsupported, and a child job that
 * needs it stops with CHILD_UNSUPPORTED.
 */
export function routeImages(byModel: Partial<Record<ModelId, ImageProvider>>): ImageProvider {
  return {
    supports: (model) => !!byModel[model],
    generate: (req, resume) => {
      const p = byModel[req.model];
      if (!p) return Promise.reject(new FatalError('CHILD_UNSUPPORTED', `no image provider for ${req.model}`));
      return p.generate(req, resume);
    },
  };
}
