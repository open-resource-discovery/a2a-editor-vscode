import * as vscode from "vscode";
import * as crypto from "crypto";

interface WebviewHtmlOptions {
  mode: "file-editor" | "standalone" | "sidebar";
}

export function getWebviewContent(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  options: WebviewHtmlOptions,
): string {
  const vendorScriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "a2a-playground.js"));
  const vendorStyleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "a2a-playground.css"));
  const webviewScriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "webview.js"));
  const webviewStyleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "webview.css"));

  const nonce = getNonce();

  const isFileEditor = options.mode === "file-editor";
  const isSidebar = options.mode === "sidebar";

  const initOptions = JSON.stringify({
    mode: options.mode,
    showEditor: false,
    showChat: true,
    showRawHttp: true,
    showValidation: false,
    showSettings: !isFileEditor && !isSidebar,
    showConnection: !isSidebar,
    readOnly: false,
    forceDesktop: !isSidebar,
    defaultTab: "overview",
  });

  const csp = [
    `default-src 'none'`,
    `script-src 'nonce-${nonce}' https://cdn.jsdelivr.net`,
    `style-src ${webview.cspSource} 'unsafe-inline' https://cdn.jsdelivr.net`,
    `img-src ${webview.cspSource} https: data:`,
    `font-src ${webview.cspSource} https://cdn.jsdelivr.net`,
    `connect-src https: http://localhost:* http://127.0.0.1:*`,
    `worker-src blob:`,
  ].join("; ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <link rel="stylesheet" href="${vendorStyleUri}" />
  <link rel="stylesheet" href="${webviewStyleUri}" />
  <style>
    html, body, #root {
      margin: 0;
      padding: 0;
      height: 100%;
      overflow: hidden;
      background: transparent;
    }
    #a2a-outer {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
    }
    #a2a-container {
      width: 100%;
      flex: 1;
      min-height: 0;
    }
    /* Override vendor theme variables with VS Code theme colors */
    #a2a-container .a2a-root, #a2a-container .a2a-root.dark {
      --background: var(--vscode-sideBar-background, var(--vscode-editor-background)) !important;
      --foreground: var(--vscode-foreground) !important;
      --card: var(--vscode-editorWidget-background, var(--vscode-sideBar-background)) !important;
      --card-foreground: var(--vscode-foreground) !important;
      --popover: var(--vscode-editorWidget-background, var(--vscode-editor-background)) !important;
      --popover-foreground: var(--vscode-foreground) !important;
      --primary: var(--vscode-button-background) !important;
      --primary-foreground: var(--vscode-button-foreground) !important;
      --secondary: var(--vscode-button-secondaryBackground, var(--vscode-input-background)) !important;
      --secondary-foreground: var(--vscode-button-secondaryForeground, var(--vscode-foreground)) !important;
      --muted: var(--vscode-input-background) !important;
      --muted-foreground: var(--vscode-descriptionForeground) !important;
      --accent: var(--vscode-list-hoverBackground) !important;
      --accent-foreground: var(--vscode-foreground) !important;
      --destructive: var(--vscode-errorForeground) !important;
      --border: var(--vscode-panel-border) !important;
      --input: var(--vscode-input-border) !important;
      --ring: var(--vscode-focusBorder) !important;
      --sidebar: var(--vscode-sideBar-background, var(--vscode-editor-background)) !important;
      --sidebar-foreground: var(--vscode-sideBar-foreground, var(--vscode-foreground)) !important;
      --sidebar-primary: var(--vscode-button-background) !important;
      --sidebar-primary-foreground: var(--vscode-button-foreground) !important;
      --sidebar-accent: var(--vscode-list-hoverBackground) !important;
      --sidebar-accent-foreground: var(--vscode-foreground) !important;
      --sidebar-border: var(--vscode-panel-border) !important;
      --sidebar-ring: var(--vscode-focusBorder) !important;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">window.__INIT_OPTIONS__ = ${initOptions};</script>
  <script nonce="${nonce}" src="${vendorScriptUri}"></script>
  <script nonce="${nonce}" src="${webviewScriptUri}"></script>
</body>
</html>`;
}

function getNonce(): string {
  return crypto.randomBytes(16).toString("base64url");
}
