import Dashboard2ChartsSection from './Dashboard2ChartsSection';
import Dashboard2NeonCards from './Dashboard2NeonCards';
import Dashboard2BudgetBreakdown from './Dashboard2BudgetBreakdown';


const Dashboard2Charts = () => {
  return (
    <>
      <Dashboard2ChartsSection />
      <Dashboard2NeonCards />
      <Dashboard2BudgetBreakdown />


      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }
        @keyframes glow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(255, 181, 71, 0.5);
          }
          50% {
            box-shadow: 0 0 40px rgba(255, 181, 71, 0.8);
          }
        }
        @keyframes slide {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        @keyframes rotate {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        @keyframes breathe {
          0%, 100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.1);
            opacity: 0.8;
          }
        }
        @keyframes progress {
          from {
            width: 0;
          }
        }
      `}</style>
    </>
  );
};

export default Dashboard2Charts;