import MonthlyDynamicsChart from './blocks/MonthlyDynamicsChart';
import CategoryExpensesChart from './blocks/CategoryExpensesChart';
import ContractorComparisonChart from './blocks/ContractorComparisonChart';
import ExpenseStructureChart from './blocks/ExpenseStructureChart';
import LegalEntityComparisonChart from './blocks/LegalEntityComparisonChart';

const Dashboard2ChartsSection = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8 overflow-x-hidden max-w-full">
      <div className="min-w-0 max-w-full overflow-hidden">
        <MonthlyDynamicsChart />
      </div>
      <div className="min-w-0 max-w-full overflow-hidden">
        <CategoryExpensesChart />
      </div>
      <div className="min-w-0 max-w-full overflow-hidden">
        <ContractorComparisonChart />
      </div>
      <div className="min-w-0 max-w-full overflow-hidden">
        <ExpenseStructureChart />
      </div>
      <div className="min-w-0 max-w-full overflow-hidden">
        <LegalEntityComparisonChart />
      </div>
    </div>
  );
};

export default Dashboard2ChartsSection;