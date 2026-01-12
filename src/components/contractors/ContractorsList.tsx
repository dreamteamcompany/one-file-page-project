import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

interface Contractor {
  id: number;
  name: string;
  inn: string;
  kpp: string;
  ogrn: string;
  legal_address: string;
  actual_address: string;
  phone: string;
  email: string;
  contact_person: string;
  bank_name: string;
  bank_bik: string;
  bank_account: string;
  correspondent_account: string;
  notes: string;
  is_active: boolean;
  created_at: string;
}

interface ContractorsListProps {
  contractors: Contractor[];
  loading: boolean;
  handleEdit: (contractor: Contractor) => void;
  handleDelete: (id: number) => void;
}

const ContractorsList = ({ contractors, loading, handleEdit, handleDelete }: ContractorsListProps) => {
  return (
    <Card className="border-white/5 bg-card shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
      <CardContent className="p-0">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Загрузка...</div>
        ) : contractors.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            Нет контрагентов. Добавьте первого контрагента.
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Название</th>
                    <th className="text-left p-4 text-sm font-semibold text-muted-foreground">ИНН</th>
                    <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Контакты</th>
                    <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {contractors.map((contractor) => (
                    <tr key={contractor.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <div className="font-medium">{contractor.name}</div>
                        {contractor.contact_person && (
                          <div className="text-sm text-muted-foreground">{contractor.contact_person}</div>
                        )}
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {contractor.inn || <span className="text-muted-foreground/50">—</span>}
                      </td>
                      <td className="p-4 text-muted-foreground text-sm">
                        <div>{contractor.phone || '—'}</div>
                        <div>{contractor.email || '—'}</div>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(contractor)}
                            className="gap-2"
                          >
                            <Icon name="Pencil" size={16} />
                            Редактировать
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(contractor.id)}
                            className="gap-2 text-red-500 hover:text-red-600"
                          >
                            <Icon name="Trash2" size={16} />
                            Удалить
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="md:hidden space-y-3 p-4">
              {contractors.map((contractor) => (
                <Card key={contractor.id} className="border-white/10 bg-white/5">
                  <CardContent className="p-4 space-y-3">
                    <div className="font-medium text-lg">{contractor.name}</div>
                    {contractor.inn && (
                      <div className="text-sm text-muted-foreground">ИНН: {contractor.inn}</div>
                    )}
                    {contractor.contact_person && (
                      <div className="text-sm text-muted-foreground">{contractor.contact_person}</div>
                    )}
                    {(contractor.phone || contractor.email) && (
                      <div className="text-sm text-muted-foreground">
                        {contractor.phone && <div>{contractor.phone}</div>}
                        {contractor.email && <div>{contractor.email}</div>}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(contractor)}
                        className="flex-1 gap-2"
                      >
                        <Icon name="Pencil" size={16} />
                        Редактировать
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(contractor.id)}
                        className="gap-2 text-red-500 hover:text-red-600"
                      >
                        <Icon name="Trash2" size={16} />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ContractorsList;
