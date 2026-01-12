import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

const AnnualSavingsKPICard = () => {
  return (
    <Card style={{ 
      background: 'linear-gradient(135deg, #1a1f37 0%, #111c44 100%)', 
      border: '1px solid rgba(1, 181, 116, 0.3)',
      boxShadow: '0 0 30px rgba(1, 181, 116, 0.15)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute',
        width: '300px',
        height: '300px',
        background: 'radial-gradient(circle, rgba(1, 181, 116, 0.2) 0%, transparent 70%)',
        top: '-150px',
        left: '-150px',
        animation: 'rotate 20s linear infinite'
      }} />
      <CardContent className="p-4 sm:p-6" style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ 
          background: 'linear-gradient(135deg, #01b574 0%, #018c5a 100%)',
          padding: '8px',
          borderRadius: '10px',
          boxShadow: '0 0 20px rgba(1, 181, 116, 0.5)',
          display: 'inline-flex',
          marginBottom: '14px'
        }} className="sm:p-3 sm:mb-5">
          <Icon name="PiggyBank" size={18} style={{ color: '#fff' }} className="sm:w-6 sm:h-6" />
        </div>
        <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#fff', marginBottom: '12px' }} className="sm:text-lg sm:mb-4">
          Годовая Экономия
        </h3>
        <div style={{ 
          color: '#01b574', 
          fontSize: '32px', 
          fontWeight: '900',
          textShadow: '0 0 30px rgba(1, 181, 116, 0.6)',
          marginBottom: '8px'
        }} className="sm:text-[42px] sm:mb-3">
          ₽480K
        </div>
        <div style={{ color: '#a3aed0', fontSize: '12px', marginBottom: '14px' }} className="sm:text-sm sm:mb-5">
          За счет оптимизации подписок
        </div>
        <div style={{ 
          background: 'rgba(1, 181, 116, 0.1)',
          padding: '10px',
          borderRadius: '8px',
          border: '1px solid rgba(1, 181, 116, 0.2)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }} className="sm:mb-2">
            <span style={{ color: '#a3aed0', fontSize: '11px' }} className="sm:text-xs">Прогресс цели</span>
            <span style={{ color: '#01b574', fontSize: '11px', fontWeight: '700' }} className="sm:text-xs">73%</span>
          </div>
          <div style={{ 
            width: '100%', 
            height: '6px', 
            background: 'rgba(255, 255, 255, 0.05)', 
            borderRadius: '10px',
            overflow: 'hidden'
          }}>
            <div style={{ 
              width: '73%', 
              height: '100%', 
              background: 'linear-gradient(90deg, #01b574 0%, #01b574aa 100%)',
              borderRadius: '10px',
              boxShadow: '0 0 15px #01b574',
              animation: 'progress 2s ease-out'
            }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AnnualSavingsKPICard;