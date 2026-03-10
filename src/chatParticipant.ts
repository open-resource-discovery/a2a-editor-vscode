import * as vscode from "vscode";
import type { AgentCardSidebarProvider } from "./AgentCardSidebarProvider";
import { fetchAgentCard } from "./a2aFetch";

const PARTICIPANT_ID = "a2aAgentCard.chat";

const SYSTEM_PROMPT = `You are an expert on the A2A (Agent-to-Agent) protocol. The user has an agent card loaded. Answer questions about it based on its contents — including skills, capabilities, authentication schemes, provider info, and any other fields present.

Agent Card JSON:
\`\`\`json
%CARD%
\`\`\``;

let lastConnectedCard: { url: string; json: string; parsed: Record<string, unknown> } | null = null;
let sidebarRef: AgentCardSidebarProvider | null = null;

export function registerChatParticipant(
  context: vscode.ExtensionContext,
  sidebarProvider: AgentCardSidebarProvider,
): vscode.Disposable | undefined {
  if (!vscode.chat?.createChatParticipant) return undefined;
  sidebarRef = sidebarProvider;
  const participant = vscode.chat.createChatParticipant(PARTICIPANT_ID, handler);
  participant.iconPath = vscode.Uri.joinPath(context.extensionUri, "resources", "a2a-icon.png");
  return participant;
}

const handler: vscode.ChatRequestHandler = async (request, context, stream, token) => {
  switch (request.command) {
    case "open":
      return handleOpen(request, stream);
    case "connect":
      return handleConnect(request, stream, token);
    case "test":
      return handleTest(request, stream);
    default:
      return handleQA(request, context, stream, token);
  }
};

// ---------------------------------------------------------------------------
// Default: Q&A about the current agent card
// ---------------------------------------------------------------------------

async function handleQA(
  request: vscode.ChatRequest,
  context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
): Promise<void> {
  const cardJson = getAgentCardContent();
  if (!cardJson) {
    stream.markdown(
      "No agent card is currently open. Open a `.agentcard.json` file or use `/connect <url>` to load one.",
    );
    return;
  }

  const messages: vscode.LanguageModelChatMessage[] = [
    vscode.LanguageModelChatMessage.User(SYSTEM_PROMPT.replace("%CARD%", cardJson)),
  ];

  // Include conversation history for multi-turn context
  for (const turn of context.history) {
    if (turn instanceof vscode.ChatResponseTurn) {
      let text = "";
      for (const part of turn.response) {
        if (part instanceof vscode.ChatResponseMarkdownPart) {
          text += part.value.value;
        }
      }
      if (text) messages.push(vscode.LanguageModelChatMessage.Assistant(text));
    }
  }

  messages.push(vscode.LanguageModelChatMessage.User(request.prompt));

  try {
    const response = await request.model.sendRequest(messages, {}, token);
    for await (const fragment of response.text) {
      stream.markdown(fragment);
    }
  } catch (err) {
    stream.markdown(`Failed to get a response from the language model: ${err instanceof Error ? err.message : err}`);
  }
}

// ---------------------------------------------------------------------------
// /open — Open an agent card file in the A2A Editor
// ---------------------------------------------------------------------------

async function handleOpen(request: vscode.ChatRequest, stream: vscode.ChatResponseStream): Promise<void> {
  const filePath = request.prompt.trim();

  if (filePath) {
    const uri = vscode.Uri.file(filePath);
    try {
      await vscode.commands.executeCommand("vscode.openWith", uri, "a2aAgentCard.editor");
      stream.markdown(`Opened \`${filePath}\` in the A2A Editor.`);
    } catch (err) {
      stream.markdown(`Could not open \`${filePath}\`: ${err instanceof Error ? err.message : err}`);
    }
    return;
  }

  const editor = vscode.window.activeTextEditor;
  if (editor) {
    await vscode.commands.executeCommand("vscode.openWith", editor.document.uri, "a2aAgentCard.editor");
    stream.markdown(`Opened \`${editor.document.uri.fsPath}\` in the A2A Editor.`);
  } else {
    stream.markdown("No file specified and no active editor. Provide a file path: `@a2a /open path/to/agent.json`");
  }
}

// ---------------------------------------------------------------------------
// /connect — Fetch agent card from URL
// ---------------------------------------------------------------------------

async function handleConnect(
  request: vscode.ChatRequest,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
): Promise<void> {
  const url = request.prompt.trim();
  if (!url) {
    stream.markdown("Provide a URL: `@a2a /connect https://example.com`");
    return;
  }

  try {
    new URL(url);
  } catch {
    stream.markdown(`Invalid URL: \`${url}\``);
    return;
  }

  stream.progress("Fetching agent card...");

  const controller = new AbortController();
  token.onCancellationRequested(() => controller.abort());
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const text = await fetchAgentCard(url, controller.signal);
    clearTimeout(timeout);

    const parsed = JSON.parse(text) as Record<string, unknown>;
    lastConnectedCard = { url, json: text, parsed };

    // Show the card in the sidebar (reveal waits for webview ready)
    if (sidebarRef) {
      await sidebarRef.reveal();
      sidebarRef.setAgentCard(text);
      sidebarRef.setConnection(url, (parsed.url as string) || url);
      sidebarRef.setActiveTab("overview");
    }

    stream.markdown(`### ${(parsed.name as string) || "Agent Card"}\n\n`);
    if (parsed.description) stream.markdown(`${parsed.description}\n\n`);
    if (parsed.url) stream.markdown(`**Endpoint:** ${parsed.url}\n\n`);
    if (parsed.provider && typeof parsed.provider === "object") {
      const p = parsed.provider as Record<string, unknown>;
      if (p.organization) stream.markdown(`**Provider:** ${p.organization}\n\n`);
    }

    const skills = parsed.skills as Array<Record<string, unknown>> | undefined;
    if (skills?.length) {
      stream.markdown("**Skills:**\n");
      for (const skill of skills) {
        stream.markdown(`- **${skill.name}** — ${skill.description || "No description"}\n`);
      }
      stream.markdown("\n");
    }

    stream.markdown("Ask me anything about this agent, or use `/test` to send a message.");
  } catch (err) {
    clearTimeout(timeout);
    stream.markdown(`Failed to fetch agent card from \`${url}\`: ${err instanceof Error ? err.message : err}`);
  }
}

// ---------------------------------------------------------------------------
// /test — Send a test message to an A2A agent
// ---------------------------------------------------------------------------

async function handleTest(request: vscode.ChatRequest, stream: vscode.ChatResponseStream): Promise<void> {
  if (!sidebarRef) {
    stream.markdown("Sidebar not available.");
    return;
  }

  const message = request.prompt.trim();
  if (!message) {
    stream.markdown("Provide a message: `@a2a /test What can you do?`");
    return;
  }

  stream.progress("Sending message via A2A chat...");

  try {
    await sidebarRef.reveal();
    sidebarRef.setActiveTab("chat");
    const result = await sidebarRef.sendChatMessage(message);

    stream.markdown(`### Agent Response\n\n${result.response}\n\n`);
    if (result.compliant) {
      stream.markdown("**A2A Compliance:** Passed\n");
    } else {
      stream.markdown("**A2A Compliance:** Failed\n");
      for (const d of result.complianceDetails.filter((d) => !d.passed)) {
        stream.markdown(`- \`${d.rule}\`: ${d.message}\n`);
      }
    }
  } catch (err) {
    stream.markdown(`Failed to send message: ${err instanceof Error ? err.message : err}`);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAgentCardContent(): string | null {
  // Prefer the last /connect result
  if (lastConnectedCard) return lastConnectedCard.json;

  // Fall back to active editor
  const editor = vscode.window.activeTextEditor;
  if (!editor) return null;
  const text = editor.document.getText();
  try {
    JSON.parse(text);
    return text;
  } catch {
    return null;
  }
}
