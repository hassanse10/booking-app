import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login            from './pages/Login';
import Register         from './pages/Register';
import StudentDashboard from './pages/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';

function Spinner() {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
    </div>
  );
}

function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user)   return <Navigate to="/login" replace />;
  if (role && user.role !== role)
    return <Navigate to={user.role === 'teacher' ? '/teacher' : '/dashboard'} replace />;
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  const home = user ? (user.role === 'teacher' ? '/teacher' : '/dashboard') : '/login';

  return (
    <Routes>
      <Route path="/"          element={<Navigate to={home} replace />} />
      <Route path="/login"     element={!user ? <Login />    : <Navigate to={home} replace />} />
      <Route path="/register"  element={!user ? <Register /> : <Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={
        <ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>
      } />
      <Route path="/teacher"   element={
        <ProtectedRoute role="teacher"><TeacherDashboard /></ProtectedRoute>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
