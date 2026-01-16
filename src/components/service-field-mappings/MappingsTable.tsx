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
import { ServiceFieldMapping } from './types';

interface MappingsTableProps {
  mappings: ServiceFieldMapping[];
  onEdit: (mapping: ServiceFieldMapping) => void;
  onDelete: (id: number) => void;
  getCategoryName: (id: number) => string;
  getServiceName: (id: number) => string;
  getFieldGroupNames: (ids: number[]) => string[];
}

const MappingsTable = ({
  mappings,
  onEdit,
  onDelete,
  getCategoryName,
  getServiceName,
  getFieldGroupNames,
}: MappingsTableProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon name="Link" size={20} />
          Список связей
          <Badge variant="secondary" className="ml-auto">
            {mappings.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {mappings.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Icon name="Link" size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">Нет связей</p>
            <p className="text-sm">
              Создайте первую связь между услугой, сервисом и полями
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Услуга</TableHead>
                  <TableHead>Сервис</TableHead>
                  <TableHead>Группы полей</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((mapping) => (
                  <TableRow key={mapping.id}>
                    <TableCell className="font-medium">
                      {getCategoryName(mapping.service_category_id)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getServiceName(mapping.service_id)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {mapping.field_group_ids.length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          Нет групп
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {getFieldGroupNames(mapping.field_group_ids).map(
                            (name, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {name}
                              </Badge>
                            )
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(mapping)}
                          className="gap-1"
                        >
                          <Icon name="Pencil" size={16} />
                          Изменить
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(mapping.id)}
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

export default MappingsTable;
