import { type VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  buildCommand: "pnpm turbo build",
  framework: "nextjs",
  outputDirectory: "apps/dashboard/.next",
  ignoreCommand: "git diff HEAD^ HEAD --quiet -- apps/dashboard packages/",
  crons: [],
  rewrites: [],
  redirects: [],
  headers: [],
};

export default config;
