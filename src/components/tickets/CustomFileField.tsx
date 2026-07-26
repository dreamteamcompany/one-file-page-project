import { useRef, useState } from 'react';
import Icon from '@/components/ui/icon';
import { useFileUploader } from '@/hooks/useFileUploader';
import { useToast } from '@/hooks/use-toast';

interface CustomFileFieldProps {
  value: string;
  onChange: (url: string) => void;
  isRequired?: boolean;
  accept?: string;
}

const CustomFileField = ({ value, onChange, accept }: CustomFileFieldProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { attachments, isUploading, upload, remove } = useFileUploader('uploads/photos');
  const { toast } = useToast();
  const [isDragOver, setIsDragOver] = useState(false);

  const acceptsImageOnly = (accept || 'image/*').includes('image');

  const handlePick = () => inputRef.current?.click();

  const uploadFile = async (file: File) => {
    const result = await upload(file);
    if (result?.url) {
      onChange(result.url);
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    await uploadFile(files[0]);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isUploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) await uploadFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const pasteFromClipboard = async () => {
    if (isUploading) return;
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'));
        if (type) {
          const blob = await item.getType(type);
          const ext = type.split('/')[1] || 'png';
          await uploadFile(new File([blob], `clipboard.${ext}`, { type }));
          return;
        }
      }
      toast({
        title: 'В буфере обмена нет изображения',
        description: 'Скопируйте картинку и попробуйте снова',
        variant: 'destructive',
      });
    } catch {
      toast({
        title: 'Не удалось получить доступ к буферу обмена',
        description: 'Разрешите доступ или вставьте фото сочетанием Ctrl+V',
        variant: 'destructive',
      });
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    if (isUploading) return;
    const file = Array.from(e.clipboardData.items)
      .find((it) => it.type.startsWith('image/'))
      ?.getAsFile();
    if (file) {
      e.preventDefault();
      await uploadFile(file);
    }
  };

  const current = attachments[attachments.length - 1];
  const isImage = /\.(jpe?g|png|gif|webp|svg)$/i.test(value);

  const handleClear = () => {
    if (current) remove(current.id);
    onChange('');
  };

  return (
    <div
      className="group space-y-2"
      tabIndex={-1}
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept || 'image/*'}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {!value && !isUploading && (
        <div className="relative">
          <button
            type="button"
            onClick={handlePick}
            className={`w-full flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-6 text-sm transition-colors ${
              isDragOver
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground'
            }`}
          >
            <Icon name={isDragOver ? 'ImageDown' : 'Upload'} size={18} />
            {isDragOver ? 'Отпустите файл' : 'Прикрепить или перетащить файл'}
          </button>

          {acceptsImageOnly && (
            <button
              type="button"
              onClick={pasteFromClipboard}
              title="Вставить фото из буфера обмена"
              className="absolute right-2 top-2 hidden items-center gap-1.5 rounded-lg border border-border bg-background/90 px-2.5 py-1.5 text-xs text-foreground shadow-sm transition-colors hover:bg-muted group-hover:flex"
            >
              <Icon name="ClipboardPaste" size={14} />
              Вставить фото
            </button>
          )}
        </div>
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