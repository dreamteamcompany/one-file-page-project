import { useEffect, useState } from 'react';
import PaymentsSidebar from '@/components/payments/PaymentsSidebar';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import FieldFormDialog from '@/components/field-registry/FieldFormDialog';
import FieldsTable from '@/components/field-registry/FieldsTable';

interface Field {
  id: number;
  name: string;
  field_type: string;
  options?: string[];
  placeholder?: string;
  label?: string;
  description?: string;
  required?: boolean;
  created_at?: string;
}

const fieldTypes = [
  { value: 'text', label: 'Текст', icon: 'Type' },
  { value: 'number', label: 'Число', icon: 'Hash' },
  { value: 'date', label: 'Дата', icon: 'Calendar' },
  { value: 'select', label: 'Выбор из списка', icon: 'List' },
  { value: 'checkbox', label: 'Флажок', icon: 'CheckSquare' },
  { value: 'textarea', label: 'Многострочный текст', icon: 'AlignLeft' },
  { value: 'email', label: 'Email', icon: 'Mail' },
  { value: 'phone', label: 'Телефон', icon: 'Phone' },
  { value: 'file', label: 'Файл', icon: 'FileText' },
];

const FieldRegistry = () => {
  const [fields, setFields] = useState<Field[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    field_type: 'text',
    options: [] as string[],
    placeholder: '',
    label: '',
    description: '',
    required: false,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [dictionariesOpen, setDictionariesOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
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

  useEffect(() => {
    const savedFields = localStorage.getItem('fieldRegistry');
    if (savedFields) {
      setFields(JSON.parse(savedFields));
    } else {
      const mockFields: Field[] = [
        { id: 1, name: 'ИНН организации', field_type: 'text', created_at: new Date().toISOString() },
        { id: 2, name: 'Дата регистрации', field_type: 'date', created_at: new Date().toISOString() },
        { id: 3, name: 'Сумма договора', field_type: 'number', created_at: new Date().toISOString() },
      ];
      setFields(mockFields);
      localStorage.setItem('fieldRegistry', JSON.stringify(mockFields));
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let updatedFields: Field[];
    if (editingField) {
      updatedFields = fields.map(f => 
        f.id === editingField.id 
          ? { 
              ...f, 
              name: formData.name, 
              field_type: formData.field_type,
              options: formData.options,
              placeholder: formData.placeholder,
              label: formData.label,
              description: formData.description,
              required: formData.required,
            }
          : f
      );
    } else {
      const newField: Field = {
        id: Math.max(0, ...fields.map(f => f.id)) + 1,
        name: formData.name,
        field_type: formData.field_type,
        options: formData.options,
        placeholder: formData.placeholder,
        label: formData.label,
        description: formData.description,
        required: formData.required,
        created_at: new Date().toISOString(),
      };
      updatedFields = [...fields, newField];
    }
    
    setFields(updatedFields);
    localStorage.setItem('fieldRegistry', JSON.stringify(updatedFields));
    closeDialog();
  };

  const handleEdit = (field: Field) => {
    openDialog(field);
  };

  const handleDelete = (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить это поле?')) return;
    const updatedFields = fields.filter(f => f.id !== id);
    setFields(updatedFields);
    localStorage.setItem('fieldRegistry', JSON.stringify(updatedFields));
  };

  const openDialog = (field?: Field) => {
    if (field) {
      setEditingField(field);
      setFormData({ 
        name: field.name, 
        field_type: field.field_type,
        options: field.options || [],
        placeholder: field.placeholder || '',
        label: field.label || '',
        description: field.description || '',
        required: field.required || false,
      });
    }
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setTimeout(() => {
      setEditingField(null);
      setFormData({ 
        name: '', 
        field_type: 'text', 
        options: [], 
        placeholder: '', 
        label: '', 
        description: '', 
        required: false 
      });
    }, 150);
  };

  const resetForm = () => {
    setEditingField(null);
    setFormData({ 
      name: '', 
      field_type: 'text', 
      options: [], 
      placeholder: '', 
      label: '', 
      description: '', 
      required: false 
    });
  };

  const handleFormDataChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getFieldTypeLabel = (type: string) => {
    return fieldTypes.find(ft => ft.value === type)?.label || type;
  };

  const getFieldTypeIcon = (type: string) => {
    return fieldTypes.find(ft => ft.value === type)?.icon || 'HelpCircle';
  };

  const filteredFields = fields.filter(field =>
    field.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    getFieldTypeLabel(field.field_type).toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex min-h-screen overflow-hidden">
      <PaymentsSidebar
        menuOpen={menuOpen}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
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

      <main className="lg:ml-[250px] p-4 md:p-6 lg:p-[30px] pb-20 min-h-screen flex-1 overflow-y-auto overflow-x-hidden max-w-full">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 md:mb-[30px] px-4 md:px-[25px] py-4 md:py-[18px] bg-[#1b254b]/50 backdrop-blur-[20px] rounded-[15px] border border-white/10">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="lg:hidden p-2 text-white"
          >
            <Icon name="Menu" size={24} />
          </button>
          <div className="flex items-center gap-3 bg-card border border-white/10 rounded-[15px] px-4 md:px-5 py-2 md:py-[10px] w-full sm:w-[300px] lg:w-[400px]">
            <Icon name="Search" size={20} className="text-muted-foreground" />
            <Input 
              type="text" 
              placeholder="Поиск полей..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto"
            />
          </div>
          <div className="flex items-center gap-2 md:gap-3 px-3 md:px-[15px] py-2 md:py-[10px] rounded-[12px] bg-white/5 border border-white/10">
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-[10px] bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-semibold text-xs md:text-sm">
              ДБ
            </div>
            <span className="text-xs md:text-sm text-foreground font-medium hidden sm:inline">Дмитрий Белозерский</span>
          </div>
        </header>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Реестр полей</h1>
            <p className="text-muted-foreground mt-1">
              Создавайте и управляйте полями для заявок
            </p>
          </div>
          <FieldFormDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            editingField={editingField}
            formData={formData}
            onFormDataChange={handleFormDataChange}
            onSubmit={handleSubmit}
            onReset={resetForm}
            fieldTypes={fieldTypes}
          />
        </div>

        <FieldsTable
          fields={filteredFields}
          onEdit={handleEdit}
          onDelete={handleDelete}
          getFieldTypeLabel={getFieldTypeLabel}
          getFieldTypeIcon={getFieldTypeIcon}
        />
      </main>
    </div>
  );
};

export default FieldRegistry;
