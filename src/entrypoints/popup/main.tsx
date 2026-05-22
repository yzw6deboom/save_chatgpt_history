import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../assets/styles.css';

function PopupApp() {
  return (
    <main className="w-80 space-y-4 p-4">
      <section>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Save ChatGPT History</p>
        <h1 className="mt-1 text-lg font-semibold text-slate-950">Markdown Exporter</h1>
        <p className="mt-2 text-sm text-slate-600">Framework scaffold is ready. Business features will be added in the next milestone.</p>
      </section>
      <button
        type="button"
        className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
        onClick={() => chrome.sidePanel?.open?.({ windowId: chrome.windows.WINDOW_ID_CURRENT })}
      >
        Open Side Panel
      </button>
    </main>
  );
}

const root = document.getElementById('root');

if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <PopupApp />
    </React.StrictMode>,
  );
}
