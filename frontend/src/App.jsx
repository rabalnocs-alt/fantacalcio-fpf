import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import HostDashboard from './pages/HostDashboard';
import ParticipantMobile from './pages/ParticipantMobile';
import SecretaryConsole from './pages/SecretaryConsole';
import AdminDashboard from './pages/AdminDashboard';
import LoginPage from './pages/LoginPage';
import { AuthProvider, useAuth } from './components/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import './index.css';

function Home() {
  const { auth, logout } = useAuth();

  if (!auth) {
    return <Navigate to="/login" replace />;
  }

  if (auth.role === 'participant') {
    return <Navigate to="/mobile" replace />;
  }

  return (
    <div className="home-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="main-title">Fantacalcio FPF Master</h1>
        <button onClick={logout} style={{ background: '#e60000', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
          Esci
        </button>
      </div>
      <div className="nav-cards">
        <Link to="/dashboard" className="nav-card">
          <h2>📺 Dashboard Proiettore</h2>
          <p>Vista per lo schermo principale. Mostra l'asta in corso e il termometro FPF.</p>
        </Link>
        <Link to="/secretary" className="nav-card">
          <h2>⌨️ Console Segretario</h2>
          <p>Gestione rilanci, avvio timer e caricamento Listone/Stats.</p>
        </Link>
        <Link to="/mobile" className="nav-card">
          <h2>📱 Cruscotto Partecipanti</h2>
          <p>Area personale per rilanciare, vedere la propria rosa e gestire i Bivi Psicologici.</p>
        </Link>
        <Link to="/admin" className="nav-card">
          <h2>⚙️ Setup Admin</h2>
          <p>Caricamento rose iniziali (Excel) e gestione avanzata.</p>
        </Link>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<ProtectedRoute><HostDashboard /></ProtectedRoute>} />
          <Route path="/secretary" element={<ProtectedRoute requiredRole="master"><SecretaryConsole /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute requiredRole="master"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/mobile" element={<ProtectedRoute><ParticipantMobile /></ProtectedRoute>} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
