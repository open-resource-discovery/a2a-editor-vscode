import * as crypto from "crypto";

export async function fetchAgentCard(targetUrl: string, signal: AbortSignal): Promise<string> {
  const opts: RequestInit = { signal };

  if (targetUrl.endsWith(".json")) {
    const resp = await fetch(targetUrl, opts);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    return resp.text();
  }

  const base = targetUrl.replace(/\/$/, "");

  let resp = await fetch(`${base}/.well-known/agent.json`, opts);
  if (!resp.ok) resp = await fetch(`${base}/.well-known/agent-card.json`, opts);
  if (!resp.ok) resp = await fetch(targetUrl, opts);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
  return resp.text();
}

export function extractTextParts(result: Record<string, unknown>): string[] {
  const texts: string[] = [];
  try {
    const r = result.result as Record<string, unknown> | undefined;
    if (!r) return texts;

    const sources = [
      ...((r.artifacts as Array<Record<string, unknown>>) || []).flatMap(
        (a) => (a.parts as Array<Record<string, unknown>>) || [],
      ),
      ...((((r.status as Record<string, unknown>)?.message as Record<string, unknown>)?.parts as Array<
        Record<string, unknown>
      >) || []),
    ];

    for (const part of sources) {
      if ((part.kind === "text" || part.type === "text") && typeof part.text === "string") {
        texts.push(part.text);
      }
    }
  } catch {
    // Defensive — don't crash on unexpected shapes
  }
  return texts;
}

export function buildJsonRpcMessage(message: string) {
  return {
    jsonrpc: "2.0",
    id: crypto.randomUUID(),
    method: "message/send",
    params: {
      message: {
        kind: "message",
        role: "user",
        parts: [{ kind: "text", text: message }],
        messageId: crypto.randomUUID(),
      },
    },
  };
}
