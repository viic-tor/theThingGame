import React, { useState } from 'react';
import {
  ArrowRight,
  HelpCircle,
  LogOut,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Palette,
  PlusCircle,
  Skull,
  Sparkles,
  Trophy,
  Users,
  Wrench,
} from 'lucide-react';
import { MAP_LIST } from '../maps';
import { isSupabaseConfigured } from '../services/supabaseClient';
import type { MapId, UserProfile } from '../types/game';
import { useFullscreen } from '../utils/fullscreen';
import { AvatarSVG } from './AvatarSVG';

interface HomeScreenProps {
  profile: UserProfile;
  initialRoomCode?: string;
  onCreateRoom: (mapId: MapId) => Promise<void>;
  onJoinRoom: (code: string) => Promise<void>;
  onOpenCustomizer: () => void;
  onLogout: () => Promise<void>;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  profile,
  initialRoomCode = '',
  onCreateRoom,
  onJoinRoom,
  onOpenCustomizer,
  onLogout,
}) => {
  const [joinCode, setJoinCode] = useState(initialRoomCode.toUpperCase());
  const [selectedMap, setSelectedMap] = useState<MapId>('aegis');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const fullscreen = useFullscreen();

  const handleCreate = async () => {
    setError(null);
    setBusy('create');
    try {
      await onCreateRoom(selectedMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la sala.');
    } finally {
      setBusy(null);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy('join');
    try {
      await onJoinRoom(joinCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo unir a la sala.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-[100dvh] stars-bg pb-10">
      {/* Top Bar */}
      <header className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur-lg border-b border-slate-800/80 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="font-display font-bold text-xl sm:text-2xl tracking-wider bg-gradient-to-r from-cyan-300 to-rose-400 bg-clip-text text-transparent">
              AMONG US 2
            </span>
            <span
              className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                isSupabaseConfigured && !profile.isLocalDemo
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-950/60 border-amber-500/40 text-amber-300'
              }`}
            >
              {isSupabaseConfigured && !profile.isLocalDemo ? 'Supabase Online' : 'Modo Local'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {fullscreen.supported && !fullscreen.standalone && (
              <button
                type="button"
                onClick={() => void fullscreen.toggle()}
                className={`p-2.5 rounded-xl border transition flex items-center gap-1.5 text-xs font-semibold ${
                  fullscreen.isFullscreen
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                    : 'bg-slate-900 border-slate-700 hover:border-cyan-400 text-slate-300 hover:text-white'
                }`}
                title={fullscreen.isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
              >
                {fullscreen.isFullscreen ? (
                  <Minimize2 className="w-5 h-5" />
                ) : (
                  <Maximize2 className="w-5 h-5" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowRules((v) => !v)}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-400 text-slate-300 hover:text-white transition"
              title="Reglas de Among Us 2"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-rose-500 text-slate-300 hover:text-rose-300 text-xs font-semibold transition"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-5 space-y-5">
        {/* Profile + Customization Card */}
        <section className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/70 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <button
              type="button"
              onClick={onOpenCustomizer}
              className="relative group p-2 rounded-2xl bg-slate-950/80 border border-slate-700 hover:border-cyan-400 transition shrink-0"
              title="Personalizar personaje"
            >
              <AvatarSVG cosmetics={profile.cosmetics} size={66} />
              <span className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-cyan-500 text-slate-950 shadow">
                <Palette className="w-3.5 h-3.5" />
              </span>
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display text-xl sm:text-2xl font-bold text-white truncate">
                  {profile.username}
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold">
                  Tripulante Activo
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">{profile.email}</p>

              {/* Career Stats */}
              <div className="flex flex-wrap items-center gap-3 mt-2.5 text-xs text-slate-300">
                <span className="inline-flex items-center gap-1">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  <strong>{profile.stats.crewmateWins + profile.stats.impostorWins}</strong> victorias
                </span>
                <span className="inline-flex items-center gap-1">
                  <Wrench className="w-3.5 h-3.5 text-cyan-400" />
                  <strong>{profile.stats.tasksCompleted}</strong> tareas
                </span>
                <span className="inline-flex items-center gap-1">
                  <Skull className="w-3.5 h-3.5 text-rose-400" />
                  <strong>{profile.stats.killsTotal}</strong> eliminaciones
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenCustomizer}
            className="w-full sm:w-auto px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-semibold text-sm flex items-center justify-center gap-2 transition min-h-[46px]"
          >
            <Palette className="w-4 h-4 text-cyan-300" />
            Personalizar Avatar
          </button>
        </section>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-950/75 border border-rose-500/50 text-rose-200 text-sm">
            {error}
          </div>
        )}

        {/* Primary Play Actions Grid (Mobile First Stack -> Desktop 2-col) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Join Room by Code */}
          <section className="lg:col-span-5 bg-slate-900/80 backdrop-blur-xl border border-slate-700/70 rounded-2xl p-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-semibold mb-3">
                <Users className="w-3.5 h-3.5" />
                Unirse con Código
              </div>
              <h3 className="font-display text-2xl font-bold text-white">Entrar a una Sala</h3>
              <p className="text-xs text-slate-400 mt-1">
                Introduce el código de 6 caracteres compartido por el anfitrión (salas de hasta 40 jugadores).
              </p>
            </div>

            <form onSubmit={handleJoin} className="space-y-3">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                placeholder="EJ. AU2X9K"
                maxLength={6}
                className="w-full text-center font-display text-2xl tracking-[0.35em] font-bold py-3.5 rounded-xl bg-slate-950 border-2 border-slate-700 focus:border-cyan-400 focus:outline-none text-cyan-300 placeholder-slate-600 uppercase"
              />
              <button
                type="submit"
                disabled={joinCode.length !== 6 || busy !== null}
                className="w-full py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-display font-bold text-base tracking-wide flex items-center justify-center gap-2 transition min-h-[48px]"
              >
                {busy === 'join' ? 'Entrando...' : 'Unirse a la Partida'}
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          </section>

          {/* Create Room with Map Choice */}
          <section className="lg:col-span-7 bg-slate-900/80 backdrop-blur-xl border border-slate-700/70 rounded-2xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold mb-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  Anfitrión de Partida
                </div>
                <h3 className="font-display text-2xl font-bold text-white">Crear Nueva Sala</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Elige uno de los 3 mapas. Podrás ajustar hasta 40 jugadores, 1–6 impostores y roles avanzados en el lobby.
                </p>
              </div>
            </div>

            {/* 3 Map Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {MAP_LIST.map((m) => {
                const active = selectedMap === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMap(m.id)}
                    className={`text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-2 ${
                      active
                        ? 'bg-slate-800/95 border-cyan-400 ring-2 ring-cyan-400/30'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: m.wallHighlight }}
                        />
                        <span className="text-[10px] font-semibold text-slate-400 uppercase">
                          {m.rooms.length} salas
                        </span>
                      </div>
                      <div className="font-display font-bold text-sm text-white leading-tight">
                        {m.name}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                        {m.subtitle}
                      </div>
                    </div>
                    <div className="text-[10px] font-semibold text-cyan-300 flex items-center gap-1">
                      <MapIcon className="w-3 h-3" />
                      {m.recommendedPlayers}
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleCreate}
              disabled={busy !== null}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-400 hover:to-orange-400 disabled:opacity-50 text-white font-display font-bold text-base tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20 transition min-h-[48px]"
            >
              <PlusCircle className="w-5 h-5" />
              {busy === 'create' ? 'Creando Sala...' : 'Crear Sala (Hasta 40 Jugadores)'}
            </button>
          </section>
        </div>

        {/* Collapsible Game Rules & AU2 Features Guide */}
        {showRules && (
          <section className="bg-slate-900/90 border border-cyan-500/30 rounded-2xl p-5 space-y-3 text-xs sm:text-sm text-slate-300">
            <h4 className="font-display text-lg font-bold text-cyan-300">
              Reglas de Among Us 2 y Novedades
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <div className="font-bold text-white">Tripulantes</div>
                <p>
                  Completa tus minijuegos de tareas (incluso como fantasma), usa Cámaras, Admin y Vitales, reporta cuerpos y expulsa a todos los Impostores en votación.
                </p>
              </div>
              <div className="space-y-1">
                <div className="font-bold text-rose-300">Impostores (1 a 6)</div>
                <p>
                  Elimina tripulantes sigilosamente, usa conductos de ventilación, sabotea Reactor, O2, Luces, Comms o Puertas y alcanza paridad numérica para ganar.
                </p>
              </div>
              <div className="space-y-1">
                <div className="font-bold text-amber-300">Roles Avanzados AU2</div>
                <p>
                  Ingeniero (puede ventilar), Científico (vitales portátiles), Rastreador (GPS de sospechosos) y Cambiaformas (disfraz temporal de otro jugador).
                </p>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};
