import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onUnauthorized } from '../api.js';

const AuthContext = createContext(null);

const EMPTY = { token: null, username: null };
const MAX_TIMEOUT = 2147483647; // setTimeout ล้นค่านี้แล้วจะยิงทันที — กันไว้

// อ่าน exp (ms) จาก payload ของ JWT — คืน null ถ้า token พังหรือไม่มี exp
const readExp = (token) => {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(part.padEnd(Math.ceil(part.length / 4) * 4, '=')));
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
};

const clearStored = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
};

// ตอนเปิดแอป: token ที่หมดอายุแล้วถือว่าไม่ได้ login ตั้งแต่แรก
// (ไม่ปล่อยให้เข้าหน้า admin ได้ก่อนแล้วค่อยขึ้น error รัวๆ)
const readStored = () => {
  const token = localStorage.getItem('token');
  if (!token) return EMPTY;
  const exp = readExp(token);
  if (!exp || exp <= Date.now()) {
    clearStored();
    return EMPTY;
  }
  return { token, username: localStorage.getItem('username') };
};

export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState(readStored);
  const [sessionExpired, setSessionExpired] = useState(false);

  const login = useCallback((tk, name) => {
    localStorage.setItem('token', tk);
    localStorage.setItem('username', name);
    setSessionExpired(false);
    setAuth({ token: tk, username: name });
  }, []);

  const logout = useCallback(() => {
    clearStored();
    setSessionExpired(false);
    setAuth(EMPTY);
  }, []);

  // เซสชันหมดอายุ → เคลียร์ token แล้ว guard ใน App.jsx จะเด้งไป /admin ให้เอง
  const expire = useCallback(() => {
    clearStored();
    setSessionExpired(true);
    setAuth(EMPTY);
  }, []);

  // 401 จาก API ที่ต้องใช้สิทธิ์ (เช่น server รีสตาร์ทแล้ว JWT_SECRET เปลี่ยน)
  useEffect(() => onUnauthorized(expire), [expire]);

  // เด้งออกทันทีที่ถึงเวลาหมดอายุ แม้ผู้ใช้เปิดหน้าค้างไว้เฉยๆ ไม่ได้ยิง API
  useEffect(() => {
    if (!auth.token) return;
    const exp = readExp(auth.token);
    if (!exp) return;
    const delay = exp - Date.now();
    if (delay > MAX_TIMEOUT) return; // อายุยาวเกิน ~24 วัน — ปล่อยให้ 401 จัดการแทน
    const t = setTimeout(expire, Math.max(delay, 0));
    return () => clearTimeout(t);
  }, [auth.token, expire]);

  return (
    <AuthContext.Provider
      value={{
        token: auth.token,
        username: auth.username,
        isAdmin: !!auth.token,
        sessionExpired,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
