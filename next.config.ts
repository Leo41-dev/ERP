import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // tedarikçi e-Fatura XML'leri gömülü PDF/XSLT nedeniyle birkaç MB olabiliyor
    serverActions: { bodySizeLimit: "20mb" },
  },
};

export default nextConfig;
