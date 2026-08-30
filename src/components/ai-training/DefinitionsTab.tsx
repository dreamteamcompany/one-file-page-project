import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { apiFetch } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';
import { FN } from '@/config/backend';

const AI_TRAINING_URL = FN.AI_TRAINING;

export interface Definition {
  id: number;
  term: string;
  description: string;
  created_at: string;
  updated_at: string;
}

interface DefinitionsTabProps {
  onReload?: () => void;
}

const DefinitionsTab = ({ onReload }: DefinitionsTabProps) => {
  const { toast } = useToast();

  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<Definition | null>(null);
  const [form, setForm] = useState({ term: '', description: '' });

  const loadDefinitions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(AI_TRAINING_URL + '?endpoint=definitions');
      if (res.ok) setDefinitions(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDefinitions();
  }, [loadDefinitions]);

  const openDialog = (def?: Definition) => {
    if (def) {
      setEditing(def);
      setForm({ term: def.term, description: def.description });
    } else {
      setEditing(null);
      setForm({ term: '', description: '' });
    }
    setDialog(true);
  };

  const save = async () => {
    if (!form.term.trim() || !form.description.trim()) {
      toast({ title: 'Заполните термин и описание', variant: 'destructive' });
      return;
    }

    const body = {
      ...(editing ? { id: editing.id } : {}),
      term: form.term.trim(),
      description: form.description.trim(),
    };

    const res = await apiFetch(AI_TRAINING_URL + '?endpoint=definitions', {
      method: editing ? 'PUT' : 'POST',
      body: JSON.stringify(body),
    });

    if (res.ok) {
      toast({ title: editing ? 'Определение обновлено' : 'Определение добавлено' });
      setDialog(false);
      loadDefinitions();
      onReload?.();
    } else {
      toast({ title: 'Ошибка сохранения', variant: 'destructive' });
    }
  };

  const remove = async (id: number) => {
    const res = await apiFetch(AI_TRAINING_URL + '?endpoint=definitions', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      toast({ title: 'Определение удалено' });
      loadDefinitions();
      onReload?.();
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Определения</CardTitle>
              <CardDescription className="text-xs mt-1">
                Расшифровка терминов вашей компании. AI учитывает их при разборе заявок. Например: «1С → есть 3 вида: МИС, БУХ, ЗУП»
              </CardDescription>
            </div>
            <Button size="sm" className="gap-2" onClick={() => openDialog()}>
              <Icon name="Plus" size={16} />
              Добавить
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Icon name="Loader2" size={24} className="animate-spin text-muted-foreground" />
            </div>
          ) : definitions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Icon name="BookMarked" size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Пока нет определений</p>
              <p className="text-xs mt-1">Добавьте термины, чтобы AI понимал вашу терминологию</p>
            </div>
          ) : (
            <div className="space-y-3">
              {definitions.map(def => (
                <div key={def.id} className="p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold mb-0.5">{def.term}</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{def.description}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDialog(def)} title="Редактировать" aria-label="Редактировать">
                        <Icon name="Pencil" size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(def.id)} title="Удалить" aria-label="Удалить">
                        <Icon name="Trash2" size={14} />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Редактировать определение' : 'Новое определение'}</DialogTitle>
            <DialogDescription>
              Термин и его расшифровка своими словами
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Термин *</Label>
              <Input
                value={form.term}
                onChange={e => setForm(prev => ({ ...prev, term: e.target.value }))}
                placeholder="1С"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Описание *</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Есть 3 вида 1С: МИС, БУХ и ЗУП (Зарплата и управление)"
                className="mt-1.5"
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Пишите как объясняли бы человеку. AI воспримет это как справку.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialog(false)}>Отмена</Button>
              <Button onClick={save}>
                {editing ? 'Сохранить' : 'Добавить'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DefinitionsTab;
