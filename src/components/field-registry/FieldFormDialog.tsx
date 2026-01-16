import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';
import FieldTypeSpecificInputs from './FieldTypeSpecificInputs';

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

interface FieldFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingField: Field | null;
  formData: {
    name: string;
    field_type: string;
    options: string[];
    placeholder: string;
    label: string;
    description: string;
    required: boolean;
  };
  onFormDataChange: (field: string, value: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  onReset: () => void;
  fieldTypes: Array<{ value: string; label: string; icon: string }>;
}

const FieldFormDialog = ({
  open,
  onOpenChange,
  editingField,
  formData,
  onFormDataChange,
  onSubmit,
  onReset,
  fieldTypes,
}: FieldFormDialogProps) => {
  const [newOption, setNewOption] = useState('');

  const handleAddOption = () => {
    if (newOption.trim()) {
      onFormDataChange('options', [...formData.options, newOption.trim()]);
      setNewOption('');
    }
  };

  const handleRemoveOption = (index: number) => {
    onFormDataChange(
      'options',
      formData.options.filter((_, i) => i !== index)
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button onClick={onReset} className="gap-2">
          <Icon name="Plus" size={18} />
          Добавить поле
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingField ? 'Редактировать поле' : 'Создать новое поле'}
          </DialogTitle>
          <DialogDescription>
            {editingField
              ? 'Измените параметры существующего поля'
              : 'Добавьте новое поле в реестр'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Название поля *</Label>
            <Input
              id="name"
              placeholder="Например: ИНН организации"
              value={formData.name}
              onChange={(e) => onFormDataChange('name', e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Описание поля</Label>
            <Textarea
              id="description"
              placeholder="Краткое описание поля (опционально)"
              value={formData.description}
              onChange={(e) => onFormDataChange('description', e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="field_type">Тип поля *</Label>
            <Select
              value={formData.field_type}
              onValueChange={(value) => onFormDataChange('field_type', value)}
            >
              <SelectTrigger id="field_type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fieldTypes.map((type) => (
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

          <FieldTypeSpecificInputs
            fieldType={formData.field_type}
            formData={formData}
            newOption={newOption}
            setNewOption={setNewOption}
            onAddOption={handleAddOption}
            onRemoveOption={handleRemoveOption}
            onFormDataChange={onFormDataChange}
          />

          <div className="flex items-center space-x-2">
            <Checkbox
              id="required"
              checked={formData.required}
              onCheckedChange={(checked) =>
                onFormDataChange('required', checked === true)
              }
            />
            <label
              htmlFor="required"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Обязательное поле
            </label>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Отмена
            </Button>
            <Button type="submit">
              {editingField ? 'Сохранить' : 'Создать'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default FieldFormDialog;
