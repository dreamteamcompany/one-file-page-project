import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

interface Category {
  name: string;
  amount: number;
  icon: string;
  percentage: number;
}

interface ExpensesByCategoryChartProps {
  categoriesData: Category[];
  totalAmount: number;
}

const ExpensesByCategoryChart = ({ categoriesData, totalAmount }: ExpensesByCategoryChartProps) => {
  const colors = [
    { start: '#7B61FF', end: '#5B41DF' },
    { start: '#2CD9FF', end: '#0075FF' },
    { start: '#FFB800', end: '#FF8C00' },
    { start: '#01B574', end: '#00875A' },
    { start: '#FF6B6B', end: '#E31A1A' },
  ];

  const getArcPath = (startAngle: number, endAngle: number, radius: number) => {
    const start = (startAngle - 90) * (Math.PI / 180);
    const end = (endAngle - 90) * (Math.PI / 180);
    
    const x1 = 200 + radius * Math.cos(start);
    const y1 = 200 + radius * Math.sin(start);
    const x2 = 200 + radius * Math.cos(end);
    const y2 = 200 + radius * Math.sin(end);
    
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    
    const innerRadius = radius - 50;
    const ix1 = 200 + innerRadius * Math.cos(start);
    const iy1 = 200 + innerRadius * Math.sin(start);
    const ix2 = 200 + innerRadius * Math.cos(end);
    const iy2 = 200 + innerRadius * Math.sin(end);
    
    return `
      M ${x1} ${y1}
      A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}
      L ${ix2} ${iy2}
      A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1}
      Z
    `;
  };

  return (
    <Card className="relative" style={{
      background: '#111c44',
      backdropFilter: 'blur(60px)',
      border: 'none',
      boxShadow: '0px 3.5px 5.5px rgba(0, 0, 0, 0.02)',
      width: '100%',
      maxWidth: '650px',
      height: '380px',
      overflow: 'hidden',
    }}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2" style={{ color: '#fff', fontSize: '16px', fontWeight: 'bold' }}>
          <Icon name="PieChart" size={18} style={{ color: '#2CD9FF' }} />
          Расходы по категориям
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <div className="flex items-center justify-between gap-6">
          <div className="relative flex-shrink-0" style={{ width: '240px', height: '240px' }}>
            <svg viewBox="0 0 400 400" style={{ width: '100%', height: '100%' }}>
              <defs>
                {categoriesData.map((_, index) => (
                  <linearGradient key={`grad-${index}`} id={`categoryGrad-${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={colors[index % colors.length].start} />
                    <stop offset="100%" stopColor={colors[index % colors.length].end} />
                  </linearGradient>
                ))}
                <filter id="pieGlow">
                  <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>

              {(() => {
                let currentAngle = 0;
                return categoriesData.map((cat, index) => {
                  const angle = (cat.percentage / 100) * 360;
                  const path = getArcPath(currentAngle, currentAngle + angle, 160);
                  currentAngle += angle;
                  
                  return (
                    <path
                      key={cat.name}
                      d={path}
                      fill={`url(#categoryGrad-${index})`}
                      filter="url(#pieGlow)"
                      opacity="0.95"
                      style={{ 
                        transition: 'all 0.3s ease',
                        cursor: 'pointer'
                      }}
                    />
                  );
                });
              })()}

              <circle cx="200" cy="200" r="105" fill="#0f1729" />
              <circle cx="200" cy="200" r="105" fill="none" stroke="#2C3E5D" strokeWidth="2" opacity="0.5" />
              
              <text
                x="200"
                y="185"
                textAnchor="middle"
                fill="#c8cfca"
                style={{ fontSize: '14px' }}
              >
                Всего
              </text>
              <text
                x="200"
                y="215"
                textAnchor="middle"
                fill="#fff"
                style={{ fontSize: '28px', fontWeight: 'bold' }}
              >
                {(totalAmount / 1000000).toFixed(1)}M
              </text>
            </svg>
          </div>
          
          <div className="flex-1 space-y-2 max-h-[280px] overflow-y-auto pr-2" style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#2C3E5D #111c44'
          }}>
            {categoriesData.map((cat, index) => (
              <div key={cat.name} className="flex items-center justify-between p-2 rounded" style={{
                background: 'rgba(44, 62, 93, 0.2)',
                transition: 'all 0.2s ease'
              }}>
                <div className="flex items-center gap-3 flex-1">
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0" 
                    style={{ 
                      background: `linear-gradient(135deg, ${colors[index % colors.length].start}, ${colors[index % colors.length].end})`,
                      boxShadow: `0 0 8px ${colors[index % colors.length].start}40`
                    }} 
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: '14px' }}>{cat.icon}</span>
                      <span style={{ fontSize: '13px', color: '#fff', fontWeight: '500' }} className="truncate">
                        {cat.name}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <p style={{ fontSize: '13px', color: '#fff', fontWeight: '600' }}>
                    {(cat.amount / 1000).toFixed(0)}k
                  </p>
                  <p style={{ fontSize: '11px', color: '#2CD9FF' }}>
                    {cat.percentage}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ExpensesByCategoryChart;