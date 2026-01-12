interface ChartPoint {
  x: number;
  y: number;
  value: number;
  month: string;
  change: number;
}

interface Dashboard2CostIndexingChartProps {
  points: ChartPoint[];
  linePath: string;
  areaPath: string;
  categoryColor: string;
  chartWidth: number;
  chartHeight: number;
  padding: { top: number; right: number; bottom: number; left: number };
  plotHeight: number;
  minIndex: number;
  maxIndex: number;
  hoveredMonth: number | null;
  onHoverMonth: (index: number | null) => void;
}

const Dashboard2CostIndexingChart = ({
  points,
  linePath,
  areaPath,
  categoryColor,
  chartWidth,
  chartHeight,
  padding,
  plotHeight,
  minIndex,
  maxIndex,
  hoveredMonth,
  onHoverMonth
}: Dashboard2CostIndexingChartProps) => {
  return (
    <div style={{ 
      background: 'rgba(255, 255, 255, 0.02)',
      borderRadius: '16px',
      padding: '24px',
      border: '1px solid rgba(255, 255, 255, 0.05)',
      marginBottom: '24px'
    }}>
      <svg width={chartWidth} height={chartHeight} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="indexLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={categoryColor} stopOpacity="0.8" />
            <stop offset="100%" stopColor={categoryColor} stopOpacity="1" />
          </linearGradient>
          <linearGradient id="indexAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={categoryColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={categoryColor} stopOpacity="0.05" />
          </linearGradient>
          <filter id="indexGlow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
          const y = padding.top + plotHeight - ratio * plotHeight;
          const value = (minIndex + (maxIndex - minIndex) * ratio).toFixed(0);
          return (
            <g key={`grid-y-${idx}`}>
              <line
                x1={padding.left}
                y1={y}
                x2={chartWidth - padding.right}
                y2={y}
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                fill="#a3aed0"
                style={{ fontSize: '11px', fontWeight: '600' }}
              >
                {value}
              </text>
            </g>
          );
        })}

        {points.map((point, index) => (
          <text
            key={`month-${index}`}
            x={point.x}
            y={chartHeight - padding.bottom + 20}
            textAnchor="middle"
            fill={hoveredMonth === index ? categoryColor : '#a3aed0'}
            style={{ 
              fontSize: '12px', 
              fontWeight: hoveredMonth === index ? '700' : '600',
              transition: 'all 0.3s ease'
            }}
          >
            {point.month}
          </text>
        ))}

        <path
          d={areaPath}
          fill="url(#indexAreaGradient)"
        />

        <path
          d={linePath}
          stroke="url(#indexLineGradient)"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#indexGlow)"
        />

        {points.map((point, index) => (
          <g 
            key={`point-${index}`}
            onMouseEnter={() => onHoverMonth(index)}
            onMouseLeave={() => onHoverMonth(null)}
            style={{ cursor: 'pointer' }}
          >
            <circle
              cx={point.x}
              cy={point.y}
              r={hoveredMonth === index ? "10" : "6"}
              fill={categoryColor}
              opacity="0.3"
              style={{ transition: 'all 0.3s ease' }}
            />
            <circle
              cx={point.x}
              cy={point.y}
              r={hoveredMonth === index ? "6" : "4"}
              fill="#fff"
              filter={hoveredMonth === index ? "url(#indexGlow)" : "none"}
              style={{ transition: 'all 0.3s ease' }}
            />
            
            {hoveredMonth === index && (
              <g>
                <rect
                  x={point.x - 50}
                  y={point.y - 60}
                  width="100"
                  height="50"
                  rx="8"
                  fill="rgba(17, 28, 68, 0.95)"
                  stroke={categoryColor}
                  strokeWidth="1"
                />
                <text
                  x={point.x}
                  y={point.y - 40}
                  textAnchor="middle"
                  fill="#fff"
                  style={{ fontSize: '13px', fontWeight: '700' }}
                >
                  {point.month}
                </text>
                <text
                  x={point.x}
                  y={point.y - 25}
                  textAnchor="middle"
                  fill={categoryColor}
                  style={{ fontSize: '15px', fontWeight: '800' }}
                >
                  {point.value.toFixed(1)}
                </text>
                <text
                  x={point.x}
                  y={point.y - 12}
                  textAnchor="middle"
                  fill={point.change >= 0 ? '#01b574' : '#ff6b6b'}
                  style={{ fontSize: '12px', fontWeight: '700' }}
                >
                  {point.change >= 0 ? '+' : ''}{point.change.toFixed(1)}%
                </text>
              </g>
            )}
          </g>
        ))}

        <line
          x1={padding.left}
          y1={padding.top + plotHeight - ((100 - minIndex) / (maxIndex - minIndex)) * plotHeight}
          x2={chartWidth - padding.right}
          y2={padding.top + plotHeight - ((100 - minIndex) / (maxIndex - minIndex)) * plotHeight}
          stroke="#ffb547"
          strokeWidth="2"
          strokeDasharray="8 4"
          opacity="0.5"
        />
        <text
          x={chartWidth - padding.right + 5}
          y={padding.top + plotHeight - ((100 - minIndex) / (maxIndex - minIndex)) * plotHeight + 4}
          textAnchor="start"
          fill="#ffb547"
          style={{ fontSize: '11px', fontWeight: '700' }}
        >
          База: 100
        </text>
      </svg>
    </div>
  );
};

export default Dashboard2CostIndexingChart;
