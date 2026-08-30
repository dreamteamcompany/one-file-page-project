import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { apiFetch } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';
import { FN } from '@/config/backend';

const CLASSIFY_URL = FN.CLASSIFY_TICKET;

interface TestResult {
  result: {
    ticket_service_id: number;
    ticket_service_name: string;
    service_ids: number[];
    service_names: string[];
    confidence: number;
  };
  debug: {
    prompt: string;
    raw_response: string;
    examples_count: number;
    rules_count: number;
    examples_text: string;
    rules_text: string;
  };
}

const getConfidenceColor = (confidence: number) => {
  if (confidence >= 80) return 'text-green-500';
  if (confidence >= 50) return 'text-yellow-500';
  return 'text-red-500';
};

const getConfidenceBg = (confidence: number) => {
  if (confidence >= 80) return 'bg-green-500/10 border-green-500/30';
  if (confidence >= 50) return 'bg-yellow-500/10 border-yellow-500/30';
  return 'bg-red-500/10 border-red-500/30';
};

const TestTab = () => {
  const { toast } = useToast();

  const [testText, setTestText] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const runTest = async () => {
    if (!testText.trim()) {
      toast({ title: 'Введите текст заявки', variant: 'destructive' });
      return;
    }
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await apiFetch(CLASSIFY_URL, {
        method: 'POST',
        body: JSON.stringify({ description: testText.trim(), test_mode: true }),
      });
      if (res.ok) {
        setTestResult(await res.json());
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: err.error || 'Ошибка классификации', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Ошибка соединения', variant: 'destructive' });
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Тестирование классификации</CardTitle>
          <CardDescription className="text-xs mt-1">
            Введите текст заявки и посмотрите, как AI её классифицирует с учётом ваших правил и примеров
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Textarea
              value={testText}
              onChange={e => setTestText(e.target.value)}
              placeholder="Например: Не могу зайти в базу Stoma1C, выдаёт ошибку подключения к серверу"
              rows={3}
            />
            <Button
              onClick={runTest}
              disabled={testLoading || !testText.trim()}
              className="gap-2"
            >
              {testLoading ? (
                <Icon name="Loader2" size={16} className="animate-spin" />
              ) : (
                <Icon name="Play" size={16} />
              )}
              {testLoading ? 'Классификация...' : 'Классифицировать'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {testResult && (
        <>
          <Card className={`border ${getConfidenceBg(testResult.result.confidence)}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Результат</CardTitle>
                <div className={`text-2xl font-bold ${getConfidenceColor(testResult.result.confidence)}`}>
                  {testResult.result.confidence}%
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Icon name="Tag" size={16} className="text-muted-foreground flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">Услуга:</span>
                  <Badge variant="secondary">{testResult.result.ticket_service_name}</Badge>
                </div>
                <div className="flex items-start gap-2">
                  <Icon name="Server" size={16} className="text-muted-foreground flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">Сервисы:</span>
                  <div className="flex flex-wrap gap-1">
                    {testResult.result.service_names.map((name, i) => (
                      <Badge key={i} variant="outline">{name}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Icon name="Info" size={16} />
                Детали обучения
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Icon name="BookOpen" size={14} className="text-blue-500" />
                    <span className="text-muted-foreground">Примеров:</span>
                    <span className="font-medium">{testResult.debug.examples_count}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Icon name="Lightbulb" size={14} className="text-purple-500" />
                    <span className="text-muted-foreground">Правил:</span>
                    <span className="font-medium">{testResult.debug.rules_count}</span>
                  </div>
                </div>

                {testResult.debug.rules_text && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Применённые правила:</p>
                    <pre className="text-xs bg-muted/30 rounded-lg p-3 whitespace-pre-wrap overflow-auto max-h-32">
                      {testResult.debug.rules_text}
                    </pre>
                  </div>
                )}

                {testResult.debug.examples_text && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Использованные примеры:</p>
                    <pre className="text-xs bg-muted/30 rounded-lg p-3 whitespace-pre-wrap overflow-auto max-h-32">
                      {testResult.debug.examples_text}
                    </pre>
                  </div>
                )}

                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Ответ AI (raw):</p>
                  <pre className="text-xs bg-muted/30 rounded-lg p-3 whitespace-pre-wrap overflow-auto max-h-20">
                    {testResult.debug.raw_response}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default TestTab;
