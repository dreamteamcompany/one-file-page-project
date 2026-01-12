import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

const AverageSpeedCard = () => {
  return (
    <Card style={{ 
      background: 'linear-gradient(135deg, #1a1f37 0%, #111c44 100%)', 
      border: '1px solid rgba(168, 85, 247, 0.3)',
      boxShadow: '0 0 30px rgba(168, 85, 247, 0.15)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute',
        width: '200px',
        height: '200px',
        background: 'radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 70%)',
        bottom: '-100px',
        right: '-100px',
        animation: 'pulse 3s infinite'
      }} />
      <CardContent className="p-4 sm:p-6" style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ 
          background: 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)',
          padding: '8px',
          borderRadius: '10px',
          boxShadow: '0 0 20px rgba(168, 85, 247, 0.5)',
          display: 'inline-flex',
          marginBottom: '14px'
        }} className="sm:p-3 sm:mb-5">
          <Icon name="Zap" size={18} style={{ color: '#fff' }} className="sm:w-6 sm:h-6" />
        </div>
        <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#fff', marginBottom: '12px' }} className="sm:text-lg sm:mb-4">
          Средняя Скорость
        </h3>
        <div style={{ 
          color: '#a855f7', 
          fontSize: '32px', 
          fontWeight: '900',
          textShadow: '0 0 30px rgba(168, 85, 247, 0.6)',
          marginBottom: '8px'
        }} className="sm:text-[42px] sm:mb-3">
          1.8ч
        </div>
        <div style={{ color: '#a3aed0', fontSize: '12px', marginBottom: '14px' }} className="sm:text-sm sm:mb-5">
          Обработка платежного запроса
        </div>
        <div style={{ display: 'flex', gap: '6px' }} className="sm:gap-2">
          <div style={{ 
            flex: 1,
            background: 'rgba(1, 181, 116, 0.15)',
            padding: '8px',
            borderRadius: '6px',
            border: '1px solid rgba(1, 181, 116, 0.3)',
            textAlign: 'center'
          }}>
            <div style={{ color: '#01b574', fontSize: '16px', fontWeight: '700' }} className="sm:text-xl">-24%</div>
            <div style={{ color: '#a3aed0', fontSize: '9px', marginTop: '3px' }} className="sm:text-[11px] sm:mt-1">vs месяц назад</div>
          </div>
          <div style={{ 
            flex: 1,
            background: 'rgba(117, 81, 233, 0.15)',
            padding: '8px',
            borderRadius: '6px',
            border: '1px solid rgba(117, 81, 233, 0.3)',
            textAlign: 'center'
          }}>
            <div style={{ color: '#7551e9', fontSize: '16px', fontWeight: '700' }} className="sm:text-xl">94%</div>
            <div style={{ color: '#a3aed0', fontSize: '9px', marginTop: '3px' }} className="sm:text-[11px] sm:mt-1">Автоматизация</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AverageSpeedCard;