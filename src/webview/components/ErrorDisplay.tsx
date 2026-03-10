interface ErrorDisplayProps {
  message: string;
}

export function ErrorDisplay({ message }: ErrorDisplayProps) {
  return (
    <div className="sw-error" role="alert">
      {message}
    </div>
  );
}
