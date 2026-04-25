import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const DAYS       = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DUR_LABEL  = { 60: '1 hour', 90: '1h 30min', 120: '2 hours' };

const fmtDate = (d) => {
  const s = typeof d === 'string' && d.includes('T') ? d.split('T')[0] : d;
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
  });
};

const fmtTime = (t) => {
  const [h, m] = t.substring(0, 5).split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${String(m).padStart(2,'0')} ${ap}`;
};

function StatusBadge({ status }) {
  const map = {
    confirmed: 'bg-green-100 text-green-700',
    canceled:  'bg-red-100 text-red-700',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function TeacherDashboard() {
  const { user, logout } = useAuth();
  const [tab, setTab]    = useState('bookings');

  // Bookings
  const [bookings,        setBookings]        = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [statusFilter,    setStatusFilter]    = useState('all');

  // Availability
  const [availability, setAvailability]   = useState([]);
  const [availLoading, setAvailLoading]   = useState(true);
  const [showForm,     setShowForm]       = useState(false);
  const [form,         setForm]           = useState({ day_of_week: 1, start_time: '09:00', end_time: '17:00' });
  const [saving,       setSaving]         = useState(false);

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
    } catch (err) {
      console.error(err);
    } finally {
      setAvailLoading(false);
    }
  };

  const handleAddSlot = async () => {
    if (form.start_time >= form.end_time)
      return alert('Start time must be before end time');
    setSaving(true);
    try {
      await api.post('/availability', form);
      setShowForm(false);
      setForm({ day_of_week: 1, start_time: '09:00', end_time: '17:00' });
      fetchAvailability();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add slot');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSlot = async (id) => {
    if (!confirm('Remove this availability slot?')) return;
    try {
      await api.delete(`/availability/${id}`);
      fetchAvailability();
    } catch {
      alert('Failed to delete slot');
    }
  };

  const handleCancelBooking = async (id) => {
    if (!confirm('Cancel this booking?')) return;
    try {
      await api.delete(`/bookings/${id}`);
      fetchBookings();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to cancel');
    }
  };

  const filtered    = bookings.filter((b) => statusFilter === 'all' || b.status === statusFilter);
  const upcoming    = bookings.filter((b) => b.status === 'confirmed');
  const availByDay  = DAYS.reduce((acc, _, i) => {
    acc[i] = availability.filter((a) => a.day_of_week === i);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-purple-600 rounded-xl flex items-center justify-center">
              <span className="text-lg">🎓</span>
            </div>
            <div className="hidden sm:block">
              <p className="font-bold text-gray-900 text-sm leading-tight">Teacher Dashboard</p>
              <p className="text-xs text-gray-500">Admin Panel</p>
            </div>
          </div>

          {/* Stats */}
          <div className="hidden md:flex items-center gap-6 text-center">
            <div>
              <p className="text-lg font-bold text-indigo-600 leading-none">{upcoming.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">Confirmed</p>
            </div>
            <div>
              <p className="text-lg font-bold text-gray-700 leading-none">{bookings.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">Total</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="font-semibold text-sm text-gray-900">{user.first_name}</p>
              <p className="text-xs text-gray-400">Teacher</p>
            </div>
            <button onClick={logout}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-600">
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        <div className="inline-flex gap-1 bg-gray-100 rounded-xl p-1">
          {[
            { id: 'bookings',     label: '📋 All Bookings'  },
            { id: 'availability', label: '⚙️ Availability'  },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition ${tab === t.id ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Bookings Tab ── */}
      {tab === 'bookings' && (
        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="font-semibold text-gray-900">All Sessions</h2>
            <div className="flex items-center gap-2 flex-wrap">
              {['all','confirmed','canceled'].map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition capitalize font-medium ${statusFilter === s ? 'bg-purple-600 text-white border-purple-600' : 'border-gray-200 text-gray-600 hover:border-purple-300 bg-white'}`}>
                  {s}
                </button>
              ))}
              <button onClick={fetchBookings}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-600 bg-white">
                ↻ Refresh
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
              <p>No bookings found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((b) => (
                <div key={b.id}
                  className={`bg-white rounded-xl border p-5 transition ${b.status === 'canceled' ? 'border-gray-100 opacity-60' : 'border-gray-200 hover:shadow-sm'}`}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <StatusBadge status={b.status} />
                        <span className="text-xs text-gray-400">#{b.id}</span>
                        <span className="font-semibold text-sm text-gray-900">
                          {b.first_name} {b.last_name}
                        </span>
                        {b.study_level && (
                          <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">
                            {b.study_level}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-800 font-medium">
                        {fmtDate(b.date)}
                        <span className="text-gray-400 font-normal"> · </span>
                        {fmtTime(b.start_time)} — {fmtTime(b.end_time)}
                      </p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {DUR_LABEL[b.duration] ?? `${b.duration} min`} · {b.email}
                      </p>
                      {b.meet_link && b.status !== 'canceled' && (
                        <a href={b.meet_link} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-indigo-600 hover:underline mt-1 inline-block font-medium">
                          🔗 Join Meeting
                        </a>
                      )}
                    </div>
                    {b.status === 'confirmed' && (
                      <button onClick={() => handleCancelBooking(b.id)}
                        className="px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition font-medium shrink-0">
                        Cancel
                      </button>
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
            <h2 className="font-semibold text-gray-900">Weekly Availability</h2>
            <button onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition">
              {showForm ? 'Cancel' : '+ Add Slot'}
            </button>
          </div>

          {/* Add form */}
          {showForm && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4">New Availability Slot</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Day of Week</label>
                  <select
                    value={form.day_of_week}
                    onChange={(e) => setForm({ ...form, day_of_week: parseInt(e.target.value) })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm bg-white"
                  >
                    {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Start Time</label>
                  <input type="time" value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">End Time</label>
                  <input type="time" value={form.end_time}
                    onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm" />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={handleAddSlot} disabled={saving}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium disabled:opacity-60 transition">
                  {saving ? 'Adding…' : 'Add Slot'}
                </button>
                <button onClick={() => setShowForm(false)}
                  className="px-5 py-2 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition">
                  Cancel
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
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-3">
                  <div className="mb-2">
                    <p className="font-semibold text-gray-800 text-sm">{DAYS_SHORT[i]}</p>
                    <p className="text-xs text-gray-400">{day}</p>
                  </div>
                  {availByDay[i].length === 0 ? (
                    <p className="text-xs text-gray-300 italic">None</p>
                  ) : (
                    <div className="space-y-1.5">
                      {availByDay[i].map((slot) => (
                        <div key={slot.id}
                          className="flex items-center justify-between bg-purple-50 rounded-lg px-2 py-1.5">
                          <span className="text-xs font-medium text-purple-800">
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
            Availability defines which days and hours students can book sessions.
            Slots are generated in 30-minute increments.
          </p>
        </main>
      )}
    </div>
  );
}
