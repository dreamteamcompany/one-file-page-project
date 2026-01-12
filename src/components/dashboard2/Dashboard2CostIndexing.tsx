import { Card, CardContent } from '@/components/ui/card';
import { useState } from 'react';
import Dashboard2CostIndexingHeader from './Dashboard2CostIndexingHeader';
import Dashboard2CostIndexingFilters from './Dashboard2CostIndexingFilters';
import Dashboard2CostIndexingChart from './Dashboard2CostIndexingChart';
import Dashboard2CostIndexingStats from './Dashboard2CostIndexingStats';

interface IndexData {
  month: string;
  index: number;
  change: number;
  categories: {
    it: number;
    office: number;
    marketing: number;
    operations: number;
  };
}

const Dashboard2CostIndexing = () => {
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'it' | 'office' | 'marketing' | 'operations'>('all');

  const indexData: IndexData[] = [
    { month: 'Янв', index: 100, change: 0, categories: { it: 100, office: 100, marketing: 100, operations: 100 } },
    { month: 'Фев', index: 105, change: 5, categories: { it: 103, office: 108, marketing: 102, operations: 106 } },
    { month: 'Мар', index: 112, change: 6.7, categories: { it: 110, office: 115, marketing: 108, operations: 113 } },
    { month: 'Апр', index: 108, change: -3.6, categories: { it: 106, office: 112, marketing: 105, operations: 109 } },
    { month: 'Май', index: 115, change: 6.5, categories: { it: 113, office: 118, marketing: 112, operations: 116 } },
    { month: 'Июн', index: 122, change: 6.1, categories: { it: 120, office: 125, marketing: 118, operations: 123 } },
    { month: 'Июл', index: 118, change: -3.3, categories: { it: 116, office: 121, marketing: 115, operations: 119 } },
    { month: 'Авг', index: 125, change: 5.9, categories: { it: 123, office: 128, marketing: 122, operations: 126 } },
    { month: 'Сен', index: 132, change: 5.6, categories: { it: 130, office: 135, marketing: 129, operations: 133 } },
    { month: 'Окт', index: 128, change: -3, categories: { it: 126, office: 131, marketing: 125, operations: 129 } },
    { month: 'Ноя', index: 135, change: 5.5, categories: { it: 133, office: 138, marketing: 132, operations: 136 } },
    { month: 'Дек', index: 142, change: 5.2, categories: { it: 140, office: 145, marketing: 139, operations: 143 } },
  ];

  const categories = [
    { id: 'all' as const, name: 'Все категории', icon: 'Layers', color: '#3965ff' },
    { id: 'it' as const, name: 'IT-инфраструктура', icon: 'Server', color: '#2CD9FF' },
    { id: 'office' as const, name: 'Офисные расходы', icon: 'Building2', color: '#01B574' },
    { id: 'marketing' as const, name: 'Маркетинг', icon: 'TrendingUp', color: '#ffb547' },
    { id: 'operations' as const, name: 'Операционные', icon: 'Settings', color: '#7551e9' },
  ];

  const getDisplayData = () => {
    if (selectedCategory === 'all') {
      return indexData.map(d => d.index);
    }
    return indexData.map(d => d.categories[selectedCategory]);
  };

  const displayData = getDisplayData();
  const maxIndex = Math.max(...displayData);
  const minIndex = Math.min(...displayData);
  const currentIndex = displayData[displayData.length - 1];
  const startIndex = displayData[0];
  const totalChange = ((currentIndex - startIndex) / startIndex) * 100;
  const avgMonthlyChange = indexData.reduce((sum, d) => sum + d.change, 0) / indexData.length;

  const chartWidth = 650;
  const chartHeight = 280;
  const padding = { top: 40, right: 50, bottom: 40, left: 60 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;

  const xStep = plotWidth / (indexData.length - 1);
  const yScale = (value: number) => {
    return padding.top + plotHeight - ((value - minIndex) / (maxIndex - minIndex)) * plotHeight;
  };

  const points = displayData.map((value, index) => ({
    x: padding.left + index * xStep,
    y: yScale(value),
    value,
    month: indexData[index].month,
    change: indexData[index].change
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${chartHeight - padding.bottom} L ${padding.left} ${chartHeight - padding.bottom} Z`;

  const selectedCategoryData = categories.find(c => c.id === selectedCategory);
  const categoryColor = selectedCategoryData?.color || '#3965ff';

  return (
    <Card style={{ 
      background: 'linear-gradient(135deg, #1a1f37 0%, #111c44 100%)', 
      border: '1px solid rgba(57, 101, 255, 0.3)',
      boxShadow: '0 0 40px rgba(57, 101, 255, 0.2), inset 0 0 30px rgba(57, 101, 255, 0.08)',
      position: 'relative',
      overflow: 'hidden',
      marginBottom: '30px'
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

      <CardContent className="p-6" style={{ position: 'relative', zIndex: 1 }}>
        <Dashboard2CostIndexingHeader 
          currentIndex={currentIndex}
          totalChange={totalChange}
        />
        
        <Dashboard2CostIndexingFilters 
          categories={categories}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />
        
        <Dashboard2CostIndexingChart 
          points={points}
          linePath={linePath}
          areaPath={areaPath}
          categoryColor={categoryColor}
          chartWidth={chartWidth}
          chartHeight={chartHeight}
          padding={padding}
          plotHeight={plotHeight}
          minIndex={minIndex}
          maxIndex={maxIndex}
          hoveredMonth={hoveredMonth}
          onHoverMonth={setHoveredMonth}
        />
        
        <Dashboard2CostIndexingStats 
          currentIndex={currentIndex}
          lastMonth={indexData[indexData.length - 1].month}
          totalChange={totalChange}
          avgMonthlyChange={avgMonthlyChange}
          maxIndex={maxIndex}
          minIndex={minIndex}
          categoryColor={categoryColor}
        />
      </CardContent>
    </Card>
  );
};

export default Dashboard2CostIndexing;
