export type MapId = 'aegis' | 'borealis' | 'solaris';

export type PlayerRole = 'crewmate' | 'impostor';

export type PlayerSubRole =
  | 'none'
  | 'engineer'
  | 'scientist'
  | 'tracker'
  | 'shapeshifter';

export type KillDistance = 'short' | 'medium' | 'long';

export type RoomStatus = 'lobby' | 'playing' | 'meeting' | 'finished';

export type TaskType =
  | 'wiring'
  | 'reactor_seq'
  | 'swipe_card'
  | 'asteroids'
  | 'download'
  | 'steering'
  | 'med_scan'
  | 'shields';

export type SabotageType = 'reactor' | 'o2' | 'lights' | 'comms';

export interface PlayerCosmetics {
  color: string;
  hat: string;
  visor: string;
  skin: string;
  pet: string;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  cosmetics: PlayerCosmetics;
  stats: {
    gamesPlayed: number;
    crewmateWins: number;
    impostorWins: number;
    tasksCompleted: number;
    killsTotal: number;
  };
  isLocalDemo?: boolean;
}

export interface RoomSettings {
  maxPlayers: number; // 4 to 40
  impostorCount: number; // 1 to 6
  mapId: MapId;
  killCooldown: number; // seconds (10 - 60)
  killDistance: KillDistance;
  discussionTime: number; // seconds (10 - 60)
  votingTime: number; // seconds (15 - 120)
  emergencyMeetings: number; // 1 - 5
  emergencyCooldown: number; // seconds (10 - 45)
  playerSpeed: number; // 0.75 - 2.0
  crewVision: number; // 0.5 - 2.0
  impostorVision: number; // 1.0 - 2.5
  shortTasks: number; // 1 - 5
  longTasks: number; // 0 - 3
  commonTasks: number; // 0 - 2
  confirmEjects: boolean;
  anonymousVotes: boolean;
  visualTasks: boolean;
  enableAdvancedRoles: boolean;
}

export interface AssignedTask {
  id: string;
  stationId: string;
  roomId: string;
  roomName: string;
  title: string;
  type: TaskType;
  isVisual?: boolean;
  completed: boolean;
  x: number;
  y: number;
}

export interface RoomPlayer {
  id: string;
  userId: string | null;
  botId: string | null;
  displayName: string;
  isBot: boolean;
  isHost: boolean;
  cosmetics: PlayerCosmetics;
  role: PlayerRole | null;
  subRole: PlayerSubRole;
  isAlive: boolean;
  tasks: AssignedTask[];
  emergenciesLeft: number;
  // Runtime kinematic state (synced via Realtime Broadcast at ~15Hz)
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 'left' | 'right';
  inVentId: string | null;
  isScanning?: boolean;
  disguisedAsPlayerId?: string | null;
  disguiseUntil?: number | null;
  trackedByPlayerId?: string | null;
  trackedUntil?: number | null;
  killsThisMatch?: number;
  lastHeartbeat?: number;
}

export interface DeadBody {
  id: string;
  victimId: string;
  victimName: string;
  cosmetics: PlayerCosmetics;
  x: number;
  y: number;
  roomName: string;
  killedAt: number;
}

export interface ActiveSabotage {
  type: SabotageType;
  startedAt: number;
  expiresAt: number | null;
  fixedStations: string[];
  requiredStations: string[];
  code?: string;
}

export interface MeetingState {
  meetingNumber: number;
  reason: 'emergency' | 'body_report';
  callerId: string;
  callerName: string;
  reportedVictimName?: string;
  reportedVictimColor?: string;
  reportedRoomName?: string;
  phase: 'discussion' | 'voting' | 'results' | 'ejection';
  discussionEndsAt: number;
  votingEndsAt: number;
  resultsEndsAt?: number;
  votes: Record<string, string | 'skip'>;
  ejectedPlayerId?: string | null;
  ejectedPlayerName?: string | null;
  ejectedWasImpostor?: boolean | null;
  ejectionMessage?: string;
  impostorsRemaining?: number;
}

export interface MatchResult {
  winner: 'crewmates' | 'impostors';
  reason: string;
  finishedAt: number;
  durationSeconds: number;
  impostorIds: string[];
  taskCompletionRatio: number;
}

export interface GameState {
  matchStartedAt: number | null;
  meetingCount: number;
  deadBodies: DeadBody[];
  activeSabotage: ActiveSabotage | null;
  sabotageCooldownUntil: number;
  emergencyCooldownUntil: number;
  doorsClosedUntil: Record<string, number>;
  meeting: MeetingState | null;
  result: MatchResult | null;
  cameraWatchers: string[];
}

export interface RoomData {
  id: string;
  code: string;
  hostId: string;
  status: RoomStatus;
  settings: RoomSettings;
  gameState: GameState;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderPlayerId: string | null;
  senderName: string;
  senderColor: string;
  content: string;
  channel: 'lobby' | 'meeting' | 'ghost' | 'system';
  createdAt: string;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MapRoomZone {
  id: string;
  name: string;
  rect: Rect;
  floorColor: string;
  accentColor: string;
  pattern?: 'grid' | 'tiles' | 'snow' | 'carpet' | 'metal';
  isEmergencyRoom?: boolean;
}

export interface MapDoor {
  id: string;
  roomId: string;
  label: string;
  rect: Rect;
  orientation: 'horizontal' | 'vertical';
}

export interface MapVent {
  id: string;
  roomId: string;
  x: number;
  y: number;
  linksTo: string[];
}

export interface MapTaskStation {
  id: string;
  roomId: string;
  roomName: string;
  title: string;
  type: TaskType;
  category: 'common' | 'short' | 'long';
  isVisual?: boolean;
  x: number;
  y: number;
}

export interface MapSabotageStation {
  id: string;
  sabotageType: SabotageType;
  roomId: string;
  label: string;
  x: number;
  y: number;
}

export interface MapCamera {
  id: string;
  label: string;
  x: number;
  y: number;
}

export interface MapProp {
  kind:
    | 'table'
    | 'console'
    | 'bed'
    | 'crate'
    | 'reactor_core'
    | 'plant'
    | 'engine'
    | 'crystal'
    | 'pillar';
  x: number;
  y: number;
  w: number;
  h: number;
  color?: string;
}

export interface GameMap {
  id: MapId;
  name: string;
  subtitle: string;
  theme: 'orbital' | 'arctic' | 'luxury';
  description: string;
  recommendedPlayers: string;
  width: number;
  height: number;
  ambientColor: string;
  exteriorColor: string;
  wallColor: string;
  wallHighlight: string;
  spawnCenter: { x: number; y: number };
  emergencyButton: { x: number; y: number; roomId: string };
  adminTable: { x: number; y: number; roomId: string };
  securityConsole: { x: number; y: number; roomId: string };
  vitalsConsole?: { x: number; y: number; roomId: string };
  rooms: MapRoomZone[];
  corridors: Rect[];
  walls: Rect[];
  doors: MapDoor[];
  vents: MapVent[];
  taskStations: MapTaskStation[];
  sabotageStations: MapSabotageStation[];
  cameras: MapCamera[];
  props: MapProp[];
}

export interface PlayerMovePayload {
  playerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 'left' | 'right';
  inVentId: string | null;
  isScanning?: boolean;
  disguisedAsPlayerId?: string | null;
  disguiseUntil?: number | null;
  ts: number;
}

export interface BotBatchPayload {
  updates: PlayerMovePayload[];
  ts: number;
}
