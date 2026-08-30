import { useEffect, useState } from 'react';
import PageLayout from '@/components/layout/PageLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';
import { FN } from '@/config/backend';

const API_URL = FN.REPLY_TEMPLATES;

interface ReplyTemplate {
  id: number;
  title: string;
  content: string;
  is_shared: boolean;
  created_by: number | null;
  author_name?: string | null;
  created_at: string;
  updated_at: string;
}

type FormState = { title: string; content: string; is_shared: boolean };
const EMPTY: FormState = { title: '', content: '', is_shared: false };

const ReplyTemplates = () => {
  const { user, hasSystemRole } = useAuth();
  const { toast } = useToast();
  const isAdmin = hasSystemRole('admin');

  const [templates, setTemplates] = useState<ReplyTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ReplyTemplate | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async (q = '') => {
    setLoading(true);
    try {
      const url = q ? `${API_URL}?q=${encodeURIComponent(q)}` : API_URL;
      const res = await apiFetch(url);
      if (res.ok) setTemplates(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const t = setTimeout(() => load(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setDialogOpen(true);
  };

  const openEdit = (t: ReplyTemplate) => {
    setEditing(t);
    setForm({ title: t.title, content: t.content, is_shared: t.is_shared });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) { toast({ title: 'Укажите название', variant: 'destructive' }); return; }
    if (!form.content.trim()) { toast({ title: 'Укажите текст шаблона', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const res = await apiFetch(editing ? `${API_URL}?id=${editing.id}` : API_URL, {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: err.error || 'Ошибка сохранения', variant: 'destructive' });
        return;
      }
      toast({ title: editing ? 'Шаблон обновлён' : 'Шаблон создан' });
      setDialogOpen(false);
      await load(search);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t: ReplyTemplate) => {
    if (!confirm(`Удалить шаблон «${t.title}»?`)) return;
    const res = await apiFetch(`${API_URL}?id=${t.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast({ title: 'Шаблон удалён' });
      await load(search);
    } else {
      toast({ title: 'Ошибка удаления', variant: 'destructive' });
    }
  };

  const canEdit = (t: ReplyTemplate) => isAdmin || t.created_by === user?.id;

  const shared = templates.filter((t) => t.is_shared);
  const personal = templates.filter((t) => !t.is_shared);

  return (
    <PageLayout>
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Icon name="MessageSquare" size={26} />
            Шаблоны ответов
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Быстрые ответы для комментариев к заявкам
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Icon name="Plus" size={16} />
          Новый шаблон
        </Button>
      </header>

      <div className="relative mb-4">
        <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по названию или тексту..."
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Icon name="Loader2" size={28} className="animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Icon name="MessageSquare" size={48} className="mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground mb-4">Шаблонов пока нет</p>
            <Button onClick={openCreate} variant="outline" className="gap-2">
              <Icon name="Plus" size={16} />
              Создать первый шаблон
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {shared.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                <Icon name="Globe" size={14} />
                Общие ({shared.length})
              </h2>
              <div className="space-y-2">
                {shared.map((t) => (
                  <TemplateCard key={t.id} tmpl={t} canEdit={canEdit(t)} onEdit={openEdit} onDelete={remove} />
                ))}
              </div>
            </section>
          )}

          {personal.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                <Icon name="User" size={14} />
                Мои личные ({personal.length})
              </h2>
              <div className="space-y-2">
                {personal.map((t) => (
                  <TemplateCard key={t.id} tmpl={t} canEdit={canEdit(t)} onEdit={openEdit} onDelete={remove} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Редактировать шаблон' : 'Новый шаблон'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Название</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Например: Запрос доп. информации"
              />
            </div>
            <div>
              <Label>Текст шаблона</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                placeholder="Текст, который вставится в комментарий..."
                rows={5}
              />
            </div>
            {isAdmin && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="font-medium">Общий шаблон</Label>
                  <p className="text-xs text-muted-foreground">Виден и доступен всем исполнителям</p>
                </div>
                <Switch
                  checked={form.is_shared}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, is_shared: v }))}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Отмена</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Icon name="Loader2" size={14} className="mr-2 animate-spin" />}
              {editing ? 'Сохранить' : 'Создать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
};

const TemplateCard = ({
  tmpl,
  canEdit,
  onEdit,
  onDelete,
}: {
  tmpl: ReplyTemplate;
  canEdit: boolean;
  onEdit: (t: ReplyTemplate) => void;
  onDelete: (t: ReplyTemplate) => void;
}) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="font-medium text-sm">{tmpl.title}</p>
            {tmpl.is_shared && (
              <Badge variant="secondary" className="text-xs">
                <Icon name="Globe" size={10} className="mr-1" />
                Общий
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2 whitespace-pre-wrap">{tmpl.content}</p>
          {tmpl.author_name && (
            <p className="text-xs text-muted-foreground/60 mt-1">Автор: {tmpl.author_name}</p>
          )}
        </div>
        {canEdit && (
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="sm" onClick={() => onEdit(tmpl)}>
              <Icon name="Pencil" size={14} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => onDelete(tmpl)}
            >
              <Icon name="Trash2" size={14} />
            </Button>
          </div>
        )}
      </div>
    </CardContent>
  </Card>
);

export default ReplyTemplates;
