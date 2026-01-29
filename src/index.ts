#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import {
  getComponentSchema,
  getComponent,
  getComponentToolConfig,
} from './tools/get-component.js'
import { getPageSchema, getPage, getPageToolConfig } from './tools/get-page.js'
import {
  searchDocsSchema,
  searchDocs,
  searchDocsToolConfig,
} from './tools/search-docs.js'
import {
  listSectionsSchema,
  listSections,
  listSectionsToolConfig,
} from './tools/list-sections.js'

const server = new McpServer({
  name: 'quasar-docs-mcp-server',
  version: '1.0.0',
})

// Tool: Get Quasar Component documentation
server.tool(
  getComponentToolConfig.name,
  getComponentToolConfig.description,
  getComponentSchema.shape,
  async (input) => {
    const result = await getComponent(input)

    if ('error' in result) {
      return {
        content: [{ type: 'text', text: result.error }],
        isError: true,
      }
    }

    if (input.response_format === 'json') {
      return {
        content: [{ type: 'text', text: result.content }],
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: `# Documentation for ${input.component}\n\nURL: ${result.url}\n\n---\n\n${result.content}`,
        },
      ],
    }
  },
)

// Tool: Get any Quasar documentation page
server.tool(
  getPageToolConfig.name,
  getPageToolConfig.description,
  getPageSchema.shape,
  async (input) => {
    const result = await getPage(input)

    if ('error' in result) {
      return {
        content: [{ type: 'text', text: result.error }],
        isError: true,
      }
    }

    if (input.response_format === 'json') {
      return {
        content: [{ type: 'text', text: result.content }],
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: `# Documentation: ${input.path}\n\nURL: ${result.url}\n\n---\n\n${result.content}`,
        },
      ],
    }
  },
)

// Tool: Search Quasar documentation
server.tool(
  searchDocsToolConfig.name,
  searchDocsToolConfig.description,
  searchDocsSchema.shape,
  async (input) => {
    const result = await searchDocs(input)

    return {
      content: [{ type: 'text', text: result }],
    }
  },
)

// Tool: List documentation sections
server.tool(
  listSectionsToolConfig.name,
  listSectionsToolConfig.description,
  listSectionsSchema.shape,
  async (input) => {
    const result = await listSections(input)

    return {
      content: [{ type: 'text', text: result }],
    }
  },
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)

  // Log to stderr (not stdout) to avoid breaking MCP protocol
  console.error('Quasar Docs MCP server started')
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
