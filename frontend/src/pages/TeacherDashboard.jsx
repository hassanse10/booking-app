import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import SessionNotesModal from '../components/SessionNotesModal';

// ── Constants ─────────────────────────────────────────────────────────────────
const DAYS       = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
const DAYS_SHORT = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
const MONTHS     = ['Janvier','Février','Mars','Avril','Mai','Juin',
                    'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const DURATIONS  = [
  { value: 60,  label: '1h',       price: 15 },
  { value: 90,  label: '1h 30min', price: 18 },
  { value: 120, label: '2h',       price: 25 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const getDuration = (v) => DURATIONS.find((d) => d.value === parseInt(v));
const durLabel  = (v) => getDuration(v)?.label ?? `${v} min`;
const durPrice  = (v) => getDuration(v)?.price ?? '?';

const fmtDate = (d) => {
  const s = typeof d === 'string' && d.includes('T') ? d.split('T')[0] : d;
  return new Date(s + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
};
const fmtDateLong = (d) => {
  const s = typeof d === 'string' && d.includes('T') ? d.split('T')[0] : d;
  return new Date(s + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
};
const fmtTime = (t) => {
  const [h, m] = t.substring(0, 5).split(':').map(Number);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
};

// ── Status dot ────────────────────────────────────────────────────────────────
function StatusDot({ status }) {
  const map    = { confirmed: 'bg-emerald-400', canceled: 'bg-red-400' };
  const labels = { confirmed: 'Confirmé', canceled: 'Annulé' };
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full inline-block ${map[status] ?? 'bg-gray-400'}`} />
      <span className="text-xs font-medium text-slate-400">{labels[status] ?? status}</span>
    </span>
  );
}

// ── WeekCalendar ─────────────────────────────────────────────────────────────
function WeekCalendar({ bookings, onNotesClick }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i); return d;
  });

  const toDateStr = (d) => d.toISOString().split('T')[0];
  const todayStr  = toDateStr(today);
  const HOURS     = Array.from({ length: 15 }, (_, i) => i + 7);

  const byDate = {};
  bookings.filter(b => b.status !== 'canceled').forEach(b => {
    const ds = typeof b.date === 'string' && b.date.includes('T') ? b.date.split('T')[0] : b.date;
    if (!byDate[ds]) byDate[ds] = [];
    byDate[ds].push(b);
  });

  const TOTAL_MINS = 15 * 60;
  const CELL_H     = 480;

  const timeToY = (timeStr) => {
    const [h, m] = timeStr.substring(0, 5).split(':').map(Number);
    return ((h - 7) * 60 + m);
  };

  const durColor = (dur) => ({
    60:  'bg-cyan-400 hover:bg-cyan-500',
    90:  'bg-cyan-500 hover:bg-cyan-600',
    120: 'bg-blue-500 hover:bg-blue-600',
  })[dur] || 'bg-slate-500';

  const monthLabel = monday.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-bold text-white capitalize">{monthLabel}</h2>
          <p className="text-xs text-slate-400">Vue hebdomadaire</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset(0)}
            className="px-3 py-1.5 text-xs border border-white/10 bg-[#111827] rounded-lg hover:bg-white/5 font-medium text-slate-300 transition shadow-sm">
            Aujourd'hui
          </button>
          <button onClick={() => setWeekOffset(w => w - 1)}
            className="w-8 h-8 flex items-center justify-center border border-white/10 bg-[#111827] rounded-lg hover:bg-white/5 text-slate-300 font-bold transition shadow-sm">‹</button>
          <button onClick={() => setWeekOffset(w => w + 1)}
            className="w-8 h-8 flex items-center justify-center border border-white/10 bg-[#111827] rounded-lg hover:bg-white/5 text-slate-300 font-bold transition shadow-sm">›</button>
        </div>
      </div>

      <div className="flex gap-3 mb-4 text-xs text-slate-400">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-cyan-400 inline-block" /> 1h (15€)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-cyan-500 inline-block" /> 1h30 (18€)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500 inline-block" /> 2h (25€)</span>
      </div>

      <div className="overflow-x-auto rounded-3xl bg-[#111827] shadow-sm">
        <div className="min-w-[700px]">
          <div className="grid grid-cols-8 border-b border-white/10">
            <div className="p-2" />
            {days.map((d, i) => {
              const ds  = toDateStr(d);
              const cnt = (byDate[ds] || []).length;
              return (
                <div key={i} className={`p-3 text-center border-l border-white/10 ${ds === todayStr ? 'bg-cyan-400/10' : ''}`}>
                  <p className="text-xs text-slate-400 font-medium">
                    {d.toLocaleDateString('fr-FR', { weekday: 'short' }).toUpperCase()}
                  </p>
                  <p className={`text-lg font-bold ${ds === todayStr ? 'text-cyan-400' : 'text-white'}`}>
                    {d.getDate()}
                  </p>
                  {cnt > 0 && (
                    <span className="text-xs bg-cyan-400/10 text-cyan-400 rounded-full px-2 font-semibold">{cnt}</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-8" style={{ height: `${CELL_H}px` }}>
            <div className="relative border-r border-white/10">
              {HOURS.map(h => (
                <div key={h} className="absolute w-full text-right pr-2 text-xs text-slate-500 font-medium"
                  style={{ top: `${((h - 7) / 15) * 100}%` }}>{h}h</div>
              ))}
            </div>
            {days.map((d, di) => {
              const ds       = toDateStr(d);
              const dayBooks = byDate[ds] || [];
              const isToday  = ds === todayStr;
              return (
                <div key={di} className={`relative border-l border-white/10 ${isToday ? 'bg-cyan-400/10' : ''}`}>
                  {HOURS.map(h => (
                    <div key={h} className="absolute w-full border-t border-white/5"
                      style={{ top: `${((h - 7) / 15) * 100}%` }} />
                  ))}
                  {dayBooks.map(b => {
                    const startMins = timeToY(b.start_time);
                    const topPct    = (startMins / TOTAL_MINS) * 100;
                    const heightPct = (b.duration / TOTAL_MINS) * 100;
                    const price     = ({ 60: 15, 90: 18, 120: 25 })[b.duration] || '?';
                    return (
                      <button key={b.id} onClick={() => onNotesClick(b)}
                        title={`${b.first_name} ${b.last_name} — ${b.start_time.substring(0,5)}`}
                        className={`absolute left-0.5 right-0.5 rounded-lg p-1 text-white text-left transition cursor-pointer ${durColor(b.duration)}`}
                        style={{ top: `${topPct}%`, height: `${Math.max(heightPct, 4)}%` }}>
                        <p className="text-xs font-bold leading-tight truncate">{b.first_name} {b.last_name[0]}.</p>
                        <p className="text-xs opacity-80 leading-tight">{b.start_time.substring(0, 5)} · {price}€</p>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MiniCalendar ──────────────────────────────────────────────────────────────
function MiniCalendar({ selected, onSelect, availableDays }) {
  const today = new Date();
  const [view, setView] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const year  = view.getFullYear();
  const month = view.getMonth();
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(firstDay).fill(null),
                 ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const todayStr = today.toISOString().split('T')[0];

  return (
    <div className="bg-[#111827] rounded-3xl p-4 select-none shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setView(new Date(year, month - 1, 1))}
          className="w-8 h-8 rounded-xl hover:bg-white/10 transition text-slate-400 flex items-center justify-center font-bold text-lg">‹</button>
        <span className="font-semibold text-white text-sm capitalize">{MONTHS[month]} {year}</span>
        <button onClick={() => setView(new Date(year, month + 1, 1))}
          className="w-8 h-8 rounded-xl hover:bg-white/10 transition text-slate-400 flex items-center justify-center font-bold text-lg">›</button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS_SHORT.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-slate-500 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />;
          const dateStr   = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          const dayOfWeek = new Date(year, month, day).getDay();
          const isPast    = dateStr < todayStr;
          const isAvail   = availableDays.includes(dayOfWeek) && !isPast;
          const isSel     = selected === dateStr;
          const isToday   = dateStr === todayStr;
          return (
            <button key={day} onClick={() => isAvail && onSelect(dateStr)} disabled={!isAvail}
              className={[
                'aspect-square flex items-center justify-center text-xs rounded-xl transition font-medium',
                isSel    ? 'bg-cyan-400 text-white shadow-sm'                              : '',
                !isSel && isAvail ? 'hover:bg-cyan-400/10 text-white cursor-pointer'       : '',
                !isAvail ? 'text-slate-600 cursor-not-allowed'                             : '',
                isToday && !isSel ? 'ring-2 ring-cyan-400 text-cyan-400 font-bold'        : '',
              ].join(' ')}>
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── SlotGrid ──────────────────────────────────────────────────────────────────
function SlotGrid({ slots, selected, onSelect, loading, selectedDate }) {
  if (!selectedDate)
    return (
      <div className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-white/10 rounded-3xl text-slate-400 bg-[#0d1a2e]">
        <span className="text-3xl mb-1">📅</span>
        <p className="text-xs">Sélectionnez une date</p>
      </div>
    );
  if (loading)
    return (
      <div className="flex items-center justify-center h-40 rounded-3xl bg-[#111827] shadow-sm">
        <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-400" />
      </div>
    );
  if (!slots.length)
    return (
      <div className="flex flex-col items-center justify-center h-40 rounded-3xl text-slate-400 bg-[#111827] shadow-sm">
        <span className="text-3xl mb-1">😕</span>
        <p className="text-xs">Aucun créneau disponible</p>
      </div>
    );
  return (
    <div className="bg-[#111827] rounded-3xl p-3 max-h-52 overflow-y-auto shadow-sm">
      <div className="grid grid-cols-3 gap-1.5">
        {slots.map((slot) => (
          <button key={slot.start} onClick={() => onSelect(slot)}
            className={[
              'py-2 px-1 rounded-xl text-xs font-semibold transition',
              selected?.start === slot.start
                ? 'bg-cyan-400 text-white shadow-sm'
                : 'bg-[#0d1a2e] text-slate-300 hover:bg-cyan-400/10 hover:text-cyan-400 border border-white/10',
            ].join(' ')}>
            {fmtTime(slot.start)}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Modify Modal ──────────────────────────────────────────────────────────────
function ModifyModal({ booking, availableDays, onClose, onSaved }) {
  const [date,     setDate]     = useState('');
  const [duration, setDuration] = useState(parseInt(booking.duration));
  const [slots,    setSlots]    = useState([]);
  const [slot,     setSlot]     = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    if (!date) { setSlots([]); setSlot(null); return; }
    setLoading(true);
    api.get(`/availability/slots/${date}?duration=${duration}`)
      .then((r) => setSlots(r.data.slots || []))
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
    setSlot(null);
  }, [date, duration]);

  const handleSave = async () => {
    if (!slot || !date) return;
    setSaving(true);
    try {
      await api.put(`/bookings/${booking.id}`, { date, start_time: slot.start, duration });
      onSaved();
    } catch (err) {
      alert(err.response?.data?.error || 'Échec de la modification');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-[#111827] rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/10">
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-lg font-bold text-white">Modifier la réservation</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {booking.first_name} {booking.last_name}
              {booking.study_level && ` · ${booking.study_level}`}
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition text-xl">✕</button>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 mb-5 text-sm text-blue-300">
            <span>📌</span>
            Actuel : {fmtDateLong(booking.date)} à {fmtTime(booking.start_time)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-white mb-2 text-sm">Nouvelle date</h3>
                <MiniCalendar selected={date} onSelect={setDate} availableDays={availableDays} />
              </div>
              <div>
                <h3 className="font-semibold text-white mb-2 text-sm">Durée & Tarif</h3>
                <div className="grid grid-cols-3 gap-2">
                  {DURATIONS.map((d) => (
                    <button key={d.value} onClick={() => { setDuration(d.value); setSlot(null); }}
                      className={`py-2.5 rounded-xl text-xs font-semibold transition flex flex-col items-center gap-0.5 ${
                        duration === d.value ? 'bg-cyan-400 text-white shadow-sm' : 'bg-[#0d1a2e] text-slate-300 border border-white/10 hover:border-cyan-400/50'
                      }`}>
                      <span>{d.label}</span>
                      <span className={`font-bold ${duration === d.value ? 'text-cyan-100' : 'text-cyan-400'}`}>{d.price}€</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-2 text-sm">Nouveau créneau</h3>
              <SlotGrid slots={slots} selected={slot} onSelect={setSlot} loading={loading} selectedDate={date} />
              {slot && date && (
                <div className="mt-3 bg-cyan-400/10 rounded-xl p-3 text-sm text-cyan-400 space-y-0.5 border border-cyan-400/20">
                  <p>📅 {fmtDateLong(date)}</p>
                  <p>⏰ {fmtTime(slot.start)} — {fmtTime(slot.end)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-3 justify-end px-6 py-4 border-t border-white/10">
          <button onClick={onClose}
            className="px-5 py-2 border border-white/10 rounded-xl text-sm text-slate-300 hover:bg-white/5 transition font-medium">Annuler</button>
          <button onClick={handleSave} disabled={!slot || !date || saving}
            className="px-5 py-2 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition shadow-sm">
            {saving ? 'Enregistrement…' : 'Confirmer les modifications'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sidebar icon button ───────────────────────────────────────────────────────
function SideIcon({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} title={label}
      className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition ${
        active ? 'bg-gradient-to-br from-cyan-400 to-blue-500 shadow-sm text-white' : 'hover:bg-white/10 text-slate-400 hover:text-white'
      }`}>
      {icon}
    </button>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function TeacherDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('bookings');

  // Bookings
  const [bookings,        setBookings]        = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [statusFilter,    setStatusFilter]    = useState('all');
  const [modifyTarget,    setModifyTarget]    = useState(null);
  const [notesTarget,     setNotesTarget]     = useState(null);

  // Availability
  const [availability,  setAvailability]  = useState([]);
  const [availableDays, setAvailableDays] = useState([]);
  const [availLoading,  setAvailLoading]  = useState(true);
  const [showForm,      setShowForm]      = useState(false);
  const [form,          setForm]          = useState({ day_of_week: 1, start_time: '09:00', end_time: '17:00' });
  const [saving,        setSaving]        = useState(false);

  useEffect(() => {
    fetchBookings();
    fetchAvailability();
  }, []);

  const fetchBookings = async () => {
    setBookingsLoading(true);
    try {
      const { data } = await api.get('/bookings');
      setBookings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setBookingsLoading(false);
    }
  };

  const fetchAvailability = async () => {
    setAvailLoading(true);
    try {
      const { data } = await api.get('/availability');
      setAvailability(data);
      setAvailableDays([...new Set(data.map((a) => a.day_of_week))]);
    } catch (err) {
      console.error(err);
    } finally {
      setAvailLoading(false);
    }
  };

  const handleAddSlot = async () => {
    if (form.start_time >= form.end_time)
      return alert("L'heure de début doit être avant l'heure de fin");
    setSaving(true);
    try {
      await api.post('/availability', form);
      setShowForm(false);
      setForm({ day_of_week: 1, start_time: '09:00', end_time: '17:00' });
      fetchAvailability();
    } catch (err) {
      alert(err.response?.data?.error || "Échec de l'ajout");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSlot = async (id) => {
    if (!confirm('Supprimer ce créneau de disponibilité ?')) return;
    try {
      await api.delete(`/availability/${id}`);
      fetchAvailability();
    } catch {
      alert('Échec de la suppression');
    }
  };

  const handleCancelBooking = async (id) => {
    if (!confirm('Annuler cette réservation ?')) return;
    try {
      await api.delete(`/bookings/${id}`);
      fetchBookings();
    } catch (err) {
      alert(err.response?.data?.error || "Échec de l'annulation");
    }
  };

  // Computed stats
  const confirmed      = bookings.filter(b => b.status === 'confirmed');
  const canceled       = bookings.filter(b => b.status === 'canceled');
  const filtered       = bookings.filter(b => statusFilter === 'all' || b.status === statusFilter);
  const totalRevenue   = confirmed.reduce((s, b) => s + (durPrice(b.duration) || 0), 0);
  const todayStr       = new Date().toISOString().split('T')[0];
  const todayBookings  = confirmed.filter(b => {
    const ds = typeof b.date === 'string' && b.date.includes('T') ? b.date.split('T')[0] : b.date;
    return ds === todayStr;
  });
  const avgRating = (() => {
    const rated = confirmed.filter(b => b.student_rating > 0);
    if (!rated.length) return null;
    return (rated.reduce((s, b) => s + b.student_rating, 0) / rated.length).toFixed(1);
  })();

  const availByDay = DAYS.reduce((acc, _, i) => {
    acc[i] = availability.filter((a) => a.day_of_week === i); return acc;
  }, {});

  const initials = `${user.first_name?.[0] ?? ''}`.toUpperCase();

  const navItems = [
    { id: 'bookings',     label: 'Réservations' },
    { id: 'calendar',     label: 'Calendrier' },
    { id: 'availability', label: 'Disponibilités' },
  ];

  return (
    <div className="flex h-screen bg-[#0a0f1e] overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="hidden md:flex w-16 bg-[#0d1526] border-r border-white/10 flex-col items-center py-5 gap-2 fixed h-full z-20 shadow-sm">
        {/* Logo */}
        <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center shadow-sm mb-3">
          <span className="text-lg">🎓</span>
        </div>

        <div className="flex-1 flex flex-col items-center gap-1 mt-2">
          <SideIcon icon="📋" label="Réservations" active={tab === 'bookings'} onClick={() => setTab('bookings')} />
          <SideIcon icon="📅" label="Calendrier"   active={tab === 'calendar'} onClick={() => setTab('calendar')} />
          <SideIcon icon="⚙️" label="Disponibilités" active={tab === 'availability'} onClick={() => setTab('availability')} />
          <SideIcon icon="📊" label="Analyses" active={false} onClick={() => navigate('/analytics')} />
        </div>

        <button onClick={logout} title="Déconnexion"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition text-lg">
          ↩
        </button>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 md:ml-16 flex flex-col overflow-hidden">

        {/* ── Top bar ── */}
        <header className="bg-[#0d1526] border-b border-white/10 px-5 py-4 flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white leading-tight">
              Bonjour, {user.first_name} 👋
            </h1>
            <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">
              Suivez vos réservations et gérez votre agenda
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Pill nav */}
            <nav className="hidden lg:flex bg-[#0d1a2e] rounded-full p-1 gap-1 border border-white/5">
              {navItems.map(n => (
                <button key={n.id} onClick={() => setTab(n.id)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                    tab === n.id ? 'bg-cyan-400 text-[#0a0f1e] shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}>
                  {n.label}
                </button>
              ))}
              <button onClick={() => navigate('/analytics')}
                className="px-4 py-1.5 rounded-full text-sm font-medium text-slate-400 hover:text-white transition">
                Analyses
              </button>
            </nav>

            {/* Bell */}
            <button className="w-9 h-9 border border-white/10 rounded-full flex items-center justify-center text-slate-400 hover:bg-white/5 transition text-base">
              🔔
            </button>

            {/* Avatar */}
            <div className="w-9 h-9 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center font-bold text-white text-sm">
              {initials}
            </div>
          </div>
        </header>

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* ── KPI Row ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Confirmed — cyan gradient card */}
            <div className="bg-gradient-to-br from-cyan-400 to-blue-500 rounded-3xl p-4 text-white shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-cyan-100">Séances confirmées</p>
                <span className="text-xl">✅</span>
              </div>
              <p className="text-3xl font-extrabold">{confirmed.length}</p>
              <p className="text-xs text-cyan-100 mt-1">
                ↑ {todayBookings.length} aujourd'hui
              </p>
            </div>

            {/* Revenue */}
            <div className="bg-[#111827] rounded-3xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-400">Revenus estimés</p>
                <span className="text-xl">💶</span>
              </div>
              <p className="text-3xl font-extrabold text-white">{totalRevenue}<span className="text-lg text-slate-400">€</span></p>
              <p className="text-xs text-slate-400 mt-1">sur {confirmed.length} séances</p>
            </div>

            {/* Avg rating */}
            <div className="bg-[#111827] rounded-3xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-400">Note moyenne</p>
                <span className="text-xl">⭐</span>
              </div>
              <p className="text-3xl font-extrabold text-white">{avgRating ?? '—'}</p>
              <p className="text-xs text-slate-400 mt-1">sur 5 étoiles</p>
            </div>

            {/* Canceled */}
            <div className="bg-[#111827] rounded-3xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-400">Annulations</p>
                <span className="text-xl">❌</span>
              </div>
              <p className="text-3xl font-extrabold text-white">{canceled.length}</p>
              <p className="text-xs text-slate-400 mt-1">
                {bookings.length > 0 ? Math.round(canceled.length / bookings.length * 100) : 0}% du total
              </p>
            </div>
          </div>

          {/* ── Bookings Tab ── */}
          {tab === 'bookings' && (
            <div>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <h2 className="font-bold text-white">Toutes les séances</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { key: 'all', label: 'Tous' },
                    { key: 'confirmed', label: 'Confirmés' },
                    { key: 'canceled', label: 'Annulés' },
                  ].map(f => (
                    <button key={f.key} onClick={() => setStatusFilter(f.key)}
                      className={`px-3 py-1.5 text-xs rounded-xl font-semibold transition ${
                        statusFilter === f.key
                          ? 'bg-[#111827] text-white border border-white/10 shadow-sm'
                          : 'bg-[#0d1a2e] text-slate-400 border border-white/10 hover:bg-white/5'
                      }`}>
                      {f.label}
                    </button>
                  ))}
                  <button onClick={fetchBookings}
                    className="px-3 py-1.5 text-xs border border-white/10 rounded-xl hover:bg-white/5 transition text-slate-400 bg-[#0d1a2e] font-medium shadow-sm flex items-center gap-1">
                    ↻ Actualiser
                  </button>
                </div>
              </div>

              {bookingsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-[#111827] rounded-3xl shadow-sm">
                  <span className="text-4xl mb-3">📋</span>
                  <p className="font-medium">Aucune réservation trouvée</p>
                </div>
              ) : (
                <div className="bg-[#111827] rounded-3xl shadow-sm overflow-hidden">
                  {/* Table header */}
                  <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-white/10 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    <div className="col-span-4">Élève</div>
                    <div className="col-span-3 hidden sm:block">Date & Heure</div>
                    <div className="col-span-2 hidden md:block">Tarif</div>
                    <div className="col-span-1">Statut</div>
                    <div className="col-span-2 text-right">Actions</div>
                  </div>

                  {filtered.map((b, idx) => (
                    <div key={b.id}
                      className={`grid grid-cols-12 gap-4 px-5 py-4 items-center transition ${
                        idx !== filtered.length - 1 ? 'border-b border-white/5' : ''
                      } ${b.status === 'canceled' ? 'opacity-50' : 'hover:bg-white/5'}`}>

                      {/* Student */}
                      <div className="col-span-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-cyan-400/10 flex items-center justify-center font-bold text-cyan-400 text-xs shrink-0">
                            {b.first_name?.[0]}{b.last_name?.[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-white text-sm truncate">{b.first_name} {b.last_name}</p>
                            <p className="text-xs text-slate-400 truncate">{b.email}</p>
                          </div>
                        </div>
                      </div>

                      {/* Date */}
                      <div className="col-span-3 hidden sm:block">
                        <p className="font-medium text-slate-300 text-sm capitalize">{fmtDate(b.date)}</p>
                        <p className="text-xs text-slate-400">{fmtTime(b.start_time)} — {fmtTime(b.end_time)} · {durLabel(b.duration)}</p>
                        {b.meet_link && b.status !== 'canceled' && (
                          <a href={b.meet_link} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-cyan-400 hover:underline font-semibold mt-0.5 inline-block">
                            🔗 Rejoindre
                          </a>
                        )}
                      </div>

                      {/* Price */}
                      <div className="col-span-2 hidden md:block">
                        <span className="font-bold text-white">{durPrice(b.duration)}€</span>
                        {b.student_rating > 0 && (
                          <p className="text-amber-400 text-xs mt-0.5">{'★'.repeat(b.student_rating)}{'☆'.repeat(5 - b.student_rating)}</p>
                        )}
                      </div>

                      {/* Status */}
                      <div className="col-span-1">
                        <StatusDot status={b.status} />
                      </div>

                      {/* Actions */}
                      <div className="col-span-4 md:col-span-2 flex items-center justify-end gap-1.5 flex-wrap">
                        {b.status === 'confirmed' && (
                          <>
                            <button onClick={() => setNotesTarget(b)}
                              className="px-2.5 py-1 text-xs border border-teal-400/30 text-teal-400 rounded-lg hover:bg-teal-400/10 transition font-semibold">
                              📝
                            </button>
                            <button onClick={() => setModifyTarget(b)}
                              className="px-2.5 py-1 text-xs border border-white/10 text-slate-300 rounded-lg hover:bg-white/5 transition font-semibold">
                              ✏️
                            </button>
                            <button onClick={() => handleCancelBooking(b.id)}
                              className="px-2.5 py-1 text-xs border border-red-400/30 text-red-400 rounded-lg hover:bg-red-400/10 transition font-semibold">
                              ✕
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Calendar Tab ── */}
          {tab === 'calendar' && (
            <WeekCalendar bookings={bookings} onNotesClick={setNotesTarget} />
          )}

          {/* ── Availability Tab ── */}
          {tab === 'availability' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-white">Disponibilités hebdomadaires</h2>
                <button onClick={() => setShowForm(!showForm)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition shadow-sm ${
                    showForm ? 'border border-white/10 text-slate-300 hover:bg-white/5 bg-[#111827]' : 'bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 text-white'
                  }`}>
                  {showForm ? 'Annuler' : '+ Ajouter un créneau'}
                </button>
              </div>

              {showForm && (
                <div className="bg-[#111827] rounded-3xl p-5 mb-5 shadow-sm border border-white/10">
                  <h3 className="font-semibold text-white mb-4">Nouveau créneau</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5">Jour de la semaine</label>
                      <select value={form.day_of_week}
                        onChange={(e) => setForm({ ...form, day_of_week: parseInt(e.target.value) })}
                        className="w-full px-3 py-2.5 border border-white/10 rounded-xl focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 outline-none text-sm bg-[#0d1a2e] text-white">
                        {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5">Heure de début</label>
                      <input type="time" value={form.start_time}
                        onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                        className="w-full px-3 py-2.5 border border-white/10 rounded-xl focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 outline-none text-sm bg-[#0d1a2e] text-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5">Heure de fin</label>
                      <input type="time" value={form.end_time}
                        onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                        className="w-full px-3 py-2.5 border border-white/10 rounded-xl focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 outline-none text-sm bg-[#0d1a2e] text-white" />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button onClick={handleAddSlot} disabled={saving}
                      className="px-5 py-2 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60 transition shadow-sm">
                      {saving ? 'Ajout en cours…' : 'Ajouter'}
                    </button>
                    <button onClick={() => setShowForm(false)}
                      className="px-5 py-2 border border-white/10 rounded-xl text-sm text-slate-300 hover:bg-white/5 transition font-medium">
                      Annuler
                    </button>
                  </div>
                </div>
              )}

              {availLoading ? (
                <div className="flex items-center justify-center py-12">
                  <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" />
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
                  {DAYS.map((day, i) => (
                    <div key={i} className="bg-[#111827] rounded-3xl p-3 shadow-sm border border-white/5">
                      <div className="mb-2">
                        <p className="font-bold text-white text-sm">{DAYS_SHORT[i]}</p>
                        <p className="text-xs text-slate-400">{day}</p>
                      </div>
                      {availByDay[i].length === 0 ? (
                        <p className="text-xs text-slate-500 italic">Aucun</p>
                      ) : (
                        <div className="space-y-1.5">
                          {availByDay[i].map((slot) => (
                            <div key={slot.id}
                              className="flex items-center justify-between bg-cyan-400/10 rounded-xl px-2 py-1.5 border border-cyan-400/20">
                              <span className="text-xs font-semibold text-cyan-400">
                                {slot.start_time.substring(0,5)}–{slot.end_time.substring(0,5)}
                              </span>
                              <button onClick={() => handleDeleteSlot(slot.id)}
                                className="text-red-400/50 hover:text-red-400 text-xs ml-1 leading-none transition">✕</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-slate-400 mt-4 text-center">
                Les disponibilités définissent les jours et horaires où les élèves peuvent réserver des séances.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {modifyTarget && (
        <ModifyModal
          booking={modifyTarget}
          availableDays={availableDays}
          onClose={() => setModifyTarget(null)}
          onSaved={() => { setModifyTarget(null); fetchBookings(); }}
        />
      )}
      {notesTarget && (
        <SessionNotesModal
          booking={notesTarget}
          onClose={() => setNotesTarget(null)}
          onSaved={() => { setNotesTarget(null); fetchBookings(); }}
        />
      )}
    </div>
  );
}
