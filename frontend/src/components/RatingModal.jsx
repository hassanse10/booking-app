import React, { useState } from 'react';
import api from '../services/api';

const RatingModal = ({ booking, onClose, onRatingSubmitted }) => {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) {
      setError('Veuillez sélectionner une note');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.post(`/bookings/${booking.id}/feedback`, {
        student_rating: rating,
        student_feedback: feedback,
      });
      onRatingSubmitted();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de l\'envoi de l\'avis');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#111827] rounded-lg shadow-xl max-w-md w-full border border-white/10">
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-400 to-blue-500 text-white px-6 py-4 rounded-t-lg">
          <h2 className="text-xl font-bold">Évaluez votre Séance</h2>
          <p className="text-white/80 text-sm mt-1">
            {new Date(booking.date).toLocaleDateString('fr-FR')} à {booking.start_time}
          </p>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-950/50 border border-red-500/30 rounded text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Star Rating */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-4">
              Note (1-5 étoiles)
            </label>
            <div className="flex justify-center gap-3">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`text-4xl transition-transform hover:scale-110 ${
                    star <= rating ? 'text-yellow-400' : 'text-slate-600'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-center mt-2 text-cyan-400 font-medium">
                {rating === 5 && '⭐ Excellent!'}
                {rating === 4 && '😊 Très bien!'}
                {rating === 3 && '👍 Satisfait'}
                {rating === 2 && '😐 Moyen'}
                {rating === 1 && '😞 Insatisfait'}
              </p>
            )}
          </div>

          {/* Feedback */}
          <div>
            <label htmlFor="feedback" className="block text-sm font-semibold text-slate-300 mb-2">
              Avis et Commentaires (Optionnel)
            </label>
            <textarea
              id="feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Qu'avez-vous aimé? Qu'est-ce qui pourrait être amélioré?"
              rows="4"
              className="w-full px-4 py-3 bg-[#0d1a2e] border border-white/10 rounded-lg text-white placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
            ></textarea>
            <p className="text-xs text-slate-400 mt-1">
              {feedback.length}/500 caractères
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-white/10 rounded-lg text-slate-300 font-medium hover:bg-white/10 transition disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || rating === 0}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Envoi...' : 'Envoyer l\'Avis'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RatingModal;
