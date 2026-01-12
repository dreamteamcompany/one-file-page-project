import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

interface MonthData {
  month: string;
  income: number;
  expense: number;
}

interface CashFlowChartProps {
  monthlyData: MonthData[];
}

const CashFlowChart = ({ monthlyData }: CashFlowChartProps) => {
  const maxValue = Math.max(
    ...monthlyData.map(m => Math.max(m.income, m.expense))
  );
  
  const formatAmount = (amount: number) => {
    return (amount / 1000).toFixed(0) + ' k';
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
          <Icon name="TrendingUp" size={18} style={{ color: '#2CD9FF' }} />
          Денежный поток
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <div className="relative w-full h-[300px]">
          <svg viewBox="0 0 650 280" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="incomeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#01B574" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#01B574" stopOpacity="0.1" />
              </linearGradient>
              <linearGradient id="expenseGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FF6B6B" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#FF6B6B" stopOpacity="0.1" />
              </linearGradient>
            </defs>

            {/* Сетка */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
              const y = 240 - ratio * 200;
              return (
                <g key={`grid-${idx}`}>
                  <line
                    x1="60"
                    y1={y}
                    x2="620"
                    y2={y}
                    stroke="#56577A"
                    strokeWidth="1"
                    strokeDasharray="5 5"
                  />
                  <text
                    x="50"
                    y={y + 4}
                    textAnchor="end"
                    fill="#c8cfca"
                    style={{ fontSize: '11px', fontWeight: '500' }}
                  >
                    {formatAmount(ratio * maxValue)}
                  </text>
                </g>
              );
            })}

            {/* Линия доходов */}
            {(() => {
              const incomePoints = monthlyData.map((data, index) => {
                const x = 80 + index * 90;
                const y = 240 - (data.income / maxValue) * 200;
                return { x, y };
              });
              
              const incomePath = incomePoints.map((p, i) => 
                `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
              ).join(' ');
              
              const incomeArea = `${incomePath} L ${incomePoints[incomePoints.length - 1].x} 240 L ${incomePoints[0].x} 240 Z`;
              
              return (
                <g>
                  <path
                    d={incomeArea}
                    fill="url(#incomeGradient)"
                  />
                  <path
                    d={incomePath}
                    stroke="#01B574"
                    strokeWidth="3"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {incomePoints.map((point, index) => (
                    <g key={`income-point-${index}`}>
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r="6"
                        fill="#01B574"
                        opacity="0.3"
                      />
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r="4"
                        fill="#01B574"
                      />
                    </g>
                  ))}
                </g>
              );
            })()}

            {/* Линия расходов */}
            {(() => {
              const expensePoints = monthlyData.map((data, index) => {
                const x = 80 + index * 90;
                const y = 240 - (data.expense / maxValue) * 200;
                return { x, y };
              });
              
              const expensePath = expensePoints.map((p, i) => 
                `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
              ).join(' ');
              
              const expenseArea = `${expensePath} L ${expensePoints[expensePoints.length - 1].x} 240 L ${expensePoints[0].x} 240 Z`;
              
              return (
                <g>
                  <path
                    d={expenseArea}
                    fill="url(#expenseGradient)"
                  />
                  <path
                    d={expensePath}
                    stroke="#FF6B6B"
                    strokeWidth="3"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {expensePoints.map((point, index) => (
                    <g key={`expense-point-${index}`}>
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r="6"
                        fill="#FF6B6B"
                        opacity="0.3"
                      />
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r="4"
                        fill="#FF6B6B"
                      />
                    </g>
                  ))}
                </g>
              );
            })()}

            {/* Подписи месяцев */}
            {monthlyData.map((data, index) => {
              const x = 80 + index * 90;
              return (
                <text
                  key={`month-${index}`}
                  x={x}
                  y="260"
                  textAnchor="middle"
                  fill="#c8cfca"
                  style={{ fontSize: '12px' }}
                >
                  {data.month}
                </text>
              );
            })}
          </svg>
        </div>

        {/* Легенда */}
        <div className="flex items-center justify-center gap-6 mt-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#01B574' }} />
            <span style={{ fontSize: '11px', color: '#c8cfca' }}>Доходы</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#FF6B6B' }} />
            <span style={{ fontSize: '11px', color: '#c8cfca' }}>Расходы</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CashFlowChart;
