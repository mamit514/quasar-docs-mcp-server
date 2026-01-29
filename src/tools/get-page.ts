import { z } from 'zod'
import { fetchRawFile, buildQuasarDocsUrl } from '../services/github.js'
import { CHARACTER_LIMIT, ResponseFormat } from '../constants.js'

export const getPageSchema = z
  .object({
    path: z
      .string()
      .min(1, 'Path is required')
      .max(500, 'Path must not exceed 500 characters')
      .describe(
        "Path to the documentation page (e.g., 'vue-components/btn', 'style/color-palette', 'quasar-plugins/notify')",
      ),
    response_format: z
      .nativeEnum(ResponseFormat)
      .default(ResponseFormat.MARKDOWN)
      .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable"),
  })
  .strict()

export type GetPageInput = z.infer<typeof getPageSchema>

function truncateContent(content: string): { content: string; truncated: boolean } {
  if (content.length <= CHARACTER_LIMIT) {
    return { content, truncated: false }
  }

  const truncated = content.slice(0, CHARACTER_LIMIT)
  const lastNewline = truncated.lastIndexOf('\n')
  const cleanTruncation = lastNewline > CHARACTER_LIMIT * 0.8 ? truncated.slice(0, lastNewline) : truncated

  return {
    content: cleanTruncation + '\n\n---\n[Content truncated due to size. Use quasar_search_docs to find specific sections.]',
    truncated: true,
  }
}

export async function getPage(
  input: GetPageInput,
): Promise<{ content: string; url: string; truncated?: boolean } | { error: string }> {
  // Normalize the path
  let path = input.path
    .replace(/^\//, '') // Remove leading slash
    .replace(/\/$/, '') // Remove trailing slash

  // Add .md extension if not present
  if (!path.endsWith('.md')) {
    path = `${path}.md`
  }

  let content = await fetchRawFile(path)
  let foundPath = path

  if (!content) {
    // Try with /index.md suffix
    const indexPath = path.replace(/\.md$/, '/index.md')
    content = await fetchRawFile(indexPath)
    if (content) {
      foundPath = indexPath
    }
  }

  if (!content) {
    return {
      error: `Page '${input.path}' not found. Use quasar_list_sections to see available sections or quasar_search_docs to search for specific topics.`,
    }
  }

  const url = buildQuasarDocsUrl(foundPath)
  const { content: processedContent, truncated } = truncateContent(content)

  if (input.response_format === ResponseFormat.JSON) {
    const response: Record<string, unknown> = {
      requested_path: input.path,
      resolved_path: foundPath,
      url,
      content: processedContent,
    }

    if (truncated) {
      response.truncated = true
      response.truncation_message =
        'Content was truncated due to size limits. Use quasar_search_docs to find specific sections.'
    }

    return {
      content: JSON.stringify(response, null, 2),
      url,
      truncated,
    }
  }

  return {
    content: processedContent,
    url,
    truncated,
  }
}

// Tool metadata for registration
export const getPageToolConfig = {
  name: 'quasar_get_page',
  title: 'Get Quasar Page',
  description: `Get any Quasar documentation page by its path.

Use this for non-component documentation like style guides, plugins, CLI docs, getting started guides, etc.

Args:
  - path (string, required): Path to the documentation page. Examples:
    - 'vue-components/btn' - Component docs
    - 'style/color-palette' - Style documentation
    - 'quasar-plugins/notify' - Plugin docs
    - 'quasar-cli-vite/quasar-config-file' - CLI configuration
    - 'start/installation' - Getting started
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For markdown: Full page content with documentation
  For JSON:
  {
    "requested_path": string,  // Original path input
    "resolved_path": string,   // Actual file path found
    "url": string,             // Quasar.dev URL
    "content": string,         // Page content
    "truncated": boolean       // Whether content was truncated
  }

Examples:
  - Get color palette: path="style/color-palette"
  - Get notify plugin: path="quasar-plugins/notify"
  - Get CLI config: path="quasar-cli-vite/quasar-config-file"

Errors:
  - Returns "Page not found" with suggestions if path doesn't exist
  - Automatically tries index.md for directory paths`,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
}
