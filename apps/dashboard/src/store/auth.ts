import { create } from 'zustand';
import { client } from '@/lib/sdk';
import type { User } from '@authify/sdk';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('authify_token'),
  isLoading: false,
  setUser: (user) => set({ user }),
  setToken: (token) => {
    set({ token });
    if (token) {
      localStorage.setItem('authify_token', token);
    } else {
      localStorage.removeItem('authify_token');
      localStorage.removeItem('authify_refresh');
    }
  },
  login: async (email, password) => {
    const res = await client.post('/v1/auth/login', { email, password });
    const data = res as { accessToken: string; refreshToken: string; user: User };
    client.setToken(data.accessToken, data.refreshToken);
    localStorage.setItem('authify_token', data.accessToken);
    localStorage.setItem('authify_refresh', data.refreshToken);
    set({ token: data.accessToken, user: data.user });
  },
  logout: async () => {
    try {
      await client.post('/v1/auth/logout');
    } catch {
      // ignore
    }
    client.setToken('');
    localStorage.removeItem('authify_token');
    localStorage.removeItem('authify_refresh');
    set({ token: null, user: null });
  },
  fetchMe: async () => {
    try {
      const user = await client.get('/v1/auth/me') as User;
      set({ user });
    } catch {
      set({ user: null, token: null });
    }
  },
}));
