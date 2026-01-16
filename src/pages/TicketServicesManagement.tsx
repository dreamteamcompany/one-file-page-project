import { useState, useEffect } from 'react';
import { apiFetch, API_URL } from '@/utils/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import PaymentsSidebar from '@/components/payments/PaymentsSidebar';
import { useToast } from '@/hooks/use-toast';

interface TicketService {
  id: number;
  name: string;
  description: string;
  ticket_title?: string;
  category_id?: number;
  category_name?: string;
  created_at: string;
  service_ids?: number[];
}

interface Service {
  id: number;
  name: string;
  description: string;
  category_id?: number;
  category_name?: string;
}

interface Category {
  id: number;
  name: string;
  icon: string;
}

const TicketServicesManagement = () => {
  const [ticketServices, setTicketServices] = useState<TicketService[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<TicketService | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dictionariesOpen, setDictionariesOpen] = useState(true);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    ticket_title: '',
    category_id: '',
  });

  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);

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

  useEffect(() => {
    loadTicketServices();
    loadServices();
    loadCategories();
  }, []);

  const loadTicketServices = async () => {
    try {
      const response = await apiFetch(`${API_URL}?endpoint=ticket-services`);
      const data = await response.json();
      setTicketServices(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load ticket services:', error);
      setTicketServices([]);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить услуги заявок',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadServices = async () => {
    try {
      const response = await apiFetch(`${API_URL}?endpoint=services`);
      const data = await response.json();
      setServices(data.services || []);
    } catch (error) {
      console.error('Failed to load services:', error);
      setServices([]);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await apiFetch(`${API_URL}?endpoint=ticket-service-categories`);
      const data = await response.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load categories:', error);
      setCategories([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      toast({
        title: 'Ошибка',
        description: 'Заполните название услуги',
        variant: 'destructive',
      });
      return;
    }

    try {
      const url = editingService
        ? `${API_URL}?endpoint=ticket-services&id=${editingService.id}`
        : `${API_URL}?endpoint=ticket-services`;

      const response = await apiFetch(url, {
        method: editingService ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          ticket_title: formData.ticket_title,
          category_id: formData.category_id ? parseInt(formData.category_id) : null,
          service_ids: selectedServiceIds,
        }),
      });

      if (response.ok) {
        toast({
          title: 'Успешно',
          description: editingService ? 'Услуга обновлена' : 'Услуга создана',
        });
        setDialogOpen(false);
        resetForm();
        loadTicketServices();
      } else {
        throw new Error('Failed to save ticket service');
      }
    } catch (error) {
      console.error('Failed to save ticket service:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить услугу',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (ticketService: TicketService) => {
    setEditingService(ticketService);
    setFormData({
      name: ticketService.name,
      description: ticketService.description || '',
      ticket_title: ticketService.ticket_title || '',
      category_id: ticketService.category_id ? ticketService.category_id.toString() : '',
    });
    setSelectedServiceIds(ticketService.service_ids || []);
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить эту услугу заявки?')) return;

    try {
      const response = await apiFetch(`${API_URL}?endpoint=ticket-services&id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: 'Успешно',
          description: 'Услуга удалена',
        });
        loadTicketServices();
      } else {
        const errorData = await response.json();
        toast({
          title: 'Ошибка',
          description: errorData.error || 'Не удалось удалить услугу',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to delete ticket service:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить услугу',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      ticket_title: '',
      category_id: '',
    });
    setSelectedServiceIds([]);
    setEditingService(null);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      resetForm();
    }
  };

  const toggleService = (serviceId: number) => {
    setSelectedServiceIds(prev =>
      prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  // Показываем все сервисы (не фильтруем по категории)
  const filteredServices = services;

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

      <div className="flex-1 lg:pl-[250px]">
        <header className="bg-card border-b border-border sticky top-0 z-30">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="lg:hidden p-2 hover:bg-accent rounded-lg"
              >
                <Icon name="Menu" size={20} />
              </button>
              <h1 className="text-2xl font-bold">Услуги заявок</h1>
            </div>
            <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
              <DialogTrigger asChild>
                <Button>
                  <Icon name="Plus" size={20} className="mr-2" />
                  Добавить услугу
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingService ? 'Редактировать услугу' : 'Новая услуга заявки'}</DialogTitle>
                  <DialogDescription>
                    Заполните информацию об услуге и выберите привязанные сервисы
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Название *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Например: Доступ к серверу"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Описание</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Краткое описание услуги"
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="ticket_title">Название заявки</Label>
                    <Input
                      id="ticket_title"
                      value={formData.ticket_title}
                      onChange={(e) => setFormData({ ...formData, ticket_title: e.target.value })}
                      placeholder="Например: Заявка на {название услуги}"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Это название будет использоваться автоматически при создании заявки
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="category_id">Категория</Label>
                    <Select
                      value={formData.category_id}
                      onValueChange={(value) => {
                        setFormData({ ...formData, category_id: value });
                        setSelectedServiceIds([]);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите категорию" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id.toString()}>
                            <div className="flex items-center gap-2">
                              <Icon name={category.icon} size={16} />
                              {category.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label>Привязанные сервисы</Label>
                    <p className="text-sm text-muted-foreground">
                      Выберите сервисы, которые относятся к этой услуге
                    </p>
                    {filteredServices.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground">
                        <p>Нет доступных сервисов. Создайте сервисы на странице "Сервисы услуг"</p>
                      </div>
                    ) : (
                      <div className="border rounded-lg p-4 space-y-3 max-h-[300px] overflow-y-auto">
                        {filteredServices.map((service) => (
                          <div key={service.id} className="flex items-start space-x-3">
                            <Checkbox
                              id={`service-${service.id}`}
                              checked={selectedServiceIds.includes(service.id)}
                              onCheckedChange={() => toggleService(service.id)}
                            />
                            <div className="flex-1">
                              <label
                                htmlFor={`service-${service.id}`}
                                className="text-sm font-medium cursor-pointer"
                              >
                                {service.name}
                              </label>
                              {service.description && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {service.description}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {selectedServiceIds.length > 0 && (
                      <div className="flex flex-wrap gap-2 p-3 bg-accent/30 rounded-lg">
                        <span className="text-sm font-medium">Выбрано: {selectedServiceIds.length}</span>
                        {selectedServiceIds.map(id => {
                          const service = services.find(s => s.id === id);
                          return service ? (
                            <Badge key={id} variant="secondary">
                              {service.name}
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button type="submit" className="flex-1">
                      {editingService ? 'Сохранить' : 'Создать'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>
                      Отмена
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Icon name="Loader2" size={32} className="animate-spin" />
            </div>
          ) : ticketServices.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Icon name="Package" size={48} className="text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Нет услуг заявок</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Все услуги заявок</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Название</TableHead>
                      <TableHead>Категория</TableHead>
                      <TableHead>Название заявки</TableHead>
                      <TableHead>Описание</TableHead>
                      <TableHead>Сервисов</TableHead>
                      <TableHead className="text-right">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ticketServices.map((service) => (
                      <TableRow key={service.id}>
                        <TableCell className="font-medium">{service.name}</TableCell>
                        <TableCell>
                          {service.category_name && (
                            <Badge variant="secondary">{service.category_name}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {service.ticket_title || '—'}
                        </TableCell>
                        <TableCell className="max-w-md truncate">{service.description}</TableCell>
                        <TableCell>
                          <Badge>{service.service_ids?.length || 0}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(service)}
                            >
                              <Icon name="Pencil" size={16} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(service.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Icon name="Trash2" size={16} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketServicesManagement;