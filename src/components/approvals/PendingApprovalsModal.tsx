import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import PaymentComments from './PaymentComments';
import PaymentAuditLog from './PaymentAuditLog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

interface PendingApprovalsModalProps {
  payment: Payment | null;
  onClose: () => void;
  onApprove: (paymentId: number, comment?: string) => void;
  onReject: (paymentId: number, comment?: string) => void;
}

const PendingApprovalsModal = ({ payment, onClose, onApprove, onReject }: PendingApprovalsModalProps) => {
  if (!payment) return null;

  const handleApprove = () => {
    console.log('[PendingApprovalsModal handleApprove] onClick triggered');
    console.log('[PendingApprovalsModal handleApprove] onApprove type:', typeof onApprove);
    console.log('[PendingApprovalsModal handleApprove] payment.id:', payment.id);
    if (typeof onApprove === 'function') {
      onApprove(payment.id);
    } else {
      console.error('[PendingApprovalsModal handleApprove] onApprove is not a function!', onApprove);
    }
  };

  const handleReject = () => {
    console.log('[PendingApprovalsModal handleReject] onClick triggered');
    console.log('[PendingApprovalsModal handleReject] onReject type:', typeof onReject);
    console.log('[PendingApprovalsModal handleReject] payment.id:', payment.id);
    if (typeof onReject === 'function') {
      onReject(payment.id);
    } else {
      console.error('[PendingApprovalsModal handleReject] onReject is not a function!', onReject);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-card border border-white/10 rounded-xl w-full max-w-[1400px] h-[95vh] sm:h-[90vh] flex flex-col">
        <div className="bg-card border-b border-white/10 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-semibold">Детали заявки #{payment.id}</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-white transition-colors"
          >
            <Icon name="X" size={20} />
          </button>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          <div className="w-full lg:w-1/2 lg:border-r border-white/10 flex flex-col overflow-y-auto lg:overflow-hidden">
            <div className="lg:flex-1 lg:overflow-y-auto p-4 sm:p-6 space-y-3 sm:space-y-4">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="bg-primary/20 p-2 sm:p-3 rounded-lg">
                  <span className="text-xl sm:text-2xl">{payment.category_icon}</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-base sm:text-lg font-medium mb-1">{payment.category_name}</h3>
                  <p className="text-2xl sm:text-3xl font-bold text-primary">{payment.amount.toLocaleString('ru-RU')} ₽</p>
                </div>
              </div>

              {payment.description && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Описание</p>
                  <p className="font-medium">{payment.description}</p>
                </div>
              )}

              {payment.legal_entity_name && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Юридическое лицо</p>
                  <p className="font-medium">{payment.legal_entity_name}</p>
                </div>
              )}

              {payment.contractor_name && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Контрагент</p>
                  <p className="font-medium">{payment.contractor_name}</p>
                </div>
              )}

              {payment.department_name && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Отдел-заказчик</p>
                  <p className="font-medium">{payment.department_name}</p>
                </div>
              )}

              {payment.service_name && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Сервис</p>
                  <p className="font-medium">{payment.service_name}</p>
                </div>
              )}

              {payment.invoice_number && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Номер счёта</p>
                  <p className="font-medium">{payment.invoice_number}</p>
                </div>
              )}

              {payment.created_by_name && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Создал заявку</p>
                  <p className="font-medium">{payment.created_by_name}</p>
                </div>
              )}

              {payment.custom_fields && payment.custom_fields.length > 0 && (
                <>
                  {payment.custom_fields.map((field) => (
                    <div key={field.id}>
                      <p className="text-sm text-muted-foreground mb-1">{field.name}</p>
                      {field.field_type === 'file' && field.value ? (
                        <a 
                          href={field.value} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="font-medium text-primary hover:underline flex items-center gap-2"
                        >
                          <Icon name="Download" size={16} />
                          Скачать файл
                        </a>
                      ) : (
                        <p className="font-medium">{field.value}</p>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>

            <div className="border-t border-white/10 p-4 sm:p-6">
              <div className="flex gap-2 sm:gap-3">
                <button
                  onClick={handleApprove}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 sm:py-3 rounded-lg text-sm sm:text-base font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Icon name="Check" size={18} />
                  Согласовать
                </button>
                <button
                  onClick={handleReject}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 sm:py-3 rounded-lg text-sm sm:text-base font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Icon name="X" size={18} />
                  Отклонить
                </button>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-1/2 flex flex-col border-t lg:border-t-0 border-white/10 lg:overflow-hidden min-h-[400px]">
            <div className="p-4 sm:p-6 border-b border-white/10">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Дата платежа:</span>
                  <span className="font-medium">{new Date(payment.payment_date).toLocaleDateString('ru-RU')}</span>
                </div>
                {payment.submitted_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Дата отправки:</span>
                    <span className="font-medium">{new Date(payment.submitted_at).toLocaleDateString('ru-RU')}</span>
                  </div>
                )}
                {payment.invoice_date && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Дата счёта:</span>
                    <span className="font-medium">{new Date(payment.invoice_date).toLocaleDateString('ru-RU')}</span>
                  </div>
                )}
                {payment.created_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Создана:</span>
                    <span className="font-medium">{new Date(payment.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
              <Tabs defaultValue="comments" className="flex-1 flex flex-col">
                <TabsList className="mx-4 mt-2">
                  <TabsTrigger value="comments" className="flex items-center gap-2">
                    <Icon name="MessageSquare" size={16} />
                    Обсуждение
                  </TabsTrigger>
                  <TabsTrigger value="history" className="flex items-center gap-2">
                    <Icon name="History" size={16} />
                    История
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="comments" className="flex-1 overflow-hidden mt-0">
                  <PaymentComments paymentId={payment.id} />
                </TabsContent>
                <TabsContent value="history" className="flex-1 overflow-hidden p-4">
                  <PaymentAuditLog paymentId={payment.id} />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PendingApprovalsModal;