import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [username, setUsername] = useState(() => localStorage.getItem('username'));

  const login = (tk, name) => {
    localStorage.setItem('token', tk);
    localStorage.setItem('username', name);
    setToken(tk);
    setUsername(name);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setToken(null);
    setUsername(null);
  };

  return (
    <AuthContext.Provider value={{ token, username, isAdmin: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
