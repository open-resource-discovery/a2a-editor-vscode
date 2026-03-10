interface FileSectionProps {
  activePath: string | null;
  loading: boolean;
}

export function FileSection({ activePath, loading }: FileSectionProps) {
  if (!loading && activePath) {
    return null;
  }

  return (
    <div className="sw-field">
      <div className={`sw-file-info ${loading ? "sw-loading" : ""}`}>
        {loading ? <span>Loading...</span> : <span className="sw-placeholder">No agent card file open</span>}
      </div>
    </div>
  );
}
