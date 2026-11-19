import type { GameState, KillDistance, RoomSettings } from '../types/game';

export const MAX_PLAYERS_LIMIT = 40;
export const MIN_PLAYERS_LIMIT = 4;
export const MAX_IMPOSTORS_LIMIT = 6;
export const MIN_IMPOSTORS_LIMIT = 1;

export const BASE_PLAYER_SPEED = 245; // px/sec
export const PLAYER_RADIUS = 18;
export const INTERACT_RADIUS = 82;
export const REPORT_RADIUS = 115;
export const VENT_RADIUS = 72;

export const KILL_DISTANCE_PX: Record<KillDistance, number> = {
  short: 92,
  medium: 128,
  long: 168,
};

export const SABOTAGE_CRITICAL_DURATION_MS = 45_000;
export const SABOTAGE_COOLDOWN_MS = 28_000;
export const DOOR_CLOSE_DURATION_MS = 10_000;
export const SHAPESHIFT_DURATION_MS = 20_000;
export const SHAPESHIFT_COOLDOWN_MS = 28_000;
export const TRACKER_DURATION_MS = 25_000;
export const ENGINEER_VENT_MAX_MS = 15_000;

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  maxPlayers: 40,
  impostorCount: 2,
  mapId: 'aegis',
  killCooldown: 20,
  killDistance: 'medium',
  discussionTime: 20,
  votingTime: 45,
  emergencyMeetings: 1,
  emergencyCooldown: 15,
  playerSpeed: 1.0,
  crewVision: 1.0,
  impostorVision: 1.45,
  shortTasks: 2,
  longTasks: 1,
  commonTasks: 1,
  confirmEjects: true,
  anonymousVotes: false,
  visualTasks: true,
  enableAdvancedRoles: true,
};

export function createInitialGameState(): GameState {
  return {
    matchStartedAt: null,
    meetingCount: 0,
    deadBodies: [],
    activeSabotage: null,
    sabotageCooldownUntil: 0,
    emergencyCooldownUntil: 0,
    doorsClosedUntil: {},
    meeting: null,
    result: null,
    cameraWatchers: [],
  };
}

export const QUICK_CHAT_PHRASES: string[] = [
  '¿Dónde estaba el cuerpo?',
  'Vi a alguien usar un conducto.',
  'Estaba haciendo tareas.',
  'Es sospechoso, ¡voten!',
  'Saltemos voto por ahora (Skip).',
  'Yo puedo confirmar inocencia.',
  '¡Me siguió por los pasillos!',
  'Hubo sabotaje justo antes.',
];

export const BOT_NAMES: string[] = [
  'Nova', 'Orión', 'Vega', 'Sirius', 'Lyra', 'Atlas', 'Kira', 'Zane',
  'Echo', 'Luna', 'Rex', 'Milo', 'Nyx', 'Sora', 'Cyrus', 'Juno',
  'Vex', 'Ares', 'Cora', 'Dax', 'Rhea', 'Titus', 'Zara', 'Kai',
  'Bram', 'Faye', 'Gale', 'Hera', 'Iker', 'Jett', 'Kael', 'Lia',
  'Mako', 'Nora', 'Odin', 'Paz', 'Quin', 'Roko', 'Tala', 'Yuki',
];

export function recommendedImpostorsForCount(playerCount: number): number {
  if (playerCount <= 6) return 1;
  if (playerCount <= 12) return 2;
  if (playerCount <= 19) return 3;
  if (playerCount <= 26) return 4;
  if (playerCount <= 33) return 5;
  return 6;
}
