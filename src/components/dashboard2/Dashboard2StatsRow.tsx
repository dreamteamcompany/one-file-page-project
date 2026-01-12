import TopPaymentsCard from './blocks/TopPaymentsCard';
import LiveMetricsCard from './blocks/LiveMetricsCard';
import CriticalAlertsCard from './blocks/CriticalAlertsCard';

const Dashboard2StatsRow = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
      <TopPaymentsCard />
      <LiveMetricsCard />
      <CriticalAlertsCard />
    </div>
  );
};

export default Dashboard2StatsRow;