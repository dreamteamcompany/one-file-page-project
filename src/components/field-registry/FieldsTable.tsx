import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
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
  options?: string[];
  placeholder?: string;
  label?: string;
  description?: string;
  required?: boolean;
  created_at?: string;
}

interface FieldsTableProps {
  fields: Field[];
  onEdit: (field: Field) => void;
  onDelete: (id: number) => void;
  getFieldTypeLabel: (type: string) => string;
  getFieldTypeIcon: (type: string) => string;
}

const FieldsTable = ({
  fields,
  onEdit,
  onDelete,
  getFieldTypeLabel,
  getFieldTypeIcon,
}: FieldsTableProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon name="Database" size={20} />
          Список полей
          <Badge variant="secondary" className="ml-auto">
            {fields.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {fields.length === 0 ? (
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
                  <TableHead>Настройки</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field) => (
                  <TableRow key={field.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{field.name}</div>
                        {field.description && (
                          <div className="text-xs text-muted-foreground mt-0.5">{field.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className="gap-1 w-fit">
                          <Icon name={getFieldTypeIcon(field.field_type) as any} size={14} />
                          {getFieldTypeLabel(field.field_type)}
                        </Badge>
                        {field.required && (
                          <Badge variant="secondary" className="w-fit text-xs">Обязательное</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-muted-foreground space-y-1">
                        {field.field_type === 'select' && field.options && field.options.length > 0 && (
                          <div>Опций: {field.options.length}</div>
                        )}
                        {field.field_type === 'checkbox' && field.label && (
                          <div className="max-w-[200px] truncate">{field.label}</div>
                        )}
                        {(field.field_type === 'text' || field.field_type === 'email' || field.field_type === 'phone' || field.field_type === 'textarea') && field.placeholder && (
                          <div className="max-w-[200px] truncate">Placeholder: {field.placeholder}</div>
                        )}
                        {!field.options && !field.label && !field.placeholder && (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(field)}
                          className="gap-1"
                        >
                          <Icon name="Pencil" size={16} />
                          Изменить
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(field.id)}
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
  );
};

export default FieldsTable;
