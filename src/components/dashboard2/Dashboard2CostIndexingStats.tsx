import Icon from '@/components/ui/icon';

interface Dashboard2CostIndexingStatsProps {
  currentIndex: number;
  lastMonth: string;
  totalChange: number;
  avgMonthlyChange: number;
  maxIndex: number;
  minIndex: number;
  categoryColor: string;
}

const Dashboard2CostIndexingStats = ({
  currentIndex,
  lastMonth,
  totalChange,
  avgMonthlyChange,
  maxIndex,
  minIndex,
  categoryColor
}: Dashboard2CostIndexingStatsProps) => {
  const stats = [
    { 
      icon: 'Target', 
      label: 'Текущий индекс', 
      value: currentIndex.toFixed(1), 
      sublabel: lastMonth,
      color: categoryColor,
      bgGradient: `${categoryColor}15`
    },
    { 
      icon: 'TrendingUp', 
      label: 'Общий рост', 
      value: `${totalChange >= 0 ? '+' : ''}${totalChange.toFixed(1)}%`, 
      sublabel: 'За весь период',
      color: totalChange >= 0 ? '#01B574' : '#ff6b6b',
      bgGradient: totalChange >= 0 ? 'rgba(1, 181, 116, 0.15)' : 'rgba(255, 107, 107, 0.15)'
    },
    { 
      icon: 'BarChart2', 
      label: 'Средний рост', 
      value: `${avgMonthlyChange >= 0 ? '+' : ''}${avgMonthlyChange.toFixed(1)}%`, 
      sublabel: 'В месяц',
      color: '#2CD9FF',
      bgGradient: 'rgba(44, 217, 255, 0.15)'
    },
    { 
      icon: 'Activity', 
      label: 'Макс. значение', 
      value: maxIndex.toFixed(1), 
      sublabel: `Мин: ${minIndex.toFixed(1)}`,
      color: '#7551e9',
      bgGradient: 'rgba(117, 81, 233, 0.15)'
    }
  ];

  return (
    <>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr', 
        gap: '12px',
        marginBottom: '16px'
      }} className="sm:grid-cols-2 lg:grid-cols-4 sm:gap-4 sm:mb-6">
        {stats.map((stat, idx) => (
          <div key={idx} style={{ 
            background: `linear-gradient(135deg, ${stat.bgGradient} 0%, ${stat.bgGradient}80 100%)`,
            padding: '12px',
            borderRadius: '10px',
            border: `1px solid ${stat.color}30`,
            transition: 'all 0.3s ease',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = `0 10px 30px ${stat.color}40`;
            e.currentTarget.style.borderColor = stat.color;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.borderColor = `${stat.color}30`;
          }}>
            <div style={{
              position: 'absolute',
              top: '-30px',
              right: '-30px',
              width: '80px',
              height: '80px',
              background: `radial-gradient(circle, ${stat.color}20 0%, transparent 70%)`,
              pointerEvents: 'none'
            }} />
            <Icon name={stat.icon} size={16} style={{ color: stat.color, marginBottom: '8px' }} className="sm:w-5 sm:h-5 sm:mb-2.5" />
            <div style={{ 
              color: stat.color, 
              fontSize: '18px', 
              fontWeight: '900',
              marginBottom: '4px',
              textShadow: `0 0 20px ${stat.color}60`
            }} className="sm:text-xl sm:mb-1.5">
              {stat.value}
            </div>
            <div style={{ color: '#fff', fontSize: '12px', fontWeight: '600', marginBottom: '2px' }} className="sm:text-xs sm:mb-1">
              {stat.label}
            </div>
            <div style={{ color: '#a3aed0', fontSize: '10px', fontWeight: '500' }} className="sm:text-[11px]">
              {stat.sublabel}
            </div>
          </div>
        ))}
      </div>

      <div style={{
        background: 'linear-gradient(135deg, rgba(57, 101, 255, 0.15) 0%, rgba(57, 101, 255, 0.05) 100%)',
        border: '1px solid rgba(57, 101, 255, 0.3)',
        borderRadius: '10px',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }} className="sm:flex-row sm:items-center sm:p-[18px_24px] sm:gap-4">
        <div style={{
          background: 'linear-gradient(135deg, #3965ff 0%, #2948cc 100%)',
          padding: '10px',
          borderRadius: '10px',
          boxShadow: '0 0 20px rgba(57, 101, 255, 0.5)',
          alignSelf: 'flex-start'
        }} className="sm:p-3">
          <Icon name="TrendingUp" size={20} style={{ color: '#fff' }} className="sm:w-6 sm:h-6" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#3965ff', fontSize: '13px', fontWeight: '700', marginBottom: '3px' }} className="sm:text-[15px] sm:mb-1">
            Индекс вырос на {totalChange.toFixed(1)}% за год 📈
          </div>
          <div style={{ color: '#a3aed0', fontSize: '11px', lineHeight: '1.5' }} className="sm:text-xs sm:leading-relaxed">
            Средний темп роста затрат составляет <span style={{ color: '#3965ff', fontWeight: '700' }}>{avgMonthlyChange.toFixed(1)}% в месяц</span>. 
            {avgMonthlyChange > 5 ? ' Рекомендуется анализ причин высокого роста' : ' Темп роста в пределах нормы'}
          </div>
        </div>
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          padding: '8px 16px',
          borderRadius: '8px',
          alignSelf: 'flex-start',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          cursor: 'pointer',
          transition: 'all 0.3s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
          e.currentTarget.style.transform = 'scale(1)';
        }}>
          <span style={{ color: '#fff', fontSize: '11px', fontWeight: '600' }} className="sm:text-xs">
            Анализ →
          </span>
        </div>
      </div>
    </>
  );
};

export default Dashboard2CostIndexingStats;