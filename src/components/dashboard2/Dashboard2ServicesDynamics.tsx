import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { useState } from 'react';

interface Service {
  name: string;
  amount: number;
  trend: number;
}

const Dashboard2ServicesDynamics = () => {
  const [hoveredService, setHoveredService] = useState<number | null>(null);

  const servicesData: Service[] = [
    { name: 'Облачные сервисы', amount: 150000, trend: 12 },
    { name: 'CRM-система', amount: 85000, trend: -5 },
    { name: 'Аналитика', amount: 65000, trend: 8 },
    { name: 'Хостинг', amount: 45000, trend: 0 },
    { name: 'Email-рассылки', amount: 35000, trend: 15 },
    { name: 'Видеоконференции', amount: 55000, trend: 10 },
    { name: 'Бухгалтерия', amount: 72000, trend: -3 },
    { name: 'Антивирус', amount: 28000, trend: 5 },
    { name: 'VPN-сервисы', amount: 42000, trend: 18 },
    { name: 'Мониторинг', amount: 38000, trend: 7 },
  ];

  const sortedData = [...servicesData].sort((a, b) => b.amount - a.amount);
  const maxAmount = Math.max(...sortedData.map(s => s.amount));
  const totalAmount = sortedData.reduce((sum, s) => sum + s.amount, 0);
  const avgTrend = Math.round(sortedData.reduce((sum, s) => sum + s.trend, 0) / sortedData.length);

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('ru-RU') + ' ₽';
  };

  const dynamicHeight = Math.max(300, sortedData.length * 45 + 120);
  const barHeight = 32;
  const spacing = 45;
  const maxWidth = 420;
  const startX = 160;
  const barColors = ['#3965ff', '#2CD9FF', '#01B574', '#7551e9', '#ffb547'];

  return (
    <Card className="w-full max-w-full sm:max-w-[650px]" style={{ 
      background: '#111c44',
      backdropFilter: 'blur(60px)',
      border: 'none',
      boxShadow: '0px 3.5px 5.5px rgba(0, 0, 0, 0.02)',
      height: `${dynamicHeight}px`,
      overflow: 'hidden',
      position: 'relative',
      marginBottom: '20px'
    }}>
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '180%',
        height: '180%',
        background: 'radial-gradient(circle, rgba(57, 101, 255, 0.08) 0%, transparent 65%)',
        pointerEvents: 'none',
        animation: 'rotate 30s linear infinite'
      }} />
      <CardContent className="p-3 sm:p-4" style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }} className="sm:mb-4">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} className="sm:gap-2">
            <Icon name="Activity" size={16} style={{ color: '#2CD9FF' }} className="sm:w-[18px] sm:h-[18px]" />
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }} className="sm:text-base">Динамика расходов по сервисам</h3>
          </div>
        </div>

        <div style={{ 
          position: 'relative',
          width: '100%',
          minHeight: `${sortedData.length * 45 + 30}px`
        }}>
          <svg viewBox={`0 0 650 ${sortedData.length * 45 + 30}`} style={{ width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid meet">
            <defs>
              {sortedData.map((_, index) => {
                const color = barColors[index % barColors.length];
                return (
                  <linearGradient key={`gradient-${index}`} id={`d2Bar-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={color} stopOpacity="1" />
                  </linearGradient>
                );
              })}
              <filter id="d2Glow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
              const x = startX + ratio * maxWidth;
              const value = formatAmount(Math.round(ratio * maxAmount));
              return (
                <g key={`grid-${idx}`}>
                  <line
                    x1={x}
                    y1="15"
                    x2={x}
                    y2={sortedData.length * spacing + 15}
                    stroke="#56577A"
                    strokeWidth="1"
                    strokeDasharray="5 5"
                  />
                  <text
                    x={x}
                    y="12"
                    textAnchor="middle"
                    fill="#c8cfca"
                    style={{ fontSize: '11px', fontWeight: '500' }}
                  >
                    {value}
                  </text>
                </g>
              );
            })}

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
                    fill={`url(#d2Bar-${index})`}
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
          </svg>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(3, 1fr)', 
          gap: '6px'
        }}>
          {[
            { 
              icon: 'Layers', 
              label: 'Всего сервисов', 
              value: sortedData.length.toString(), 
              color: '#3965ff',
              bgGradient: 'rgba(57, 101, 255, 0.15)'
            },
            { 
              icon: 'TrendingUp', 
              label: 'Растущих', 
              value: sortedData.filter(s => s.trend > 0).length.toString(), 
              color: '#01B574',
              bgGradient: 'rgba(1, 181, 116, 0.15)'
            },
            { 
              icon: 'TrendingDown', 
              label: 'Снижающихся', 
              value: sortedData.filter(s => s.trend < 0).length.toString(), 
              color: '#ff6b6b',
              bgGradient: 'rgba(255, 107, 107, 0.15)'
            }
          ].map((stat, idx) => (
            <div key={idx} style={{ 
              background: `linear-gradient(135deg, ${stat.bgGradient} 0%, ${stat.bgGradient}80 100%)`,
              padding: '6px',
              borderRadius: '6px',
              border: `1px solid ${stat.color}30`,
              transition: 'all 0.3s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.borderColor = stat.color;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = `${stat.color}30`;
            }}>
              <Icon name={stat.icon} size={10} style={{ color: stat.color, marginBottom: '3px' }} />
              <div style={{ 
                color: stat.color, 
                fontSize: '12px', 
                fontWeight: '900',
                marginBottom: '2px'
              }}>
                {stat.value}
              </div>
              <div style={{ color: '#a3aed0', fontSize: '7px', fontWeight: '600' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default Dashboard2ServicesDynamics;