import React, { useState, useRef, useEffect } from 'react';
import { User } from '../../core/types/types';
import { authService } from '../../auth/services/authService';
import { uploadAvatar } from '../../media/services/imageService';
import { Camera, Save, Loader2, Moon, Sun, LogOut, Palette, RotateCcw, UserCircle } from 'lucide-react';
import { Toast } from '../../core/components/ui/Toast';
import { Avatar } from '../../core/components/ui/Avatar';
import { PageShell } from '../../core/components/layout/PageShell';
import { applyTheme, applyFontFamily, applyBorderRadius, applyThemePreset, FONT_OPTIONS, RADIUS_OPTIONS, COLOR_PRESETS, THEME_PRESETS } from '../utils/theme';
import api from '../services/apiClient';
import { invalidateLogoCache } from '../services/systemSettingsService';

interface UserProfileProps {
  currentUser: User;
  onBack?: () => void;
  onUpdate?: (updatedUser: User) => void;
  showToast?: (message: string, type: Toast['type'], duration?: number) => void;
  onLogout?: () => void;
  toggleTheme?: () => void;
  isDarkMode?: boolean;
}

const DEFAULT_COLOR = '#059669';
const TAB = { PROFILE: 'profile', APPEARANCE: 'appearance' } as const;
type TabId = typeof TAB[keyof typeof TAB];

export const UserProfile: React.FC<UserProfileProps> = ({
  currentUser,
  onBack,
  onUpdate,
  showToast,
  onLogout,
  toggleTheme,
  isDarkMode = true
}) => {
  const [tab, setTab] = useState<TabId>(TAB.PROFILE);

  const [name, setName] = useState(currentUser.name || '');
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [avatar, setAvatar] = useState(currentUser.avatar || '');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [themeColor, setThemeColor] = useState(DEFAULT_COLOR);
  const [themeFont, setThemeFont] = useState('Inter');
  const [themeRadius, setThemeRadius] = useState('default');
  const [themePreset, setThemePreset] = useState('stripe');
  const [savingTheme, setSavingTheme] = useState(false);

  useEffect(() => {
    api.get<any>('/tax/config').then(c => {
      if (c?.themePrimaryColor) setThemeColor(c.themePrimaryColor);
      if (c?.themeFont) setThemeFont(c.themeFont);
      if (c?.themeRadius) setThemeRadius(c.themeRadius);
      if (c?.themePreset) setThemePreset(c.themePreset);
    }).catch(() => {});
  }, []);

  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      showToast?.('Tipo de arquivo não suportado. Use JPEG, PNG, WEBP ou GIF.', 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast?.('Arquivo muito grande. Tamanho máximo: 2MB.', 'error');
      return;
    }
    setIsUploading(true);
    try {
      const avatarUrl = await uploadAvatar(file, currentUser.id);
      if (avatarUrl) {
        setAvatar(avatarUrl);
        onUpdate?.({ ...currentUser, avatar: avatarUrl });
        showToast?.('Foto atualizada com sucesso!', 'success');
      } else {
        showToast?.('Erro ao fazer upload da foto. Tente novamente.', 'error');
      }
    } catch (error: any) {
      showToast?.(error.message || 'Erro ao fazer upload da foto.', 'error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showToast?.('O nome é obrigatório.', 'error');
      return;
    }
    setIsLoading(true);
    try {
      const result = await authService.updateProfile(currentUser.id, {
        name: name.trim(),
        phone: phone.trim() || undefined,
        avatar: avatar || undefined
      });
      if (result.success) {
        showToast?.('Perfil atualizado com sucesso!', 'success');
        onUpdate?.({
          ...currentUser,
          name: name.trim(),
          phone: phone.trim() || undefined,
          avatar: avatar || currentUser.avatar
        });
      } else {
        showToast?.(result.error || 'Erro ao atualizar perfil.', 'error');
      }
    } catch (error: any) {
      showToast?.(error.message || 'Erro ao atualizar perfil.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTheme = async () => {
    setSavingTheme(true);
    try {
      await api.put('/tax/config', { themePrimaryColor: themeColor, themeFont, themeRadius, themePreset });
      applyTheme(themeColor);
      applyFontFamily(themeFont);
      applyBorderRadius(themeRadius);
      invalidateLogoCache();
      showToast?.('Tema guardado com sucesso', 'success');
    } catch (e: any) {
      showToast?.(e.message || 'Erro ao guardar tema', 'error');
    } finally { setSavingTheme(false); }
  };

  const handleResetTheme = () => {
    setThemeColor(DEFAULT_COLOR);
    setThemeFont('Inter');
    setThemeRadius('default');
    setThemePreset('stripe');
    applyThemePreset('stripe');
  };

  const headerActions = (
    <div className="flex gap-2">
      {toggleTheme && (
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2 px-4 py-2 border border-border-default rounded-lg text-sm font-medium text-content-secondary hover:bg-surface-base transition-colors min-h-[44px]"
          aria-label={isDarkMode ? 'Ativar modo claro' : 'Ativar modo escuro'}
        >
          {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          <span className="hidden sm:inline">{isDarkMode ? 'Modo Claro' : 'Modo Escuro'}</span>
        </button>
      )}
      {onLogout && (
        <button
          onClick={onLogout}
          className="flex items-center gap-2 px-4 py-2 border border-red-300 dark:border-red-700 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors min-h-[44px]"
          aria-label="Sair"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Sair</span>
        </button>
      )}
    </div>
  );

  const inputCls = 'w-full px-4 py-3 border border-border-default rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all text-sm';
  const labelCls = 'block text-sm font-medium text-content-secondary mb-2';

  return (
    <div className="max-w-4xl mx-auto">
      <PageShell
        title="Meu Perfil"
        description="Gerencie suas informações pessoais e aparência da interface"
        actions={headerActions}
        compactHeaderMobile
      >
        {/* Tabs */}
        <div className="border-b border-border-default -mx-3 sm:-mx-4 md:-mx-8 px-3 sm:px-4 md:px-8">
          <div className="flex overflow-x-auto">
            {[
              { id: TAB.PROFILE,    label: 'Meu Perfil',  icon: UserCircle },
              { id: TAB.APPEARANCE, label: 'Aparência',   icon: Palette },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 sm:px-5 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab === t.id
                    ? 'border-brand-600 text-brand-600 dark:text-brand-400 dark:border-brand-400'
                    : 'border-transparent text-content-muted hover:text-content-primary'
                }`}
              >
                <t.icon className="w-4 h-4" />{t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Meu Perfil ── */}
        {tab === TAB.PROFILE && (
          <div className="bg-surface-raised rounded-xl shadow-sm border border-border-default overflow-hidden">
            <div className="p-6 sm:p-8">
              <div className="flex flex-col items-center mb-8">
                <div className="relative">
                  <div className="relative shadow-lg ring-4 ring-surface-raised">
                    <Avatar src={avatar} alt={currentUser.name} name={name || currentUser.name} size="xl" />
                  </div>
                  <button
                    onClick={handleAvatarClick}
                    disabled={isUploading}
                    className="absolute bottom-0 right-0 p-3 bg-brand-600 hover:bg-brand-700 text-white rounded-full shadow-lg transition-all hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Alterar foto"
                  >
                    {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileChange} className="hidden" />
                </div>
                <p className="text-sm text-content-muted mt-4 text-center">Clique no ícone da câmera para alterar sua foto</p>
                <p className="text-xs text-content-muted mt-1 text-center">Formatos: JPEG, PNG, WEBP, GIF · Máximo: 2MB</p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className={labelCls}>Nome Completo *</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="Seu nome completo" required />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input type="email" value={currentUser.email} disabled className="w-full px-4 py-3 border border-border-default rounded-lg bg-surface-base text-content-muted cursor-not-allowed text-sm" />
                  <p className="text-xs text-content-muted mt-1">O email não pode ser alterado</p>
                </div>
                <div>
                  <label className={labelCls}>Telefone</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} placeholder="+258 XX XXX XXXX" />
                </div>
                <div>
                  <label className={labelCls}>Função</label>
                  <input type="text" value={currentUser.roleDisplayName || currentUser.role} disabled className="w-full px-4 py-3 border border-border-default rounded-lg bg-surface-base text-content-muted cursor-not-allowed text-sm" />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-8 pt-6 border-t border-border-default">
                <button
                  onClick={handleSave}
                  disabled={isLoading || !name.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
                >
                  {isLoading
                    ? <><Loader2 className="w-5 h-5 animate-spin" /><span>Salvando...</span></>
                    : <><Save className="w-5 h-5" /><span>Salvar Alterações</span></>}
                </button>
                {onBack && (
                  <button onClick={onBack} className="px-6 py-3 border border-border-default text-content-secondary rounded-lg font-medium hover:bg-surface-base transition-colors min-h-[44px]">
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Aparência ── */}
        {tab === TAB.APPEARANCE && (
          <div className="space-y-4">

            {/* Tema Predefinido */}
            <div className="bg-surface-raised rounded-xl border border-border-default p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-content-primary">Tema Predefinido</h3>
                <p className="text-xs text-content-muted mt-0.5">Escolhe um tema completo — cores, sombras e superfícies</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {THEME_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setThemePreset(preset.id);
                      setThemeColor(preset.brandColor);
                      applyThemePreset(preset.id);
                    }}
                    className={`p-3 rounded-xl border-2 text-left transition-all space-y-2 ${
                      themePreset === preset.id
                        ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/20'
                        : 'border-border-default hover:border-border-strong'
                    }`}
                  >
                    {/* Mini colour swatch row */}
                    <div className="flex gap-1.5">
                      {preset.previewColors.map((c, i) => (
                        <div key={i} className="w-5 h-5 rounded-full border border-black/10 flex-shrink-0" style={{ background: c }} />
                      ))}
                    </div>
                    <p className="text-sm font-semibold text-content-primary">{preset.name}</p>
                    <p className="text-[10px] text-content-muted leading-tight">{preset.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Cor Principal */}
            <div className="bg-surface-raised rounded-xl border border-border-default p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-content-primary">Cor Principal da Marca</h3>
                  <p className="text-xs text-content-muted mt-0.5">Aplica-se a botões, destaques e toda a interface admin</p>
                </div>
                <div className="w-10 h-10 rounded-xl border-2 border-border-default shadow-sm" style={{ background: themeColor }} />
              </div>

              <div>
                <p className="text-xs font-medium text-content-muted mb-3">Cores predefinidas</p>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PRESETS.map(p => (
                    <button
                      key={p.value}
                      onClick={() => setThemeColor(p.value)}
                      title={p.label}
                      className={`w-9 h-9 rounded-lg border-2 transition-all hover:scale-110 ${themeColor === p.value ? 'border-content-primary scale-110' : 'border-transparent'}`}
                      style={{ background: p.value }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-content-muted mb-1">Cor personalizada</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={themeColor}
                    onChange={e => setThemeColor(e.target.value)}
                    className="w-12 h-10 rounded-lg cursor-pointer border border-border-default p-0.5 bg-surface-raised"
                  />
                  <input
                    type="text"
                    value={themeColor}
                    onChange={e => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && setThemeColor(e.target.value)}
                    className="w-28 px-3 py-2 text-sm font-mono border border-border-default rounded-lg bg-surface-raised text-content-primary"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-border-default">
                <p className="text-xs font-medium text-content-muted mb-2">Pré-visualização</p>
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: themeColor }}>Botão Principal</span>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold text-white" style={{ background: themeColor }}>Etiqueta</span>
                  <span className="text-sm font-semibold" style={{ color: themeColor }}>Texto colorido</span>
                  <span className="px-3 py-1 rounded-lg text-sm border-2 font-medium" style={{ borderColor: themeColor, color: themeColor }}>Botão Outline</span>
                </div>
              </div>
            </div>

            {/* Tipografia */}
            <div className="bg-surface-raised rounded-xl border border-border-default p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-content-primary">Tipografia</h3>
                <p className="text-xs text-content-muted mt-0.5">Fonte usada em toda a interface da dashboard</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {FONT_OPTIONS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => setThemeFont(f.value)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${themeFont === f.value ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/20' : 'border-border-default hover:border-border-strong'}`}
                  >
                    <p className="text-base font-medium text-content-primary" style={{ fontFamily: f.stack }}>{f.label}</p>
                    <p className="text-xs text-content-muted mt-0.5" style={{ fontFamily: f.stack }}>Aa Bb Cc 123</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Border Radius */}
            <div className="bg-surface-raised rounded-xl border border-border-default p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-content-primary">Estilo de Cantos</h3>
                <p className="text-xs text-content-muted mt-0.5">Arredondamento dos elementos da interface</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {RADIUS_OPTIONS.map(r => {
                  const rStyle: Record<string, string> = { sharp: '2px', default: '10px', rounded: '20px', pill: '999px' };
                  return (
                    <button
                      key={r.value}
                      onClick={() => setThemeRadius(r.value)}
                      className={`p-3 border-2 transition-all flex flex-col items-center gap-2 ${themeRadius === r.value ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/20' : 'border-border-default hover:border-border-strong'}`}
                      style={{ borderRadius: rStyle[r.value] }}
                    >
                      <div className="w-10 h-7 bg-surface-base" style={{ borderRadius: rStyle[r.value] }} />
                      <span className="text-xs font-medium text-content-secondary">{r.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Acções */}
            <div className="flex items-center justify-between pb-2">
              <button
                onClick={handleResetTheme}
                className="flex items-center gap-2 px-4 py-2 text-sm text-content-secondary hover:bg-surface-base rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4" /> Repor padrão
              </button>
              <button
                onClick={handleSaveTheme}
                disabled={savingTheme}
                className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
              >
                {savingTheme ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar Tema
              </button>
            </div>

          </div>
        )}

      </PageShell>
    </div>
  );
};
