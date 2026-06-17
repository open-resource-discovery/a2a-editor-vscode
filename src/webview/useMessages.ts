import { useEffect } from "react";
import type { InboundMessage } from "./types";

const KNOWN_TYPES = new Set([
  "setContent",
  "setTheme",
  "toggleEditor",
  "setActiveFile",
  "setActiveTab",
  "sendChatMessage",
  "setConnection",
  "mcpStatus",
]);

export function useMessages(handler: (msg: InboundMessage) => void) {
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      const data = event.data;
      if (data && typeof data.type === "string" && KNOWN_TYPES.has(data.type)) {
        handler(data as InboundMessage);
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [handler]);
}
