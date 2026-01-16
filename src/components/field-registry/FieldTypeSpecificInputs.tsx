import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Badge } from '@/components/ui/badge';

interface FieldTypeSpecificInputsProps {
  fieldType: string;
  formData: {
    options?: string[];
    placeholder?: string;
    label?: string;
  };
  newOption: string;
  setNewOption: (value: string) => void;
  onAddOption: () => void;
  onRemoveOption: (index: number) => void;
  onFormDataChange: (field: string, value: any) => void;
}

const FieldTypeSpecificInputs = ({
  fieldType,
  formData,
  newOption,
  setNewOption,
  onAddOption,
  onRemoveOption,
  onFormDataChange,
}: FieldTypeSpecificInputsProps) => {
  const showOptionsField = fieldType === 'select';
  const showPlaceholderField = ['text', 'email', 'phone', 'textarea'].includes(fieldType);
  const showLabelField = fieldType === 'checkbox';

  return (
    <>
      {showOptionsField && (
        <div className="space-y-2">
          <Label>Варианты выбора</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Введите вариант"
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onAddOption();
                }
              }}
            />
            <Button type="button" onClick={onAddOption} size="sm">
              <Icon name="Plus" size={16} />
            </Button>
          </div>
          {formData.options && formData.options.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.options.map((option, index) => (
                <Badge key={index} variant="secondary" className="gap-1">
                  {option}
                  <button
                    type="button"
                    onClick={() => onRemoveOption(index)}
                    className="ml-1 hover:text-destructive"
                  >
                    <Icon name="X" size={14} />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {showPlaceholderField && (
        <div className="space-y-2">
          <Label>Placeholder (подсказка в поле)</Label>
          <Input
            placeholder="Введите подсказку"
            value={formData.placeholder || ''}
            onChange={(e) => onFormDataChange('placeholder', e.target.value)}
          />
        </div>
      )}

      {showLabelField && (
        <div className="space-y-2">
          <Label>Текст флажка *</Label>
          <Input
            placeholder="Например: Согласен с условиями"
            value={formData.label || ''}
            onChange={(e) => onFormDataChange('label', e.target.value)}
            required
          />
        </div>
      )}
    </>
  );
};

export default FieldTypeSpecificInputs;
