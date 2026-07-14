import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import PageLayout from '@/components/layout/PageLayout';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/utils/api';
import func2url from '../../backend/func2url.json';
import ExamplesTab from '@/components/ai-training/ExamplesTab';
import RulesTab from '@/components/ai-training/RulesTab';
import TestTab from '@/components/ai-training/TestTab';
import PendingReviewsTab from '@/components/ai-training/PendingReviewsTab';
import type { TrainingExample, TicketService, Service } from '@/components/ai-training/ExamplesTab';
import type { TrainingRule } from '@/components/ai-training/RulesTab';
import type { PendingReview } from '@/components/ai-training/PendingReviewsTab';
import { useToast } from '@/hooks/use-toast';

const AI_TRAINING_URL = func2url['api-ai-training'];
const USE_EMBEDDINGS_UI = false;

const AiTraining = () => {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [tab, setTab] = useState<'pending_reviews' | 'examples' | 'rules' | 'test'>('pending_reviews');
  const [examples, setExamples] = useState<TrainingExample[]>([]);
  const [rules, setRules] = useState<TrainingRule[]>([]);
  const [ticketServices, setTicketServices] = useState<TicketService[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);
  const [stats, setStats] = useState({ examples_count: 0, active_rules_count: 0, indexed_count: 0, pending_reviews_count: 0 });
  const [loading, setLoading] = useState(true);
  const [reindexing, setReindexing] = useState(false);
  const [reindexProgress, setReindexProgress] = useState<{ done: number; total: number } | null>(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (!hasPermission('settings', 'read')) {
      navigate('/tickets');
      return;
    }
    loadData();
  }, [hasPermission, navigate]);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [exRes, rulesRes, statsRes, tsRes, svcRes, prRes] = await Promise.all([
        apiFetch(`${AI_TRAINING_URL}?endpoint=examples`),
        apiFetch(`${AI_TRAINING_URL}?endpoint=rules`),
        apiFetch(`${AI_TRAINING_URL}?endpoint=stats`),
        apiFetch('/ticket_services?endpoint=ticket_services'),
        apiFetch('/services?endpoint=services'),
        apiFetch(`${AI_TRAINING_URL}?endpoint=pending_reviews`),
      ]);

      if (exRes.ok) setExamples(await exRes.json());
      if (rulesRes.ok) setRules(await rulesRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      if (tsRes.ok) {
        const tsData = await tsRes.json();
        setTicketServices(Array.isArray(tsData) ? tsData : tsData.ticket_services || []);
      }
      if (svcRes.ok) {
        const svcData = await svcRes.json();
        setServices(Array.isArray(svcData) ? svcData : []);
      }
      if (prRes.ok) setPendingReviews(await prRes.json());
    } catch (err) {
      console.error('Failed to load AI training data:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const clearAll = async () => {
    if (!window.confirm('Удалить всё содержимое разделов «На проверку», «Примеры заявок» и «Правила»? Восстановить нельзя.')) {
      return;
    }
    setClearing(true);
    try {
      const res = await apiFetch(`${AI_TRAINING_URL}?endpoint=clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections: ['pending_reviews', 'examples', 'rules'] }),
      });
      if (res.ok) {
        toast({ title: 'Разделы обучения очищены' });
        loadData(true);
      } else {
        toast({ title: 'Не удалось очистить', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Ошибка соединения', variant: 'destructive' });
    } finally {
      setClearing(false);
    }
  };

  const reindexExamples = async () => {
    setReindexing(true);
    setReindexProgress(null);

    let totalReindexed = 0;
    let totalErrors = 0;
    let lastErrorReason: string | undefined;
    let grandTotal = 0;
    let safetyCounter = 0;
    const MAX_BATCHES = 200;

    try {
      while (safetyCounter < MAX_BATCHES) {
        safetyCounter += 1;
        const res = await apiFetch(`${AI_TRAINING_URL}?endpoint=reindex`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batch_size: 3 }),
        });

        if (!res.ok) {
          toast({
            title: 'Ошибка индексации',
            description: 'Сервер вернул ошибку. Попробуйте позже.',
            variant: 'destructive',
          });
          return;
        }

        const data = await res.json();
        totalReindexed += data.reindexed || 0;
        totalErrors += data.errors || 0;
        grandTotal = data.total || grandTotal;

        const remaining = data.remaining || 0;
        const done = grandTotal - remaining;
        setReindexProgress({ done, total: grandTotal });

        if (data.error_reason) {
          lastErrorReason = data.error_reason;
        }

        if (data.done || remaining === 0 || (data.reindexed === 0 && data.errors > 0)) {
          break;
        }
      }

      if (lastErrorReason) {
        toast({
          title: `Индексация: ${totalReindexed} из ${grandTotal}`,
          description: lastErrorReason,
          variant: 'destructive',
        });
      } else if (totalErrors > 0) {
        toast({
          title: `Индексация: ${totalReindexed} из ${grandTotal}`,
          description: `Ошибок: ${totalErrors}. Подробности в логах.`,
          variant: 'destructive',
        });
      } else {
        toast({ title: `Индексация завершена: ${totalReindexed} из ${grandTotal}` });
      }

      loadData(true);
    } catch {
      toast({
        title: 'Ошибка индексации',
        description: 'Не удалось связаться с сервером.',
        variant: 'destructive',
      });
    } finally {
      setReindexing(false);
      setReindexProgress(null);
    }
  };

  if (loading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center py-20">
          <Icon name="Loader2" size={32} className="animate-spin text-primary" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
            <Icon name="ArrowLeft" size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Обучение AI</h1>
            <p className="text-sm text-muted-foreground">
              Примеры и правила для автоматической классификации заявок
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-2 text-destructive" onClick={clearAll} disabled={clearing}>
          <Icon name={clearing ? 'Loader2' : 'Trash2'} size={16} className={clearing ? 'animate-spin' : ''} />
          Очистить всё
        </Button>
      </header>

      <div className={`grid ${USE_EMBEDDINGS_UI ? 'grid-cols-4' : 'grid-cols-3'} gap-4 mb-6`}>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Icon name="Clock" size={20} className="text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending_reviews_count}</p>
                <p className="text-xs text-muted-foreground">На проверку</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Icon name="BookOpen" size={20} className="text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.examples_count}</p>
                <p className="text-xs text-muted-foreground">Примеров заявок</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Icon name="Lightbulb" size={20} className="text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.active_rules_count}</p>
                <p className="text-xs text-muted-foreground">Активных правил</p>
              </div>
            </div>
          </CardContent>
        </Card>
        {USE_EMBEDDINGS_UI && (
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Icon name="Brain" size={20} className="text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.indexed_count}/{stats.examples_count}</p>
                  <p className="text-xs text-muted-foreground">Индексировано</p>
                </div>
              </div>
              {stats.indexed_count < stats.examples_count && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 w-full gap-1 text-xs"
                  onClick={reindexExamples}
                  disabled={reindexing}
                >
                  {reindexing ? (
                    <Icon name="Loader2" size={12} className="animate-spin" />
                  ) : (
                    <Icon name="RefreshCw" size={12} />
                  )}
                  {reindexing
                    ? reindexProgress
                      ? `Индексация ${reindexProgress.done}/${reindexProgress.total}`
                      : 'Индексация...'
                    : 'Переиндексировать'}
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        <Button
          variant={tab === 'pending_reviews' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('pending_reviews')}
          className="gap-2"
        >
          <Icon name="Clock" size={16} />
          На проверку
          {stats.pending_reviews_count > 0 && (
            <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0 min-w-[20px] h-5">
              {stats.pending_reviews_count}
            </Badge>
          )}
        </Button>
        <Button
          variant={tab === 'examples' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('examples')}
          className="gap-2"
        >
          <Icon name="BookOpen" size={16} />
          Примеры заявок
        </Button>
        <Button
          variant={tab === 'rules' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('rules')}
          className="gap-2"
        >
          <Icon name="Lightbulb" size={16} />
          Правила
        </Button>
        <Button
          variant={tab === 'test' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('test')}
          className="gap-2"
        >
          <Icon name="Play" size={16} />
          Тестирование
        </Button>
      </div>

      {tab === 'pending_reviews' && (
        <PendingReviewsTab
          pendingReviews={pendingReviews}
          ticketServices={ticketServices}
          services={services}
          onReload={loadData}
        />
      )}

      {tab === 'examples' && (
        <ExamplesTab
          examples={examples}
          ticketServices={ticketServices}
          services={services}
          onReload={loadData}
        />
      )}

      {tab === 'rules' && (
        <RulesTab
          rules={rules}
          onReload={loadData}
        />
      )}

      {tab === 'test' && (
        <TestTab />
      )}
    </PageLayout>
  );
};

export default AiTraining;