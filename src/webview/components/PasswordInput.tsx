import { useState } from "react";

interface PasswordInputProps {
  id: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function PasswordInput({ id, placeholder, value, onChange, onKeyDown }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="sw-pw-wrapper">
      <input
        type={visible ? "text" : "password"}
        className="sw-input sw-secret"
        id={id}
        placeholder={placeholder}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        className="sw-pw-toggle"
        title={visible ? "Hide password" : "Show password"}
        aria-label={visible ? "Hide password" : "Show password"}
        onClick={(e) => {
          e.stopPropagation();
          setVisible(!visible);
        }}>
        {visible ? "\u25CF" : "\u25C9"}
      </button>
    </div>
  );
}
