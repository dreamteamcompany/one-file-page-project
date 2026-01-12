import { Card, CardContent } from '@/components/ui/card';
import { Bar } from 'react-chartjs-2';
import { useState, useEffect } from 'react';
import { apiFetch } from '@/utils/api';

const CategoryExpensesChart = () => {
  const [categoryData, setCategoryData] = useState<{[category: string]: number[]}>({});
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
    const fetchCategoryData = async () => {
      try {
        const response = await apiFetch('https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=payments');
        const data = await response.json();
        
        const approvedPayments = (Array.isArray(data) ? data : []).filter((p: any) => 
          p.status === 'approved' || p.status === 'paid'
        );
        
        const categoryMap: {[category: string]: {[month: number]: number}} = {};
        
        approvedPayments.forEach((payment: any) => {
          const category = payment.category_name || 'Без категории';
          const date = new Date(payment.payment_date);
          const month = date.getMonth();
          
          if (!categoryMap[category]) {
            categoryMap[category] = {};
          }
          if (!categoryMap[category][month]) {
            categoryMap[category][month] = 0;
          }
          categoryMap[category][month] += payment.amount;
        });
        
        const result: {[category: string]: number[]} = {};
        Object.keys(categoryMap).forEach(category => {
          result[category] = Array(12).fill(0).map((_, index) => categoryMap[category][index] || 0);
        });
        
        setCategoryData(result);
      } catch (error) {
        console.error('Failed to fetch category data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchCategoryData();
  }, []);

  const colors = [
    'rgb(117, 81, 233)',
    'rgb(57, 101, 255)',
    'rgb(255, 181, 71)',
    'rgb(1, 181, 116)',
    'rgb(227, 26, 26)',
    'rgb(255, 107, 107)',
    'rgb(78, 205, 196)',
    'rgb(255, 159, 243)'
  ];

  const datasets = Object.keys(categoryData).map((category, index) => ({
    label: category,
    data: categoryData[category],
    backgroundColor: colors[index % colors.length],
    borderRadius: isMobile ? 4 : 8
  }));

  return (
    <Card style={{ background: '#111c44', border: '1px solid rgba(1, 181, 116, 0.4)', boxShadow: '0 0 30px rgba(1, 181, 116, 0.2), inset 0 0 15px rgba(1, 181, 116, 0.05)' }}>
      <CardContent className="p-6">
        <div style={{ marginBottom: '16px' }}>
          <h3 className="text-base sm:text-lg" style={{ fontWeight: '700', color: '#fff' }}>IT Расходы по Категориям</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center" style={{ height: '250px' }}>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
          </div>
        ) : (
        <div className="h-[250px] sm:h-[350px]" style={{ position: 'relative' }}>
          <Bar
            data={{
              labels: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
              datasets: datasets
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              interaction: {
                mode: 'index' as const,
                intersect: false
              },
              elements: {
                bar: {
                  hoverBackgroundColor: undefined
                }
              },
              plugins: {
                legend: {
                  position: 'bottom',
                  display: !isMobile,
                  labels: {
                    padding: isMobile ? 10 : 20,
                    usePointStyle: true,
                    color: '#a3aed0',
                    font: {
                      family: 'Plus Jakarta Sans, sans-serif',
                      size: isMobile ? 10 : 13
                    }
                  }
                },
                tooltip: {
                  enabled: !isMobile,
                  callbacks: {
                    label: function(context) {
                      return `${context.dataset.label}: ${new Intl.NumberFormat('ru-RU').format(context.raw as number)} ₽`;
                    }
                  }
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: {
                    color: '#a3aed0',
                    font: {
                      size: isMobile ? 10 : 12
                    },
                    maxTicksLimit: isMobile ? 5 : 8,
                    callback: function(value) {
                      const numValue = value as number;
                      if (isMobile && numValue >= 1000) {
                        return (numValue / 1000).toFixed(0) + 'k ₽';
                      }
                      return new Intl.NumberFormat('ru-RU').format(numValue) + ' ₽';
                    }
                  },
                  grid: {
                    color: 'rgba(255, 255, 255, 0.05)'
                  }
                },
                x: {
                  ticks: {
                    color: '#a3aed0',
                    font: {
                      size: isMobile ? 9 : 12
                    },
                    maxRotation: isMobile ? 45 : 0,
                    minRotation: isMobile ? 45 : 0
                  },
                  grid: {
                    display: false
                  }
                }
              }
            }}
          />
        </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CategoryExpensesChart;