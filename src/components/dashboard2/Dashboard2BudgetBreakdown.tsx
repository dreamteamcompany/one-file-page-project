import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '@/utils/api';

interface Payment {
  service: string;
  amount: number;
  status: string;
}

interface BudgetCategory {
  category_id: number;
  name: string;
  icon: string;
  amount: number;
  percentage: number;
  payments: Payment[];
}

const Dashboard2BudgetBreakdown = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalBudget, setTotalBudget] = useState(0);

  useEffect(() => {
    apiFetch('https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=budget-breakdown')
      .then(res => res.json())
      .then((data: BudgetCategory[]) => {
        setCategories(Array.isArray(data) ? data : []);
        const total = data.reduce((sum, cat) => sum + cat.amount, 0);
        setTotalBudget(total);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load budget breakdown:', err);
        setCategories([]);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <Card style={{ 
        background: 'linear-gradient(135deg, #1a1f37 0%, #111c44 100%)', 
        border: '1px solid rgba(117, 81, 233, 0.3)',
        marginBottom: '30px'
      }}>
        <CardContent className="p-4 sm:p-6">
          <div style={{ textAlign: 'center', color: '#a3aed0', padding: '40px' }}>Загрузка данных бюджета...</div>
        </CardContent>
      </Card>
    );
  }

  if (categories.length === 0) {
    return (
      <Card style={{ 
        background: 'linear-gradient(135deg, #1a1f37 0%, #111c44 100%)', 
        border: '1px solid rgba(117, 81, 233, 0.3)',
        marginBottom: '30px'
      }}>
        <CardContent className="p-4 sm:p-6">
          <div style={{ textAlign: 'center', color: '#a3aed0', padding: '40px' }}>Нет данных по бюджету</div>
        </CardContent>
      </Card>
    );
  }

  const colorMap: { [key: string]: string } = {
    'Серверы': '#7551e9',
    'SaaS': '#3965ff',
    'Безопасность': '#01b574',
    'Оборудование': '#ffb547',
    'Разработка': '#ff6b6b',
    'Базы данных': '#a855f7'
  };

  const getColorForCategory = (index: number): string => {
    const colors = ['#7551e9', '#3965ff', '#01b574', '#ffb547', '#ff6b6b', '#a855f7', '#ec4899', '#10b981'];
    return colors[index % colors.length];
  };

  return (
    <Card style={{ 
      background: 'linear-gradient(135deg, #1a1f37 0%, #111c44 100%)', 
      border: '1px solid rgba(117, 81, 233, 0.3)',
      boxShadow: '0 0 40px rgba(117, 81, 233, 0.2), inset 0 0 30px rgba(117, 81, 233, 0.08)',
      position: 'relative',
      overflow: 'hidden',
      marginBottom: '30px'
    }}>
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '0',
        width: '100%',
        height: '2px',
        background: 'linear-gradient(90deg, transparent 0%, rgba(117, 81, 233, 0.5) 50%, transparent 100%)',
        pointerEvents: 'none',
        animation: 'slide 3s infinite'
      }} />
      <CardContent className="p-4 sm:p-6" style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }} className="sm:flex-row sm:justify-between sm:items-center sm:mb-8">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} className="sm:gap-3">
            <div style={{ 
              background: 'linear-gradient(135deg, #7551e9 0%, #5a3ec5 100%)',
              padding: '10px',
              borderRadius: '12px',
              boxShadow: '0 0 25px rgba(117, 81, 233, 0.6)'
            }} className="sm:p-3.5">
              <Icon name="PieChart" size={20} style={{ color: '#fff' }} className="sm:w-7 sm:h-7" />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#fff' }} className="sm:text-xl md:text-2xl">Детальная Разбивка IT Бюджета</h3>
              <p style={{ fontSize: '12px', color: '#a3aed0', marginTop: '2px' }} className="sm:text-sm sm:mt-1">Полный анализ всех категорий расходов</p>
            </div>
          </div>
          <div style={{ 
            background: 'rgba(117, 81, 233, 0.15)',
            padding: '10px 16px',
            borderRadius: '10px',
            border: '1px solid rgba(117, 81, 233, 0.3)'
          }} className="sm:px-6 sm:py-3">
            <span style={{ color: '#7551e9', fontSize: '14px', fontWeight: '700' }} className="sm:text-base">
              Общий бюджет: {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(totalBudget)}
            </span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {categories.map((category, idx) => {
            const color = colorMap[category.name] || getColorForCategory(idx);
            return (
            <div key={idx} style={{ 
              background: `linear-gradient(135deg, ${color}15 0%, ${color}08 100%)`,
              padding: '16px',
              borderRadius: '14px',
              border: `1px solid ${color}30`,
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden'
            }}
            onClick={() => navigate(`/category/${category.category_id}`)}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
              e.currentTarget.style.boxShadow = `0 20px 40px ${color}40, 0 0 30px ${color}30`;
              e.currentTarget.style.borderColor = color;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.borderColor = `${color}30`;
            }}>
              <div style={{
                position: 'absolute',
                top: '-50%',
                right: '-50%',
                width: '150%',
                height: '150%',
                background: `radial-gradient(circle, ${color}20 0%, transparent 70%)`,
                pointerEvents: 'none',
                opacity: 0,
                transition: 'opacity 0.4s ease'
              }} className="hover-glow" />
              <div style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '12px',
                position: 'relative',
                zIndex: 1
              }}>
                <div style={{ 
                  background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`,
                  padding: '10px',
                  borderRadius: '10px',
                  boxShadow: `0 0 20px ${color}60`
                }}>
                  <Icon name={category.icon} fallback="Tag" size={18} style={{ color: '#fff' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#fff', fontSize: '13px', fontWeight: '600', marginBottom: '2px' }}>
                    {category.name}
                  </div>
                  <div style={{ color: '#a3aed0', fontSize: '11px' }}>{category.percentage}% бюджета</div>
                </div>
              </div>
              <div style={{ 
                color: color, 
                fontSize: '18px', 
                fontWeight: '800',
                marginBottom: '12px',
                textShadow: `0 0 20px ${color}60`
              }} className="sm:text-xl md:text-2xl">
                {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(category.amount)}
              </div>
              
              {category.payments && category.payments.length > 0 && (
                <div style={{ 
                  marginBottom: '12px',
                  padding: '8px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                  {category.payments.map((payment, pidx) => (
                    <div key={pidx} style={{ 
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '4px 0',
                      fontSize: '11px',
                      borderBottom: pidx < category.payments.length - 1 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none'
                    }}>
                      <span style={{ color: '#a3aed0', flex: 1, paddingRight: '8px' }}>{payment.service}</span>
                      <span style={{ color: color, fontWeight: '600', whiteSpace: 'nowrap' }}>
                        {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(payment.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              
              <div style={{ 
                width: '100%', 
                height: '8px', 
                background: 'rgba(255, 255, 255, 0.08)', 
                borderRadius: '10px',
                overflow: 'hidden'
              }}>
                <div style={{ 
                  width: `${Math.min(category.percentage, 100)}%`, 
                  height: '100%', 
                  background: `linear-gradient(90deg, ${color} 0%, ${color}aa 100%)`,
                  borderRadius: '10px',
                  boxShadow: `0 0 15px ${color}`,
                  transition: 'width 1s ease'
                }} />
              </div>
            </div>
          );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default Dashboard2BudgetBreakdown;