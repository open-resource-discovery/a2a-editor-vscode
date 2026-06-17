import * as http from "http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { AgentCardSidebarProvider } from "../AgentCardSidebarProvider";
import { buildJsonRpcMessage, extractTextParts, fetchAgentCard } from "../a2aFetch";
import { TOOL_DEFS, validateAgentCardText } from "../toolDefs";

// In-process MCP server over Streamable HTTP. Runs inside the extension host,
// so tool handlers can call `AgentCardSidebarProvider` directly — no IPC, no
// child process. External MCP clients (Claude Code CLI, Cursor, ...) and
// VS Code's own Copilot agent mode connect to the same URL.
//
// Stateless mode: each HTTP request gets its own short-lived `Server` AND
// `transport`. This is required for concurrency — `Server.connect()` throws
// "Already connected to a transport" when called twice on the same instance,
// so we cannot share one `Server` across overlapping requests. Building a
// fresh `Server` per request is cheap (it's just a JS object plus the two
// request-handler closures) and lets multiple clients connect simultaneously.

export interface McpHttpHandle {
  url: string;
  host: string;
  port: number;
  dispose(): Promise<void>;
}

export interface StartOptions {
  host: string;
  port: number;
  sidebar: AgentCardSidebarProvider;
}

export async function startHttpMcpServer(opts: StartOptions): Promise<McpHttpHandle> {
  // Track in-flight servers/transports so dispose() can close them all.
  const live = new Set<{ server: Server; transport: StreamableHTTPServerTransport }>();

  const httpServer = http.createServer(async (req, res) => {
    // Fresh `Server` AND `transport` per request — see the file comment for
    // why sharing the `Server` is not safe under concurrent clients.
    const mcpServer = buildMcpServer(opts.sidebar);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless — no Mcp-Session-Id required
      enableJsonResponse: true,
    });
    const entry = { server: mcpServer, transport };
    live.add(entry);

    const cleanup = async () => {
      live.delete(entry);
      await transport.close().catch(() => {});
      await mcpServer.close().catch(() => {});
    };
    res.on("close", () => {
      void cleanup();
    });

    try {
      await mcpServer.connect(transport);
      const body = await readJsonBody(req);
      await transport.handleRequest(req, res, body);
    } catch (err) {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32603, message: errMessage(err) },
            id: null,
          }),
        );
      }
      await cleanup();
    }
  });

  await new Promise<void>((resolve, reject) => {
    const onError = (err: Error) => reject(err);
    httpServer.once("error", onError);
    httpServer.listen(opts.port, opts.host, () => {
      httpServer.off("error", onError);
      resolve();
    });
  });

  const addr = httpServer.address();
  const port = typeof addr === "object" && addr ? addr.port : opts.port;
  const host = opts.host;
  const url = `http://${host}:${port}/mcp`;

  return {
    url,
    host,
    port,
    async dispose() {
      // closeAllConnections() forces hung requests to drop instead of waiting
      // for them to drain — important on VS Code shutdown where deactivate()
      // has only a few seconds before the host is force-killed.
      try {
        httpServer.closeAllConnections?.();
      } catch {
        // older Node — no-op
      }
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      // Close every still-live transport+server we know about.
      await Promise.all(
        [...live].map(async ({ server, transport }) => {
          await transport.close().catch(() => {});
          await server.close().catch(() => {});
        }),
      );
      live.clear();
    },
  };
}

// ---------------------------------------------------------------------------
// MCP Server wiring
// ---------------------------------------------------------------------------

function buildMcpServer(sidebar: AgentCardSidebarProvider): Server {
  const server = new Server({ name: "a2a-agent-card", version: "0.2.0" }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    const input = (args ?? {}) as Record<string, unknown>;

    try {
      switch (name) {
        case "a2aAgentCard_fetchAgentCard":
          return await handleFetch(sidebar, input.url as string);
        case "a2aAgentCard_validateAgentCard":
          return await handleValidate(sidebar, input.content as string);
        case "a2aAgentCard_sendMessage":
          return await handleSend(sidebar, input.url as string, input.message as string);
        default:
          return textResult(`Unknown tool: ${name}`, true);
      }
    } catch (err) {
      return textResult(`Tool error: ${errMessage(err)}`, true);
    }
  });

  return server;
}

// ---------------------------------------------------------------------------
// Handlers — call the sidebar directly (no IPC, in-process).
// ---------------------------------------------------------------------------

async function handleFetch(sidebar: AgentCardSidebarProvider, url: string) {
  if (!url || typeof url !== "string") return textResult("Missing or invalid 'url' argument.", true);
  try {
    new URL(url);
  } catch {
    return textResult(`Invalid URL: ${url}`, true);
  }

  const controller = new AbortController();
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

    await sidebar.reveal();
    sidebar.setAgentCard(json);
    sidebar.setConnection(url, (parsed.url as string) || url);
    sidebar.setActiveTab("overview");

    return textResult(`${summary}\n\nFull agent card JSON:\n${json}`);
  } catch (err) {
    clearTimeout(timeout);
    return textResult(`Failed to fetch agent card from ${url}: ${errMessage(err)}`, true);
  }
}

async function handleValidate(sidebar: AgentCardSidebarProvider, content: string) {
  if (typeof content !== "string") return textResult("Missing or invalid 'content' argument.", true);

  const { valid, lines } = validateAgentCardText(content);
  if (valid) {
    await sidebar.reveal();
    sidebar.setAgentCard(content);
    sidebar.setActiveTab("overview");
  }
  return textResult(lines.join("\n"));
}

async function handleSend(sidebar: AgentCardSidebarProvider, url: string, message: string) {
  if (!url || typeof url !== "string") return textResult("Missing or invalid 'url' argument.", true);
  if (typeof message !== "string") return textResult("Missing or invalid 'message' argument.", true);
  try {
    new URL(url);
  } catch {
    return textResult(`Invalid URL: ${url}`, true);
  }

  // Preferred path: drive the sidebar's chat so the user sees the message
  // and we get full A2A compliance results from the existing webview logic.
  // We need an active webview for that — the sidebar must be revealed first.
  try {
    await sidebar.reveal();
    sidebar.setActiveTab("chat");
    const result = await sidebar.sendChatMessage(message);
    const complianceSummary = result.compliant
      ? "A2A compliance: PASSED"
      : "A2A compliance: FAILED\n" +
        result.complianceDetails
          .filter((d) => !d.passed)
          .map((d) => `  - ${d.rule}: ${d.message}`)
          .join("\n");
    return textResult(`Agent response: ${result.response}\n\n${complianceSummary}`);
  } catch (err) {
    // Fallback: direct host-side JSON-RPC POST (no compliance check).
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const body = buildJsonRpcMessage(message);
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!resp.ok) return textResult(`HTTP ${resp.status}: ${resp.statusText}`, true);
      const result = (await resp.json()) as Record<string, unknown>;
      const texts = extractTextParts(result);
      const reply = texts.length ? texts.join("\n") : JSON.stringify(result);
      return textResult(`Agent response: ${reply}\n\n(compliance check unavailable: ${errMessage(err)})`);
    } catch (httpErr) {
      clearTimeout(timeout);
      return textResult(`Failed to send message: ${errMessage(httpErr)}`, true);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function textResult(text: string, isError = false) {
  return {
    content: [{ type: "text", text }],
    isError,
  };
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  if (req.method !== "POST") return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return undefined;
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
