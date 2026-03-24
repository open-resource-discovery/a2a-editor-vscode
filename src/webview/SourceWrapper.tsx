import { useState, useRef, useCallback, useEffect } from "react";
import { SourceToggle } from "./components/SourceToggle";
import { UrlSection } from "./components/UrlSection";
import { FileSection } from "./components/FileSection";
import { ErrorDisplay } from "./components/ErrorDisplay";
import { useMessages } from "./useMessages";
import { vscode } from "./vscodeApi";
import type { A2APlaygroundInstance } from "./types";

interface SourceWrapperProps {
  instanceRef: React.RefObject<A2APlaygroundInstance | null>;
  setAgentCardContent: (content: string) => void;
}

function markConnected() {
  if (window.useConnectionStore) {
    const store = window.useConnectionStore.getState();
    if (!store.url) return;
    window.useConnectionStore.setState({ connectionStatus: "connected" });
  }
}

function isLikelyAgentCard(parsed: Record<string, unknown>): boolean {
  if (!parsed || typeof parsed !== "object") return false;
  const markers = ["name", "url", "skills", "description", "provider"];
  let count = 0;
  for (const key of markers) {
    if (key in parsed) count++;
  }
  return count >= 2;
}

export function SourceWrapper({ instanceRef, setAgentCardContent }: SourceWrapperProps) {
  const initMode = window.__INIT_OPTIONS__?.mode;
  const [collapsed, setCollapsed] = useState(false);
  const [sourceType, setSourceType] = useState<"url" | "file">(initMode === "file-editor" ? "file" : "url");
  const [error, setError] = useState<string | null>(null);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [externalUrl, setExternalUrl] = useState<string | null>(null);

  const activeContentRef = useRef<string | null>(null);
  const savedStateRef = useRef<{ url: Record<string, unknown> | null; file: Record<string, unknown> | null }>({
    url: null,
    file: null,
  });
  const userPickedRef = useRef(false);
  const hasLoadedUrlRef = useRef(false);
  const sourceTypeRef = useRef(sourceType);
  useEffect(() => {
    sourceTypeRef.current = sourceType;
  }, [sourceType]);

  /** Shared helper: load agent card content, mark connected, and save state snapshot */
  const loadCard = useCallback(
    (content: string, source: "url" | "file", urlOrPath: string) => {
      setAgentCardContent(content);
      if (window.useConnectionStore) {
        const store = window.useConnectionStore.getState();
        if (!store.url) {
          store.setUrl(urlOrPath);
        }
      }
      markConnected();
      if (instanceRef.current) {
        savedStateRef.current[source] = instanceRef.current.saveState();
      }
    },
    [instanceRef, setAgentCardContent],
  );

  const handleToggle = useCallback(
    (newSource: "url" | "file") => {
      if (newSource === sourceTypeRef.current) return;

      userPickedRef.current = true;

      // Save current mode's full state
      if (instanceRef.current) {
        savedStateRef.current[sourceTypeRef.current] = instanceRef.current.saveState();
      }

      setSourceType(newSource);
      sourceTypeRef.current = newSource;
      setError(null);

      // Restore target mode's saved state
      if (newSource === "file") {
        if (savedStateRef.current.file) {
          instanceRef.current?.restoreState(savedStateRef.current.file);
        } else {
          setAgentCardContent("");
        }
        setFileLoading(true);
        vscode.postMessage({ type: "getActiveFile" });
      } else if (newSource === "url") {
        if (savedStateRef.current.url) {
          instanceRef.current?.restoreState(savedStateRef.current.url);
        } else {
          setAgentCardContent("");
        }
      }
    },
    [instanceRef, setAgentCardContent],
  );

  const handleUrlConnect = useCallback(
    (json: string, url: string) => {
      hasLoadedUrlRef.current = true;
      loadCard(json, "url", url);
    },
    [loadCard],
  );

  // Listen for setActiveFile messages
  useMessages(
    useCallback(
      (msg) => {
        if (msg.type === "setConnection") {
          setExternalUrl(msg.url);
          hasLoadedUrlRef.current = true;
          if (sourceTypeRef.current !== "url") {
            setSourceType("url");
            sourceTypeRef.current = "url";
          }
          return;
        }

        if (msg.type !== "setActiveFile") return;

        const path = msg.path || null;
        const content = msg.content || null;
        setActivePath(path);
        setFileLoading(false);

        if (!content) {
          activeContentRef.current = null;
          return;
        }

        let isValidJson = false;
        let isAgentCard = false;
        try {
          const parsed = JSON.parse(content);
          isValidJson = true;
          isAgentCard = isLikelyAgentCard(parsed);
        } catch {
          // not valid JSON
        }

        const contentChanged = content !== activeContentRef.current;
        activeContentRef.current = content;

        if (sourceTypeRef.current === "file") {
          setError(null);
          if (isValidJson && isAgentCard) {
            if (contentChanged) {
              loadCard(content, "file", path || "file");
            }
          } else if (isValidJson) {
            setError("Not a valid A2A agent card");
          } else {
            setError("Invalid JSON in " + (path || "file"));
          }
        } else if (isAgentCard && !hasLoadedUrlRef.current && !userPickedRef.current) {
          // Auto-switch to file mode on startup
          setSourceType("file");
          sourceTypeRef.current = "file";
          setError(null);
          loadCard(content, "file", path || "file");
        }
      },
      [loadCard],
    ),
  );

  return (
    <div id="source-wrapper-card">
      <button className="sw-header" aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>
        <span className={`sw-chevron ${collapsed ? "sw-collapsed" : ""}`}>&#9662;</span>
        <span className="sw-title">Agent Card Source</span>
      </button>
      {!collapsed && (
        <div className="sw-body">
          <SourceToggle value={sourceType} onChange={handleToggle} />
          {sourceType === "url" ? (
            <UrlSection
              onConnect={handleUrlConnect}
              onError={setError}
              clearError={() => setError(null)}
              externalUrl={externalUrl}
            />
          ) : (
            <FileSection activePath={activePath} loading={fileLoading} />
          )}
          {error && <ErrorDisplay message={error} />}
        </div>
      )}
    </div>
  );
}
