import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseUrl ? [{
      protocol: supabaseUrl.protocol.replace(":", "") as "http" | "https",
      hostname: supabaseUrl.hostname,
      port: supabaseUrl.port,
      pathname: "/storage/v1/object/sign/employee-profile-photos/**",
    }] : [],
  },
};

export default nextConfig;
