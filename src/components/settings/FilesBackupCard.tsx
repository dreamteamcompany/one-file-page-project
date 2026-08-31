import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { apiFetch, getApiUrl } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';

type Check = { name: string; ok: boolean; detail: string };

type FilesResult = {
  success: boolean;
  created_at: string;
  files_packed: number;
  files_total: number;
  raw_bytes: number;
  size_bytes: number;
  sha256: string;
  checks: Check[];
  duration_sec: number;
  compressed?: boolean;
  truncated?: boolean;
  next_skip?: number;
  note?: string;
  missing_count?: number;
  oversized_count?: number;
  download_url?: string;
  parts?: { filename: string; url: string }[];
  expires_in_sec?: number;
  filename?: string;
  error?: string;
};

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
};

const FilesBackupCard = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FilesResult | null>(null);
  const [skip, setSkip] = useState(0);

  const handleCreate = async (fromSkip: number) => {
    setLoading(true);
    setResult(null);
    try {
      const url = `${getApiUrl('files_backup')}?resource=files_backup`;
      const res = await apiFetch(url, {
        method: 'POST',
        body: JSON.stringify({ compress: true, skip: fromSkip }),
      });

      const data: FilesResult = await res.json().catch(() => ({}) as FilesResult);

      if (res.ok && data.success) {
        setResult(data);
        setSkip(data.truncated && data.next_skip ? data.next_skip : 0);
        toast({
          title: data.truncated ? 'Архив создан частично' : 'Архив создан и проверен',
          description: `${data.files_packed} файлов, ${formatSize(data.size_bytes)}`,
        });
      } else {
        setResult(data && data.checks ? data : null);
        toast({
          title: 'Архив не создан',
          description: data?.error || 'Не удалось выполнить выгрузку',
          variant: 'destructive',
        });
      }
    } catch (e) {
      console.error(e);
      toast({
        title: 'Ошибка соединения',
        description: 'Выгрузка могла прерваться по времени. Попробуйте ещё раз.',
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
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-sky-500/10">
            <Icon name="FileArchive" size={20} className="text-sky-600" />
          </div>
          <div>
            <CardTitle className="text-base">Резервная копия вложений</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Файлы из заявок и комментариев одним архивом, с проверкой целостности
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => handleCreate(skip)} disabled={loading} className="gap-2">
            <Icon
              name={loading ? 'Loader2' : 'Download'}
              size={16}
              className={loading ? 'animate-spin' : ''}
            />
            {loading
              ? 'Собираю архив…'
              : skip > 0
                ? `Продолжить с ${skip + 1}-го файла`
                : 'Создать архив'}
          </Button>
          {skip > 0 && !loading && (
            <Button variant="ghost" size="sm" onClick={() => setSkip(0)}>
              Начать сначала
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            Файлы раскладываются по папкам заявок
          </p>
        </div>

        {loading && (
          <p className="text-xs text-muted-foreground">
            Сборка занимает до нескольких минут — не закрывайте страницу.
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
                    <p className="text-muted-foreground">Файлов</p>
                    <p className="font-medium">
                      {result.files_packed} из {result.files_total}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Исходный объём</p>
                    <p className="font-medium">{formatSize(result.raw_bytes)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Архив</p>
                    <p className="font-medium">{formatSize(result.size_bytes)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Заняло</p>
                    <p className="font-medium">{result.duration_sec} с</p>
                  </div>
                </div>

                {result.truncated && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2.5">
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-500">
                      Архив неполный
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {result.note} Скачайте этот архив, затем нажмите «Продолжить» —
                      получите следующий архив с остальными файлами.
                    </p>
                  </div>
                )}

                {(result.missing_count || result.oversized_count) && (
                  <p className="text-xs text-muted-foreground">
                    {result.missing_count
                      ? `Не найдено в хранилище: ${result.missing_count}. `
                      : ''}
                    {result.oversized_count
                      ? `Пропущено как слишком крупные: ${result.oversized_count}.`
                      : ''}
                  </p>
                )}

                <div className="space-y-2 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {(result.parts && result.parts.length > 0
                      ? result.parts
                      : [
                          {
                            filename: result.filename || 'files.zip',
                            url: result.download_url || '',
                          },
                        ]
                    ).map((p, i) => (
                      <Button key={p.filename} asChild size="sm" variant="outline" className="gap-2">
                        <a href={p.url} download={p.filename}>
                          <Icon name="Download" size={14} />
                          {result.parts && result.parts.length > 1
                            ? `Часть ${i + 1}`
                            : 'Скачать архив'}
                        </a>
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ссылки действуют 1 час и доступны только вам
                  </p>
                  {result.parts && result.parts.length > 1 && (
                    <div className="rounded-md bg-muted/40 border border-border/50 p-2.5 space-y-1">
                      <p className="text-xs font-medium">
                        Архив разбит на {result.parts.length} частей
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Скачайте все части в одну папку и склейте их в один файл.
                        Порядок важен.
                      </p>
                      <code className="block text-[11px] bg-background/60 rounded px-2 py-1 mt-1 overflow-x-auto">
                        cat {result.filename}.part* &gt; {result.filename}
                      </code>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FilesBackupCard;
