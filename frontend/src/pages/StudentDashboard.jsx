import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import RatingModal from '../components/RatingModal';
import { useNavigate } from 'react-router-dom';

// ── Constants ─────────────────────────────────────────────────────────────────
const DAYS_SHORT = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
const MONTHS     = ['Janvier','Février','Mars','Avril','Mai','Juin',
                    'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const DURATIONS  = [
  { value: 60,  label: '1h',       price: 15 },
  { value: 90,  label: '1h 30min', price: 18 },
  { value: 120, label: '2h',       price: 25 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (d) => {
  const s = typeof d === 'string' && d.includes('T') ? d.split('T')[0] : d;
  return new Date(s + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
};

const fmtTime = (t) => {
  const [h, m] = t.substring(0, 5).split(':').map(Number);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
};

const getDuration = (v) => DURATIONS.find((d) => d.value === parseInt(v));
const durLabel = (v) => getDuration(v)?.label ?? `${v} min`;
const durPrice = (v) => getDuration(v)?.price ?? '?';

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

// ── MiniCalendar ──────────────────────────────────────────────────────────────
function MiniCalendar({ selected, onSelect, availableDays }) {
  const today   = new Date();
  const [view, setView] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year     = view.getFullYear();
  const month    = view.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
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
            <button
              key={day}
              onClick={() => isAvail && onSelect(dateStr)}
              disabled={!isAvail}
              className={[
                'aspect-square flex items-center justify-center text-xs rounded-xl transition font-medium',
                isSel    ? 'bg-indigo-600 text-white shadow-sm'                         : '',
                !isSel && isAvail ? 'hover:bg-indigo-50 text-gray-800 cursor-pointer'   : '',
                !isAvail ? 'text-gray-300 cursor-not-allowed'                           : '',
                isToday && !isSel ? 'ring-2 ring-indigo-400 text-indigo-600 font-bold'  : '',
              ].join(' ')}
            >
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
      <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 bg-gray-50">
        <span className="text-4xl mb-2">📅</span>
        <p className="text-sm font-medium">Sélectionnez une date</p>
        <p className="text-xs mt-1 text-gray-300">pour voir les créneaux disponibles</p>
      </div>
    );
  if (loading)
    return (
      <div className="flex items-center justify-center h-48 border border-gray-200 rounded-2xl bg-white">
        <span className="animate-spin rounded-full h-7 w-7 border-b-2 border-indigo-600" />
      </div>
    );
  if (!slots.length)
    return (
      <div className="flex flex-col items-center justify-center h-48 border border-gray-200 rounded-2xl text-gray-400 bg-white">
        <span className="text-4xl mb-2">😕</span>
        <p className="text-sm font-medium">Aucun créneau disponible</p>
        <p className="text-xs mt-1">Essayez une autre date ou durée</p>
      </div>
    );

  const amSlots = slots.filter((s) => parseInt(s.start.split(':')[0]) < 12);
  const pmSlots = slots.filter((s) => parseInt(s.start.split(':')[0]) >= 12);

  const SlotButton = ({ slot }) => (
    <button
      onClick={() => onSelect(slot)}
      className={[
        'py-2.5 px-3 rounded-xl text-sm font-semibold border-2 transition',
        selected?.start === slot.start
          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
          : 'border-gray-200 text-gray-700 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 bg-white',
      ].join(' ')}
    >
      {fmtTime(slot.start)}
    </button>
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
      <p className="text-xs text-gray-400">{fmtDate(selectedDate)} — <span className="font-medium text-gray-600">{slots.length} créneau{slots.length > 1 ? 'x' : ''}</span></p>

      {amSlots.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Matin</p>
          <div className="grid grid-cols-3 gap-1.5">
            {amSlots.map((slot) => <SlotButton key={slot.start} slot={slot} />)}
          </div>
        </div>
      )}
      {pmSlots.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Après-midi</p>
          <div className="grid grid-cols-3 gap-1.5">
            {pmSlots.map((slot) => <SlotButton key={slot.start} slot={slot} />)}
          </div>
        </div>
      )}
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Modifier la réservation</h2>
            <p className="text-xs text-gray-400 mt-0.5">Choisissez un nouveau créneau</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition text-xl leading-none">✕</button>
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
                <h3 className="font-semibold text-gray-800 mb-2 text-sm">Durée</h3>
                <div className="grid grid-cols-3 gap-2">
                  {DURATIONS.map((d) => (
                    <button key={d.value} onClick={() => { setDuration(d.value); setSlot(null); }}
                      className={`py-2.5 rounded-xl text-xs font-semibold border-2 transition flex flex-col items-center gap-0.5 ${duration === d.value ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-700 hover:border-indigo-300 bg-white'}`}>
                      <span>{d.label}</span>
                      <span className={`font-bold ${duration === d.value ? 'text-indigo-200' : 'text-indigo-500'}`}>{d.price}€</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-800 mb-2 text-sm">Nouveau créneau</h3>
              <SlotGrid slots={slots} selected={slot} onSelect={setSlot} loading={loading} selectedDate={date} />
              {slot && date && (
                <div className="mt-3 bg-indigo-50 rounded-xl p-3 text-sm text-indigo-800 space-y-0.5">
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
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition">
            {saving ? 'Enregistrement…' : 'Confirmer les modifications'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab]    = useState('book');

  // Book Session
  const [availableDays,  setAvailableDays]  = useState([]);
  const [selectedDate,   setSelectedDate]   = useState('');
  const [duration,       setDuration]       = useState(60);
  const [slots,          setSlots]          = useState([]);
  const [slotsLoading,   setSlotsLoading]   = useState(false);
  const [selectedSlot,   setSelectedSlot]   = useState(null);
  const [confirming,     setConfirming]     = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(null);

  // My Bookings
  const [bookings,        setBookings]        = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [modifyTarget,    setModifyTarget]    = useState(null);
  const [ratingTarget,    setRatingTarget]    = useState(null);

  useEffect(() => {
    api.get('/availability')
      .then((r) => setAvailableDays([...new Set(r.data.map((a) => a.day_of_week))]))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedDate) { setSlots([]); setSelectedSlot(null); return; }
    setSlotsLoading(true);
    api.get(`/availability/slots/${selectedDate}?duration=${duration}`)
      .then((r) => setSlots(r.data.slots || []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
    setSelectedSlot(null);
  }, [selectedDate, duration]);

  useEffect(() => {
    if (tab === 'bookings') fetchBookings();
  }, [tab]);

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

  const handleBook = async () => {
    if (!selectedSlot) return;
    setConfirming(true);
    try {
      const { data } = await api.post('/bookings', {
        date: selectedDate, start_time: selectedSlot.start, duration,
      });
      setBookingSuccess(data);
      setSelectedDate('');
      setSelectedSlot(null);
      setSlots([]);
    } catch (err) {
      alert(err.response?.data?.error || 'Échec de la réservation');
    } finally {
      setConfirming(false);
    }
  };

  const handleCancel = async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir annuler cette séance ?')) return;
    try {
      await api.delete(`/bookings/${id}`);
      fetchBookings();
    } catch (err) {
      alert(err.response?.data?.error || 'Échec de l\'annulation');
    }
  };

  const selectedDuration = getDuration(duration);

  const isBookingPast = (booking) => {
    const bookingEnd = new Date(`${booking.date}T${booking.end_time}`);
    return bookingEnd < new Date();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
              <span className="text-lg">📚</span>
            </div>
            <div className="hidden sm:block">
              <p className="font-bold text-gray-900 text-sm leading-tight">Cours Particuliers</p>
              <p className="text-xs text-gray-500">Espace élève</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/profile')}
              className="px-3 py-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-semibold hidden sm:inline-block">
              👤 Mon Profil
            </button>
            <div className="text-right hidden sm:block">
              <p className="font-semibold text-sm text-gray-900">
                {user.first_name} {user.last_name}
              </p>
              {user.study_level && (
                <p className="text-xs font-medium text-indigo-500">{user.study_level}</p>
              )}
            </div>
            <button onClick={logout}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-600 font-medium">
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-0">
        <div className="inline-flex gap-1 bg-gray-100 rounded-xl p-1">
          {[
            { id: 'book',     label: '📅 Réserver' },
            { id: 'bookings', label: '📋 Mes séances' },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${tab === t.id ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
              {t.label}
            </button>
          ))}
          <button onClick={() => navigate('/progress')}
            className="px-5 py-2 rounded-lg text-sm font-semibold transition text-gray-500 hover:text-gray-800">
            📈 Progression
          </button>
        </div>
      </div>

      {/* ── Book Session ── */}
      {tab === 'book' && (
        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          {bookingSuccess ? (
            /* Success state */
            <div className="max-w-lg mx-auto">
              <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-8 text-center">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-4xl">✅</span>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Séance réservée !</h2>
                <p className="text-gray-500 text-sm mb-6">Un e-mail de confirmation a été envoyé.</p>

                <div className="bg-gray-50 rounded-2xl p-5 text-left space-y-3 text-sm mb-6 border border-gray-100">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Date</span>
                    <span className="font-semibold text-gray-900 capitalize">{fmtDate(bookingSuccess.date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Horaire</span>
                    <span className="font-semibold text-gray-900">{fmtTime(bookingSuccess.start_time)} — {fmtTime(bookingSuccess.end_time)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Durée</span>
                    <span className="font-semibold text-gray-900">{durLabel(bookingSuccess.duration)}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-3">
                    <span className="text-gray-500">Tarif</span>
                    <span className="font-bold text-indigo-600 text-base">{durPrice(bookingSuccess.duration)} €</span>
                  </div>
                  {bookingSuccess.meet_link && (
                    <div className="border-t border-gray-200 pt-3">
                      <p className="text-gray-500 mb-1">Lien de la séance</p>
                      <a href={bookingSuccess.meet_link} target="_blank" rel="noopener noreferrer"
                        className="text-indigo-600 hover:underline break-all font-medium text-xs">
                        🔗 {bookingSuccess.meet_link}
                      </a>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setBookingSuccess(null)}
                    className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition font-medium">
                    Nouvelle réservation
                  </button>
                  <button onClick={() => { setBookingSuccess(null); setTab('bookings'); }}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition">
                    Voir mes séances
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left column */}
              <div className="space-y-5">
                {/* Step 1 */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-6 h-6 bg-indigo-600 text-white text-xs rounded-full flex items-center justify-center font-bold">1</span>
                    <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Choisir une date</h2>
                  </div>
                  <MiniCalendar
                    selected={selectedDate}
                    onSelect={(d) => { setSelectedDate(d); setSelectedSlot(null); }}
                    availableDays={availableDays}
                  />
                  {availableDays.length === 0 && (
                    <p className="text-xs text-gray-400 text-center mt-2">
                      Aucune disponibilité configurée par le professeur.
                    </p>
                  )}
                </div>

                {/* Step 2 */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-6 h-6 bg-indigo-600 text-white text-xs rounded-full flex items-center justify-center font-bold">2</span>
                    <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Durée & Tarif</h2>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {DURATIONS.map((d) => (
                      <button key={d.value}
                        onClick={() => { setDuration(d.value); setSelectedSlot(null); }}
                        className={`py-3 px-2 rounded-2xl border-2 transition flex flex-col items-center gap-1 ${duration === d.value ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'border-gray-200 text-gray-600 hover:border-indigo-300 bg-white'}`}>
                        <span className="text-sm font-bold">{d.label}</span>
                        <span className={`text-base font-extrabold ${duration === d.value ? 'text-white' : 'text-indigo-600'}`}>{d.price}€</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right column */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 bg-indigo-600 text-white text-xs rounded-full flex items-center justify-center font-bold">3</span>
                  <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Choisir un créneau</h2>
                </div>
                <SlotGrid
                  slots={slots}
                  selected={selectedSlot}
                  onSelect={setSelectedSlot}
                  loading={slotsLoading}
                  selectedDate={selectedDate}
                />

                {selectedSlot && (
                  <div className="bg-white border-2 border-indigo-200 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-gray-900">Récapitulatif</h3>
                      <span className="text-2xl font-extrabold text-indigo-600">{selectedDuration?.price}€</span>
                    </div>
                    <div className="space-y-2 text-sm text-gray-600 mb-5">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">📅</span>
                        <span className="capitalize">{fmtDate(selectedDate)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">⏰</span>
                        <span>{fmtTime(selectedSlot.start)} — {fmtTime(selectedSlot.end)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">⏱</span>
                        <span>{selectedDuration?.label}</span>
                      </div>
                    </div>
                    <button onClick={handleBook} disabled={confirming}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition disabled:opacity-60 text-sm shadow-sm">
                      {confirming
                        ? <span className="flex items-center justify-center gap-2">
                            <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Confirmation…
                          </span>
                        : 'Confirmer la réservation'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      )}

      {/* ── My Bookings ── */}
      {tab === 'bookings' && (
        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-gray-900">Mes séances</h2>
            <button onClick={fetchBookings}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1">
              <span>↻</span> Actualiser
            </button>
          </div>

          {bookingsLoading ? (
            <div className="flex items-center justify-center py-16">
              <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : bookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
              <span className="text-5xl mb-3">📋</span>
              <p className="font-semibold text-gray-500">Aucune séance pour le moment</p>
              <button onClick={() => setTab('book')}
                className="mt-4 px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition">
                Réserver une séance
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.map((b) => (
                <div key={b.id}
                  className={`bg-white rounded-2xl border p-5 transition ${b.status === 'canceled' ? 'border-gray-100 opacity-60' : 'border-gray-200 hover:shadow-md hover:border-indigo-100'}`}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <StatusBadge status={b.status} />
                        {b.study_level && (
                          <span className="text-xs bg-indigo-50 text-indigo-600 px-2.5 py-0.5 rounded-full font-semibold border border-indigo-100">
                            {b.study_level}
                          </span>
                        )}
                        <span className="text-xs text-gray-300">#{b.id}</span>
                      </div>
                      <p className="font-bold text-gray-900 capitalize">{fmtDate(b.date)}</p>
                      <p className="text-sm text-gray-600 mt-0.5">
                        {fmtTime(b.start_time)} — {fmtTime(b.end_time)}
                        <span className="text-gray-400"> · {durLabel(b.duration)}</span>
                        <span className="ml-2 font-bold text-indigo-600">{durPrice(b.duration)}€</span>
                      </p>
                      {b.meet_link && b.status !== 'canceled' && (
                        <a href={b.meet_link} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline mt-1.5 font-semibold">
                          🔗 Rejoindre la séance
                        </a>
                      )}
                    </div>

                    {b.status !== 'canceled' && (
                      <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                        {isBookingPast(b) && !b.student_rating && (
                          <button onClick={() => setRatingTarget(b)}
                            className="px-3 py-1.5 text-xs border border-yellow-200 text-yellow-700 rounded-lg hover:bg-yellow-50 transition font-semibold">
                            ⭐ Évaluer
                          </button>
                        )}
                        {!isBookingPast(b) && (
                          <button onClick={() => setModifyTarget(b)}
                            className="px-3 py-1.5 text-xs border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-50 transition font-semibold">
                            Modifier
                          </button>
                        )}
                        <button onClick={() => handleCancel(b.id)}
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

      {/* Modify Modal */}
      {modifyTarget && (
        <ModifyModal
          booking={modifyTarget}
          availableDays={availableDays}
          onClose={() => setModifyTarget(null)}
          onSaved={() => { setModifyTarget(null); fetchBookings(); }}
        />
      )}

      {/* Rating Modal */}
      {ratingTarget && (
        <RatingModal
          booking={ratingTarget}
          onClose={() => setRatingTarget(null)}
          onRatingSubmitted={() => { setRatingTarget(null); fetchBookings(); }}
        />
      )}
    </div>
  );
}
