import { vscode } from "../vscodeApi";

/** Requests the extension host runs for the webview (see src/ordBridge.ts) */
export type HostRequestType = "ordDiscover" | "ordFetchCard";

interface HostResult {
  type: "ordResult";
  requestId: string;
  ok: boolean;
  data?: unknown;
  error?: { name: string; message: string };
}

let counter = 0;

function abortError(): Error {
  const err = new Error("Request cancelled");
  err.name = "AbortError";
  return err;
}

/**
 * Asks the extension host to run a request and resolves with its result.
 * Aborting the signal rejects with an AbortError and cancels the request in the host.
 */
export function hostRequest<T>(
  type: HostRequestType,
  payload: { url: string; headers: Record<string, string> },
  signal: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    const requestId = `${type}-${Date.now()}-${++counter}`;

    const onMessage = (event: MessageEvent) => {
      const result = event.data as HostResult | undefined;
      if (result?.type !== "ordResult" || result.requestId !== requestId) return;
      cleanup();
      if (result.ok) {
        resolve(result.data as T);
      } else {
        const err = new Error(result.error?.message ?? "Request failed");
        err.name = result.error?.name ?? "Error";
        reject(err);
      }
    };
    const onAbort = () => {
      cleanup();
      vscode.postMessage({ type: "ordCancel", requestId });
      reject(abortError());
    };
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      signal.removeEventListener("abort", onAbort);
    };

    window.addEventListener("message", onMessage);
    signal.addEventListener("abort", onAbort);
    vscode.postMessage({ type, requestId, ...payload });
  });
}
