# Changelog

## [unreleased]

- Activity Bar sidebar with auto-detection of agent card files and URL discovery with authentication support
- Custom editor for `*.agentcard.json`, `agent-card.json`, and `agent.json` with bidirectional sync
- Built on [@open-resource-discovery/a2a-editor](https://github.com/open-resource-discovery/a2a-editor) with full VS Code theme integration
- `@a2a` GitHub Copilot chat participant with `/open`, `/connect`, and `/test` commands
- Language Model Tools for Copilot agent mode: fetch, validate, and send messages to A2A agents
- Chat messages route through the vendor's built-in chat UI with streaming and message history
- Agent responses and A2A compliance validation results are returned to Copilot for reasoning
- README: install now walks through `npm run package` + VSIX install instead of the Marketplace
- README: documented the built-in MCP server (endpoint, settings, exposed tools with sidebar side effects) and how to wire it into Claude Code, Cursor, and other HTTP-MCP clients
