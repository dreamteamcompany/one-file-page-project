import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

const AttentionRequiredCard = () => {
  return (
    <Card style={{ 
      background: 'linear-gradient(135deg, #1a1f37 0%, #111c44 100%)', 
      border: '1px solid rgba(255, 107, 107, 0.3)',
      boxShadow: '0 0 30px rgba(255, 107, 107, 0.15)',
      position: 'relative',
      overflow: 'hidden',
      height: '300px'
    }}>
      <CardContent className="p-4 sm:p-6" style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }} className="sm:mb-5">
          <div>
            <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '6px', color: '#fff' }} className="sm:text-lg sm:mb-2">Требуют внимания</div>
            <div style={{ color: '#a3aed0', fontSize: '12px', fontWeight: '500' }} className="sm:text-sm">Критические задачи</div>
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255, 107, 107, 0.1)', color: '#ff6b6b', border: '1px solid rgba(255, 107, 107, 0.2)' }} className="sm:w-12 sm:h-12">
            <Icon name="AlertTriangle" size={18} className="sm:w-5 sm:h-5" />
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }} className="sm:gap-3">
          {[
            { icon: 'Clock3', text: 'Просрочено 4 платежа', color: '#ff6b6b' },
            { icon: 'XCircle', text: '2 отклоненных запроса', color: '#ffb547' }
          ].map((alert, idx) => (
            <div key={idx} style={{ 
              background: 'rgba(255, 107, 107, 0.05)',
              padding: '10px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 107, 107, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }} className="sm:p-3 sm:gap-3">
              <Icon name={alert.icon} size={14} style={{ color: alert.color, flexShrink: 0 }} className="sm:w-4 sm:h-4" />
              <span style={{ color: '#fff', fontSize: '12px', fontWeight: '500' }} className="sm:text-sm">{alert.text}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default AttentionRequiredCard;