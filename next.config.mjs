/** @type {import('next').NextConfig} */
const repo = process.env.GITHUB_REPOSITORY ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}` : '/AlbumShelf'
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? repo

const nextConfig = {
  output: 'export',
  basePath,
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
