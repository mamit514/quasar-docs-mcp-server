# Quasar Docs MCP Server

An MCP (Model Context Protocol) server that provides access to the [Quasar Framework](https://quasar.dev) documentation directly from Claude Code and other MCP-compatible clients.

## Features

- **Search documentation** - Full-text search across all Quasar docs with pagination
- **Get component docs** - Retrieve documentation for any Quasar component (q-btn, q-input, etc.)
- **Get any page** - Fetch any documentation page by path
- **List sections** - Browse available documentation sections
- **Smart caching** - 30-minute cache for pages, 1-hour cache for the index
- **Multiple response formats** - Get output in Markdown or JSON format
- **Character limit handling** - Automatic truncation with clear messages

## Installation

### Option 1: npx (Recommended)

Add directly to Claude Code without installing:

```bash
claude mcp add quasar-docs -- npx quasar-docs-mcp
```

### Option 2: Install from npm

```bash
npm install -g quasar-docs-mcp-server
```

Then add to Claude Code:

```bash
claude mcp add quasar-docs -- quasar-docs-mcp
```

### Option 3: Clone and Build

```bash
# Clone the repository
git clone https://github.com/aliaks-ei/quasar-docs-mcp.git
cd quasar-docs-mcp

# Install dependencies and build
npm install
npm run build
```

Then add to Claude Code using the absolute path:

```bash
# Project-scoped (recommended for Quasar projects)
claude mcp add --scope project quasar-docs -- node /absolute/path/to/quasar-docs-mcp/dist/index.js

# Or user-scoped (available in all projects)
claude mcp add --scope user quasar-docs -- node /absolute/path/to/quasar-docs-mcp/dist/index.js
```

## Verify Installation

After adding the server, verify it's working:

```bash
claude mcp list
```

You should see `quasar-docs` in the list of configured servers.

## Available Tools

### `quasar_get_component`

Get documentation for a specific Quasar UI component.

**Parameters:**

- `component` (string, required): Component name (e.g., 'btn', 'q-btn', 'input', 'dialog', 'button')
- `response_format` (string, optional): Output format - 'markdown' (default) or 'json'

**Examples:**

```
Get the documentation for q-btn
Show me q-input props and events
```

### `quasar_get_page`

Get any Quasar documentation page by its path.

**Parameters:**

- `path` (string, required): Path to the page (e.g., 'style/color-palette', 'quasar-plugins/notify')
- `response_format` (string, optional): Output format - 'markdown' (default) or 'json'

**Examples:**

```
Get the Quasar color palette documentation
Show me the Notify plugin docs
```

### `quasar_search_docs`

Search the Quasar documentation for a topic.

**Parameters:**

- `query` (string, required): Search query
- `section` (string, optional): Limit search to a specific section
- `limit` (number, optional): Maximum results 1-50 (default: 10)
- `offset` (number, optional): Results to skip for pagination (default: 0)
- `include_content` (boolean, optional): Search within file contents (slower but more thorough)
- `response_format` (string, optional): Output format - 'markdown' (default) or 'json'

**Examples:**

```
Search for form validation in Quasar docs
Find dark mode configuration
```

### `quasar_list_sections`

List available documentation sections or pages within a section.

**Parameters:**

- `section` (string, optional): Show pages within this section
- `response_format` (string, optional): Output format - 'markdown' (default) or 'json'

**Examples:**

```
List all Quasar documentation sections
List pages in the vue-components section
```

## Documentation Sections

The server provides access to all Quasar documentation sections:

| Section | Description |
|---------|-------------|
| `vue-components` | UI components (buttons, inputs, dialogs, etc.) |
| `vue-directives` | Custom Vue directives |
| `vue-composables` | Composition API utilities |
| `quasar-plugins` | Plugins (notify, dialog, loading, etc.) |
| `quasar-utils` | Utility functions |
| `layout` | Layout components |
| `style` | CSS classes, colors, typography |
| `options` | Configuration options |
| `quasar-cli-vite` | Vite CLI documentation |
| `quasar-cli-webpack` | Webpack CLI documentation |
| `start` | Getting started guides |
| `app-extensions` | App extensions |

## Response Formats

All tools support two response formats:

- **markdown** (default): Human-readable formatted text, ideal for display
- **json**: Machine-readable structured data, ideal for programmatic processing

Example with JSON format:

```
Search for button with response_format="json"
```

## How It Works

The server fetches documentation directly from the [Quasar GitHub repository](https://github.com/quasarframework/quasar) (`docs/src/pages/`). It uses:

1. **GitHub Raw Files** - For fetching individual documentation pages
2. **GitHub API** - For listing directory contents and building the search index
3. **In-memory caching** - 30-minute cache for pages, 1-hour cache for the index

## Environment Variables

- `GITHUB_TOKEN` (optional): Set to increase GitHub API rate limit from 60 to 5000 requests/hour

## Troubleshooting

### "Component not found"

The component name might be different from expected. Use `quasar_search_docs` to find the correct name:

```
search for button component
```

### Rate Limiting

The server uses GitHub's API which has rate limits (60 requests/hour for unauthenticated requests). The built-in caching helps mitigate this. If you hit limits, wait an hour or set a `GITHUB_TOKEN` environment variable to increase the limit to 5000 requests/hour.

### Server Not Responding

1. Make sure the server is built: `npm run build`
2. Verify the path in `claude mcp add` is correct
3. Check Claude Code logs: `claude mcp logs quasar-docs`

### Removing the Server

```bash
claude mcp remove quasar-docs
```

## Development

```bash
# Watch mode for development
npm run dev

# Build
npm run build

# Run the server directly
npm start
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
