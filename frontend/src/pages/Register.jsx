import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const STUDY_LEVELS = [
  'Primary School', 'Middle School', 'High School',
  'Undergraduate', 'Graduate', 'Professional', 'Other',
];

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
      return setError('Passwords do not match');
    if (form.password.length < 6)
      return setError('Password must be at least 6 characters');

    setLoading(true);
    try {
      const { confirmPassword: _, ...payload } = form;
      const { data } = await api.post('/auth/register', payload);
      login(data.token, data.user);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const field = (label, name, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <input
        type={type}
        value={form[name]}
        onChange={set(name)}
        placeholder={placeholder}
        required
        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition text-sm"
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl shadow-lg mb-4">
            <span className="text-3xl">🎓</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Create account</h1>
          <p className="text-gray-500 mt-1">Register to book sessions with the teacher</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                <span>⚠️</span> {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {field('First Name', 'first_name', 'text', 'John')}
              {field('Last Name',  'last_name',  'text', 'Doe')}
            </div>

            {field('Email address', 'email', 'email', 'you@example.com')}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Study Level</label>
              <select
                value={form.study_level}
                onChange={set('study_level')}
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition text-sm bg-white"
              >
                <option value="">Select your level…</option>
                {STUDY_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            {field('Password',         'password',        'password', 'Min. 6 characters')}
            {field('Confirm Password', 'confirmPassword', 'password', 'Re-enter password')}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-60 text-sm mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Creating account…
                </span>
              ) : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-500 mt-6 text-sm">
          Already have an account?{' '}
          <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-medium">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
