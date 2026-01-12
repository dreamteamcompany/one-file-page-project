import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

const LiveMetricsCard = () => {
  return (
    <Card style={{ 
      background: 'linear-gradient(135deg, #1a1f37 0%, #111c44 100%)', 
      border: '1px solid rgba(1, 181, 116, 0.3)',
      boxShadow: '0 0 30px rgba(1, 181, 116, 0.15), inset 0 0 20px rgba(1, 181, 116, 0.05)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute',
        bottom: '-50%',
        left: '-50%',
        width: '200%',
        height: '200%',
        background: 'radial-gradient(circle, rgba(1, 181, 116, 0.1) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />
      <CardContent className="p-4 sm:p-6" style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }} className="sm:gap-3 sm:mb-6">
          <div style={{ 
            background: 'linear-gradient(135deg, #01b574 0%, #018c5a 100%)',
            padding: '8px',
            borderRadius: '10px',
            boxShadow: '0 0 20px rgba(1, 181, 116, 0.5)'
          }} className="sm:p-3">
            <Icon name="Activity" size={18} style={{ color: '#fff' }} className="sm:w-6 sm:h-6" />
          </div>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#fff' }} className="sm:text-lg">Live Метрики</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} className="sm:gap-5">
          <div style={{ 
            background: 'rgba(1, 181, 116, 0.1)',
            padding: '14px',
            borderRadius: '12px',
            border: '1px solid rgba(1, 181, 116, 0.2)',
            textAlign: 'center'
          }}>
            <div style={{ color: '#01b574', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }} className="sm:text-sm sm:mb-2">
              Обработано сегодня
            </div>
            <div style={{ 
              color: '#fff', 
              fontSize: '28px', 
              fontWeight: '800',
              textShadow: '0 0 20px rgba(1, 181, 116, 0.5)'
            }} className="sm:text-4xl">
              127
            </div>
            <div style={{ color: '#a3aed0', fontSize: '11px', marginTop: '4px' }} className="sm:text-xs">
              +18 за последний час
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }} className="sm:gap-3">
            <div style={{ 
              background: 'rgba(255, 181, 71, 0.1)',
              padding: '12px',
              borderRadius: '10px',
              border: '1px solid rgba(255, 181, 71, 0.2)',
              textAlign: 'center'
            }}>
              <Icon name="Clock" size={16} style={{ color: '#ffb547', marginBottom: '6px' }} className="sm:w-5 sm:h-5" />
              <div style={{ color: '#ffb547', fontSize: '18px', fontWeight: '700' }} className="sm:text-2xl">2.4ч</div>
              <div style={{ color: '#a3aed0', fontSize: '10px', marginTop: '2px' }} className="sm:text-xs sm:mt-1">Ср. время</div>
            </div>
            <div style={{ 
              background: 'rgba(117, 81, 233, 0.1)',
              padding: '12px',
              borderRadius: '10px',
              border: '1px solid rgba(117, 81, 233, 0.2)',
              textAlign: 'center'
            }}>
              <Icon name="CheckCircle2" size={16} style={{ color: '#7551e9', marginBottom: '6px' }} className="sm:w-5 sm:h-5" />
              <div style={{ color: '#7551e9', fontSize: '18px', fontWeight: '700' }} className="sm:text-2xl">94%</div>
              <div style={{ color: '#a3aed0', fontSize: '10px', marginTop: '2px' }} className="sm:text-xs sm:mt-1">Согласовано</div>
            </div>
          </div>
          <div style={{ 
            background: 'rgba(255, 255, 255, 0.03)',
            padding: '10px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }} className="sm:mb-2">
              <span style={{ color: '#a3aed0', fontSize: '11px' }} className="sm:text-xs">На согласовании</span>
              <span style={{ color: '#fff', fontSize: '12px', fontWeight: '600' }} className="sm:text-sm">23</span>
            </div>
            <div style={{ 
              width: '100%', 
              height: '6px', 
              background: 'rgba(255, 255, 255, 0.05)', 
              borderRadius: '10px',
              overflow: 'hidden'
            }}>
              <div style={{ 
                width: '64%', 
                height: '100%', 
                background: 'linear-gradient(90deg, #01b574 0%, #01b574aa 100%)',
                borderRadius: '10px',
                boxShadow: '0 0 10px #01b574',
                animation: 'pulse 2s infinite'
              }} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LiveMetricsCard;