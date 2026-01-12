import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

interface MonthData {
  month: string;
  amount: number;
}

interface ExpensesGrowthChartProps {
  monthlyData: MonthData[];
}

const ExpensesGrowthChart = ({ monthlyData }: ExpensesGrowthChartProps) => {
  return (
    <Card className="relative w-full" style={{
      background: '#111c44',
      backdropFilter: 'blur(60px)',
      border: 'none',
      boxShadow: '0px 3.5px 5.5px rgba(0, 0, 0, 0.02)',
      maxWidth: '600px',
      height: 'auto',
      minHeight: '300px',
      overflow: 'hidden',
    }}>
      <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg" style={{ color: '#fff', fontWeight: 'bold' }}>
          <Icon name="BarChart3" size={20} style={{ color: '#2CD9FF' }} />
          <span className="text-sm sm:text-base">Динамика роста затрат</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 sm:p-4" style={{ overflow: 'hidden' }}>
        <div className="relative flex items-center justify-center w-full" style={{ height: '200px', minHeight: '200px', overflow: 'auto' }}>
          <svg viewBox="0 0 800 400" className="w-full h-full" style={{ minHeight: '200px' }} preserveAspectRatio="xMidYMid meet">
            {(() => {
              const maxMonthAmount = Math.max(...monthlyData.map(m => m.amount));
              const spacing = 130;
              const maxHeight = 300;
              const startY = 340;
              const startX = 80;
              
              const gridLines = [0, 0.25, 0.5, 0.75, 1].map(ratio => ({
                y: startY - ratio * maxHeight,
                value: (ratio * maxMonthAmount / 1000000).toFixed(1)
              }));
              
              const points = monthlyData.map((data, index) => {
                const x = startX + index * spacing;
                const barHeight = (data.amount / maxMonthAmount) * maxHeight;
                const y = startY - barHeight;
                return { x, y };
              });
              
              const smoothLinePath = points.reduce((path, point, i) => {
                if (i === 0) {
                  return `M ${point.x} ${point.y}`;
                }
                const prevPoint = points[i - 1];
                const controlX1 = prevPoint.x + (point.x - prevPoint.x) / 2;
                const controlY1 = prevPoint.y;
                const controlX2 = prevPoint.x + (point.x - prevPoint.x) / 2;
                const controlY2 = point.y;
                return `${path} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${point.x} ${point.y}`;
              }, '');
              
              return (
                <>
                  {gridLines.map((line, idx) => (
                    <g key={idx}>
                      <line
                        x1="70"
                        y1={line.y}
                        x2="780"
                        y2={line.y}
                        stroke="#56577A"
                        strokeWidth="1"
                        strokeDasharray="5 5"
                      />
                      <text
                        x="50"
                        y={line.y + 4}
                        textAnchor="end"
                        fill="#c8cfca"
                        style={{ fontSize: '12px', fontWeight: '500' }}
                      >
                        {line.value}М
                      </text>
                    </g>
                  ))}
                  
                  {monthlyData.map((data, index) => {
                    const x = startX + index * spacing;
                    
                    return (
                      <g key={data.month}>
                        <text
                          x={x}
                          y={365}
                          textAnchor="middle"
                          fill="#c8cfca"
                          style={{ fontSize: '12px' }}
                        >
                          {data.month}
                        </text>
                      </g>
                    );
                  })}
                  
                  <defs>
                    <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#01B574" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#01B574" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path
                    d={`${smoothLinePath} L ${points[points.length - 1].x} ${startY} L ${points[0].x} ${startY} Z`}
                    fill="url(#areaGradient)"
                  />
                  
                  <defs>
                    <linearGradient id="lineGradientGrowth" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#01B574" />
                      <stop offset="100%" stopColor="#2CD9FF" />
                    </linearGradient>
                  </defs>
                  <path
                    d={smoothLinePath}
                    stroke="url(#lineGradientGrowth)"
                    strokeWidth="3"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              );
            })()}
          </svg>
        </div>
      </CardContent>
    </Card>
  );
};

export default ExpensesGrowthChart;