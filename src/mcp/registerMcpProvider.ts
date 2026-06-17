import * as vscode from "vscode";
import type { AgentCardSidebarProvider } from "../AgentCardSidebarProvider";
import { McpServerManager } from "./serverManager";

const PROVIDER_ID = "a2aAgentCard.mcp";

/**
 * Boots the in-process HTTP MCP server and registers it with VS Code so
 * Copilot agent mode can discover and use it. The server is also reachable
 * by external MCP clients (Claude Code, Cursor, ...) at the same URL.
 *
 * Returns the manager (so the settings webview / commands can read status
 * and trigger restarts) plus the disposables to register with the context.
 */
export function registerMcpProvider(
  context: vscode.ExtensionContext,
  sidebar: AgentCardSidebarProvider,
): { manager: McpServerManager; disposables: vscode.Disposable[] } {
  const manager = new McpServerManager(sidebar);

  // Start now (best-effort). If this fails, status reflects the error and
  // the settings webview lets the user fix host/port and retry.
  void manager.applySettings();

  const disposables: vscode.Disposable[] = [manager];

  // Re-apply settings on configuration change.
  disposables.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration("a2aAgentCard.mcp.enabled") ||
        e.affectsConfiguration("a2aAgentCard.mcp.host") ||
        e.affectsConfiguration("a2aAgentCard.mcp.port")
      ) {
        void manager.applySettings();
      }
    }),
  );

  // Register with VS Code's MCP definition provider — only meaningful when
  // the API is present (it is on 1.101+; we already require 1.110+).
  if (vscode.lm?.registerMcpServerDefinitionProvider && vscode.McpHttpServerDefinition) {
    const didChange = new vscode.EventEmitter<void>();
    disposables.push(didChange);

    // Whenever the URL/host/port changes, re-emit so VS Code re-fetches.
    disposables.push(manager.onDidChangeStatus(() => didChange.fire()));

    const provider: vscode.McpServerDefinitionProvider = {
      onDidChangeMcpServerDefinitions: didChange.event,

      provideMcpServerDefinitions: () => {
        const status = manager.status();
        if (!status.enabled || !status.url) return [];
        return [
          new vscode.McpHttpServerDefinition("A2A Agent Card", vscode.Uri.parse(status.url), {}, readVersion(context)),
        ];
      },

      // Stub — returning the definition unchanged. Future use: prompt for
      // an API key with vscode.window.showInputBox here.
      resolveMcpServerDefinition: (server) => server,
    };

    disposables.push(vscode.lm.registerMcpServerDefinitionProvider(PROVIDER_ID, provider));
  }

  return { manager, disposables };
}

function readVersion(context: vscode.ExtensionContext): string {
  try {
    const pkg = context.extension?.packageJSON as { version?: string } | undefined;
    if (pkg?.version) return pkg.version;
  } catch {
    // ignore
  }
  return "0.0.0";
}
