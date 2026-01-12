import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const ScheduledPaymentsSettings = () => {
  const { token } = useAuth();
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const handleProcessNow = async () => {
    setProcessing(true);
    try {
      const response = await fetch('https://functions.poehali.dev/eeefc720-2351-43cd-804d-44fbd748ab8f', {
        headers: {
          'X-Auth-Token': token || '',
        },
      });

      if (response.ok) {
        const result = await response.json();
        setLastRun(new Date().toLocaleString('ru-RU'));
        
        toast({
          title: 'Обработка завершена',
          description: `Создано платежей: ${result.processed_count}`,
        });
      } else {
        const error = await response.json();
        toast({
          title: 'Ошибка',
          description: error.error || 'Не удалось обработать платежи',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Failed to process scheduled payments:', err);
      toast({
        title: 'Ошибка сети',
        description: 'Проверьте подключение к интернету',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card className="border-white/10 bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon name="CalendarClock" size={24} />
          Автоматическая обработка запланированных платежей
        </CardTitle>
        <CardDescription>
          Система автоматически создаёт реальные платежи из запланированных, когда наступает их дата
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Icon name="Info" size={20} className="text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-2 text-sm">
              <p className="text-blue-200 font-medium">Как работает автоматическая обработка:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-200/80">
                <li>Система проверяет запланированные платежи каждый день</li>
                <li>Если дата платежа наступила, создаётся реальный платёж в статусе "Черновик"</li>
                <li>Для повторяющихся платежей автоматически планируется следующая дата</li>
                <li>Вы можете запустить обработку вручную в любое время</li>
              </ul>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-white/5 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Запустить обработку вручную</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Проверить и создать платежи из всех запланированных
                </p>
              </div>
              <Button
                onClick={handleProcessNow}
                disabled={processing}
                className="gap-2"
              >
                <Icon name={processing ? "Loader2" : "Play"} size={16} className={processing ? "animate-spin" : ""} />
                {processing ? 'Обработка...' : 'Запустить сейчас'}
              </Button>
            </div>

            {lastRun && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t border-white/10">
                <Icon name="Clock" size={16} />
                <span>Последний запуск: {lastRun}</span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Icon name="Repeat" size={18} />
              Типы повторения
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="font-medium text-sm">Однократно</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Платёж создаётся один раз в указанную дату
                </p>
              </div>
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="font-medium text-sm">Ежедневно</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Создаётся каждый день до конечной даты
                </p>
              </div>
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="font-medium text-sm">Еженедельно</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Создаётся раз в неделю (каждые 7 дней)
                </p>
              </div>
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="font-medium text-sm">Ежемесячно</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Создаётся раз в месяц (каждые 30 дней)
                </p>
              </div>
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="font-medium text-sm">Ежегодно</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Создаётся раз в год (каждые 365 дней)
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ScheduledPaymentsSettings;
