import type { NextConfig } from "next";
import { execSync } from "child_process";

const gitSha = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA
  ?? (() => { try { return execSync("git rev-parse --short HEAD").toString().trim(); } catch { return "dev"; } })();

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_GIT_SHA: gitSha.slice(0, 7),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/shop",
        destination: "/buy",
        permanent: true,
      },
      {
        source: "/shop/:path*",
        destination: "/buy/:path*",
        permanent: true,
      },
      {
        source: "/quote",
        destination: "/sell/quote",
        permanent: true,
      },
      {
        source: "/quote/:path*",
        destination: "/sell/quote/:path*",
        permanent: true,
      },
      {
        source: "/business",
        destination: "/sell/business",
        permanent: true,
      },
      {
        source: "/business/:path*",
        destination: "/sell/business/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
