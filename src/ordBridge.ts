import { discoverOrdAgents, fetchOrdAgentCard } from "./shared/discoverOrdAgents";

/**
 * Runs ORD requests for a webview in the extension host.
 *
 * ORD providers are usually read server-to-server and often send no CORS headers, so the
 * webview can't fetch them itself. It sends `ordDiscover` / `ordFetchCard` requests instead,
 * gets an `ordResult` back, and sends `ordCancel` when the user cancels or a request times out.
 */

interface MessageTarget {
  postMessage(message: unknown): unknown;
}

type OrdRequestMessage =
  | { type: "ordDiscover" | "ordFetchCard"; requestId: string; url: string; headers?: Record<string, string> }
  | { type: "ordCancel"; requestId: string };

/** Upper bound in case the webview goes away without cancelling. The webview applies its own, shorter timeouts. */
const MAX_REQUEST_MS = 120_000;

export interface OrdBridge {
  /** Handles the message if it is an ORD request. Returns false for any other message. */
  handle(message: unknown): boolean;
  dispose(): void;
}

function isOrdRequest(message: unknown): message is OrdRequestMessage {
  if (!message || typeof message !== "object") return false;
  const { type, requestId } = message as { type?: unknown; requestId?: unknown };
  return (type === "ordDiscover" || type === "ordFetchCard" || type === "ordCancel") && typeof requestId === "string";
}

function toErrorPayload(err: unknown): { name: string; message: string } {
  if (err && typeof err === "object" && (err as { name?: unknown }).name === "AbortError") {
    return { name: "AbortError", message: "Request cancelled" };
  }
  return { name: "Error", message: err instanceof Error ? err.message : String(err) };
}

export function createOrdBridge(target: MessageTarget): OrdBridge {
  const inFlight = new Map<string, AbortController>();

  const run = async (requestId: string, task: (signal: AbortSignal) => Promise<unknown>) => {
    const controller = new AbortController();
    inFlight.set(requestId, controller);
    const timer = setTimeout(() => controller.abort(), MAX_REQUEST_MS);
    try {
      const data = await task(controller.signal);
      target.postMessage({ type: "ordResult", requestId, ok: true, data });
    } catch (err) {
      target.postMessage({ type: "ordResult", requestId, ok: false, error: toErrorPayload(err) });
    } finally {
      clearTimeout(timer);
      inFlight.delete(requestId);
    }
  };

  return {
    handle(message) {
      if (!isOrdRequest(message)) return false;
      if (message.type === "ordCancel") {
        inFlight.get(message.requestId)?.abort();
        return true;
      }
      const { requestId, url } = message;
      const headers = message.headers ?? {};
      if (typeof url !== "string") {
        target.postMessage({
          type: "ordResult",
          requestId,
          ok: false,
          error: { name: "Error", message: "Missing URL" },
        });
        return true;
      }
      void run(requestId, (signal) =>
        message.type === "ordDiscover"
          ? discoverOrdAgents(url, headers, signal)
          : fetchOrdAgentCard(url, headers, signal),
      );
      return true;
    },
    dispose() {
      for (const controller of inFlight.values()) controller.abort();
      inFlight.clear();
    },
  };
}
