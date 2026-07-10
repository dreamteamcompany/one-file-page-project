import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import PageLayout from '@/components/layout/PageLayout';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch, getApiUrl } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';
import func2url from '../../backend/func2url.json';
import { AutomationJob, AutomationRun, Company } from '@/components/automation/types';
import AutomationJobCard from '@/components/automation/AutomationJobCard';

const AUTOMATION_URL = (func2url as Record<string, string>)['automation'];

const AutomationSettings = () => {
  const { hasPermission, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const isAdmin = useMemo(() => {
    if (!user) return false;
    const roles = (user.roles || []) as Array<string | { system_role?: string; name?: string }>;
    return roles.some((r) =>
      typeof r === 'string'
        ? r === 'admin'
        : r?.system_role === 'admin' || r?.name === 'admin',
    );
  }, [user]);

  const [jobs, setJobs] = useState<AutomationJob[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [runs, setRuns] = useState<Record<string, AutomationRun[]>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [triggeringKey, setTriggeringKey] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasPermission('settings', 'read') || !isAdmin) {
      navigate('/settings');
    }
  }, [hasPermission, isAdmin, navigate]);

  const loadJobs = async () => {
    try {
      const r = await apiFetch(AUTOMATION_URL);
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        toast({ title: err.error || 'Не удалось загрузить задачи', variant: 'destructive' });
        return;
      }
      const data = await r.json();
      setJobs(data.jobs || []);
    } catch (e) {
      console.error(e);
      toast({ title: 'Ошибка соединения', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    try {
      const r = await apiFetch(`${getApiUrl('companies')}?resource=companies`);
      if (r.ok) {
        const data = await r.json();
        const list = Array.isArray(data) ? data : data.companies || data.items || [];
        setCompanies(
          list.map((c: { id: number; name: string }) => ({ id: c.id, name: c.name })),
        );
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadRuns = async (jobKey: string) => {
    try {
      const r = await apiFetch(`${AUTOMATION_URL}?action=runs&job_key=${jobKey}&limit=20`);
      if (r.ok) {
        const data = await r.json();
        setRuns((prev) => ({ ...prev, [jobKey]: data.runs || [] }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadJobs();
    loadCompanies();
  }, []);

  const updateJobLocal = (jobKey: string, patch: Partial<AutomationJob>) => {
    setJobs((prev) => prev.map((j) => (j.job_key === jobKey ? { ...j, ...patch } : j)));
  };

  const saveJob = async (job: AutomationJob) => {
    setSavingKey(job.job_key);
    try {
      const r = await apiFetch(AUTOMATION_URL, {
        method: 'PUT',
        body: JSON.stringify({
          job_key: job.job_key,
          enabled: job.enabled,
          schedule_preset: job.schedule_preset,
          params: job.params,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        toast({ title: err.error || 'Не удалось сохранить', variant: 'destructive' });
        await loadJobs();
        return;
      }
      const data = await r.json();
      if (data.job) updateJobLocal(job.job_key, data.job);
      toast({ title: 'Настройки сохранены' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Ошибка соединения', variant: 'destructive' });
    } finally {
      setSavingKey(null);
    }
  };

  const triggerJob = async (job: AutomationJob) => {
    setTriggeringKey(job.job_key);
    try {
      const r = await apiFetch(AUTOMATION_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'trigger', job_key: job.job_key }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast({ title: data.error || 'Запуск завершился ошибкой', variant: 'destructive' });
      } else {
        const okStatus = data.status === 'success';
        toast({
          title: okStatus ? 'Задача выполнена' : 'Задача завершилась с ошибкой',
          description: data.message || '',
          variant: okStatus ? 'default' : 'destructive',
        });
        if (data.job) updateJobLocal(job.job_key, data.job);
      }
      await loadRuns(job.job_key);
    } catch (e) {
      console.error(e);
      toast({ title: 'Ошибка соединения', variant: 'destructive' });
    } finally {
      setTriggeringKey(null);
    }
  };

  const toggleHistory = async (jobKey: string) => {
    const willOpen = !historyOpen[jobKey];
    setHistoryOpen((prev) => ({ ...prev, [jobKey]: willOpen }));
    if (willOpen && !runs[jobKey]) {
      await loadRuns(jobKey);
    }
  };

  if (!isAdmin) return null;

  return (
    <PageLayout>
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/settings')} className="gap-2">
            <Icon name="ArrowLeft" size={16} />
            Назад
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Автоматизация</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Периодический запуск синхронизации и проверок
            </p>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Icon name="Loader2" size={32} className="animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {jobs.map((job) => (
            <AutomationJobCard
              key={job.job_key}
              job={job}
              companies={companies}
              runs={runs}
              savingKey={savingKey}
              triggeringKey={triggeringKey}
              historyOpen={historyOpen}
              updateJobLocal={updateJobLocal}
              saveJob={saveJob}
              triggerJob={triggerJob}
              toggleHistory={toggleHistory}
            />
          ))}
        </div>
      )}
    </PageLayout>
  );
};

export default AutomationSettings;
