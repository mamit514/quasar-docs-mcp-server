import type { DocIndex } from '../types/index.js'
import { INDEX_TTL_MS } from '../constants.js'
import { buildLightweightIndex } from './indexer.js'

let cachedIndex: DocIndex | null = null
let indexBuildTime: number = 0

/**
 * Get the documentation index, building it if necessary.
 * Uses a 1-hour TTL cache to avoid repeated API calls.
 */
export async function getIndex(): Promise<DocIndex> {
  const now = Date.now()

  if (cachedIndex && now - indexBuildTime < INDEX_TTL_MS) {
    return cachedIndex
  }

  cachedIndex = await buildLightweightIndex()
  indexBuildTime = now
  return cachedIndex
}

/**
 * Clear the cached index, forcing a rebuild on next access.
 */
export function clearIndexCache(): void {
  cachedIndex = null
  indexBuildTime = 0
}
