import type { IdentityKit, JobOptions, SceneCard } from '../types';

// Generic prompt text. The tuned wording is not part of this copy.

function refsLabel(refCount: number): string {
  return refCount === 1 ? 'Image 2 is the person' : `Images 2 to ${refCount + 1} are the person`;
}

/** True when the reference photos show the person's body, not only a face. */
export function isVisibleBody(kit: IdentityKit): boolean {
  return kit.hasVisibleBody === true;
}

/** The swap prompt: numbered image roles, what changes, what stays. */
export function buildPrompt(kit: IdentityKit, scene: SceneCard, refCount: number, opts: JobOptions): string {
  const refs = refCount === 1 ? 'Image 2' : `Images 2 to ${refCount + 1}`;
  const differs = kit.gender !== scene.personGender || kit.ageBand !== scene.personAgeBand;

  const lines = [
    `Image 1 is the scene. ${refsLabel(refCount)}.`,
    `Replace the person in Image 1 with the person in ${refs}.`,
    `The person in ${refs}: ${kit.text}`,
    'Keep the pose, the objects, the camera and the light from Image 1.',
    `Scene: ${scene.text}`,
  ];
  if (differs || opts.strongBodyNote) lines.push(`Use the body of the person in ${refs}, in the same pose.`);
  if (opts.sceneEmphasis) lines.push('Change nothing outside the person.');
  lines.push(`The face must look like the person in ${refs}.`);
  return lines.join('\n');
}

/** Face repair: Image 1 is a close crop of the result's face. */
export function buildRepairPrompt(kit: IdentityKit, _scene: SceneCard, refCount: number): string {
  const refs = refCount === 1 ? 'Image 2' : `Images 2 to ${refCount + 1}`;
  return [
    `Image 1 is a close crop around a face. ${refsLabel(refCount)}.`,
    `Redraw the face in Image 1 as the person in ${refs}: ${kit.text}`,
    'Keep everything around the face as in Image 1.',
  ].join('\n');
}
