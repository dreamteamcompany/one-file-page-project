const MSK_TIMEZONE = 'Europe/Moscow';

const parseAsUtc = (input?: string | number | Date | null): Date | null => {
  if (input === null || input === undefined || input === '') return null;
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }
  if (typeof input === 'number') {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }
  let s = String(input).trim();
  if (!s) return null;

  const hasTz = /(Z|[+-]\d{2}:?\d{2})$/i.test(s);
  if (!hasTz) {
    s = s.replace(' ', 'T') + 'Z';
  } else if (s.includes(' ') && !s.includes('T')) {
    s = s.replace(' ', 'T');
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

export const parseServerDate = (input?: string | number | Date | null): Date | null => parseAsUtc(input);

export const formatDateMSK = (input?: string | number | Date | null, withYear = false): string => {
  const d = parseAsUtc(input);
  if (!d) return '';
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    ...(withYear ? { year: 'numeric' } : {}),
    hour: '2-digit',
    minute: '2-digit',
    timeZone: MSK_TIMEZONE,
  });
};

export const formatDateTimeMSK = (input?: string | number | Date | null): string => {
  const d = parseAsUtc(input);
  if (!d) return '';
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: MSK_TIMEZONE,
  });
};

export const formatDateOnlyMSK = (input?: string | number | Date | null, opts?: { longMonth?: boolean; withYear?: boolean }): string => {
  const d = parseAsUtc(input);
  if (!d) return '';
  return d.toLocaleDateString('ru-RU', {
    day: opts?.longMonth ? 'numeric' : '2-digit',
    month: opts?.longMonth ? 'long' : '2-digit',
    ...(opts?.withYear ?? true ? { year: 'numeric' } : {}),
    timeZone: MSK_TIMEZONE,
  });
};

export const formatTimeMSK = (input?: string | number | Date | null): string => {
  const d = parseAsUtc(input);
  if (!d) return '';
  return d.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: MSK_TIMEZONE,
  });
};

export const getMskHourMinute = (input?: string | number | Date | null): { hour: string; minute: string } => {
  const d = parseAsUtc(input);
  if (!d) return { hour: '00', minute: '00' };
  const parts = new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: MSK_TIMEZONE,
  }).formatToParts(d);
  return {
    hour: parts.find((p) => p.type === 'hour')?.value || '00',
    minute: parts.find((p) => p.type === 'minute')?.value || '00',
  };
};

export const getMskDateParts = (
  input?: string | number | Date | null,
): { year: number; month: number; day: number; hour: number; minute: number } => {
  const d = parseAsUtc(input) ?? new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: MSK_TIMEZONE,
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value || '0');
  const hour = get('hour');
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: hour === 24 ? 0 : hour,
    minute: get('minute'),
  };
};

export const mskPartsToUtcIso = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): string => {
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const probe = new Date(asUtc);
  const parts = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: MSK_TIMEZONE,
  }).formatToParts(probe);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value || '0');
  const shownHour = get('hour') === 24 ? 0 : get('hour');
  const shownUtc = Date.UTC(get('year'), get('month') - 1, get('day'), shownHour, get('minute'), 0, 0);
  const offsetMs = shownUtc - asUtc;
  return new Date(asUtc - offsetMs).toISOString();
};

export const getMskTimestamp = (input?: string | number | Date | null): number => {
  const d = parseAsUtc(input);
  return d ? d.getTime() : 0;
};

export type DeadlineSeverity = {
  color: string;
  label: string;
  percent: number;
  urgent: boolean;
  overdue: boolean;
};

const COLOR_RED = '#ef4444';
const COLOR_ORANGE = '#f97316';
const COLOR_GREEN = '#22c55e';

export const getDeadlineSeverity = (dueDate?: string | null): DeadlineSeverity | null => {
  if (!dueDate) return null;
  const due = getMskTimestamp(dueDate);
  if (!due) return null;

  const now = Date.now();
  const timeLeft = due - now;

  if (timeLeft < 0) {
    return { color: COLOR_RED, label: 'Просрочена', percent: 100, urgent: true, overdue: true };
  }

  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * oneHour;
  const threeHours = 3 * oneHour;
  const twoDays = 2 * oneDay;

  const daysLeft = Math.floor(timeLeft / oneDay);
  const hoursLeft = Math.floor((timeLeft % oneDay) / oneHour);

  if (timeLeft < threeHours) {
    return {
      color: COLOR_RED,
      label: `Менее 3 часов (${hoursLeft} ч)`,
      percent: 100,
      urgent: true,
      overdue: false,
    };
  }

  if (timeLeft < twoDays) {
    const label = daysLeft === 0
      ? `Менее суток (${hoursLeft} ч)`
      : `Остался ${daysLeft} день ${hoursLeft} ч`;
    return {
      color: COLOR_ORANGE,
      label,
      percent: 80,
      urgent: true,
      overdue: false,
    };
  }

  const dayWord = daysLeft >= 2 && daysLeft <= 4 ? 'дня' : 'дней';
  return {
    color: COLOR_GREEN,
    label: `Осталось ${daysLeft} ${dayWord} ${hoursLeft} ч`,
    percent: 30,
    urgent: false,
    overdue: false,
  };
};

export const getDeadlineLeftLabel = (dueDate?: string | null): string => {
  if (!dueDate) return '';
  const due = getMskTimestamp(dueDate);
  if (!due) return '';
  const timeLeft = due - Date.now();
  if (timeLeft < 0) return 'Просрочено';
  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * oneHour;
  const daysLeft = Math.floor(timeLeft / oneDay);
  const hoursLeft = Math.floor((timeLeft % oneDay) / oneHour);
  if (daysLeft === 0) return `Осталось: ${hoursLeft} ч`;
  return `Осталось: ${daysLeft} д ${hoursLeft} ч`;
};