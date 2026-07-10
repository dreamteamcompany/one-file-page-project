import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AutomationJob, Company, SchedulePreset, PRESET_OPTIONS, MODE_OPTIONS } from './types';

interface AutomationJobParamsProps {
  job: AutomationJob;
  companies: Company[];
  updateJobLocal: (jobKey: string, patch: Partial<AutomationJob>) => void;
}

const AutomationJobParams = ({ job, companies, updateJobLocal }: AutomationJobParamsProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div>
        <Label className="text-xs text-muted-foreground">Периодичность</Label>
        <Select
          value={job.schedule_preset}
          onValueChange={(v) =>
            updateJobLocal(job.job_key, { schedule_preset: v as SchedulePreset })
          }
        >
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRESET_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {job.job_key === 'bitrix_sync_positions' && (
        <div>
          <Label className="text-xs text-muted-foreground">Компания</Label>
          <Select
            value={String(job.params.company_id ?? '')}
            onValueChange={(v) =>
              updateJobLocal(job.job_key, {
                params: { ...job.params, company_id: Number(v) },
              })
            }
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Выберите компанию" />
            </SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {job.job_key === 'bitrix_inactive_users' && (
        <>
          <div>
            <Label className="text-xs text-muted-foreground">Кого деактивировать</Label>
            <Select
              value={String(job.params.mode ?? 'long_inactive')}
              onValueChange={(v) =>
                updateJobLocal(job.job_key, {
                  params: { ...job.params, mode: v },
                })
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Порог дней неактивности</Label>
            <Input
              type="number"
              min={1}
              className="mt-1"
              value={Number(job.params.days ?? 30)}
              onChange={(e) =>
                updateJobLocal(job.job_key, {
                  params: { ...job.params, days: Number(e.target.value) || 1 },
                })
              }
            />
          </div>
        </>
      )}
    </div>
  );
};

export default AutomationJobParams;
