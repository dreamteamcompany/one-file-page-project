import Icon from '@/components/ui/icon';

interface Dashboard2CostIndexingHeaderProps {
  currentIndex: number;
  totalChange: number;
}

const Dashboard2CostIndexingHeader = ({ currentIndex, totalChange }: Dashboard2CostIndexingHeaderProps) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }} className="sm:flex-row sm:justify-between sm:items-center sm:mb-6">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} className="sm:gap-3">
        <div style={{ 
          background: 'linear-gradient(135deg, #3965ff 0%, #2948cc 100%)',
          padding: '10px',
          borderRadius: '12px',
          boxShadow: '0 0 25px rgba(57, 101, 255, 0.6)',
          animation: 'pulse 3s infinite'
        }} className="sm:p-3.5">
          <Icon name="LineChart" size={20} style={{ color: '#fff' }} className="sm:w-7 sm:h-7" />
        </div>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#fff' }} className="sm:text-xl md:text-2xl">Индексация Затрат</h3>
          <p style={{ fontSize: '11px', color: '#a3aed0', marginTop: '2px' }} className="sm:text-sm sm:mt-1">Динамика индекса за 12 месяцев • Базовый период: январь</p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }} className="sm:gap-3">
        <div style={{ 
          background: 'rgba(57, 101, 255, 0.15)',
          padding: '8px 14px',
          borderRadius: '8px',
          border: '1px solid rgba(57, 101, 255, 0.3)'
        }} className="sm:px-[18px] sm:py-2.5">
          <span style={{ color: '#3965ff', fontSize: '12px', fontWeight: '700' }} className="sm:text-sm">Индекс: {currentIndex.toFixed(1)}</span>
        </div>
        <div style={{ 
          background: totalChange >= 0 ? 'rgba(1, 181, 116, 0.15)' : 'rgba(255, 107, 107, 0.15)',
          padding: '8px 14px',
          borderRadius: '8px',
          border: totalChange >= 0 ? '1px solid rgba(1, 181, 116, 0.3)' : '1px solid rgba(255, 107, 107, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }} className="sm:px-[18px] sm:py-2.5 sm:gap-2">
          <Icon name={totalChange >= 0 ? "TrendingUp" : "TrendingDown"} size={14} style={{ color: totalChange >= 0 ? '#01b574' : '#ff6b6b' }} className="sm:w-4 sm:h-4" />
          <span style={{ color: totalChange >= 0 ? '#01b574' : '#ff6b6b', fontSize: '12px', fontWeight: '700' }} className="sm:text-sm">
            {totalChange >= 0 ? '+' : ''}{totalChange.toFixed(1)}% за год
          </span>
        </div>
      </div>
    </div>
  );
};

export default Dashboard2CostIndexingHeader;