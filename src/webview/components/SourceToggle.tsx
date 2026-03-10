interface SourceToggleProps {
  value: "url" | "file";
  onChange: (source: "url" | "file") => void;
}

export function SourceToggle({ value, onChange }: SourceToggleProps) {
  return (
    <div className="sw-field">
      <label className="sw-label">Source Type</label>
      <div className="sw-toggle" role="group">
        <button
          className={`sw-toggle-btn ${value === "url" ? "sw-active" : ""}`}
          aria-pressed={value === "url"}
          onClick={() => onChange("url")}>
          URL
        </button>
        <button
          className={`sw-toggle-btn ${value === "file" ? "sw-active" : ""}`}
          aria-pressed={value === "file"}
          onClick={() => onChange("file")}>
          Current File
        </button>
      </div>
    </div>
  );
}
