import * as vscode from "vscode";
import type { AgentCardSidebarProvider } from "../AgentCardSidebarProvider";
import { startHttpMcpServer, type McpHttpHandle } from "./httpServer";

// Lifecycle wrapper around the HTTP MCP server. Reads settings, starts the
// server when enabled, restarts on host/port change, fires an event so the
// VS Code MCP definition provider and the settings webview can react.

const CONFIG_SECTION = "a2aAgentCard.mcp";

export interface McpStatus {
  enabled: boolean;
  running: boolean;
  url: string | null;
  host: string;
  port: number;
  error: string | null;
}

export class McpServerManager implements vscode.Disposable {
  private handle: McpHttpHandle | null = null;
  private starting: Promise<void> | null = null;
  private lastError: string | null = null;
  private readonly onChangeEmitter = new vscode.EventEmitter<McpStatus>();
  readonly onDidChangeStatus = this.onChangeEmitter.event;

  constructor(private readonly sidebar: AgentCardSidebarProvider) {}

  /** Start (or restart) according to current settings. Safe to call repeatedly. */
  async applySettings(): Promise<void> {
    // Coalesce overlapping calls (settings UI Save + onDidChangeConfiguration
    // can fire in quick succession).
    if (this.starting) {
      await this.starting;
    }
    this.starting = this.doApply().finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  private async doApply(): Promise<void> {
    const cfg = readConfig();

    // Already running on the right host/port and still enabled → no-op.
    if (cfg.enabled && this.handle && this.handle.host === cfg.host && this.handle.port === cfg.port) {
      return;
    }

    // Stop any existing server before restarting.
    if (this.handle) {
      const dying = this.handle;
      this.handle = null;
      try {
        await dying.dispose();
      } catch {
        // ignore — best effort
      }
    }

    if (!cfg.enabled) {
      this.lastError = null;
      this.fire();
      return;
    }

    try {
      this.handle = await startHttpMcpServer({
        host: cfg.host,
        port: cfg.port,
        sidebar: this.sidebar,
      });
      this.lastError = null;
    } catch (err) {
      this.handle = null;
      this.lastError = err instanceof Error ? err.message : String(err);
    }
    this.fire();
  }

  status(): McpStatus {
    const cfg = readConfig();
    return {
      enabled: cfg.enabled,
      running: this.handle !== null,
      url: this.handle?.url ?? null,
      host: this.handle?.host ?? cfg.host,
      port: this.handle?.port ?? cfg.port,
      error: this.lastError,
    };
  }

  /** Persist settings to the User scope and re-apply. */
  async updateSettings(next: { enabled?: boolean; host?: string; port?: number }): Promise<void> {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const target = vscode.ConfigurationTarget.Global;
    if (next.enabled !== undefined) await config.update("enabled", next.enabled, target);
    if (next.host !== undefined) await config.update("host", next.host, target);
    if (next.port !== undefined) await config.update("port", next.port, target);
    // onDidChangeConfiguration will fire applySettings; call directly too in
    // case the change is a no-op for VS Code's diff (e.g. same value).
    await this.applySettings();
  }

  async dispose(): Promise<void> {
    this.onChangeEmitter.dispose();
    if (this.handle) {
      const dying = this.handle;
      this.handle = null;
      await dying.dispose().catch(() => {
        // ignore
      });
    }
  }

  private fire() {
    this.onChangeEmitter.fire(this.status());
  }
}

interface Config {
  enabled: boolean;
  host: string;
  port: number;
}

function readConfig(): Config {
  const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return {
    enabled: cfg.get<boolean>("enabled", true),
    host: cfg.get<string>("host", "127.0.0.1") || "127.0.0.1",
    port: clampPort(cfg.get<number>("port", 39627)),
  };
}

function clampPort(p: number | undefined): number {
  const n = typeof p === "number" && Number.isFinite(p) ? Math.floor(p) : 39627;
  if (n < 1 || n > 65535) return 39627;
  return n;
}

export function isMcpConfigChange(e: vscode.ConfigurationChangeEvent): boolean {
  return (
    e.affectsConfiguration(`${CONFIG_SECTION}.enabled`) ||
    e.affectsConfiguration(`${CONFIG_SECTION}.host`) ||
    e.affectsConfiguration(`${CONFIG_SECTION}.port`)
  );
}
