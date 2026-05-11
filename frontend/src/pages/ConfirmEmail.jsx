import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function ConfirmEmail() {
  const { token }    = useParams();
  const { login }    = useAuth();
  const navigate     = useNavigate();
  const [status, setStatus] = useState('loading'); // 'loading' | 'error'

  useEffect(() => {
    api.get(`/auth/confirm/${token}`)
      .then(({ data }) => {
        login(data.token, data.user);
        navigate('/dashboard', { replace: true });
      })
      .catch(() => setStatus('error'));
  }, [token]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-cyan-400 border-t-transparent mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Confirmation en cours…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center p-4">
      <div className="bg-[#111827] rounded-3xl p-8 border border-white/10 max-w-md w-full text-center">
        <div className="text-4xl mb-4">❌</div>
        <h1 className="text-xl font-bold text-white mb-2">Lien invalide</h1>
        <p className="text-slate-400 text-sm mb-6">Ce lien est invalide ou a déjà été utilisé.</p>
        <a href="/" className="text-cyan-400 hover:text-cyan-300 text-sm font-semibold">
          Retour à l'accueil
        </a>
      </div>
    </div>
  );
}
