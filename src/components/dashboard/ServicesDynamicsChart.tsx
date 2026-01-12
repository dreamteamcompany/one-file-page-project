import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

interface Service {
  name: string;
  amount: number;
  trend: number;
}

interface ServicesDynamicsChartProps {
  servicesData: Service[];
}

const ServicesDynamicsChart = ({ servicesData }: ServicesDynamicsChartProps) => {
  const sortedData = [...servicesData].sort((a, b) => b.amount - a.amount);
  
  const formatAmount = (amount: number) => {
    return amount.toLocaleString('ru-RU') + ' ₽';
  };
  
  const dynamicHeight = Math.max(300, sortedData.length * 45 + 90);
  
  return (
    <Card className="relative" style={{
      background: '#111c44',
      backdropFilter: 'blur(60px)',
      border: 'none',
      boxShadow: '0px 3.5px 5.5px rgba(0, 0, 0, 0.02)',
      width: '100%',
      maxWidth: '650px',
      height: `${dynamicHeight}px`,
      overflow: 'hidden',
    }}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2" style={{ color: '#fff', fontSize: '16px', fontWeight: 'bold' }}>
          <Icon name="Activity" size={18} style={{ color: '#2CD9FF' }} />
          Динамика расходов по сервисам
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0" style={{ overflow: 'auto' }}>
        <div className="relative" style={{ width: '100%', minHeight: `${sortedData.length * 45 + 30}px` }}>
          <svg viewBox={`0 0 650 ${sortedData.length * 45 + 30}`} style={{ width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid meet">
            {(() => {
              const maxAmount = Math.max(...sortedData.map(s => s.amount));
              const barHeight = 32;
              const spacing = 45;
              const maxWidth = 420;
              const startX = 160;
              const barColors = ['#0075FF', '#2CD9FF', '#01B574', '#7B61FF', '#FF6B6B'];
              
              const gridLines = [0, 0.25, 0.5, 0.75, 1].map(ratio => ({
                x: startX + ratio * maxWidth,
                value: formatAmount(Math.round(ratio * maxAmount))
              }));
              
              const points = sortedData.map((service, index) => {
                const y = 25 + index * spacing;
                const barWidth = (service.amount / maxAmount) * maxWidth;
                const x = startX + barWidth;
                return { x, y: y + barHeight / 2 };
              });
              
              const linePath = points.map((p, i) => 
                `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
              ).join(' ');
              
              return (
                <>
                  <defs>
                    <linearGradient id="visionLineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#2CD9FF" />
                      <stop offset="100%" stopColor="#0075FF" />
                    </linearGradient>
                    {sortedData.map((_, index) => {
                      const color = barColors[index % barColors.length];
                      return (
                        <linearGradient key={`gradient-${index}`} id={`visionBar-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                          <stop offset="100%" stopColor={color} stopOpacity="1" />
                        </linearGradient>
                      );
                    })}
                  </defs>
                  
                  {gridLines.map((line, idx) => (
                    <g key={`grid-${idx}`}>
                      <line
                        x1={line.x}
                        y1="15"
                        x2={line.x}
                        y2={sortedData.length * spacing + 15}
                        stroke="#56577A"
                        strokeWidth="1"
                        strokeDasharray="5 5"
                      />
                      <text
                        x={line.x}
                        y="12"
                        textAnchor="middle"
                        fill="#c8cfca"
                        style={{ fontSize: '11px', fontWeight: '500' }}
                      >
                        {line.value}
                      </text>
                    </g>
                  ))}
                  
                  {sortedData.map((service, index) => {
                    const y = 25 + index * spacing;
                    const barWidth = (service.amount / maxAmount) * maxWidth;
                    
                    return (
                      <g key={`bar-${service.name}-${index}`}>
                        <rect
                          x={startX}
                          y={y}
                          width={barWidth}
                          height={barHeight}
                          fill={`url(#visionBar-${index})`}
                          rx="8"
                        />
                        <text
                          x="15"
                          y={y + barHeight / 2 + 4}
                          textAnchor="start"
                          fill="#c8cfca"
                          style={{ fontSize: '14px' }}
                        >
                          {service.name}
                        </text>
                        <text
                          x={startX + barWidth + 10}
                          y={y + barHeight / 2 + 4}
                          textAnchor="start"
                          fill="#fff"
                          style={{ fontSize: '14px', fontWeight: '600' }}
                        >
                          {formatAmount(service.amount)}
                        </text>
                        {service.trend !== 0 && (
                          <g>
                            <rect
                              x={startX + barWidth + 95}
                              y={y + barHeight / 2 - 9}
                              width="45"
                              height="18"
                              rx="3"
                              fill={service.trend > 0 ? '#01B574' : '#E31A1A'}
                              opacity="0.9"
                            />
                            <text
                              x={startX + barWidth + 117}
                              y={y + barHeight / 2 + 4}
                              textAnchor="middle"
                              fill="#fff"
                              style={{ fontSize: '12px', fontWeight: 'bold' }}
                            >
                              {service.trend > 0 ? '+' : ''}{service.trend}%
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                  
                  <path
                    d={linePath}
                    stroke="url(#visionLineGradient)"
                    strokeWidth="2.5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  
                  {points.map((point, index) => (
                    <g key={`point-${index}`}>
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r="6"
                        fill="#2CD9FF"
                        opacity="0.3"
                      />
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r="4"
                        fill="#fff"
                      />
                    </g>
                  ))}
                </>
              );
            })()}
          </svg>
        </div>
      </CardContent>
    </Card>
  );
};

export default ServicesDynamicsChart;