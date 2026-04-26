import React, { useState, useEffect } from 'react';
import api from '../services/api';

const StudentProfile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    phone: '',
    bio: '',
    profile_picture_url: '',
    timezone: 'UTC',
    preferred_days: '',
  });

  const TIMEZONES = [
    'UTC',
    'Europe/Paris',
    'Europe/London',
    'Europe/Berlin',
    'Europe/Madrid',
    'America/New_York',
    'America/Los_Angeles',
    'Asia/Tokyo',
    'Asia/Dubai',
    'Australia/Sydney',
  ];

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await api.get('/students/me');
        setProfile(data);
        setFormData({
          phone: data.phone || '',
          bio: data.bio || '',
          profile_picture_url: data.profile_picture_url || '',
          timezone: data.timezone || 'UTC',
          preferred_days: data.preferred_days || '',
        });
        setLoading(false);
      } catch (err) {
        setError('Impossible de charger le profil');
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const { data } = await api.put('/students/me', formData);
      setProfile(data);
      setSuccess('Profil mis à jour avec succès!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-cyan-50 to-blue-50">
        <div className="animate-spin">
          <div className="h-12 w-12 border-4 border-cyan-200 border-t-cyan-400 rounded-full"></div>
        </div>
      </div>
    );
  }

  const completionPercentage = profile?.completionPercentage || 0;
  const circumference = 2 * Math.PI * 45;

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-3xl shadow-sm p-8 mb-6">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Mon Profil</h1>
          <p className="text-slate-500">Complétez votre profil pour déverrouiller des fonctionnalités</p>
        </div>

        {/* Completion Progress */}
        <div className="bg-white rounded-3xl shadow-sm p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Complétude du Profil</h2>
              <p className="text-slate-500">
                {completionPercentage === 100
                  ? '✨ Votre profil est complet!'
                  : `Remplissez ${100 - completionPercentage}% de plus pour débloquer les récompenses`}
              </p>
            </div>
            <div className="relative w-32 h-32">
              <svg className="w-32 h-32 transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="45"
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="4"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="45"
                  fill="none"
                  stroke="#06b6d4"
                  strokeWidth="4"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference - (completionPercentage / 100) * circumference}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.3s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-cyan-500">{completionPercentage}%</span>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-cyan-400 to-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${completionPercentage}%` }}
            ></div>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-3xl shadow-sm p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
              {success}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            {/* Profile Info (Read-only) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-slate-200">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Prénom
                </label>
                <input
                  type="text"
                  value={profile?.first_name || ''}
                  disabled
                  className="w-full px-4 py-2 bg-slate-100 border border-slate-300 rounded-lg text-slate-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nom
                </label>
                <input
                  type="text"
                  value={profile?.last_name || ''}
                  disabled
                  className="w-full px-4 py-2 bg-slate-100 border border-slate-300 rounded-lg text-slate-600"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={profile?.email || ''}
                  disabled
                  className="w-full px-4 py-2 bg-slate-100 border border-slate-300 rounded-lg text-slate-600"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Niveau Scolaire
                </label>
                <input
                  type="text"
                  value={profile?.study_level || ''}
                  disabled
                  className="w-full px-4 py-2 bg-slate-100 border border-slate-300 rounded-lg text-slate-600"
                />
              </div>
            </div>

            {/* Optional Profile Fields */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Numéro de Téléphone
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+33 6 12 34 56 78"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Bio / À propos
              </label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                placeholder="Parlez un peu de vous..."
                rows="4"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-transparent outline-none"
              ></textarea>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                URL Photo de Profil
              </label>
              <input
                type="url"
                name="profile_picture_url"
                value={formData.profile_picture_url}
                onChange={handleChange}
                placeholder="https://example.com/photo.jpg"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-transparent outline-none"
              />
              {formData.profile_picture_url && (
                <div className="mt-3">
                  <img
                    src={formData.profile_picture_url}
                    alt="Aperçu"
                    className="h-32 w-32 object-cover rounded-lg border-2 border-cyan-200"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Fuseau Horaire
              </label>
              <select
                name="timezone"
                value={formData.timezone}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-transparent outline-none"
              >
                {TIMEZONES.map(tz => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Jours Préférés
              </label>
              <input
                type="text"
                name="preferred_days"
                value={formData.preferred_days}
                onChange={handleChange}
                placeholder="Lun, Mer, Ven (séparés par des virgules)"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-transparent outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 text-white py-3 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer les Modifications'}
            </button>
          </form>
        </div>

        {/* Tips */}
        <div className="bg-cyan-50 border border-cyan-200 rounded-3xl p-6 mt-6">
          <h3 className="font-semibold text-cyan-900 mb-3">💡 Conseils</h3>
          <ul className="text-cyan-800 space-y-2 text-sm">
            <li>✓ Remplissez tous les champs pour déverrouiller les récompenses</li>
            <li>✓ Utilisez une photo professionnelle pour votre profil</li>
            <li>✓ Indiquez votre fuseau horaire pour des rappels précis</li>
            <li>✓ Partagez vos jours préférés pour des suggestions meilleures</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default StudentProfile;
