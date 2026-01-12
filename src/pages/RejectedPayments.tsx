import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';
import PaymentsSidebar from '@/components/payments/PaymentsSidebar';
import PaymentsHeader from '@/components/payments/PaymentsHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import PaymentDetailsModal from '@/components/payments/PaymentDetailsModal';

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
  rejected_at?: string;
  rejection_comment?: string;
  custom_fields?: CustomField[];
}

const RejectedPayments = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [dictionariesOpen, setDictionariesOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  useEffect(() => {
    fetchRejectedPayments();
  }, []);

  const fetchRejectedPayments = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=payments');
      const data = await response.json();
      
      const rejectedPayments = (Array.isArray(data) ? data : []).filter((p: Payment) => 
        p.status === 'rejected'
      );
      
      setPayments(rejectedPayments);
    } catch (error) {
      console.error('Failed to fetch rejected payments:', error);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (touchStart - touchEnd > 75) {
      setMenuOpen(false);
    }
  };

  const filteredPayments = payments.filter(payment => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      payment.description.toLowerCase().includes(query) ||
      payment.category_name.toLowerCase().includes(query) ||
      payment.amount.toString().includes(query) ||
      payment.contractor_name?.toLowerCase().includes(query) ||
      payment.legal_entity_name?.toLowerCase().includes(query)
    );
  });

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div className="flex min-h-screen">
      <PaymentsSidebar
        menuOpen={menuOpen}
        dictionariesOpen={dictionariesOpen}
        setDictionariesOpen={setDictionariesOpen}
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        handleTouchStart={handleTouchStart}
        handleTouchMove={handleTouchMove}
        handleTouchEnd={handleTouchEnd}
      />

      {menuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <main className="flex-1 lg:ml-64 bg-background min-h-screen overflow-x-hidden max-w-full">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-white/10">
          <PaymentsHeader menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
          
          <div className="px-4 sm:px-6 py-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Icon name="XCircle" size={28} className="text-red-500" />
                  Отклонённые платежи
                </h1>
                <p className="text-muted-foreground mt-1">
                  Все платежи, которые были отклонены
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => navigate('/pending-approvals')}
                className="flex items-center gap-2"
              >
                <Icon name="ArrowLeft" size={18} />
                Назад
              </Button>
            </div>

            <div className="relative">
              <Icon name="Search" size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Поиск по описанию, категории, сумме..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-background border-white/10"
              />
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">❌</div>
              <h3 className="text-xl font-semibold mb-2">Нет отклонённых платежей</h3>
              <p className="text-muted-foreground">
                {payments.length === 0 
                  ? 'Когда платежи будут отклонены, они отобразятся здесь'
                  : 'Попробуйте изменить поисковый запрос'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPayments.map((payment) => (
                <Card 
                  key={payment.id} 
                  className="border-white/5 bg-card shadow-[0_4px_20px_rgba(0,0,0,0.25)] hover:border-white/10 transition-all cursor-pointer" 
                  onClick={() => setSelectedPayment(payment)}
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400 flex-shrink-0">
                            <Icon name={payment.category_icon} size={24} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <h3 className="text-lg font-semibold">{payment.category_name}</h3>
                              <span className="px-3 py-1 rounded-full text-xs bg-red-500/20 text-red-300">✗ Отклонено</span>
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
                            {payment.rejection_comment && (
                              <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                <div className="text-xs text-red-300 mb-1 font-medium">Причина отклонения:</div>
                                <div className="text-sm text-red-200">{payment.rejection_comment}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-start lg:items-end gap-2 lg:border-l lg:border-white/10 lg:pl-6">
                        <div className="text-center lg:text-right">
                          <div className="text-sm text-muted-foreground mb-1">Сумма платежа</div>
                          <div className="text-2xl font-bold">{payment.amount.toLocaleString('ru-RU')} ₽</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <PaymentDetailsModal
          payment={selectedPayment}
          onClose={() => setSelectedPayment(null)}
        />
      </main>
    </div>
  );
};

export default RejectedPayments;