[![VS Marketplace](https://img.shields.io/visual-studio-marketplace/v/open-resource-discovery.a2a-editor-vscode?style=for-the-badge&label=VS%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=open-resource-discovery.a2a-editor-vscode) [![Installs](https://img.shields.io/visual-studio-marketplace/i/open-resource-discovery.a2a-editor-vscode?style=for-the-badge)](https://marketplace.visualstudio.com/items?itemName=open-resource-discovery.a2a-editor-vscode) [![License](https://img.shields.io/github/license/open-resource-discovery/a2a-editor-vscode?style=for-the-badge)](LICENSE)

# A2A Editor for VSCode

Visual editor for [A2A (Agent-to-Agent)](https://a2a-protocol.org) protocol Agent Cards inside VS Code. Browse, edit, validate, and test your agents without leaving your IDE.

Built on [@open-resource-discovery/a2a-editor](https://github.com/open-resource-discovery/a2a-editor).

## Features

- **Activity Bar Sidebar** — Dedicated A2A icon in the sidebar with auto-detection of agent card files in the active editor
- **Custom Editor** — Open `*.agentcard.json`, `agent-card.json`, or `agent.json` files as rendered, interactive agent cards
- **Agent Overview** — View agent name, version, provider, description, capabilities, skills, and security schemes at a glance
- **Chat & Testing** — Send messages to connected A2A agents and inspect raw HTTP request/response payloads
- **URL Discovery** — Connect to agents via URL with automatic well-known path resolution
- **Authentication** — Built-in support for Basic Auth, Bearer Token, and API Key authentication
- **Theme Integration** — Seamlessly follows VS Code light, dark, and high-contrast themes

## Quick Start

1. Build the extension `.vsix` from source:
   ```bash
   git clone https://github.com/open-resource-discovery/a2a-editor-vscode.git
   cd a2a-editor-vscode
   npm install
   npm run package
   ```
   This produces `a2a-editor-vscode-<version>.vsix` in the project root.
2. Install it into VS Code — either:
   - From the command line:
     ```bash
     code --install-extension a2a-editor-vscode-<version>.vsix
     ```
   - Or from the UI: **Extensions** view → `…` menu → **Install from VSIX…** → pick the built file.
3. Click the **A2A icon** in the Activity Bar (left sidebar)
4. Enter an agent URL and click **Connect** — or open any agent card JSON file

## Usage

### Sidebar

The sidebar provides a persistent view for browsing agent cards. It automatically detects when the active editor contains an agent card JSON file and switches to display it. Enter a URL to connect to a remote agent, or toggle between URL and file sources.

![Sidebar](resources/a2a-vscode-sidebar.gif)

### Custom Editor

Open any agent card file, then run `Cmd+Shift+P` (macOS) / `Ctrl+Shift+P` (Windows/Linux) → **"A2A: Open Current File as Agent Card"** to open it as a visual agent card. Changes sync bidirectionally between the visual editor and the underlying JSON file.

![Custom Editor](resources/a2a-vscode-cmd.gif)

## Commands

| Command                                | Description                                        |
| -------------------------------------- | -------------------------------------------------- |
| `A2A: Open Current File as Agent Card` | Open the active JSON file in the agent card editor |

## Supported File Patterns

The custom editor activates as an alternative editor (not default) for:

- `*.agentcard.json`
- `agent-card.json`
- `agent.json`

## URL Discovery & Authentication

When connecting to an agent by URL, the extension tries the following paths in order:

1. `<url>/.well-known/agent.json`
2. `<url>/.well-known/agent-card.json`
3. The original URL directly

If the URL ends in `.json`, it is fetched directly without well-known path discovery.

**Supported authentication methods:**

- **No Authentication** — Public agents
- **Basic Auth** — Username and password
- **Bearer Token** — OAuth / JWT tokens
- **API Key** — Custom `X-API-Key` header

## MCP Server (Claude Code, Cursor, Cline, …)

The extension ships an in-process **MCP (Model Context Protocol)** server so external AI tools can drive A2A agents through the same code paths as the editor. It's enabled by default and starts automatically when VS Code loads the extension.

### Client support at a glance

| Client                                 | Setup                                                                                               |
| -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **GitHub Copilot** (Chat / Agent Mode) | Works out of the box — auto-discovered via VS Code 1.110+'s `mcpServerDefinitionProvider`.          |
| **Claude Code**                        | Requires one-time MCP server registration ([see below](#claude-code)).                              |
| **Cursor / Cline / other HTTP-MCP**    | Requires manual config pointing at the server URL ([see below](#cursor--cline--other-mcp-clients)). |

### Exposed tools

Each tool also **drives the editor's sidebar** as a side effect — a fetch or a validate reveals the sidebar and loads the card into the Overview tab, and a send switches to the Chat tab so you see the exchange live in VS Code while the model works.

| Tool                             | Purpose                                                                                                                                                                               | Sidebar side effect                                                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `a2aAgentCard_fetchAgentCard`    | Fetch an agent card from a URL. Tries `/.well-known/agent.json` and `/.well-known/agent-card.json` before falling back to the direct URL. 15 s timeout.                               | Reveals the sidebar, loads the fetched card, switches to **Overview**.                                                               |
| `a2aAgentCard_validateAgentCard` | Validate an agent card JSON string against the A2A schema; reports missing required fields plus a skills/capabilities summary.                                                        | On valid input, reveals the sidebar, loads the card, switches to **Overview**.                                                       |
| `a2aAgentCard_sendMessage`       | Send a test message to an agent via A2A JSON-RPC `message/send`. Returns the agent's reply plus an **A2A compliance report** (per-rule pass/fail). 30 s timeout on the fallback path. | Reveals the sidebar, switches to **Chat**, runs the message through the live chat webview so the conversation is visible in VS Code. |

### Endpoint

By default the server binds to `http://127.0.0.1:39627/mcp` (streamable HTTP transport). Configure via VS Code settings:

- `a2aAgentCard.mcp.enabled` (default `true`)
- `a2aAgentCard.mcp.host` (default `127.0.0.1`)
- `a2aAgentCard.mcp.port` (default `39627`)

VS Code 1.110+ auto-discovers the server via the extension's `mcpServerDefinitionProvider`, so **Copilot Chat / Agent Mode picks it up with no extra config**. For other clients, register it manually.

### Claude Code

Register the running server once with the Claude CLI:

```bash
claude mcp add --transport http a2a-editor http://127.0.0.1:39627/mcp
```

Then, inside a Claude Code session, the three `a2aAgentCard_*` tools are available. Verify with `/mcp` in Claude Code — the `a2a-editor` server should be listed as connected.

> The VS Code window running this extension must be open for the server to be reachable.

### Cursor / Cline / other MCP clients

Point the client at the same URL using its HTTP MCP configuration, e.g.:

```json
{
  "mcpServers": {
    "a2a-editor": {
      "url": "http://127.0.0.1:39627/mcp"
    }
  }
}
```

<details>
<summary><strong>Development</strong></summary>

### Prerequisites

- [Node.js](https://nodejs.org/) >= 24
- [VS Code](https://code.visualstudio.com/) >= 1.110

### Setup

```bash
git clone https://github.com/open-resource-discovery/a2a-editor-vscode.git
cd a2a-editor-vscode
npm install
npm run compile
```

### Run in Development

1. Open this folder in VS Code
2. Press **F5** to launch the Extension Development Host
3. In the new window, click the **A2A icon** in the Activity Bar or run a command from the palette

### Available Scripts

| Script             | Description                 |
| ------------------ | --------------------------- |
| `npm run compile`  | Build extension and webview |
| `npm run watch`    | Watch mode for both builds  |
| `npm run eslint`   | Run ESLint                  |
| `npm run prettier` | Format code with Prettier   |
| `npm run package`  | Package as `.vsix`          |

</details>

## Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to contribute to this project.

## License

Please see our [LICENSE](LICENSE) for copyright and license information. Detailed information including third-party components and their licensing/copyright information is available [via the REUSE tool](https://api.reuse.software/info/github.com/open-resource-discovery/a2a-editor).
