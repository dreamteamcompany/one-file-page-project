import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '@/components/layout/PageLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch, getApiUrl } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';
import { Hashtag } from '@/components/notifications/HashtagPicker';
import NotificationTemplateDialog, {
  TemplateForm,
  renderPreview,
} from '@/components/notifications/NotificationTemplateDialog';

const BASE_URL = `${getApiUrl('notification_templates')}?resource=notification_templates`;

interface NotificationTemplate {
  id: number;
  name: string;
  content: string;
  description: string | null;
  is_active: boolean;
  created_by: number | null;
  author_name?: string | null;
  created_at: string;
  updated_at: string;
}

const EMPTY: TemplateForm = { name: '', content: '', description: '', is_active: true };

const NotificationSettings = () => {
  const { hasSystemRole } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [canEdit, setCanEdit] = useState(hasSystemRole('admin'));
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [hashtags, setHashtags] = useState<Hashtag[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<NotificationTemplate | null>(null);
  const [form, setForm] = useState<TemplateForm>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async (q = '') => {
    setLoading(true);
    try {
      const url = q ? `${BASE_URL}&q=${encodeURIComponent(q)}` : BASE_URL;
      const res = await apiFetch(url);
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
        setHashtags(data.hashtags || []);
        setCanEdit(!!data.can_edit);
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: err.error || 'Не удалось загрузить уведомления', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Ошибка соединения', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => load(search), search ? 300 : 0);
    return () => clearTimeout(t);
  }, [search]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setDialogOpen(true);
  };

  const openEdit = (t: NotificationTemplate) => {
    setEditing(t);
    setForm({
      name: t.name,
      content: t.content,
      description: t.description || '',
      is_active: t.is_active,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Укажите название', variant: 'destructive' });
      return;
    }
    if (!form.content.trim()) {
      toast({ title: 'Укажите текст уведомления', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch(editing ? `${BASE_URL}&id=${editing.id}` : BASE_URL, {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: err.error || 'Ошибка сохранения', variant: 'destructive' });
        return;
      }
      toast({ title: editing ? 'Уведомление обновлено' : 'Уведомление создано' });
      setDialogOpen(false);
      await load(search);
    } catch {
      toast({ title: 'Ошибка соединения', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t: NotificationTemplate) => {
    if (!confirm(`Удалить уведомление «${t.name}»?`)) return;
    const res = await apiFetch(`${BASE_URL}&id=${t.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast({ title: 'Уведомление удалено' });
      await load(search);
    } else {
      const err = await res.json().catch(() => ({}));
      toast({ title: err.error || 'Ошибка удаления', variant: 'destructive' });
    }
  };

  return (
    <PageLayout>
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/settings')} className="gap-2">
            <Icon name="ArrowLeft" size={16} />
            Назад
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Icon name="Bell" size={26} />
              Настройки уведомлений
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Тексты уведомлений с подстановкой данных заявки через хэштеги
            </p>
          </div>
        </div>
        {canEdit && (
          <Button onClick={openCreate} className="gap-2">
            <Icon name="Plus" size={16} />
            Новое уведомление
          </Button>
        )}
      </header>

      <div className="relative mb-4">
        <Icon
          name="Search"
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
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
            <Icon name="BellOff" size={48} className="mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground mb-4">Уведомлений пока нет</p>
            {canEdit && (
              <Button onClick={openCreate} variant="outline" className="gap-2">
                <Icon name="Plus" size={16} />
                Создать первое уведомление
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <Card key={t.id} className={t.is_active ? '' : 'opacity-60'}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-foreground">{t.name}</h3>
                      {!t.is_active && (
                        <Badge variant="outline" className="text-xs font-normal">
                          Отключено
                        </Badge>
                      )}
                    </div>
                    {t.description && (
                      <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                    )}
                    <p className="text-sm text-foreground/80 mt-2 whitespace-pre-wrap break-words">
                      {t.content}
                    </p>
                    {hashtags.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap break-words">
                        Пример: {renderPreview(t.content, hashtags)}
                      </p>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(t)} title="Редактировать">
                        <Icon name="Pencil" size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(t)}
                        title="Удалить"
                        className="text-red-500 hover:text-red-500"
                      >
                        <Icon name="Trash2" size={16} />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NotificationTemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        form={form}
        setForm={setForm}
        hashtags={hashtags}
        isEditing={!!editing}
        saving={saving}
        onSave={save}
      />
    </PageLayout>
  );
};

export default NotificationSettings;