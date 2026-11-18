# CHANGELOG

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) rules.

## [[0.2.6](https://github.com/open-resource-discovery/a2a-editor-vscode/releases/tag/v0.2.6)] - 2026-11-17

### Added

- ORD discovery: list the A2A agents an Open Resource Discovery provider publishes and load one from the sidebar

### Changed

- README: working Marketplace badges in flat style, "ORD supported" badge, usage GIF at the top
- Development setup moved from the README to CONTRIBUTING.md

### Fixed

- Chat went to the previously loaded agent, with the new agent's credentials, when the new agent card named no endpoint
- Copilot, `@a2a` and MCP tools sent chat for A2A 1.0 agent cards to the card URL instead of the agent's endpoint
- Copilot, `@a2a` and MCP tools could forward the sidebar's credentials to an agent on another host

## [[0.2.5](https://github.com/open-resource-discovery/a2a-editor-vscode/releases/tag/v0.2.5)] - 2026-11-16

### Changed

- Dependency updates
- Trusted publishing

## [[0.2.4](https://github.com/open-resource-discovery/a2a-editor-vscode/releases/tag/v0.2.4)] - 2026-10-06

### Changed

- Dependency updates
- GHA bump

## [[0.2.3](https://github.com/open-resource-discovery/a2a-editor-vscode/releases/tag/v0.2.3)] - 2026-07-07

### Changed

- Dependency updates

## [[0.2.2](https://github.com/open-resource-discovery/a2a-editor-vscode/releases/tag/v0.2.2)] - 2026-07-06

### Changed

- Dependency updates

## [[0.2.1](https://github.com/open-resource-discovery/a2a-editor-vscode/releases/tag/v0.2.1)] - 2026-07-06

### Added

- Activity Bar sidebar with auto-detection of agent card files and URL discovery with authentication support
- Custom editor for `*.agentcard.json`, `agent-card.json`, and `agent.json` with bidirectional sync
- Built on [@open-resource-discovery/a2a-editor](https://github.com/open-resource-discovery/a2a-editor) with full VS Code theme integration
- `@a2a` GitHub Copilot chat participant with `/open`, `/connect`, and `/test` commands
- Language Model Tools for Copilot agent mode: fetch, validate, and send messages to A2A agents
- Chat messages route through the vendor's built-in chat UI with streaming and message history
- Agent responses and A2A compliance validation results are returned to Copilot for reasoning
- README: install now walks through `npm run package` + VSIX install instead of the Marketplace
- README: documented the built-in MCP server (endpoint, settings, exposed tools with sidebar side effects) and how to wire it into Claude Code, Cursor, and other HTTP-MCP clients
