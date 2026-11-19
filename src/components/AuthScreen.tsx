import React, { useState } from 'react';
import { Cloud, CloudOff, Lock, Mail, Rocket, ShieldCheck, User as UserIcon } from 'lucide-react';
import { DEFAULT_COSMETICS } from '../config/cosmetics';
import { loginAccount, registerAccount } from '../services/authService';
import { isSupabaseConfigured } from '../services/supabaseClient';
import type { UserProfile } from '../types/game';
import { AvatarSVG } from './AvatarSVG';

interface AuthScreenProps {
  onAuthenticated: (profile: UserProfile) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const profile =
        mode === 'register'
          ? await registerAccount(email, password, username)
          : await loginAccount(email, password);
      onAuthenticated(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error al autenticar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] stars-bg flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md space-y-5">
        {/* Hero Brand */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="animate-float">
              <AvatarSVG cosmetics={{ ...DEFAULT_COSMETICS, color: 'red', hat: 'crown', visor: 'cyber' }} size={54} />
            </div>
            <div className="animate-float" style={{ animationDelay: '0.6s' }}>
              <AvatarSVG cosmetics={{ ...DEFAULT_COSMETICS, color: 'cyan', hat: 'astronaut', pet: 'drone' }} size={62} />
            </div>
            <div className="animate-float" style={{ animationDelay: '1.2s' }}>
              <AvatarSVG cosmetics={{ ...DEFAULT_COSMETICS, color: 'purple', hat: 'horns', visor: 'laser' }} size={54} />
            </div>
          </div>

          <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-wider bg-gradient-to-r from-cyan-300 via-white to-rose-400 bg-clip-text text-transparent">
            AMONG US 2
          </h1>
          <p className="text-sm text-slate-300">
            Multijugador en tiempo real • Hasta <span className="text-cyan-300 font-semibold">40 jugadores</span> •{' '}
            <span className="text-rose-400 font-semibold">6 impostores</span> • 3 mapas
          </p>
        </div>

        {/* Supabase Connection Status Pill */}
        <div
          className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs ${
            isSupabaseConfigured
              ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
              : 'bg-amber-950/50 border-amber-500/40 text-amber-200'
          }`}
        >
          {isSupabaseConfigured ? (
            <>
              <Cloud className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>
                <strong>Supabase conectado:</strong> cuentas, personalización y salas multijugador en tiempo real activas.
              </span>
            </>
          ) : (
            <>
              <CloudOff className="w-4 h-4 shrink-0 text-amber-400" />
              <span>
                <strong>Modo Práctica Local:</strong> configura <code className="text-amber-300">VITE_SUPABASE_URL</code> y{' '}
                <code className="text-amber-300">VITE_SUPABASE_ANON_KEY</code> en <code className="text-amber-300">.env</code>{' '}
                para sincronización online con Supabase.
              </span>
            </>
          )}
        </div>

        {/* Auth Card */}
        <div className="bg-slate-900/85 backdrop-blur-xl border border-slate-700/70 rounded-2xl p-5 sm:p-6 shadow-2xl shadow-black/60">
          {/* Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950/70 rounded-xl mb-5">
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`py-2.5 text-sm font-semibold rounded-lg transition-all min-h-[44px] ${
                mode === 'register'
                  ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/25'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Crear Cuenta
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`py-2.5 text-sm font-semibold rounded-lg transition-all min-h-[44px] ${
                mode === 'login'
                  ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/25'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Iniciar Sesión
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Nombre de Tripulante
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={24}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Ej. ComandanteNova"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950/80 border border-slate-700 focus:border-cyan-400 focus:outline-none text-white placeholder-slate-500 text-sm"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tripulante@nave.space"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950/80 border border-slate-700 focus:border-cyan-400 focus:outline-none text-white placeholder-slate-500 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950/80 border border-slate-700 focus:border-cyan-400 focus:outline-none text-white placeholder-slate-500 text-sm"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-200 text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 font-display font-bold text-base tracking-wide text-white shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 min-h-[48px]"
            >
              <Rocket className="w-5 h-5" />
              {loading
                ? 'Conectando...'
                : mode === 'register'
                  ? 'Registrarse y Entrar'
                  : 'Entrar a la Nave'}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Tu personalización y estadísticas se guardan en tu perfil.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
