import React from 'react';
import { Clock, LogOut, RotateCcw, Skull, Trophy, Wrench } from 'lucide-react';
import { getSubRoleLabel } from '../engine/rules';
import type { MatchResult, RoomPlayer } from '../types/game';
import { AvatarSVG } from './AvatarSVG';

interface ResultsModalProps {
  result: MatchResult;
  players: RoomPlayer[];
  localPlayer: RoomPlayer;
  isHost: boolean;
  onReturnToLobby: () => void;
  onLeaveRoom: () => void;
}

export const ResultsModal: React.FC<ResultsModalProps> = ({
  result,
  players,
  localPlayer,
  isHost,
  onReturnToLobby,
  onLeaveRoom,
}) => {
  const crewmatesWon = result.winner === 'crewmates';
  const iWon =
    (crewmatesWon && localPlayer.role === 'crewmate') ||
    (!crewmatesWon && localPlayer.role === 'impostor');

  const impostors = players.filter((p) => result.impostorIds.includes(p.id) || p.role === 'impostor');
  const crewmates = players.filter((p) => !impostors.some((i) => i.id === p.id));

  const mins = Math.floor(result.durationSeconds / 60);
  const secs = result.durationSeconds % 60;

  return (
    <div className="fixed inset-0 z-50 stars-bg overflow-y-auto flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-slate-900/90 backdrop-blur-xl border border-slate-700 rounded-3xl shadow-2xl overflow-hidden my-auto">
        {/* Hero Banner */}
        <div
          className={`p-6 sm:p-8 text-center border-b ${
            crewmatesWon
              ? 'bg-gradient-to-b from-cyan-950/90 to-slate-900 border-cyan-500/40'
              : 'bg-gradient-to-b from-rose-950/90 to-slate-900 border-rose-500/40'
          }`}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 border border-white/15 text-xs font-bold mb-3">
            {iWon ? (
              <span className="text-emerald-300 flex items-center gap-1.5">
                <Trophy className="w-4 h-4" /> ¡VICTORIA PERSONAL!
              </span>
            ) : (
              <span className="text-rose-300 flex items-center gap-1.5">
                <Skull className="w-4 h-4" /> DERROTA
              </span>
            )}
          </div>

          <h1
            className={`font-display text-3xl sm:text-5xl font-bold tracking-wider ${
              crewmatesWon ? 'text-cyan-300' : 'text-rose-400'
            }`}
          >
            {crewmatesWon ? 'VICTORIA DE TRIPULANTES' : 'VICTORIA DE IMPOSTORES'}
          </h1>
          <p className="text-sm text-slate-200 mt-2">{result.reason}</p>

          <div className="flex flex-wrap items-center justify-center gap-4 mt-4 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/60 border border-slate-700">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              Duración: {mins}m {secs}s
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/60 border border-slate-700">
              <Wrench className="w-3.5 h-3.5 text-emerald-400" />
              Tareas: {Math.round(result.taskCompletionRatio * 100)}%
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/60 border border-slate-700">
              <Skull className="w-3.5 h-3.5 text-rose-400" />
              Impostores: {impostors.length}
            </span>
          </div>
        </div>

        {/* Impostors Reveal */}
        <div className="p-5 sm:p-6 space-y-5">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-rose-400 mb-3">
              Los Impostores eran ({impostors.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {impostors.map((imp) => (
                <div
                  key={imp.id}
                  className="p-3 rounded-2xl bg-rose-950/40 border border-rose-500/40 flex items-center gap-3"
                >
                  <AvatarSVG cosmetics={imp.cosmetics} size={46} dead={!imp.isAlive} />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate">{imp.displayName}</div>
                    <div className="text-[11px] text-rose-300">
                      {imp.subRole !== 'none' ? getSubRoleLabel(imp.subRole) : 'Impostor'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {imp.killsThisMatch ?? 0} eliminaciones
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Crewmates Summary */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-cyan-400 mb-2.5">
              Tripulación ({crewmates.length})
            </h2>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {crewmates.map((c) => {
                const done = c.tasks.filter((t) => t.completed).length;
                return (
                  <div
                    key={c.id}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center gap-2 text-xs"
                  >
                    <AvatarSVG cosmetics={c.cosmetics} size={24} dead={!c.isAlive} />
                    <span className={c.isAlive ? 'text-slate-100 font-medium' : 'text-slate-500 line-through'}>
                      {c.displayName}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono">
                      {done}/{c.tasks.length}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            {isHost ? (
              <button
                type="button"
                onClick={onReturnToLobby}
                className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-display font-bold text-base flex items-center justify-center gap-2 min-h-[48px]"
              >
                <RotateCcw className="w-5 h-5" />
                Volver a la Sala (Jugar de Nuevo)
              </button>
            ) : (
              <div className="flex-1 py-3.5 px-4 rounded-xl bg-slate-800 text-center text-xs font-semibold text-cyan-300">
                Esperando a que el anfitrión regrese a la sala...
              </div>
            )}
            <button
              type="button"
              onClick={onLeaveRoom}
              className="px-5 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-sm flex items-center justify-center gap-2 min-h-[48px]"
            >
              <LogOut className="w-4 h-4" />
              Salir al Menú
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
