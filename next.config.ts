import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    images: {
        unoptimized: true
    },
    // @ts-ignore Next.js warning suggests this exact syntax which may not be in NextConfig types
    allowedDevOrigins: ['192.168.1.106', 'localhost:3000']
};

export default nextConfig;
