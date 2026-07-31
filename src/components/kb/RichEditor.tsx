import { useEditor, EditorContent, Editor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Link } from '@tiptap/extension-link';
import { Image } from '@tiptap/extension-image';
import { Placeholder } from '@tiptap/extension-placeholder';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { TextAlign } from '@tiptap/extension-text-align';
import { Underline } from '@tiptap/extension-underline';
import { Highlight } from '@tiptap/extension-highlight';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';
import func2url from '../../../backend/func2url.json';

const UPLOAD_FILE_URL = (func2url as Record<string, string>)['upload-file'];

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res((reader.result as string).split(',')[1] || '');
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });

interface Props {
  value: string;
  onChange: (html: string, json: object) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
}

const ToolbarButton = ({ active, onClick, icon, label }: { active?: boolean; onClick: () => void; icon: string; label: string }) => (
  <Button
    type="button"
    size="sm"
    variant={active ? 'default' : 'ghost'}
    className="h-8 w-8 p-0"
    onClick={onClick}
    title={label}
  >
    <Icon name={icon} size={14} />
  </Button>
);

const Toolbar = ({ editor }: { editor: Editor | null }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !editor) return;
    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const resp = await fetch(UPLOAD_FILE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: base64, filename: file.name, folder: 'uploads/kb' }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.cdn_url) throw new Error(data.error || 'Ошибка загрузки');
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (IMAGE_EXT.includes(ext)) {
        editor.chain().focus().setImage({ src: data.cdn_url }).run();
      } else {
        editor
          .chain()
          .focus()
          .insertContent(
            `<a href="${data.cdn_url}" target="_blank" rel="noopener" class="text-primary underline">📎 ${data.filename || file.name}</a>&nbsp;`,
          )
          .run();
      }
    } catch (err) {
      window.alert('Не удалось загрузить файл: ' + (err instanceof Error ? err.message : 'ошибка'));
    } finally {
      setUploading(false);
    }
  };

  if (!editor) return null;
  return (
    <div className="flex flex-wrap gap-1 p-2 border-b border-border bg-muted/30 sticky top-0 z-10">
      <ToolbarButton
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
        icon="Bold"
        label="Жирный"
      />
      <ToolbarButton
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        icon="Italic"
        label="Курсив"
      />
      <ToolbarButton
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        icon="Underline"
        label="Подчёркнутый"
      />
      <ToolbarButton
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        icon="Strikethrough"
        label="Зачёркнутый"
      />
      <ToolbarButton
        active={editor.isActive('highlight')}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        icon="Highlighter"
        label="Выделение"
      />
      <div className="w-px h-6 bg-border mx-1 my-1" />
      <ToolbarButton
        active={editor.isActive('heading', { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        icon="Heading1"
        label="Заголовок 1"
      />
      <ToolbarButton
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        icon="Heading2"
        label="Заголовок 2"
      />
      <ToolbarButton
        active={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        icon="Heading3"
        label="Заголовок 3"
      />
      <div className="w-px h-6 bg-border mx-1 my-1" />
      <ToolbarButton
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        icon="List"
        label="Маркированный список"
      />
      <ToolbarButton
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        icon="ListOrdered"
        label="Нумерованный список"
      />
      <ToolbarButton
        active={editor.isActive('taskList')}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        icon="ListChecks"
        label="Чек-лист"
      />
      <ToolbarButton
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        icon="Quote"
        label="Цитата"
      />
      <ToolbarButton
        active={editor.isActive('codeBlock')}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        icon="Code"
        label="Код"
      />
      <div className="w-px h-6 bg-border mx-1 my-1" />
      <ToolbarButton
        active={editor.isActive({ textAlign: 'left' })}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        icon="AlignLeft"
        label="По левому"
      />
      <ToolbarButton
        active={editor.isActive({ textAlign: 'center' })}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        icon="AlignCenter"
        label="По центру"
      />
      <ToolbarButton
        active={editor.isActive({ textAlign: 'right' })}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        icon="AlignRight"
        label="По правому"
      />
      <div className="w-px h-6 bg-border mx-1 my-1" />
      <ToolbarButton
        onClick={() => {
          const url = window.prompt('Ссылка:');
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }}
        icon="Link"
        label="Ссылка"
        active={editor.isActive('link')}
      />
      <ToolbarButton
        onClick={() => {
          const url = window.prompt('URL картинки:');
          if (url) editor.chain().focus().setImage({ src: url }).run();
        }}
        icon="Image"
        label="Картинка"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        icon="Table"
        label="Таблица"
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFilePick}
      />
      <ToolbarButton
        onClick={() => fileInputRef.current?.click()}
        icon={uploading ? 'Loader2' : 'Paperclip'}
        label={uploading ? 'Загрузка…' : 'Прикрепить файл'}
      />
      <div className="w-px h-6 bg-border mx-1 my-1" />
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        icon="Undo2"
        label="Отменить"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        icon="Redo2"
        label="Повторить"
      />
    </div>
  );
};

const RichEditor = ({ value, onChange, placeholder, className, editable = true }: Props) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: { HTMLAttributes: { class: 'kb-code' } } }),
      Underline,
      Highlight.configure({ multicolor: false }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { class: 'text-primary underline' } }),
      Image.configure({ HTMLAttributes: { class: 'rounded-lg max-w-full' } }),
      Placeholder.configure({ placeholder: placeholder || 'Начните писать статью...' }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value || '',
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML(), editor.getJSON());
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '');
    }
     
  }, [value, editor]);

  return (
    <div className={cn('border border-border rounded-lg overflow-hidden bg-background', className)}>
      {editable && <Toolbar editor={editor} />}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none p-4 min-h-[300px] focus:outline-none kb-content"
      />
    </div>
  );
};

export default RichEditor;