// API Configuration
export const GITHUB_RAW_BASE =
  'https://raw.githubusercontent.com/quasarframework/quasar/dev/docs/src/pages'
export const GITHUB_API_BASE =
  'https://api.github.com/repos/quasarframework/quasar/contents/docs/src/pages'

// Cache TTLs
export const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes for raw files
export const INDEX_TTL_MS = 60 * 60 * 1000 // 1 hour for index

// Response limits
export const CHARACTER_LIMIT = 25000 // Maximum response size in characters

// Response formats
export enum ResponseFormat {
  MARKDOWN = 'markdown',
  JSON = 'json',
}
