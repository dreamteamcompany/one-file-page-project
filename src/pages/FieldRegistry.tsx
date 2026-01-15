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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Field {
  id: number;
  name: string;
  field_type: string;
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

  useEffect(() => {
    if (fields.length > 0) {
      localStorage.setItem('fieldRegistry', JSON.stringify(fields));
    }
  }, [fields]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingField) {
      setFields(fields.map(f => 
        f.id === editingField.id 
          ? { ...f, name: formData.name, field_type: formData.field_type }
          : f
      ));
    } else {
      const newField: Field = {
        id: Math.max(0, ...fields.map(f => f.id)) + 1,
        name: formData.name,
        field_type: formData.field_type,
        created_at: new Date().toISOString(),
      };
      setFields([...fields, newField]);
    }
    
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
      });
    }
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setTimeout(() => {
      setEditingField(null);
      setFormData({ name: '', field_type: 'text' });
    }, 150);
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
            <h1 className="text-2xl md:text-3xl font-bold mb-2">Реестр полей</h1>
            <p className="text-sm md:text-base text-muted-foreground">Управление полями для форм системы</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 gap-2 w-full sm:w-auto">
                <Icon name="Plus" size={18} />
                <span>Добавить поле</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>
                  {editingField ? 'Редактировать поле' : 'Новое поле'}
                </DialogTitle>
                <DialogDescription>
                  {editingField 
                    ? 'Измените параметры поля' 
                    : 'Добавьте новое поле в реестр'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Название поля *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Например: ИНН организации"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="field_type">Тип поля *</Label>
                  <Select
                    value={formData.field_type}
                    onValueChange={(value) => setFormData({...formData, field_type: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px] overflow-y-auto">
                      {fieldTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <Icon name={type.icon as any} size={16} />
                            {type.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleDialogClose(false)}
                    className="flex-1"
                  >
                    Отмена
                  </Button>
                  <Button type="submit" className="flex-1">
                    {editingField ? 'Сохранить' : 'Добавить'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="Database" size={20} />
              Список полей
              <Badge variant="secondary" className="ml-auto">
                {filteredFields.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredFields.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Icon name="Database" size={48} className="mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">Нет полей в реестре</p>
                <p className="text-sm">Добавьте первое поле, чтобы начать работу</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Название</TableHead>
                      <TableHead>Тип поля</TableHead>
                      <TableHead className="text-right">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFields.map((field) => (
                      <TableRow key={field.id}>
                        <TableCell className="font-medium">
                          {field.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1">
                            <Icon name={getFieldTypeIcon(field.field_type) as any} size={14} />
                            {getFieldTypeLabel(field.field_type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(field)}
                              className="gap-1"
                            >
                              <Icon name="Pencil" size={16} />
                              <span className="hidden sm:inline">Изменить</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(field.id)}
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

export default FieldRegistry;