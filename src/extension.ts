import * as vscode from "vscode";
import { AgentCardEditorProvider } from "./AgentCardEditorProvider";
import { AgentCardSidebarProvider } from "./AgentCardSidebarProvider";
import { registerChatParticipant } from "./chatParticipant";
import { registerMcpProvider } from "./mcp/registerMcpProvider";
import { registerTools } from "./tools";

export function activate(context: vscode.ExtensionContext): void {
  const sidebarProvider = new AgentCardSidebarProvider(context);

  // Register the sidebar view in the Activity Bar
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(AgentCardSidebarProvider.viewType, sidebarProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );

  // Register the custom text editor for file-backed editing
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(AgentCardEditorProvider.viewType, new AgentCardEditorProvider(context), {
      webviewOptions: { retainContextWhenHidden: true },
      supportsMultipleEditorsPerDocument: false,
    }),
  );

  // Register command to open current file with the agent card editor
  context.subscriptions.push(
    vscode.commands.registerCommand("a2aAgentCard.openFileWith", async () => {
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor) {
        await vscode.commands.executeCommand(
          "vscode.openWith",
          activeEditor.document.uri,
          AgentCardEditorProvider.viewType,
        );
      } else {
        vscode.window.showInformationMessage("No active editor. Open a JSON file first.");
      }
    }),
  );

  // Send active file info to the sidebar whenever the active editor changes
  function sendActiveFileToSidebar(editor: vscode.TextEditor | undefined): void {
    if (editor) {
      sidebarProvider.setActiveFile(editor.document.uri.fsPath, editor.document.getText());
    } else {
      sidebarProvider.setActiveFile(null, null);
    }
  }

  // When switching to a different file
  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(sendActiveFileToSidebar));

  // When the active file is edited, update the sidebar (debounced)
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor && activeEditor.document === e.document) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          sidebarProvider.setActiveFile(e.document.uri.fsPath, e.document.getText());
        }, 300);
      }
    }),
  );

  // If a file is already open at activation
  sendActiveFileToSidebar(vscode.window.activeTextEditor);

  // Register the @a2a chat participant for GitHub Copilot
  const chatParticipant = registerChatParticipant(context, sidebarProvider);
  if (chatParticipant) context.subscriptions.push(chatParticipant);

  // Register language model tools for Copilot agent mode
  context.subscriptions.push(...registerTools(sidebarProvider));

  // Register the in-process HTTP MCP server so Claude Code, Cursor, and
  // other MCP-aware clients can use the same A2A tools — not just Copilot.
  const { manager, disposables } = registerMcpProvider(context, sidebarProvider);
  context.subscriptions.push(...disposables);

  // The MCP settings UI lives inside the sidebar's main webview (above the
  // "Agent Card Source" section) so we wire the manager into the provider.
  sidebarProvider.attachMcpManager(manager);

  // Hold a module-level ref so deactivate() can await a graceful shutdown.
  // VS Code awaits deactivate()'s returned Promise but does NOT await
  // Disposable.dispose() callbacks fired from context.subscriptions, so the
  // HTTP listener could otherwise be torn down mid-request on window close.
  activeMcpManager = manager;
}

let activeMcpManager: import("./mcp/serverManager").McpServerManager | null = null;

export async function deactivate(): Promise<void> {
  const m = activeMcpManager;
  activeMcpManager = null;
  if (m) {
    try {
      await m.dispose();
    } catch {
      // Best-effort — the host process is going away regardless.
    }
  }
}
