// packages/web/src/components/AttachmentUploader.tsx
import { useRef, useState } from 'react';

interface Props {
  files:     File[];
  onChange:  (files: File[]) => void;
  disabled?: boolean;
  compact?:  boolean;
}

export default function AttachmentUploader({ files, onChange, disabled, compact }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const add = (list: FileList | File[]) => {
    const next = [...files];
    for (const f of Array.from(list)) {
      if (f.size > 8 * 1024 * 1024) continue;
      next.push(f);
    }
    onChange(next);
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => {
        e.preventDefault();
        setDrag(false);
        if (!disabled) add(e.dataTransfer.files);
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      className="form-input"
      style={{
        padding:   compact ? '8px 10px' : 12,
        cursor:    disabled ? 'not-allowed' : 'pointer',
        opacity:   disabled ? 0.6 : 1,
        border:    drag ? '2px dashed var(--red)' : undefined,
        background: drag ? 'var(--bg)' : undefined,
        fontSize:  12,
        color:     'var(--text-secondary)',
        textAlign: 'center',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
        onChange={e => {
          if (e.target.files) add(e.target.files);
          e.target.value = '';
        }}
        disabled={disabled}
      />
      {files.length ? (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', textAlign: 'left' }}>
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: '0 4px', fontSize: 11, flexShrink: 0 }}
                onClick={ev => {
                  ev.stopPropagation();
                  onChange(files.filter((_, j) => j !== i));
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <span>Drop files or tap to attach (images, PDF, docs — max 8MB each)</span>
      )}
    </div>
  );
}
