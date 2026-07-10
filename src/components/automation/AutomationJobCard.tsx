import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { AutomationJob, AutomationRun, Company, JOB_ICONS, formatDate } from './types';
import AutomationStatusBadge from './AutomationStatusBadge';
import AutomationJobParams from './AutomationJobParams';
import AutomationJobHistory from './AutomationJobHistory';

interface AutomationJobCardProps {
  job: AutomationJob;
  companies: Company[];
  runs: Record<string, AutomationRun[]>;
  savingKey: string | null;
  triggeringKey: string | null;
  historyOpen: Record<string, boolean>;
  updateJobLocal: (jobKey: string, patch: Partial<AutomationJob>) => void;
  saveJob: (job: AutomationJob) => void;
  triggerJob: (job: AutomationJob) => void;
  toggleHistory: (jobKey: string) => void;
}

const AutomationJobCard = ({
  job,
  companies,
  runs,
  savingKey,
  triggeringKey,
  historyOpen,
  updateJobLocal,
  saveJob,
  triggerJob,
  toggleHistory,
}: AutomationJobCardProps) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10">
              <Icon
                name={JOB_ICONS[job.job_key] || 'UserX'}
                size={20}
                className="text-primary"
              />
            </div>
            <div>
              <CardTitle className="text-base">{job.title}</CardTitle>
              <CardDescription className="text-xs mt-1">
                {job.description}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <AutomationStatusBadge status={job.last_status} />
            <div className="flex items-center gap-2">
              <Label htmlFor={`enabled-${job.job_key}`} className="text-xs text-muted-foreground">
                {job.enabled ? 'Включено' : 'Выключено'}
              </Label>
              <Switch
                id={`enabled-${job.job_key}`}
                checked={job.enabled}
                onCheckedChange={(v) => updateJobLocal(job.job_key, { enabled: v })}
              />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <AutomationJobParams job={job} companies={companies} updateJobLocal={updateJobLocal} />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-md bg-muted/30 border border-border/40">
            <p className="text-muted-foreground">Последний запуск</p>
            <p className="font-medium mt-1">{formatDate(job.last_run_at)}</p>
          </div>
          <div className="p-3 rounded-md bg-muted/30 border border-border/40">
            <p className="text-muted-foreground">Следующий запуск</p>
            <p className="font-medium mt-1">{formatDate(job.next_run_at)}</p>
          </div>
          <div className="p-3 rounded-md bg-muted/30 border border-border/40">
            <p className="text-muted-foreground">Результат</p>
            <p className="font-medium mt-1 truncate" title={job.last_message}>
              {job.last_message || '—'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => saveJob(job)}
            disabled={savingKey === job.job_key}
            className="gap-2"
          >
            <Icon
              name={savingKey === job.job_key ? 'Loader2' : 'Save'}
              size={14}
              className={savingKey === job.job_key ? 'animate-spin' : ''}
            />
            Сохранить
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => triggerJob(job)}
            disabled={triggeringKey === job.job_key}
            className="gap-2"
          >
            <Icon
              name={triggeringKey === job.job_key ? 'Loader2' : 'Play'}
              size={14}
              className={triggeringKey === job.job_key ? 'animate-spin' : ''}
            />
            Запустить сейчас
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => toggleHistory(job.job_key)}
            className="gap-2"
          >
            <Icon name={historyOpen[job.job_key] ? 'ChevronUp' : 'History'} size={14} />
            {historyOpen[job.job_key] ? 'Скрыть историю' : 'История запусков'}
          </Button>
        </div>

        {historyOpen[job.job_key] && (
          <AutomationJobHistory runs={runs[job.job_key] || []} />
        )}
      </CardContent>
    </Card>
  );
};

export default AutomationJobCard;
