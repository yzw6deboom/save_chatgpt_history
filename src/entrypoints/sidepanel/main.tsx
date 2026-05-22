import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../assets/styles.css';

function SidePanelApp() {
  return (
    <main className="min-h-screen space-y-6 p-5">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Save ChatGPT History</p>
        <h1 className="text-2xl font-semibold text-slate-950">ChatGPT to Markdown</h1>
        <p className="text-sm text-slate-600">This is the Side Panel shell. JSON import, preview, and Markdown export will be implemented later.</p>
      </header>
      <section className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-medium text-slate-700">Raw JSON import area placeholder</p>
        <p className="mt-2 text-xs text-slate-500">No business logic is wired yet.</p>
      </section>
    </main>
  );
}

const root = document.getElementById('root');

if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <SidePanelApp />
    </React.StrictMode>,
  );
}
