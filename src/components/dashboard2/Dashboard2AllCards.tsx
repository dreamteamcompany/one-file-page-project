import { useState, useEffect } from 'react';
import TotalExpensesCard from './blocks/TotalExpensesCard';
import IndexationCard from './blocks/IndexationCard';
import AttentionRequiredCard from './blocks/AttentionRequiredCard';
import AnnualSavingsStatCard from './blocks/AnnualSavingsStatCard';
import MonthlyDynamicsChart from './blocks/MonthlyDynamicsChart';
import CategoryExpensesChart from './blocks/CategoryExpensesChart';
import ContractorComparisonChart from './blocks/ContractorComparisonChart';
import ExpenseStructureChart from './blocks/ExpenseStructureChart';
import LegalEntityComparisonChart from './blocks/LegalEntityComparisonChart';

interface DashboardCard {
  id: string;
  title: string;
  type: 'stat' | 'chart';
}

const Dashboard2AllCards = () => {
  const [cardOrder, setCardOrder] = useState<DashboardCard[]>([]);

  const defaultCards: DashboardCard[] = [
    { id: 'total-expenses', title: 'Общие IT Расходы', type: 'stat' },
    { id: 'total-payments', title: 'Индексация', type: 'stat' },
    { id: 'attention-required', title: 'Требуют внимания', type: 'stat' },
    { id: 'annual-savings', title: 'Экономия', type: 'stat' },
    { id: 'monthly-dynamics', title: 'Динамика Расходов по Месяцам', type: 'chart' },
    { id: 'category-expenses', title: 'IT Расходы по Категориям', type: 'chart' },
    { id: 'contractor-comparison', title: 'Сравнение по Контрагентам', type: 'chart' },
    { id: 'expense-structure', title: 'Структура Расходов', type: 'chart' },
    { id: 'legal-entity-comparison', title: 'Сравнение по Юридическим Лицам', type: 'chart' },
  ];

  useEffect(() => {
    const savedLayout = localStorage.getItem('dashboard2-layout');
    if (savedLayout) {
      try {
        const parsed = JSON.parse(savedLayout);
        setCardOrder(parsed);
      } catch (e) {
        console.error('Failed to parse saved layout:', e);
        setCardOrder(defaultCards);
      }
    } else {
      setCardOrder(defaultCards);
    }
  }, []);

  const renderCard = (card: DashboardCard) => {
    switch (card.id) {
      case 'total-expenses':
        return <TotalExpensesCard />;
      case 'total-payments':
        return <IndexationCard />;
      case 'attention-required':
        return <AttentionRequiredCard />;
      case 'annual-savings':
        return <AnnualSavingsStatCard />;
      case 'monthly-dynamics':
        return <MonthlyDynamicsChart />;
      case 'category-expenses':
        return <CategoryExpensesChart />;
      case 'contractor-comparison':
        return <ContractorComparisonChart />;
      case 'expense-structure':
        return <ExpenseStructureChart />;
      case 'legal-entity-comparison':
        return <LegalEntityComparisonChart />;
      default:
        return null;
    }
  };

  if (cardOrder.length === 0) return null;

  const statCards = cardOrder.filter(card => card.type === 'stat');
  const chartCards = cardOrder.filter(card => card.type === 'chart');

  return (
    <div className="mb-6 sm:mb-8 overflow-x-hidden max-w-full">
      {/* Stat Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-4 sm:mb-6">
        {statCards.map((card) => {
          return (
            <div 
              key={card.id} 
              className="w-full h-[280px] sm:h-[300px]"
            >
              {renderCard(card)}
            </div>
          );
        })}
      </div>

      {/* Chart Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {chartCards.map((card) => (
          <div 
            key={card.id} 
            className="min-w-0 max-w-full overflow-hidden"
          >
            {renderCard(card)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard2AllCards;