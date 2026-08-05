import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, API_URL, FIELD_GROUPS_URL, SERVICE_FIELD_MAPPINGS_URL } from '@/utils/api';
import PaymentsSidebar from '@/components/payments/PaymentsSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import MappingFormDialog from '@/components/service-field-mappings/MappingFormDialog';
import MappingsTable from '@/components/service-field-mappings/MappingsTable';
import {
  ServiceCategory,
  Service,
  FieldGroup,
  ServiceFieldMapping,
} from '@/components/service-field-mappings/types';

const ServiceFieldMappings = () => {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [mappings, setMappings] = useState<ServiceFieldMapping[]>([]);
  const [ticketServices, setTicketServices] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [fieldGroups, setFieldGroups] = useState<FieldGroup[]>([]);
  const [ticketServiceMappings, setTicketServiceMappings] = useState<{ ticket_service_id: number; service_id: number }[]>([]);
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
  const [dictionariesOpen, setDictionariesOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

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

  // Фильтруем сервисы по выбранной услуге через ticket_service_mappings
  const filteredServices = useMemo(() => {
    if (!formData.service_category_id) return [];
    
    const filtered = services.filter((s) => {
      const hasMapping = ticketServiceMappings.some(
        (m) => m.ticket_service_id === formData.service_category_id && m.service_id === s.id
      );
      console.log(`Service ${s.id} (${s.name}): hasMapping=${hasMapping}`, {
        ticketServiceId: formData.service_category_id,
        serviceId: s.id,
        mappings: ticketServiceMappings.filter(m => m.ticket_service_id === formData.service_category_id)
      });
      return hasMapping;
    });
    
    console.log('filteredServices:', filtered, {
      selectedTicketServiceId: formData.service_category_id,
      totalServices: services.length,
      totalMappings: ticketServiceMappings.length
    });
    
    return filtered;
  }, [formData.service_category_id, services, ticketServiceMappings]);

  useEffect(() => {
    if (!hasPermission('service_field_mappings', 'read')) {
      navigate('/tickets');
      return;
    }
    loadData();
  }, [hasPermission, navigate]);

  if (!hasPermission('service_field_mappings', 'read')) {
    return null;
  }

  const loadData = async () => {
    // Load ticket-services (Услуга: Заблокировать доступ, Предоставить доступ)
    try {
      const response = await apiFetch(`${API_URL}?endpoint=ticket_services`);
      const data = await response.json();
      console.log('Loaded ticket-services (услуги):', data);
      setTicketServices(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load ticket-services:', error);
      setTicketServices([]);
    }

    // Load services (Сервис: процессы согласования)
    try {
      const response = await apiFetch(`${API_URL}?endpoint=services`);
      const data = await response.json();
      console.log('Loaded services (сервисы):', data);
      setServices(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load services:', error);
      setServices([]);
    }

    // Load ticket-service mappings (связь услуг и сервисов)
    try {
      const response = await apiFetch(`${API_URL}?endpoint=ticket_service_mappings`);
      const data = await response.json();
      console.log('Loaded ticket-service mappings:', data);
      setTicketServiceMappings(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load ticket-service mappings:', error);
      setTicketServiceMappings([]);
    }

    // Load field groups from API
    try {
      const response = await apiFetch(FIELD_GROUPS_URL);
      const data = await response.json();
      console.log('Loaded field groups:', data);
      setFieldGroups(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load field groups:', error);
      setFieldGroups([]);
    }

    // Load mappings from API
    try {
      const response = await apiFetch(SERVICE_FIELD_MAPPINGS_URL);
      const data = await response.json();
      console.log('Loaded service field mappings:', data);
      setMappings(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load service field mappings:', error);
      setMappings([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const requiredPermission = editingMapping ? 'update' : 'create';
    if (!hasPermission('service_field_mappings', requiredPermission)) {
      alert('У вас нет прав для этой операции');
      return;
    }

    if (!formData.service_category_id || !formData.service_id || formData.field_group_ids.length === 0) {
      alert('Выберите услугу, сервис и хотя бы одну группу полей');
      return;
    }

    try {
      const method = editingMapping ? 'PUT' : 'POST';
      
      // Отправляем каждую группу как отдельную связь
      for (const field_group_id of formData.field_group_ids) {
        const body = editingMapping
          ? {
              id: editingMapping.id,
              ticket_service_id: formData.service_category_id,
              service_id: formData.service_id,
              field_group_id,
            }
          : {
              ticket_service_id: formData.service_category_id,
              service_id: formData.service_id,
              field_group_id,
            };

        const response = await apiFetch(SERVICE_FIELD_MAPPINGS_URL, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const error = await response.json();
          if (!error.error?.includes('already exists')) {
            alert(`Ошибка: ${error.error || 'Не удалось сохранить связь'}`);
            return;
          }
        }
      }

      // Перезагружаем список связей
      await loadData();
      resetForm();
    } catch (error) {
      console.error('Failed to save mapping:', error);
      alert('Ошибка при сохранении связи');
    }
  };

  const handleEdit = (mapping: ServiceFieldMapping) => {
    if (!hasPermission('service_field_mappings', 'update')) {
      alert('У вас нет прав для редактирования связей');
      return;
    }
    setEditingMapping(mapping);
    setFormData({
      service_category_id: mapping.service_category_id,
      service_id: mapping.service_id,
      field_group_ids: mapping.field_group_ids || (mapping.field_group_id ? [mapping.field_group_id] : []),
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!hasPermission('service_field_mappings', 'remove')) {
      alert('У вас нет прав для удаления связей');
      return;
    }
    if (!confirm('Удалить связь?')) return;
    
    try {
      const response = await apiFetch(SERVICE_FIELD_MAPPINGS_URL, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (response.ok) {
        await loadData();
      } else {
        const error = await response.json();
        alert(`Ошибка: ${error.error || 'Не удалось удалить связь'}`);
      }
    } catch (error) {
      console.error('Failed to delete mapping:', error);
      alert('Ошибка при удалении связи');
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

  const handleFormDataChange = (field: string, value: number | { service_category_id: number; service_id: number } | number[]) => {
    if (field === 'service_category_id') {
      setFormData((prev) => ({ ...prev, ...value }));
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }
  };

  const toggleFieldGroup = (groupId: number) => {
    setFormData((prev) => ({
      ...prev,
      field_group_ids: prev.field_group_ids.includes(groupId)
        ? prev.field_group_ids.filter((id) => id !== groupId)
        : [...prev.field_group_ids, groupId],
    }));
  };

  const getTicketServiceName = (id: number) => {
    return ticketServices.find((c) => c.id === id)?.name || 'Неизвестно';
  };

  const getServiceName = (id: number) => {
    return services.find((s) => s.id === id)?.name || 'Неизвестно';
  };

  const getFieldGroupNames = (ids: number[]) => {
    return ids.map((id) => fieldGroups.find((g) => g.id === id)?.name || 'Неизвестно');
  };

  const filteredMappings = mappings.filter((mapping) => {
    const ticketServiceName = getTicketServiceName(mapping.service_category_id).toLowerCase();
    const serviceName = getServiceName(mapping.service_id).toLowerCase();
    const query = searchQuery.toLowerCase();
    return ticketServiceName.includes(query) || serviceName.includes(query);
  });

  return (
    <div className="flex min-h-screen bg-background">
      <PaymentsSidebar
        menuOpen={menuOpen}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
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

      <main className={`${collapsed ? 'lg:ml-[70px]' : 'lg:ml-[250px]'} flex-1 min-h-screen overflow-x-hidden max-w-full transition-all duration-300`}>
        <div className="p-4 md:p-6 lg:p-[30px] space-y-4 md:space-y-6 w-full">
          <div className="flex lg:hidden items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMenuOpen(true)}
              title="Меню"
              aria-label="Меню"
            >
              <Icon name="Menu" size={24} />
            </Button>
            <h1 className="text-lg font-bold">Привязка полей</h1>
          </div>

          <div className="hidden lg:block">
            <h1 className="text-3xl font-bold">Связь Услуги-Сервисы-Поля</h1>
            <p className="text-muted-foreground mt-1">
              Настройте какие поля показывать для каждой комбинации услуги и сервиса
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
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

            <MappingFormDialog
              open={dialogOpen}
              onOpenChange={setDialogOpen}
              editingMapping={editingMapping}
              formData={formData}
              onFormDataChange={handleFormDataChange}
              onSubmit={handleSubmit}
              onReset={resetForm}
              serviceCategories={ticketServices}
              services={services}
              fieldGroups={fieldGroups}
              canCreate={hasPermission('service_field_mappings', 'create')}
              filteredServices={filteredServices}
              toggleFieldGroup={toggleFieldGroup}
            />
          </div>

          {hasPermission('service_field_mappings', 'create') && (
            <div className="lg:hidden">
              <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="w-full gap-2">
                <Icon name="Plus" size={18} />
                Добавить связь
              </Button>
            </div>
          )}

          <MappingsTable
            mappings={filteredMappings}
            onEdit={handleEdit}
            onDelete={handleDelete}
            getCategoryName={getTicketServiceName}
            getServiceName={getServiceName}
            getFieldGroupNames={getFieldGroupNames}
            canUpdate={hasPermission('service_field_mappings', 'update')}
            canDelete={hasPermission('service_field_mappings', 'remove')}
          />
        </div>
      </main>
    </div>
  );
};

export default ServiceFieldMappings;