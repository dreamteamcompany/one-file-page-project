import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { apiFetch, getApiUrl } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';

type Check = { name: string; ok: boolean; detail: string };

type BackupResult = {
  success: boolean;
  mode: string;
  created_at: string;
  snapshot_at?: string;
  tables: number;
  rows: number;
  size_bytes: number;
  sha256: string;
  checks: Check[];
  duration_sec: number;
  download_url?: string;
  expires_in_sec?: number;
  filename?: string;
  error?: string;
};

const MODES = [
  { id: 'full', label: 'Всё целиком', hint: 'структура и все записи' },
  { id: 'no_logs', label: 'Без журналов', hint: 'рабочие данные, легче объём' },
  { id: 'schema', label: 'Только структура', hint: 'пустой каркас базы' },
] as const;

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
};

const DatabaseBackupCard = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<string>('full');
  const [result, setResult] = useState<BackupResult | null>(null);

  const handleCreate = async () => {
    setLoading(true);
    setResult(null);
    try {
      const url = `${getApiUrl('db_backup')}?resource=db_backup`;
      const res = await apiFetch(url, {
        method: 'POST',
        body: JSON.stringify({ mode }),
      });

      const data: BackupResult = await res.json().catch(() => ({}) as BackupResult);

      if (res.ok && data.success) {
        setResult(data);
        toast({
          title: 'Копия создана и проверена',
          description: `${data.tables} таблиц, ${data.rows.toLocaleString('ru-RU')} записей, ${formatSize(data.size_bytes)}`,
        });
      } else {
        setResult(data && data.checks ? data : null);
        toast({
          title: 'Копия не создана',
          description: data?.error || 'Не удалось выполнить выгрузку',
          variant: 'destructive',
        });
      }
    } catch (e) {
      console.error(e);
      toast({
        title: 'Ошибка соединения',
        description: 'Выгрузка могла прерваться по времени. Попробуйте режим «Без журналов».',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-500/10">
            <Icon name="DatabaseBackup" size={20} className="text-emerald-600" />
          </div>
          <div>
            <CardTitle className="text-base">Резервная копия базы</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Снимок данных на один момент времени с проверкой целостности
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-4">
        <div className="grid gap-2 sm:grid-cols-3">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={loading}
              onClick={() => setMode(m.id)}
              className={`text-left p-3 rounded-lg border transition-colors disabled:opacity-60 ${
                mode === m.id
                  ? 'border-emerald-500/60 bg-emerald-500/5'
                  : 'border-border/50 bg-muted/30 hover:bg-muted/50'
              }`}
            >
              <p className="text-sm font-medium">{m.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{m.hint}</p>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleCreate} disabled={loading} className="gap-2">
            <Icon name={loading ? 'Loader2' : 'Download'} size={16} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Создаю копию…' : 'Создать копию'}
          </Button>
          <p className="text-xs text-muted-foreground">
            Работе сервиса не мешает. Выгрузка только читает данные.
          </p>
        </div>

        {loading && (
          <p className="text-xs text-muted-foreground">
            Выгрузка большой базы занимает до минуты — не закрывайте страницу.
          </p>
        )}

        {result && (
          <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Icon
                name={result.success ? 'ShieldCheck' : 'ShieldAlert'}
                size={16}
                className={result.success ? 'text-emerald-600' : 'text-destructive'}
              />
              <p className="text-sm font-medium">
                {result.success ? 'Проверка целостности пройдена' : 'Проверка не пройдена'}
              </p>
            </div>

            <div className="space-y-1">
              {result.checks?.map((c) => (
                <div key={c.name} className="flex items-start gap-2 text-xs">
                  <Icon
                    name={c.ok ? 'Check' : 'X'}
                    size={13}
                    className={`mt-0.5 shrink-0 ${c.ok ? 'text-emerald-600' : 'text-destructive'}`}
                  />
                  <span className={c.ok ? 'text-muted-foreground' : 'text-destructive'}>
                    {c.name} — {c.detail}
                  </span>
                </div>
              ))}
            </div>

            {result.success && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
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

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Button asChild size="sm" variant="outline" className="gap-2">
                    <a href={result.download_url} download={result.filename}>
                      <Icon name="Download" size={14} />
                      Скачать файл
                    </a>
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Ссылка действует 1 час и доступна только вам
                  </p>
                </div>

                <p className="text-[11px] text-muted-foreground/80 leading-relaxed pt-1">
                  Файл содержит персональные данные сотрудников и переписку по заявкам.
                  Храните его в защищённом месте, не выкладывайте в общий доступ.
                </p>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DatabaseBackupCard;
