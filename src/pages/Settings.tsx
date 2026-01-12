import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import PaymentsSidebar from '@/components/payments/PaymentsSidebar';
import ScheduledPaymentsSettings from '@/components/settings/ScheduledPaymentsSettings';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';

const CLEAR_DATA_API = 'https://functions.poehali.dev/69d0e8e7-3feb-4d34-9a63-64521e899118';

const Settings = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dictionariesOpen, setDictionariesOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [clearing, setClearing] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const { toast } = useToast();

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (touchStart - touchEnd > 75) {
      setMenuOpen(false);
    }
  };

  const handleClearAllData = async () => {
    if (confirmText !== 'УДАЛИТЬ ВСЁ') {
      toast({
        title: 'Ошибка',
        description: 'Введите "УДАЛИТЬ ВСЁ" для подтверждения',
        variant: 'destructive',
      });
      return;
    }

    setClearing(true);
    try {
      const response = await fetch(CLEAR_DATA_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error('Failed to clear data');

      const result = await response.json();
      
      toast({
        title: 'Данные удалены',
        description: `Очищено таблиц: ${result.tables_cleared}`,
      });

      setConfirmText('');
      
      // Перезагрузим страницу через 2 секунды
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (error) {
      console.error('Failed to clear data:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось очистить данные',
        variant: 'destructive',
      });
    } finally {
      setClearing(false);
    }
  };

  const dataCategories = [
    { name: 'Платежи', icon: 'CreditCard' },
    { name: 'На согласовании', icon: 'Clock' },
    { name: 'Согласованные и оплаченные', icon: 'CheckCircle' },
    { name: 'Отклонённые', icon: 'XCircle' },
    { name: 'Реестр экономии', icon: 'TrendingDown' },
    { name: 'Юридические лица', icon: 'Building2' },
    { name: 'Категории платежей', icon: 'FolderTree' },
    { name: 'Дополнительные поля', icon: 'ListPlus' },
    { name: 'Контрагенты', icon: 'Users' },
    { name: 'Отделы-заказчики', icon: 'Briefcase' },
    { name: 'Сервисы', icon: 'Server' },
    { name: 'Причины экономии', icon: 'FileText' },
    { name: 'История согласований', icon: 'History' },
    { name: 'История изменений', icon: 'GitCommit' },
    { name: 'Анализатор логов', icon: 'FileSearch' },
  ];

  return (
    <div className="flex min-h-screen">
      <PaymentsSidebar
        menuOpen={menuOpen}
        dictionariesOpen={dictionariesOpen}
        setDictionariesOpen={setDictionariesOpen}
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        handleTouchStart={handleTouchStart}
        handleTouchMove={handleTouchMove}
        handleTouchEnd={handleTouchEnd}
      />

      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <main className="lg:ml-[250px] p-4 md:p-6 lg:p-[30px] min-h-screen flex-1 overflow-x-hidden max-w-full">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="lg:hidden p-2 text-white"
            >
              <Icon name="Menu" size={24} />
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Основные настройки</h1>
              <p className="text-sm md:text-base text-muted-foreground mt-1">
                Управление данными проекта
              </p>
            </div>
          </div>
        </header>

        <div className="grid gap-6">
          <ScheduledPaymentsSettings />
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon name="Trash2" size={24} className="text-destructive" />
                Опасная зона
              </CardTitle>
              <CardDescription>
                Действия в этой зоне необратимы. Будьте осторожны!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Icon name="AlertTriangle" size={20} className="text-destructive" />
                  Очистка всех данных
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Это действие удалит все данные из следующих разделов:
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
                  {dataCategories.map((category) => (
                    <div
                      key={category.name}
                      className="flex items-center gap-2 text-sm p-2 rounded bg-card"
                    >
                      <Icon name={category.icon} size={16} className="text-muted-foreground" />
                      <span>{category.name}</span>
                    </div>
                  ))}
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full sm:w-auto">
                      <Icon name="Trash2" size={18} className="mr-2" />
                      Очистить всю информацию
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <Icon name="AlertTriangle" size={24} className="text-destructive" />
                        Вы абсолютно уверены?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Это действие необратимо. Все данные будут безвозвратно удалены из базы данных.
                        <br />
                        <br />
                        Для подтверждения введите: <strong>УДАЛИТЬ ВСЁ</strong>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    
                    <div className="py-4">
                      <Input
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder="Введите УДАЛИТЬ ВСЁ"
                        className="font-mono"
                      />
                    </div>

                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setConfirmText('')}>
                        Отмена
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleClearAllData}
                        disabled={clearing || confirmText !== 'УДАЛИТЬ ВСЁ'}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        {clearing ? (
                          <>
                            <Icon name="Loader2" size={18} className="mr-2 animate-spin" />
                            Удаление...
                          </>
                        ) : (
                          'Удалить всё'
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon name="Info" size={24} />
                Информация о проекте
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Версия проекта</span>
                <span className="font-medium">1.0.0</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">База данных</span>
                <span className="font-medium">PostgreSQL</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Статус</span>
                <span className="font-medium text-green-500 flex items-center gap-1">
                  <Icon name="CheckCircle" size={16} />
                  Активен
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Settings;