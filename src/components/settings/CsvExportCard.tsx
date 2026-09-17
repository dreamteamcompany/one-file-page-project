import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { apiFetch, getApiUrl } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';
import CsvExportTablePicker, { ExportTable } from './CsvExportTablePicker';

type ExportResult = {
  success: boolean;
  scope: string;
  table: string | null;
  created_at: string;
  snapshot_at?: string;
  tables: number;
  rows: number;
  size_bytes: number;
  duration_sec: number;
  filename?: string;
  download_url?: string;
  parts?: { filename: string; url: string }[];
  expires_in_sec?: number;
  error?: string;
};

type JobProgress = {
  tables_done: number;
  tables_total: number;
  rows: number;
  current_table: string | null;
};

type JobStatus = {
  job_id: number;
  scope: string;
  table: string | null;
  status: 'pending' | 'running' | 'success' | 'error';
  duration_sec: number | null;
  result: ExportResult | null;
  error: string | null;
  progress: JobProgress | null;
};

type Scope = 'all' | 'all_no_logs' | 'table';

const SCOPES: { id: Scope; label: string; hint: string }[] = [
  { id: 'all', label: 'Вся база', hint: 'архив со всеми таблицами' },
  { id: 'all_no_logs', label: 'Без журналов', hint: 'рабочие данные, легче объём' },
  { id: 'table', label: 'Одна таблица', hint: 'выбрать из списка' },
];

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 600; // 600 * 3с = 30 минут — запас на большую базу
const LAST_JOB_KEY = 'csv_export_last_job_id';

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
};

const CsvExportCard = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState<Scope>('all');
  const [tables, setTables] = useState<ExportTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadTables();
    const savedJobId = localStorage.getItem(LAST_JOB_KEY);
    if (savedJobId) {
      setLoading(true);
      pollStatus(Number(savedJobId), 0, true);
    }
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTables = async () => {
    try {
      const url = `${getApiUrl('csv_export')}?resource=csv_export&action=tables`;
      const res = await apiFetch(url);
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.tables)) {
        setTables(data.tables);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const pollStatus = (jobId: number, attempt: number, silent = false) => {
    pollTimer.current = setTimeout(async () => {
      try {
        const url = `${getApiUrl('csv_export')}?resource=csv_export&action=status&job_id=${jobId}`;
        const res = await apiFetch(url);
        const data: JobStatus = await res.json();

        if (!res.ok) {
          setLoading(false);
          localStorage.removeItem(LAST_JOB_KEY);
          if (!silent) {
            toast({
              title: 'Выгрузка не создана',
              description: (data as unknown as { error?: string })?.error || 'Не удалось проверить статус',
              variant: 'destructive',
            });
          }
          return;
        }

        if (data.progress) setProgress(data.progress);

        if (data.status === 'success' && data.result) {
          setLoading(false);
          setProgress(null);
          setResult(data.result);
          localStorage.removeItem(LAST_JOB_KEY);
          toast({
            title: 'Выгрузка готова',
            description: `${data.result.rows.toLocaleString('ru-RU')} записей, ${formatSize(data.result.size_bytes)}`,
          });
          return;
        }

        if (data.status === 'error') {
          setLoading(false);
          setProgress(null);
          setResult(data.result);
          localStorage.removeItem(LAST_JOB_KEY);
          toast({
            title: 'Выгрузка не создана',
            description: data.error || 'Не удалось выполнить экспорт',
            variant: 'destructive',
          });
          return;
        }

        if (attempt >= MAX_POLL_ATTEMPTS) {
          setLoading(false);
          localStorage.removeItem(LAST_JOB_KEY);
          toast({
            title: 'Выгрузка ещё готовится',
            description: 'Это занимает необычно много времени. Загляните на страницу позже.',
            variant: 'destructive',
          });
          return;
        }

        pollStatus(jobId, attempt + 1);
      } catch (e) {
        console.error(e);
        if (attempt >= MAX_POLL_ATTEMPTS) {
          setLoading(false);
          localStorage.removeItem(LAST_JOB_KEY);
          toast({
            title: 'Ошибка соединения',
            description: 'Не удалось проверить статус выгрузки',
            variant: 'destructive',
          });
          return;
        }
        pollStatus(jobId, attempt + 1);
      }
    }, POLL_INTERVAL_MS);
  };

  const handleCreate = async () => {
    if (scope === 'table' && !selectedTable) {
      toast({
        title: 'Выберите таблицу',
        description: 'Отметьте таблицу в списке — её и выгружу',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setResult(null);
    setProgress(null);
    try {
      const url = `${getApiUrl('csv_export')}?resource=csv_export`;
      const res = await apiFetch(url, {
        method: 'POST',
        body: JSON.stringify({
          action: 'create',
          scope,
          table: scope === 'table' ? selectedTable : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.job_id) {
        setLoading(false);
        toast({
          title: 'Выгрузка не создана',
          description: data?.error || 'Не удалось запустить экспорт',
          variant: 'destructive',
        });
        return;
      }

      localStorage.setItem(LAST_JOB_KEY, String(data.job_id));
      pollStatus(data.job_id, 0);
    } catch (e) {
      console.error(e);
      setLoading(false);
      toast({
        title: 'Ошибка соединения',
        description: 'Не удалось запустить экспорт',
        variant: 'destructive',
      });
    }
  };

  const parts = result?.parts && result.parts.length > 0
    ? result.parts
    : result
      ? [{ filename: result.filename || 'export', url: result.download_url || '' }]
      : [];

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-sky-500/10">
            <Icon name="FileSpreadsheet" size={20} className="text-sky-600" />
          </div>
          <div>
            <CardTitle className="text-base">Экспорт данных в CSV</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Отдельная таблица или вся база архивом — для Excel и анализа
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-4">
        <div className="grid gap-2 sm:grid-cols-3">
          {SCOPES.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={loading}
              onClick={() => setScope(s.id)}
              className={`text-left p-3 rounded-lg border transition-colors disabled:opacity-60 ${
                scope === s.id
                  ? 'border-sky-500/60 bg-sky-500/5'
                  : 'border-border/50 bg-muted/30 hover:bg-muted/50'
              }`}
            >
              <p className="text-sm font-medium">{s.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.hint}</p>
            </button>
          ))}
        </div>

        {scope === 'table' && (
          <CsvExportTablePicker
            tables={tables}
            selected={selectedTable}
            disabled={loading}
            onSelect={setSelectedTable}
          />
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleCreate} disabled={loading} className="gap-2">
            <Icon name={loading ? 'Loader2' : 'Download'} size={16} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Готовлю выгрузку…' : 'Выгрузить в CSV'}
          </Button>
          <p className="text-xs text-muted-foreground">
            Работе сервиса не мешает. Выгрузка только читает данные.
          </p>
        </div>

        {loading && (
          <div className="space-y-2">
            {progress && progress.tables_total > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {progress.current_table
                      ? `Выгружаю: ${progress.current_table}`
                      : 'Собираю архив'}
                  </span>
                  <span className="font-medium">
                    {progress.tables_done} из {progress.tables_total}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-sky-500 transition-all duration-500"
                    style={{
                      width: `${Math.round((progress.tables_done / progress.tables_total) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Записей выгружено: {progress.rows.toLocaleString('ru-RU')}
                </p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Файл готовится на сервере — это может занять несколько минут. Страницу можно закрыть
              и вернуться позже, выгрузка продолжится.
            </p>
          </div>
        )}

        {result?.success && (
          <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Icon name="CircleCheck" size={16} className="text-sky-600" />
              <p className="text-sm font-medium">
                {result.scope === 'table'
                  ? `Таблица ${result.table} выгружена`
                  : `Выгружено таблиц: ${result.tables}`}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Таблиц</p>
                <p className="font-medium">{result.tables}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Записей</p>
                <p className="font-medium">{result.rows.toLocaleString('ru-RU')}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Размер</p>
                <p className="font-medium">{formatSize(result.size_bytes)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Заняло</p>
                <p className="font-medium">{result.duration_sec} с</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {parts.map((p, i) => (
                  <Button key={p.filename} asChild size="sm" variant="outline" className="gap-2">
                    <a href={p.url} download={p.filename} data-attachment-link>
                      <Icon name="Download" size={14} />
                      {parts.length > 1 ? `Часть ${i + 1}` : 'Скачать файл'}
                    </a>
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Ссылки действуют 1 час и доступны только вам
              </p>

              {parts.length > 1 && (
                <div className="rounded-md bg-muted/40 border border-border/50 p-2.5 space-y-1">
                  <p className="text-xs font-medium">
                    Выгрузка разбита на {parts.length} частей
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Скачайте все части в одну папку и склейте их в один файл. Порядок важен.
                  </p>
                  <code className="block text-[11px] bg-background/60 rounded px-2 py-1 mt-1 overflow-x-auto">
                    cat {result.filename}.part* &gt; {result.filename}
                  </code>
                  <p className="text-[11px] text-muted-foreground">
                    Windows: copy /b {result.filename}.part* {result.filename}
                  </p>
                </div>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
              Файл содержит персональные данные сотрудников и переписку по заявкам.
              Храните его в защищённом месте, не выкладывайте в общий доступ.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CsvExportCard;