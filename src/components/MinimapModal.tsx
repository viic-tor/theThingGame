import React from 'react';
import { AlertTriangle, DoorClosed, Flame, Radio, Wind, X, Zap } from 'lucide-react';
import type { GameMap, GameState, RoomPlayer, SabotageType } from '../types/game';

interface MinimapModalProps {
  map: GameMap;
  localPlayer: RoomPlayer;
  players: RoomPlayer[];
  gameState: GameState;
  now: number;
  sabotageMode: boolean;
  onTriggerSabotage: (type: SabotageType) => void;
  onCloseDoor: (doorId: string) => void;
  onClose: () => void;
}

export const MinimapModal: React.FC<MinimapModalProps> = ({
  map,
  localPlayer,
  players,
  gameState,
  now,
  sabotageMode,
  onTriggerSabotage,
  onCloseDoor,
  onClose,
}) => {
  const isImpostor = localPlayer.role === 'impostor';
  const sabotageCdSec = Math.max(0, Math.ceil((gameState.sabotageCooldownUntil - now) / 1000));
  const canSabotage = isImpostor && !gameState.activeSabotage && sabotageCdSec === 0;
  const commsBlocked = gameState.activeSabotage?.type === 'comms' && !isImpostor;

  // Tracker sub-role active ping
  const trackedPlayer = players.find(
    (p) =>
      p.isAlive &&
      p.trackedByPlayerId === localPlayer.id &&
      p.trackedUntil &&
      p.trackedUntil > now
  );

  return (
    <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
              {sabotageMode ? (
                <>
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                  Mapa de Sabotaje — {map.name}
                </>
              ) : (
                <>Mapa Táctico — {map.name}</>
              )}
            </h2>
            <p className="text-[11px] text-slate-400">
              {sabotageMode
                ? 'Activa un sabotaje global o sella puertas para aislar objetivos.'
                : 'Punto cian: tu posición • Estrellas amarillas: tus tareas pendientes'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SVG Map Blueprint */}
        <div className="p-3 sm:p-4 bg-slate-950/90 overflow-auto flex-1 flex items-center justify-center">
          <svg
            viewBox={`0 0 ${map.width} ${map.height}`}
            className="w-full max-h-[58dvh] rounded-xl border border-slate-800 bg-[#050811]"
          >
            {/* Corridors */}
            {map.corridors.map((c, idx) => (
              <rect
                key={`cor_${idx}`}
                x={c.x}
                y={c.y}
                width={c.w}
                height={c.h}
                fill="#1e293b"
                stroke={map.wallHighlight}
                strokeOpacity="0.3"
                strokeWidth="8"
              />
            ))}

            {/* Rooms */}
            {map.rooms.map((r) => (
              <g key={r.id}>
                <rect
                  x={r.rect.x}
                  y={r.rect.y}
                  width={r.rect.w}
                  height={r.rect.h}
                  rx="24"
                  fill={r.floorColor}
                  stroke={r.accentColor}
                  strokeWidth="12"
                />
                <text
                  x={r.rect.x + r.rect.w / 2}
                  y={r.rect.y + r.rect.h / 2}
                  textAnchor="middle"
                  fill="#f8fafc"
                  fontSize="44"
                  fontWeight="700"
                  opacity="0.9"
                >
                  {r.name}
                </text>
              </g>
            ))}

            {/* Tasks */}
            {!commsBlocked &&
              localPlayer.tasks
                .filter((t) => !t.completed)
                .map((t) => (
                  <g key={t.id}>
                    <circle cx={t.x} cy={t.y} r="36" fill="#facc15" fillOpacity="0.3" stroke="#facc15" strokeWidth="10" />
                    <circle cx={t.x} cy={t.y} r="14" fill="#fef08a" />
                  </g>
                ))}

            {/* Active Sabotage markers */}
            {gameState.activeSabotage &&
              gameState.activeSabotage.requiredStations
                .filter((id) => !gameState.activeSabotage!.fixedStations.includes(id))
                .map((id) => {
                  const st = map.sabotageStations.find((s) => s.id === id);
                  if (!st) return null;
                  return (
                    <circle
                      key={id}
                      cx={st.x}
                      cy={st.y}
                      r="55"
                      fill="#ef4444"
                      fillOpacity="0.4"
                      stroke="#ef4444"
                      strokeWidth="14"
                    />
                  );
                })}

            {/* Tracked player GPS ping (Tracker subrole) */}
            {trackedPlayer && (
              <g>
                <circle
                  cx={trackedPlayer.x}
                  cy={trackedPlayer.y}
                  r="48"
                  fill="#34d399"
                  fillOpacity="0.35"
                  stroke="#34d399"
                  strokeWidth="12"
                />
                <text
                  x={trackedPlayer.x}
                  y={trackedPlayer.y - 62}
                  textAnchor="middle"
                  fill="#34d399"
                  fontSize="44"
                  fontWeight="800"
                >
                  GPS: {trackedPlayer.displayName}
                </text>
              </g>
            )}

            {/* Local Player Marker */}
            <circle
              cx={localPlayer.x}
              cy={localPlayer.y}
              r="38"
              fill="#22d3ee"
              stroke="#ffffff"
              strokeWidth="12"
            />
          </svg>
        </div>

        {/* Impostor Sabotage Control Strip */}
        {isImpostor && (
          <div className="p-3.5 border-t border-slate-800 bg-slate-950/80 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-rose-300 uppercase tracking-wider">
                Controles de Sabotaje (Impostor)
              </span>
              {gameState.activeSabotage ? (
                <span className="text-amber-300 font-semibold">Sabotaje activo en curso</span>
              ) : sabotageCdSec > 0 ? (
                <span className="text-slate-400">Enfriamiento: {sabotageCdSec}s</span>
              ) : (
                <span className="text-emerald-400 font-semibold">Disponible</span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <SabotageBtn
                icon={<Flame className="w-4 h-4" />}
                label="Reactor (Crítico)"
                disabled={!canSabotage}
                onClick={() => {
                  onTriggerSabotage('reactor');
                  onClose();
                }}
              />
              <SabotageBtn
                icon={<Wind className="w-4 h-4" />}
                label="Oxígeno O2 (Crítico)"
                disabled={!canSabotage}
                onClick={() => {
                  onTriggerSabotage('o2');
                  onClose();
                }}
              />
              <SabotageBtn
                icon={<Zap className="w-4 h-4" />}
                label="Cortar Luces"
                disabled={!canSabotage}
                onClick={() => {
                  onTriggerSabotage('lights');
                  onClose();
                }}
              />
              <SabotageBtn
                icon={<Radio className="w-4 h-4" />}
                label="Comunicaciones"
                disabled={!canSabotage}
                onClick={() => {
                  onTriggerSabotage('comms');
                  onClose();
                }}
              />
            </div>

            {/* Sealable Doors */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <span className="text-[11px] text-slate-400 shrink-0 flex items-center gap-1 mr-1">
                <DoorClosed className="w-3.5 h-3.5 text-amber-400" />
                Puertas (10s):
              </span>
              {map.doors.map((door) => {
                const closed = Boolean(
                  gameState.doorsClosedUntil[door.id] && gameState.doorsClosedUntil[door.id] > now
                );
                return (
                  <button
                    key={door.id}
                    type="button"
                    disabled={closed}
                    onClick={() => onCloseDoor(door.id)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/70 border border-slate-700 hover:border-rose-500 disabled:opacity-40 text-[11px] font-semibold text-slate-200 whitespace-nowrap"
                  >
                    {closed ? `Cerrada: ${door.label}` : `Cerrar ${door.label}`}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const SabotageBtn: React.FC<{
  icon: React.ReactNode;
  label: string;
  disabled: boolean;
  onClick: () => void;
}> = ({ icon, label, disabled, onClick }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className="py-2.5 px-3 rounded-xl bg-rose-950/60 hover:bg-rose-600 border border-rose-500/50 disabled:opacity-40 text-rose-100 text-xs font-bold flex items-center justify-center gap-1.5 transition min-h-[42px]"
  >
    {icon}
    <span className="truncate">{label}</span>
  </button>
);
