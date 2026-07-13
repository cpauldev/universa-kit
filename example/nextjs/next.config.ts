import { universalOverlay } from "@example/universal-overlay";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@example/shared"],
  logging: {
    browserToTerminal: false,
  },
};

export default universalOverlay().next(nextConfig);
