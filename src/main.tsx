import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

document.addEventListener(
  'keydown',
  (e) => {
    if (e.key !== 'Enter' || e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const tag = target.tagName;
    if (tag === 'TEXTAREA' || target.isContentEditable) return;
    if (tag === 'BUTTON' || (tag === 'INPUT' && (target as HTMLInputElement).type === 'submit')) return;
    if (target.closest('form')) {
      e.preventDefault();
    }
  },
  true
);

const RELOAD_KEY = 'chunk-reload-at';

const reloadOnStaleChunk = async () => {
  const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
  if (Date.now() - last < 15000) return;
  sessionStorage.setItem(RELOAD_KEY, String(Date.now()));

  // Старые файлы могли осесть в кеше — чистим, иначе перезагрузка не поможет.
  try {
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
  } catch {
    /* кеш недоступен — просто перезагружаемся */
  }

  window.location.reload();
};

const isChunkError = (msg: string) =>
  /dynamically imported module|Importing a module script failed|Failed to fetch dynamically/i.test(
    msg
  );

window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault();
  reloadOnStaleChunk();
});

window.addEventListener('error', (e) => {
  if (isChunkError(String(e.message || ''))) reloadOnStaleChunk();
});

window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason;
  const msg = reason instanceof Error ? reason.message : String(reason ?? '');
  if (isChunkError(msg)) reloadOnStaleChunk();
});

createRoot(document.getElementById("root")!).render(
  <App />
);