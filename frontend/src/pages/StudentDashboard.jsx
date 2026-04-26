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
const fmtDateShort = (d) => {
  const s = typeof d === 'string' && d.includes('T') ? d.split('T')[0] : d;
  return new Date(s + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
};
const fmtTime = (t) => {
  const [h, m] = t.substring(0, 5).split(':').map(Number);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
};
const getDuration = (v) => DURATIONS.find((d) => d.value === parseInt(v));
const durLabel = (v) => getDuration(v)?.label ?? `${v} min`;
const durPrice = (v) => getDuration(v)?.price ?? '?';

// ── Status dot ────────────────────────────────────────────────────────────────
function StatusDot({ status }) {
  const map = {
    confirmed: 'bg-emerald-400',
    canceled:  'bg-red-400',
  };
  const labels = { confirmed: 'Confirmé', canceled: 'Annulé' };
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full inline-block ${map[status] ?? 'bg-gray-400'}`} />
      <span className="text-xs font-medium text-gray-600">{labels[status] ?? status}</span>
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
    <div className="bg-white rounded-2xl p-4 select-none shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setView(new Date(year, month - 1, 1))}
          className="w-8 h-8 rounded-xl hover:bg-gray-100 transition text-gray-400 flex items-center justify-center font-bold text-lg">‹</button>
        <span className="font-semibold text-gray-800 text-sm capitalize">{MONTHS[month]} {year}</span>
        <button onClick={() => setView(new Date(year, month + 1, 1))}
          className="w-8 h-8 rounded-xl hover:bg-gray-100 transition text-gray-400 flex items-center justify-center font-bold text-lg">›</button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS_SHORT.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-300 py-1">{d}</div>
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
                isSel    ? 'bg-orange-500 text-white shadow-sm'                         : '',
                !isSel && isAvail ? 'hover:bg-orange-50 text-gray-800 cursor-pointer'   : '',
                !isAvail ? 'text-gray-200 cursor-not-allowed'                           : '',
                isToday && !isSel ? 'ring-2 ring-orange-300 text-orange-500 font-bold'  : '',
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
        <span className="text-3xl mb-2">📅</span>
        <p className="text-xs font-medium">Sélectionnez une date</p>
      </div>
    );
  if (loading)
    return (
      <div className="flex items-center justify-center h-40 rounded-2xl bg-white shadow-sm">
        <span className="animate-spin rounded-full h-7 w-7 border-b-2 border-orange-500" />
      </div>
    );
  if (!slots.length)
    return (
      <div className="flex flex-col items-center justify-center h-40 rounded-2xl text-gray-400 bg-white shadow-sm">
        <span className="text-3xl mb-2">😕</span>
        <p className="text-xs font-medium">Aucun créneau disponible</p>
      </div>
    );

  const amSlots = slots.filter((s) => parseInt(s.start.split(':')[0]) < 12);
  const pmSlots = slots.filter((s) => parseInt(s.start.split(':')[0]) >= 12);

  const SlotButton = ({ slot }) => (
    <button onClick={() => onSelect(slot)}
      className={[
        'py-2.5 px-3 rounded-xl text-sm font-semibold transition',
        selected?.start === slot.start
          ? 'bg-orange-500 text-white shadow-sm'
          : 'bg-gray-50 text-gray-700 hover:bg-orange-50 hover:text-orange-600 border border-gray-200',
      ].join(' ')}>
      {fmtTime(slot.start)}
    </button>
  );

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
      <p className="text-xs text-gray-400">{fmtDate(selectedDate)} —{' '}
        <span className="font-medium text-gray-600">{slots.length} créneau{slots.length > 1 ? 'x' : ''}</span>
      </p>
      {amSlots.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-300 uppercase tracking-wide mb-2">Matin</p>
          <div className="grid grid-cols-3 gap-1.5">
            {amSlots.map((slot) => <SlotButton key={slot.start} slot={slot} />)}
          </div>
        </div>
      )}
      {pmSlots.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-300 uppercase tracking-wide mb-2">Après-midi</p>
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
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Modifier la réservation</h2>
            <p className="text-xs text-gray-400 mt-0.5">Choisissez un nouveau créneau</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition text-xl">✕</button>
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
                      className={`py-2.5 rounded-xl text-xs font-semibold transition flex flex-col items-center gap-0.5 ${duration === d.value ? 'bg-orange-500 text-white shadow-sm' : 'bg-gray-50 text-gray-700 border border-gray-200 hover:border-orange-300'}`}>
                      <span>{d.label}</span>
                      <span className={`font-bold ${duration === d.value ? 'text-orange-100' : 'text-orange-500'}`}>{d.price}€</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 mb-2 text-sm">Nouveau créneau</h3>
              <SlotGrid slots={slots} selected={slot} onSelect={setSlot} loading={loading} selectedDate={date} />
              {slot && date && (
                <div className="mt-3 bg-orange-50 rounded-xl p-3 text-sm text-orange-800 space-y-0.5 border border-orange-100">
                  <p>📅 {fmtDate(date)}</p>
                  <p>⏰ {fmtTime(slot.start)} — {fmtTime(slot.end)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-3 justify-end px-6 py-4 border-t border-gray-100">
          <button onClick={onClose}
            className="px-5 py-2 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition font-medium">
            Annuler
          </button>
          <button onClick={handleSave} disabled={!slot || !date || saving}
            className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition shadow-sm">
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
        active ? 'bg-orange-500 shadow-sm' : 'hover:bg-gray-100 text-gray-400'
      }`}>
      {icon}
    </button>
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

  // Waitlist
  const [waitlistJoined,  setWaitlistJoined]  = useState(false);
  const [waitlistLoading, setWaitlistLoading] = useState(false);

  useEffect(() => {
    api.get('/availability')
      .then((r) => setAvailableDays([...new Set(r.data.map((a) => a.day_of_week))]))
      .catch(console.error);
    fetchBookings();
  }, []);

  useEffect(() => {
    if (!selectedDate) { setSlots([]); setSelectedSlot(null); return; }
    setSlotsLoading(true);
    setWaitlistJoined(false);
    api.get(`/availability/slots/${selectedDate}?duration=${duration}`)
      .then((r) => setSlots(r.data.slots || []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
    setSelectedSlot(null);
  }, [selectedDate, duration]);

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
      fetchBookings();
    } catch (err) {
      alert(err.response?.data?.error || 'Échec de la réservation');
    } finally {
      setConfirming(false);
    }
  };

  const handleJoinWaitlist = async () => {
    if (!selectedDate) return;
    setWaitlistLoading(true);
    try {
      await api.post('/recurring/waitlist', { date: selectedDate, start_time: '09:00', duration });
      setWaitlistJoined(true);
    } catch (err) {
      alert(err.response?.data?.error || "Échec de l'inscription à la liste d'attente");
    } finally {
      setWaitlistLoading(false);
    }
  };

  const handleCancel = async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir annuler cette séance ?')) return;
    try {
      await api.delete(`/bookings/${id}`);
      fetchBookings();
    } catch (err) {
      alert(err.response?.data?.error || "Échec de l'annulation");
    }
  };

  const isBookingPast = (booking) => new Date(`${booking.date}T${booking.end_time}`) < new Date();
  const selectedDuration = getDuration(duration);

  // KPI data
  const confirmedBookings = bookings.filter(b => b.status === 'confirmed');
  const upcomingBookings  = confirmedBookings.filter(b => new Date(`${b.date}T${b.start_time}`) > new Date())
                              .sort((a, b) => new Date(a.date) - new Date(b.date));
  const totalHours        = confirmedBookings.reduce((s, b) => s + parseInt(b.duration), 0) / 60;
  const totalSpent        = confirmedBookings.reduce((s, b) => s + (durPrice(b.duration) || 0), 0);
  const nextSession       = upcomingBookings[0];

  // Avatar initials
  const initials = `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase();

  const navItems = [
    { id: 'book',     icon: '📅', label: 'Réserver' },
    { id: 'bookings', icon: '📋', label: 'Mes séances' },
  ];

  return (
    <div className="flex h-screen bg-[#f2f1ef] overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="hidden md:flex w-16 bg-white border-r border-gray-100 flex-col items-center py-5 gap-2 fixed h-full z-20 shadow-sm">
        {/* Logo */}
        <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-sm mb-3">
          <span className="text-lg">📚</span>
        </div>

        <div className="flex-1 flex flex-col items-center gap-1 mt-2">
          <SideIcon icon="📅" label="Réserver" active={tab === 'book'} onClick={() => setTab('book')} />
          <SideIcon icon="📋" label="Mes séances" active={tab === 'bookings'} onClick={() => setTab('bookings')} />
          <SideIcon icon="📈" label="Progression" active={false} onClick={() => navigate('/progress')} />
          <SideIcon icon="👤" label="Profil" active={false} onClick={() => navigate('/profile')} />
          <SideIcon icon="🧾" label="Factures" active={false} onClick={() => navigate('/invoices')} />
        </div>

        <button onClick={logout} title="Déconnexion"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 transition text-lg">
          ↩
        </button>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 md:ml-16 flex flex-col overflow-hidden">

        {/* ── Top bar ── */}
        <header className="bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 leading-tight truncate">
              Bonjour, {user.first_name} 👋
            </h1>
            <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">
              Gérez vos séances et suivez votre progression
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Pill nav — desktop */}
            <nav className="hidden lg:flex bg-gray-100 rounded-full p-1 gap-1">
              {navItems.map(n => (
                <button key={n.id} onClick={() => setTab(n.id)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                    tab === n.id ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'
                  }`}>
                  {n.label}
                </button>
              ))}
              <button onClick={() => navigate('/progress')}
                className="px-4 py-1.5 rounded-full text-sm font-medium text-gray-500 hover:text-gray-800 transition">
                Progression
              </button>
            </nav>

            {/* Bell */}
            <button className="w-9 h-9 border border-gray-200 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-50 transition text-base">
              🔔
            </button>

            {/* Avatar */}
            <div className="w-9 h-9 bg-orange-100 rounded-full flex items-center justify-center font-bold text-orange-600 text-sm border border-orange-200">
              {initials}
            </div>
          </div>
        </header>

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* ── KPI Row ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Next session — orange accent card */}
            <div className="bg-orange-500 rounded-2xl p-4 text-white col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-orange-100">Prochaine séance</p>
                <span className="text-xl">📅</span>
              </div>
              {nextSession ? (
                <>
                  <p className="text-lg font-bold leading-tight capitalize">{fmtDateShort(nextSession.date)}</p>
                  <p className="text-sm text-orange-100 mt-1">{fmtTime(nextSession.start_time)} · {durLabel(nextSession.duration)}</p>
                  <p className="text-xs text-orange-200 mt-1 font-semibold">↑ {durPrice(nextSession.duration)}€</p>
                </>
              ) : (
                <p className="text-sm text-orange-200 mt-1">Aucune séance à venir</p>
              )}
            </div>

            {/* Upcoming count */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-400">À venir</p>
                <span className="text-xl">🗓</span>
              </div>
              <p className="text-3xl font-extrabold text-gray-900">{upcomingBookings.length}</p>
              <p className="text-xs text-gray-400 mt-1">séances confirmées</p>
            </div>

            {/* Total hours */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-400">Heures totales</p>
                <span className="text-xl">⏱</span>
              </div>
              <p className="text-3xl font-extrabold text-gray-900">{Math.round(totalHours * 10) / 10}</p>
              <p className="text-xs text-gray-400 mt-1">heures de cours</p>
            </div>

            {/* Total spent */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-400">Total payé</p>
                <span className="text-xl">💶</span>
              </div>
              <p className="text-3xl font-extrabold text-gray-900">{totalSpent}<span className="text-lg text-gray-400">€</span></p>
              <p className="text-xs text-gray-400 mt-1">sur {confirmedBookings.length} séances</p>
            </div>
          </div>

          {/* ── Book Session Tab ── */}
          {tab === 'book' && (
            bookingSuccess ? (
              <div className="max-w-lg mx-auto">
                <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                  <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-4xl">✅</span>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">Séance réservée !</h2>
                  <p className="text-gray-400 text-sm mb-6">Un e-mail de confirmation a été envoyé.</p>
                  <div className="bg-gray-50 rounded-2xl p-5 text-left space-y-3 text-sm mb-6">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Date</span>
                      <span className="font-semibold text-gray-900 capitalize">{fmtDate(bookingSuccess.date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Horaire</span>
                      <span className="font-semibold text-gray-900">{fmtTime(bookingSuccess.start_time)} — {fmtTime(bookingSuccess.end_time)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Durée</span>
                      <span className="font-semibold text-gray-900">{durLabel(bookingSuccess.duration)}</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-200 pt-3">
                      <span className="text-gray-400">Tarif</span>
                      <span className="font-bold text-orange-500 text-base">{durPrice(bookingSuccess.duration)} €</span>
                    </div>
                    {bookingSuccess.meet_link && (
                      <div className="border-t border-gray-200 pt-3">
                        <p className="text-gray-400 mb-1">Lien de la séance</p>
                        <a href={bookingSuccess.meet_link} target="_blank" rel="noopener noreferrer"
                          className="text-orange-500 hover:underline break-all font-medium text-xs">
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
                      className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold transition shadow-sm">
                      Voir mes séances
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Left */}
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="w-6 h-6 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center font-bold">1</span>
                      <h2 className="text-sm font-semibold text-gray-700">Choisir une date</h2>
                    </div>
                    <MiniCalendar
                      selected={selectedDate}
                      onSelect={(d) => { setSelectedDate(d); setSelectedSlot(null); }}
                      availableDays={availableDays}
                    />
                  </div>

                  <div className="bg-white rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="w-6 h-6 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center font-bold">2</span>
                      <h2 className="text-sm font-semibold text-gray-700">Durée & Tarif</h2>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {DURATIONS.map((d) => (
                        <button key={d.value}
                          onClick={() => { setDuration(d.value); setSelectedSlot(null); }}
                          className={`py-4 px-2 rounded-2xl transition flex flex-col items-center gap-1 ${
                            duration === d.value
                              ? 'bg-orange-500 text-white shadow-md'
                              : 'bg-gray-50 text-gray-600 hover:bg-orange-50 border border-gray-200'
                          }`}>
                          <span className="text-sm font-bold">{d.label}</span>
                          <span className={`text-base font-extrabold ${duration === d.value ? 'text-white' : 'text-orange-500'}`}>{d.price}€</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right */}
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="w-6 h-6 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center font-bold">3</span>
                      <h2 className="text-sm font-semibold text-gray-700">Choisir un créneau</h2>
                    </div>
                    <SlotGrid
                      slots={slots}
                      selected={selectedSlot}
                      onSelect={setSelectedSlot}
                      loading={slotsLoading}
                      selectedDate={selectedDate}
                    />

                    {selectedDate && !slotsLoading && slots.length === 0 && (
                      <div className="text-center mt-4">
                        {waitlistJoined ? (
                          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-800 text-sm font-medium">
                            ✅ Vous êtes sur la liste d'attente pour ce jour !
                          </div>
                        ) : (
                          <button onClick={handleJoinWaitlist} disabled={waitlistLoading}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50">
                            {waitlistLoading ? 'Inscription…' : "🔔 Rejoindre la liste d'attente"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {selectedSlot && (
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-orange-100">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-gray-900">Récapitulatif</h3>
                        <span className="text-2xl font-extrabold text-orange-500">{selectedDuration?.price}€</span>
                      </div>
                      <div className="space-y-2 text-sm text-gray-500 mb-5">
                        <div className="flex items-center gap-2">
                          <span>📅</span>
                          <span className="capitalize">{fmtDate(selectedDate)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>⏰</span>
                          <span>{fmtTime(selectedSlot.start)} — {fmtTime(selectedSlot.end)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>⏱</span>
                          <span>{selectedDuration?.label}</span>
                        </div>
                      </div>
                      <button onClick={handleBook} disabled={confirming}
                        className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition disabled:opacity-60 text-sm shadow-sm">
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
            )
          )}

          {/* ── My Bookings Tab ── */}
          {tab === 'bookings' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900">Mes séances récentes</h2>
                <button onClick={fetchBookings}
                  className="text-sm text-orange-500 hover:text-orange-600 font-semibold flex items-center gap-1 px-3 py-1.5 bg-white rounded-xl border border-gray-200 shadow-sm transition">
                  ↻ Actualiser
                </button>
              </div>

              {bookingsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
                </div>
              ) : bookings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-white rounded-2xl shadow-sm">
                  <span className="text-5xl mb-3">📋</span>
                  <p className="font-semibold text-gray-500">Aucune séance pour le moment</p>
                  <button onClick={() => setTab('book')}
                    className="mt-4 px-5 py-2 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 transition shadow-sm">
                    Réserver une séance
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  {/* Table header */}
                  <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    <div className="col-span-4">Date</div>
                    <div className="col-span-2 hidden sm:block">Durée</div>
                    <div className="col-span-2 hidden md:block">Tarif</div>
                    <div className="col-span-2">Statut</div>
                    <div className="col-span-2 text-right">Actions</div>
                  </div>

                  {bookings.map((b, idx) => (
                    <div key={b.id}
                      className={`grid grid-cols-12 gap-4 px-5 py-4 items-center transition ${
                        idx !== bookings.length - 1 ? 'border-b border-gray-50' : ''
                      } ${b.status === 'canceled' ? 'opacity-50' : 'hover:bg-gray-50/50'}`}>
                      {/* Date */}
                      <div className="col-span-4">
                        <p className="font-semibold text-gray-900 text-sm capitalize">{fmtDateShort(b.date)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{fmtTime(b.start_time)} — {fmtTime(b.end_time)}</p>
                        {b.meet_link && b.status !== 'canceled' && (
                          <a href={b.meet_link} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-orange-500 hover:underline font-semibold mt-0.5 inline-block">
                            🔗 Rejoindre
                          </a>
                        )}
                      </div>

                      {/* Duration */}
                      <div className="col-span-2 hidden sm:block">
                        <span className="text-sm text-gray-600">{durLabel(b.duration)}</span>
                      </div>

                      {/* Price */}
                      <div className="col-span-2 hidden md:block">
                        <span className="font-bold text-gray-900 text-sm">{durPrice(b.duration)}€</span>
                      </div>

                      {/* Status */}
                      <div className="col-span-2">
                        <StatusDot status={b.status} />
                        {b.student_rating > 0 && (
                          <p className="text-amber-400 text-xs mt-1">{'★'.repeat(b.student_rating)}</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="col-span-4 md:col-span-2 flex items-center justify-end gap-1.5 flex-wrap">
                        {b.status !== 'canceled' && (
                          <>
                            {isBookingPast(b) && !b.student_rating && (
                              <button onClick={() => setRatingTarget(b)}
                                className="px-2.5 py-1 text-xs border border-amber-200 text-amber-600 rounded-lg hover:bg-amber-50 transition font-semibold">
                                ⭐
                              </button>
                            )}
                            {!isBookingPast(b) && (
                              <button onClick={() => setModifyTarget(b)}
                                className="px-2.5 py-1 text-xs border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition font-semibold">
                                ✏️
                              </button>
                            )}
                            <button onClick={() => handleCancel(b.id)}
                              className="px-2.5 py-1 text-xs border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition font-semibold">
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
