export type SourceType = "url" | "ord" | "file";

const OPTIONS: Array<{ value: SourceType; label: string; title: string }> = [
  { value: "url", label: "URL", title: "Connect to an agent by URL" },
  { value: "ord", label: "ORD", title: "Discover agents through Open Resource Discovery" },
  { value: "file", label: "Current File", title: "Use the agent card open in the editor" },
];

interface SourceToggleProps {
  value: SourceType;
  onChange: (source: SourceType) => void;
}

export function SourceToggle({ value, onChange }: SourceToggleProps) {
  return (
    <div className="sw-field">
      <label className="sw-label">Source Type</label>
      <div className="sw-toggle" role="group">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            className={`sw-toggle-btn ${value === option.value ? "sw-active" : ""}`}
            aria-pressed={value === option.value}
            title={option.title}
            onClick={() => onChange(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
