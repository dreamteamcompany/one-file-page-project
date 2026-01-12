import { Card, CardContent } from '@/components/ui/card';
import { Doughnut } from 'react-chartjs-2';

const ExpenseStructureChart = () => {
  return (
    <Card style={{ background: '#111c44', border: '1px solid rgba(255, 181, 71, 0.4)', boxShadow: '0 0 30px rgba(255, 181, 71, 0.2), inset 0 0 15px rgba(255, 181, 71, 0.05)' }}>
      <CardContent className="p-6">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#fff' }}>Структура Расходов</h3>
          <div style={{ display: 'flex', gap: '8px', background: 'rgba(255, 255, 255, 0.05)', padding: '4px', borderRadius: '10px' }}>
            <button style={{ background: '#7551e9', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', boxShadow: '0 2px 8px rgba(117, 81, 233, 0.3)' }}>Общие</button>
            <button style={{ background: 'transparent', border: 'none', color: '#a3aed0', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>Детали</button>
          </div>
        </div>
        <div style={{ height: '350px', position: 'relative' }}>
          <Doughnut
            data={{
              labels: ['IT', 'Маркетинг', 'HR', 'Офис', 'Прочее'],
              datasets: [{
                data: [45, 25, 15, 10, 5],
                backgroundColor: [
                  'rgb(117, 81, 233)',
                  'rgb(57, 101, 255)',
                  'rgb(255, 181, 71)',
                  'rgb(1, 181, 116)',
                  'rgb(255, 107, 107)'
                ],
                borderWidth: 0,
                hoverOffset: 10
              }]
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              cutout: '70%',
              plugins: {
                legend: {
                  position: 'right',
                  labels: {
                    padding: 20,
                    usePointStyle: true,
                    color: '#a3aed0',
                    font: {
                      family: 'Plus Jakarta Sans, sans-serif',
                      size: 13
                    }
                  }
                },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      return `${context.label}: ${context.parsed}%`;
                    }
                  }
                }
              }
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default ExpenseStructureChart;
