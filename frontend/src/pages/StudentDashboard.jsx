import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import RatingModal from '../components/RatingModal';
import { useNavigate } from 'react-router-dom';

const DAYS_SHORT = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
const MONTHS     = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const DURATIONS  = [
  { value: 60,  label: '1h',       price: 15 },
  { value: 90,  label: '1h 30min', price: 18 },
  { value: 120, label: '2h',       price: 25 },
];

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

function StatusDot({ status }) {
  const map = { confirmed: 'bg-emerald-400', canceled: 'bg-red-400' };
  const labels = { confirmed: 'Confirmé', canceled: 'Annulé' };
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full inline-block ${map[status] ?? 'bg-slate-400'}`} />
      <span className="text-xs font-medium text-slate-600">{labels[status] ?? status}</span>
    </span>
  );
}

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
    <div className="bg-white rounded-3xl p-4 select-none shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setView(new Date(year, month - 1, 1))}
          className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 flex items-center justify-center font-bold">‹</button>
        <span className="font-semibold text-slate-800 text-sm capitalize">{MONTHS[month]} {year}</span>
        <button onClick={() => setView(new Date(year, month + 1, 1))}
          className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 flex items-center justify-center font-bold">›</button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS_SHORT.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-slate-300 py-1">{d}</div>
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
                'aspect-square flex items-center justify-center text-xs rounded-lg font-medium transition',
                isSel    ? 'bg-cyan-400 text-white'                          : '',
                !isSel && isAvail ? 'hover:bg-cyan-50 text-slate-800 cursor-pointer' : '',
                !isAvail ? 'text-slate-200 cursor-not-allowed'               : '',
                isToday && !isSel ? 'ring-2 ring-cyan-300 text-cyan-600'     : '',
              ].join(' ')}>
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SlotGrid({ slots, selected, onSelect, loading, selectedDate }) {
  if (!selectedDate) return (
    <div className="flex flex-col items-center justify-center h-40 rounded-3xl text-slate-400 bg-slate-50">
      <span className="text-3xl mb-2">📅</span>
      <p className="text-xs font-medium">Sélectionnez une date</p>
    </div>
  );
  if (loading) return (
    <div className="flex items-center justify-center h-40 rounded-3xl bg-white shadow-sm">
      <span className="animate-spin rounded-full h-6 w-6 border-2 border-cyan-400 border-t-transparent" />
    </div>
  );
  if (!slots.length) return (
    <div className="flex flex-col items-center justify-center h-40 rounded-3xl text-slate-400 bg-white shadow-sm">
      <span className="text-3xl mb-2">😕</span>
      <p className="text-xs font-medium">Aucun créneau disponible</p>
    </div>
  );

  const amSlots = slots.filter((s) => parseInt(s.start.split(':')[0]) < 12);
  const pmSlots = slots.filter((s) => parseInt(s.start.split(':')[0]) >= 12);

  const SlotButton = ({ slot }) => (
    <button onClick={() => onSelect(slot)}
      className={[
        'py-2.5 px-3 rounded-lg text-sm font-semibold transition',
        selected?.start === slot.start
          ? 'bg-cyan-400 text-white'
          : 'bg-slate-50 text-slate-700 hover:bg-cyan-50 border border-slate-200',
      ].join(' ')}>
      {fmtTime(slot.start)}
    </button>
  );

  return (
    <div className="bg-white rounded-3xl p-4 shadow-sm space-y-3">
      <p className="text-xs text-slate-400">{fmtDate(selectedDate)} — <span className="font-medium text-slate-600">{slots.length} créneau{slots.length > 1 ? 'x' : ''}</span></p>
      {amSlots.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-2">Matin</p>
          <div className="grid grid-cols-3 gap-1.5">
            {amSlots.map((slot) => <SlotButton key={slot.start} slot={slot} />)}
          </div>
        </div>
      )}
      {pmSlots.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-2">Après-midi</p>
          <div className="grid grid-cols-3 gap-1.5">
            {pmSlots.map((slot) => <SlotButton key={slot.start} slot={slot} />)}
          </div>
        </div>
      )}
    </div>
  );
}

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
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Modifier la réservation</h2>
            <p className="text-xs text-slate-400 mt-0.5">Choisissez un nouveau créneau</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition">✕</button>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-5 text-sm text-amber-800">
            <span>📌</span>
            Actuel : {fmtDate(booking.date)} à {fmtTime(booking.start_time)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-slate-800 mb-2 text-sm">Nouvelle date</h3>
                <MiniCalendar selected={date} onSelect={setDate} availableDays={availableDays} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 mb-2 text-sm">Durée</h3>
                <div className="grid grid-cols-3 gap-2">
                  {DURATIONS.map((d) => (
                    <button key={d.value} onClick={() => { setDuration(d.value); setSlot(null); }}
                      className={`py-2.5 rounded-lg text-xs font-semibold transition flex flex-col items-center gap-0.5 ${duration === d.value ? 'bg-cyan-400 text-white' : 'bg-slate-50 text-slate-700 border border-slate-200'}`}>
                      <span>{d.label}</span>
                      <span className={`font-bold ${duration === d.value ? 'text-cyan-100' : 'text-cyan-600'}`}>{d.price}€</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 mb-2 text-sm">Nouveau créneau</h3>
              <SlotGrid slots={slots} selected={slot} onSelect={setSlot} loading={loading} selectedDate={date} />
              {slot && date && (
                <div className="mt-3 bg-cyan-50 rounded-2xl p-3 text-sm text-cyan-800 space-y-0.5 border border-cyan-100">
                  <p>📅 {fmtDate(date)}</p>
                  <p>⏰ {fmtTime(slot.start)} — {fmtTime(slot.end)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-3 justify-end px-6 py-4 border-t border-slate-100">
          <button onClick={onClose}
            className="px-5 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 transition font-medium">Annuler</button>
          <button onClick={handleSave} disabled={!slot || !date || saving}
            className="px-5 py-2 bg-cyan-400 hover:bg-cyan-500 text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition">
            {saving ? 'Enregistrement…' : 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SideIcon({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} title={label}
      className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition ${
        active ? 'bg-cyan-400 text-white' : 'hover:bg-slate-100 text-slate-400'
      }`}>
      {icon}
    </button>
  );
}

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('book');
  const [availableDays, setAvailableDays] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [duration, setDuration] = useState(60);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [modifyTarget, setModifyTarget] = useState(null);
  const [ratingTarget, setRatingTarget] = useState(null);
  const [waitlistJoined, setWaitlistJoined] = useState(false);
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
    if (!confirm('Êtes-vous sûr?')) return;
    try {
      await api.delete(`/bookings/${id}`);
      fetchBookings();
    } catch (err) {
      alert(err.response?.data?.error || "Échec de l'annulation");
    }
  };

  const isBookingPast = (booking) => new Date(`${booking.date}T${booking.end_time}`) < new Date();
  const selectedDuration = getDuration(duration);
  const confirmedBookings = bookings.filter(b => b.status === 'confirmed');
  const upcomingBookings  = confirmedBookings.filter(b => new Date(`${b.date}T${b.start_time}`) > new Date())
                              .sort((a, b) => new Date(a.date) - new Date(b.date));
  const totalHours        = confirmedBookings.reduce((s, b) => s + parseInt(b.duration), 0) / 60;
  const totalSpent        = confirmedBookings.reduce((s, b) => s + (durPrice(b.duration) || 0), 0);
  const nextSession       = upcomingBookings[0];
  const initials = `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase();

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">

      {/* Sidebar */}
      <aside className="hidden md:flex w-16 bg-white border-r border-slate-200 flex-col items-center py-5 gap-2 fixed h-full z-20 shadow-sm">
        <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center mb-3">
          <span className="text-lg">📚</span>
        </div>
        <div className="flex-1 flex flex-col items-center gap-1">
          <SideIcon icon="📅" label="Réserver" active={tab === 'book'} onClick={() => setTab('book')} />
          <SideIcon icon="📋" label="Mes séances" active={tab === 'bookings'} onClick={() => setTab('bookings')} />
          <SideIcon icon="📈" label="Progression" active={false} onClick={() => navigate('/progress')} />
          <SideIcon icon="👤" label="Profil" active={false} onClick={() => navigate('/profile')} />
          <SideIcon icon="🧾" label="Factures" active={false} onClick={() => navigate('/invoices')} />
        </div>
        <button onClick={logout} className="w-10 h-10 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 transition">↩</button>
      </aside>

      <div className="flex-1 md:ml-16 flex flex-col overflow-hidden">

        {/* Top bar */}
        <header className="bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between gap-4 shrink-0 shadow-sm">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900">Bonjour, {user.first_name} 👋</h1>
            <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">Gérez vos séances et votre apprentissage</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <nav className="hidden lg:flex bg-slate-100 rounded-full p-1 gap-1">
              {[
                { id: 'book', label: 'Réserver' },
                { id: 'bookings', label: 'Séances' },
              ].map(n => (
                <button key={n.id} onClick={() => setTab(n.id)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                    tab === n.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-800'
                  }`}>
                  {n.label}
                </button>
              ))}
            </nav>
            <button className="w-9 h-9 border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-50">🔔</button>
            <div className="w-9 h-9 bg-cyan-400 rounded-full flex items-center justify-center font-bold text-white text-sm border border-cyan-300">{initials}</div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Next session */}
            <div className="bg-gradient-to-br from-cyan-400 to-blue-500 rounded-3xl p-4 text-white col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-cyan-100">Prochaine séance</p>
                <span className="text-xl">📅</span>
              </div>
              {nextSession ? (
                <>
                  <p className="text-lg font-bold capitalize">{fmtDateShort(nextSession.date)}</p>
                  <p className="text-sm text-cyan-100 mt-1">{fmtTime(nextSession.start_time)}</p>
                </>
              ) : (
                <p className="text-sm text-cyan-200">Aucune séance</p>
              )}
            </div>

            {/* Upcoming */}
            <div className="bg-white rounded-3xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-400">À venir</p>
                <span className="text-xl">🗓</span>
              </div>
              <p className="text-3xl font-extrabold text-slate-900">{upcomingBookings.length}</p>
              <p className="text-xs text-slate-400 mt-1">séances</p>
            </div>

            {/* Hours */}
            <div className="bg-white rounded-3xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-400">Heures</p>
                <span className="text-xl">⏱</span>
              </div>
              <p className="text-3xl font-extrabold text-slate-900">{Math.round(totalHours * 10) / 10}</p>
              <p className="text-xs text-slate-400 mt-1">heures</p>
            </div>

            {/* Total paid */}
            <div className="bg-white rounded-3xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-400">Dépensé</p>
                <span className="text-xl">💶</span>
              </div>
              <p className="text-3xl font-extrabold text-slate-900">{totalSpent}€</p>
              <p className="text-xs text-slate-400 mt-1">{confirmedBookings.length} séances</p>
            </div>
          </div>

          {/* Book Tab */}
          {tab === 'book' && (
            bookingSuccess ? (
              <div className="max-w-lg mx-auto">
                <div className="bg-white rounded-3xl p-8 text-center shadow-sm">
                  <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-4xl">✅</span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 mb-1">Séance réservée!</h2>
                  <p className="text-slate-400 text-sm mb-6">Confirmation envoyée par email.</p>
                  <div className="bg-slate-50 rounded-2xl p-5 text-left space-y-3 text-sm mb-6 border border-slate-100">
                    <div className="flex justify-between"><span className="text-slate-400">Date</span><span className="font-semibold text-slate-900 capitalize">{fmtDate(bookingSuccess.date)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Horaire</span><span className="font-semibold text-slate-900">{fmtTime(bookingSuccess.start_time)}</span></div>
                    <div className="flex justify-between border-t border-slate-200 pt-3"><span className="text-slate-400">Tarif</span><span className="font-bold text-cyan-600">{durPrice(bookingSuccess.duration)}€</span></div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setBookingSuccess(null)}
                      className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 font-medium">Nouvelle</button>
                    <button onClick={() => { setBookingSuccess(null); setTab('bookings'); }}
                      className="flex-1 py-2.5 bg-cyan-400 hover:bg-cyan-500 text-white rounded-lg text-sm font-semibold">Voir mes séances</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="space-y-4">
                  <div className="bg-white rounded-3xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="w-6 h-6 bg-cyan-400 text-white text-xs rounded-full flex items-center justify-center font-bold">1</span>
                      <h2 className="text-sm font-semibold text-slate-700">Choisir une date</h2>
                    </div>
                    <MiniCalendar selected={selectedDate} onSelect={(d) => { setSelectedDate(d); setSelectedSlot(null); }} availableDays={availableDays} />
                  </div>

                  <div className="bg-white rounded-3xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="w-6 h-6 bg-cyan-400 text-white text-xs rounded-full flex items-center justify-center font-bold">2</span>
                      <h2 className="text-sm font-semibold text-slate-700">Durée & Tarif</h2>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {DURATIONS.map((d) => (
                        <button key={d.value}
                          onClick={() => { setDuration(d.value); setSelectedSlot(null); }}
                          className={`py-4 px-2 rounded-2xl transition flex flex-col items-center gap-1 ${
                            duration === d.value ? 'bg-cyan-400 text-white' : 'bg-slate-50 border border-slate-200'
                          }`}>
                          <span className="text-sm font-bold">{d.label}</span>
                          <span className={`font-extrabold ${duration === d.value ? 'text-cyan-100' : 'text-cyan-600'}`}>{d.price}€</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-white rounded-3xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="w-6 h-6 bg-cyan-400 text-white text-xs rounded-full flex items-center justify-center font-bold">3</span>
                      <h2 className="text-sm font-semibold text-slate-700">Choisir un créneau</h2>
                    </div>
                    <SlotGrid slots={slots} selected={selectedSlot} onSelect={setSelectedSlot} loading={slotsLoading} selectedDate={selectedDate} />
                    {selectedDate && !slotsLoading && slots.length === 0 && (
                      <div className="text-center mt-4">
                        {waitlistJoined ? (
                          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-emerald-800 text-sm font-medium">
                            ✅ Sur la liste d'attente!
                          </div>
                        ) : (
                          <button onClick={handleJoinWaitlist} disabled={waitlistLoading}
                            className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50">
                            {waitlistLoading ? 'Inscription…' : "🔔 Liste d'attente"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {selectedSlot && (
                    <div className="bg-white rounded-3xl p-5 shadow-sm border-2 border-cyan-200">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-slate-900">Récapitulatif</h3>
                        <span className="text-2xl font-extrabold text-cyan-600">{selectedDuration?.price}€</span>
                      </div>
                      <div className="space-y-2 text-sm text-slate-600 mb-5">
                        <div className="flex items-center gap-2"><span>📅</span><span className="capitalize">{fmtDate(selectedDate)}</span></div>
                        <div className="flex items-center gap-2"><span>⏰</span><span>{fmtTime(selectedSlot.start)} — {fmtTime(selectedSlot.end)}</span></div>
                        <div className="flex items-center gap-2"><span>⏱</span><span>{selectedDuration?.label}</span></div>
                      </div>
                      <button onClick={handleBook} disabled={confirming}
                        className="w-full py-3 bg-cyan-400 hover:bg-cyan-500 text-white font-bold rounded-2xl transition disabled:opacity-60 text-sm shadow-sm">
                        {confirming
                          ? <span className="flex items-center justify-center gap-2">
                              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> Confirmation…
                            </span>
                          : 'Confirmer'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          )}

          {/* Bookings Tab */}
          {tab === 'bookings' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-slate-900">Mes séances</h2>
                <button onClick={fetchBookings}
                  className="text-sm text-cyan-600 hover:text-cyan-700 font-semibold px-3 py-1.5 bg-white rounded-lg border border-slate-200 shadow-sm">
                  ↻ Actualiser
                </button>
              </div>

              {bookingsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <span className="animate-spin rounded-full h-8 w-8 border-2 border-cyan-400 border-t-transparent" />
                </div>
              ) : bookings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-white rounded-3xl shadow-sm">
                  <span className="text-5xl mb-3">📋</span>
                  <p className="font-semibold text-slate-500">Aucune séance</p>
                  <button onClick={() => setTab('book')}
                    className="mt-4 px-5 py-2 bg-cyan-400 text-white rounded-lg text-sm font-semibold hover:bg-cyan-500">
                    Réserver une séance
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
                  <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase">
                    <div className="col-span-4">Date</div>
                    <div className="col-span-2 hidden sm:block">Durée</div>
                    <div className="col-span-2 hidden md:block">Tarif</div>
                    <div className="col-span-2">Statut</div>
                    <div className="col-span-2 text-right">Actions</div>
                  </div>

                  {bookings.map((b, idx) => (
                    <div key={b.id}
                      className={`grid grid-cols-12 gap-4 px-5 py-4 items-center transition ${
                        idx !== bookings.length - 1 ? 'border-b border-slate-50' : ''
                      } ${b.status === 'canceled' ? 'opacity-50' : 'hover:bg-slate-50/50'}`}>
                      <div className="col-span-4">
                        <p className="font-semibold text-slate-900 text-sm capitalize">{fmtDateShort(b.date)}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{fmtTime(b.start_time)}</p>
                      </div>
                      <div className="col-span-2 hidden sm:block">
                        <span className="text-sm text-slate-600">{durLabel(b.duration)}</span>
                      </div>
                      <div className="col-span-2 hidden md:block">
                        <span className="font-bold text-slate-900">{durPrice(b.duration)}€</span>
                      </div>
                      <div className="col-span-2">
                        <StatusDot status={b.status} />
                      </div>
                      <div className="col-span-4 md:col-span-2 flex items-center justify-end gap-1.5">
                        {b.status !== 'canceled' && (
                          <>
                            {isBookingPast(b) && !b.student_rating && (
                              <button onClick={() => setRatingTarget(b)}
                                className="px-2.5 py-1 text-xs border border-amber-200 text-amber-600 rounded-lg hover:bg-amber-50 font-semibold">⭐</button>
                            )}
                            {!isBookingPast(b) && (
                              <button onClick={() => setModifyTarget(b)}
                                className="px-2.5 py-1 text-xs border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 font-semibold">✏️</button>
                            )}
                            <button onClick={() => handleCancel(b.id)}
                              className="px-2.5 py-1 text-xs border border-red-200 text-red-500 rounded-lg hover:bg-red-50 font-semibold">✕</button>
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
        <ModifyModal booking={modifyTarget} availableDays={availableDays}
          onClose={() => setModifyTarget(null)}
          onSaved={() => { setModifyTarget(null); fetchBookings(); }}
        />
      )}
      {ratingTarget && (
        <RatingModal booking={ratingTarget}
          onClose={() => setRatingTarget(null)}
          onRatingSubmitted={() => { setRatingTarget(null); fetchBookings(); }}
        />
      )}
    </div>
  );
}
