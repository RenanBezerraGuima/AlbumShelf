/** @type {import('next').NextConfig} */
const repo = process.env.GITHUB_REPOSITORY
  ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}`
  : '/AlbumShelf'
const isNetlify = process.env.NETLIFY === 'true'
const explicitBasePath = process.env.NEXT_PUBLIC_BASE_PATH
const resolvedBasePath =
  explicitBasePath ??
  (isNetlify ? '' : repo)

const nextConfig = {
  output: 'export',
  ...(resolvedBasePath ? { basePath: resolvedBasePath } : {}),
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
