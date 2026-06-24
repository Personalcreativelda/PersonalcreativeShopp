/**
 * authService.ts — Autenticação via PostgreSQL/JWT (sem Supabase)
 */
import api, { setApiToken, getApiToken } from '../../core/services/apiClient';
import { User, UserRole } from '../../core/types/types';

export interface AuthUser extends User {
  requiresStrongPassword?: boolean;
}

export interface LoginResult {
  user: AuthUser | null;
  error?: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

// Cache do utilizador actual
let currentUser: AuthUser | null = null;

const mapUser = (raw: any): AuthUser => ({
  id: raw.id,
  name: raw.name || raw.email?.split('@')[0] || 'Utilizador',
  email: raw.email || '',
  phone: raw.phone || undefined,
  role: (raw.role as UserRole) || UserRole.STAFF,
  roles: raw.roles || [raw.role || 'STAFF'],
  avatar: raw.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(raw.name || raw.email || 'U')}&background=2d6a4f&color=fff`,
  customerId: raw.customerId || undefined,
  isActive: raw.isActive !== false,
  isSuperAdmin: raw.isSuperAdmin || false,
  lastLogin: raw.lastLogin || undefined,
  requiresStrongPassword: raw.requiresStrongPassword === true,
  points: raw.points ?? 0,
  totalPointsEarned: raw.totalPointsEarned ?? 0
});

export const authService = {
  /**
   * Fazer login com email + password
   */
  async login(email: string, password: string): Promise<LoginResult> {
    try {
      const result = await api.post<{ token: string; user: any }>('/auth/login', { email, password }, { noAuth: true });
      if (!result?.token || !result?.user) {
        return { user: null, error: 'Resposta inválida do servidor' };
      }
      setApiToken(result.token);
      currentUser = mapUser(result.user);
      return { user: currentUser };
    } catch (err: any) {
      return { user: null, error: err.message || 'Erro ao fazer login' };
    }
  },

  /**
   * Fazer logout
   */
  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout', {});
    } catch {}
    setApiToken(null);
    currentUser = null;
  },

  /**
   * Obter o utilizador actual (a partir do token JWT guardado)
   */
  async getCurrentUser(): Promise<AuthUser | null> {
    if (currentUser) return currentUser;
    const token = getApiToken();
    if (!token) return null;

    try {
      const user = await api.get<any>('/auth/me');
      currentUser = mapUser(user);
      return currentUser;
    } catch {
      setApiToken(null);
      currentUser = null;
      return null;
    }
  },

  /**
   * Verificar se tem sessão activa
   */
  async getSession(): Promise<AuthSession | null> {
    const token = getApiToken();
    if (!token) return null;
    const user = await this.getCurrentUser();
    if (!user) return null;
    return { token, user };
  },

  /**
   * Alterar password
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao alterar password' };
    }
  },

  /**
   * Escutar mudanças de autenticação (simples callback para logout automático)
   */
  onAuthStateChange(callback: (user: AuthUser | null) => void): () => void {
    const handler = (e: Event) => {
      const event = e as CustomEvent;
      if (event.detail?.reason === 'token_expired') {
        currentUser = null;
        callback(null);
      }
    };
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  },

  /**
   * Verificar se o utilizador tem determinado role
   */
  hasRole(user: AuthUser | null, role: UserRole): boolean {
    if (!user) return false;
    if (user.isSuperAdmin) return true;
    return user.role === role;
  },

  /**
   * Invalidar cache do utilizador (forçar reload do /me)
   */
  invalidateCache(): void {
    currentUser = null;
  },

  // ─── Compatibilidade com código legado ────────────────────────────
  isSupabaseAuth: () => false,
  
  async signIn(email: string, password: string): Promise<LoginResult> {
    return this.login(email, password);
  },

  async signOut(): Promise<void> {
    return this.logout();
  },

  async signUp(name: string, email: string, password?: string, phone?: string, referralCode?: string): Promise<LoginResult> {
    try {
      const result = await api.post<{ token: string; user: any }>('/auth/register', { name, email, password, phone, referralCode }, { noAuth: true });
      if (!result?.token || !result?.user) {
        return { user: null, error: 'Resposta inválida do servidor' };
      }
      setApiToken(result.token);
      currentUser = mapUser(result.user);
      return { user: currentUser };
    } catch (err: any) {
      return { user: null, error: err.message || 'Erro ao criar conta' };
    }
  },

  async updateProfile(id: string, updates: Partial<User>): Promise<{ success: boolean; error?: string }> {
    try {
      await api.put(`/users/${id}`, updates);
      if (currentUser && currentUser.id === id) {
        currentUser = { ...currentUser, ...updates };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao atualizar perfil' };
    }
  },

  async signInWithGoogleCredential(credential: string): Promise<LoginResult> {
    try {
      const result = await api.post<{ token: string; user: any }>('/auth/google', { credential }, { noAuth: true });
      if (!result?.token || !result?.user)
        return { user: null, error: 'Resposta inválida do servidor' };
      setApiToken(result.token);
      currentUser = mapUser(result.user);
      return { user: currentUser };
    } catch (err: any) {
      return { user: null, error: err.message || 'Erro ao autenticar com Google' };
    }
  },

  async refreshToken(): Promise<LoginResult> {
    try {
      const result = await api.post<{ token: string; user: any }>('/auth/refresh-token', {});
      if (!result?.token) return { user: null, error: 'Erro ao renovar sessão' };
      setApiToken(result.token);
      currentUser = mapUser(result.user);
      return { user: currentUser };
    } catch (err: any) {
      return { user: null, error: err.message };
    }
  },

  async signInWithGoogle(): Promise<LoginResult> {
    return { user: null, error: 'Use o botão Google para autenticar.' };
  },

  async signInWithGooglePopup(): Promise<LoginResult> {
    return this.signInWithGoogle();
  },

  async signInWithOAuth(): Promise<LoginResult> {
    return { user: null, error: 'OAuth não suportado. Use email e password.' };
  },

  async handleOAuthCallback(): Promise<LoginResult> {
    return { user: null };
  },

  async resetPassword(email: string): Promise<{ error?: string }> {
    try {
      await api.post('/auth/forgot-password', { email }, { noAuth: true });
      return {};
    } catch (err: any) {
      return { error: err.message || 'Erro ao enviar email de recuperação' };
    }
  },

  async applyPasswordReset(token: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      await api.post('/auth/reset-password', { token, newPassword }, { noAuth: true });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao redefinir senha' };
    }
  }
};

export default authService;
