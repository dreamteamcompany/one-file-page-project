import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/contexts/AuthContext';

interface SavingsData {
  total_amount: number;
  count: number;
  top_departments: Array<{
    department_name: string;
    total_saved: number;
  }>;
}

const AnnualSavingsStatCard = () => {
  const [savingsData, setSavingsData] = useState<SavingsData | null>(null);
  const { token } = useAuth();

  useEffect(() => {
    if (token) {
      loadSavingsData();
    }
  }, [token]);

  const loadSavingsData = async () => {
    try {
      const response = await fetch('https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=savings-dashboard', {
        headers: {
          'X-Auth-Token': token || '',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Savings data loaded:', data);
        setSavingsData(data);
      } else {
        console.error('Failed to load savings, status:', response.status);
      }
    } catch (err) {
      console.error('Failed to load savings data:', err);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Card style={{ 
      background: 'linear-gradient(135deg, #1a1f37 0%, #111c44 100%)', 
      border: '1px solid rgba(1, 181, 116, 0.3)',
      boxShadow: '0 0 30px rgba(1, 181, 116, 0.15)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <CardContent className="p-6" style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px', color: '#fff' }}>Экономия</div>
            <div style={{ color: '#a3aed0', fontSize: '13px', fontWeight: '500' }}>Общая экономия по реестру</div>
          </div>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(1, 181, 116, 0.1)', color: '#01b574', border: '1px solid rgba(1, 181, 116, 0.2)' }}>
            <Icon name="PiggyBank" size={20} />
          </div>
        </div>

        <div style={{ fontSize: '28px', fontWeight: '800', marginBottom: '4px', color: '#01b574', textShadow: '0 0 20px rgba(1, 181, 116, 0.4)' }}>
          {savingsData ? formatAmount(savingsData.total_amount) : '—'}
        </div>
        <div style={{ color: '#a3aed0', fontSize: '13px', fontWeight: '500', marginBottom: '16px' }}>
          {savingsData ? `${savingsData.count} ${savingsData.count === 1 ? 'запись' : 'записей'} в реестре` : 'Загрузка...'}
        </div>

        {savingsData && savingsData.top_departments.length > 0 && (
          <div style={{ 
            borderTop: '1px solid rgba(163, 174, 208, 0.1)', 
            paddingTop: '12px',
            marginTop: '12px'
          }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#a3aed0', marginBottom: '8px' }}>
              Топ отделов-заказчиков:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {savingsData.top_departments.slice(0, 3).map((dept, index) => (
                <div 
                  key={index}
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    fontSize: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fff' }}>
                    <span style={{ 
                      width: '18px', 
                      height: '18px', 
                      borderRadius: '4px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      background: index === 0 ? 'rgba(1, 181, 116, 0.2)' : 'rgba(163, 174, 208, 0.1)',
                      color: index === 0 ? '#01b574' : '#a3aed0',
                      fontSize: '10px',
                      fontWeight: '700'
                    }}>
                      {index + 1}
                    </span>
                    <span style={{ fontWeight: '500' }}>{dept.department_name || 'Не указан'}</span>
                  </div>
                  <span style={{ fontWeight: '600', color: '#01b574' }}>
                    {formatAmount(dept.total_saved)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AnnualSavingsStatCard;