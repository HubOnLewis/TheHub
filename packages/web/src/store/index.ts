// packages/web/src/store/index.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const AUTH_TOKEN_KEY = 'hub_crm_token';

export interface AppUser {
  id:       string;
  name:     string;
  email:    string;
  role:     string;
  entity:   string;
  location: string;
  tenantId: string;
}

export type UiTheme = 'dark' | 'light';

interface AppStore {
  user:           AppUser | null;
  token:          string | null;
  activeTenantId: string | null;
  /** UI theme — default light for client demos; dark optional. */
  theme:          UiTheme;
  sidebarCollapsed: boolean;

  login:             (user: AppUser, token: string) => void;
  logout:            () => void;
  setActiveTenant:   (tenantId: string | null) => void;
  setTheme:          (theme: UiTheme) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      user:           null,
      token:          null,
      activeTenantId: null,
      theme:          'light',
      sidebarCollapsed: false,

      login: (user, token) => {
        localStorage.setItem(AUTH_TOKEN_KEY, token);
        set({ user, token, activeTenantId: user.tenantId || null });
      },

      logout: () => {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        set({ user: null, token: null, activeTenantId: null });
      },

      setActiveTenant: (tenantId) => set({ activeTenantId: tenantId }),
      setTheme: (theme) => {
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-theme', theme);
        }
        set({ theme });
      },
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
    }),
    {
      name: 'hub-crm-auth',
      version: 2,
      migrate: (persisted) => persisted,
      partialize: (s) => ({
        user: s.user,
        token: s.token,
        activeTenantId: s.activeTenantId,
        theme: s.theme,
        sidebarCollapsed: s.sidebarCollapsed,
      }),
    },
  ),
);
