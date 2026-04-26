import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function Login() {
  const [form,    setForm]    = useState({ email: '', password: '' });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const { login }  = useAuth();
  const navigate   = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', form);
      login(data.token, data.user);
      navigate(data.user.role === 'teacher' ? '/teacher' : '/dashboard', { replace: true });
    } catch (err) {
      if (!err.response)
        setError('Impossible de contacter le serveur. Vérifiez votre connexion.');
      else
        setError('Identifiants incorrects. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-3xl mb-4 shadow-lg">
            <span className="text-4xl">📚</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Bon retour!</h1>
          <p className="text-slate-500 mt-2">Connectez-vous à votre espace de cours</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm font-medium">
                <span>⚠️</span> {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 outline-none transition text-sm"
                placeholder="vous@exemple.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Mot de passe</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 outline-none transition text-sm"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 text-white font-semibold rounded-2xl transition-all disabled:opacity-60 disabled:cursor-not-allowed text-sm shadow-sm"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Connexion…
                </span>
              ) : 'Se connecter'}
            </button>
          </form>

          {/* Demo info */}
          <div className="mt-6 p-3 bg-blue-50 rounded-2xl border border-blue-100">
            <p className="text-xs text-blue-700 font-medium">📝 Démo: sara.dupont@cours.fr / demo1234</p>
          </div>
        </div>

        <p className="text-center text-slate-600 mt-6 text-sm">
          Pas encore de compte?{' '}
          <Link to="/register" className="text-cyan-600 hover:text-cyan-700 font-semibold">
            S'inscrire
          </Link>
        </p>
      </div>
    </div>
  );
}
