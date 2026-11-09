import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "web-push", "nodemailer"],
};

export default nextConfig;
