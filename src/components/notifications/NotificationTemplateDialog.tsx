import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import HashtagPicker, { Hashtag } from './HashtagPicker';

export interface TemplateForm {
  name: string;
  content: string;
  description: string;
  is_active: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  form: TemplateForm;
  setForm: (updater: (f: TemplateForm) => TemplateForm) => void;
  hashtags: Hashtag[];
  isEditing: boolean;
  saving: boolean;
  onSave: () => void;
}

export const renderPreview = (content: string, hashtags: Hashtag[]) => {
  let result = content;
  hashtags.forEach((h) => {
    result = result.split(h.tag).join(h.example);
  });
  return result;
};

const NotificationTemplateDialog = ({
  open,
  onOpenChange,
  form,
  setForm,
  hashtags,
  isEditing,
  saving,
  onSave,
}: Props) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertTag = (tag: string) => {
    const el = textareaRef.current;
    if (!el) {
      setForm((f) => ({ ...f, content: `${f.content}${tag}` }));
      return;
    }
    const start = el.selectionStart ?? form.content.length;
    const end = el.selectionEnd ?? form.content.length;
    const next = form.content.slice(0, start) + tag + form.content.slice(end);
    setForm((f) => ({ ...f, content: next }));
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + tag.length;
      el.setSelectionRange(pos, pos);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Редактировать уведомление' : 'Новое уведомление'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Название</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Например: Новый комментарий по заявке"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Текст уведомления</Label>
            <Textarea
              ref={textareaRef}
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder="По заявке #номер_заявки новый комментарий: #последний_комментарий"
              rows={4}
            />
          </div>

          <HashtagPicker hashtags={hashtags} onPick={insertTag} />

          {form.content.trim() && (
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <Icon name="Eye" size={13} />
                Как увидит сотрудник
              </p>
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {renderPreview(form.content, hashtags)}
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Описание (необязательно)</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Когда используется это уведомление"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="font-medium">Активен</Label>
              <p className="text-xs text-muted-foreground">Неактивные шаблоны не используются</p>
            </div>
            <Switch
              checked={form.is_active}
              onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Отмена
          </Button>
          <Button onClick={onSave} disabled={saving} className="gap-2">
            <Icon name={saving ? 'Loader2' : 'Check'} size={16} className={saving ? 'animate-spin' : ''} />
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationTemplateDialog;
