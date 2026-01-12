import { useEffect, useState } from 'react';
import PaymentsSidebar from '@/components/payments/PaymentsSidebar';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/utils/api';
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
import { Textarea } from '@/components/ui/textarea';

interface CustomField {
  id: number;
  name: string;
  field_type: string;
  options: string;
  created_at?: string;
}

const fieldTypes = [
  { value: 'text', label: 'Текст', icon: 'Type' },
  { value: 'select', label: 'Выбор', icon: 'List' },
  { value: 'file', label: 'Загрузка файла', icon: 'Upload' },
  { value: 'toggle', label: 'Переключатель да/нет', icon: 'ToggleLeft' },
];

const CustomFields = () => {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    field_type: 'text',
    options: '',
    file_extensions: '',
  });
  const [dictionariesOpen, setDictionariesOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
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

  const loadFields = () => {
    apiFetch('https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=custom-fields')
      .then(res => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setFields(data);
        } else {
          setFields([]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load custom fields:', err);
        setFields([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadFields();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = 'https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=custom-fields';
      const method = editingField ? 'PUT' : 'POST';
      const body = editingField 
        ? { id: editingField.id, ...formData }
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
        setEditingField(null);
        setFormData({ name: '', field_type: 'text', options: '', file_extensions: '' });
        loadFields();
      }
    } catch (err) {
      console.error('Failed to save custom field:', err);
    }
  };

  const handleEdit = (field: CustomField) => {
    setEditingField(field);
    setFormData({ 
      name: field.name, 
      field_type: field.field_type, 
      options: field.options,
      file_extensions: field.options || ''
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить это дополнительное поле?')) return;

    try {
      const response = await apiFetch(
        'https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=custom-fields',
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id }),
        }
      );

      if (response.ok) {
        loadFields();
      }
    } catch (err) {
      console.error('Failed to delete custom field:', err);
    }
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingField(null);
      setFormData({ name: '', field_type: 'text', options: '', file_extensions: '' });
    }
  };

  const getFieldTypeLabel = (type: string) => {
    return fieldTypes.find(ft => ft.value === type)?.label || type;
  };

  const getFieldTypeIcon = (type: string) => {
    return fieldTypes.find(ft => ft.value === type)?.icon || 'HelpCircle';
  };

  const needsOptions = formData.field_type === 'select' || formData.field_type === 'toggle';
  const needsFileExtensions = formData.field_type === 'file';

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
            <p className="text-sm md:text-base text-muted-foreground">Настройка дополнительных полей для платежей</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 gap-2 w-full sm:w-auto">
                <Icon name="Plus" size={18} />
                <span className="sm:inline">Добавить поле</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>
                  {editingField ? 'Редактировать поле' : 'Новое дополнительное поле'}
                </DialogTitle>
                <DialogDescription>
                  {editingField 
                    ? 'Измените параметры дополнительного поля' 
                    : 'Добавьте новое поле для формы платежа'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Название поля *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Например: Номер договора"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="field_type">Тип поля *</Label>
                  <Select
                    value={formData.field_type}
                    onValueChange={(value) => setFormData({ ...formData, field_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fieldTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <Icon name={type.icon} size={16} />
                            {type.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {needsOptions && (
                  <div className="space-y-2">
                    <Label htmlFor="options">
                      {formData.field_type === 'select' ? 'Варианты выбора' : 'Варианты переключения'}
                    </Label>
                    <Textarea
                      id="options"
                      value={formData.options}
                      onChange={(e) => setFormData({ ...formData, options: e.target.value })}
                      placeholder={
                        formData.field_type === 'select' 
                          ? 'Каждый вариант с новой строки:\nВариант 1\nВариант 2\nВариант 3'
                          : 'Введите два значения через новую строку:\nДа\nНет'
                      }
                      rows={formData.field_type === 'select' ? 5 : 3}
                      required={needsOptions}
                    />
                    <p className="text-xs text-muted-foreground">
                      {formData.field_type === 'select' 
                        ? 'Введите каждый вариант с новой строки' 
                        : 'Введите два значения (например: Да и Нет)'}
                    </p>
                  </div>
                )}
                {needsFileExtensions && (
                  <div className="space-y-2">
                    <Label htmlFor="file_extensions">Разрешённые форматы файлов</Label>
                    <Input
                      id="file_extensions"
                      value={formData.file_extensions}
                      onChange={(e) => setFormData({ ...formData, file_extensions: e.target.value, options: e.target.value })}
                      placeholder="pdf, jpg, png, doc, docx"
                    />
                    <p className="text-xs text-muted-foreground">
                      Введите расширения файлов через запятую (например: pdf, jpg, png)
                    </p>
                  </div>
                )}
                <Button type="submit" className="w-full">
                  {editingField ? 'Сохранить' : 'Добавить'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="border-white/5 bg-card shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
          <CardContent className="p-6">
            {loading ? (
              <div className="text-center text-muted-foreground py-8">Загрузка...</div>
            ) : fields.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                Нет дополнительных полей. Добавьте первое поле для начала работы.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {fields.map((field) => (
                  <div
                    key={field.id}
                    className="border border-white/10 rounded-lg p-4 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                          <Icon name={getFieldTypeIcon(field.field_type)} size={24} />
                        </div>
                        <div>
                          <h3 className="font-semibold">{field.name}</h3>
                          <p className="text-xs text-muted-foreground">{getFieldTypeLabel(field.field_type)}</p>
                        </div>
                      </div>
                    </div>
                    {field.options && field.field_type !== 'file' && (
                      <div className="mb-3 text-sm text-muted-foreground">
                        <div className="font-medium mb-1">Варианты:</div>
                        <div className="text-xs space-y-1">
                          {field.options.split('\n').filter(opt => opt.trim()).map((opt, idx) => (
                            <div key={idx} className="truncate">• {opt}</div>
                          ))}
                        </div>
                      </div>
                    )}
                    {field.options && field.field_type === 'file' && (
                      <div className="mb-3 text-sm text-muted-foreground">
                        <div className="font-medium mb-1">Разрешённые форматы:</div>
                        <div className="text-xs">
                          {field.options}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(field)}
                        className="flex-1"
                      >
                        <Icon name="Pencil" size={16} />
                        <span className="ml-2">Изменить</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(field.id)}
                        className="flex-1 text-red-400 hover:text-red-300"
                      >
                        <Icon name="Trash2" size={16} />
                        <span className="ml-2">Удалить</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default CustomFields;