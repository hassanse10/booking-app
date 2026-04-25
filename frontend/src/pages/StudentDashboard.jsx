import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

// ── Constants ─────────────────────────────────────────────────────────────────
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS     = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
const DURATIONS  = [
  { value: 60,  label: '1 hour' },
  { value: 90,  label: '1h 30min' },
  { value: 120, label: '2 hours' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (d) => {
  const s = typeof d === 'string' && d.includes('T') ? d.split('T')[0] : d;
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
};

const fmtTime = (t) => {
  const [h, m] = t.substring(0, 5).split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${String(m).padStart(2,'0')} ${ap}`;
};

const durLabel = (v) => DURATIONS.find((d) => d.value === parseInt(v))?.label ?? `${v} min`;

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const map = { confirmed: 'bg-green-100 text-green-700', canceled: 'bg-red-100 text-red-700' };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
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
    <div className="bg-white rounded-xl border border-gray-200 p-4 select-none">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setView(new Date(year, month - 1, 1))}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500 font-bold">‹</button>
        <span className="font-semibold text-gray-800 text-sm">{MONTHS[month]} {year}</span>
        <button onClick={() => setView(new Date(year, month + 1, 1))}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500 font-bold">›</button>
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
                'aspect-square flex items-center justify-center text-xs rounded-lg transition font-medium',
                isSel    ? 'bg-indigo-600 text-white'                               : '',
                !isSel && isAvail ? 'hover:bg-indigo-50 text-gray-800 cursor-pointer' : '',
                !isAvail ? 'text-gray-300 cursor-not-allowed'                       : '',
                isToday && !isSel ? 'ring-2 ring-indigo-400'                        : '',
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

function SlotGrid({ slots, selected, onSelect, loading, selectedDate }) {
  if (!selectedDate)
    return (
      <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-gray-200 rounded-xl text-gray-400">
        <span className="text-4xl mb-2">📅</span>
        <p className="text-sm">Pick a date to see available slots</p>
      </div>
    );
  if (loading)
    return (
      <div className="flex items-center justify-center h-48 border border-gray-200 rounded-xl">
        <span className="animate-spin rounded-full h-7 w-7 border-b-2 border-indigo-600" />
      </div>
    );
  if (!slots.length)
    return (
      <div className="flex flex-col items-center justify-center h-48 border border-gray-200 rounded-xl text-gray-400 bg-white">
        <span className="text-4xl mb-2">😕</span>
        <p className="text-sm font-medium">No slots available</p>
        <p className="text-xs mt-1">Try another date or duration</p>
      </div>
    );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-3">{fmtDate(selectedDate)} — {slots.length} slot{slots.length > 1 ? 's' : ''} available</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto scrollbar-thin">
        {slots.map((slot) => (
          <button
            key={slot.start}
            onClick={() => onSelect(slot)}
            className={[
              'py-2.5 px-3 rounded-lg text-sm font-medium border transition',
              selected?.start === slot.start
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'border-gray-200 text-gray-700 hover:border-indigo-400 hover:text-indigo-600',
            ].join(' ')}
          >
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
      alert(err.response?.data?.error || 'Failed to modify booking');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Reschedule Booking</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <div className="p-6">
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 text-sm text-amber-800">
            <span>📌</span>
            Current: {fmtDate(booking.date)} at {fmtTime(booking.start_time)}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-gray-900 mb-2 text-sm">New Date</h3>
                <MiniCalendar selected={date} onSelect={setDate} availableDays={availableDays} />
              </div>
              <div>
                <h3 className="font-medium text-gray-900 mb-2 text-sm">Duration</h3>
                <div className="grid grid-cols-3 gap-2">
                  {DURATIONS.map((d) => (
                    <button key={d.value} onClick={() => { setDuration(d.value); setSlot(null); }}
                      className={`py-2 rounded-xl text-sm font-medium border transition ${duration === d.value ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-700 hover:border-indigo-300'}`}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 mb-2 text-sm">New Time Slot</h3>
              <SlotGrid slots={slots} selected={slot} onSelect={setSlot}
                loading={loading} selectedDate={date} />
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
            className="px-5 py-2 border border-gray-300 rounded-xl text-sm hover:bg-gray-50 transition">
            Cancel
          </button>
          <button onClick={handleSave} disabled={!slot || !date || saving}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function StudentDashboard() {
  const { user, logout } = useAuth();
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

  // Load availability days on mount
  useEffect(() => {
    api.get('/availability')
      .then((r) => setAvailableDays([...new Set(r.data.map((a) => a.day_of_week))]))
      .catch(console.error);
  }, []);

  // Fetch slots when date or duration changes
  useEffect(() => {
    if (!selectedDate) { setSlots([]); setSelectedSlot(null); return; }
    setSlotsLoading(true);
    api.get(`/availability/slots/${selectedDate}?duration=${duration}`)
      .then((r) => setSlots(r.data.slots || []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
    setSelectedSlot(null);
  }, [selectedDate, duration]);

  // Load bookings when tab switches
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
      alert(err.response?.data?.error || 'Booking failed');
    } finally {
      setConfirming(false);
    }
  };

  const handleCancel = async (id) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    try {
      await api.delete(`/bookings/${id}`);
      fetchBookings();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to cancel');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
              <span className="text-lg">📚</span>
            </div>
            <div className="hidden sm:block">
              <p className="font-bold text-gray-900 text-sm leading-tight">Teacher Booking</p>
              <p className="text-xs text-gray-500">Student Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="font-semibold text-sm text-gray-900">
                {user.first_name} {user.last_name}
              </p>
              <p className="text-xs text-gray-400">{user.study_level}</p>
            </div>
            <button onClick={logout}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-600">
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-0">
        <div className="inline-flex gap-1 bg-gray-100 rounded-xl p-1">
          {[
            { id: 'book',     label: '📅 Book Session' },
            { id: 'bookings', label: '📋 My Bookings'  },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition ${tab === t.id ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Book Session ── */}
      {tab === 'book' && (
        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          {bookingSuccess ? (
            /* Success state */
            <div className="max-w-lg mx-auto bg-white rounded-2xl border border-green-200 shadow-sm p-8 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">✅</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Booking Confirmed!</h2>
              <p className="text-gray-500 text-sm mb-5">A confirmation email has been sent.</p>

              <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2 text-sm mb-5">
                <p><span className="text-gray-500">Date:</span> <strong>{fmtDate(bookingSuccess.date)}</strong></p>
                <p><span className="text-gray-500">Time:</span> <strong>{fmtTime(bookingSuccess.start_time)} — {fmtTime(bookingSuccess.end_time)}</strong></p>
                <p><span className="text-gray-500">Duration:</span> <strong>{durLabel(bookingSuccess.duration)}</strong></p>
                <div className="pt-1">
                  <p className="text-gray-500 mb-1">Meet link:</p>
                  <a href={bookingSuccess.meet_link} target="_blank" rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline break-all font-medium">
                    {bookingSuccess.meet_link}
                  </a>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setBookingSuccess(null)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition">
                  Book Another
                </button>
                <button onClick={() => { setBookingSuccess(null); setTab('bookings'); }}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition">
                  View Bookings
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left */}
              <div className="space-y-5">
                <div>
                  <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                    1 · Select Date
                  </h2>
                  <MiniCalendar
                    selected={selectedDate}
                    onSelect={(d) => { setSelectedDate(d); setSelectedSlot(null); }}
                    availableDays={availableDays}
                  />
                  {availableDays.length === 0 && (
                    <p className="text-xs text-gray-400 text-center mt-2">
                      No availability set by the teacher yet.
                    </p>
                  )}
                </div>

                <div>
                  <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                    2 · Choose Duration
                  </h2>
                  <div className="grid grid-cols-3 gap-2">
                    {DURATIONS.map((d) => (
                      <button key={d.value}
                        onClick={() => { setDuration(d.value); setSelectedSlot(null); }}
                        className={`py-3 rounded-xl text-sm font-semibold border-2 transition ${duration === d.value ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:border-indigo-300 bg-white'}`}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right */}
              <div className="space-y-4">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  3 · Pick a Time Slot
                </h2>
                <SlotGrid
                  slots={slots}
                  selected={selectedSlot}
                  onSelect={setSelectedSlot}
                  loading={slotsLoading}
                  selectedDate={selectedDate}
                />

                {selectedSlot && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5">
                    <h3 className="font-semibold text-indigo-900 mb-3">Booking Summary</h3>
                    <div className="space-y-1 text-sm text-indigo-800 mb-4">
                      <p>📅 {fmtDate(selectedDate)}</p>
                      <p>⏰ {fmtTime(selectedSlot.start)} — {fmtTime(selectedSlot.end)}</p>
                      <p>⏱ {durLabel(duration)}</p>
                    </div>
                    <button onClick={handleBook} disabled={confirming}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition disabled:opacity-60">
                      {confirming
                        ? <span className="flex items-center justify-center gap-2">
                            <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Booking…
                          </span>
                        : 'Confirm Booking'}
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">My Sessions</h2>
            <button onClick={fetchBookings}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">↻ Refresh</button>
          </div>

          {bookingsLoading ? (
            <div className="flex items-center justify-center py-16">
              <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : bookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <span className="text-5xl mb-3">📋</span>
              <p className="font-medium">No bookings yet</p>
              <button onClick={() => setTab('book')}
                className="mt-4 px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition">
                Book Your First Session
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.map((b) => (
                <div key={b.id}
                  className={`bg-white rounded-xl border p-5 transition ${b.status === 'canceled' ? 'border-gray-100 opacity-60' : 'border-gray-200 hover:shadow-sm'}`}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <StatusBadge status={b.status} />
                        <span className="text-xs text-gray-400">Booking #{b.id}</span>
                      </div>
                      <p className="font-semibold text-gray-900">{fmtDate(b.date)}</p>
                      <p className="text-sm text-gray-600 mt-0.5">
                        {fmtTime(b.start_time)} — {fmtTime(b.end_time)}
                        <span className="text-gray-400"> · {durLabel(b.duration)}</span>
                      </p>
                      {b.meet_link && b.status !== 'canceled' && (
                        <a href={b.meet_link} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline mt-1.5 font-medium">
                          🔗 Join Meeting
                        </a>
                      )}
                    </div>

                    {b.status !== 'canceled' && (
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => setModifyTarget(b)}
                          className="px-3 py-1.5 text-xs border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-50 transition font-medium">
                          Modify
                        </button>
                        <button onClick={() => handleCancel(b.id)}
                          className="px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition font-medium">
                          Cancel
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
    </div>
  );
}
