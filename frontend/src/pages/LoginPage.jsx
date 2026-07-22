import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';

export default function LoginPage() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { auth, login } = useAuth();
  const navigate = useNavigate();

  if (auth) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!pin) return;
    setLoading(true);
    setError('');
    
    const result = await login(pin);
    if (result.success) {
      navigate('/');
    } else {
      setError(result.error || 'PIN non valido');
      setLoading(false);
    }
  };

  return (
    <div style={{
      height: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      background: 'linear-gradient(135deg, #020914 0%, #0c2b5e 100%)', 
      color: 'white',
      fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{
        background: 'rgba(0,20,77,0.8)',
        backdropFilter: 'blur(10px)',
        padding: '3rem 2rem',
        borderRadius: '16px',
        boxShadow: '0 15px 35px rgba(0,0,0,0.5)',
        width: '90%',
        maxWidth: '400px',
        textAlign: 'center',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <h1 style={{ 
          fontSize: '2.5rem', 
          marginBottom: '0.5rem', 
          fontStyle: 'italic', 
          letterSpacing: '2px', 
          textShadow: '0 5px 15px rgba(0,0,0,0.8)',
          margin: 0
        }}>
          <span style={{ color: '#0055ff' }}>⚽ BUNDE</span> <span style={{ color: '#e60000' }}>SALASSA</span>
        </h1>
        <p style={{ color: '#b3c6ff', marginBottom: '2rem', fontSize: '1.1rem' }}>Fantacalcio FPF — Accesso</p>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <input 
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="Inserisci il PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              style={{
                width: '100%',
                padding: '1rem',
                fontSize: '2rem',
                textAlign: 'center',
                letterSpacing: '0.5rem',
                borderRadius: '12px',
                border: '2px solid rgba(255,255,255,0.2)',
                background: 'rgba(0,0,0,0.3)',
                color: 'white',
                outline: 'none',
                transition: 'border-color 0.3s'
              }}
              disabled={loading}
            />
          </div>
          
          {error && <div style={{ color: '#e60000', fontWeight: 'bold' }}>{error}</div>}

          <button 
            type="submit"
            disabled={loading || pin.length < 4}
            style={{
              width: '100%',
              padding: '1rem',
              fontSize: '1.2rem',
              background: 'linear-gradient(90deg, #e60000 0%, #b30000 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: (loading || pin.length < 4) ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              boxShadow: '0 5px 15px rgba(230,0,0,0.4)',
              transition: 'all 0.2s',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Accesso in corso...' : 'Accedi'}
          </button>
        </form>
      </div>
    </div>
  );
}
