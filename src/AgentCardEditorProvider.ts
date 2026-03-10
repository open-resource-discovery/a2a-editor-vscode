import * as vscode from "vscode";
import { getWebviewContent } from "./webviewHtml";
import { ThemeWatcher } from "./themeWatcher";

export class AgentCardEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = "a2aAgentCard.editor";

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    const webview = webviewPanel.webview;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, "media")],
    };

    webview.html = getWebviewContent(webview, this.context.extensionUri, {
      mode: "file-editor",
    });

    let isWebviewUpdate = false;
    const disposables: vscode.Disposable[] = [];

    const themeWatcher = new ThemeWatcher(webview);

    // Handle messages from the webview
    webview.onDidReceiveMessage(
      (message) => {
        switch (message.type) {
          case "ready":
            webview.postMessage({
              type: "setActiveFile",
              path: document.uri.fsPath,
              content: document.getText(),
            });
            themeWatcher.sendCurrentTheme();
            break;

          case "getActiveFile":
            webview.postMessage({
              type: "setActiveFile",
              path: document.uri.fsPath,
              content: document.getText(),
            });
            break;

          case "contentChanged": {
            const newContent = message.content;
            if (newContent === document.getText()) {
              return;
            }
            isWebviewUpdate = true;
            const edit = new vscode.WorkspaceEdit();
            edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), newContent);
            vscode.workspace.applyEdit(edit).finally(() => {
              isWebviewUpdate = false;
            });
            break;
          }

          case "error":
            vscode.window.showErrorMessage(`A2A Agent Card: ${message.message}`);
            break;
        }
      },
      undefined,
      disposables,
    );

    // Listen for external changes to the document
    const docChangeListener = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() !== document.uri.toString()) {
        return;
      }
      if (isWebviewUpdate) {
        return;
      }
      webview.postMessage({
        type: "setContent",
        content: document.getText(),
      });
    });
    disposables.push(docChangeListener);

    webviewPanel.onDidDispose(() => {
      themeWatcher.dispose();
      for (const d of disposables) {
        d.dispose();
      }
    });
  }
}
