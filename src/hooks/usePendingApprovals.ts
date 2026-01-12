import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface Payment {
  id: number;
  status?: string;
  service_id?: number;
  description?: string;
  amount?: number;
  category_name?: string;
}

interface Service {
  id: number;
  intermediate_approver_id: number;
  final_approver_id: number;
}

export const usePendingApprovals = () => {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingPayments, setPendingPayments] = useState<Payment[]>([]);
  const previousCountRef = useRef<number>(0);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (!token || !user) return;

    const loadPendingApprovals = async () => {
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

        const allPayments = Array.isArray(paymentsData) ? paymentsData : [];
        const services = Array.isArray(servicesData) ? servicesData : [];

        const myPendingPayments = allPayments.filter((payment: Payment) => {
          if (!payment.status || !payment.service_id) return false;

          const service = services.find((s: Service) => s.id === payment.service_id);
          if (!service) return false;

          if (payment.status === 'pending_tech_director' && service.intermediate_approver_id === user.id) {
            return true;
          }

          if (payment.status === 'pending_ceo' && service.final_approver_id === user.id) {
            return true;
          }

          return false;
        });

        const currentCount = myPendingPayments.length;
        setPendingCount(currentCount);
        setPendingPayments(myPendingPayments);

        if (!isInitialLoad.current && currentCount > previousCountRef.current) {
          const newPaymentsCount = currentCount - previousCountRef.current;
          const lastPayment = myPendingPayments[0];

          const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBDGH0fPTgjMGHm7A7+OZSA0PVKzn7q1aFwtDmuTyvWsjBSyBzfHZiTgIG2m98OWhUQ0NTqfi8LRlHwc5ldb0yoA1Bxt0w/DbmE0PD1am5fCsXhsLQ5zk876tJAU2idTy0oU4ByBxy+/cnE8ND1Gq5O+zYxwGO5fX9Mx+NwcbbMDv3ZlLDhBTrOXurV0bCkSb5fK8rSMGLH/M8diJOQgbbsjv35xPDwxPqeLusWIcBzuY2PTLfzcHHG/D7+CbSw0OUazl7KxeHApFnePzu64jBSh9zPLXijsIG3DI8OGdTQ4OT6nh7bJjHQc9mdj0yoA2ByBuxO3cnEwNDlKr5eyqXBsLRJrj8r6tIwYsf8zw14o7CBtwyPDhnU0ODk+p4e2yYx0HPZnY9MqANgcgbsTt3JxMDQ5Sq+XsqlwbC0Sa4/K+rSMGLH/M8NeKOwgbcMjw4Z1NDg5PqeHtsmMdBz2Z2PTKgDYHIG7E7dycTA0OUqvl7KpcGwtEmuPyvq0jBix/zPDXijsIG3DI8OGdTQ4OT6nh7bJjHQc9mdj0yoA2ByBuxO3cnEwNDlKr5eyqXBsLRJrj8r6tIwYsf8zw14o7CBtwyPDhnU0ODk+p4e2yYx0HPZnY9MqANgcgbsTt3JxMDQ5Sq+XsqlwbC0Sa4/K+rSMGLH/M8NeKOwgbcMjw4Z1NDg5PqeHtsmMdBz2Z2PTKgDYHIG7E7dycTA0OUqvl7KpcGwtEmuPyvq0jBix/zPDXijsIG3DI8OGdTQ4OT6nh7bJjHQc9mdj0yoA2ByBuxO3cnEwNDlKr5eyqXBsLRJrj8r6tIwYsf8zw14o7CBtwyPDhnU0ODk+p4e2yYx0HPZnY9MqANgcgbsTt3JxMDQ5Sq+XsqlwbC0Sa4/K+rSMGLH/M8NeKOwgbcMjw4Z1NDg5PqeHtsmMdBz2Z2PTKgDYHIG7E7dycTA0OUqvl7KpcGwtEmuPyvq0jBix/zPDXijsIG3DI8OGdTQ4OT6nh7bJjHQc9mdj0yoA2ByBuxO3cnEwNDlKr5eyqXBsLRJrj8r6tIwYsf8zw14o7CBtwyPDhnU0ODk+p4e2yYx0HPZnY9MqANgcgbsTt3JxMDQ5Sq+XsqlwbC0Sa4/K+rSMGLH/M8NeKOwgbcMjw4Z1NDg5PqeHtsmMdBz2Z2PTKgDYHIG7E7dycTA0OUqvl7KpcGwtEmuPyvq0jBix/zPDXijsIG3DI8OGdTQ4OT6nh7bJjHQc9mdj0yoA2ByBuxO3cnEwNDlKr5eyqXBsLRJrj8r6tIwYsf8zw14o7CBtwyPDhnU0ODk+p4e2yYx0HPZnY9MqANgcgbsTt3JxMDQ5Sq+XsqlwbC0Sa4/K+rSMGLH/M8NeKOwgbcMjw4Z1NDg5PqeHtsmMdBz2Z2PTKgDYHIG7E7dycTA0OUqvl7KpcGwtEmuPyA==');
          audio.volume = 0.3;
          audio.play().catch(err => console.log('Audio play failed:', err));

          toast({
            title: '🔔 Новый платёж на согласование',
            description: lastPayment?.description 
              ? `${lastPayment.description} — ${lastPayment.amount?.toLocaleString('ru-RU')} ₽`
              : `${newPaymentsCount} ${newPaymentsCount === 1 ? 'новый платёж' : 'новых платежей'} ожидает согласования`,
            duration: 8000,
          });

          if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200]);
          }

          if (Notification.permission === 'granted') {
            new Notification('Новый платёж на согласование', {
              body: lastPayment?.description || `${newPaymentsCount} новых платежей`,
              icon: '/favicon.ico',
              tag: 'pending-approval',
              requireInteraction: false,
            });
          }
        }

        previousCountRef.current = currentCount;
        isInitialLoad.current = false;
      } catch (err) {
        console.error('Failed to load pending approvals:', err);
      }
    };

    loadPendingApprovals();
    const interval = setInterval(loadPendingApprovals, 30000);

    return () => clearInterval(interval);
  }, [token, user, toast]);

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        toast({
          title: '✅ Уведомления включены',
          description: 'Вы будете получать уведомления о новых платежах',
        });
      }
    }
  };

  return {
    pendingCount,
    pendingPayments,
    requestNotificationPermission,
  };
};