import { CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

export interface DashboardCard {
  id: string;
  title: string;
  component: React.ReactNode;
}

export const dashboardCards: DashboardCard[] = [
  {
    id: 'total-expenses',
    title: 'Общие IT Расходы',
    component: (
      <CardContent className="p-6 h-full">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px', color: '#fff' }}>Общие IT Расходы</div>
            <div style={{ color: '#a3aed0', fontSize: '14px', fontWeight: '500' }}>Все время</div>
          </div>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(117, 81, 233, 0.1)', color: '#7551e9', border: '1px solid rgba(117, 81, 233, 0.2)' }}>
            <Icon name="Server" size={20} />
          </div>
        </div>
        <div style={{ fontSize: '32px', fontWeight: '800', marginBottom: '8px', color: '#fff' }}>184,200 ₽</div>
        <div style={{ color: '#a3aed0', fontSize: '14px', fontWeight: '500', marginBottom: '12px' }}>Общая сумма расходов</div>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: '14px', fontWeight: '600', gap: '6px', color: '#e31a1a' }}>
          <Icon name="ArrowUp" size={14} /> +12.5% с прошлого месяца
        </div>
      </CardContent>
    ),
  },
  {
    id: 'total-payments',
    title: 'Индексация',
    component: (
      <CardContent className="p-6 h-full">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px', color: '#fff' }}>Индексация</div>
            <div style={{ color: '#a3aed0', fontSize: '14px', fontWeight: '500' }}>Корректировка цен</div>
          </div>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255, 181, 71, 0.1)', color: '#ffb547', border: '1px solid rgba(255, 181, 71, 0.2)' }}>
            <Icon name="TrendingUp" size={20} />
          </div>
        </div>
        <div style={{ fontSize: '32px', fontWeight: '800', marginBottom: '8px', color: '#fff' }}>45,780 ₽</div>
        <div style={{ color: '#a3aed0', fontSize: '14px', fontWeight: '500', marginBottom: '12px' }}>за текущий период</div>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: '14px', fontWeight: '600', gap: '6px', color: '#01b574' }}>
          <Icon name="ArrowUp" size={14} /> +15.3% к предыдущему периоду
        </div>
      </CardContent>
    ),
  },
  {
    id: 'attention-required',
    title: 'Требуют внимания',
    component: (
      <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '150%',
          height: '150%',
          background: 'radial-gradient(circle, rgba(255, 107, 107, 0.08) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />
        <CardContent className="p-6" style={{ position: 'relative', zIndex: 1, height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{ 
              background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%)',
              padding: '12px',
              borderRadius: '12px',
              boxShadow: '0 0 20px rgba(255, 107, 107, 0.5)',
              animation: 'pulse 2s infinite'
            }}>
              <Icon name="AlertTriangle" size={24} style={{ color: '#fff' }} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#fff' }}>Требуют внимания</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { icon: 'Clock3', text: 'Просрочено 4 платежа', color: '#ff6b6b', urgent: true },
              { icon: 'XCircle', text: '2 отклоненных запроса', color: '#ffb547', urgent: false },
              { icon: 'AlertCircle', text: 'Лимит приближается к 80%', color: '#ff6b6b', urgent: true },
              { icon: 'FileWarning', text: '3 документа без подписи', color: '#ffb547', urgent: false }
            ].map((alert, idx) => (
              <div key={idx} style={{ 
                background: alert.urgent ? 'rgba(255, 107, 107, 0.1)' : 'rgba(255, 181, 71, 0.1)',
                padding: '16px',
                borderRadius: '12px',
                border: `1px solid ${alert.color}40`,
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                transition: 'all 0.3s ease',
                cursor: 'pointer'
              }}>
                <Icon name={alert.icon} size={20} style={{ color: alert.color, flexShrink: 0 }} />
                <span style={{ color: '#fff', fontSize: '14px', fontWeight: '500' }}>{alert.text}</span>
              </div>
            ))}
          </div>
          <div style={{ 
            marginTop: '20px',
            padding: '16px',
            background: 'rgba(117, 81, 233, 0.1)',
            borderRadius: '12px',
            border: '1px solid rgba(117, 81, 233, 0.2)',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}>
            <span style={{ color: '#7551e9', fontSize: '14px', fontWeight: '600' }}>
              Посмотреть все уведомления
            </span>
          </div>
        </CardContent>
      </div>
    ),
  },
];