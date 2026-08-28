import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, API_URL, cachedJsonFetch, invalidateCache } from '@/utils/api';
import PaymentsSidebar from '@/components/payments/PaymentsSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

interface TicketPriority {
  id: number;
  name: string;
  level: number;
  color: string;
  description: string;
  is_critical: boolean;
}

const predefinedColors = [
  { name: 'Серый', value: '#6b7280' },
  { name: 'Синий', value: '#3b82f6' },
  { name: 'Зелёный', value: '#22c55e' },
  { name: 'Жёлтый', value: '#eab308' },
  { name: 'Оранжевый', value: '#f97316' },
  { name: 'Красный', value: '#ef4444' },
  { name: 'Фиолетовый', value: '#a855f7' },
  { name: 'Розовый', value: '#ec4899' },
];

const TicketPriorities = () => {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [priorities, setPriorities] = useState<TicketPriority[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPriority, setEditingPriority] = useState<TicketPriority | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    level: 1,
    color: '#3b82f6',
    description: '',
    is_critical: false,
  });
  const [dictionariesOpen, setDictionariesOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  useEffect(() => {
    if (!hasPermission('ticket_priorities', 'read')) {
      navigate('/tickets');
      return;
    }
    loadPriorities();
  }, [hasPermission, navigate]);

  if (!hasPermission('ticket_priorities', 'read')) {
    return null;
  }

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

  // Приоритеты почти не меняются — держим ответ в кэше 10 минут.
  // После создания/изменения/удаления кэш сбрасывается принудительно.
  const PRIORITIES_TTL_MS = 10 * 60 * 1000;

  const loadPriorities = (force = false) => {
    if (force) invalidateCache('endpoint=ticket-priorities');
    cachedJsonFetch<TicketPriority[]>(`${API_URL}?endpoint=ticket-priorities`, {}, PRIORITIES_TTL_MS)
      .then((data) => {
        setPriorities(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load ticket priorities:', err);
        setPriorities([]);
        setLoading(false);
      });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const requiredPermission = editingPriority ? 'update' : 'create';
    if (!hasPermission('ticket_priorities', requiredPermission)) {
      alert('У вас нет прав для этой операции');
      return;
    }
    
    try {
      const url = `${API_URL}?endpoint=ticket-priorities`;
      const method = editingPriority ? 'PUT' : 'POST';
      const body = editingPriority 
        ? { id: editingPriority.id, ...formData }
        : formData;

      const response = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setDialogOpen(false);
        setEditingPriority(null);
        setFormData({ name: '', level: 1, color: '#3b82f6', description: '', is_critical: false });
        loadPriorities(true);
      }
    } catch (err) {
      console.error('Failed to save priority:', err);
    }
  };

  const handleEdit = (priority: TicketPriority) => {
    if (!hasPermission('ticket_priorities', 'update')) {
      alert('У вас нет прав для редактирования приоритетов');
      return;
    }
    
    setEditingPriority(priority);
    setFormData({ 
      name: priority.name, 
      level: priority.level,
      color: priority.color,
      description: priority.description || '',
      is_critical: priority.is_critical || false,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!hasPermission('ticket_priorities', 'remove')) {
      alert('У вас нет прав для удаления приоритетов');
      return;
    }
    
    if (!confirm('Вы уверены, что хотите удалить этот приоритет?')) return;

    try {
      const response = await apiFetch(
        `${API_URL}?endpoint=ticket-priorities`,
        { 
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id })
        }
      );

      if (response.ok) {
        loadPriorities(true);
      } else {
        const data = await response.json();
        alert(data.error || 'Не удалось удалить приоритет');
      }
    } catch (err) {
      console.error('Failed to delete priority:', err);
    }
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingPriority(null);
      setFormData({ name: '', level: 1, color: '#3b82f6', description: '', is_critical: false });
    }
  };

  return (
    <div className="flex min-h-screen">
      <PaymentsSidebar
        menuOpen={menuOpen}
        dictionariesOpen={dictionariesOpen}
        setDictionariesOpen={setDictionariesOpen}
        settingsOpen={false}
        setSettingsOpen={() => {}}
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
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 md:mb-[30px] px-4 md:px-[25px] py-4 md:py-[18px] bg-[#1b254b]/50 backdrop-blur-[20px] rounded-[15px] border border-border">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="lg:hidden p-2 text-foreground"
          >
            <Icon name="Menu" size={24} />
          </button>
          <div className="flex items-center gap-3 bg-card border border-border rounded-[15px] px-4 md:px-5 py-2 md:py-[10px] w-full sm:w-[300px] lg:w-[400px]">
            <Icon name="Search" size={20} className="text-muted-foreground" />
            <Input 
              type="text" 
              placeholder="Поиск приоритетов..." 
              className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto"
            />
          </div>
          <div className="flex items-center gap-2 md:gap-3 px-3 md:px-[15px] py-2 md:py-[10px] rounded-[12px] bg-accent/50 border border-border">
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-[10px] bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-white text-sm md:text-base">
              А
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-medium">Администратор</div>
              <div className="text-xs text-muted-foreground">Администратор</div>
            </div>
          </div>
        </header>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">Приоритеты заявок</h1>
            <p className="text-muted-foreground">Управление приоритетами для системы заявок</p>
          </div>
          {hasPermission('ticket_priorities', 'create') && (
            <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90">
                  <Icon name="Plus" size={20} className="mr-2" />
                  Добавить приоритет
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingPriority ? 'Редактировать приоритет' : 'Новый приоритет'}</DialogTitle>
                  <DialogDescription>
                    {editingPriority ? 'Измените данные приоритета' : 'Создайте новый приоритет для заявок'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Название</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Например: Высокий"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Описание</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Краткое описание приоритета"
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label htmlFor="level">Уровень (чем выше - тем важнее)</Label>
                    <Input
                      id="level"
                      type="number"
                      min="1"
                      value={formData.level}
                      onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                  <div>
                    <Label>Цвет</Label>
                    <div className="grid grid-cols-4 gap-2 mt-2">
                      {predefinedColors.map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, color: color.value })}
                          className={`h-10 rounded-md border-2 transition-all ${
                            formData.color === color.value 
                              ? 'border-primary scale-110' 
                              : 'border-transparent hover:border-primary/50'
                          }`}
                          style={{ backgroundColor: color.value }}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <Label htmlFor="is_critical" className="cursor-pointer">Критично</Label>
                      <p className="text-xs text-muted-foreground">Заявки с этим приоритетом будут помечены как критичные</p>
                    </div>
                    <Switch
                      id="is_critical"
                      checked={formData.is_critical}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_critical: checked })}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>
                      Отмена
                    </Button>
                    <Button type="submit">
                      {editingPriority ? 'Сохранить' : 'Создать'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Icon name="Loader2" size={32} className="animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {priorities.sort((a, b) => a.level - b.level).map((priority) => (
              <Card key={priority.id} className="bg-card/50 backdrop-blur border-border">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: priority.color }}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">{priority.name}</h3>
                          {priority.is_critical && (
                            <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-medium">
                              Критично
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">Уровень: {priority.level}</p>
                      </div>
                    </div>
                  </div>
                  {priority.description && (
                    <p className="text-sm text-muted-foreground mb-4">{priority.description}</p>
                  )}
                  <div className="flex gap-2">
                    {hasPermission('ticket_priorities', 'update') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(priority)}
                        className="flex-1"
                      >
                        <Icon name="Pencil" size={16} className="mr-1" />
                        Изменить
                      </Button>
                    )}
                    {hasPermission('ticket_priorities', 'remove') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(priority.id)}
                        className="text-destructive hover:bg-destructive/10"
                      >
                        <Icon name="Trash2" size={16} />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default TicketPriorities;