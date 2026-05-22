import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../assets/styles.css';

function OptionsApp() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Options</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">Save ChatGPT History</h1>
        <p className="mt-2 text-sm text-slate-600">Settings shell only. Markdown export preferences will be added later.</p>
      </header>
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Planned settings</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>Include timestamps in Markdown</li>
          <li>Include model names in Markdown</li>
          <li>Include references in Markdown</li>
        </ul>
      </section>
    </main>
  );
}

const root = document.getElementById('root');

if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <OptionsApp />
    </React.StrictMode>,
  );
}
