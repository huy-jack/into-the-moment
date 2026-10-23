import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // sharp ships native binaries; keep it out of the server bundle.
  serverExternalPackages: ["sharp"],
};

// Enables the "use workflow" and "use step" directives.
export default withWorkflow(nextConfig);
