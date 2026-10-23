import { describe, expect, it } from 'vitest';
import { createRekognition } from '@/src/providers/rekognition';

function fakeClient(responses: Record<string, unknown>) {
  const sent: { name: string; input: Record<string, unknown> }[] = [];
  return {
    sent,
    client: {
      send: async (cmd: { constructor: { name: string }; input: Record<string, unknown> }) => {
        const name = cmd.constructor.name;
        sent.push({ name, input: cmd.input });
        return responses[name];
      },
    },
  };
}

const img = Buffer.from('x');

describe('rekognition provider', () => {
  it('maps age range and sharpness', async () => {
    const { client } = fakeClient({
      DetectFacesCommand: {
        FaceDetails: [
          {
            BoundingBox: { Left: 0.1, Top: 0.2, Width: 0.3, Height: 0.4 },
            AgeRange: { Low: 16, High: 24 },
            Quality: { Sharpness: 78 },
          },
        ],
      },
    });
    const faces = await createRekognition({ client: client as never, mode: 'live', cacheDir: '' }).detectFaces(img);
    expect(faces).toEqual([
      { box: { left: 0.1, top: 0.2, width: 0.3, height: 0.4 }, ageLow: 16, ageHigh: 24, sharpness: 78 },
    ]);
  });

  it('returns person boxes sorted by area, largest first', async () => {
    const { client } = fakeClient({
      DetectLabelsCommand: {
        Labels: [
          { Name: 'Tree', Instances: [{ BoundingBox: { Left: 0, Top: 0, Width: 1, Height: 1 } }] },
          {
            Name: 'Person',
            Instances: [
              { BoundingBox: { Left: 0, Top: 0, Width: 0.1, Height: 0.1 } },
              { BoundingBox: { Left: 0.5, Top: 0.1, Width: 0.4, Height: 0.8 } },
            ],
          },
        ],
      },
    });
    const boxes = await createRekognition({ client: client as never, mode: 'live', cacheDir: '' }).detectPersons(img);
    expect(boxes.map((b) => b.width)).toEqual([0.4, 0.1]);
  });

  it('compare sends SimilarityThreshold 0', async () => {
    const { client, sent } = fakeClient({ CompareFacesCommand: { FaceMatches: [{ Similarity: 62.5 }, { Similarity: 40 }] } });
    const score = await createRekognition({ client: client as never, mode: 'live', cacheDir: '' }).compare(img, img);
    expect(sent[0].input.SimilarityThreshold).toBe(0);
    expect(score).toBe(62.5);
  });

  it('compare returns null when the target has no face', async () => {
    const { client } = fakeClient({ CompareFacesCommand: { FaceMatches: [], UnmatchedFaces: [] } });
    const score = await createRekognition({ client: client as never, mode: 'live', cacheDir: '' }).compare(img, img);
    expect(score).toBeNull();
  });
});
