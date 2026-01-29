import { z } from 'zod'
import { filterBySection } from '../services/search.js'
import { getIndex } from '../services/index-cache.js'
import { CHARACTER_LIMIT, ResponseFormat } from '../constants.js'

export const listSectionsSchema = z
  .object({
    section: z
      .string()
      .max(100, 'Section must not exceed 100 characters')
      .optional()
      .describe("Optional: show pages within a specific section (e.g., 'vue-components')"),
    response_format: z
      .nativeEnum(ResponseFormat)
      .default(ResponseFormat.MARKDOWN)
      .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable"),
  })
  .strict()

export type ListSectionsInput = z.infer<typeof listSectionsSchema>

interface SectionInfo {
  name: string
  path: string
  title: string
  description: string
  page_count: number
}

interface PageInfo {
  title: string
  path: string
  url: string
}

interface ListSectionsResponse {
  section?: string
  total_sections?: number
  total_pages?: number
  sections?: SectionInfo[]
  pages?: PageInfo[]
  truncated?: boolean
  truncation_message?: string
}

function formatMarkdownSections(response: ListSectionsResponse): string {
  const lines: string[] = []

  if (response.sections) {
    lines.push('# Quasar Documentation Sections')
    lines.push('')
    lines.push(`${response.total_sections} section(s) available:`)
    lines.push('')

    for (const s of response.sections) {
      lines.push(`## ${s.title}`)
      lines.push(`- **Path**: \`${s.path}\``)
      lines.push(`- **Description**: ${s.description}`)
      lines.push(`- **Pages**: ${s.page_count}`)
      lines.push('')
    }

    lines.push('---')
    lines.push(
      "Use `quasar_list_sections` with a section name to see pages within that section.",
    )
  } else if (response.pages) {
    lines.push(`# Section: ${response.section}`)
    lines.push('')
    lines.push(`${response.total_pages} page(s):`)
    lines.push('')

    for (const p of response.pages) {
      lines.push(`- **${p.title}** - \`${p.path}\``)
    }
  }

  if (response.truncated) {
    lines.push('')
    lines.push('---')
    lines.push(`[${response.truncation_message}]`)
  }

  return lines.join('\n')
}

export async function listSections(input: ListSectionsInput): Promise<string> {
  const index = await getIndex()

  let response: ListSectionsResponse

  if (input.section) {
    // List pages within a specific section
    const pages = filterBySection(index, input.section)

    if (pages.length === 0) {
      const availableSections = index.sections.map((s) => s.name).join(', ')

      if (input.response_format === ResponseFormat.JSON) {
        return JSON.stringify(
          {
            error: `Section '${input.section}' not found`,
            available_sections: index.sections.map((s) => ({
              name: s.name,
              title: s.title,
            })),
          },
          null,
          2,
        )
      }

      return `Section '${input.section}' not found. Available sections: ${availableSections}`
    }

    const section = index.sections.find(
      (s) => s.name.toLowerCase() === input.section!.toLowerCase(),
    )

    response = {
      section: section?.title || input.section,
      total_pages: pages.length,
      pages: pages.map((p) => ({
        title: p.title,
        path: p.path,
        url: p.url,
      })),
    }
  } else {
    // List all sections with their descriptions
    response = {
      total_sections: index.sections.length,
      sections: index.sections.map((s) => ({
        name: s.name,
        path: s.path,
        title: s.title,
        description: s.description,
        page_count: index.pages.filter((p) => p.section === s.name).length,
      })),
    }
  }

  // Format based on response type
  let result: string

  if (input.response_format === ResponseFormat.JSON) {
    result = JSON.stringify(response, null, 2)
  } else {
    result = formatMarkdownSections(response)
  }

  // Check character limit
  if (result.length > CHARACTER_LIMIT) {
    if (response.pages) {
      const reducedCount = Math.max(1, Math.floor(response.pages.length / 2))
      response.pages = response.pages.slice(0, reducedCount)
      response.truncated = true
      response.truncation_message = `Page list truncated to ${reducedCount} items. Use quasar_search_docs to find specific pages.`
    } else if (response.sections) {
      response.truncated = true
      response.truncation_message =
        'Response truncated. Use quasar_search_docs to find specific content.'
    }

    if (input.response_format === ResponseFormat.JSON) {
      result = JSON.stringify(response, null, 2)
    } else {
      result = formatMarkdownSections(response)
    }
  }

  return result
}

// Tool metadata for registration
export const listSectionsToolConfig = {
  name: 'quasar_list_sections',
  title: 'List Quasar Sections',
  description: `List all available Quasar documentation sections, or list pages within a specific section.

Use this to discover what documentation is available and navigate the docs structure.

Args:
  - section (string, optional): Show pages within a specific section (e.g., 'vue-components')
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  When listing all sections (no section parameter):
  For markdown: Formatted list of sections with titles, descriptions, and page counts
  For JSON:
  {
    "total_sections": number,
    "sections": [
      {
        "name": string,        // Section identifier (e.g., 'vue-components')
        "path": string,        // URL path
        "title": string,       // Human-readable title
        "description": string, // Section description
        "page_count": number   // Number of pages in section
      }
    ]
  }

  When listing pages in a section:
  For markdown: List of pages with titles and paths
  For JSON:
  {
    "section": string,
    "total_pages": number,
    "pages": [
      {
        "title": string,
        "path": string,
        "url": string
      }
    ]
  }

Examples:
  - List all sections: (no parameters)
  - List component pages: section="vue-components"
  - List plugins: section="quasar-plugins"
  - Get JSON format: section="style", response_format="json"

Errors:
  - Returns available sections if specified section doesn't exist`,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
}
