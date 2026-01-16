import { useEffect, useState } from 'react';
import { apiFetch, API_URL } from '@/utils/api';
import PaymentsSidebar from '@/components/payments/PaymentsSidebar';
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
  const [mappings, setMappings] = useState<ServiceFieldMapping[]>([]);
  const [ticketServices, setTicketServices] = useState<ServiceCategory[]>([]);
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
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Load ticket-services (Услуга: Заблокировать доступ, Предоставить доступ)
    try {
      const response = await apiFetch(`${API_URL}?endpoint=ticket-services`);
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
      setServices(Array.isArray(data.services) ? data.services : []);
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

  const handleFormDataChange = (field: string, value: any) => {
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

  // Показываем все сервисы (services table), без фильтрации по ticket_service_id
  const filteredServices = services;

  const filteredMappings = mappings.filter((mapping) => {
    const ticketServiceName = getTicketServiceName(mapping.service_category_id).toLowerCase();
    const serviceName = getServiceName(mapping.service_id).toLowerCase();
    const query = searchQuery.toLowerCase();
    return ticketServiceName.includes(query) || serviceName.includes(query);
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
              filteredServices={filteredServices}
              toggleFieldGroup={toggleFieldGroup}
            />
          </div>

          <MappingsTable
            mappings={filteredMappings}
            onEdit={handleEdit}
            onDelete={handleDelete}
            getCategoryName={getTicketServiceName}
            getServiceName={getServiceName}
            getFieldGroupNames={getFieldGroupNames}
          />
        </div>
      </div>
    </div>
  );
};

export default ServiceFieldMappings;