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
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
  });
};

const fmtTime = (t) => {
  const [h, m] = t.substring(0, 5).split(':').map(Number);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
};

// ── StatusBadge ───────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    confirmed: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    canceled:  'bg-red-100 text-red-600 border border-red-200',
  };
  const labels = { confirmed: 'Confirmé', canceled: 'Annulé' };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {labels[status] ?? status}
    </span>
  );
}

// ── MiniCalendar (shared) ─────────────────────────────────────────────────────
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
    <div className="bg-white rounded-2xl border border-gray-200 p-4 select-none">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setView(new Date(year, month - 1, 1))}
          className="w-8 h-8 rounded-xl hover:bg-gray-100 transition text-gray-500 flex items-center justify-center font-bold text-lg">‹</button>
        <span className="font-semibold text-gray-800 text-sm capitalize">{MONTHS[month]} {year}</span>
        <button onClick={() => setView(new Date(year, month + 1, 1))}
          className="w-8 h-8 rounded-xl hover:bg-gray-100 transition text-gray-500 flex items-center justify-center font-bold text-lg">›</button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS_SHORT.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
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
                isSel    ? 'bg-purple-600 text-white shadow-sm'                          : '',
                !isSel && isAvail ? 'hover:bg-purple-50 text-gray-800 cursor-pointer'    : '',
                !isAvail ? 'text-gray-300 cursor-not-allowed'                            : '',
                isToday && !isSel ? 'ring-2 ring-purple-400 text-purple-600 font-bold'   : '',
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
      <div className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 bg-gray-50">
        <span className="text-3xl mb-1">📅</span>
        <p className="text-xs">Sélectionnez une date</p>
      </div>
    );
  if (loading)
    return (
      <div className="flex items-center justify-center h-40 border border-gray-200 rounded-2xl bg-white">
        <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600" />
      </div>
    );
  if (!slots.length)
    return (
      <div className="flex flex-col items-center justify-center h-40 border border-gray-200 rounded-2xl text-gray-400 bg-white">
        <span className="text-3xl mb-1">😕</span>
        <p className="text-xs">Aucun créneau disponible</p>
      </div>
    );

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-3 max-h-52 overflow-y-auto">
      <div className="grid grid-cols-3 gap-1.5">
        {slots.map((slot) => (
          <button key={slot.start} onClick={() => onSelect(slot)}
            className={[
              'py-2 px-1 rounded-xl text-xs font-semibold border-2 transition',
              selected?.start === slot.start
                ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                : 'border-gray-200 text-gray-700 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50 bg-white',
            ].join(' ')}>
            {fmtTime(slot.start)}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Modify Modal (teacher) ────────────────────────────────────────────────────
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Modifier la réservation</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {booking.first_name} {booking.last_name}
              {booking.study_level && ` · ${booking.study_level}`}
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition text-xl">✕</button>
        </div>

        <div className="p-6">
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 text-sm text-amber-800">
            <span>📌</span>
            Actuel : {fmtDate(booking.date)} à {fmtTime(booking.start_time)}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-800 mb-2 text-sm">Nouvelle date</h3>
                <MiniCalendar selected={date} onSelect={setDate} availableDays={availableDays} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-2 text-sm">Durée & Tarif</h3>
                <div className="grid grid-cols-3 gap-2">
                  {DURATIONS.map((d) => (
                    <button key={d.value} onClick={() => { setDuration(d.value); setSlot(null); }}
                      className={`py-2.5 rounded-xl text-xs font-semibold border-2 transition flex flex-col items-center gap-0.5 ${duration === d.value ? 'bg-purple-600 text-white border-purple-600' : 'border-gray-200 text-gray-700 hover:border-purple-300 bg-white'}`}>
                      <span>{d.label}</span>
                      <span className={`font-bold ${duration === d.value ? 'text-purple-200' : 'text-purple-500'}`}>{d.price}€</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-800 mb-2 text-sm">Nouveau créneau</h3>
              <SlotGrid slots={slots} selected={slot} onSelect={setSlot} loading={loading} selectedDate={date} />
              {slot && date && (
                <div className="mt-3 bg-purple-50 rounded-xl p-3 text-sm text-purple-800 space-y-0.5 border border-purple-100">
                  <p>📅 {fmtDate(date)}</p>
                  <p>⏰ {fmtTime(slot.start)} — {fmtTime(slot.end)}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end px-6 py-4 border-t border-gray-100">
          <button onClick={onClose}
            className="px-5 py-2 border border-gray-300 rounded-xl text-sm hover:bg-gray-50 transition font-medium">
            Annuler
          </button>
          <button onClick={handleSave} disabled={!slot || !date || saving}
            className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition">
            {saving ? 'Enregistrement…' : 'Confirmer les modifications'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function TeacherDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab]    = useState('bookings');

  // Bookings
  const [bookings,        setBookings]        = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [statusFilter,    setStatusFilter]    = useState('all');
  const [modifyTarget,    setModifyTarget]    = useState(null);
  const [notesTarget,     setNotesTarget]     = useState(null);

  // Availability
  const [availability, setAvailability] = useState([]);
  const [availableDays,setAvailableDays] = useState([]);
  const [availLoading, setAvailLoading] = useState(true);
  const [showForm,     setShowForm]     = useState(false);
  const [form,         setForm]         = useState({ day_of_week: 1, start_time: '09:00', end_time: '17:00' });
  const [saving,       setSaving]       = useState(false);

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
      return alert('L\'heure de début doit être avant l\'heure de fin');
    setSaving(true);
    try {
      await api.post('/availability', form);
      setShowForm(false);
      setForm({ day_of_week: 1, start_time: '09:00', end_time: '17:00' });
      fetchAvailability();
    } catch (err) {
      alert(err.response?.data?.error || 'Échec de l\'ajout');
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
      alert(err.response?.data?.error || 'Échec de l\'annulation');
    }
  };

  const filtered   = bookings.filter((b) => statusFilter === 'all' || b.status === statusFilter);
  const upcoming   = bookings.filter((b) => b.status === 'confirmed');
  const totalRevenue = upcoming.reduce((sum, b) => sum + (durPrice(b.duration) || 0), 0);
  const availByDay = DAYS.reduce((acc, _, i) => {
    acc[i] = availability.filter((a) => a.day_of_week === i);
    return acc;
  }, {});

  const filterLabels = { all: 'Tous', confirmed: 'Confirmés', canceled: 'Annulés' };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-purple-600 rounded-xl flex items-center justify-center shadow-sm">
              <span className="text-lg">🎓</span>
            </div>
            <div className="hidden sm:block">
              <p className="font-bold text-gray-900 text-sm leading-tight">Tableau de bord</p>
              <p className="text-xs text-gray-500">Espace professeur</p>
            </div>
          </div>

          {/* Stats */}
          <div className="hidden md:flex items-center gap-6">
            <div className="text-center">
              <p className="text-xl font-extrabold text-purple-600 leading-none">{upcoming.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">Confirmées</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-extrabold text-gray-700 leading-none">{bookings.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">Total</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-extrabold text-emerald-600 leading-none">{totalRevenue}€</p>
              <p className="text-xs text-gray-400 mt-0.5">À percevoir</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/analytics')}
              className="px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition hidden sm:inline-block">
              📊 Analyses
            </button>
            <div className="text-right hidden sm:block">
              <p className="font-semibold text-sm text-gray-900">{user.first_name}</p>
              <p className="text-xs text-gray-400">Professeur</p>
            </div>
            <button onClick={logout}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-600 font-medium">
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        <div className="inline-flex gap-1 bg-gray-100 rounded-xl p-1">
          {[
            { id: 'bookings',     label: '📋 Réservations' },
            { id: 'availability', label: '⚙️ Disponibilités' },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${tab === t.id ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Bookings Tab ── */}
      {tab === 'bookings' && (
        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <h2 className="font-bold text-gray-900">Toutes les séances</h2>
            <div className="flex items-center gap-2 flex-wrap">
              {(['all','confirmed','canceled'] ).map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 text-xs rounded-lg border-2 transition font-semibold ${statusFilter === s ? 'bg-purple-600 text-white border-purple-600' : 'border-gray-200 text-gray-600 hover:border-purple-300 bg-white'}`}>
                  {filterLabels[s]}
                </button>
              ))}
              <button onClick={fetchBookings}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-600 bg-white font-medium flex items-center gap-1">
                <span>↻</span> Actualiser
              </button>
            </div>
          </div>

          {bookingsLoading ? (
            <div className="flex items-center justify-center py-16">
              <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
              <span className="text-4xl mb-3">📋</span>
              <p className="font-medium">Aucune réservation trouvée</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((b) => (
                <div key={b.id}
                  className={`bg-white rounded-2xl border p-5 transition ${b.status === 'canceled' ? 'border-gray-100 opacity-60' : 'border-gray-200 hover:shadow-md hover:border-purple-100'}`}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <StatusBadge status={b.status} />
                        <span className="font-bold text-sm text-gray-900">
                          {b.first_name} {b.last_name}
                        </span>
                        {b.study_level && (
                          <span className="text-xs bg-purple-50 text-purple-600 px-2.5 py-0.5 rounded-full font-semibold border border-purple-100">
                            {b.study_level}
                          </span>
                        )}
                        <span className="text-xs text-gray-300">#{b.id}</span>
                      </div>
                      <p className="font-semibold text-gray-800 capitalize">
                        {fmtDate(b.date)}
                        <span className="text-gray-400 font-normal"> · </span>
                        {fmtTime(b.start_time)} — {fmtTime(b.end_time)}
                      </p>
                      <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>{durLabel(b.duration)}</span>
                        <span className="font-bold text-emerald-600">{durPrice(b.duration)}€</span>
                        <span className="text-gray-300">·</span>
                        <span>{b.email}</span>
                      </p>
                      {b.meet_link && b.status !== 'canceled' && (
                        <a href={b.meet_link} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-indigo-600 hover:underline mt-1.5 inline-flex items-center gap-1 font-semibold">
                          🔗 Rejoindre la séance
                        </a>
                      )}
                      {/* Student feedback badge */}
                      {b.student_rating > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-amber-400 text-sm">{'★'.repeat(b.student_rating)}{'☆'.repeat(5 - b.student_rating)}</span>
                          {b.student_feedback && (
                            <span className="text-xs text-gray-500 italic">"{b.student_feedback.slice(0, 60)}{b.student_feedback.length > 60 ? '…' : ''}"</span>
                          )}
                        </div>
                      )}
                      {/* Teacher notes badge */}
                      {b.teacher_notes && (
                        <p className="mt-1.5 text-xs text-gray-400 flex items-center gap-1">
                          📝 <span className="italic">{b.teacher_notes.slice(0, 70)}{b.teacher_notes.length > 70 ? '…' : ''}</span>
                        </p>
                      )}
                    </div>
                    {b.status === 'confirmed' && (
                      <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                        <button onClick={() => setNotesTarget(b)}
                          className="px-3 py-1.5 text-xs border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-50 transition font-semibold">
                          📝 Notes
                        </button>
                        <button onClick={() => setModifyTarget(b)}
                          className="px-3 py-1.5 text-xs border border-purple-200 text-purple-700 rounded-lg hover:bg-purple-50 transition font-semibold">
                          Modifier
                        </button>
                        <button onClick={() => handleCancelBooking(b.id)}
                          className="px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition font-semibold">
                          Annuler
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* ── Availability Tab ── */}
      {tab === 'availability' && (
        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-gray-900">Disponibilités hebdomadaires</h2>
            <button onClick={() => setShowForm(!showForm)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${showForm ? 'border border-gray-300 text-gray-600 hover:bg-gray-50' : 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm'}`}>
              {showForm ? 'Annuler' : '+ Ajouter un créneau'}
            </button>
          </div>

          {/* Add form */}
          {showForm && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4">Nouveau créneau de disponibilité</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Jour de la semaine</label>
                  <select
                    value={form.day_of_week}
                    onChange={(e) => setForm({ ...form, day_of_week: parseInt(e.target.value) })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm bg-white">
                    {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Heure de début</label>
                  <input type="time" value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Heure de fin</label>
                  <input type="time" value={form.end_time}
                    onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm" />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={handleAddSlot} disabled={saving}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold disabled:opacity-60 transition shadow-sm">
                  {saving ? 'Ajout en cours…' : 'Ajouter'}
                </button>
                <button onClick={() => setShowForm(false)}
                  className="px-5 py-2 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition font-medium">
                  Annuler
                </button>
              </div>
            </div>
          )}

          {/* Availability grid */}
          {availLoading ? (
            <div className="flex items-center justify-center py-12">
              <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
              {DAYS.map((day, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-200 p-3">
                  <div className="mb-2">
                    <p className="font-bold text-gray-800 text-sm">{DAYS_SHORT[i]}</p>
                    <p className="text-xs text-gray-400">{day}</p>
                  </div>
                  {availByDay[i].length === 0 ? (
                    <p className="text-xs text-gray-300 italic">Aucun</p>
                  ) : (
                    <div className="space-y-1.5">
                      {availByDay[i].map((slot) => (
                        <div key={slot.id}
                          className="flex items-center justify-between bg-purple-50 rounded-xl px-2 py-1.5 border border-purple-100">
                          <span className="text-xs font-semibold text-purple-800">
                            {slot.start_time.substring(0,5)}–{slot.end_time.substring(0,5)}
                          </span>
                          <button onClick={() => handleDeleteSlot(slot.id)}
                            className="text-red-300 hover:text-red-500 text-xs ml-1 leading-none">
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-gray-400 mt-4 text-center">
            Les disponibilités définissent les jours et horaires où les élèves peuvent réserver des séances.
            Les créneaux sont générés par intervalles de 30 minutes.
          </p>
        </main>
      )}

      {/* Modify Modal */}
      {modifyTarget && (
        <ModifyModal
          booking={modifyTarget}
          availableDays={availableDays}
          onClose={() => setModifyTarget(null)}
          onSaved={() => { setModifyTarget(null); fetchBookings(); }}
        />
      )}

      {/* Session Notes Modal */}
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
