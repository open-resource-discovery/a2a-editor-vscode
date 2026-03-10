import * as vscode from "vscode";

export class ThemeWatcher {
  private disposable: vscode.Disposable;

  constructor(private readonly webview: vscode.Webview) {
    this.disposable = vscode.window.onDidChangeActiveColorTheme(() => {
      this.sendCurrentTheme();
    });
  }

  public sendCurrentTheme(): void {
    const theme = this.resolveTheme();
    this.webview.postMessage({ type: "setTheme", theme });
  }

  public resolveTheme(): "light" | "dark" {
    const kind = vscode.window.activeColorTheme.kind;
    return kind === vscode.ColorThemeKind.Dark || kind === vscode.ColorThemeKind.HighContrast ? "dark" : "light";
  }

  public dispose(): void {
    this.disposable.dispose();
  }
}
