import { useState } from 'react';
import api from '../services/api';

export default function SessionNotesModal({ booking, onClose, onSaved }) {
  const [teacherNotes,    setTeacherNotes]    = useState(booking.teacher_notes    || '');
  const [topicsCovered,   setTopicsCovered]   = useState('');
  const [homeworkAssigned, setHomeworkAssigned] = useState('');
  const [nextFocusAreas,  setNextFocusAreas]  = useState('');
  const [teacherRating,   setTeacherRating]   = useState(0);
  const [teacherFeedback, setTeacherFeedback] = useState('');
  const [saving, setSaving]   = useState(false);
  const [error,  setError]    = useState('');

  const fmtDate = (d) => {
    const s = typeof d === 'string' && d.includes('T') ? d.split('T')[0] : d;
    return new Date(s + 'T00:00:00').toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
  };

  const handleSave = async () => {
    if (!teacherNotes.trim()) {
      setError('Les notes de séance sont requises');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post(`/bookings/${booking.id}/notes`, {
        teacher_notes:    teacherNotes,
        topics_covered:   topicsCovered   || undefined,
        homework_assigned: homeworkAssigned || undefined,
        next_focus_areas: nextFocusAreas  || undefined,
      });
      if (teacherRating > 0) {
        await api.post(`/bookings/${booking.id}/feedback`, {
          teacher_rating:   teacherRating,
          teacher_feedback: teacherFeedback || undefined,
        });
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Notes de Séance</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {fmtDate(booking.date)} · {booking.first_name} {booking.last_name}
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition text-xl">
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>
          )}

          {/* Teacher Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Notes de cours <span className="text-red-400">*</span>
            </label>
            <textarea
              value={teacherNotes}
              onChange={e => setTeacherNotes(e.target.value)}
              placeholder="Résumé de la séance, ce qui a été travaillé…"
              rows={4}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
            />
          </div>

          {/* Topics */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Sujets abordés</label>
            <input
              value={topicsCovered}
              onChange={e => setTopicsCovered(e.target.value)}
              placeholder="ex: Équations du 2nd degré, Trigonométrie…"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Homework */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Devoirs assignés</label>
            <input
              value={homeworkAssigned}
              onChange={e => setHomeworkAssigned(e.target.value)}
              placeholder="ex: Exercices p.45-47, revoir la leçon…"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Next Focus */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Focus prochaine séance</label>
            <input
              value={nextFocusAreas}
              onChange={e => setNextFocusAreas(e.target.value)}
              placeholder="ex: Correction des devoirs, intégrales…"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Student Rating (by teacher) */}
          <div className="pt-4 border-t border-gray-100">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Évaluation de l'élève (optionnel)
            </label>
            <div className="flex gap-2 mb-3">
              {[1, 2, 3, 4, 5].map(star => (
                <button key={star} type="button" onClick={() => setTeacherRating(star)}
                  className={`text-3xl transition-transform hover:scale-110 ${star <= teacherRating ? 'text-yellow-400' : 'text-gray-300'}`}>
                  ★
                </button>
              ))}
            </div>
            {teacherRating > 0 && (
              <textarea
                value={teacherFeedback}
                onChange={e => setTeacherFeedback(e.target.value)}
                placeholder="Commentaire sur l'élève (participation, progrès…)"
                rows={2}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} disabled={saving}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50">
            Annuler
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50">
            {saving ? 'Enregistrement…' : 'Sauvegarder'}
          </button>
        </div>
      </div>
    </div>
  );
}
