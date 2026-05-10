import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7h–20h

function StatCard({ icon, label, value, sub, color = 'cyan' }) {
  const colors = {
    cyan:   'bg-[#0d1a2e] text-cyan-400 border-white/10',
    green:  'bg-[#0d1a2e] text-emerald-400 border-white/10',
    amber:  'bg-[#0d1a2e] text-amber-400 border-white/10',
    red:    'bg-[#0d1a2e] text-red-400 border-white/10',
  };
  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${colors[color]}`}>
      <div className="text-2xl mb-2">{icon}</div>
      <p className="text-2xl font-extrabold">{value}</p>
      <p className="font-semibold text-sm mt-0.5 text-slate-300">{label}</p>
      {sub && <p className="text-xs mt-1 text-slate-400">{sub}</p>}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-[#111827] rounded-3xl border border-white/10 p-6 shadow-sm">
      <h2 className="text-lg font-bold text-white mb-5">{title}</h2>
      {children}
    </div>
  );
}

export default function TeacherAnalytics() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const [revenue,    setRevenue]    = useState(null);
  const [engagement, setEngagement] = useState(null);
  const [peakHours,  setPeakHours]  = useState(null);
  const [funnel,     setFunnel]     = useState(null);
  const [invoices,   setInvoices]   = useState(null);

  useEffect(() => {
    Promise.allSettled([
      api.get('/analytics/revenue'),
      api.get('/analytics/engagement'),
      api.get('/analytics/peak-hours'),
      api.get('/analytics/conversion-funnel'),
      api.get('/analytics/invoices-due'),
    ]).then(([r, e, p, f, i]) => {
      if (r.status === 'fulfilled') setRevenue(r.value.data);
      if (e.status === 'fulfilled') setEngagement(e.value.data);
      if (p.status === 'fulfilled') setPeakHours(p.value.data);
      if (f.status === 'fulfilled') setFunnel(f.value.data);
      if (i.status === 'fulfilled') setInvoices(i.value.data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0f1e]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4" />
          <p className="text-slate-400">Chargement des analyses…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0f1e]">
        <div className="text-center">
          <p className="text-red-400 font-semibold">{error}</p>
          <button onClick={() => navigate('/teacher')} className="mt-4 px-4 py-2 bg-gradient-to-r from-cyan-400 to-blue-500 text-white rounded-lg text-sm shadow-sm">
            ← Retour
          </button>
        </div>
      </div>
    );
  }

  const totalSessions = engagement?.bookingStats?.confirmed ?? 0;
  const cancelRate    = engagement?.bookingStats?.cancellationRate ?? 0;
  const avgDuration   = engagement?.averageSessionDuration ?? 0;
  const thisMonth     = revenue?.thisMonth ?? 0;

  // Monthly chart bars
  const monthlyChart = revenue?.monthlyChart ?? [];
  const maxEarnings  = Math.max(...monthlyChart.map(m => parseFloat(m.earnings)), 1);

  // Peak hours heatmap
  const heatmap   = peakHours?.heatmap   ?? Array(7).fill(null).map(() => Array(24).fill(0));
  const maxPeak   = peakHours?.maxBookings ?? 1;

  // Funnel
  const funnelData = funnel?.funnel ?? [];

  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      {/* Header */}
      <header className="bg-[#0d1526] border-b border-white/10 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <button onClick={() => navigate('/teacher')}
            className="p-2 hover:bg-white/10 rounded-xl transition text-slate-400 hover:text-white font-bold text-lg">
            ←
          </button>
          <div>
            <h1 className="font-bold text-white">Tableau de Bord Analytique</h1>
            <p className="text-xs text-slate-400">Vue d'ensemble de votre activité</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ── KPI Row ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon="💶" label="Ce mois-ci" value={`${parseFloat(thisMonth).toFixed(0)}€`} color="green" />
          <StatCard icon="📅" label="Séances confirmées" value={totalSessions} color="cyan" />
          <StatCard icon="⏱" label="Durée moyenne" value={avgDuration ? `${avgDuration} min` : '—'} color="amber" />
          <StatCard icon="❌" label="Taux d'annulation" value={`${cancelRate}%`} color={cancelRate > 20 ? 'red' : 'cyan'} />
        </div>

        {/* ── Revenue & Monthly Chart ──────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Monthly Earnings Bar Chart */}
          <Section title="📈 Revenus Mensuels (12 mois)">
            {monthlyChart.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">Aucune donnée disponible</p>
            ) : (
              <div className="flex items-end gap-1 h-40">
                {[...monthlyChart].reverse().map((m, i) => {
                  const pct = (parseFloat(m.earnings) / maxEarnings) * 100;
                  const date = new Date(m.month);
                  const label = date.toLocaleDateString('fr-FR', { month: 'short' });
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap transition">
                        {parseFloat(m.earnings).toFixed(0)}€
                      </div>
                      <div
                        className="w-full bg-cyan-400 rounded-t-sm transition-all hover:bg-cyan-500"
                        style={{ height: `${Math.max(pct, 2)}%` }}
                      />
                      <span className="text-xs text-slate-400">{label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {/* Per-Student Breakdown */}
          <Section title="🏆 Top Élèves (par revenus estimés)">
            {(revenue?.studentBreakdown ?? []).length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">Aucune donnée</p>
            ) : (
              <div className="space-y-3">
                {(revenue.studentBreakdown ?? []).slice(0, 5).map((s) => (
                  <div key={s.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-cyan-400/10 rounded-full flex items-center justify-center text-cyan-400 font-bold text-xs shrink-0">
                      {s.first_name?.[0]}{s.last_name?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-white truncate">
                        {s.first_name} {s.last_name}
                      </p>
                      <p className="text-xs text-slate-400">{s.sessions} séance{s.sessions > 1 ? 's' : ''}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-emerald-400 text-sm">{parseFloat(s.estimated_earnings).toFixed(0)}€</p>
                      {parseFloat(s.avg_rating) > 0 && (
                        <p className="text-xs text-amber-400">{'★'.repeat(Math.round(s.avg_rating))}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* ── Engagement ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Most Active */}
          <Section title="🔥 Élèves les plus actifs">
            {(engagement?.mostActiveStudents ?? []).length === 0 ? (
              <p className="text-slate-400 text-sm">Aucune donnée</p>
            ) : (
              <div className="space-y-2">
                {engagement.mostActiveStudents.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 w-4">{i + 1}</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">{s.first_name} {s.last_name}</p>
                    </div>
                    <span className="text-xs font-bold text-cyan-400">{s.bookings} séances</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Inactive */}
          <Section title="💤 Élèves inactifs (+30 jours)">
            {(engagement?.inactiveStudents ?? []).length === 0 ? (
              <p className="text-slate-400 text-sm">Tous vos élèves sont actifs 🎉</p>
            ) : (
              <div className="space-y-2">
                {engagement.inactiveStudents.map((s) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-amber-400 rounded-full shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{s.first_name} {s.last_name}</p>
                      <p className="text-xs text-slate-400">
                        {s.last_booking
                          ? `Dernière séance: ${new Date(s.last_booking).toLocaleDateString('fr-FR')}`
                          : 'Jamais réservé'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Booking Stats */}
          <Section title="📊 Statistiques Réservations">
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-300">Confirmées</span>
                  <span className="font-bold text-emerald-400">{engagement?.bookingStats?.confirmed ?? 0}</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div className="bg-emerald-500 h-2 rounded-full"
                    style={{ width: `${Math.min(100, ((engagement?.bookingStats?.confirmed ?? 0) / Math.max(1, (engagement?.bookingStats?.confirmed ?? 0) + (engagement?.bookingStats?.canceled ?? 0))) * 100)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-300">Annulées</span>
                  <span className="font-bold text-red-400">{engagement?.bookingStats?.canceled ?? 0}</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div className="bg-red-400 h-2 rounded-full"
                    style={{ width: `${engagement?.bookingStats?.cancellationRate ?? 0}%` }} />
                </div>
              </div>
              <div className="pt-2 border-t border-white/5">
                <p className="text-xs text-slate-400">Durée moy. de séance</p>
                <p className="text-xl font-bold text-cyan-400">{avgDuration} min</p>
              </div>
            </div>
          </Section>
        </div>

        {/* ── Peak Hours Heatmap ──────────────────────────────── */}
        <Section title="🕐 Heures de Pointe (créneaux réservés)">
          {maxPeak === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">Aucune séance enregistrée</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-max">
                {/* Hour labels */}
                <div className="flex gap-1 mb-1 pl-10">
                  {HOURS.map(h => (
                    <div key={h} className="w-8 text-center text-xs text-slate-400">{h}h</div>
                  ))}
                </div>
                {DAYS.map((day, dayIdx) => (
                  <div key={dayIdx} className="flex items-center gap-1 mb-1">
                    <div className="w-8 text-xs font-medium text-slate-400 text-right pr-2">{day}</div>
                    {HOURS.map(h => {
                      const count = heatmap[dayIdx]?.[h] ?? 0;
                      const intensity = count === 0 ? 0 : Math.ceil((count / maxPeak) * 4);
                      const bgMap = ['bg-white/5', 'bg-cyan-100', 'bg-cyan-200', 'bg-cyan-400', 'bg-cyan-500'];
                      return (
                        <div key={h} title={`${day} ${h}h: ${count} séance${count > 1 ? 's' : ''}`}
                          className={`w-8 h-7 rounded ${bgMap[intensity]} transition-colors cursor-default`} />
                      );
                    })}
                  </div>
                ))}
                {/* Legend */}
                <div className="flex items-center gap-2 mt-3 pl-10">
                  <span className="text-xs text-slate-400">Moins</span>
                  {['bg-white/5','bg-cyan-100','bg-cyan-200','bg-cyan-400','bg-cyan-500'].map((c, i) => (
                    <div key={i} className={`w-6 h-4 rounded ${c}`} />
                  ))}
                  <span className="text-xs text-slate-400">Plus</span>
                </div>
              </div>
            </div>
          )}
          {(peakHours?.peakHours ?? []).length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {peakHours.peakHours.map((p, i) => (
                <span key={i} className="px-3 py-1 bg-cyan-400/10 text-cyan-400 rounded-full text-xs font-semibold">
                  🏆 {p.day} {p.hour} ({p.bookings} réservations)
                </span>
              ))}
            </div>
          )}
        </Section>

        {/* ── Conversion Funnel ──────────────────────────────── */}
        <Section title="🔀 Entonnoir de Conversion">
          {funnelData.length === 0 ? (
            <p className="text-slate-400 text-sm">Aucune donnée</p>
          ) : (
            <div className="space-y-3">
              {funnelData.map((stage, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300 font-medium">{stage.stage}</span>
                    <span className="font-bold text-white">{stage.count} <span className="text-slate-400 font-normal">({stage.percentage}%)</span></span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-3">
                    <div
                      className="h-3 rounded-full transition-all"
                      style={{
                        width: `${stage.percentage}%`,
                        background: `hsl(${240 - i * 40}, 70%, ${55 + i * 5}%)`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ── Invoices Due ───────────────────────────────────── */}
        {invoices?.count > 0 && (
          <div className="bg-red-950/50 border border-red-500/30 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">⚠️</span>
              <div>
                <h2 className="font-bold text-red-300">Factures en Retard</h2>
                <p className="text-sm text-red-400">{invoices.count} facture{invoices.count > 1 ? 's' : ''} — Total: {parseFloat(invoices.totalOverdue).toFixed(2)}€</p>
              </div>
            </div>
            <div className="space-y-2">
              {(invoices.invoices ?? []).slice(0, 5).map((inv) => (
                <div key={inv.id} className="flex justify-between items-center bg-[#111827] rounded-xl px-4 py-3 border border-white/10">
                  <div>
                    <p className="font-semibold text-white text-sm">{inv.first_name} {inv.last_name}</p>
                    <p className="text-xs text-slate-400">{inv.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-red-400">{parseFloat(inv.amount).toFixed(2)}€</p>
                    <p className="text-xs text-slate-400">Échu le {new Date(inv.due_at).toLocaleDateString('fr-FR')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
