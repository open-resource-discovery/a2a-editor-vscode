import { useEffect, useState } from "react";
import { vscode } from "./vscodeApi";
import { useMessages } from "./useMessages";
import type { McpStatus } from "./types";

// MCP server settings, rendered inside the existing main webview as a
// collapsible block above the "Agent Card Source" section. Background is
// transparent (uses VS Code variables) so it blends with the sidebar.
//
// Talks to the extension host via:
//   webview → host:  { type: "mcpReady" }
//                    { type: "mcpSave", enabled, host, port }
//   host → webview:  { type: "mcpStatus", status: McpStatus }

const DEFAULTS = { enabled: true, host: "127.0.0.1", port: 39627 };

export function McpSection() {
  const [collapsed, setCollapsed] = useState(true); // default collapsed
  const [status, setStatus] = useState<McpStatus | null>(null);
  const [enabled, setEnabled] = useState(DEFAULTS.enabled);
  const [host, setHost] = useState(DEFAULTS.host);
  const [port, setPort] = useState(String(DEFAULTS.port));
  const [savedFlash, setSavedFlash] = useState(false);
  const [copiedFlash, setCopiedFlash] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);

  // Tell the host we're mounted; it replies with the current mcpStatus.
  useEffect(() => {
    vscode.postMessage({ type: "mcpReady" });
  }, []);

  useMessages((msg) => {
    if (msg.type === "mcpStatus") {
      setStatus(msg.status);
      // Sync form values to whatever the host says — but only for fields
      // the user isn't actively editing (avoid stomping mid-typing).
      // Heuristic: only refresh from host if no save is pending.
      if (!pendingSave) {
        setEnabled(msg.status.enabled);
        setHost(msg.status.host);
        setPort(String(msg.status.port));
      } else {
        setPendingSave(false);
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1500);
      }
    }
  });

  const handleSave = () => {
    const portNum = clampPort(Number(port));
    setPort(String(portNum));
    setPendingSave(true);
    vscode.postMessage({
      type: "mcpSave",
      enabled,
      host: host.trim() || DEFAULTS.host,
      port: portNum,
    });
  };

  const handleReset = () => {
    setEnabled(DEFAULTS.enabled);
    setHost(DEFAULTS.host);
    setPort(String(DEFAULTS.port));
  };

  const handleCopy = async () => {
    const url = status?.url;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore — clipboard unavailable
    }
    setCopiedFlash(true);
    setTimeout(() => setCopiedFlash(false), 1500);
  };

  const statusBadge = (() => {
    if (status?.error) return <span className="mcp-badge mcp-badge-error">error</span>;
    if (status?.running) return <span className="mcp-badge mcp-badge-running">running</span>;
    if (status?.enabled === false) return <span className="mcp-badge mcp-badge-stopped">disabled</span>;
    return <span className="mcp-badge mcp-badge-stopped">stopped</span>;
  })();

  return (
    <div className="mcp-card">
      <button type="button" className="sw-header" onClick={() => setCollapsed((c) => !c)} aria-expanded={!collapsed}>
        <span className={`sw-chevron${collapsed ? " sw-collapsed" : ""}`} aria-hidden="true">
          {"▾"}
        </span>
        <span className="sw-title">MCP Server</span>
        <span className="mcp-header-spacer" />
        {statusBadge}
      </button>
      {!collapsed && (
        <div className="sw-body mcp-body">
          <p className="mcp-lede">Lets external tools (Claude Code, Cursor, Cline) use the A2A tools.</p>

          <label className="mcp-toggle-row">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            <span>Enable MCP server</span>
          </label>

          <div className="sw-field">
            <label className="sw-label" htmlFor="mcp-host">
              Host
            </label>
            <input
              id="mcp-host"
              className="sw-input"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={host}
              onChange={(e) => setHost(e.target.value)}
            />
          </div>

          <div className="sw-field">
            <label className="sw-label" htmlFor="mcp-port">
              Port
            </label>
            <input
              id="mcp-port"
              className="sw-input"
              type="number"
              min={1}
              max={65535}
              value={port}
              onChange={(e) => setPort(e.target.value)}
            />
          </div>

          <div className="mcp-actions">
            <button type="button" className="mcp-btn mcp-btn-primary" onClick={handleSave}>
              {savedFlash ? "Saved ✓" : "Save"}
            </button>
            <button type="button" className="mcp-btn" onClick={handleReset}>
              Reset
            </button>
          </div>

          <div className="mcp-url-block">
            <div className="sw-label">Server address</div>
            <div className="mcp-url-row">
              <input
                className="sw-input mcp-url-input"
                type="text"
                readOnly
                value={status?.url ?? ""}
                placeholder="(server not running)"
                onFocus={(e) => e.currentTarget.select()}
              />
              <button type="button" className="mcp-btn" onClick={handleCopy} disabled={!status?.url}>
                {copiedFlash ? "Copied ✓" : "Copy"}
              </button>
            </div>
          </div>

          {status?.error && <div className="mcp-error">{status.error}</div>}
        </div>
      )}
    </div>
  );
}

function clampPort(n: number): number {
  if (!Number.isFinite(n)) return DEFAULTS.port;
  const i = Math.floor(n);
  if (i < 1 || i > 65535) return DEFAULTS.port;
  return i;
}
