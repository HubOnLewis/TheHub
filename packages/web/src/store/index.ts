// packages/web/src/store/index.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AppUser {
  id:       string;
  name:     string;
  email:    string;
  role:     string;
  entity:   string;
  location: string;
  tenantId: string;
}

interface AppStore {
  user:           AppUser | null;
  token:          string | null;
  activeTenantId: string | null;

  login:             (user: AppUser, token: string) => void;
  logout:            () => void;
  setActiveTenant:   (tenantId: string | null) => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      user:           null,
      token:          null,
      activeTenantId: null,

      login: (user, token) => {
        localStorage.setItem('mtte_token', token);
        set({ user, token, activeTenantId: user.tenantId || null });
      },

      logout: () => {
        localStorage.removeItem('mtte_token');
        set({ user: null, token: null, activeTenantId: null });
      },

      setActiveTenant: (tenantId) => set({ activeTenantId: tenantId }),
    }),
    {
      name:    'mtte-auth',
      partialize: (s) => ({ user: s.user, token: s.token, activeTenantId: s.activeTenantId }),
    },
  ),
);
