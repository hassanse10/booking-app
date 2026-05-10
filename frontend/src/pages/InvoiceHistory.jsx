import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

const STATUS_LABELS = {
  draft:     { label: 'Brouillon',  color: 'bg-slate-700 text-slate-300' },
  sent:      { label: 'Envoyée',    color: 'bg-blue-900/50 text-blue-400' },
  paid:      { label: 'Payée',      color: 'bg-emerald-900/50 text-emerald-400' },
  overdue:   { label: 'En retard',  color: 'bg-red-900/50 text-red-400' },
  cancelled: { label: 'Annulée',    color: 'bg-slate-700 text-slate-300' },
};

function StatusBadge({ status }) {
  const s = STATUS_LABELS[status] ?? { label: status, color: 'bg-slate-700 text-slate-300' };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.color}`}>
      {s.label}
    </span>
  );
}

export default function InvoiceHistory() {
  const navigate       = useNavigate();
  const [invoices, setInvoices]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState('all');
  const [error, setError]         = useState('');

  useEffect(() => {
    api.get('/invoices')
      .then(({ data }) => { setInvoices(data); setLoading(false); })
      .catch(() => { setError('Impossible de charger les factures'); setLoading(false); });
  }, []);

  const filtered = filter === 'all'
    ? invoices
    : invoices.filter(inv => inv.status === filter);

  const totalPaid = invoices
    .filter(inv => inv.status === 'paid')
    .reduce((s, inv) => s + parseFloat(inv.amount), 0);

  const totalDue = invoices
    .filter(inv => ['sent', 'overdue'].includes(inv.status))
    .reduce((s, inv) => s + parseFloat(inv.amount), 0);

  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      {/* Header */}
      <header className="bg-[#0d1526] border-b border-white/10 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-white/10 rounded-xl transition text-slate-400 hover:text-white font-bold text-lg">
            ←
          </button>
          <div>
            <h1 className="font-bold text-white">Mes Factures</h1>
            <p className="text-xs text-slate-400">Historique des paiements</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-emerald-900/30 border border-emerald-500/20 rounded-2xl p-5">
            <p className="text-2xl font-extrabold text-emerald-400">{totalPaid.toFixed(2)}€</p>
            <p className="text-sm font-medium text-emerald-400 mt-1">Total payé</p>
          </div>
          <div className={`border rounded-2xl p-5 ${totalDue > 0 ? 'bg-amber-900/30 border-amber-500/20' : 'bg-[#111827] border-white/10'}`}>
            <p className={`text-2xl font-extrabold ${totalDue > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
              {totalDue.toFixed(2)}€
            </p>
            <p className={`text-sm font-medium mt-1 ${totalDue > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
              En attente
            </p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {['all', 'paid', 'sent', 'overdue', 'draft'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs rounded-lg font-semibold border transition ${
                filter === f
                  ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-white border-transparent'
                  : 'bg-[#0d1a2e] border-white/10 text-slate-400 hover:bg-white/5'
              }`}>
              {f === 'all' ? 'Toutes' : STATUS_LABELS[f]?.label ?? f}
              {f !== 'all' && (
                <span className="ml-1 opacity-60">
                  ({invoices.filter(i => i.status === f).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Invoice list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" />
          </div>
        ) : error ? (
          <div className="bg-red-950/50 border border-red-500/30 rounded-2xl p-6 text-red-300 text-center">
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-[#111827] rounded-2xl border border-white/10 p-12 text-center">
            <p className="text-5xl mb-3">🧾</p>
            <p className="text-slate-400 font-semibold">Aucune facture trouvée</p>
            {filter !== 'all' && (
              <button onClick={() => setFilter('all')}
                className="mt-3 text-cyan-400 text-sm font-medium hover:underline">
                Voir toutes les factures
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(inv => (
              <div key={inv.id}
                className="bg-[#111827] rounded-2xl border border-white/10 p-5 hover:bg-[#1a2235] transition">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <StatusBadge status={inv.status} />
                      <span className="text-xs text-slate-400">#{String(inv.id).padStart(4, '0')}</span>
                    </div>
                    <p className="font-semibold text-white">
                      {inv.description || 'Séance de cours'}
                    </p>
                    <p className="text-sm text-slate-400 mt-0.5">
                      Émise le {fmtDate(inv.issued_at)}
                    </p>
                    {inv.due_at && inv.status !== 'paid' && (
                      <p className={`text-xs mt-0.5 font-medium ${
                        new Date(inv.due_at) < new Date() ? 'text-red-400' : 'text-slate-400'
                      }`}>
                        Échéance: {fmtDate(inv.due_at)}
                      </p>
                    )}
                    {inv.paid_at && (
                      <p className="text-xs text-emerald-400 font-medium mt-0.5">
                        ✅ Payée le {fmtDate(inv.paid_at)}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xl font-extrabold text-white">
                      {parseFloat(inv.amount).toFixed(2)}€
                    </p>
                    {inv.payment_method && (
                      <p className="text-xs text-slate-400 mt-0.5">{inv.payment_method}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info box if empty overall */}
        {!loading && !error && invoices.length === 0 && (
          <div className="bg-cyan-400/10 border border-white/10 rounded-2xl p-5">
            <p className="text-sm text-cyan-400">
              💡 Les factures sont générées par votre professeur après chaque séance.
              Elles apparaîtront ici une fois émises.
            </p>
          </div>
        )}

      </main>
    </div>
  );
}
