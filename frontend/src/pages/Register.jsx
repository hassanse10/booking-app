import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const NIVEAUX = ['3ème', '4ème', 'Seconde', 'Première', 'Terminale', 'Autre'];

export default function Register() {
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '',
    study_level: '', password: '', confirmPassword: '',
  });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const { login }  = useAuth();
  const navigate   = useNavigate();

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword)
      return setError('Les mots de passe ne correspondent pas');
    if (form.password.length < 6)
      return setError('Le mot de passe doit contenir au moins 6 caractères');

    setLoading(true);
    try {
      const { confirmPassword: _, ...payload } = form;
      const { data } = await api.post('/auth/register', payload);
      login(data.token, data.user);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (!err.response) {
        setError('Impossible de contacter le serveur. Vérifiez votre connexion.');
      } else {
        const msg = err.response?.data?.error || '';
        if (msg.includes('already registered') || msg.includes('already exists'))
          setError('Cette adresse e-mail est déjà utilisée.');
        else if (msg.includes('required'))
          setError('Tous les champs sont obligatoires.');
        else
          setError(msg || 'Échec de l\'inscription. Veuillez réessayer.');
      }
    } finally {
      setLoading(false);
    }
  };

  const field = (label, name, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-2">{label}</label>
      <input
        type={type}
        value={form[name]}
        onChange={set(name)}
        placeholder={placeholder}
        required
        className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 outline-none transition text-sm"
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-pink-400 to-rose-500 rounded-3xl mb-4 shadow-lg">
            <span className="text-4xl">🎓</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Créer un compte</h1>
          <p className="text-slate-500 mt-2">Inscrivez-vous pour réserver vos séances</p>
        </div>

        <div className="bg-white rounded-3xl p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm font-medium">
                <span>⚠️</span> {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {field('Prénom', 'first_name', 'text', 'Prénom')}
              {field('Nom',    'last_name',  'text', 'Nom de famille')}
            </div>

            {field('Email', 'email', 'email', 'vous@exemple.com')}

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Niveau scolaire</label>
              <select
                value={form.study_level}
                onChange={set('study_level')}
                required
                className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 outline-none transition text-sm bg-white"
              >
                <option value="">Sélectionnez votre niveau…</option>
                {NIVEAUX.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            {field('Mot de passe',           'password',        'password', 'Min. 6 caractères')}
            {field('Confirmer le mot de passe', 'confirmPassword', 'password', 'Retaper le mot de passe')}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 text-white font-semibold rounded-2xl transition-all disabled:opacity-60 disabled:cursor-not-allowed text-sm mt-2 shadow-sm"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Création…
                </span>
              ) : 'Créer mon compte'}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-600 mt-6 text-sm">
          Vous avez déjà un compte?{' '}
          <Link to="/login" className="text-cyan-600 hover:text-cyan-700 font-semibold">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
