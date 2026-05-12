import { useState, useEffect, useCallback } from 'react';

export type UserRole = 'jefe' | 'vendedor' | 'admin' | 'comprador';

export interface User {
  username: string;
  role: UserRole;
  nombre: string;
}

const USERS: Record<string, { password: string; role: UserRole; nombre: string }> = {
  'jefe': {
    password: 'jefe123',
    role: 'jefe',
    nombre: 'Jefe Principal'
  },
  'vendedor': {
    password: 'vendedor123',
    role: 'vendedor',
    nombre: 'Vendedor'
  },
  'admin': {
    password: 'admin123',
    role: 'admin',
    nombre: 'Administrador'
  },
  'comprador': {
    password: 'comprador123',
    role: 'comprador',
    nombre: 'Comprador'
  }
};

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    loading: true
  });

  useEffect(() => {
    const stored = localStorage.getItem('authUser');
    if (stored) {
      try {
        const user = JSON.parse(stored);
        setAuthState({
          isAuthenticated: true,
          user,
          loading: false
        });
      } catch {
        setAuthState(prev => ({ ...prev, loading: false }));
      }
    } else {
      setAuthState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const login = useCallback((username: string, password: string): { success: boolean; error?: string } => {
    const userData = USERS[username];
    
    if (!userData || userData.password !== password) {
      return { success: false, error: 'Usuario o contraseña incorrectos' };
    }

    const user: User = {
      username,
      role: userData.role,
      nombre: userData.nombre
    };

    localStorage.setItem('authUser', JSON.stringify(user));
    
    setAuthState({
      isAuthenticated: true,
      user,
      loading: false
    });

    return { success: true };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('authUser');
    setAuthState({
      isAuthenticated: false,
      user: null,
      loading: false
    });
  }, []);

  return {
    ...authState,
    login,
    logout
  };
}