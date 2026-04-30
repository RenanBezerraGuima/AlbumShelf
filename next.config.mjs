export function resolveBasePath(env = process.env) {
  const explicitBasePath = env.NEXT_PUBLIC_BASE_PATH

  if (explicitBasePath !== undefined) {
    return explicitBasePath
  }

  const isProduction = env.NODE_ENV === 'production'
  if (!isProduction) {
    return ''
  }

  const isNetlify = env.NETLIFY === 'true'
  const isVercel = env.VERCEL === '1'
  if (isNetlify || isVercel) {
    return ''
  }

  const repo = env.GITHUB_REPOSITORY
    ? `/${env.GITHUB_REPOSITORY.split('/')[1]}`
    : '/AlbumShelf'

  return repo
}

/** @type {import('next').NextConfig} */
const resolvedBasePath = resolveBasePath()

const nextConfig = {
  ...(resolvedBasePath ? { basePath: resolvedBasePath } : {}),
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
