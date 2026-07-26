import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import CompanyStructureInput from '@/components/field-registry/CompanyStructureInput';
import DateMaskedInput from '@/components/ui/date-masked-input';
import PhoneMaskedInput from '@/components/ui/phone-masked-input';
import CustomFileField from '@/components/tickets/CustomFileField';
import { useToast } from '@/hooks/use-toast';

interface CustomField {
  id: number;
  name: string;
  field_type: string;
  is_required: boolean;
  options?: string[] | string;
  placeholder?: string;
  label?: string;
  hide_label?: boolean;
}

type FormData = {
  title: string;
  description: string;
  category_id: string;
  priority_id: string;
  due_date: string;
  custom_fields: Record<string, string>;
};

interface TicketFormStep4Props {
  formData: FormData;
  setFormData: (data: Record<string, string | number | number[] | Record<string, string>>) => void;
  customFields: CustomField[];
  onSubmit?: (e: React.FormEvent) => Promise<void>;
  onNext?: () => void;
  onBack: () => void;
  isSubmitting?: boolean;
}

const updateCustomField = (
  formData: FormData,
  setFormData: (data: Record<string, string | number | number[] | Record<string, string>>) => void,
  fieldId: number,
  value: string
) => {
  setFormData({
    ...formData,
    custom_fields: {
      ...formData.custom_fields,
      [fieldId]: value,
    },
  });
};

const normalizeOptions = (options: unknown): string[] => {
  if (Array.isArray(options)) return options.map((o) => String(o));
  if (typeof options === 'string') {
    const trimmed = options.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map((o) => String(o));
    } catch {
      // не JSON — fallback на разделители
    }
    return trimmed.split(/[\n,]/).map((o) => o.trim()).filter(Boolean);
  }
  return [];
};

export const renderCustomField = (
  field: CustomField,
  formData: FormData,
  setFormData: (data: Record<string, string | number | number[] | Record<string, string>>) => void
) => {
  const value = formData.custom_fields[field.id] || '';

  switch (field.field_type) {
    case 'company_structure':
      return (
        <CompanyStructureInput
          value={value ? JSON.parse(value) : undefined}
          onChange={(structValue) =>
            updateCustomField(formData, setFormData, field.id, JSON.stringify(structValue))
          }
        />
      );

    case 'select':
      return (
        <Select
          value={value}
          onValueChange={(v) => updateCustomField(formData, setFormData, field.id, v)}
        >
          <SelectTrigger>
            <SelectValue placeholder={field.placeholder || 'Выберите значение'} />
          </SelectTrigger>
          <SelectContent>
            {normalizeOptions(field.options).map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case 'radio_cards': {
      const cardIcons = ['Monitor', 'Download', 'Check', 'Star', 'Circle'];
      return (
        <div className="space-y-2">
          {normalizeOptions(field.options).map((option, idx) => {
            const selected = value === option;
            return (
              <button
                type="button"
                key={option}
                onClick={() => updateCustomField(formData, setFormData, field.id, option)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                  selected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border bg-muted/20 hover:bg-muted/40'
                }`}
              >
                <span
                  className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    selected ? 'border-primary' : 'border-muted-foreground/40'
                  }`}
                >
                  {selected && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                </span>
                <span
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border ${
                    selected ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground'
                  }`}
                >
                  <Icon name={cardIcons[idx % cardIcons.length]} size={18} />
                </span>
                <span className="text-sm font-medium text-foreground">{option}</span>
              </button>
            );
          })}
        </div>
      );
    }

    case 'checkbox':
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            id={`cf-${field.id}`}
            checked={value === 'true'}
            onCheckedChange={(checked) =>
              updateCustomField(formData, setFormData, field.id, String(checked))
            }
          />
          <label htmlFor={`cf-${field.id}`} className="text-sm cursor-pointer">
            {field.label || field.name}
          </label>
        </div>
      );

    case 'textarea':
      return (
        <Textarea
          value={value}
          onChange={(e) => updateCustomField(formData, setFormData, field.id, e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          required={field.is_required}
        />
      );

    case 'date':
      return (
        <DateMaskedInput
          value={value}
          onChange={(isoDate) => updateCustomField(formData, setFormData, field.id, isoDate)}
          required={field.is_required}
        />
      );

    case 'number':
      return (
        <Input
          type="number"
          value={value}
          onChange={(e) => updateCustomField(formData, setFormData, field.id, e.target.value)}
          placeholder={field.placeholder}
          required={field.is_required}
        />
      );

    case 'email':
      return (
        <Input
          type="email"
          value={value}
          onChange={(e) => updateCustomField(formData, setFormData, field.id, e.target.value)}
          placeholder={field.placeholder || 'example@mail.com'}
          required={field.is_required}
        />
      );

    case 'phone':
      return (
        <PhoneMaskedInput
          value={value}
          onChange={(phone) => updateCustomField(formData, setFormData, field.id, phone)}
          required={field.is_required}
        />
      );

    case 'file':
    case 'photo':
    case 'image':
      return (
        <CustomFileField
          value={value}
          onChange={(url) => updateCustomField(formData, setFormData, field.id, url)}
          isRequired={field.is_required}
          accept={field.field_type === 'file' ? undefined : 'image/*'}
        />
      );

    default:
      return (
        <Input
          value={value}
          onChange={(e) => updateCustomField(formData, setFormData, field.id, e.target.value)}
          placeholder={field.placeholder}
          required={field.is_required}
        />
      );
  }
};

const TicketFormStep4 = ({
  formData,
  setFormData,
  customFields,
  onSubmit,
  onNext,
  onBack,
  isSubmitting = false,
}: TicketFormStep4Props) => {
  const { toast } = useToast();

  const validateRequired = (): boolean => {
    const missing = customFields.filter(
      (f) => f.is_required && !(formData.custom_fields[f.id] || '').trim()
    );
    if (missing.length > 0) {
      toast({
        title: 'Заполните обязательные поля',
        description: missing.map((f) => f.label || f.name).join(', '),
        variant: 'destructive',
      });
      return false;
    }
    return true;
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateRequired()) return;
    if (onNext) {
      onNext();
      return;
    }
    if (isSubmitting) return;
    onSubmit?.(e);
  };

  const SECTION_TYPES = ['radio_cards', 'company_structure'];

  const DATA_FIELD_ORDER = [
    'фамилия',
    'имя',
    'отчество',
    'дата рождения',
    'номер телефона',
    'необходимые базы 1с',
  ];
  const orderIndex = (name: string) => {
    const idx = DATA_FIELD_ORDER.indexOf((name || '').trim().toLowerCase());
    return idx === -1 ? DATA_FIELD_ORDER.length : idx;
  };

  const topSectionFields = customFields.filter((f) => f.field_type === 'company_structure');
  const bottomSectionFields = customFields.filter((f) => f.field_type === 'radio_cards');
  const dataFields = customFields
    .filter((f) => !SECTION_TYPES.includes(f.field_type))
    .sort((a, b) => orderIndex(a.name) - orderIndex(b.name));

  const renderSection = (field: CustomField) => (
    <div key={field.id} className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3">
      {!field.hide_label && (
        <Label className="text-sm font-semibold">
          {field.name}
          {field.is_required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      {renderCustomField(field, formData, setFormData)}
    </div>
  );

  const renderFieldBlock = (field: CustomField) => {
    const isWide = ['textarea'].includes(field.field_type);
    return (
      <div key={field.id} className={`space-y-2 ${isWide ? 'sm:col-span-2' : ''}`}>
        {!field.hide_label && (
          <Label className="text-sm">
            {field.name}
            {field.is_required && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        {renderCustomField(field, formData, setFormData)}
      </div>
    );
  };

  return (
    <form
      onSubmit={handleFormSubmit}
      onKeyDown={(e) => {
        const target = e.target as HTMLElement;
        if (e.key === 'Enter' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
        }
      }}
    >
      <div className="space-y-4 mt-4">
        {topSectionFields.map(renderSection)}

        {dataFields.length > 0 && (
          <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Данные сотрудника</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {dataFields.map(renderFieldBlock)}
            </div>
          </div>
        )}

        {bottomSectionFields.map(renderSection)}

        <div className="flex gap-3 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="gap-2"
          >
            <Icon name="ArrowLeft" size={18} />
            Назад
          </Button>
          <Button type="submit" className="flex-1 gap-2" disabled={isSubmitting}>
            {onNext ? (
              <>
                Далее
                <Icon name="ArrowRight" size={18} />
              </>
            ) : isSubmitting ? (
              <>
                <Icon name="Loader2" size={18} className="animate-spin" />
                Создание заявки...
              </>
            ) : (
              <>
                <Icon name="Send" size={18} />
                Создать заявку
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
};

export default TicketFormStep4;