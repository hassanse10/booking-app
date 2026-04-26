import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

// ── Quick Login Card ──────────────────────────────────────────────────────────
function AuthCard() {
  const [tab, setTab]       = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const { login }  = useAuth();
  const navigate   = useNavigate();

  // Login form
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });

  // Register form
  const NIVEAUX = ['3ème', '4ème', 'Seconde', 'Première', 'Terminale', 'Autre'];
  const [regForm, setRegForm] = useState({
    first_name: '', last_name: '', email: '',
    study_level: '', password: '', confirmPassword: '',
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', loginForm);
      login(data.token, data.user);
      navigate(data.user.role === 'teacher' ? '/teacher' : '/dashboard', { replace: true });
    } catch {
      setError('Identifiants incorrects. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (regForm.password !== regForm.confirmPassword)
      return setError('Les mots de passe ne correspondent pas');
    if (regForm.password.length < 6)
      return setError('Le mot de passe doit contenir au moins 6 caractères');
    setLoading(true);
    try {
      const { confirmPassword: _, ...payload } = regForm;
      const { data } = await api.post('/auth/register', payload);
      login(data.token, data.user);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.error || '';
      if (msg.includes('already'))
        setError('Cette adresse e-mail est déjà utilisée.');
      else
        setError(msg || "Échec de l'inscription. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 outline-none transition text-sm bg-white';

  return (
    <div className="bg-white rounded-3xl shadow-xl p-6 w-full max-w-sm">
      {/* Tabs */}
      <div className="flex bg-slate-100 rounded-2xl p-1 mb-5">
        <button
          onClick={() => { setTab('login'); setError(''); }}
          className={`flex-1 py-2 text-sm font-semibold rounded-xl transition ${
            tab === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}>
          Se connecter
        </button>
        <button
          onClick={() => { setTab('register'); setError(''); }}
          className={`flex-1 py-2 text-sm font-semibold rounded-xl transition ${
            tab === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}>
          S'inscrire
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 rounded-xl text-xs font-medium mb-4">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* ── LOGIN FORM ── */}
      {tab === 'login' && (
        <form onSubmit={handleLogin} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email</label>
            <input
              type="email" required placeholder="vous@exemple.com"
              value={loginForm.email}
              onChange={e => setLoginForm({ ...loginForm, email: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Mot de passe</label>
            <input
              type="password" required placeholder="••••••••"
              value={loginForm.password}
              onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
              className={inputCls}
            />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 text-white font-semibold rounded-xl transition disabled:opacity-60 text-sm shadow-sm mt-1">
            {loading
              ? <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Connexion…
                </span>
              : 'Se connecter →'}
          </button>
          {/* Demo hint */}
          <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-xs text-blue-700">📝 Démo : sara.dupont@cours.fr / demo1234</p>
          </div>
        </form>
      )}

      {/* ── REGISTER FORM ── */}
      {tab === 'register' && (
        <form onSubmit={handleRegister} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Prénom</label>
              <input type="text" required placeholder="Prénom"
                value={regForm.first_name}
                onChange={e => setRegForm({ ...regForm, first_name: e.target.value })}
                className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nom</label>
              <input type="text" required placeholder="Nom"
                value={regForm.last_name}
                onChange={e => setRegForm({ ...regForm, last_name: e.target.value })}
                className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email</label>
            <input type="email" required placeholder="vous@exemple.com"
              value={regForm.email}
              onChange={e => setRegForm({ ...regForm, email: e.target.value })}
              className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Niveau scolaire</label>
            <select required value={regForm.study_level}
              onChange={e => setRegForm({ ...regForm, study_level: e.target.value })}
              className={inputCls}>
              <option value="">Sélectionnez…</option>
              {NIVEAUX.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Mot de passe</label>
            <input type="password" required placeholder="Min. 6 caractères"
              value={regForm.password}
              onChange={e => setRegForm({ ...regForm, password: e.target.value })}
              className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Confirmer</label>
            <input type="password" required placeholder="Retaper le mot de passe"
              value={regForm.confirmPassword}
              onChange={e => setRegForm({ ...regForm, confirmPassword: e.target.value })}
              className={inputCls} />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 text-white font-semibold rounded-xl transition disabled:opacity-60 text-sm shadow-sm mt-1">
            {loading
              ? <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Création…
                </span>
              : 'Créer mon compte →'}
          </button>
        </form>
      )}
    </div>
  );
}

// ── Main Home Page ────────────────────────────────────────────────────────────
export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-50">

      {/* ── Navbar ── */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center shadow-sm">
              <span className="text-lg">🎓</span>
            </div>
            <span className="font-bold text-slate-900 text-lg">Cours Privés</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-500">
            <a href="#features" className="hover:text-slate-900 transition">Fonctionnalités</a>
            <a href="#how"      className="hover:text-slate-900 transition">Comment ça marche</a>
            <a href="#pricing"  className="hover:text-slate-900 transition">Tarifs</a>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login"
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition hidden sm:block">
              Se connecter
            </Link>
            <Link to="/register"
              className="px-4 py-2 text-sm font-semibold bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 text-white rounded-xl shadow-sm transition">
              S'inscrire
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24">
        <div className="flex flex-col lg:flex-row items-center gap-12">

          {/* Left: Text */}
          <div className="flex-1 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-cyan-100 text-cyan-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse" />
              Cours en ligne · Disponible maintenant
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 leading-tight mb-5">
              Progressez avec des{' '}
              <span className="bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">
                cours privés
              </span>{' '}
              sur-mesure 🎓
            </h1>
            <p className="text-slate-500 text-lg leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0">
              Réservez vos séances en quelques clics, suivez vos progrès en temps réel
              et recevez un feedback personnalisé après chaque cours.
            </p>

            {/* Stats row */}
            <div className="flex items-center justify-center lg:justify-start gap-6 text-sm">
              <div className="text-center">
                <p className="text-2xl font-extrabold text-slate-900">120+</p>
                <p className="text-slate-400 text-xs">Séances réalisées</p>
              </div>
              <div className="w-px h-10 bg-slate-200" />
              <div className="text-center">
                <p className="text-2xl font-extrabold text-slate-900">4.9<span className="text-amber-400">★</span></p>
                <p className="text-slate-400 text-xs">Note moyenne</p>
              </div>
              <div className="w-px h-10 bg-slate-200" />
              <div className="text-center">
                <p className="text-2xl font-extrabold text-slate-900">45+</p>
                <p className="text-slate-400 text-xs">Élèves inscrits</p>
              </div>
            </div>
          </div>

          {/* Right: Auth Card */}
          <div className="w-full lg:w-auto flex justify-center">
            <AuthCard />
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="bg-white py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-extrabold text-slate-900 mb-3">Comment ça marche ?</h2>
          <p className="text-slate-500 mb-12">Trois étapes simples pour commencer</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { num: '01', color: 'from-cyan-400 to-blue-500',   icon: '👤', title: 'Créez votre compte',   desc: "Inscription gratuite en 2 minutes. Aucune carte de crédit requise." },
              { num: '02', color: 'from-pink-400 to-rose-500',   icon: '📅', title: 'Choisissez un créneau', desc: "Sélectionnez la date, l'heure et la durée qui vous conviennent." },
              { num: '03', color: 'from-teal-400 to-emerald-500', icon: '🎥', title: 'Rejoignez la séance',  desc: "Un lien Meet est généré automatiquement. Cliquez et apprenez !" },
            ].map((step) => (
              <div key={step.num} className="flex flex-col items-center">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center text-2xl shadow-sm mb-4`}>
                  {step.icon}
                </div>
                <span className="text-xs font-bold text-slate-300 tracking-widest mb-1">{step.num}</span>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-16 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold text-slate-900 mb-3">Tout ce dont vous avez besoin</h2>
          <p className="text-slate-500">Une plateforme complète pour les élèves et le professeur</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: '📅', color: 'bg-cyan-100 text-cyan-600',    title: 'Réservation facile',      desc: 'Calendrier interactif avec créneaux disponibles en temps réel.' },
            { icon: '📈', color: 'bg-blue-100 text-blue-600',    title: 'Suivi des progrès',       desc: 'Visualisez votre courbe d\'évolution et vos heures cumulées.' },
            { icon: '📝', color: 'bg-teal-100 text-teal-600',    title: 'Notes de session',        desc: 'Feedback personnalisé du professeur après chaque cours.' },
            { icon: '⏰', color: 'bg-pink-100 text-pink-600',    title: 'Rappels automatiques',    desc: 'Email de rappel 24h avant chaque séance. Ne ratez plus rien.' },
            { icon: '🧾', color: 'bg-amber-100 text-amber-600',  title: 'Factures & paiements',   desc: 'Historique complet de toutes vos séances et montants.' },
            { icon: '⭐', color: 'bg-rose-100 text-rose-600',    title: 'Système de notation',     desc: 'Évaluez vos séances et aidez le professeur à s\'améliorer.' },
          ].map((f) => (
            <div key={f.title} className="bg-white rounded-3xl p-6 shadow-sm hover:shadow-md transition">
              <div className={`w-11 h-11 rounded-2xl ${f.color} flex items-center justify-center text-xl mb-4`}>
                {f.icon}
              </div>
              <h3 className="font-bold text-slate-900 mb-2">{f.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="bg-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-extrabold text-slate-900 mb-3">Tarifs transparents</h2>
          <p className="text-slate-500 mb-12">Choisissez la durée qui vous convient</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { dur: '1 heure',    price: '15', popular: false, features: ['Séance complète', 'Lien Meet auto', 'Rappel email', 'Historique'] },
              { dur: '1h 30 min',  price: '18', popular: true,  features: ['Séance complète', 'Lien Meet auto', 'Rappel email', 'Historique', 'Notes de session'] },
              { dur: '2 heures',   price: '25', popular: false, features: ['Séance complète', 'Lien Meet auto', 'Rappel email', 'Historique', 'Notes de session'] },
            ].map((plan) => (
              <div key={plan.dur} className={`rounded-3xl p-6 ${
                plan.popular
                  ? 'bg-gradient-to-br from-cyan-400 to-blue-500 text-white shadow-lg scale-105'
                  : 'bg-slate-50 border border-slate-200'
              }`}>
                {plan.popular && (
                  <div className="inline-block bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full mb-3">
                    ⭐ Populaire
                  </div>
                )}
                <p className={`text-sm font-semibold mb-1 ${plan.popular ? 'text-cyan-100' : 'text-slate-500'}`}>{plan.dur}</p>
                <p className={`text-4xl font-extrabold mb-5 ${plan.popular ? 'text-white' : 'text-slate-900'}`}>
                  {plan.price}<span className={`text-xl ${plan.popular ? 'text-cyan-100' : 'text-slate-400'}`}>€</span>
                </p>
                <ul className={`space-y-2 text-sm mb-6 text-left ${plan.popular ? 'text-cyan-50' : 'text-slate-600'}`}>
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2">
                      <span className={plan.popular ? 'text-white' : 'text-cyan-400'}>✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Link to="/register"
                  className={`block w-full py-2.5 rounded-xl text-sm font-semibold text-center transition ${
                    plan.popular
                      ? 'bg-white text-cyan-600 hover:bg-cyan-50'
                      : 'bg-gradient-to-r from-cyan-400 to-blue-500 text-white hover:from-cyan-500 hover:to-blue-600 shadow-sm'
                  }`}>
                  Réserver →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonial ── */}
      <section className="py-16 max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <h2 className="text-3xl font-extrabold text-slate-900 mb-10">Ce que disent nos élèves</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[
            { name: 'Sara D.',   level: 'Terminale', stars: 5, text: "J'ai amélioré mes notes en maths en seulement 2 mois. Les explications sont claires et adaptées !" },
            { name: 'Karim M.',  level: 'Première',  stars: 5, text: "La plateforme est super simple à utiliser. Je réserve en 30 secondes et reçois mon lien automatiquement." },
          ].map((t) => (
            <div key={t.name} className="bg-white rounded-3xl p-6 shadow-sm text-left">
              <div className="text-amber-400 text-lg mb-3">{'★'.repeat(t.stars)}</div>
              <p className="text-slate-700 text-sm leading-relaxed mb-4">"{t.text}"</p>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white font-bold text-sm">
                  {t.name[0]}
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{t.name}</p>
                  <p className="text-slate-400 text-xs">{t.level}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="bg-gradient-to-r from-cyan-400 to-blue-500 py-14">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-extrabold text-white mb-3">Prêt à progresser ?</h2>
          <p className="text-cyan-100 mb-8">Rejoignez 45+ élèves qui apprennent avec Ahmed. Inscription gratuite.</p>
          <Link to="/register"
            className="inline-block px-8 py-3.5 bg-white text-cyan-600 font-bold rounded-2xl hover:bg-cyan-50 transition shadow-lg text-sm">
            Créer mon compte gratuit →
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-slate-900 text-slate-400 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-sm">🎓</span>
            </div>
            <span className="text-white font-bold text-sm">Cours Privés</span>
          </div>
          <p className="text-xs">© 2026 Cours Privés Ahmed. Tous droits réservés.</p>
          <div className="flex items-center gap-4 text-xs">
            <Link to="/login"    className="hover:text-white transition">Connexion</Link>
            <Link to="/register" className="hover:text-white transition">Inscription</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
