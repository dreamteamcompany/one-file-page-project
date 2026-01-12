import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

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

interface Service {
  id: number;
  name: string;
  intermediate_approver_id: number;
  final_approver_id: number;
}

export const usePendingApprovalsData = () => {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !user) return;

    const loadData = async () => {
      try {
        const [paymentsRes, servicesRes] = await Promise.all([
          fetch('https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=payments', {
            headers: { 'X-Auth-Token': token },
          }),
          fetch('https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=services', {
            headers: { 'X-Auth-Token': token },
          }),
        ]);

        const paymentsData = await paymentsRes.json();
        const servicesData = await servicesRes.json();

        const servicesList = Array.isArray(servicesData) ? servicesData : (servicesData.services || []);
        setServices(servicesList);
        
        const allPayments = Array.isArray(paymentsData) ? paymentsData : [];
        
        const myPendingPayments = allPayments.filter((payment: Payment) => {
          if (!payment.status || !payment.service_id) {
            return false;
          }
          
          const service = servicesList.find((s: Service) => s.id === payment.service_id);
          if (!service) {
            return false;
          }
          
          if (payment.status === 'pending_ceo' && service.final_approver_id === user.id) {
            return true;
          }
          
          return false;
        });

        setPayments(myPendingPayments);
      } catch (err) {
        console.error('Failed to load data:', err);
        toast({
          title: 'Ошибка',
          description: 'Не удалось загрузить платежи',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [token, user, toast]);

  const handleApprove = async (paymentId: number, approveComment?: string) => {
    console.log('[handleApprove] Called with paymentId:', paymentId, 'comment:', approveComment);
    try {
      const response = await fetch('https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=approvals', {
        method: 'PUT',
        headers: {
          'X-Auth-Token': token!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payment_id: paymentId,
          action: 'approve',
          comment: approveComment || '',
        }),
      });

      if (response.ok) {
        toast({
          title: 'Успешно',
          description: 'Платёж согласован',
        });
        setPayments(prevPayments => prevPayments.filter(p => p.id !== paymentId));
      } else {
        const errorData = await response.json();
        toast({
          title: 'Ошибка',
          description: errorData.error || 'Не удалось согласовать платёж',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Approve error:', err);
      toast({
        title: 'Ошибка',
        description: 'Не удалось согласовать платёж',
        variant: 'destructive',
      });
    }
  };

  const handleReject = async (paymentId: number, rejectComment?: string) => {
    console.log('[handleReject] Called with paymentId:', paymentId, 'comment:', rejectComment);
    try {
      const response = await fetch('https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=approvals', {
        method: 'PUT',
        headers: {
          'X-Auth-Token': token!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payment_id: paymentId,
          action: 'reject',
          comment: rejectComment || '',
        }),
      });

      if (response.ok) {
        toast({
          title: 'Успешно',
          description: 'Платёж отклонён',
        });
        setPayments(prevPayments => prevPayments.filter(p => p.id !== paymentId));
      } else {
        const errorData = await response.json();
        toast({
          title: 'Ошибка',
          description: errorData.error || 'Не удалось отклонить платёж',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Reject error:', err);
      toast({
        title: 'Ошибка',
        description: 'Не удалось отклонить платёж',
        variant: 'destructive',
      });
    }
  };

  return {
    payments,
    services,
    loading,
    handleApprove,
    handleReject,
  };
};