import type { NextConfig } from "next";
import { execSync } from "child_process";

const gitSha = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA
  ?? (() => { try { return execSync("git rev-parse --short HEAD").toString().trim(); } catch { return "dev"; } })();

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_GIT_SHA: gitSha.slice(0, 7),
  },
};

export default nextConfig;
