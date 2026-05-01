import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const fmtDate = (d) => {
  const s = typeof d === 'string' && d.includes('T') ? d.split('T')[0] : d;
  return new Date(s + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
};

const durLabel = (v) => {
  const map = { 60: '1h', 90: '1h 30min', 120: '2h' };
  return map[v] ?? `${v} min`;
};

function MilestoneCard({ icon, text }) {
  return (
    <div className="flex items-center gap-3 bg-cyan-50 border border-cyan-100 rounded-xl px-4 py-3">
      <span className="text-2xl">{icon}</span>
      <span className="font-semibold text-cyan-800 text-sm">{text}</span>
    </div>
  );
}

function StatPill({ label, value, color = 'indigo' }) {
  const colors = {
    indigo: 'bg-cyan-100 text-cyan-700',
    green:  'bg-emerald-100 text-emerald-700',
    amber:  'bg-amber-100 text-amber-700',
  };
  return (
    <div className={`rounded-2xl px-5 py-4 text-center ${colors[color]}`}>
      <p className="text-2xl font-extrabold">{value}</p>
      <p className="text-xs font-medium mt-0.5 opacity-80">{label}</p>
    </div>
  );
}

export default function StudentProgress() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    api.get(`/analytics/student-progress/${user.id}`)
      .then(({ data }) => { setData(data); setLoading(false); })
      .catch(() => { setError('Impossible de charger la progression'); setLoading(false); });
  }, [user.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-cyan-50 to-blue-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-cyan-50 to-blue-50">
        <div className="text-center">
          <p className="text-red-600 font-semibold mb-4">{error}</p>
          <button onClick={() => navigate('/dashboard')} className="px-4 py-2 bg-gradient-to-r from-cyan-400 to-blue-500 text-white rounded-lg text-sm">
            ← Retour
          </button>
        </div>
      </div>
    );
  }

  const { stats, sessions, milestones } = data;
  const nextMilestone = stats.sessionsAttended < 5
    ? { target: 5, current: stats.sessionsAttended, label: '5 séances' }
    : stats.sessionsAttended < 10
    ? { target: 10, current: stats.sessionsAttended, label: '10 séances' }
    : stats.totalHours < 10
    ? { target: 10, current: stats.totalHours, label: '10 heures' }
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-slate-100 rounded-xl transition text-slate-500 font-bold text-lg">
            ←
          </button>
          <div>
            <h1 className="font-bold text-slate-900">Ma Progression</h1>
            <p className="text-xs text-slate-500">{user.first_name} {user.last_name} · {user.study_level}</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ── Stats ─────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          <StatPill label="Séances" value={stats.sessionsAttended} color="indigo" />
          <StatPill label="Heures" value={`${stats.totalHours}h`} color="green" />
          <StatPill label="Note moy." value={stats.averageRating > 0 ? stats.averageRating.toFixed(1) + '★' : '—'} color="amber" />
        </div>

        {/* ── Next Milestone ─────────────────────────────────── */}
        {nextMilestone && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-sm font-semibold text-slate-600 mb-3">
              Prochain objectif: <span className="text-cyan-600">{nextMilestone.label}</span>
            </p>
            <div className="w-full bg-slate-100 rounded-full h-3 mb-2">
              <div
                className="bg-cyan-500 h-3 rounded-full transition-all"
                style={{ width: `${Math.min(100, (nextMilestone.current / nextMilestone.target) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 text-right">
              {nextMilestone.current} / {nextMilestone.target}
            </p>
          </div>
        )}

        {/* ── Milestones ─────────────────────────────────────── */}
        {milestones.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4">🏅 Succès débloqués</h2>
            <div className="space-y-2">
              {milestones.map((m, i) => (
                <MilestoneCard key={i} icon={m.icon} text={m.milestone} />
              ))}
            </div>
          </div>
        )}

        {/* ── Session Timeline ───────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-5">📋 Historique des Séances</h2>

          {sessions.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-5xl mb-3">📚</p>
              <p className="text-slate-500 font-semibold">Aucune séance pour le moment</p>
              <button onClick={() => navigate('/dashboard')}
                className="mt-4 px-5 py-2 bg-gradient-to-r from-cyan-400 to-blue-500 text-white rounded-xl text-sm font-semibold hover:from-cyan-500 hover:to-blue-600 transition">
                Réserver une séance
              </button>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-cyan-100" />

              <div className="space-y-6 pl-10">
                {sessions.map((s, i) => (
                  <div key={s.id} className="relative">
                    {/* Dot */}
                    <div className="absolute -left-[2.15rem] top-1 w-4 h-4 rounded-full border-2 border-cyan-400 bg-white" />

                    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="font-bold text-slate-900 capitalize text-sm">{fmtDate(s.date)}</p>
                          <p className="text-xs text-slate-500">{durLabel(s.duration)}</p>
                        </div>
                        {s.student_rating && (
                          <span className="text-amber-500 text-sm shrink-0">
                            {'★'.repeat(s.student_rating)}{'☆'.repeat(5 - s.student_rating)}
                          </span>
                        )}
                      </div>

                      {s.topics_covered && (
                        <div className="mt-2 pt-2 border-t border-slate-200">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Sujets abordés</p>
                          <p className="text-sm text-slate-700">{s.topics_covered}</p>
                        </div>
                      )}
                      {s.homework_assigned && (
                        <div className="mt-2">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Devoir</p>
                          <p className="text-sm text-slate-700">{s.homework_assigned}</p>
                        </div>
                      )}
                      {s.next_focus_areas && (
                        <div className="mt-2">
                          <p className="text-xs font-semibold text-cyan-500 uppercase tracking-wide mb-1">Prochaine séance</p>
                          <p className="text-sm text-cyan-700 font-medium">{s.next_focus_areas}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
