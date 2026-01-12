import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { Chart, registerables } from 'chart.js';
import PaymentsSidebar from '@/components/payments/PaymentsSidebar';
import { apiFetch } from '@/utils/api';

Chart.register(...registerables);

interface CategoryStat {
  id: number;
  name: string;
  icon: string;
  payment_count: number;
  total_amount: number;
}

interface DepartmentStat {
  id: number;
  name: string;
  description: string;
  payment_count: number;
  total_amount: number;
}

interface StatsData {
  total_payments: number;
  total_amount: number;
  pending_count: number;
  approved_count: number;
  rejected_count: number;
}

interface Stats {
  stats: StatsData;
  category_stats: CategoryStat[];
  department_stats: DepartmentStat[];
}

const Index = () => {
  const barChartRef = useRef<HTMLCanvasElement>(null);
  const doughnutChartRef = useRef<HTMLCanvasElement>(null);
  const departmentChartRef = useRef<HTMLCanvasElement>(null);
  const [stats, setStats] = useState<Stats>({
    stats: {
      total_payments: 0,
      total_amount: 0,
      pending_count: 0,
      approved_count: 0,
      rejected_count: 0
    },
    category_stats: [],
    department_stats: []
  });
  const [loading, setLoading] = useState(true);
  const [dictionariesOpen, setDictionariesOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

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

  useEffect(() => {
    apiFetch('https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=stats')
      .then(res => res.json())
      .then(data => {
        setStats({
          stats: data?.stats || {
            total_payments: 0,
            total_amount: 0,
            pending_count: 0,
            approved_count: 0,
            rejected_count: 0
          },
          category_stats: Array.isArray(data?.category_stats) ? data.category_stats : [],
          department_stats: Array.isArray(data?.department_stats) ? data.department_stats : []
        });
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load stats:', err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!barChartRef.current || !doughnutChartRef.current || !departmentChartRef.current || loading) return;
    if (stats.category_stats.length === 0 && stats.department_stats.length === 0) return;

    const barCtx = barChartRef.current.getContext('2d');
    const doughnutCtx = doughnutChartRef.current.getContext('2d');
    const departmentCtx = departmentChartRef.current.getContext('2d');

    if (!barCtx || !doughnutCtx || !departmentCtx) return;

    const categoryData = stats.category_stats.map(c => c.total_amount);
    const categoryLabels = stats.category_stats.map(c => c.name);

    const barChart = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: categoryLabels,
        datasets: [{
          label: 'Расходы',
          data: categoryData,
          backgroundColor: [
            'rgba(117, 81, 233, 0.8)',
            'rgba(57, 101, 255, 0.8)',
            'rgba(255, 181, 71, 0.8)',
            'rgba(1, 181, 116, 0.8)'
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: '#fff'
            }
          }
        },
        scales: {
          x: {
            ticks: { color: '#a3aed0' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
          },
          y: {
            ticks: { color: '#a3aed0' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
          }
        }
      }
    });

    const doughnutChart = new Chart(doughnutCtx, {
      type: 'doughnut',
      data: {
        labels: categoryLabels,
        datasets: [{
          data: categoryData,
          backgroundColor: [
            'rgba(117, 81, 233, 0.8)',
            'rgba(57, 101, 255, 0.8)',
            'rgba(255, 181, 71, 0.8)',
            'rgba(1, 181, 116, 0.8)'
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: '#fff'
            }
          }
        }
      }
    });

    const departmentData = stats.department_stats.map(d => d.total_amount);
    const departmentLabels = stats.department_stats.map(d => d.name);

    const departmentChart = new Chart(departmentCtx, {
      type: 'bar',
      data: {
        labels: departmentLabels,
        datasets: [{
          label: 'Расходы по отделам',
          data: departmentData,
          backgroundColor: [
            'rgba(117, 81, 233, 0.8)',
            'rgba(57, 101, 255, 0.8)',
            'rgba(255, 181, 71, 0.8)',
            'rgba(1, 181, 116, 0.8)',
            'rgba(255, 99, 132, 0.8)',
            'rgba(54, 162, 235, 0.8)',
            'rgba(153, 102, 255, 0.8)',
            'rgba(255, 159, 64, 0.8)'
          ]
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: '#fff'
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return context.parsed.x.toLocaleString('ru-RU') + ' ₽';
              }
            }
          },
          datalabels: {
            anchor: 'end',
            align: 'end',
            color: '#fff',
            font: {
              weight: 'bold',
              size: 12
            },
            formatter: (value: number) => value.toLocaleString('ru-RU') + ' ₽'
          }
        },
        scales: {
          x: {
            ticks: { 
              color: '#a3aed0',
              callback: function(value) {
                return Number(value).toLocaleString('ru-RU') + ' ₽';
              }
            },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
          },
          y: {
            ticks: { color: '#a3aed0' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
          }
        }
      }
    });

    return () => {
      barChart.destroy();
      doughnutChart.destroy();
      departmentChart.destroy();
    };
  }, [stats, loading]);

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
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 md:mb-[30px] px-4 md:px-[25px] py-4 md:py-[18px] bg-card backdrop-blur-[20px] rounded-[15px] border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="lg:hidden p-2 text-white"
          >
            <Icon name="Menu" size={24} />
          </button>
          <div className="flex items-center gap-3 bg-card border border-white/10 rounded-[15px] px-4 md:px-5 py-2 md:py-[10px] w-full sm:w-[300px] lg:w-[400px]">
            <Icon name="Search" size={20} className="text-muted-foreground" />
            <Input 
              type="text" 
              placeholder="Поиск сервисов..." 
              className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto"
            />
          </div>
          <div className="flex items-center gap-2 md:gap-3 px-3 md:px-[15px] py-2 md:py-[10px] rounded-[12px] bg-white/5 border border-white/10">
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-[10px] bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-white text-sm md:text-base">
              А
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-medium">Администратор</div>
              <div className="text-xs text-muted-foreground">Администратор</div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 mb-6 md:mb-[30px]">
          <Card className="border-white/5 bg-card shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-5">
                <div>
                  <h3 className="text-base font-bold mb-[5px]">Общие IT Расходы</h3>
                  <p className="text-sm text-muted-foreground">Все время</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary text-xl">
                  <Icon name="Server" size={20} />
                </div>
              </div>
              <div className="text-[32px] font-extrabold mb-2">{stats.stats.total_amount.toLocaleString('ru-RU')} ₽</div>
              <p className="text-sm text-muted-foreground">{stats.stats.total_payments > 0 ? `${stats.stats.total_payments} платежей` : 'Начните добавлять платежи'}</p>
            </CardContent>
          </Card>

          <Card className="border-white/5 bg-card shadow-[0_4px_20px_rgba(0,0,0,0.25)] rounded-[20px]">
            <CardContent className="p-[25px]">
              <div className="flex justify-between items-start mb-5">
                <div>
                  <h3 className="text-base font-bold mb-[5px]">Всего Платежей</h3>
                  <p className="text-sm text-muted-foreground">История операций</p>
                </div>
                <div className="w-[45px] h-[45px] rounded-[12px] bg-primary/10 flex items-center justify-center text-primary text-xl">
                  <Icon name="Box" size={20} />
                </div>
              </div>
              <div className="text-[34px] font-extrabold mb-[5px] leading-[42px]">{stats.stats.total_payments}</div>
              <p className="text-sm text-muted-foreground">платежей за все время</p>
            </CardContent>
          </Card>

          <Card className="border-white/5 bg-card shadow-[0_4px_20px_rgba(0,0,0,0.25)] rounded-[20px]">
            <CardContent className="p-[25px]">
              <div className="flex justify-between items-start mb-5">
                <div>
                  <h3 className="text-base font-bold mb-[5px]">Категории</h3>
                  <p className="text-sm text-muted-foreground">Всего</p>
                </div>
                <div className="w-[45px] h-[45px] rounded-[12px] bg-primary/10 flex items-center justify-center text-primary text-xl">
                  <Icon name="Tag" size={20} />
                </div>
              </div>
              <div className="text-[34px] font-extrabold mb-[5px] leading-[42px]">{stats.category_stats.length}</div>
              <p className="text-sm text-muted-foreground">категорий расходов</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 mb-6 md:mb-[30px]">
          {stats.category_stats.map((category) => (
            <Card key={category.id} className="border-white/5 bg-card rounded-[20px]">
              <CardContent className="p-[20px] flex items-center gap-[15px]">
                <div className="w-[56px] h-[56px] rounded-[15px] bg-primary/10 flex items-center justify-center text-2xl flex-shrink-0">
                  {category.icon}
                </div>
                <div>
                  <div className="text-2xl font-bold mb-[2px] leading-[32px]">{category.total_amount.toLocaleString('ru-RU')} ₽</div>
                  <p className="text-sm text-muted-foreground">{category.name}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5 mb-6 md:mb-[30px]">
          <Card className="border-white/5 bg-card shadow-[0_4px_20px_rgba(0,0,0,0.25)] rounded-[20px]">
            <CardContent className="p-[25px]">
              <h3 className="text-lg font-bold mb-5">Расходы по категориям</h3>
              <div className="h-[300px]">
                <canvas ref={barChartRef}></canvas>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/5 bg-card shadow-[0_4px_20px_rgba(0,0,0,0.25)] rounded-[20px]">
            <CardContent className="p-[25px]">
              <h3 className="text-lg font-bold mb-5">Распределение бюджета</h3>
              <div className="h-[300px]">
                <canvas ref={doughnutChartRef}></canvas>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/5 bg-card shadow-[0_4px_20px_rgba(0,0,0,0.25)] rounded-[20px]">
            <CardContent className="p-[25px]">
              <h3 className="text-lg font-bold mb-5">Расходы по отделам-заказчикам</h3>
              <div className="h-[300px]">
                <canvas ref={departmentChartRef}></canvas>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4">Сервисы</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="border-white/5 bg-card hover:bg-card/80 transition-colors cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                    <Icon name="Database" size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold mb-2">База данных</h3>
                    <p className="text-sm text-muted-foreground">Управление базами данных и миграциями</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/5 bg-card hover:bg-card/80 transition-colors cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 flex-shrink-0">
                    <Icon name="Cloud" size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold mb-2">Облачное хранилище</h3>
                    <p className="text-sm text-muted-foreground">Хранение и управление файлами</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/5 bg-card hover:bg-card/80 transition-colors cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500 flex-shrink-0">
                    <Icon name="Mail" size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold mb-2">Email рассылка</h3>
                    <p className="text-sm text-muted-foreground">Настройка уведомлений и рассылок</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/5 bg-card hover:bg-card/80 transition-colors cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-500 flex-shrink-0">
                    <Icon name="BarChart" size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold mb-2">Аналитика</h3>
                    <p className="text-sm text-muted-foreground">Статистика и отчеты по расходам</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/5 bg-card hover:bg-card/80 transition-colors cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500 flex-shrink-0">
                    <Icon name="Shield" size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold mb-2">Безопасность</h3>
                    <p className="text-sm text-muted-foreground">Настройка прав доступа</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/5 bg-card hover:bg-card/80 transition-colors cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 flex-shrink-0">
                    <Icon name="Zap" size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold mb-2">API интеграции</h3>
                    <p className="text-sm text-muted-foreground">Подключение внешних сервисов</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;