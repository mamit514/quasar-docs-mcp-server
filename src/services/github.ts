import type { Cache, CacheEntry } from '../types/index.js'
import { GITHUB_RAW_BASE, GITHUB_API_BASE, CACHE_TTL_MS } from '../constants.js'

const cache: Cache = new Map()

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': 'quasar-docs-mcp/1.0.0',
  }

  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`
  }

  return headers
}

function getCached(key: string): string | null {
  const entry = cache.get(key)
  if (!entry) return null

  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }

  return entry.content
}

function setCache(key: string, content: string): void {
  const entry: CacheEntry = {
    content,
    fetchedAt: Date.now(),
    expiresAt: Date.now() + CACHE_TTL_MS,
  }
  cache.set(key, entry)
}

export async function fetchRawFile(path: string): Promise<string | null> {
  const cacheKey = `raw:${path}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  const url = `${GITHUB_RAW_BASE}/${path}`

  try {
    const response = await fetch(url, {
      headers: getAuthHeaders(),
    })

    if (!response.ok) {
      return null
    }

    const content = await response.text()
    setCache(cacheKey, content)
    return content
  } catch {
    return null
  }
}

export type GitHubTreeItem = {
  name: string
  path: string
  type: 'file' | 'dir'
  url: string
}

export async function fetchDirectoryContents(path: string): Promise<GitHubTreeItem[]> {
  const cacheKey = `dir:${path}`
  const cached = getCached(cacheKey)
  if (cached) return JSON.parse(cached)

  const url = path ? `${GITHUB_API_BASE}/${path}` : GITHUB_API_BASE

  try {
    const response = await fetch(url, {
      headers: {
        ...getAuthHeaders(),
        Accept: 'application/vnd.github.v3+json',
      },
    })

    if (!response.ok) {
      return []
    }

    const data = (await response.json()) as Array<{
      name: string
      path: string
      type: string
      url: string
    }>

    const items: GitHubTreeItem[] = data.map((item) => ({
      name: item.name,
      path: item.path.replace('docs/src/pages/', ''),
      type: item.type as 'file' | 'dir',
      url: item.url,
    }))

    setCache(cacheKey, JSON.stringify(items))
    return items
  } catch {
    return []
  }
}

export async function fetchAllMarkdownFiles(): Promise<string[]> {
  const allFiles: string[] = []

  async function crawlDirectory(dirPath: string): Promise<void> {
    const items = await fetchDirectoryContents(dirPath)

    for (const item of items) {
      if (item.type === 'dir') {
        await crawlDirectory(item.path)
      } else if (item.name.endsWith('.md')) {
        allFiles.push(item.path)
      }
    }
  }

  await crawlDirectory('')
  return allFiles
}

export function buildQuasarDocsUrl(path: string): string {
  // Convert file path to quasar.dev URL
  // e.g., "vue-components/btn.md" -> "https://quasar.dev/vue-components/btn"
  const cleanPath = path.replace(/\.md$/, '').replace(/\/index$/, '')
  return `https://quasar.dev/${cleanPath}`
}

export function clearCache(): void {
  cache.clear()
}
