import { useRef, useCallback, useEffect } from "react";
import { McpSection } from "./McpSection";
import { SourceWrapper } from "./SourceWrapper";
import { vscode } from "./vscodeApi";
import { useMessages } from "./useMessages";
import type { A2APlaygroundInstance } from "./types";
import "./SourceWrapper.css";

export function App() {
  const instanceRef = useRef<A2APlaygroundInstance | null>(null);
  const currentThemeRef = useRef("dark");
  const suppressCountRef = useRef(0);
  const lastExternalRef = useRef<string | null>(null);

  const initOptions = window.__INIT_OPTIONS__;

  const createPlayground = useCallback(
    (extraOpts?: Record<string, unknown>) => {
      if (instanceRef.current) {
        instanceRef.current.setAgentCard("");
        instanceRef.current.destroy();
      }
      instanceRef.current = window.A2APlayground.init({
        el: "#a2a-container",
        ...initOptions,
        theme: currentThemeRef.current,
        onAgentCardChange: (json: string) => {
          if (suppressCountRef.current > 0) return;
          if (json === lastExternalRef.current) return;
          vscode.postMessage({ type: "contentChanged", content: json });
        },
        onReady: () => vscode.postMessage({ type: "ready" }),
        onError: (err: Error) => vscode.postMessage({ type: "error", message: err.message || String(err) }),
        ...extraOpts,
      }) as A2APlaygroundInstance;
    },
    [initOptions],
  );

  // Init playground on mount
  useEffect(() => {
    createPlayground();
  }, [createPlayground]);

  const setAgentCardContent = useCallback((content: string) => {
    if (!instanceRef.current) return;
    lastExternalRef.current = content;
    suppressCountRef.current++;
    instanceRef.current.setAgentCard(content);
    requestAnimationFrame(() => {
      suppressCountRef.current--;
    });
  }, []);

  // Handle extension host messages (setContent, setTheme, toggleEditor)
  useMessages(
    useCallback(
      (msg) => {
        if (msg.type === "setContent") {
          lastExternalRef.current = msg.content;
          suppressCountRef.current++;
          instanceRef.current?.setAgentCard(msg.content);
          requestAnimationFrame(() => {
            suppressCountRef.current--;
          });
        } else if (msg.type === "setTheme") {
          currentThemeRef.current = msg.theme;
          instanceRef.current?.setTheme(msg.theme);
        } else if (msg.type === "toggleEditor") {
          const saved = instanceRef.current?.getAgentCard();
          createPlayground({
            showEditor: msg.show,
            agentCard: saved,
          });
        } else if (msg.type === "setActiveTab") {
          instanceRef.current?.setActiveTab(msg.tab);
        } else if (msg.type === "sendChatMessage") {
          const instance = instanceRef.current;
          if (instance) {
            instance
              .sendMessage(msg.text)
              .then((result) =>
                vscode.postMessage({
                  type: "chatMessageSent",
                  requestId: msg.requestId,
                  response: result.response,
                  compliant: result.compliant,
                  complianceDetails: result.complianceDetails,
                }),
              )
              .catch((err: unknown) =>
                vscode.postMessage({ type: "chatMessageSent", requestId: msg.requestId, error: String(err) }),
              );
          }
        } else if (msg.type === "setConnection") {
          if (window.useConnectionStore) {
            window.useConnectionStore.setState({
              url: msg.url,
              messagingUrl: msg.messagingUrl,
              connectionStatus: "connected",
            });
          }
        }
      },
      [createPlayground],
    ),
  );

  return (
    <div id="a2a-outer">
      <McpSection />
      <SourceWrapper instanceRef={instanceRef} setAgentCardContent={setAgentCardContent} />
      <div id="a2a-container" />
    </div>
  );
}
