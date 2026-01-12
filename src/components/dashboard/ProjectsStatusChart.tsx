import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

interface Project {
  name: string;
  status: 'completed' | 'in_progress' | 'pending';
  progress: number;
}

interface ProjectsStatusChartProps {
  projects: Project[];
}

const ProjectsStatusChart = ({ projects }: ProjectsStatusChartProps) => {
  const completed = projects.filter(p => p.status === 'completed').length;
  const inProgress = projects.filter(p => p.status === 'in_progress').length;
  const pending = projects.filter(p => p.status === 'pending').length;
  const total = projects.length;
  
  const completedAngle = (completed / total) * 360;
  const inProgressAngle = (inProgress / total) * 360;
  const pendingAngle = (pending / total) * 360;
  
  const getArcPath = (startAngle: number, endAngle: number, radius: number) => {
    const start = (startAngle - 90) * (Math.PI / 180);
    const end = (endAngle - 90) * (Math.PI / 180);
    
    const x1 = 200 + radius * Math.cos(start);
    const y1 = 200 + radius * Math.sin(start);
    const x2 = 200 + radius * Math.cos(end);
    const y2 = 200 + radius * Math.sin(end);
    
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    
    return `M 200 200 L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
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
          <Icon name="FolderKanban" size={18} style={{ color: '#2CD9FF' }} />
          Статус проектов
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <div className="relative w-full h-[300px] flex items-center justify-center">
          <svg viewBox="0 0 400 400" className="w-full h-full max-h-[280px]" preserveAspectRatio="xMidYMid meet">
            <defs>
              <filter id="shadow">
                <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#2CD9FF" floodOpacity="0.3"/>
              </filter>
            </defs>

            {/* Внешний круг декоративный */}
            <circle
              cx="200"
              cy="200"
              r="140"
              fill="none"
              stroke="#2C3E5D"
              strokeWidth="1"
              opacity="0.3"
            />

            {/* Завершенные */}
            <path
              d={getArcPath(0, completedAngle, 120)}
              fill="#01B574"
              opacity="0.8"
              filter="url(#shadow)"
            />

            {/* В процессе */}
            <path
              d={getArcPath(completedAngle, completedAngle + inProgressAngle, 120)}
              fill="#FFB800"
              opacity="0.8"
              filter="url(#shadow)"
            />

            {/* В ожидании */}
            <path
              d={getArcPath(completedAngle + inProgressAngle, 360, 120)}
              fill="#7B61FF"
              opacity="0.8"
              filter="url(#shadow)"
            />

            {/* Внутренний круг */}
            <circle
              cx="200"
              cy="200"
              r="70"
              fill="#0f1729"
            />
            <circle
              cx="200"
              cy="200"
              r="70"
              fill="none"
              stroke="#2CD9FF"
              strokeWidth="2"
              opacity="0.5"
            />

            {/* Центральный текст */}
            <text
              x="200"
              y="190"
              textAnchor="middle"
              fill="#c8cfca"
              style={{ fontSize: '14px' }}
            >
              Всего проектов
            </text>
            <text
              x="200"
              y="215"
              textAnchor="middle"
              fill="#fff"
              style={{ fontSize: '32px', fontWeight: 'bold' }}
            >
              {total}
            </text>
          </svg>
        </div>

        {/* Легенда */}
        <div className="flex flex-col gap-2 mt-4">
          <div className="flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#01B574' }} />
              <span style={{ fontSize: '12px', color: '#c8cfca' }}>Завершено</span>
            </div>
            <span style={{ fontSize: '12px', color: '#fff', fontWeight: '600' }}>{completed}</span>
          </div>
          <div className="flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#FFB800' }} />
              <span style={{ fontSize: '12px', color: '#c8cfca' }}>В процессе</span>
            </div>
            <span style={{ fontSize: '12px', color: '#fff', fontWeight: '600' }}>{inProgress}</span>
          </div>
          <div className="flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#7B61FF' }} />
              <span style={{ fontSize: '12px', color: '#c8cfca' }}>В ожидании</span>
            </div>
            <span style={{ fontSize: '12px', color: '#fff', fontWeight: '600' }}>{pending}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProjectsStatusChart;
