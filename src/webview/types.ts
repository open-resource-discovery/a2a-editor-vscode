export interface ComplianceDetail {
  rule: string;
  passed: boolean;
  message: string;
}

export interface SendMessageResult {
  response: string;
  compliant: boolean;
  complianceDetails: ComplianceDetail[];
}

// Globals exposed by the vendor bundle (a2a-playground.js)
export interface A2APlaygroundInstance {
  setAgentCard(json: string): void;
  getAgentCard(): string;
  getParsedCard(): unknown;
  connect(url: string): Promise<unknown>;
  disconnect(): void;
  validate(): Promise<unknown[]>;
  setActiveTab(tab: "overview" | "chat" | "validation"): void;
  setTheme(theme: "light" | "dark" | "system"): void;
  sendMessage(text: string): Promise<SendMessageResult>;
  destroy(): void;
  saveState(): Record<string, unknown>;
  restoreState(snapshot: Record<string, unknown>): void;
}

export interface A2APlaygroundAPI {
  init(options: Record<string, unknown>): A2APlaygroundInstance;
  destroy(container: HTMLElement | string): void;
}

export interface InitOptions {
  mode: "file-editor" | "standalone" | "sidebar";
  showEditor: boolean;
  showChat: boolean;
  showRawHttp: boolean;
  showValidation: boolean;
  showSettings: boolean;
  showConnection: boolean;
  readOnly: boolean;
  forceDesktop: boolean;
  defaultTab: string;
}

export interface McpStatus {
  enabled: boolean;
  running: boolean;
  url: string | null;
  host: string;
  port: number;
  error: string | null;
}

// Extension host → webview messages
export type InboundMessage =
  | { type: "setContent"; content: string }
  | { type: "setTheme"; theme: "light" | "dark" }
  | { type: "toggleEditor"; show: boolean }
  | { type: "setActiveFile"; path: string | null; content: string | null }
  | { type: "setActiveTab"; tab: "overview" | "chat" | "validation" }
  | { type: "sendChatMessage"; text: string; requestId: string }
  | { type: "setConnection"; url: string; messagingUrl: string }
  | { type: "mcpStatus"; status: McpStatus };

// webview → extension host messages
export type OutboundMessage =
  | { type: "ready" }
  | { type: "contentChanged"; content: string }
  | { type: "error"; message: string }
  | { type: "getActiveFile" }
  | { type: "openInPanel" }
  | {
      type: "chatMessageSent";
      requestId: string;
      error?: string;
      response?: string;
      compliant?: boolean;
      complianceDetails?: ComplianceDetail[];
    }
  | { type: "mcpReady" }
  | { type: "mcpSave"; enabled: boolean; host: string; port: number };

declare global {
  interface Window {
    A2APlayground: A2APlaygroundAPI;
    useConnectionStore: {
      getState(): {
        url: string;
        setUrl(url: string): void;
        connectionStatus: string;
      };
      setState(partial: Record<string, unknown>): void;
    };
    __INIT_OPTIONS__: InitOptions;
  }
}
