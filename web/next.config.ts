import type { NextConfig } from "next";
import path from "node:path";

// Every signed-in page reads the session cookie, so pages render per request.
// Cache Components would require Suspense boundaries around all of them; revisit when needed.
const nextConfig: NextConfig = {
  turbopack: { root: path.join(import.meta.dirname, "..") },
};

export default nextConfig;
