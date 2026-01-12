import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

const TopPaymentsCard = () => {
  return (
    <Card style={{ 
      background: 'linear-gradient(135deg, #1a1f37 0%, #111c44 100%)', 
      border: '1px solid rgba(117, 81, 233, 0.3)',
      boxShadow: '0 0 30px rgba(117, 81, 233, 0.15), inset 0 0 20px rgba(117, 81, 233, 0.05)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute',
        top: '-50%',
        right: '-50%',
        width: '200%',
        height: '200%',
        background: 'radial-gradient(circle, rgba(117, 81, 233, 0.1) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />
      <CardContent className="p-4 sm:p-6" style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }} className="sm:gap-3 sm:mb-6">
          <div style={{ 
            background: 'linear-gradient(135deg, #7551e9 0%, #5a3ec5 100%)',
            padding: '8px',
            borderRadius: '10px',
            boxShadow: '0 0 20px rgba(117, 81, 233, 0.5)'
          }} className="sm:p-3">
            <Icon name="TrendingUp" size={18} style={{ color: '#fff' }} className="sm:w-6 sm:h-6" />
          </div>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#fff' }} className="sm:text-lg">Топ-5 Платежей</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} className="sm:gap-4">
          {[
            { name: 'AWS Hosting', amount: 45000, percent: 100, color: '#7551e9' },
            { name: 'Google Ads', amount: 38000, percent: 84, color: '#3965ff' },
            { name: 'Зарплата ИТ', amount: 32000, percent: 71, color: '#01b574' },
            { name: 'Софт лицензии', amount: 24000, percent: 53, color: '#ffb547' },
            { name: 'Обучение', amount: 18000, percent: 40, color: '#ff6b6b' }
          ].map((item, idx) => (
            <div key={idx} style={{ 
              background: 'rgba(255, 255, 255, 0.03)',
              padding: '10px',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              transition: 'all 0.3s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.borderColor = item.color;
              e.currentTarget.style.boxShadow = `0 0 20px ${item.color}40`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.boxShadow = 'none';
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }} className="sm:mb-2">
                <span style={{ color: '#fff', fontSize: '12px', fontWeight: '600' }} className="sm:text-sm">{item.name}</span>
                <span style={{ color: item.color, fontSize: '12px', fontWeight: '700' }} className="sm:text-sm">
                  {new Intl.NumberFormat('ru-RU').format(item.amount)} ₽
                </span>
              </div>
              <div style={{ 
                width: '100%', 
                height: '5px', 
                background: 'rgba(255, 255, 255, 0.05)', 
                borderRadius: '10px',
                overflow: 'hidden'
              }}>
                <div style={{ 
                  width: `${item.percent}%`, 
                  height: '100%', 
                  background: `linear-gradient(90deg, ${item.color} 0%, ${item.color}aa 100%)`,
                  borderRadius: '10px',
                  boxShadow: `0 0 10px ${item.color}`,
                  transition: 'width 0.5s ease'
                }} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default TopPaymentsCard;