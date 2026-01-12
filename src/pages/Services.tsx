import { useState, useEffect } from 'react';
import { apiFetch } from '@/utils/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import Icon from '@/components/ui/icon';
import PaymentsSidebar from '@/components/payments/PaymentsSidebar';
import { useToast } from '@/hooks/use-toast';

const BACKEND_URL = 'https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd';

interface User {
  id: number;
  full_name: string;
  role: string;
}

interface CustomerDepartment {
  id: number;
  name: string;
  description: string;
}

interface Category {
  id: number;
  name: string;
  icon: string;
}

interface Service {
  id: number;
  name: string;
  description: string;
  intermediate_approver_id: number;
  final_approver_id: number;
  intermediate_approver_name?: string;
  final_approver_name?: string;
  customer_department_id?: number;
  customer_department_name?: string;
  category_id?: number;
  category_name?: string;
  category_icon?: string;
  created_at: string;
}

const Services = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<CustomerDepartment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dictionariesOpen, setDictionariesOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    final_approver_id: '',
    customer_department_id: '',
    category_id: '',
  });

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
    loadServices();
    loadUsers();
    loadDepartments();
    loadCategories();
  }, []);

  const loadServices = async () => {
    try {
      const response = await apiFetch(`${BACKEND_URL}?endpoint=services`);
      const data = await response.json();
      setServices(data.services || []);
    } catch (error) {
      console.error('Failed to load services:', error);
      setServices([]);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить сервисы',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await apiFetch(`${BACKEND_URL}?endpoint=users`);
      const data = await response.json();
      setUsers(Array.isArray(data) ? data : data.users || []);
    } catch (error) {
      console.error('Failed to load users:', error);
      setUsers([]);
    }
  };

  const loadDepartments = async () => {
    try {
      const response = await apiFetch(`${BACKEND_URL}?endpoint=customer-departments`);
      const data = await response.json();
      setDepartments(Array.isArray(data) ? data : data.departments || []);
    } catch (error) {
      console.error('Failed to load departments:', error);
      setDepartments([]);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await apiFetch(`${BACKEND_URL}?endpoint=categories`);
      const data = await response.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load categories:', error);
      setCategories([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.final_approver_id) {
      toast({
        title: 'Ошибка',
        description: 'Заполните все обязательные поля',
        variant: 'destructive',
      });
      return;
    }

    try {
      const url = editingService
        ? `${BACKEND_URL}?endpoint=services&id=${editingService.id}`
        : `${BACKEND_URL}?endpoint=services`;

      const response = await apiFetch(url, {
        method: editingService ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          intermediate_approver_id: parseInt(formData.final_approver_id),
          final_approver_id: parseInt(formData.final_approver_id),
          customer_department_id: formData.customer_department_id ? parseInt(formData.customer_department_id) : null,
          category_id: formData.category_id ? parseInt(formData.category_id) : null,
        }),
      });

      if (response.ok) {
        toast({
          title: 'Успешно',
          description: editingService ? 'Сервис обновлён' : 'Сервис создан',
        });
        setDialogOpen(false);
        resetForm();
        loadServices();
      } else {
        throw new Error('Failed to save service');
      }
    } catch (error) {
      console.error('Failed to save service:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить сервис',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || '',
      final_approver_id: service.final_approver_id.toString(),
      customer_department_id: service.customer_department_id ? service.customer_department_id.toString() : '',
      category_id: service.category_id ? service.category_id.toString() : '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить этот сервис?')) return;

    try {
      const response = await apiFetch(`${BACKEND_URL}?endpoint=services&id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: 'Успешно',
          description: 'Сервис удалён',
        });
        loadServices();
      } else {
        throw new Error('Failed to delete service');
      }
    } catch (error) {
      console.error('Failed to delete service:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить сервис',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      final_approver_id: '',
      customer_department_id: '',
      category_id: '',
    });
    setEditingService(null);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      resetForm();
    }
  };

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
            <h1 className="text-2xl font-bold">Сервисы</h1>
          </div>

          <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <Button>
                <Icon name="Plus" size={18} className="mr-2" />
                Создать сервис
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingService ? 'Редактировать сервис' : 'Создать сервис'}
                </DialogTitle>
                <DialogDescription>
                  Укажите название сервиса и согласующих лиц
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Название *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Например: AWS Cloud Services"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">Описание</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Краткое описание сервиса"
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="category">Категория сервиса</Label>
                  <Select
                    value={formData.category_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, category_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите категорию" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>
                          <div className="flex items-center gap-2">
                            <Icon name={cat.icon} size={16} />
                            {cat.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="department">Отдел-заказчик</Label>
                  <Select
                    value={formData.customer_department_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, customer_department_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите отдел" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id.toString()}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="final">Согласующее лицо (CEO) *</Label>
                  <Select
                    value={formData.final_approver_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, final_approver_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите пользователя" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>
                    Отмена
                  </Button>
                  <Button type="submit">
                    {editingService ? 'Сохранить' : 'Создать'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Все сервисы</CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            {loading ? (
              <div className="text-center py-8">Загрузка...</div>
            ) : services.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Нет созданных сервисов
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Название</TableHead>
                    <TableHead>Категория</TableHead>
                    <TableHead>Описание</TableHead>
                    <TableHead>Отдел-заказчик</TableHead>
                    <TableHead>Промежуточное согласование</TableHead>
                    <TableHead>Окончательное согласование</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell className="font-medium">{service.name}</TableCell>
                      <TableCell>
                        {service.category_name ? (
                          <div className="flex items-center gap-2">
                            <Icon name={service.category_icon || 'Tag'} size={16} />
                            {service.category_name}
                          </div>
                        ) : '—'}
                      </TableCell>
                      <TableCell>{service.description || '—'}</TableCell>
                      <TableCell>{service.customer_department_name || '—'}</TableCell>
                      <TableCell>{service.intermediate_approver_name || '—'}</TableCell>
                      <TableCell>{service.final_approver_name || '—'}</TableCell>
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
                          >
                            <Icon name="Trash2" size={16} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Services;