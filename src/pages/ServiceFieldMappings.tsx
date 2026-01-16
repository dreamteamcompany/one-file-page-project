import { useEffect, useState } from 'react';
import { apiFetch, API_URL } from '@/utils/api';
import PaymentsSidebar from '@/components/payments/PaymentsSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ServiceCategory {
  id: number;
  name: string;
  icon?: string;
}

interface Service {
  id: number;
  name: string;
  description?: string;
  category_id: number;
}

interface FieldGroup {
  id: number;
  name: string;
  description?: string;
  field_ids: number[];
}

interface ServiceFieldMapping {
  id: number;
  service_category_id: number;
  service_id: number;
  field_group_ids: number[];
  created_at?: string;
  updated_at?: string;
}

const ServiceFieldMappings = () => {
  const [mappings, setMappings] = useState<ServiceFieldMapping[]>([]);
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [fieldGroups, setFieldGroups] = useState<FieldGroup[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<ServiceFieldMapping | null>(null);
  const [formData, setFormData] = useState({
    service_category_id: 0,
    service_id: 0,
    field_group_ids: [] as number[],
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Load service categories from API
    try {
      const response = await apiFetch(`${API_URL}?endpoint=ticket-service-categories`);
      const data = await response.json();
      setServiceCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load service categories:', error);
      setServiceCategories([]);
    }

    // Load services from API
    try {
      const response = await apiFetch(`${API_URL}?endpoint=ticket-services`);
      const data = await response.json();
      setServices(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load services:', error);
      setServices([]);
    }

    // Load field groups from localStorage
    const savedFieldGroups = localStorage.getItem('customFieldGroups');
    if (savedFieldGroups) {
      setFieldGroups(JSON.parse(savedFieldGroups));
    }

    // Load mappings from localStorage
    const savedMappings = localStorage.getItem('serviceFieldMappings');
    if (savedMappings) {
      setMappings(JSON.parse(savedMappings));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.service_category_id || !formData.service_id) {
      alert('Выберите услугу и сервис');
      return;
    }

    if (editingMapping) {
      const updatedMappings = mappings.map((m) =>
        m.id === editingMapping.id
          ? { ...m, ...formData, updated_at: new Date().toISOString() }
          : m
      );
      setMappings(updatedMappings);
      localStorage.setItem('serviceFieldMappings', JSON.stringify(updatedMappings));
    } else {
      // Check if mapping already exists
      const exists = mappings.find(
        (m) =>
          m.service_category_id === formData.service_category_id &&
          m.service_id === formData.service_id
      );

      if (exists) {
        alert('Связь для этой комбинации услуги и сервиса уже существует');
        return;
      }

      const newMapping: ServiceFieldMapping = {
        id: Date.now(),
        ...formData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const updatedMappings = [...mappings, newMapping];
      setMappings(updatedMappings);
      localStorage.setItem('serviceFieldMappings', JSON.stringify(updatedMappings));
    }

    resetForm();
  };

  const handleEdit = (mapping: ServiceFieldMapping) => {
    setEditingMapping(mapping);
    setFormData({
      service_category_id: mapping.service_category_id,
      service_id: mapping.service_id,
      field_group_ids: mapping.field_group_ids,
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm('Удалить связь?')) {
      const updatedMappings = mappings.filter((m) => m.id !== id);
      setMappings(updatedMappings);
      localStorage.setItem('serviceFieldMappings', JSON.stringify(updatedMappings));
    }
  };

  const resetForm = () => {
    setFormData({
      service_category_id: 0,
      service_id: 0,
      field_group_ids: [],
    });
    setEditingMapping(null);
    setDialogOpen(false);
  };

  const toggleFieldGroup = (groupId: number) => {
    setFormData((prev) => ({
      ...prev,
      field_group_ids: prev.field_group_ids.includes(groupId)
        ? prev.field_group_ids.filter((id) => id !== groupId)
        : [...prev.field_group_ids, groupId],
    }));
  };

  const getCategoryName = (id: number) => {
    return serviceCategories.find((c) => c.id === id)?.name || 'Неизвестно';
  };

  const getServiceName = (id: number) => {
    return services.find((s) => s.id === id)?.name || 'Неизвестно';
  };

  const getFieldGroupNames = (ids: number[]) => {
    return ids.map((id) => fieldGroups.find((g) => g.id === id)?.name || 'Неизвестно');
  };

  const filteredServices = services.filter(
    (s) => s.category_id === formData.service_category_id
  );

  const filteredMappings = mappings.filter((mapping) => {
    const categoryName = getCategoryName(mapping.service_category_id).toLowerCase();
    const serviceName = getServiceName(mapping.service_id).toLowerCase();
    const query = searchQuery.toLowerCase();
    return categoryName.includes(query) || serviceName.includes(query);
  });

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <PaymentsSidebar
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />

      <div
        className="flex-1 overflow-y-auto"
        onTouchStart={(e) => setTouchStart(e.targetTouches[0].clientX)}
        onTouchMove={(e) => setTouchEnd(e.targetTouches[0].clientX)}
        onTouchEnd={() => {
          if (touchStart - touchEnd > 75) {
            setMenuOpen(false);
          }
        }}
      >
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setMenuOpen(true)}
              >
                <Icon name="Menu" size={24} />
              </Button>
              <div>
                <h1 className="text-3xl font-bold">Связь Услуги-Сервисы-Поля</h1>
                <p className="text-muted-foreground mt-1">
                  Настройте какие поля показывать для каждой комбинации услуги и сервиса
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Icon
                name="Search"
                size={18}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Поиск по услугам или сервисам..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => resetForm()} className="gap-2">
                  <Icon name="Plus" size={18} />
                  Добавить связь
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingMapping ? 'Редактировать связь' : 'Создать связь'}
                  </DialogTitle>
                  <DialogDescription>
                    Выберите услугу, сервис и группы полей для этой комбинации
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Услуга *</Label>
                    <Select
                      value={formData.service_category_id.toString()}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          service_category_id: parseInt(value),
                          service_id: 0,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите услугу" />
                      </SelectTrigger>
                      <SelectContent>
                        {serviceCategories.map((category) => (
                          <SelectItem key={category.id} value={category.id.toString()}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Сервис *</Label>
                    <Select
                      value={formData.service_id.toString()}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, service_id: parseInt(value) }))
                      }
                      disabled={!formData.service_category_id}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите сервис" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredServices.map((service) => (
                          <SelectItem key={service.id} value={service.id.toString()}>
                            {service.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!formData.service_category_id && (
                      <p className="text-xs text-muted-foreground">
                        Сначала выберите услугу
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Группы полей</Label>
                    <ScrollArea className="h-64 border rounded-md p-3">
                      {fieldGroups.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          Нет доступных групп полей.
                          <br />
                          Создайте их на странице "Дополнительные поля".
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {fieldGroups.map((group) => (
                            <div
                              key={group.id}
                              className="flex items-start space-x-2 p-2 hover:bg-accent rounded-md"
                            >
                              <Checkbox
                                id={`group-${group.id}`}
                                checked={formData.field_group_ids.includes(group.id)}
                                onCheckedChange={() => toggleFieldGroup(group.id)}
                              />
                              <div className="flex-1">
                                <label
                                  htmlFor={`group-${group.id}`}
                                  className="text-sm font-medium cursor-pointer"
                                >
                                  {group.name}
                                </label>
                                {group.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {group.description}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground mt-1">
                                  Полей: {group.field_ids.length}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                    <p className="text-xs text-muted-foreground">
                      Выбрано групп: {formData.field_group_ids.length}
                    </p>
                  </div>

                  <div className="flex gap-2 justify-end pt-4">
                    <Button type="button" variant="outline" onClick={resetForm}>
                      Отмена
                    </Button>
                    <Button type="submit">
                      {editingMapping ? 'Сохранить' : 'Создать'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon name="Link" size={20} />
                Список связей
                <Badge variant="secondary" className="ml-auto">
                  {filteredMappings.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredMappings.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Icon name="Link" size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="text-lg mb-2">Нет связей</p>
                  <p className="text-sm">
                    Создайте первую связь между услугой, сервисом и полями
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Услуга</TableHead>
                        <TableHead>Сервис</TableHead>
                        <TableHead>Группы полей</TableHead>
                        <TableHead className="text-right">Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMappings.map((mapping) => (
                        <TableRow key={mapping.id}>
                          <TableCell className="font-medium">
                            {getCategoryName(mapping.service_category_id)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {getServiceName(mapping.service_id)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {mapping.field_group_ids.length === 0 ? (
                              <span className="text-xs text-muted-foreground">
                                Нет групп
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {getFieldGroupNames(mapping.field_group_ids).map(
                                  (name, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-xs">
                                      {name}
                                    </Badge>
                                  )
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(mapping)}
                                className="gap-1"
                              >
                                <Icon name="Pencil" size={16} />
                                Изменить
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(mapping.id)}
                                className="gap-1 text-destructive hover:text-destructive"
                              >
                                <Icon name="Trash2" size={16} />
                                Удалить
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
        </div>
      </div>
    </div>
  );
};

export default ServiceFieldMappings;