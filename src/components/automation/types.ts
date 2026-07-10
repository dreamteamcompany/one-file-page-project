import { formatDateTimeMSK } from '@/utils/dateFormat';

export type SchedulePreset = 'off' | 'hourly' | 'every_6h' | 'every_12h' | 'daily' | 'weekly';

export interface AutomationJob {
  job_key: string;
  title: string;
  description: string;
  enabled: boolean;
  schedule_preset: SchedulePreset;
  params: Record<string, unknown>;
  last_run_at: string | null;
  last_finished_at: string | null;
  last_status: string | null;
  last_message: string;
  next_run_at: string | null;
}

export interface AutomationRun {
  id: number;
  job_key: string;
  trigger_type: string;
  started_by_name: string;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  status: string;
  message: string;
  result: Record<string, unknown>;
}

export interface Company {
  id: number;
  name: string;
}

export const PRESET_OPTIONS: { value: SchedulePreset; label: string }[] = [
  { value: 'off', label: 'Выключено' },
  { value: 'hourly', label: 'Каждый час' },
  { value: 'every_6h', label: 'Каждые 6 часов' },
  { value: 'every_12h', label: 'Каждые 12 часов' },
  { value: 'daily', label: 'Раз в сутки' },
  { value: 'weekly', label: 'Раз в неделю' },
];

export const JOB_ICONS: Record<string, string> = {
  bitrix_sync_positions: 'RefreshCw',
  bitrix_inactive_users: 'UserX',
  reassign_by_schedule: 'Users',
};

export const MODE_OPTIONS = [
  { value: 'long_inactive', label: 'Давно не заходили' },
  { value: 'never_logged', label: 'Ни разу не заходили' },
  { value: 'all', label: 'Все неактивные' },
];

export const formatDate = (iso: string | null): string => {
  if (!iso) return '—';
  try {
    return formatDateTimeMSK(iso);
  } catch {
    return '—';
  }
};
