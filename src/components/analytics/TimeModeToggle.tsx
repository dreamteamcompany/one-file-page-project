export type TimeMode = 'calendar' | 'work';

interface TimeModeToggleProps {
  value: TimeMode;
  onChange: (mode: TimeMode) => void;
}

const OPTIONS: Array<{ key: TimeMode; label: string; title: string }> = [
  {
    key: 'calendar',
    label: 'Календарное',
    title: 'Все часы подряд, включая ночи и выходные — так время видит пользователь',
  },
  {
    key: 'work',
    label: 'Рабочее',
    title: 'Только рабочие часы исполнителя, без ночей и выходных',
  },
];

const TimeModeToggle = ({ value, onChange }: TimeModeToggleProps) => (
  <div className="inline-flex p-0.5 rounded-lg bg-muted">
    {OPTIONS.map((o) => (
      <button
        key={o.key}
        type="button"
        onClick={() => onChange(o.key)}
        title={o.title}
        className={`px-3 py-1 text-xs rounded-md transition-colors ${
          value === o.key
            ? 'bg-background shadow-sm font-medium'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

export default TimeModeToggle;
