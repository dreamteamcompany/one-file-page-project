import { useEffect, useState } from 'react';
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

interface FieldGroup {
  id: number;
  name: string;
  description?: string;
  field_ids: number[];
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

const CustomFieldGroups = () => {
  const [fieldGroups, setFieldGroups] = useState<FieldGroup[]>([]);
  const [availableFields, setAvailableFields] = useState<Field[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<FieldGroup | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    field_ids: [] as number[],
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [fieldSearchQuery, setFieldSearchQuery] = useState('');
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
      setAvailableFields(JSON.parse(savedFields));
    }

    const savedGroups = localStorage.getItem('customFieldGroups');
    if (savedGroups) {
      setFieldGroups(JSON.parse(savedGroups));
    } else {
      const mockGroups: FieldGroup[] = [
        {
          id: 1,
          name: 'Данные организации',
          description: 'Основные данные об организации',
          field_ids: [1, 2],
          created_at: new Date().toISOString(),
        },
        {
          id: 2,
          name: 'Контактная информация',
          description: 'Контакты для связи',
          field_ids: [1, 2],
          created_at: new Date().toISOString(),
        },
      ];
      setFieldGroups(mockGroups);
      localStorage.setItem('customFieldGroups', JSON.stringify(mockGroups));
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let updatedGroups: FieldGroup[];
    if (editingGroup) {
      updatedGroups = fieldGroups.map(g => 
        g.id === editingGroup.id 
          ? { ...g, name: formData.name, description: formData.description, field_ids: formData.field_ids }
          : g
      );
    } else {
      const newGroup: FieldGroup = {
        id: Math.max(0, ...fieldGroups.map(g => g.id)) + 1,
        name: formData.name,
        description: formData.description,
        field_ids: formData.field_ids,
        created_at: new Date().toISOString(),
      };
      updatedGroups = [...fieldGroups, newGroup];
    }
    
    setFieldGroups(updatedGroups);
    localStorage.setItem('customFieldGroups', JSON.stringify(updatedGroups));
    closeDialog();
  };

  const handleEdit = (group: FieldGroup) => {
    openDialog(group);
  };

  const handleDelete = (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить эту сущность?')) return;
    const updatedGroups = fieldGroups.filter(g => g.id !== id);
    setFieldGroups(updatedGroups);
    localStorage.setItem('customFieldGroups', JSON.stringify(updatedGroups));
  };

  const openDialog = (group?: FieldGroup) => {
    if (group) {
      setEditingGroup(group);
      setFormData({ 
        name: group.name, 
        description: group.description || '',
        field_ids: group.field_ids,
      });
    }
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setTimeout(() => {
      setEditingGroup(null);
      setFormData({ name: '', description: '', field_ids: [] });
      setFieldSearchQuery('');
    }, 150);
  };

  const toggleField = (fieldId: number) => {
    setFormData(prev => ({
      ...prev,
      field_ids: prev.field_ids.includes(fieldId)
        ? prev.field_ids.filter(id => id !== fieldId)
        : [...prev.field_ids, fieldId]
    }));
  };

  const getFieldTypeLabel = (type: string) => {
    return fieldTypes.find(ft => ft.value === type)?.label || type;
  };

  const getFieldTypeIcon = (type: string) => {
    return fieldTypes.find(ft => ft.value === type)?.icon || 'HelpCircle';
  };

  const getFieldById = (id: number) => {
    return availableFields.find(f => f.id === id);
  };

  const filteredGroups = fieldGroups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (group.description && group.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredFieldsForSelection = availableFields.filter(field =>
    field.name.toLowerCase().includes(fieldSearchQuery.toLowerCase())
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
              placeholder="Поиск сущностей..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto"
            />
          </div>
          <div className="flex items-center gap-2 md:gap-3 px-3 md:px-[15px] py-2 md:py-[10px] rounded-[12px] bg-white/5 border border-white/10">
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
            <h1 className="text-2xl md:text-3xl font-bold mb-2">Дополнительные поля</h1>
            <p className="text-sm md:text-base text-muted-foreground">Создание сущностей с полями из реестра</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => open ? setDialogOpen(true) : closeDialog()}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 gap-2 w-full sm:w-auto">
                <Icon name="Plus" size={18} />
                <span>Создать сущность</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>
                  {editingGroup ? 'Редактировать сущность' : 'Новая сущность'}
                </DialogTitle>
                <DialogDescription>
                  {editingGroup 
                    ? 'Измените параметры сущности и выберите поля' 
                    : 'Создайте новую сущность и выберите поля из реестра'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Название сущности *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Например: Данные организации"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Описание</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Краткое описание сущности"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Поля из реестра *</Label>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name="Search" size={16} className="text-muted-foreground" />
                    <Input
                      placeholder="Поиск полей..."
                      value={fieldSearchQuery}
                      onChange={(e) => setFieldSearchQuery(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  
                  {availableFields.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-sm border rounded-lg">
                      <Icon name="AlertCircle" size={32} className="mx-auto mb-2 opacity-50" />
                      <p>В реестре нет полей</p>
                      <p className="text-xs mt-1">Сначала создайте поля в разделе "Реестр полей"</p>
                    </div>
                  ) : (
                    <>
                      <ScrollArea className="h-[250px] border rounded-lg p-3">
                        <div className="space-y-2">
                          {filteredFieldsForSelection.map(field => (
                            <div
                              key={field.id}
                              className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                                formData.field_ids.includes(field.id)
                                  ? 'border-primary border-2 bg-primary/5'
                                  : 'hover:border-primary/50 hover:bg-accent'
                              }`}
                              onClick={(e) => {
                                if ((e.target as HTMLElement).closest('button')) return;
                                toggleField(field.id);
                              }}
                            >
                              <Checkbox
                                checked={formData.field_ids.includes(field.id)}
                                onCheckedChange={() => toggleField(field.id)}
                                className="mt-0.5"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm">{field.name}</div>
                                <Badge variant="outline" className="gap-1 mt-1">
                                  <Icon name={getFieldTypeIcon(field.field_type) as any} size={12} />
                                  <span className="text-xs">{getFieldTypeLabel(field.field_type)}</span>
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                      
                      {formData.field_ids.length > 0 && (
                        <div className="mt-3 p-3 bg-accent/30 rounded-lg">
                          <p className="text-sm font-medium mb-2">
                            Выбрано полей: {formData.field_ids.length}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeDialog}
                    className="flex-1"
                  >
                    Отмена
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1"
                    disabled={formData.field_ids.length === 0}
                  >
                    {editingGroup ? 'Сохранить' : 'Создать'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="Layers" size={20} />
              Список сущностей
              <Badge variant="secondary" className="ml-auto">
                {filteredGroups.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredGroups.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Icon name="Layers" size={48} className="mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">Нет созданных сущностей</p>
                <p className="text-sm">Создайте первую сущность с полями</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Название</TableHead>
                      <TableHead>Описание</TableHead>
                      <TableHead>Поля</TableHead>
                      <TableHead className="text-right">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGroups.map((group) => (
                      <TableRow key={group.id}>
                        <TableCell className="font-medium">
                          {group.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {group.description || '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-md">
                            {group.field_ids.slice(0, 3).map(fieldId => {
                              const field = getFieldById(fieldId);
                              return field ? (
                                <Badge key={fieldId} variant="secondary" className="gap-1 text-xs">
                                  <Icon name={getFieldTypeIcon(field.field_type) as any} size={12} />
                                  {field.name}
                                </Badge>
                              ) : null;
                            })}
                            {group.field_ids.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{group.field_ids.length - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(group)}
                              className="gap-1"
                            >
                              <Icon name="Pencil" size={16} />
                              <span className="hidden sm:inline">Изменить</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(group.id)}
                              className="gap-1 text-destructive hover:text-destructive"
                            >
                              <Icon name="Trash2" size={16} />
                              <span className="hidden sm:inline">Удалить</span>
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

export default CustomFieldGroups;