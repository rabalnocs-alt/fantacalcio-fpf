import React, { createContext, useContext, useState, useEffect } from 'react';
import { BACKEND_URL } from '../utils/socket';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState(() => {
    const saved = localStorage.getItem('fantacalcio_auth');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (auth) {
      localStorage.setItem('fantacalcio_auth', JSON.stringify(auth));
    } else {
      localStorage.removeItem('fantacalcio_auth');
    }
  }, [auth]);

  const login = async (pin) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      const data = await res.json();
      if (data.success) {
        const authData = { role: data.role, teamName: data.teamName, token: data.token };
        setAuth(authData);
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (err) {
      return { success: false, error: 'Errore di connessione' };
    }
  };

  const logout = () => {
    setAuth(null);
  };

  return (
    <AuthContext.Provider value={{ auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
