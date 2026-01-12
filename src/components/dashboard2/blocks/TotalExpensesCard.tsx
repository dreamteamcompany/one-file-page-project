import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardStats {
  total_amount: number;
  total_count: number;
  change_percent: number;
  is_increase: boolean;
}

const TotalExpensesCard = () => {
  const { token } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!token) return;
      
      try {
        const response = await fetch(
          'https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=dashboard-stats',
          {
            headers: {
              'X-Auth-Token': token,
            },
          }
        );
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [token]);

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ₽';
  };

  return (
    <Card className="h-full" style={{ background: '#111c44', border: '1px solid rgba(117, 81, 233, 0.4)', borderTop: '4px solid #7551e9', boxShadow: '0 0 30px rgba(117, 81, 233, 0.2), inset 0 0 15px rgba(117, 81, 233, 0.05)' }}>
      <CardContent className="p-4 sm:p-6 h-full flex flex-col justify-between">
        <div className="flex justify-between items-start mb-4 sm:mb-5">
          <div>
            <div className="text-base sm:text-lg font-bold mb-2" style={{ color: '#fff' }}>Общие IT Расходы</div>
            <div className="text-xs sm:text-sm font-medium" style={{ color: '#a3aed0' }}>
              {loading ? 'Загрузка...' : `${stats?.total_count || 0} платежей`}
            </div>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(117, 81, 233, 0.1)', color: '#7551e9', border: '1px solid rgba(117, 81, 233, 0.2)' }}>
            <Icon name="Server" size={18} className="sm:w-5 sm:h-5" />
          </div>
        </div>
        <div className="text-2xl sm:text-3xl font-extrabold mb-2" style={{ color: '#fff' }}>
          {loading ? '...' : formatAmount(stats?.total_amount || 0)}
        </div>
        <div className="text-xs sm:text-sm font-medium mb-3" style={{ color: '#a3aed0' }}>Общая сумма расходов</div>
        {!loading && stats && (
          <div className="flex items-center text-xs sm:text-sm font-semibold gap-1.5" style={{ color: stats.is_increase ? '#e31a1a' : '#01b574' }}>
            <Icon name={stats.is_increase ? "ArrowUp" : "ArrowDown"} size={14} />
            {stats.is_increase ? '+' : ''}{stats.change_percent}% с прошлого месяца
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TotalExpensesCard;