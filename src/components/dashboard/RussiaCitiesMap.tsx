import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

interface CityData {
  name: string;
  amount: number;
  x: number;
  y: number;
}

interface RussiaCitiesMapProps {
  citiesData: CityData[];
}

const RussiaCitiesMap = ({ citiesData }: RussiaCitiesMapProps) => {
  const sortedCities = [...citiesData].sort((a, b) => b.amount - a.amount);
  const maxAmount = Math.max(...citiesData.map(c => c.amount));
  
  const formatAmount = (amount: number) => {
    return (amount / 1000).toFixed(0) + ' k';
  };

  const getHexagonPath = (cx: number, cy: number, size: number) => {
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const x = cx + size * Math.cos(angle);
      const y = cy + size * Math.sin(angle);
      points.push(`${x},${y}`);
    }
    return `M ${points.join(' L ')} Z`;
  };

  const getColorByAmount = (amount: number) => {
    const ratio = amount / maxAmount;
    if (ratio > 0.7) return '#FF6B6B';
    if (ratio > 0.4) return '#FFB800';
    return '#01B574';
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
          <Icon name="MapPin" size={18} style={{ color: '#2CD9FF' }} />
          География затрат
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <div className="relative w-full h-[300px]">
          <svg viewBox="0 0 900 350" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            {/* Карта России из сот */}
            <g opacity="0.25">
              {/* Западная часть */}
              {Array.from({ length: 6 }).map((_, row) =>
                Array.from({ length: 4 }).map((_, col) => {
                  const offsetX = row % 2 === 0 ? 0 : 18;
                  const x = 80 + col * 36 + offsetX;
                  const y = 80 + row * 31;
                  return (
                    <path
                      key={`hex-w-${row}-${col}`}
                      d={getHexagonPath(x, y, 15)}
                      fill="none"
                      stroke="#3B4F6D"
                      strokeWidth="1.5"
                    />
                  );
                })
              )}
              
              {/* Центральная часть */}
              {Array.from({ length: 7 }).map((_, row) =>
                Array.from({ length: 8 }).map((_, col) => {
                  const offsetX = row % 2 === 0 ? 0 : 18;
                  const x = 220 + col * 36 + offsetX;
                  const y = 60 + row * 31;
                  return (
                    <path
                      key={`hex-c-${row}-${col}`}
                      d={getHexagonPath(x, y, 15)}
                      fill="none"
                      stroke="#3B4F6D"
                      strokeWidth="1.5"
                    />
                  );
                })
              )}
              
              {/* Восточная часть */}
              {Array.from({ length: 8 }).map((_, row) =>
                Array.from({ length: 10 }).map((_, col) => {
                  const offsetX = row % 2 === 0 ? 0 : 18;
                  const x = 510 + col * 36 + offsetX;
                  const y = 50 + row * 31;
                  return (
                    <path
                      key={`hex-e-${row}-${col}`}
                      d={getHexagonPath(x, y, 15)}
                      fill="none"
                      stroke="#3B4F6D"
                      strokeWidth="1.5"
                    />
                  );
                })
              )}
            </g>

            {/* Города с данными */}
            {citiesData.map((city, index) => {
              const color = getColorByAmount(city.amount);
              const size = 20 + (city.amount / maxAmount) * 15;
              
              return (
                <g key={`city-${city.name}-${index}`}>
                  <path
                    d={getHexagonPath(city.x, city.y, size)}
                    fill={color}
                    fillOpacity="0.2"
                    stroke={color}
                    strokeWidth="2"
                    filter="url(#glow)"
                  />
                  <path
                    d={getHexagonPath(city.x, city.y, size - 5)}
                    fill={color}
                    fillOpacity="0.4"
                  />
                  <circle
                    cx={city.x}
                    cy={city.y}
                    r="4"
                    fill="#fff"
                  />
                  
                  <text
                    x={city.x}
                    y={city.y + size + 18}
                    textAnchor="middle"
                    fill="#fff"
                    style={{ fontSize: '13px', fontWeight: '600' }}
                  >
                    {city.name}
                  </text>
                  <text
                    x={city.x}
                    y={city.y + size + 32}
                    textAnchor="middle"
                    fill="#c8cfca"
                    style={{ fontSize: '12px' }}
                  >
                    {formatAmount(city.amount)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Легенда */}
        <div className="flex items-center justify-center gap-6 mt-2">
          {[
            { label: 'Высокие', color: '#FF6B6B' },
            { label: 'Средние', color: '#FFB800' },
            { label: 'Низкие', color: '#01B574' },
          ].map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: item.color }}
              />
              <span style={{ fontSize: '11px', color: '#c8cfca' }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default RussiaCitiesMap;