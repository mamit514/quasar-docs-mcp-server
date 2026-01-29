import { z } from 'zod'
import type { DocIndex, SearchResult } from '../types/index.js'
import { searchIndex, searchContent, filterBySection } from '../services/search.js'
import { getIndex } from '../services/index-cache.js'
import { CHARACTER_LIMIT, ResponseFormat } from '../constants.js'

export const searchDocsSchema = z
  .object({
    query: z
      .string()
      .min(1, 'Query is required')
      .max(200, 'Query must not exceed 200 characters')
      .describe("Search query (e.g., 'button', 'form validation', 'dark mode')"),
    section: z
      .string()
      .max(100, 'Section must not exceed 100 characters')
      .optional()
      .describe(
        "Optional: limit search to a specific section (e.g., 'vue-components', 'style', 'quasar-plugins')",
      ),
    limit: z
      .number()
      .int('Limit must be a whole number')
      .min(1, 'Limit must be at least 1')
      .max(50, 'Limit must not exceed 50')
      .default(10)
      .describe('Maximum number of results to return (default: 10, max: 50)'),
    offset: z
      .number()
      .int('Offset must be a whole number')
      .min(0, 'Offset cannot be negative')
      .default(0)
      .describe('Number of results to skip for pagination (default: 0)'),
    include_content: z
      .boolean()
      .default(false)
      .describe('Whether to search within file contents (slower but more thorough)'),
    response_format: z
      .nativeEnum(ResponseFormat)
      .default(ResponseFormat.MARKDOWN)
      .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable"),
  })
  .strict()

export type SearchDocsInput = z.infer<typeof searchDocsSchema>

interface SearchResponse {
  query: string
  section?: string
  total: number
  count: number
  offset: number
  limit: number
  has_more: boolean
  next_offset?: number
  results: Array<{
    title: string
    path: string
    section: string
    url: string
    snippet?: string
    score: number
  }>
  truncated?: boolean
  truncation_message?: string
}

function formatMarkdownResults(response: SearchResponse): string {
  const lines: string[] = []

  if (response.results.length === 0) {
    lines.push(`No results found for '${response.query}'.`)
    if (response.section) {
      lines.push(`Try removing the section filter or searching in a different section.`)
    }
    return lines.join('\n')
  }

  lines.push(`# Search Results: '${response.query}'`)
  lines.push('')
  lines.push(
    `Found ${response.total} result(s)${response.section ? ` in section '${response.section}'` : ''} (showing ${response.count}, offset: ${response.offset})`,
  )
  lines.push('')

  for (let i = 0; i < response.results.length; i++) {
    const r = response.results[i]
    lines.push(`## ${response.offset + i + 1}. ${r.title}`)
    lines.push(`- **Section**: ${r.section}`)
    lines.push(`- **Path**: ${r.path}`)
    lines.push(`- **URL**: ${r.url}`)
    if (r.snippet && r.snippet !== `Section: ${r.section}`) {
      lines.push(`- **Snippet**: ${r.snippet}`)
    }
    lines.push('')
  }

  if (response.has_more) {
    lines.push('---')
    lines.push(
      `More results available. Use offset=${response.next_offset} to see the next page.`,
    )
  }

  if (response.truncated) {
    lines.push('')
    lines.push('---')
    lines.push(`[${response.truncation_message}]`)
  }

  return lines.join('\n')
}

export async function searchDocs(input: SearchDocsInput): Promise<string> {
  const index = await getIndex()

  // Filter by section if specified
  let pagesToSearch = index.pages
  let sectionName = input.section

  if (input.section) {
    pagesToSearch = filterBySection(index, input.section)
    if (pagesToSearch.length === 0) {
      const availableSections = index.sections.map((s) => s.name).join(', ')
      const response: SearchResponse = {
        query: input.query,
        section: input.section,
        total: 0,
        count: 0,
        offset: input.offset,
        limit: input.limit,
        has_more: false,
        results: [],
      }

      if (input.response_format === ResponseFormat.JSON) {
        return JSON.stringify(
          {
            ...response,
            error: `Section '${input.section}' not found`,
            available_sections: index.sections.map((s) => s.name),
          },
          null,
          2,
        )
      }

      return `No pages found in section '${input.section}'. Available sections: ${availableSections}`
    }
  }

  // Create a filtered index for searching
  const filteredIndex: DocIndex = {
    ...index,
    pages: pagesToSearch,
  }

  // Search the index - get more than needed for pagination
  const allResults = searchIndex(filteredIndex, input.query, input.offset + input.limit + 50)

  // If content search is enabled and we have few results, search content too
  let combinedResults = [...allResults]

  if (input.include_content && allResults.length < input.offset + input.limit) {
    const pathsToSearch = pagesToSearch
      .slice(0, 50) // Limit content search to first 50 pages for performance
      .map((p) => p.path)

    const contentResults = await searchContent(
      input.query,
      pathsToSearch,
      input.offset + input.limit - allResults.length,
    )

    // Merge results, avoiding duplicates
    const existingPaths = new Set(allResults.map((r) => r.path))
    for (const result of contentResults) {
      if (!existingPaths.has(result.path)) {
        combinedResults.push(result)
        existingPaths.add(result.path)
      }
    }
  }

  // Apply pagination
  const total = combinedResults.length
  const paginatedResults = combinedResults.slice(input.offset, input.offset + input.limit)
  const hasMore = total > input.offset + paginatedResults.length

  const response: SearchResponse = {
    query: input.query,
    section: sectionName,
    total,
    count: paginatedResults.length,
    offset: input.offset,
    limit: input.limit,
    has_more: hasMore,
    results: paginatedResults.map((r) => ({
      title: r.title,
      path: r.path,
      section: r.section,
      url: r.url,
      snippet: r.snippet !== `Section: ${r.section}` ? r.snippet : undefined,
      score: r.score,
    })),
  }

  if (hasMore) {
    response.next_offset = input.offset + paginatedResults.length
  }

  // Format based on response type
  let result: string

  if (input.response_format === ResponseFormat.JSON) {
    result = JSON.stringify(response, null, 2)
  } else {
    result = formatMarkdownResults(response)
  }

  // Check character limit
  if (result.length > CHARACTER_LIMIT) {
    // Reduce results to fit
    const reducedCount = Math.max(1, Math.floor(paginatedResults.length / 2))
    response.results = response.results.slice(0, reducedCount)
    response.count = reducedCount
    response.has_more = true
    response.next_offset = input.offset + reducedCount
    response.truncated = true
    response.truncation_message = `Results truncated from ${paginatedResults.length} to ${reducedCount} items. Use offset parameter to see more.`

    if (input.response_format === ResponseFormat.JSON) {
      result = JSON.stringify(response, null, 2)
    } else {
      result = formatMarkdownResults(response)
    }
  }

  return result
}

// Tool metadata for registration
export const searchDocsToolConfig = {
  name: 'quasar_search_docs',
  title: 'Search Quasar Docs',
  description: `Search the Quasar documentation for topics, components, or features.

Returns a list of matching pages with titles, paths, sections, URLs, and relevance scores. Supports section filtering, pagination, and optional deep content search.

Args:
  - query (string, required): Search terms (e.g., 'button', 'form validation', 'dark mode')
  - section (string, optional): Limit to section (e.g., 'vue-components', 'style', 'quasar-plugins')
  - limit (number): Max results 1-50 (default: 10)
  - offset (number): Results to skip for pagination (default: 0)
  - include_content (boolean): Search file contents - slower but more thorough (default: false)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For markdown: Formatted list with titles, sections, paths, URLs
  For JSON:
  {
    "query": string,
    "section": string | undefined,
    "total": number,           // Total matches found
    "count": number,           // Results in this response
    "offset": number,          // Current offset
    "limit": number,           // Requested limit
    "has_more": boolean,       // More results available
    "next_offset": number,     // Offset for next page
    "results": [
      {
        "title": string,
        "path": string,
        "section": string,
        "url": string,
        "snippet": string,     // Context around match
        "score": number        // Relevance score
      }
    ]
  }

Examples:
  - Find button docs: query="btn"
  - Find form components: query="form", section="vue-components"
  - Get next page: query="dialog", offset=10, limit=10
  - Deep search: query="validation", include_content=true

Errors:
  - Returns "No results found" if no matches
  - Returns available sections if section filter is invalid`,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
}
