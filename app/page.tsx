import { Suspense } from 'react';
import { ArtDefs } from './_flow/art';
import { Flow } from './_flow/Flow';

// The whole flow is one client screen; the job id rides in ?job=, which needs a Suspense boundary.
export default function Home() {
  return (
    <>
      <ArtDefs />
      <Suspense fallback={null}>
        <Flow />
      </Suspense>
    </>
  );
}
