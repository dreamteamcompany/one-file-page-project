import { useState } from 'react';
import OpsHeader from '../ops/OpsHeader';
import { PeriodType } from '../ops/useOpsDashboard';
import TeamKpiRow from './TeamKpiRow';
import TeamMiddleRow from './TeamMiddleRow';
import TeamBottomRow from './TeamBottomRow';
import TeamEscalationRow from './TeamEscalationRow';
import TeamTimeToL3Row from './TeamTimeToL3Row';
import { useTeamDashboard } from './useTeamDashboard';

const TeamDashboard = () => {
  const [period, setPeriod] = useState<PeriodType>('month');
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();

  const { data, loading, refresh } = useTeamDashboard(period, dateFrom, dateTo);

  return (
    <div className="flex flex-col gap-5 w-full">
      <OpsHeader
        period={period}
        onPeriodChange={setPeriod}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onRefresh={refresh}
        loading={loading}
        title="4. Производительность команды"
        subtitle="Эффективность работы инженеров и команды поддержки"
      />

      <TeamKpiRow kpi={data?.kpi} loading={loading} />
      <TeamMiddleRow data={data} loading={loading} />
      <TeamBottomRow data={data} loading={loading} />
      <TeamEscalationRow data={data} loading={loading} />
      <TeamTimeToL3Row data={data} loading={loading} />
    </div>
  );
};

export default TeamDashboard;