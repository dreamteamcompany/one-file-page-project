import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
import func2url from '../../../backend/func2url.json';
import type { TicketService, Service } from './ExamplesTab';
import AddExistingTicketsDialog from './AddExistingTicketsDialog';

const AI_TRAINING_URL = func2url['api-ai-training'];

export interface PendingReview {
  id: number;
  description: string;
  ticket_service_id: number;
  service_ids: number[];
  ticket_service_name: string;
  service_names: string[];
  confidence: number;
  status: string;
  created_at: string;
  clarifying_questions?: string[] | null;
  source_ticket_id?: number | null;
}

interface PendingReviewsTabProps {
  pendingReviews: PendingReview[];
  ticketServices: TicketService[];
  services: Service[];
  onReload: () => void;
}

const PendingReviewsTab = ({ pendingReviews, ticketServices, services, onReload }: PendingReviewsTabProps) => {
  const { toast } = useToast();

  const [addDialog, setAddDialog] = useState(false);
  const [correctDialog, setCorrectDialog] = useState(false);
  const [correctingReview, setCorrectingReview] = useState<PendingReview | null>(null);
  const [correctForm, setCorrectForm] = useState({ ticket_service_id: '', service_ids: [] as number[], questions: [] as string[] });
  const [loading, setLoading] = useState(false);
  const [recheckingId, setRecheckingId] = useState<number | null>(null);
  const [bulkRecheck, setBulkRecheck] = useState<{ scope: 'pending' | 'all'; done: number } | null>(null);

  const selectedTs = ticketServices.find(ts => ts.id.toString() === correctForm.ticket_service_id);
  const filteredServices = selectedTs?.service_ids
    ? services.filter(s => selectedTs.service_ids?.includes(s.id))
    : services;

  const getConfidenceBadge = (confidence: number) => {
    if (confidence > 70) {
      return (
        <Badge variant="outline" className="text-xs text-green-600 border-green-300 bg-green-50">
          {confidence}%
        </Badge>
      );
    }
    if (confidence >= 40) {
      return (
        <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-300 bg-yellow-50">
          {confidence}%
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs text-red-600 border-red-300 bg-red-50">
        {confidence}%
      </Badge>
    );
  };

  const handleApprove = async (id: number) => {
    setLoading(true);
    const res = await apiFetch(AI_TRAINING_URL + '?endpoint=pending_reviews', {
      method: 'POST',
      body: JSON.stringify({ action: 'approve', id }),
    });
    setLoading(false);
    if (res.ok) {
      toast({ title: 'Классификация подтверждена' });
      onReload();
    } else {
      toast({ title: 'Ошибка подтверждения', variant: 'destructive' });
    }
  };

  const handleReject = async (id: number) => {
    setLoading(true);
    const res = await apiFetch(AI_TRAINING_URL + '?endpoint=pending_reviews', {
      method: 'POST',
      body: JSON.stringify({ action: 'reject', id }),
    });
    setLoading(false);
    if (res.ok) {
      toast({ title: 'Классификация отклонена' });
      onReload();
    } else {
      toast({ title: 'Ошибка отклонения', variant: 'destructive' });
    }
  };

  const recheckOne = async (id: number) => {
    setRecheckingId(id);
    try {
      const res = await apiFetch(AI_TRAINING_URL + '?endpoint=recheck', {
        method: 'POST',
        body: JSON.stringify({ scope: 'one', review_id: id }),
      });
      if (res.ok) {
        toast({ title: 'Заявка перепроверена' });
        onReload();
      } else {
        toast({ title: 'Ошибка перепроверки', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Ошибка соединения', variant: 'destructive' });
    } finally {
      setRecheckingId(null);
    }
  };

  const recheckBulk = async (scope: 'pending' | 'all') => {
    const label = scope === 'all' ? 'ВСЕ заявки в очереди (включая уже разобранные)' : 'непроверенные заявки';
    if (!window.confirm(`Перепроверить ${label}? ИИ заново проанализирует их с учётом текущих определений и правил. Это может занять время.`)) {
      return;
    }
    setBulkRecheck({ scope, done: 0 });
    let afterId = 0;
    let done = 0;
    let safety = 0;
    const MAX_BATCHES = 3000;
    try {
      while (safety < MAX_BATCHES) {
        safety += 1;
        const res = await apiFetch(AI_TRAINING_URL + '?endpoint=recheck', {
          method: 'POST',
          body: JSON.stringify({ scope, after_id: afterId, batch_size: 3 }),
        });
        if (!res.ok) {
          toast({ title: 'Ошибка перепроверки', variant: 'destructive' });
          break;
        }
        const data = await res.json();
        done += (data.rechecked || 0) + (data.errors || 0);
        afterId = data.last_id ?? afterId;
        setBulkRecheck({ scope, done });
        if (data.done) break;
        onReload();
      }
      toast({ title: 'Перепроверка завершена' });
      onReload();
    } catch {
      toast({ title: 'Ошибка соединения', variant: 'destructive' });
    } finally {
      setBulkRecheck(null);
    }
  };

  const openCorrectDialog = (review: PendingReview) => {
    setCorrectingReview(review);
    setCorrectForm({
      ticket_service_id: review.ticket_service_id?.toString() || '',
      service_ids: review.service_ids || [],
      questions: review.clarifying_questions || [],
    });
    setCorrectDialog(true);
  };

  const handleCorrect = async () => {
    if (!correctingReview || !correctForm.ticket_service_id) {
      toast({ title: 'Выберите услугу', variant: 'destructive' });
      return;
    }

    setLoading(true);
    const res = await apiFetch(AI_TRAINING_URL + '?endpoint=pending_reviews', {
      method: 'POST',
      body: JSON.stringify({
        action: 'correct',
        id: correctingReview.id,
        ticket_service_id: parseInt(correctForm.ticket_service_id),
        service_ids: correctForm.service_ids,
        clarifying_questions: correctForm.questions.map(q => q.trim()).filter(Boolean),
      }),
    });
    setLoading(false);
    if (res.ok) {
      toast({ title: 'Классификация исправлена и подтверждена' });
      setCorrectDialog(false);
      onReload();
    } else {
      toast({ title: 'Ошибка сохранения', variant: 'destructive' });
    }
  };

  const handleApproveAll = async () => {
    setLoading(true);
    const res = await apiFetch(AI_TRAINING_URL + '?endpoint=pending_reviews', {
      method: 'POST',
      body: JSON.stringify({ action: 'approve_all' }),
    });
    setLoading(false);
    if (res.ok) {
      const data = await res.json();
      toast({ title: `Подтверждено: ${data.count}` });
      onReload();
    } else {
      toast({ title: 'Ошибка массового подтверждения', variant: 'destructive' });
    }
  };

  const updateQuestion = (idx: number, value: string) => {
    setCorrectForm(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => (i === idx ? value : q)),
    }));
  };

  const removeQuestion = (idx: number) => {
    setCorrectForm(prev => ({ ...prev, questions: prev.questions.filter((_, i) => i !== idx) }));
  };

  const addQuestion = () => {
    setCorrectForm(prev => ({ ...prev, questions: [...prev.questions, ''] }));
  };

  const toggleServiceId = (serviceId: number) => {
    setCorrectForm(prev => ({
      ...prev,
      service_ids: prev.service_ids.includes(serviceId)
        ? prev.service_ids.filter(id => id !== serviceId)
        : [...prev.service_ids, serviceId],
    }));
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">На проверку</CardTitle>
              <CardDescription className="text-xs mt-1">
                Результаты автоматической классификации, ожидающие проверки оператором.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
              <Button size="sm" variant="outline" className="gap-2 flex-1 sm:flex-none" onClick={() => setAddDialog(true)}>
                <Icon name="FilePlus" size={16} />
                Добавить заявки
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-2 flex-1 sm:flex-none"
                onClick={() => recheckBulk('pending')}
                disabled={!!bulkRecheck}
              >
                <Icon name={bulkRecheck?.scope === 'pending' ? 'Loader2' : 'RefreshCw'} size={16} className={bulkRecheck?.scope === 'pending' ? 'animate-spin' : ''} />
                {bulkRecheck?.scope === 'pending' ? `Перепроверка ${bulkRecheck.done}` : 'Перепроверить непроверенные'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-2 flex-1 sm:flex-none"
                onClick={() => recheckBulk('all')}
                disabled={!!bulkRecheck}
              >
                <Icon name={bulkRecheck?.scope === 'all' ? 'Loader2' : 'RefreshCcwDot'} size={16} className={bulkRecheck?.scope === 'all' ? 'animate-spin' : ''} />
                {bulkRecheck?.scope === 'all' ? `Перепроверка ${bulkRecheck.done}` : 'Перепроверить всё'}
              </Button>
              {pendingReviews.length > 0 && (
                <Button size="sm" className="gap-2 flex-1 sm:flex-none" onClick={handleApproveAll} disabled={loading}>
                  <Icon name="CheckCheck" size={16} />
                  Подтвердить все
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {pendingReviews.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Icon name="CheckCircle" size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Нет записей на проверку</p>
              <p className="text-xs mt-1">Новые классификации появятся здесь автоматически</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingReviews.map(rv => (
                <div key={rv.id} className="p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {rv.source_ticket_id ? (
                        <button
                          type="button"
                          onClick={() => window.open(`/tickets/${rv.source_ticket_id}`, '_blank')}
                          className="text-sm font-medium mb-1.5 line-clamp-2 text-left hover:text-primary hover:underline flex items-start gap-1 group"
                          title="Открыть заявку в новой вкладке"
                        >
                          <span className="line-clamp-2">{rv.description}</span>
                          <Icon name="ExternalLink" size={13} className="mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ) : (
                        <p className="text-sm font-medium mb-1.5 line-clamp-2">{rv.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {getConfidenceBadge(rv.confidence)}
                        {rv.ticket_service_name && (
                          <Badge variant="secondary" className="text-xs">
                            {rv.ticket_service_name}
                          </Badge>
                        )}
                        {rv.service_names?.map((name, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {name}
                          </Badge>
                        ))}
                      </div>
                      {rv.clarifying_questions && rv.clarifying_questions.length > 0 && (
                        <div className="mt-2 pl-2 border-l-2 border-primary/30">
                          <p className="text-[11px] font-medium text-muted-foreground mb-0.5 flex items-center gap-1">
                            <Icon name="MessageCircleQuestion" size={12} />
                            Вопросы, которые задал бы ИИ:
                          </p>
                          <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
                            {rv.clarifying_questions.map((q, i) => (
                              <li key={i}>{q}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => recheckOne(rv.id)}
                        disabled={loading || recheckingId === rv.id || !!bulkRecheck}
                        title="Перепроверить (учесть определения и правила)"
                        aria-label="Перепроверить"
                      >
                        <Icon name={recheckingId === rv.id ? 'Loader2' : 'RefreshCw'} size={14} className={recheckingId === rv.id ? 'animate-spin' : ''} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => handleApprove(rv.id)}
                        disabled={loading}
                        title="Подтвердить"
                        aria-label="Подтвердить"
                      >
                        <Icon name="Check" size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => openCorrectDialog(rv)}
                        disabled={loading}
                        title="Исправить"
                        aria-label="Исправить"
                      >
                        <Icon name="Pencil" size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => handleReject(rv.id)}
                        disabled={loading}
                        title="Отклонить"
                        aria-label="Отклонить"
                      >
                        <Icon name="X" size={14} />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={correctDialog} onOpenChange={setCorrectDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Исправить классификацию</DialogTitle>
            <DialogDescription>
              Укажите правильную услугу и сервисы для этой заявки
            </DialogDescription>
          </DialogHeader>
          {correctingReview && (
            <div className="space-y-4">
              <div>
                <Label>Описание заявки</Label>
                <p className="text-sm text-muted-foreground mt-1 p-2 bg-muted/30 rounded">
                  {correctingReview.description}
                </p>
              </div>
              <div>
                <Label>Услуга *</Label>
                <Select
                  value={correctForm.ticket_service_id}
                  onValueChange={v => setCorrectForm(prev => ({ ...prev, ticket_service_id: v, service_ids: [] }))}
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
                        variant={correctForm.service_ids.includes(svc.id) ? 'default' : 'outline'}
                        className="cursor-pointer transition-colors"
                        onClick={() => toggleServiceId(svc.id)}
                      >
                        {svc.name}
                        {correctForm.service_ids.includes(svc.id) && (
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
                    <Icon name="Plus" size={12} />
                    Добавить
                  </Button>
                </div>
                <div className="space-y-2 mt-1.5">
                  {correctForm.questions.length === 0 && (
                    <p className="text-xs text-muted-foreground">Вопросов нет</p>
                  )}
                  {correctForm.questions.map((q, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={q}
                        onChange={e => updateQuestion(idx, e.target.value)}
                        placeholder="Текст вопроса"
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive flex-shrink-0"
                        onClick={() => removeQuestion(idx)}
                        title="Удалить вопрос"
                        aria-label="Удалить вопрос"
                      >
                        <Icon name="Trash2" size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setCorrectDialog(false)}>Отмена</Button>
                <Button onClick={handleCorrect} disabled={loading}>
                  Сохранить и подтвердить
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AddExistingTicketsDialog
        open={addDialog}
        onOpenChange={setAddDialog}
        onDone={onReload}
      />
    </>
  );
};

export default PendingReviewsTab;