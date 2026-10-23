import {
  CompareFacesCommand,
  DetectFacesCommand,
  DetectLabelsCommand,
  RekognitionClient,
  type BoundingBox,
} from '@aws-sdk/client-rekognition';
import type { Box, FaceInfo } from '../types';
import { cached, type CacheMode } from './cache';

export interface FaceProvider {
  detectFaces(img: Buffer): Promise<FaceInfo[]>;
  detectPersons(img: Buffer): Promise<Box[]>;
  /** Highest similarity (0-100) of a face in `target` to the face in `ref`; null if no face. */
  compare(ref: Buffer, target: Buffer): Promise<number | null>;
}

type Client = Pick<RekognitionClient, 'send'>;

const toBox = (b: BoundingBox | undefined): Box => ({
  left: b?.Left ?? 0,
  top: b?.Top ?? 0,
  width: b?.Width ?? 0,
  height: b?.Height ?? 0,
});

export function createRekognitionClient(region: string): RekognitionClient {
  return new RekognitionClient({ region, maxAttempts: 1 });
}

export function createRekognition(opts: { client: Client; mode: CacheMode; cacheDir: string }): FaceProvider {
  const run = <T>(op: string, payload: unknown, images: Buffer[], call: () => Promise<T>) =>
    cached({ mode: opts.mode, dir: opts.cacheDir, provider: `rekognition-${op}`, payload, images }, call);

  return {
    detectFaces: (img) =>
      run('faces', {}, [img], async () => {
        const res = await opts.client.send(new DetectFacesCommand({ Image: { Bytes: img }, Attributes: ['ALL'] }));
        return (res.FaceDetails ?? []).map((f) => ({
          box: toBox(f.BoundingBox),
          ageLow: f.AgeRange?.Low ?? 0,
          ageHigh: f.AgeRange?.High ?? 0,
          sharpness: f.Quality?.Sharpness ?? 0,
        }));
      }),

    detectPersons: (img) =>
      run('persons', {}, [img], async () => {
        const res = await opts.client.send(new DetectLabelsCommand({ Image: { Bytes: img } }));
        const person = (res.Labels ?? []).find((l) => l.Name === 'Person');
        return (person?.Instances ?? [])
          .map((i) => toBox(i.BoundingBox))
          .sort((a, b) => b.width * b.height - a.width * a.height);
      }),

    compare: (ref, target) =>
      run('compare', {}, [ref, target], async () => {
        try {
          const res = await opts.client.send(
            // Threshold 0 so every score comes back; the default of 80 hides lower matches.
            new CompareFacesCommand({ SourceImage: { Bytes: ref }, TargetImage: { Bytes: target }, SimilarityThreshold: 0 }),
          );
          const scores = (res.FaceMatches ?? []).map((m) => m.Similarity ?? 0);
          return scores.length ? Math.max(...scores) : null;
        } catch (err) {
          // Rekognition throws InvalidParameterException when either image has no face.
          if ((err as { name?: string }).name === 'InvalidParameterException') return null;
          throw err;
        }
      }),
  };
}
