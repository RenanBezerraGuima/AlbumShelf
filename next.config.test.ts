import { describe, expect, it } from 'vitest'
import { resolveBasePath } from './next.config.mjs'

describe('resolveBasePath', () => {
  it('returns empty base path in development when no override exists', () => {
    expect(resolveBasePath({ NODE_ENV: 'development' })).toBe('')
  })

  it('returns repository base path in production by default', () => {
    expect(
      resolveBasePath({
        NODE_ENV: 'production',
        GITHUB_REPOSITORY: 'renanbg/AlbumShelf',
      }),
    ).toBe('/AlbumShelf')
  })

  it('returns empty base path in production on Netlify', () => {
    expect(
      resolveBasePath({
        NODE_ENV: 'production',
        GITHUB_REPOSITORY: 'renanbg/AlbumShelf',
        NETLIFY: 'true',
      }),
    ).toBe('')
  })

  it('honors explicit base path override in any environment', () => {
    expect(
      resolveBasePath({
        NODE_ENV: 'development',
        NEXT_PUBLIC_BASE_PATH: '/custom',
      }),
    ).toBe('/custom')
  })
})
