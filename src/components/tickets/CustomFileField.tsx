import { useRef } from 'react';
import Icon from '@/components/ui/icon';
import { useFileUploader } from '@/hooks/useFileUploader';

interface CustomFileFieldProps {
  value: string;
  onChange: (url: string) => void;
  isRequired?: boolean;
  accept?: string;
}

const CustomFileField = ({ value, onChange, accept }: CustomFileFieldProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { attachments, isUploading, upload, remove } = useFileUploader('uploads/photos');

  const handlePick = () => inputRef.current?.click();

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const result = await upload(files[0]);
    if (result?.url) {
      onChange(result.url);
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const current = attachments[attachments.length - 1];
  const isImage = /\.(jpe?g|png|gif|webp|svg)$/i.test(value);

  const handleClear = () => {
    if (current) remove(current.id);
    onChange('');
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={accept || 'image/*'}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {!value && !isUploading && (
        <button
          type="button"
          onClick={handlePick}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
        >
          <Icon name="Upload" size={18} />
          Прикрепить файл
        </button>
      )}

      {isUploading && current && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-3 py-3">
          <Icon name="Loader2" size={18} className="animate-spin text-primary" />
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm text-foreground">{current.filename}</p>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${current.progress}%` }} />
            </div>
          </div>
        </div>
      )}

      {value && !isUploading && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-3 py-2.5">
          {isImage ? (
            <img src={value} alt="Загруженный файл" className="h-12 w-12 flex-shrink-0 rounded-md object-cover" />
          ) : (
            <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon name="File" size={20} />
            </span>
          )}
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{current?.filename || 'Файл загружен'}</p>
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              Открыть
            </a>
          </div>
          <button
            type="button"
            onClick={handlePick}
            className="flex-shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Заменить"
          >
            <Icon name="RefreshCw" size={16} />
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="flex-shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            title="Удалить"
          >
            <Icon name="X" size={16} />
          </button>
        </div>
      )}

      {current?.status === 'error' && (
        <p className="text-xs text-destructive">{current.errorMessage || 'Не удалось загрузить файл'}</p>
      )}
    </div>
  );
};

export default CustomFileField;