import { Card, CardContent } from '@/components/ui/card';
import { Radar } from 'react-chartjs-2';
import { useState, useEffect } from 'react';
import { apiFetch } from '@/utils/api';

const Dashboard2TeamPerformance = () => {
  const [currentData, setCurrentData] = useState<{name: string, amount: number}[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const fetchDepartmentData = async () => {
      try {
        const response = await apiFetch('https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=payments');
        const data = await response.json();
        
        const approvedPayments = (Array.isArray(data) ? data : []).filter((p: any) => 
          p.status === 'approved' || p.status === 'paid'
        );
        
        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        
        const currentMonthPayments = approvedPayments.filter((p: any) => {
          const paymentDate = new Date(p.payment_date);
          return paymentDate >= currentMonthStart;
        });
        
        const previousMonthPayments = approvedPayments.filter((p: any) => {
          const paymentDate = new Date(p.payment_date);
          return paymentDate >= previousMonthStart && paymentDate <= previousMonthEnd;
        });
        
        const aggregateByDepartment = (payments: any[]) => {
          const deptMap: {[key: string]: number} = {};
          payments.forEach((payment: any) => {
            const dept = payment.department_name || 'Без отдела';
            if (!deptMap[dept]) {
              deptMap[dept] = 0;
            }
            deptMap[dept] += payment.amount;
          });
          return Object.entries(deptMap)
            .map(([name, amount]) => ({ name, amount }))
            .sort((a, b) => b.amount - a.amount);
        };
        
        setCurrentData(aggregateByDepartment(currentMonthPayments));
      } catch (error) {
        console.error('Failed to fetch department data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDepartmentData();
  }, []);

  const activeData = currentData;

  return (
    <Card style={{ background: '#111c44', border: '1px solid rgba(1, 181, 116, 0.4)', boxShadow: '0 0 30px rgba(1, 181, 116, 0.2), inset 0 0 15px rgba(1, 181, 116, 0.05)', maxWidth: '550px' }}>
      <CardContent className="p-6">
        <div style={{ marginBottom: '16px' }}>
          <h3 className="text-base sm:text-lg" style={{ fontWeight: '700', color: '#fff' }}>Сравнение по Отделам-Заказчикам</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center" style={{ height: '250px' }}>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
          </div>
        ) : activeData.length === 0 ? (
          <div className="flex items-center justify-center" style={{ height: '250px' }}>
            <p style={{ color: '#a3aed0' }}>Нет данных за выбранный период</p>
          </div>
        ) : (
        <>
        <div className="h-[240px] sm:h-[320px]" style={{ position: 'relative', padding: isMobile ? '10px' : '20px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Radar
            data={{
              labels: activeData.map(d => d.name),
              datasets: [{
                label: 'Расходы по отделам',
                data: activeData.map(d => d.amount),
                backgroundColor: 'rgba(1, 181, 116, 0.15)',
                borderColor: 'rgb(1, 181, 116)',
                borderWidth: 3,
                pointBackgroundColor: 'rgb(1, 181, 116)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgb(1, 181, 116)',
                pointHoverBorderWidth: 3,
                pointStyle: 'circle'
              }]
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  display: false
                },
                tooltip: {
                  enabled: true,
                  backgroundColor: 'rgba(17, 28, 68, 0.95)',
                  titleColor: '#fff',
                  bodyColor: '#01b574',
                  borderColor: 'rgba(1, 181, 116, 0.5)',
                  borderWidth: 1,
                  padding: 12,
                  displayColors: false,
                  titleFont: {
                    size: 13,
                    weight: 'bold'
                  },
                  bodyFont: {
                    size: 14,
                    weight: 'bold'
                  },
                  callbacks: {
                    label: function(context) {
                      return `${new Intl.NumberFormat('ru-RU').format(context.raw as number)} ₽`;
                    }
                  }
                }
              },
              scales: {
                r: {
                  beginAtZero: true,
                  min: 0,
                  ticks: {
                    display: false
                  },
                  grid: {
                    color: 'rgba(1, 181, 116, 0.15)',
                    lineWidth: 1
                  },
                  angleLines: {
                    color: 'rgba(1, 181, 116, 0.2)',
                    lineWidth: 2
                  },
                  pointLabels: {
                    padding: isMobile ? 10 : 15,
                    font: {
                      size: isMobile ? 11 : 14,
                      weight: '700'
                    },
                    callback: function(label: string, index: number) {
                      const dept = activeData[index];
                      const formatted = new Intl.NumberFormat('ru-RU').format(dept.amount);
                      return [`${label}`, `${formatted} ₽`];
                    },
                    color: '#fff'
                  }
                }
              }
            }}
          />
        </div>
        
        <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(1, 181, 116, 0.08)', borderRadius: '12px', border: '1px solid rgba(1, 181, 116, 0.2)' }}>
          <h4 style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: '800', color: '#fff', marginBottom: '12px' }}>Топ-3 Отделов по Затратам</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {activeData.slice(0, 3).map((dept, index) => (
              <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid rgba(1, 181, 116, 0.15)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '700', color: '#01b574', minWidth: '24px' }}>{index + 1}</span>
                  <span style={{ fontSize: isMobile ? '12px' : '13px', color: '#fff', fontWeight: '600' }}>{dept.name}</span>
                </div>
                <span style={{ fontSize: isMobile ? '14px' : '16px', color: '#01b574', fontWeight: '800', textShadow: '0 0 10px rgba(1, 181, 116, 0.5)' }}>{new Intl.NumberFormat('ru-RU').format(dept.amount)} ₽</span>
              </div>
            ))}
          </div>
        </div>
        </>
        )}
      </CardContent>
    </Card>
  );
};

export default Dashboard2TeamPerformance;