import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import PaymentsSidebar from '@/components/payments/PaymentsSidebar';
import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';

interface Approval {
  id: number;
  payment_id: number;
  approver_id: number;
  approver_name: string;
  approver_role: string;
  action: string;
  comment: string;
  created_at: string;
  amount?: number;
  description?: string;
}

const ApprovalsHistory = () => {
  const { token } = useAuth();
  const [approvals, setApprovals] = useState<Approval[]>([]);
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
    if (!token) return;

    fetch('https://functions.poehali.dev/8f2170d4-9167-4354-85a1-4478c2403dfd?endpoint=approvals', {
      headers: {
        'X-Auth-Token': token,
      },
    })
      .then(res => res.json())
      .then(data => {
        setApprovals(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load approvals:', err);
        setApprovals([]);
        setLoading(false);
      });
  }, [token]);

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'submitted':
        return <span className="px-2 py-1 rounded-full text-xs bg-blue-500/20 text-blue-300">Отправлен</span>;
      case 'approve':
        return <span className="px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-300">Одобрен</span>;
      case 'reject':
        return <span className="px-2 py-1 rounded-full text-xs bg-red-500/20 text-red-300">Отклонен</span>;
      default:
        return <span className="px-2 py-1 rounded-full text-xs bg-gray-500/20 text-gray-300">{action}</span>;
    }
  };

  const getRoleName = (role: string) => {
    switch (role) {
      case 'tech_director':
        return 'Технический директор';
      case 'ceo':
        return 'CEO';
      case 'creator':
        return 'Создатель';
      default:
        return role;
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

      {menuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <main className="lg:ml-[250px] p-4 md:p-6 lg:p-[30px] min-h-screen flex-1 overflow-x-hidden max-w-full">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 md:mb-[30px] px-4 md:px-[25px] py-4 md:py-[18px] bg-[#1b254b]/50 backdrop-blur-[20px] rounded-[15px] border border-white/10">
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
              placeholder="Поиск по истории..." 
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

        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">История согласований</h1>
          <p className="text-sm md:text-base text-muted-foreground">Все действия по согласованию платежей</p>
        </div>

        <Card className="border-white/5 bg-card shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
          <CardContent className="p-6">
            {loading ? (
              <div className="text-center text-muted-foreground py-8">Загрузка...</div>
            ) : approvals.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                Пока нет истории согласований
              </div>
            ) : (
              <div className="space-y-4">
                {approvals.map((approval) => (
                  <div
                    key={approval.id}
                    className="border border-white/10 rounded-lg p-4 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                            <Icon name="FileCheck" size={20} />
                          </div>
                          <div>
                            <div className="font-semibold">
                              Платеж #{approval.payment_id}
                              {approval.amount && ` — ${approval.amount.toLocaleString('ru-RU')} ₽`}
                            </div>
                            {approval.description && (
                              <div className="text-sm text-muted-foreground line-clamp-1">
                                {approval.description}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <div className="flex items-center gap-2">
                            <Icon name="User" size={14} className="text-muted-foreground" />
                            <span className="text-muted-foreground">{approval.approver_name}</span>
                            <span className="text-muted-foreground/70">({getRoleName(approval.approver_role)})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Icon name="Clock" size={14} className="text-muted-foreground" />
                            <span className="text-muted-foreground">
                              {new Date(approval.created_at).toLocaleDateString('ru-RU', {
                                day: '2-digit',
                                month: 'long',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                        {approval.comment && (
                          <div className="mt-2 p-2 bg-white/5 rounded text-sm">
                            <span className="text-muted-foreground/70">Комментарий: </span>
                            <span>{approval.comment}</span>
                          </div>
                        )}
                      </div>
                      <div>
                        {getActionBadge(approval.action)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ApprovalsHistory;