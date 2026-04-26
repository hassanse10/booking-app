import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

const STATUS_LABELS = {
  draft:     { label: 'Brouillon',  color: 'bg-gray-100 text-gray-600' },
  sent:      { label: 'Envoyée',    color: 'bg-blue-100 text-blue-700' },
  paid:      { label: 'Payée',      color: 'bg-emerald-100 text-emerald-700' },
  overdue:   { label: 'En retard',  color: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Annulée',    color: 'bg-gray-100 text-gray-400' },
};

function StatusBadge({ status }) {
  const s = STATUS_LABELS[status] ?? { label: status, color: 'bg-gray-100 text-gray-600' };
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-gray-100 rounded-xl transition text-gray-500 font-bold text-lg">
            ←
          </button>
          <div>
            <h1 className="font-bold text-gray-900">Mes Factures</h1>
            <p className="text-xs text-gray-500">Historique des paiements</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5">
            <p className="text-2xl font-extrabold text-emerald-700">{totalPaid.toFixed(2)}€</p>
            <p className="text-sm font-medium text-emerald-600 mt-1">Total payé</p>
          </div>
          <div className={`border rounded-2xl p-5 ${totalDue > 0 ? 'bg-amber-50 border-amber-100' : 'bg-gray-50 border-gray-100'}`}>
            <p className={`text-2xl font-extrabold ${totalDue > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
              {totalDue.toFixed(2)}€
            </p>
            <p className={`text-sm font-medium mt-1 ${totalDue > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
              En attente
            </p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {['all', 'paid', 'sent', 'overdue', 'draft'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs rounded-lg font-semibold border-2 transition ${
                filter === f
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-gray-200 text-gray-600 hover:border-indigo-300 bg-white'
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
            <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-800 text-center">
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <p className="text-5xl mb-3">🧾</p>
            <p className="text-gray-500 font-semibold">Aucune facture trouvée</p>
            {filter !== 'all' && (
              <button onClick={() => setFilter('all')}
                className="mt-3 text-indigo-600 text-sm font-medium hover:underline">
                Voir toutes les factures
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(inv => (
              <div key={inv.id}
                className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-sm transition">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <StatusBadge status={inv.status} />
                      <span className="text-xs text-gray-400">#{String(inv.id).padStart(4, '0')}</span>
                    </div>
                    <p className="font-semibold text-gray-800">
                      {inv.description || 'Séance de cours'}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Émise le {fmtDate(inv.issued_at)}
                    </p>
                    {inv.due_at && inv.status !== 'paid' && (
                      <p className={`text-xs mt-0.5 font-medium ${
                        new Date(inv.due_at) < new Date() ? 'text-red-500' : 'text-gray-400'
                      }`}>
                        Échéance: {fmtDate(inv.due_at)}
                      </p>
                    )}
                    {inv.paid_at && (
                      <p className="text-xs text-emerald-600 font-medium mt-0.5">
                        ✅ Payée le {fmtDate(inv.paid_at)}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xl font-extrabold text-gray-800">
                      {parseFloat(inv.amount).toFixed(2)}€
                    </p>
                    {inv.payment_method && (
                      <p className="text-xs text-gray-400 mt-0.5">{inv.payment_method}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info box if empty overall */}
        {!loading && !error && invoices.length === 0 && (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
            <p className="text-sm text-blue-800">
              💡 Les factures sont générées par votre professeur après chaque séance.
              Elles apparaîtront ici une fois émises.
            </p>
          </div>
        )}

      </main>
    </div>
  );
}
