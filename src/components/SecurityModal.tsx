import React from 'react';
import { Activity, Eye, MapPin, Radar, ShieldAlert, X } from 'lucide-react';
import { getRoomAtPoint } from '../engine/collision';
import type { GameMap, GameState, RoomPlayer } from '../types/game';
import { AvatarSVG } from './AvatarSVG';

export type UtilityModalMode = 'admin' | 'vitals' | 'shapeshift' | 'tracker' | null;

interface SecurityModalProps {
  mode: UtilityModalMode;
  map: GameMap;
  players: RoomPlayer[];
  localPlayer: RoomPlayer;
  gameState: GameState;
  onSelectTarget?: (targetPlayerId: string) => void;
  onClose: () => void;
}

export const SecurityModal: React.FC<SecurityModalProps> = ({
  mode,
  map,
  players,
  localPlayer,
  gameState,
  onSelectTarget,
  onClose,
}) => {
  if (!mode) return null;

  const commsDown = gameState.activeSabotage?.type === 'comms';

  // Compute Admin room counts
  const roomCounts = new Map<string, number>();
  for (const p of players) {
    if (!p.isAlive) continue;
    const room = getRoomAtPoint(map, p.x, p.y);
    if (room) {
      roomCounts.set(room.id, (roomCounts.get(room.id) ?? 0) + 1);
    }
  }
  for (const body of gameState.deadBodies) {
    const room = getRoomAtPoint(map, body.x, body.y);
    if (room) {
      roomCounts.set(room.id, (roomCounts.get(room.id) ?? 0) + 1);
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden max-h-[88dvh] flex flex-col">
        <div className="px-4 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
            {mode === 'admin' && (
              <>
                <MapPin className="w-5 h-5 text-cyan-400" />
                Mesa de Administración — Ocupación por Sala
              </>
            )}
            {mode === 'vitals' && (
              <>
                <Activity className="w-5 h-5 text-emerald-400" />
                Monitor de Signos Vitales ({players.length} Tripulantes)
              </>
            )}
            {mode === 'shapeshift' && (
              <>
                <Eye className="w-5 h-5 text-rose-400" />
                Cambiaformas — Elegir Identidad (20s)
              </>
            )}
            {mode === 'tracker' && (
              <>
                <Radar className="w-5 h-5 text-emerald-400" />
                Rastreador GPS — Elegir Objetivo (25s)
              </>
            )}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {commsDown && (mode === 'admin' || mode === 'vitals') ? (
            <div className="py-12 text-center space-y-2 text-rose-300">
              <ShieldAlert className="w-10 h-10 mx-auto" />
              <div className="font-display font-bold text-lg">COMUNICACIONES SABOTEADAS</div>
              <p className="text-xs text-slate-400">
                Repara la consola de Comunicaciones para restaurar sensores.
              </p>
            </div>
          ) : mode === 'admin' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {map.rooms.map((room) => {
                const count = roomCounts.get(room.id) ?? 0;
                return (
                  <div
                    key={room.id}
                    className={`p-3 rounded-xl border flex flex-col justify-between gap-2 ${
                      count > 0
                        ? 'bg-cyan-950/35 border-cyan-500/50'
                        : 'bg-slate-950/60 border-slate-800'
                    }`}
                  >
                    <div className="text-xs font-bold text-white truncate">{room.name}</div>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap gap-1">
                        {Array.from({ length: Math.min(count, 8) }).map((_, i) => (
                          <span key={i} className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                        ))}
                        {count > 8 && <span className="text-[10px] text-cyan-300">+{count - 8}</span>}
                      </div>
                      <span className="font-mono text-sm font-bold text-cyan-300">{count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : mode === 'vitals' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {players.map((p) => (
                <div
                  key={p.id}
                  className={`p-2.5 rounded-xl border flex items-center gap-2.5 ${
                    p.isAlive
                      ? 'bg-emerald-950/30 border-emerald-500/40'
                      : 'bg-rose-950/40 border-rose-500/40'
                  }`}
                >
                  <AvatarSVG cosmetics={p.cosmetics} size={36} dead={!p.isAlive} />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">{p.displayName}</div>
                    <div
                      className={`text-[11px] font-mono font-bold ${
                        p.isAlive ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {p.isAlive ? '● OK' : '✕ SIN PULSO'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {players
                .filter((p) => p.isAlive && p.id !== localPlayer.id)
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onSelectTarget?.(p.id);
                      onClose();
                    }}
                    className="p-2.5 rounded-xl bg-slate-950/70 hover:bg-slate-800 border border-slate-700 hover:border-cyan-400 flex items-center gap-2.5 text-left transition"
                  >
                    <AvatarSVG cosmetics={p.cosmetics} size={38} />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">{p.displayName}</div>
                      <div className="text-[10px] text-cyan-300">Seleccionar</div>
                    </div>
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
