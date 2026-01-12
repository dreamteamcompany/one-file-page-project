import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

const CriticalAlertsCard = () => {
  return (
    <Card style={{ 
      background: 'linear-gradient(135deg, #1a1f37 0%, #111c44 100%)', 
      border: '1px solid rgba(255, 107, 107, 0.3)',
      boxShadow: '0 0 30px rgba(255, 107, 107, 0.15), inset 0 0 20px rgba(255, 107, 107, 0.05)',
      position: 'relative',
      overflow: 'hidden'
    }}>
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
      <CardContent className="p-4 sm:p-6" style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }} className="sm:gap-3 sm:mb-6">
          <div style={{ 
            background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%)',
            padding: '8px',
            borderRadius: '10px',
            boxShadow: '0 0 20px rgba(255, 107, 107, 0.5)',
            animation: 'pulse 2s infinite'
          }} className="sm:p-3">
            <Icon name="AlertTriangle" size={18} style={{ color: '#fff' }} className="sm:w-6 sm:h-6" />
          </div>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#fff' }} className="sm:text-lg">Требуют внимания</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }} className="sm:gap-3.5">
          {[
            { icon: 'Clock3', text: 'Просрочено 4 платежа', color: '#ff6b6b', urgent: true },
            { icon: 'XCircle', text: '2 отклоненных запроса', color: '#ffb547', urgent: false },
            { icon: 'AlertCircle', text: 'Лимит приближается к 80%', color: '#ff6b6b', urgent: true },
            { icon: 'FileWarning', text: '3 документа без подписи', color: '#ffb547', urgent: false }
          ].map((alert, idx) => (
            <div key={idx} style={{ 
              background: alert.urgent ? 'rgba(255, 107, 107, 0.1)' : 'rgba(255, 181, 71, 0.1)',
              padding: '10px',
              borderRadius: '10px',
              border: `1px solid ${alert.urgent ? 'rgba(255, 107, 107, 0.3)' : 'rgba(255, 181, 71, 0.3)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              transition: 'all 0.3s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = alert.urgent ? 'rgba(255, 107, 107, 0.15)' : 'rgba(255, 181, 71, 0.15)';
              e.currentTarget.style.transform = 'translateX(4px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = alert.urgent ? 'rgba(255, 107, 107, 0.1)' : 'rgba(255, 181, 71, 0.1)';
              e.currentTarget.style.transform = 'translateX(0)';
            }}>
              <div style={{ 
                background: alert.urgent ? 'rgba(255, 107, 107, 0.2)' : 'rgba(255, 181, 71, 0.2)',
                padding: '8px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Icon name={alert.icon} size={16} style={{ color: alert.color }} className="sm:w-[18px] sm:h-[18px]" />
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ color: '#fff', fontSize: '12px', fontWeight: '600' }} className="sm:text-sm">{alert.text}</span>
              </div>
              {alert.urgent && (
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#ff6b6b',
                  boxShadow: '0 0 10px #ff6b6b',
                  animation: 'pulse 2s infinite'
                }} />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default CriticalAlertsCard;