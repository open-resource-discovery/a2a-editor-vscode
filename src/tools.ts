import * as vscode from "vscode";
import type { AgentCardSidebarProvider } from "./AgentCardSidebarProvider";
import { fetchAgentCard } from "./a2aFetch";
import { validateAgentCardText } from "./toolDefs";

// ---------------------------------------------------------------------------
// Fetch Agent Card
// ---------------------------------------------------------------------------

interface FetchInput {
  url: string;
}

class FetchAgentCardTool implements vscode.LanguageModelTool<FetchInput> {
  constructor(private readonly sidebar: AgentCardSidebarProvider) {}

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<FetchInput>,
    token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    const { url } = options.input;

    try {
      new URL(url);
    } catch {
      return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(`Invalid URL: ${url}`)]);
    }

    const controller = new AbortController();
    token.onCancellationRequested(() => controller.abort());
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const json = await fetchAgentCard(url, controller.signal);
      clearTimeout(timeout);

      const parsed = JSON.parse(json) as Record<string, unknown>;
      const skills = parsed.skills as Array<Record<string, unknown>> | undefined;
      const summary = [
        `Name: ${parsed.name || "unknown"}`,
        `URL: ${parsed.url || url}`,
        `Description: ${parsed.description || "none"}`,
        `Skills: ${skills?.length ?? 0}`,
      ].join("\n");

      // Show the card in the sidebar (reveal waits for webview ready)
      await this.sidebar.reveal();
      this.sidebar.setAgentCard(json);
      this.sidebar.setConnection(url, (parsed.url as string) || url);
      this.sidebar.setActiveTab("overview");

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`${summary}\n\nFull agent card JSON:\n${json}`),
      ]);
    } catch (err) {
      clearTimeout(timeout);
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Failed to fetch agent card from ${url}: ${err instanceof Error ? err.message : err}`,
        ),
      ]);
    }
  }
}

// ---------------------------------------------------------------------------
// Validate Agent Card
// ---------------------------------------------------------------------------

interface ValidateInput {
  content: string;
}

class ValidateAgentCardTool implements vscode.LanguageModelTool<ValidateInput> {
  constructor(private readonly sidebar: AgentCardSidebarProvider) {}

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<ValidateInput>,
  ): Promise<vscode.LanguageModelToolResult> {
    const { content } = options.input;

    const { valid, lines } = validateAgentCardText(content);

    // Show the card in the sidebar on the overview tab
    if (valid) {
      await this.sidebar.reveal();
      this.sidebar.setAgentCard(content);
      this.sidebar.setActiveTab("overview");
    }

    return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(lines.join("\n"))]);
  }
}

// ---------------------------------------------------------------------------
// Send Message
// ---------------------------------------------------------------------------

interface SendMessageInput {
  url: string;
  message: string;
}

class SendMessageTool implements vscode.LanguageModelTool<SendMessageInput> {
  constructor(private readonly sidebar: AgentCardSidebarProvider) {}

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<SendMessageInput>,
  ): Promise<vscode.LanguageModelToolResult> {
    const { message } = options.input;

    try {
      await this.sidebar.reveal();
      this.sidebar.setActiveTab("chat");
      const result = await this.sidebar.sendChatMessage(message);

      const complianceSummary = result.compliant
        ? "A2A compliance: PASSED"
        : "A2A compliance: FAILED\n" +
          result.complianceDetails
            .filter((d) => !d.passed)
            .map((d) => `  - ${d.rule}: ${d.message}`)
            .join("\n");

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Agent response: ${result.response}\n\n${complianceSummary}`),
      ]);
    } catch (err) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Failed to send message: ${err instanceof Error ? err.message : err}`),
      ]);
    }
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerTools(sidebarProvider: AgentCardSidebarProvider): vscode.Disposable[] {
  if (!vscode.lm?.registerTool) return [];
  return [
    vscode.lm.registerTool("a2aAgentCard_fetchAgentCard", new FetchAgentCardTool(sidebarProvider)),
    vscode.lm.registerTool("a2aAgentCard_validateAgentCard", new ValidateAgentCardTool(sidebarProvider)),
    vscode.lm.registerTool("a2aAgentCard_sendMessage", new SendMessageTool(sidebarProvider)),
  ];
}
