import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

interface CustomField {
  id: number;
  name: string;
  field_type: string;
  value: string;
}

interface Payment {
  id: number;
  category_id: number;
  category_name: string;
  category_icon: string;
  description: string;
  amount: number;
  payment_date: string;
  legal_entity_id?: number;
  legal_entity_name?: string;
  status?: string;
  created_by?: number;
  service_id?: number;
  service_name?: string;
  contractor_name?: string;
  department_name?: string;
  invoice_number?: string;
  custom_fields?: CustomField[];
}

interface PendingApprovalsListProps {
  loading: boolean;
  payments: Payment[];
  searchQuery: string;
  handleApprove: (paymentId: number) => void;
  handleReject: (paymentId: number) => void;
  getStatusBadge: (status?: string) => JSX.Element | null;
  onPaymentClick: (payment: Payment) => void;
}

const PendingApprovalsList = ({
  loading,
  payments,
  searchQuery,
  handleApprove,
  handleReject,
  getStatusBadge,
  onPaymentClick,
}: PendingApprovalsListProps) => {
  if (loading) {
    return (
      <Card className="border-white/5 bg-card shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground py-8">Загрузка...</div>
        </CardContent>
      </Card>
    );
  }

  if (payments.length === 0) {
    return (
      <Card className="border-white/5 bg-card shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
        <CardContent className="p-6">
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <Icon name="CheckCircle" size={32} className="text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Всё согласовано!</h3>
            <p className="text-muted-foreground">
              {searchQuery ? 'Платежи не найдены' : 'У вас нет платежей, ожидающих согласования'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {payments.map((payment) => (
        <Card key={payment.id} className="border-white/5 bg-card shadow-[0_4px_20px_rgba(0,0,0,0.25)] hover:border-white/10 transition-all cursor-pointer" onClick={() => onPaymentClick(payment)}>
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex-1 space-y-3">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                    <Icon name={payment.category_icon} size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="text-lg font-semibold">{payment.category_name}</h3>
                      {getStatusBadge(payment.status)}
                    </div>
                    <p className="text-muted-foreground text-sm mb-2">{payment.description}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                      {payment.service_name && (
                        <div className="flex items-center gap-1">
                          <Icon name="Briefcase" size={14} />
                          <span>{payment.service_name}</span>
                        </div>
                      )}
                      {payment.contractor_name && (
                        <div className="flex items-center gap-1">
                          <Icon name="Building2" size={14} />
                          <span>{payment.contractor_name}</span>
                        </div>
                      )}
                      {payment.department_name && (
                        <div className="flex items-center gap-1">
                          <Icon name="Users" size={14} />
                          <span>{payment.department_name}</span>
                        </div>
                      )}
                      {payment.invoice_number && (
                        <div className="flex items-center gap-1">
                          <Icon name="FileText" size={14} />
                          <span>Счёт №{payment.invoice_number}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Icon name="Calendar" size={14} />
                        <span>
                          {new Date(payment.payment_date).toLocaleDateString('ru-RU', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 lg:border-l lg:border-white/10 lg:pl-6">
                <div className="text-center sm:text-right">
                  <div className="text-sm text-muted-foreground mb-1">Сумма платежа</div>
                  <div className="text-2xl font-bold">{payment.amount.toLocaleString('ru-RU')} ₽</div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApprove(payment.id);
                    }}
                    className="flex-1 sm:flex-none px-6 py-3 rounded-lg bg-green-500/20 text-green-300 hover:bg-green-500/30 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <Icon name="Check" size={18} />
                    Одобрить
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReject(payment.id);
                    }}
                    className="flex-1 sm:flex-none px-6 py-3 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <Icon name="X" size={18} />
                    Отклонить
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default PendingApprovalsList;