import React, { useState } from 'react';
import {
  Bot,
  Check,
  Copy,
  Crown,
  LogOut,
  Map as MapIcon,
  Maximize2,
  MessageSquare,
  Minimize2,
  Palette,
  Play,
  Send,
  Settings,
  Share2,
  Skull,
  Trash2,
  Users,
} from 'lucide-react';
import {
  MAX_IMPOSTORS_LIMIT,
  MAX_PLAYERS_LIMIT,
  MIN_PLAYERS_LIMIT,
  recommendedImpostorsForCount,
} from '../config/gameDefaults';
import { clampImpostorCount } from '../engine/rules';
import { MAP_LIST } from '../maps';
import type { ChatMessage, RoomData, RoomPlayer, RoomSettings } from '../types/game';
import { useFullscreen } from '../utils/fullscreen';
import { AvatarSVG } from './AvatarSVG';

interface LobbyScreenProps {
  room: RoomData;
  players: RoomPlayer[];
  myPlayerId: string;
  messages: ChatMessage[];
  onUpdateSettings: (settings: RoomSettings) => Promise<void>;
  onAddBots: (count: number) => Promise<void>;
  onRemoveBot: (botId: string) => Promise<void>;
  onStartMatch: () => Promise<void>;
  onSendMessage: (content: string) => Promise<void>;
  onOpenCustomizer: () => void;
  onLeaveRoom: () => Promise<void>;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  room,
  players,
  myPlayerId,
  messages,
  onUpdateSettings,
  onAddBots,
  onRemoveBot,
  onStartMatch,
  onSendMessage,
  onOpenCustomizer,
  onLeaveRoom,
}) => {
  const [activeMobileTab, setActiveMobileTab] = useState<'players' | 'settings' | 'chat'>('players');
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [starting, setStarting] = useState(false);
  const [botBusy, setBotBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fullscreen = useFullscreen();

  const me = players.find((p) => p.id === myPlayerId);
  const isHost = Boolean(me?.isHost);
  const settings = room.settings;
  const effectiveImpostors = clampImpostorCount(settings.impostorCount, Math.max(players.length, 4));
  const canStart = players.length >= MIN_PLAYERS_LIMIT;

  const copyCode = async () => {
    await navigator.clipboard?.writeText(room.code);
    setCopied('code');
    setTimeout(() => setCopied(null), 1800);
  };

  const copyShareLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${room.code}`;
    await navigator.clipboard?.writeText(url);
    setCopied('link');
    setTimeout(() => setCopied(null), 1800);
  };

  const patchSetting = async <K extends keyof RoomSettings>(key: K, value: RoomSettings[K]) => {
    if (!isHost) return;
    try {
      await onUpdateSettings({ ...settings, [key]: value });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error actualizando ajustes.');
    }
  };

  const handleAddBots = async (count: number) => {
    if (!isHost) return;
    setBotBusy(true);
    setError(null);
    try {
      await onAddBots(count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error añadiendo bots.');
    } finally {
      setBotBusy(false);
    }
  };

  const handleStart = async () => {
    if (!isHost || !canStart) return;
    void fullscreen.enterIfMobile();
    setStarting(true);
    setError(null);
    try {
      await onStartMatch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar la partida.');
      setStarting(false);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const text = chatInput.trim();
    setChatInput('');
    await onSendMessage(text);
  };

  const lobbyMessages = messages.filter((m) => m.channel === 'lobby' || m.channel === 'system');

  return (
    <div className="min-h-[100dvh] stars-bg flex flex-col">
      {/* Top Room Banner */}
      <header className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur-lg border-b border-slate-800 px-3 sm:px-5 py-3">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onLeaveRoom}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-rose-500 text-slate-300 hover:text-rose-300 transition"
              title="Salir de la sala"
            >
              <LogOut className="w-4 h-4" />
            </button>

            <div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
                Código de Sala
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-display text-xl sm:text-2xl font-bold tracking-[0.2em] text-cyan-300">
                  {room.code}
                </span>
                <button
                  type="button"
                  onClick={copyCode}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                  title="Copiar código"
                >
                  {copied === 'code' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={copyShareLink}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                  title="Copiar enlace de invitación"
                >
                  {copied === 'link' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Share2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Live Counters + Customize */}
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 flex items-center gap-1.5 text-xs font-bold">
              <Users className="w-4 h-4 text-cyan-400" />
              <span className="text-white">{players.length}</span>
              <span className="text-slate-500">/ {settings.maxPlayers}</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-rose-500/40 flex items-center gap-1.5 text-xs font-bold text-rose-300">
              <Skull className="w-4 h-4" />
              <span>{settings.impostorCount}</span>
            </div>
            <button
              type="button"
              onClick={onOpenCustomizer}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <Palette className="w-4 h-4 text-cyan-300" />
              <span className="hidden sm:inline">Avatar</span>
            </button>
            {fullscreen.supported && !fullscreen.standalone && (
              <button
                type="button"
                onClick={() => void fullscreen.toggle()}
                className={`p-2 rounded-xl border transition ${
                  fullscreen.isFullscreen
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-cyan-400'
                }`}
                title={fullscreen.isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
              >
                {fullscreen.isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Tab Switcher */}
      <div className="lg:hidden grid grid-cols-3 gap-1 p-2 bg-slate-950/70 border-b border-slate-800">
        <button
          type="button"
          onClick={() => setActiveMobileTab('players')}
          className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${
            activeMobileTab === 'players' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'
          }`}
        >
          <Users className="w-4 h-4" />
          Jugadores ({players.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveMobileTab('settings')}
          className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${
            activeMobileTab === 'settings' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'
          }`}
        >
          <Settings className="w-4 h-4" />
          Ajustes
        </button>
        <button
          type="button"
          onClick={() => setActiveMobileTab('chat')}
          className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${
            activeMobileTab === 'chat' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Chat ({lobbyMessages.length})
        </button>
      </div>

      {error && (
        <div className="max-w-6xl w-full mx-auto px-4 pt-3">
          <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs">
            {error}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-3 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 pb-28 lg:pb-6">
        {/* LEFT: Players Roster (up to 40) */}
        <section
          className={`lg:col-span-5 bg-slate-900/80 border border-slate-700/70 rounded-2xl p-4 flex flex-col gap-3 ${
            activeMobileTab === 'players' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-bold text-white">
                Tripulación ({players.length}/{settings.maxPlayers})
              </h2>
              <p className="text-[11px] text-slate-400">
                Mínimo {MIN_PLAYERS_LIMIT} jugadores • Recomendado:{' '}
                {recommendedImpostorsForCount(players.length)} impostor(es)
              </p>
            </div>
          </div>

          {/* Host AI Bots quick fill bar */}
          {isHost && (
            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-300 font-semibold">
                <span className="flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-cyan-400" />
                  Bots IA (para probar o completar sala)
                </span>
                <span className="text-slate-500">
                  {players.filter((p) => p.isBot).length} bots
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[1, 5, 10].map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={botBusy || players.length >= settings.maxPlayers}
                    onClick={() => handleAddBots(n)}
                    className="py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-bold text-cyan-300 transition"
                  >
                    +{n} Bot{n > 1 ? 's' : ''}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={botBusy || players.length >= settings.maxPlayers}
                  onClick={() => handleAddBots(settings.maxPlayers - players.length)}
                  className="py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 disabled:opacity-40 text-xs font-bold text-cyan-200 transition"
                >
                  Llenar ({settings.maxPlayers})
                </button>
              </div>
            </div>
          )}

          {/* 40-player scalable grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2 overflow-y-auto max-h-[52dvh] pr-1">
            {players.map((p) => (
              <div
                key={p.id}
                className={`p-2 rounded-xl border flex items-center justify-between gap-2 ${
                  p.id === myPlayerId
                    ? 'bg-cyan-950/40 border-cyan-500/50'
                    : 'bg-slate-950/60 border-slate-800'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <AvatarSVG cosmetics={p.cosmetics} size={36} />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate flex items-center gap-1">
                      {p.displayName}
                      {p.isHost && <Crown className="w-3 h-3 text-amber-400 shrink-0" />}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {p.isBot ? 'Bot IA' : p.id === myPlayerId ? 'Tú' : 'Jugador'}
                    </div>
                  </div>
                </div>
                {isHost && p.isBot && (
                  <button
                    type="button"
                    onClick={() => onRemoveBot(p.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition"
                    title="Quitar bot"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* MIDDLE: Map & Match Settings */}
        <section
          className={`lg:col-span-4 bg-slate-900/80 border border-slate-700/70 rounded-2xl p-4 flex flex-col gap-3.5 overflow-y-auto max-h-[68dvh] ${
            activeMobileTab === 'settings' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
              <Settings className="w-4 h-4 text-cyan-400" />
              Configuración
            </h2>
            {!isHost && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                Solo lectura
              </span>
            )}
          </div>

          {/* Map Picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <MapIcon className="w-3.5 h-3.5 text-cyan-400" />
              Mapa de la Partida
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {MAP_LIST.map((m) => {
                const selected = settings.mapId === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={!isHost}
                    onClick={() => patchSetting('mapId', m.id)}
                    className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between ${
                      selected
                        ? 'bg-slate-800 border-cyan-400'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-600'
                    } disabled:cursor-default`}
                  >
                    <div>
                      <div className="text-xs font-bold text-white">{m.name}</div>
                      <div className="text-[10px] text-slate-400">{m.subtitle} • {m.rooms.length} salas</div>
                    </div>
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: m.wallHighlight }}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Impostor Count (1 to 6) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-rose-300">Número de Impostores (1 – 6)</span>
              <span className="font-bold text-white">{settings.impostorCount}</span>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={!isHost}
                  onClick={() => patchSetting('impostorCount', Math.min(MAX_IMPOSTORS_LIMIT, n))}
                  className={`py-2 rounded-lg text-xs font-bold border transition ${
                    settings.impostorCount === n
                      ? 'bg-rose-500 border-rose-400 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            {effectiveImpostors < settings.impostorCount && (
              <p className="text-[10px] text-amber-300">
                Con {players.length} jugadores se asignarán {effectiveImpostors} impostor(es) para evitar victoria instantánea. Añade más jugadores para usar {settings.impostorCount}.
              </p>
            )}
          </div>

          {/* Sliders */}
          <div className="space-y-3 pt-1">
            <SettingSlider
              label="Máx. Jugadores"
              value={settings.maxPlayers}
              min={4}
              max={MAX_PLAYERS_LIMIT}
              step={1}
              suffix=""
              disabled={!isHost}
              onChange={(v) => patchSetting('maxPlayers', v)}
            />
            <SettingSlider
              label="Enfriamiento Eliminación"
              value={settings.killCooldown}
              min={10}
              max={45}
              step={5}
              suffix="s"
              disabled={!isHost}
              onChange={(v) => patchSetting('killCooldown', v)}
            />
            <SettingSlider
              label="Tiempo de Discusión"
              value={settings.discussionTime}
              min={10}
              max={60}
              step={5}
              suffix="s"
              disabled={!isHost}
              onChange={(v) => patchSetting('discussionTime', v)}
            />
            <SettingSlider
              label="Tiempo de Votación"
              value={settings.votingTime}
              min={15}
              max={120}
              step={15}
              suffix="s"
              disabled={!isHost}
              onChange={(v) => patchSetting('votingTime', v)}
            />
            <SettingSlider
              label="Velocidad de Jugadores"
              value={settings.playerSpeed}
              min={0.75}
              max={1.75}
              step={0.25}
              suffix="x"
              disabled={!isHost}
              onChange={(v) => patchSetting('playerSpeed', v)}
            />
            <SettingSlider
              label="Tareas Cortas por Tripulante"
              value={settings.shortTasks}
              min={1}
              max={5}
              step={1}
              suffix=""
              disabled={!isHost}
              onChange={(v) => patchSetting('shortTasks', v)}
            />
          </div>

          {/* Toggles */}
          <div className="space-y-2 pt-1 border-t border-slate-800">
            <SettingToggle
              label="Roles Avanzados AU2 (Ingeniero, Científico, Rastreador, Cambiaformas)"
              checked={settings.enableAdvancedRoles}
              disabled={!isHost}
              onChange={(v) => patchSetting('enableAdvancedRoles', v)}
            />
            <SettingToggle
              label="Confirmar Expulsiones"
              checked={settings.confirmEjects}
              disabled={!isHost}
              onChange={(v) => patchSetting('confirmEjects', v)}
            />
            <SettingToggle
              label="Votos Anónimos"
              checked={settings.anonymousVotes}
              disabled={!isHost}
              onChange={(v) => patchSetting('anonymousVotes', v)}
            />
            <SettingToggle
              label="Tareas Visuales (Escáner MedBay)"
              checked={settings.visualTasks}
              disabled={!isHost}
              onChange={(v) => patchSetting('visualTasks', v)}
            />
          </div>
        </section>

        {/* RIGHT: Lobby Chat */}
        <section
          className={`lg:col-span-3 bg-slate-900/80 border border-slate-700/70 rounded-2xl p-4 flex flex-col justify-between max-h-[68dvh] ${
            activeMobileTab === 'chat' ? 'flex min-h-[55dvh]' : 'hidden lg:flex'
          }`}
        >
          <h2 className="font-display text-lg font-bold text-white mb-2 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-cyan-400" />
            Chat de Sala
          </h2>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-3">
            {lobbyMessages.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">
                Comparte el código <strong className="text-cyan-400">{room.code}</strong> con tus amigos o añade Bots IA para empezar.
              </p>
            ) : (
              lobbyMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-2 rounded-xl text-xs ${
                    msg.channel === 'system'
                      ? 'bg-cyan-950/40 text-cyan-200 border border-cyan-500/20'
                      : 'bg-slate-950/70 text-slate-200 border border-slate-800'
                  }`}
                >
                  <span className="font-bold text-cyan-300 mr-1.5">{msg.senderName}:</span>
                  <span>{msg.content}</span>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSendChat} className="flex gap-1.5">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Escribe un mensaje..."
              maxLength={250}
              className="flex-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-400 focus:outline-none text-xs text-white"
            />
            <button
              type="submit"
              className="p-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition"
              aria-label="Enviar mensaje"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </section>
      </main>

      {/* Sticky Bottom Start Bar (Mobile-first ergonomic CTA) */}
      <footer className="fixed lg:sticky bottom-0 left-0 right-0 z-20 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800 px-4 py-3 pb-[max(0.75rem,var(--safe-bottom))]">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="text-xs text-slate-300 hidden sm:block">
            {isHost
              ? canStart
                ? `Todo listo: ${players.length} jugadores • ${effectiveImpostors} impostor(es) • ${MAP_LIST.find((m) => m.id === settings.mapId)?.name}`
                : `Necesitas al menos ${MIN_PLAYERS_LIMIT} jugadores (puedes añadir Bots IA).`
              : 'Esperando a que el anfitrión inicie la partida...'}
          </div>

          {isHost ? (
            <button
              type="button"
              disabled={!canStart || starting}
              onClick={handleStart}
              className="w-full sm:w-auto sm:min-w-[240px] py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-40 text-slate-950 font-display font-bold text-base tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition min-h-[48px]"
            >
              <Play className="w-5 h-5 fill-current" />
              {starting
                ? 'Iniciando...'
                : canStart
                  ? `INICIAR PARTIDA (${players.length})`
                  : `Faltan ${MIN_PLAYERS_LIMIT - players.length} jugadores`}
            </button>
          ) : (
            <div className="w-full sm:w-auto text-center px-5 py-3 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-cyan-300">
              Esperando al anfitrión...
            </div>
          )}
        </div>
      </footer>
    </div>
  );
};

interface SettingSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  disabled: boolean;
  onChange: (value: number) => void;
}

const SettingSlider: React.FC<SettingSliderProps> = ({
  label,
  value,
  min,
  max,
  step,
  suffix,
  disabled,
  onChange,
}) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-300">{label}</span>
      <span className="font-bold text-cyan-300">
        {value}
        {suffix}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-cyan-400 cursor-pointer disabled:opacity-50"
    />
  </div>
);

interface SettingToggleProps {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}

const SettingToggle: React.FC<SettingToggleProps> = ({
  label,
  checked,
  disabled,
  onChange,
}) => (
  <label className="flex items-center justify-between gap-3 py-1 cursor-pointer">
    <span className="text-xs text-slate-300 leading-snug">{label}</span>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full transition relative shrink-0 ${
        checked ? 'bg-cyan-500' : 'bg-slate-700'
      } disabled:opacity-50`}
    >
      <span
        className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${
          checked ? 'left-6' : 'left-1'
        }`}
      />
    </button>
  </label>
);
