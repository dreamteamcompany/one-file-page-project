import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

interface TeamMember {
  name: string;
  tasks: number;
  efficiency: number;
}

interface TeamPerformanceChartProps {
  teamData: TeamMember[];
}

const TeamPerformanceChart = ({ teamData }: TeamPerformanceChartProps) => {
  const maxTasks = Math.max(...teamData.map(m => m.tasks));
  
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
          <Icon name="Users" size={18} style={{ color: '#2CD9FF' }} />
          Эффективность команды
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <div className="relative w-full h-[300px] flex items-center justify-center">
          <svg viewBox="0 0 400 320" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="radarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#2CD9FF" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#0075FF" stopOpacity="0.1" />
              </linearGradient>
              <filter id="glow2">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            {/* Центральные круги */}
            {[100, 80, 60, 40, 20].map((radius, idx) => (
              <circle
                key={idx}
                cx="200"
                cy="160"
                r={radius}
                fill="none"
                stroke="#2C3E5D"
                strokeWidth="1"
                opacity="0.4"
              />
            ))}

            {/* Лучи из центра */}
            {teamData.map((_, index) => {
              const angle = (index / teamData.length) * Math.PI * 2 - Math.PI / 2;
              const x = 200 + Math.cos(angle) * 100;
              const y = 160 + Math.sin(angle) * 100;
              
              return (
                <line
                  key={`ray-${index}`}
                  x1="200"
                  y1="160"
                  x2={x}
                  y2={y}
                  stroke="#2C3E5D"
                  strokeWidth="1"
                  opacity="0.4"
                />
              );
            })}

            {/* Данные радара */}
            <g>
              {(() => {
                const points = teamData.map((member, index) => {
                  const angle = (index / teamData.length) * Math.PI * 2 - Math.PI / 2;
                  const radius = (member.efficiency / 100) * 100;
                  return {
                    x: 200 + Math.cos(angle) * radius,
                    y: 160 + Math.sin(angle) * radius,
                  };
                });
                
                const pathData = points.map((p, i) => 
                  `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
                ).join(' ') + ' Z';
                
                return (
                  <>
                    <path
                      d={pathData}
                      fill="url(#radarGradient)"
                      stroke="#2CD9FF"
                      strokeWidth="2"
                      filter="url(#glow2)"
                    />
                    {points.map((point, index) => (
                      <g key={`point-${index}`}>
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r="5"
                          fill="#0075FF"
                          opacity="0.3"
                        />
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r="3"
                          fill="#fff"
                        />
                      </g>
                    ))}
                  </>
                );
              })()}
            </g>

            {/* Подписи */}
            {teamData.map((member, index) => {
              const angle = (index / teamData.length) * Math.PI * 2 - Math.PI / 2;
              const labelRadius = 120;
              const x = 200 + Math.cos(angle) * labelRadius;
              const y = 160 + Math.sin(angle) * labelRadius;
              
              return (
                <g key={`label-${index}`}>
                  <text
                    x={x}
                    y={y}
                    textAnchor="middle"
                    fill="#fff"
                    style={{ fontSize: '13px', fontWeight: '600' }}
                  >
                    {member.name}
                  </text>
                  <text
                    x={x}
                    y={y + 15}
                    textAnchor="middle"
                    fill="#2CD9FF"
                    style={{ fontSize: '11px' }}
                  >
                    {member.efficiency}%
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </CardContent>
    </Card>
  );
};

export default TeamPerformanceChart;
