import { useEffect, useRef } from 'react';

/**
 * Запускает callback по интервалу, но ТОЛЬКО когда вкладка в фокусе.
 * Когда пользователь сворачивает окно/переключает вкладку — таймер ставится на паузу.
 * Когда возвращается — сразу вызывается callback и таймер запускается заново.
 *
 * Это сильно экономит compute-секунды на бэкенде (нет фоновых опросов в скрытых вкладках).
 *
 * Дополнительно добавлен случайный сдвиг (jitter) старта интервала, чтобы разные
 * опросы (счётчики, уведомления и т.п.) не били в базу строго одновременно и не
 * создавали пиковую нагрузку.
 */
export const useVisiblePolling = (
  callback: () => void | Promise<void>,
  intervalMs: number,
  enabled: boolean = true,
) => {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled || !intervalMs) return;

    let timerId: ReturnType<typeof setInterval> | null = null;
    let jitterId: ReturnType<typeof setTimeout> | null = null;

    const start = () => {
      if (timerId !== null || jitterId !== null) return;
      const jitter = Math.floor(Math.random() * Math.min(30000, intervalMs));
      jitterId = setTimeout(() => {
        jitterId = null;
        timerId = setInterval(() => {
          callbackRef.current();
        }, intervalMs);
      }, jitter);
    };

    const stop = () => {
      if (jitterId !== null) {
        clearTimeout(jitterId);
        jitterId = null;
      }
      if (timerId !== null) {
        clearInterval(timerId);
        timerId = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        callbackRef.current();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === 'visible') {
      start();
    }

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [intervalMs, enabled]);
};

export default useVisiblePolling;