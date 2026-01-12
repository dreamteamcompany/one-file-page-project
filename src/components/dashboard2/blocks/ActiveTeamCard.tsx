import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

const ActiveTeamCard = () => {
  return (
    <Card style={{ 
      background: 'linear-gradient(135deg, #1a1f37 0%, #111c44 100%)', 
      border: '1px solid rgba(117, 81, 233, 0.3)',
      boxShadow: '0 0 30px rgba(117, 81, 233, 0.15)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute',
        width: '250px',
        height: '250px',
        background: 'radial-gradient(circle, rgba(117, 81, 233, 0.12) 0%, transparent 70%)',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        animation: 'breathe 4s infinite'
      }} />
      <CardContent className="p-4 sm:p-6" style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ 
          background: 'linear-gradient(135deg, #7551e9 0%, #5a3ec5 100%)',
          padding: '8px',
          borderRadius: '10px',
          boxShadow: '0 0 20px rgba(117, 81, 233, 0.5)',
          display: 'inline-flex',
          marginBottom: '14px'
        }} className="sm:p-3 sm:mb-5">
          <Icon name="Users" size={18} style={{ color: '#fff' }} className="sm:w-6 sm:h-6" />
        </div>
        <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#fff', marginBottom: '12px' }} className="sm:text-lg sm:mb-4">
          Активная Команда
        </h3>
        <div style={{ 
          color: '#7551e9', 
          fontSize: '32px', 
          fontWeight: '900',
          textShadow: '0 0 30px rgba(117, 81, 233, 0.6)',
          marginBottom: '8px'
        }} className="sm:text-[42px] sm:mb-3">
          24
        </div>
        <div style={{ color: '#a3aed0', fontSize: '12px', marginBottom: '14px' }} className="sm:text-sm sm:mb-5">
          Сотрудников работают с системой
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} className="sm:gap-2.5">
          <div style={{ 
            display: 'flex',
            justifyContent: 'space-between',
            padding: '8px 10px',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.05)'
          }}>
            <span style={{ color: '#a3aed0', fontSize: '11px' }} className="sm:text-xs">Финансисты</span>
            <span style={{ color: '#7551e9', fontSize: '12px', fontWeight: '700' }} className="sm:text-sm">12</span>
          </div>
          <div style={{ 
            display: 'flex',
            justifyContent: 'space-between',
            padding: '8px 10px',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.05)'
          }}>
            <span style={{ color: '#a3aed0', fontSize: '11px' }} className="sm:text-xs">IT отдел</span>
            <span style={{ color: '#01b574', fontSize: '12px', fontWeight: '700' }} className="sm:text-sm">8</span>
          </div>
          <div style={{ 
            display: 'flex',
            justifyContent: 'space-between',
            padding: '8px 10px',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.05)'
          }}>
            <span style={{ color: '#a3aed0', fontSize: '11px' }} className="sm:text-xs">Менеджеры</span>
            <span style={{ color: '#ffb547', fontSize: '12px', fontWeight: '700' }} className="sm:text-sm">4</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ActiveTeamCard;