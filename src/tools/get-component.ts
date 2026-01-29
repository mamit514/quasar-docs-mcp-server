import { z } from 'zod'
import { fetchRawFile, buildQuasarDocsUrl } from '../services/github.js'
import { CHARACTER_LIMIT, ResponseFormat } from '../constants.js'

export const getComponentSchema = z
  .object({
    component: z
      .string()
      .min(1, 'Component name is required')
      .max(100, 'Component name must not exceed 100 characters')
      .describe(
        "Component name (e.g., 'btn', 'q-btn', 'input', 'q-input', 'dialog', 'button')",
      ),
    response_format: z
      .nativeEnum(ResponseFormat)
      .default(ResponseFormat.MARKDOWN)
      .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable"),
  })
  .strict()

export type GetComponentInput = z.infer<typeof getComponentSchema>

// Common component name mappings (aliases)
const COMPONENT_ALIASES: Record<string, string> = {
  button: 'btn',
  textfield: 'input',
  text: 'input',
  dropdown: 'select',
  checkbox: 'checkbox',
  radio: 'radio',
  toggle: 'toggle',
  slider: 'slider',
  range: 'range',
  datepicker: 'date',
  timepicker: 'time',
  colorpicker: 'color-picker',
  modal: 'dialog',
  popup: 'dialog',
  notification: 'notify',
  toast: 'notify',
  snackbar: 'notify',
  loading: 'loading-bar',
  spinner: 'spinner',
  progress: 'linear-progress',
  progressbar: 'linear-progress',
  tabs: 'tabs',
  tab: 'tabs',
  table: 'table',
  datatable: 'table',
  list: 'list',
  item: 'item',
  card: 'card',
  chip: 'chip',
  badge: 'badge',
  avatar: 'avatar',
  icon: 'icon',
  img: 'img',
  image: 'img',
  video: 'video',
  carousel: 'carousel',
  pagination: 'pagination',
  stepper: 'stepper',
  timeline: 'timeline',
  tree: 'tree',
  expansion: 'expansion-item',
  accordion: 'expansion-item',
  menu: 'menu',
  toolbar: 'toolbar',
  header: 'header',
  footer: 'footer',
  drawer: 'drawer',
  sidebar: 'drawer',
  fab: 'fab',
  tooltip: 'tooltip',
  scroll: 'scroll-area',
  scrollarea: 'scroll-area',
  splitter: 'splitter',
  separator: 'separator',
  space: 'space',
  resize: 'resize-observer',
  intersection: 'intersection',
  uploader: 'uploader',
  upload: 'uploader',
  file: 'file',
  editor: 'editor',
  knob: 'knob',
  rating: 'rating',
  field: 'field',
  form: 'form',
  optiongroup: 'option-group',
  btngroup: 'btn-group',
  btntoggle: 'btn-toggle',
  btndropdown: 'btn-dropdown',
  bar: 'bar',
  breadcrumbs: 'breadcrumbs',
  banner: 'banner',
  markup: 'markup-table',
  nossr: 'no-ssr',
  parallax: 'parallax',
  pulltorefresh: 'pull-to-refresh',
  skeleton: 'skeleton',
  slide: 'slide-item',
  virtualscroll: 'virtual-scroll',
  infinitescroll: 'infinite-scroll',
}

function normalizeComponentName(input: string): string {
  // Remove q- prefix if present
  let name = input.toLowerCase().replace(/^q-/, '')

  // Check for aliases
  if (COMPONENT_ALIASES[name]) {
    name = COMPONENT_ALIASES[name]
  }

  return name
}

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

export async function getComponent(
  input: GetComponentInput,
): Promise<{ content: string; url: string; truncated?: boolean } | { error: string }> {
  const normalizedName = normalizeComponentName(input.component)

  // Try the direct path first
  const directPath = `vue-components/${normalizedName}.md`
  let content = await fetchRawFile(directPath)
  let foundPath = directPath

  if (!content) {
    // Try with hyphens converted to different formats
    const variations = [
      normalizedName,
      normalizedName.replace(/-/g, ''),
      normalizedName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase(),
    ]

    for (const variation of variations) {
      const path = `vue-components/${variation}.md`
      content = await fetchRawFile(path)
      if (content) {
        foundPath = path
        break
      }
    }
  }

  if (!content) {
    return {
      error: `Component '${input.component}' not found. Try using quasar_search_docs to find the correct component name, or quasar_list_sections with section='vue-components' to see all available components.`,
    }
  }

  const url = buildQuasarDocsUrl(foundPath)
  const { content: processedContent, truncated } = truncateContent(content)

  if (input.response_format === ResponseFormat.JSON) {
    const response: Record<string, unknown> = {
      component: input.component,
      normalized_name: normalizedName,
      path: foundPath,
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
export const getComponentToolConfig = {
  name: 'quasar_get_component',
  title: 'Get Quasar Component',
  description: `Get documentation for a specific Quasar UI component.

Returns the full markdown documentation including API reference, props, events, slots, methods, and usage examples.

Args:
  - component (string, required): Component name. Accepts various formats:
    - With prefix: 'q-btn', 'q-input', 'q-dialog'
    - Without prefix: 'btn', 'input', 'dialog'
    - Common aliases: 'button' -> 'btn', 'modal' -> 'dialog', 'dropdown' -> 'select'
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For markdown: Full component documentation with API details
  For JSON:
  {
    "component": string,      // Original input
    "normalized_name": string, // Resolved component name
    "path": string,           // File path in docs
    "url": string,            // Quasar.dev URL
    "content": string,        // Documentation content
    "truncated": boolean      // Whether content was truncated
  }

Examples:
  - Get button docs: component="btn" or component="q-btn" or component="button"
  - Get dialog docs: component="dialog" or component="modal"
  - Get input docs: component="input" or component="textfield"

Errors:
  - Returns "Component not found" with suggestions if component doesn't exist`,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
}
