import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PaymentsSidebar from '@/components/payments/PaymentsSidebar';
import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { usePendingApprovals } from '@/hooks/usePendingApprovals';
import PendingApprovalsHeader from '@/components/approvals/PendingApprovalsHeader';
import PendingApprovalsFilters from '@/components/approvals/PendingApprovalsFilters';
import PendingApprovalsList from '@/components/approvals/PendingApprovalsList';
import PendingApprovalsModal from '@/components/approvals/PendingApprovalsModal';
import { usePendingApprovalsData } from '@/hooks/usePendingApprovalsData';
import { usePendingApprovalsFilters } from '@/hooks/usePendingApprovalsFilters';

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

const PendingApprovals = () => {
  const { requestNotificationPermission } = usePendingApprovals();
  const { payments, services, loading, handleApprove, handleReject } = usePendingApprovalsData();
  
  const {
    searchQuery,
    setSearchQuery,
    selectedService,
    setSelectedService,
    amountFrom,
    setAmountFrom,
    amountTo,
    setAmountTo,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    showFilters,
    setShowFilters,
    filteredPayments,
    activeFiltersCount,
    clearFilters,
  } = usePendingApprovalsFilters(payments);

  const [dictionariesOpen, setDictionariesOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

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

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'pending_ceo':
        return <span className="px-3 py-1 rounded-full text-xs bg-yellow-500/20 text-yellow-300">Ожидает CEO</span>;
      default:
        return null;
    }
  };

  const handleModalApprove = (paymentId: number, comment?: string) => {
    console.log('[handleModalApprove] Called with paymentId:', paymentId, 'comment:', comment);
    console.log('[handleModalApprove] handleApprove type:', typeof handleApprove);
    if (typeof handleApprove === 'function') {
      handleApprove(paymentId, comment);
      setSelectedPayment(null);
    } else {
      console.error('[handleModalApprove] handleApprove is not a function!', handleApprove);
    }
  };

  const handleModalReject = (paymentId: number, comment?: string) => {
    console.log('[handleModalReject] Called with paymentId:', paymentId, 'comment:', comment);
    console.log('[handleModalReject] handleReject type:', typeof handleReject);
    if (typeof handleReject === 'function') {
      handleReject(paymentId, comment);
      setSelectedPayment(null);
    } else {
      console.error('[handleModalReject] handleReject is not a function!', handleReject);
    }
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

      <main className="flex-1 lg:ml-64 bg-background min-h-screen overflow-x-hidden max-w-full">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-white/10">
          <div className="px-4 sm:px-6 py-3 flex items-center justify-between">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              <Icon name="Menu" size={24} />
            </button>
            <div className="flex-1 lg:ml-0 ml-2 mt-[5px]">
              <h1 className="text-2xl md:text-3xl font-bold">На согласовании</h1>
              <p className="text-sm md:text-base text-muted-foreground">
                Платежи, ожидающие вашего решения
              </p>
            </div>
          </div>
          
          <div className="px-4 sm:px-6 py-3 border-t border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 relative">
                <Icon name="Search" size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Поиск по описанию, категории, сумме..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-background border-white/10"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="relative p-2 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
              >
                <Icon name="SlidersHorizontal" size={20} />
                {activeFiltersCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                    {activeFiltersCount}
                  </span>
                )}
              </button>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/approved-payments"
                className="px-4 py-2 rounded-lg border border-green-500/30 bg-green-500/10 hover:bg-green-500/20 text-green-400 transition-colors flex items-center gap-2"
              >
                <Icon name="CheckCircle" size={18} />
                <span className="text-sm font-medium">Согласованные и оплаченные</span>
              </Link>
              <Link
                to="/rejected-payments"
                className="px-4 py-2 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors flex items-center gap-2"
              >
                <Icon name="XCircle" size={18} />
                <span className="text-sm font-medium">Отклонённые</span>
              </Link>
            </div>

            {showFilters && (
              <PendingApprovalsFilters
                services={services}
                selectedService={selectedService}
                setSelectedService={setSelectedService}
                amountFrom={amountFrom}
                setAmountFrom={setAmountFrom}
                amountTo={amountTo}
                setAmountTo={setAmountTo}
                dateFrom={dateFrom}
                setDateFrom={setDateFrom}
                dateTo={dateTo}
                setDateTo={setDateTo}
                activeFiltersCount={activeFiltersCount}
                clearFilters={clearFilters}
              />
            )}
          </div>

          {notificationPermission !== 'granted' && (
            <div className="px-4 sm:px-6 py-3 bg-yellow-500/10 border-b border-yellow-500/20">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm text-yellow-200">
                  <Icon name="Bell" size={16} />
                  <span>Включите уведомления, чтобы не пропустить новые заявки</span>
                </div>
                <button
                  onClick={requestNotificationPermission}
                  className="text-sm text-yellow-200 hover:text-yellow-100 font-medium whitespace-nowrap"
                >
                  Включить
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📋</div>
              <h3 className="text-xl font-semibold mb-2">Нет заявок на согласование</h3>
              <p className="text-muted-foreground">
                {payments.length === 0 
                  ? 'Когда появятся заявки, требующие вашего согласования, они отобразятся здесь'
                  : 'Попробуйте изменить фильтры поиска'}
              </p>
            </div>
          ) : (
            <PendingApprovalsList
              loading={loading}
              payments={filteredPayments}
              searchQuery={searchQuery}
              handleApprove={handleModalApprove}
              handleReject={handleModalReject}
              getStatusBadge={getStatusBadge}
              onPaymentClick={setSelectedPayment}
            />
          )}
        </div>

        <PendingApprovalsModal
          payment={selectedPayment}
          onClose={() => setSelectedPayment(null)}
          onApprove={handleModalApprove}
          onReject={handleModalReject}
        />
      </main>
    </div>
  );
};

export default PendingApprovals;