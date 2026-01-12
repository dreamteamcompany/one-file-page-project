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
  payment_date?: string;
  planned_date?: string;
  legal_entity_id?: number;
  legal_entity_name?: string;
  status?: string;
  created_by?: number;
  created_by_name?: string;
  service_id?: number;
  service_name?: string;
  contractor_name?: string;
  contractor_id?: number;
  department_name?: string;
  department_id?: number;
  invoice_number?: string;
  invoice_date?: string;
  created_at?: string;
  submitted_at?: string;
  custom_fields?: CustomField[];
}

interface PaymentsListProps {
  payments: Payment[];
  loading: boolean;
  onApprove?: (paymentId: number) => void;
  onReject?: (paymentId: number) => void;
  onSubmitForApproval?: (paymentId: number) => void;
  onPaymentClick?: (payment: Payment) => void;
  isPlannedPayments?: boolean;
}

const getStatusBadge = (status?: string) => {
  if (!status || status === 'draft') {
    return <span className="px-2 py-1 rounded-full text-xs bg-gray-500/20 text-gray-300">Черновик</span>;
  }
  if (status === 'pending_ceo') {
    return <span className="px-2 py-1 rounded-full text-xs bg-blue-500/20 text-blue-300">Ожидает CEO</span>;
  }
  if (status === 'approved') {
    return <span className="px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-300">Одобрен</span>;
  }
  if (status === 'rejected') {
    return <span className="px-2 py-1 rounded-full text-xs bg-red-500/20 text-red-300">Отклонен</span>;
  }
  if (status === 'revoked') {
    return <span className="px-2 py-1 rounded-full text-xs bg-orange-500/20 text-orange-300">⚠ Отозван</span>;
  }
  return null;
};

const PaymentsList = ({ payments, loading, onApprove, onReject, onSubmitForApproval, onPaymentClick, isPlannedPayments = false }: PaymentsListProps) => {
  return (
    <Card className="border-white/5 bg-card shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
      <CardContent className="p-0">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Загрузка...</div>
        ) : payments.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            Нет платежей. Добавьте первый платёж для начала работы.
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Категория</th>
                    <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Юр. лицо</th>
                    <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Назначение</th>
                    <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Сумма</th>
                    <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Статус</th>
                    <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Дата</th>
                    <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr 
                      key={payment.id} 
                      className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => onPaymentClick && onPaymentClick(payment)}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                            <Icon name={payment.category_icon} size={18} />
                          </div>
                          <span className="font-medium">{payment.category_name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {payment.legal_entity_name || <span className="text-muted-foreground/50">—</span>}
                      </td>
                      <td className="p-4 text-muted-foreground">{payment.description}</td>
                      <td className="p-4">
                        <span className="font-bold text-lg">{payment.amount.toLocaleString('ru-RU')} ₽</span>
                      </td>
                      <td className="p-4">
                        {getStatusBadge(payment.status)}
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {new Date(payment.planned_date || payment.payment_date || '').toLocaleDateString('ru-RU', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          {isPlannedPayments && onSubmitForApproval && (
                            <button
                              onClick={() => onSubmitForApproval(payment.id)}
                              className="px-3 py-1 text-xs rounded bg-green-500/20 text-green-300 hover:bg-green-500/30"
                            >
                              Создать платёж
                            </button>
                          )}
                          {!isPlannedPayments && (!payment.status || payment.status === 'draft') && onSubmitForApproval && (
                            <button
                              onClick={() => onSubmitForApproval(payment.id)}
                              className="px-3 py-1 text-xs rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/30"
                            >
                              Отправить
                            </button>
                          )}
                          {!isPlannedPayments && (payment.status === 'pending_tech_director' || payment.status === 'pending_ceo') && onApprove && onReject && (
                            <>
                              <button
                                onClick={() => onApprove(payment.id)}
                                className="px-3 py-1 text-xs rounded bg-green-500/20 text-green-300 hover:bg-green-500/30"
                              >
                                Одобрить
                              </button>
                              <button
                                onClick={() => onReject(payment.id)}
                                className="px-3 py-1 text-xs rounded bg-red-500/20 text-red-300 hover:bg-red-500/30"
                              >
                                Отклонить
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="md:hidden space-y-3 p-4">
              {payments.map((payment) => (
                <Card 
                  key={payment.id} 
                  className="border-white/10 bg-white/5 cursor-pointer hover:bg-white/10 transition-colors"
                  onClick={() => onPaymentClick && onPaymentClick(payment)}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                          <Icon name={payment.category_icon} size={18} />
                        </div>
                        <span className="font-medium">{payment.category_name}</span>
                      </div>
                      <span className="font-bold text-lg">{payment.amount.toLocaleString('ru-RU')} ₽</span>
                    </div>
                    {payment.legal_entity_name && (
                      <div className="text-sm">
                        <span className="text-muted-foreground/70">Юр. лицо: </span>
                        <span className="text-muted-foreground">{payment.legal_entity_name}</span>
                      </div>
                    )}
                    <div className="text-sm text-muted-foreground">{payment.description}</div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        {new Date(payment.planned_date || payment.payment_date || '').toLocaleDateString('ru-RU', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </div>
                      {!isPlannedPayments && getStatusBadge(payment.status)}
                    </div>
                    <div className="flex gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                      {isPlannedPayments && onSubmitForApproval && (
                        <button
                          onClick={() => onSubmitForApproval(payment.id)}
                          className="flex-1 px-3 py-2 text-sm rounded bg-green-500/20 text-green-300 hover:bg-green-500/30 font-medium"
                        >
                          Создать платёж
                        </button>
                      )}
                      {!isPlannedPayments && (!payment.status || payment.status === 'draft') && onSubmitForApproval && (
                        <button
                          onClick={() => onSubmitForApproval(payment.id)}
                          className="flex-1 px-3 py-2 text-sm rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 font-medium"
                        >
                          Отправить на согласование
                        </button>
                      )}
                      {!isPlannedPayments && (payment.status === 'pending_tech_director' || payment.status === 'pending_ceo') && onApprove && onReject && (
                        <>
                          <button
                            onClick={() => onApprove(payment.id)}
                            className="flex-1 px-3 py-2 text-sm rounded bg-green-500/20 text-green-300 hover:bg-green-500/30 font-medium"
                          >
                            Одобрить
                          </button>
                          <button
                            onClick={() => onReject(payment.id)}
                            className="flex-1 px-3 py-2 text-sm rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 font-medium"
                          >
                            Отклонить
                          </button>
                        </>
                      )}
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

export default PaymentsList;