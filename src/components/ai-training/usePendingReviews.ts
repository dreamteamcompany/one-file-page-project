import { useState } from 'react';
import { apiFetch } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';
import { FN } from '@/config/backend';
import type { TicketService, Service } from './ExamplesTab';
import type { PendingReview } from './PendingReviewItem';

const AI_TRAINING_URL = FN.AI_TRAINING;

interface Params {
  ticketServices: TicketService[];
  services: Service[];
  onReload: () => void;
}

export const usePendingReviews = ({ ticketServices, services, onReload }: Params) => {
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

  return {
    addDialog,
    setAddDialog,
    correctDialog,
    setCorrectDialog,
    correctingReview,
    correctForm,
    setCorrectForm,
    loading,
    recheckingId,
    bulkRecheck,
    filteredServices,
    handleApprove,
    handleReject,
    recheckOne,
    recheckBulk,
    openCorrectDialog,
    handleCorrect,
    handleApproveAll,
    updateQuestion,
    removeQuestion,
    addQuestion,
    toggleServiceId,
  };
};
