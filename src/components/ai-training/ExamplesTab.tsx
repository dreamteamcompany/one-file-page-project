import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import { apiFetch } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';
import { FN } from '@/config/backend';

const AI_TRAINING_URL = FN.AI_TRAINING;

export interface TrainingExample {
  id: number;
  description: string;
  ticket_service_id: number;
  service_ids: number[];
  ticket_service_name: string;
  service_names: string[];
  clarifying_questions?: string[] | null;
  has_embedding?: boolean;
  is_auto?: boolean;
  created_at: string;
}

export interface TicketService {
  id: number;
  name: string;
  service_ids?: number[];
}

export interface Service {
  id: number;
  name: string;
}

interface ExamplesTabProps {
  examples: TrainingExample[];
  ticketServices: TicketService[];
  services: Service[];
  onReload: () => void;
}

const ExamplesTab = ({ examples, ticketServices, services, onReload }: ExamplesTabProps) => {
  const { toast } = useToast();

  const [exampleDialog, setExampleDialog] = useState(false);
  const [editingExample, setEditingExample] = useState<TrainingExample | null>(null);
  const [exampleForm, setExampleForm] = useState({ description: '', ticket_service_id: '', service_ids: [] as number[], questions: [] as string[] });

  const selectedTs = ticketServices.find(ts => ts.id.toString() === exampleForm.ticket_service_id);
  const filteredServices = selectedTs?.service_ids
    ? services.filter(s => selectedTs.service_ids?.includes(s.id))
    : services;

  const openExampleDialog = (example?: TrainingExample) => {
    if (example) {
      setEditingExample(example);
      setExampleForm({
        description: example.description,
        ticket_service_id: example.ticket_service_id.toString(),
        service_ids: example.service_ids || [],
        questions: example.clarifying_questions || [],
      });
    } else {
      setEditingExample(null);
      setExampleForm({ description: '', ticket_service_id: '', service_ids: [], questions: [] });
    }
    setExampleDialog(true);
  };

  const saveExample = async () => {
    if (!exampleForm.description.trim() || !exampleForm.ticket_service_id) {
      toast({ title: 'Заполните описание и выберите услугу', variant: 'destructive' });
      return;
    }

    const body = {
      ...(editingExample ? { id: editingExample.id } : {}),
      description: exampleForm.description.trim(),
      ticket_service_id: parseInt(exampleForm.ticket_service_id),
      service_ids: exampleForm.service_ids,
      clarifying_questions: exampleForm.questions.map(q => q.trim()).filter(Boolean),
    };

    const res = await apiFetch(AI_TRAINING_URL + '?endpoint=examples', {
      method: editingExample ? 'PUT' : 'POST',
      body: JSON.stringify(body),
    });

    if (res.ok) {
      toast({ title: editingExample ? 'Пример обновлён' : 'Пример добавлен' });
      setExampleDialog(false);
      onReload();
    } else {
      toast({ title: 'Ошибка сохранения', variant: 'destructive' });
    }
  };

  const deleteExample = async (id: number) => {
    const res = await apiFetch(AI_TRAINING_URL + '?endpoint=examples', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      toast({ title: 'Пример удалён' });
      onReload();
    }
  };

  const toggleServiceId = (serviceId: number) => {
    setExampleForm(prev => ({
      ...prev,
      service_ids: prev.service_ids.includes(serviceId)
        ? prev.service_ids.filter(id => id !== serviceId)
        : [...prev.service_ids, serviceId],
    }));
  };

  const updateQuestion = (idx: number, value: string) => {
    setExampleForm(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => (i === idx ? value : q)),
    }));
  };

  const removeQuestion = (idx: number) => {
    setExampleForm(prev => ({ ...prev, questions: prev.questions.filter((_, i) => i !== idx) }));
  };

  const addQuestion = () => {
    setExampleForm(prev => ({ ...prev, questions: [...prev.questions, ''] }));
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Примеры заявок</CardTitle>
              <CardDescription className="text-xs mt-1">
                Добавьте реальные заявки с правильной классификацией. AI будет использовать их как образец.
              </CardDescription>
            </div>
            <Button size="sm" className="gap-2" onClick={() => openExampleDialog()}>
              <Icon name="Plus" size={16} />
              Добавить
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {examples.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Icon name="BookOpen" size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Пока нет примеров</p>
              <p className="text-xs mt-1">Добавьте первый пример заявки для обучения AI</p>
            </div>
          ) : (
            <div className="space-y-3">
              {examples.map(ex => (
                <div key={ex.id} className="p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium mb-1.5 line-clamp-2">{ex.description}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {ex.is_auto && (
                          <Badge variant="outline" className="text-xs text-cyan-600 border-cyan-300 bg-cyan-50">
                            <Icon name="Sparkles" size={10} className="mr-1" />
                            Авто
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-xs">
                          {ex.ticket_service_name}
                        </Badge>
                        {ex.service_names?.map((name, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {name}
                          </Badge>
                        ))}
                        {ex.has_embedding ? (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                            <Icon name="Brain" size={10} className="mr-1" />
                            Индексирован
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                            <Icon name="AlertCircle" size={10} className="mr-1" />
                            Не индексирован
                          </Badge>
                        )}
                      </div>
                      {ex.clarifying_questions && ex.clarifying_questions.length > 0 && (
                        <div className="mt-2 pl-2 border-l-2 border-primary/30">
                          <p className="text-xs font-medium text-muted-foreground mb-0.5">Уточняющие вопросы:</p>
                          <ul className="space-y-0.5">
                            {ex.clarifying_questions.map((q, i) => (
                              <li key={i} className="text-xs text-muted-foreground">— {q}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openExampleDialog(ex)} title="Редактировать" aria-label="Редактировать">
                        <Icon name="Pencil" size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteExample(ex.id)} title="Удалить" aria-label="Удалить">
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

      <Dialog open={exampleDialog} onOpenChange={setExampleDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingExample ? 'Редактировать пример' : 'Новый пример заявки'}</DialogTitle>
            <DialogDescription>
              Опишите заявку и укажите правильную классификацию
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Описание заявки *</Label>
              <Textarea
                value={exampleForm.description}
                onChange={e => setExampleForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Не могу списать процедуры в базе Stoma1C_Krasnodar"
                className="mt-1.5"
                rows={3}
              />
            </div>
            <div>
              <Label>Услуга *</Label>
              <Select
                value={exampleForm.ticket_service_id}
                onValueChange={v => setExampleForm(prev => ({ ...prev, ticket_service_id: v, service_ids: [] }))}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Выберите услугу" />
                </SelectTrigger>
                <SelectContent>
                  {ticketServices.map(ts => (
                    <SelectItem key={ts.id} value={ts.id.toString()}>
                      {ts.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {filteredServices.length > 0 && (
              <div>
                <Label>Сервисы</Label>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {filteredServices.map(svc => (
                    <Badge
                      key={svc.id}
                      variant={exampleForm.service_ids.includes(svc.id) ? 'default' : 'outline'}
                      className="cursor-pointer transition-colors"
                      onClick={() => toggleServiceId(svc.id)}
                    >
                      {svc.name}
                      {exampleForm.service_ids.includes(svc.id) && (
                        <Icon name="Check" size={12} className="ml-1" />
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <div>
              <div className="flex items-center justify-between">
                <Label>Уточняющие вопросы</Label>
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={addQuestion}>
                  <Icon name="Plus" size={14} />
                  Добавить вопрос
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Вопросы, которые стоит задать по таким заявкам. AI будет ориентироваться на них.
              </p>
              {exampleForm.questions.length > 0 && (
                <div className="space-y-2 mt-2">
                  {exampleForm.questions.map((q, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Textarea
                        value={q}
                        onChange={e => updateQuestion(idx, e.target.value)}
                        placeholder="Например: В какой базе возникла проблема?"
                        rows={1}
                        className="min-h-9 resize-none"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 flex-shrink-0 text-destructive"
                        onClick={() => removeQuestion(idx)}
                        title="Удалить вопрос"
                        aria-label="Удалить вопрос"
                      >
                        <Icon name="X" size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setExampleDialog(false)}>Отмена</Button>
              <Button onClick={saveExample}>
                {editingExample ? 'Сохранить' : 'Добавить'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ExamplesTab;
