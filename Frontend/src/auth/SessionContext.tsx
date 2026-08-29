import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

export interface HouseholdMeter {
  id: string;
  name: string;
  displayName: string | null;
  role: 'solar' | 'consumer' | 'prosumer';
  pv: number;
  baseLoad: number;
  distance: number;
}

interface SessionContextType {
  token: string | null;
  role: 'household' | 'operator' | null;
  meter: HouseholdMeter | null;
  loading: boolean;
  login: (meterId: string, pin: string) => Promise<void>;
  loginOperator: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  setMeter: React.Dispatch<React.SetStateAction<HouseholdMeter | null>>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<'household' | 'operator' | null>(null);
  const [meter, setMeter] = useState<HouseholdMeter | null>(null);
  const [loading, setLoading] = useState(true);

  // Attempt to restore session on mount
  useEffect(() => {
    async function restoreSession() {
      const savedToken = localStorage.getItem('gridshare-token');
      if (!savedToken) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${savedToken}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          setToken(savedToken);
          setRole(data.role);
          if (data.meter) {
            setMeter(data.meter);
          }
        } else {
          // If token is invalid or expired, clear it silently
          localStorage.removeItem('gridshare-token');
        }
      } catch (err) {
        console.error('Error restoring session:', err);
      } finally {
        setLoading(false);
      }
    }

    restoreSession();
  }, []);

  const login = async (meterId: string, pin: string) => {
    const res = await fetch(`${API_BASE_URL}/api/auth/login/household`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ meterId, pin }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Login failed');
    }

    const data = await res.json();
    localStorage.setItem('gridshare-token', data.token);
    setToken(data.token);
    setRole('household');
    setMeter(data.meter);
  };

  const loginOperator = async (code: string) => {
    const res = await fetch(`${API_BASE_URL}/api/auth/login/operator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Login failed');
    }

    const data = await res.json();
    localStorage.setItem('gridshare-token', data.token);
    setToken(data.token);
    setRole('operator');
    setMeter(null);
  };

  const logout = async () => {
    const savedToken = localStorage.getItem('gridshare-token') || token;
    if (savedToken) {
      try {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${savedToken}`,
          },
        });
      } catch (err) {
        console.error('Error logging out from server:', err);
      }
    }
    localStorage.removeItem('gridshare-token');
    setToken(null);
    setRole(null);
    setMeter(null);
  };

  return (
    <SessionContext.Provider value={{ token, role, meter, loading, login, loginOperator, logout, setMeter }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};
