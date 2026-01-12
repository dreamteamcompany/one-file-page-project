import Dashboard2StatsRow from './Dashboard2StatsRow';
import Dashboard2KPIRow from './Dashboard2KPIRow';
import Dashboard2PaymentCalendar from './Dashboard2PaymentCalendar';
import Dashboard2UpcomingPayments from './Dashboard2UpcomingPayments';

import Dashboard2TeamPerformance from './Dashboard2TeamPerformance';
import Dashboard2ServicesDynamics from './Dashboard2ServicesDynamics';

const Dashboard2NeonCards = () => {
  return (
    <>
      <Dashboard2StatsRow />
      <Dashboard2KPIRow />
      <Dashboard2PaymentCalendar />
      <Dashboard2UpcomingPayments />

      <Dashboard2TeamPerformance />
      <Dashboard2ServicesDynamics />
    </>
  );
};

export default Dashboard2NeonCards;