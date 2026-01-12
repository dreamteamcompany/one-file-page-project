import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSidebarTouch } from '@/hooks/useSidebarTouch';
import PaymentsSidebar from '@/components/payments/PaymentsSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { apiFetch } from '@/utils/api';
import PaymentDetailsModal from '@/components/payments/PaymentDetailsModal';

interface Payment {
  id: number;
  service: string;
  amount: number;
  status: string;
  payment_date: string;
  description: string;
  contractor: string;
  legal_entity: string;
  department: string;
  category_id: number;
  category_name: string;
  category_icon: string;
  service_id?: number;
  service_name?: string;
  contractor_id?: number;
  contractor_name?: string;
  legal_entity_id?: number;
  legal_entity_name?: string;
  department_id?: number;
  department_name?: string;
  invoice_number?: string;
  invoice_date?: string;
  created_at?: string;
}

interface CategoryInfo {
  name: string;
  icon: string;
  color: string;
  total_amount: number;
  payments_count: number;
}

const CategoryPayments = () => {
  const { categoryId } = useParams<{ categoryId: string }>();
  const navigate = useNavigate();
  const [categoryInfo, setCategoryInfo] = useState<CategoryInfo | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [dictionariesOpen, setDictionariesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  const {
    menuOpen,
    setMenuOpen,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = useSidebarTouch();

  useEffect(() => {
    if (!categoryId) return;

    apiFetch(`https://functions.poehali.dev/20167b17-c827-4e24-b1a1-2ca1571d5bab?category_id=${categoryId}`)
      .then(res => res.json())
      .then(data => {
        setCategoryInfo(data.category);
        setPayments(data.payments);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load category payments:', err);
        setLoading(false);
      });
  }, [categoryId]);

  const statusColors: Record<string, string> = {
    draft: '#6c757d',
    pending: '#ffc107',
    approved: '#28a745',
    rejected: '#dc3545',
    paid: '#17a2b8'
  };

  const statusLabels: Record<string, string> = {
    draft: 'Черновик',
    pending: 'На согласовании',
    approved: 'Одобрено',
    rejected: 'Отклонено',
    paid: 'Оплачено'
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

      <main className="lg:ml-[250px] p-4 md:p-6 lg:p-[30px] min-h-screen flex-1 overflow-x-hidden max-w-full">
        <div className="flex items-center gap-3 mb-6">
          <button
            className="lg:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Icon name="Menu" size={24} style={{ color: '#fff' }} />
          </button>
        </div>

        {loading ? (
          <div className="text-[#a3aed0] p-8">Загрузка...</div>
        ) : !categoryInfo ? (
          <div className="text-[#a3aed0] p-8">Категория не найдена</div>
        ) : (
          <>
            <div 
              className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8 cursor-pointer"
              onClick={() => navigate('/')}
            >
              <Icon name="ArrowLeft" className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#7551e9' }} />
              <div style={{ 
                background: `linear-gradient(135deg, ${categoryInfo.color} 0%, ${categoryInfo.color}cc 100%)`,
                boxShadow: `0 0 25px ${categoryInfo.color}60`
              }} className="p-2.5 sm:p-3 rounded-xl">
                <Icon name={categoryInfo.icon} fallback="Tag" className="w-6 h-6 sm:w-7 sm:h-7" style={{ color: '#fff' }} />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white mb-1 truncate">
                  {categoryInfo.name}
                </h1>
                <p className="text-xs sm:text-sm text-[#a3aed0] truncate">
                  {categoryInfo.payments_count} платежей • {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(categoryInfo.total_amount)}
                </p>
              </div>
            </div>

            <Card style={{ 
              background: 'linear-gradient(135deg, #1a1f37 0%, #111c44 100%)', 
              border: '1px solid rgba(117, 81, 233, 0.3)'
            }}>
              <CardHeader>
                <CardTitle style={{ color: '#fff' }}>Все платежи</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  {payments.map(payment => (
                    <div
                      key={payment.id}
                      onClick={() => setSelectedPayment(payment)}
                      className="bg-white/[0.03] p-3 sm:p-4 rounded-xl border border-white/[0.08] cursor-pointer transition-all duration-300 hover:bg-white/[0.05] hover:border-[#7551e9]/50"
                    >
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-4 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm sm:text-base font-semibold mb-1 truncate">
                            {payment.service}
                          </div>
                          <div className="text-[#a3aed0] text-xs sm:text-sm truncate">
                            {payment.contractor} • {payment.department}
                          </div>
                        </div>
                        <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-1">
                          <div style={{ color: categoryInfo.color }} className="text-base sm:text-lg font-bold whitespace-nowrap">
                            {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(payment.amount)}
                          </div>
                          <div style={{
                            background: statusColors[payment.status] + '20',
                            color: statusColors[payment.status]
                          }} className="inline-block px-2 py-1 rounded-md text-[10px] sm:text-xs font-semibold whitespace-nowrap">
                            {statusLabels[payment.status] || payment.status}
                          </div>
                        </div>
                      </div>
                      <div className="text-[#a3aed0] text-xs sm:text-sm mt-2 pt-2 border-t border-white/5 line-clamp-2">
                        {payment.description}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {selectedPayment && (
          <PaymentDetailsModal
            payment={selectedPayment}
            onClose={() => setSelectedPayment(null)}
          />
        )}
      </main>
    </div>
  );
};

export default CategoryPayments;