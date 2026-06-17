import * as vscode from "vscode";
import * as crypto from "crypto";
import { getWebviewContent } from "./webviewHtml";
import { ThemeWatcher } from "./themeWatcher";
import type { McpServerManager } from "./mcp/serverManager";

export class AgentCardSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "a2aAgentCard.sidebarView";

  private view?: vscode.WebviewView;
  private themeWatcher?: ThemeWatcher;
  private ready = false;
  private pendingMessages: Array<Record<string, unknown>> = [];
  private readyResolve: (() => void) | null = null;
  private readyPromise: Promise<void> | null = null;
  private toolContentLoaded = false;
  private mcpManager: McpServerManager | null = null;
  private mcpStatusSub: vscode.Disposable | null = null;

  constructor(private readonly context: vscode.ExtensionContext) {}

  /** Wire the MCP manager so the in-sidebar settings UI can read & change state. */
  public attachMcpManager(manager: McpServerManager): void {
    this.mcpManager = manager;
    this.mcpStatusSub?.dispose();
    this.mcpStatusSub = manager.onDidChangeStatus(() => this.pushMcpStatus());
  }

  public setAgentCard(content: string): void {
    this.toolContentLoaded = true;
    this.postMessage({ type: "setContent", content });
  }

  public setActiveFile(path: string | null, content: string | null): void {
    this.postMessage({ type: "setActiveFile", path, content });
  }

  public setActiveTab(tab: "overview" | "chat" | "validation"): void {
    this.postMessage({ type: "setActiveTab", tab });
  }

  public setConnection(url: string, messagingUrl: string): void {
    this.postMessage({ type: "setConnection", url, messagingUrl });
  }

  public sendChatMessage(text: string): Promise<{
    response: string;
    compliant: boolean;
    complianceDetails: { rule: string; passed: boolean; message: string }[];
  }> {
    return new Promise((resolve, reject) => {
      if (!this.view) {
        reject(new Error("Webview not available"));
        return;
      }
      const requestId = crypto.randomUUID();
      const disposable = this.view.webview.onDidReceiveMessage(
        (msg: {
          type: string;
          requestId: string;
          error?: string;
          response?: string;
          compliant?: boolean;
          complianceDetails?: { rule: string; passed: boolean; message: string }[];
        }) => {
          if (msg.type === "chatMessageSent" && msg.requestId === requestId) {
            disposable.dispose();
            if (msg.error) {
              reject(new Error(msg.error));
            } else {
              resolve({
                response: msg.response ?? "",
                compliant: msg.compliant ?? false,
                complianceDetails: msg.complianceDetails ?? [],
              });
            }
          }
        },
      );
      this.postMessage({ type: "sendChatMessage", text, requestId });
    });
  }

  private postMessage(message: Record<string, unknown>): void {
    if (this.view && this.ready) {
      this.view.webview.postMessage(message);
    } else {
      this.pendingMessages.push(message);
    }
  }

  private pushMcpStatus(): void {
    if (!this.mcpManager) return;
    this.postMessage({ type: "mcpStatus", status: this.mcpManager.status() });
  }

  public async reveal(): Promise<void> {
    // If already ready, just focus
    if (this.view && this.ready) {
      await vscode.commands.executeCommand("a2aAgentCard.sidebarView.focus");
      return;
    }

    // Create a promise that resolves when "ready" fires
    if (!this.readyPromise) {
      this.readyPromise = new Promise<void>((resolve) => {
        this.readyResolve = resolve;
      });
    }

    try {
      await vscode.commands.executeCommand("workbench.view.extension.a2a-agent-explorer");
    } catch {
      // Fallback for environments where the container command is unavailable.
    }
    await vscode.commands.executeCommand("a2aAgentCard.sidebarView.focus");

    // Wait for the webview to actually be ready
    await this.readyPromise;
    this.readyPromise = null;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;
    this.ready = false;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, "media")],
    };

    webviewView.webview.html = getWebviewContent(webviewView.webview, this.context.extensionUri, { mode: "sidebar" });

    this.themeWatcher = new ThemeWatcher(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.type) {
        case "ready":
          this.ready = true;
          this.themeWatcher?.sendCurrentTheme();

          // Flush any queued messages
          if (this.pendingMessages.length > 0) {
            for (const pendingMessage of this.pendingMessages) {
              webviewView.webview.postMessage(pendingMessage);
            }
            this.pendingMessages = [];
          }

          // Send the current active file info — but only if no tool content was loaded,
          // otherwise the active editor content would overwrite the tool-loaded card.
          if (!this.toolContentLoaded) {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
              this.setActiveFile(editor.document.uri.fsPath, editor.document.getText());
            }
          }
          this.toolContentLoaded = false;

          // Resolve the ready promise so reveal() callers proceed
          if (this.readyResolve) {
            this.readyResolve();
            this.readyResolve = null;
          }
          break;
        case "getActiveFile":
          {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
              webviewView.webview.postMessage({
                type: "setActiveFile",
                path: editor.document.uri.fsPath,
                content: editor.document.getText(),
              });
            } else {
              webviewView.webview.postMessage({
                type: "setActiveFile",
                path: null,
                content: null,
              });
            }
          }
          break;
        case "error":
          vscode.window.showErrorMessage(`A2A Agent Card: ${message.message}`);
          break;
        case "mcpReady":
          // Webview's MCP section finished mounting — send it the current status.
          this.pushMcpStatus();
          break;
        case "mcpSave":
          if (this.mcpManager) {
            void this.mcpManager
              .updateSettings({
                enabled: !!message.enabled,
                host: typeof message.host === "string" && message.host ? message.host : "127.0.0.1",
                port: clampPort(message.port),
              })
              .then(() => this.pushMcpStatus())
              .catch((err: unknown) => {
                webviewView.webview.postMessage({
                  type: "mcpStatus",
                  status: { ...this.mcpManager!.status(), error: err instanceof Error ? err.message : String(err) },
                });
              });
          }
          break;
      }
    });

    webviewView.onDidDispose(() => {
      this.themeWatcher?.dispose();
      this.themeWatcher = undefined;
      this.mcpStatusSub?.dispose();
      this.mcpStatusSub = null;
      this.view = undefined;
      this.ready = false;
    });
  }
}

function clampPort(p: unknown): number {
  const n = typeof p === "number" ? p : Number(p);
  if (!Number.isFinite(n)) return 39627;
  const i = Math.floor(n);
  if (i < 1 || i > 65535) return 39627;
  return i;
}
