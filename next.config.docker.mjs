import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Dedicated standalone Next.js config used inside Docker deployments
 * (Hugging Face Spaces, Render, Railway, or any Node 24 VPS).
 * Leaves the Figma Make `next.config.ts` and Payload files untouched in git.
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  output: 'standalone',
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  enablePrerenderSourceMaps: false,
  experimental: {
    cpus: 2,
  },
}

export default nextConfig
