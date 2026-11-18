import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Native/binary packages stay on the server and are never bundled.
  serverExternalPackages: ['@napi-rs/canvas', 'ffmpeg-static', 'ffprobe-static', 'msedge-tts'],
  devIndicators: false,
  experimental: { serverActions: { bodySizeLimit: '200mb' } },
};

export default nextConfig;
