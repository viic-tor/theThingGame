import {
  KILL_DISTANCE_PX,
  MAX_IMPOSTORS_LIMIT,
  MIN_IMPOSTORS_LIMIT,
  SABOTAGE_CRITICAL_DURATION_MS,
} from '../config/gameDefaults';
import type {
  ActiveSabotage,
  AssignedTask,
  GameMap,
  GameState,
  KillDistance,
  MatchResult,
  MeetingState,
  PlayerSubRole,
  RoomPlayer,
  RoomSettings,
  SabotageType,
} from '../types/game';
import { distanceBetween, getSpawnPositionForIndex } from './collision';

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(rng: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(rng() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

export function shuffleArray<T>(items: T[], rng: () => number = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Ensures impostor count stays within 1..6 and strictly below half of players
 * so a match never opens in immediate impostor parity.
 */
export function clampImpostorCount(requested: number, playerCount: number): number {
  const maxSafeForRoster = Math.max(1, Math.floor((playerCount - 1) / 2));
  return Math.max(
    MIN_IMPOSTORS_LIMIT,
    Math.min(MAX_IMPOSTORS_LIMIT, requested, maxSafeForRoster)
  );
}

/**
 * Assigns roles (Crewmate / Impostor), optional Among Us 2 sub-roles,
 * common/short/long tasks, emergency charges, and concentric spawn positions.
 */
export function assignRolesAndTasks(
  players: RoomPlayer[],
  map: GameMap,
  settings: RoomSettings,
  rng: () => number = Math.random
): RoomPlayer[] {
  const totalPlayers = players.length;
  const impostorCount = clampImpostorCount(settings.impostorCount, totalPlayers);

  const shuffledIndices = shuffleArray(
    players.map((_, idx) => idx),
    rng
  );
  const impostorIndexSet = new Set(shuffledIndices.slice(0, impostorCount));

  // Common tasks are shared by EVERY crewmate (classic Among Us deduction mechanic!)
  const commonPool = shuffleArray(
    map.taskStations.filter((s) => s.category === 'common'),
    rng
  ).slice(0, settings.commonTasks);

  const shortPool = map.taskStations.filter((s) => s.category === 'short');
  const longPool = map.taskStations.filter((s) => s.category === 'long');

  // Optional AU2 Sub-role assignment pools
  const crewIndices = shuffledIndices.slice(impostorCount);
  const impIndices = shuffledIndices.slice(0, impostorCount);
  const subRoleByIndex = new Map<number, PlayerSubRole>();

  if (settings.enableAdvancedRoles) {
    // Crewmate specialists scale gracefully up to 40 players
    const specialistCountPerType = totalPlayers >= 20 ? 2 : 1;
    let cursor = 0;
    const crewSpecialists: PlayerSubRole[] = ['engineer', 'scientist', 'tracker'];
    for (const sub of crewSpecialists) {
      for (let k = 0; k < specialistCountPerType && cursor < crewIndices.length; k++) {
        subRoleByIndex.set(crewIndices[cursor++], sub);
      }
    }
    // At least one Impostor gets Shapeshifter if enabled (2 in 4+ impostor lobbies)
    const shifterCount = impostorCount >= 4 ? 2 : 1;
    for (let k = 0; k < shifterCount && k < impIndices.length; k++) {
      subRoleByIndex.set(impIndices[k], 'shapeshifter');
    }
  }

  return players.map((player, idx) => {
    const isImpostor = impostorIndexSet.has(idx);
    const pickedShort = shuffleArray(shortPool, rng).slice(0, settings.shortTasks);
    const pickedLong = shuffleArray(longPool, rng).slice(0, settings.longTasks);
    const stations = [...commonPool, ...pickedShort, ...pickedLong];

    const tasks: AssignedTask[] = stations.map((st, tIdx) => ({
      id: `${player.id}_task_${tIdx}_${st.id}`,
      stationId: st.id,
      roomId: st.roomId,
      roomName: st.roomName,
      title: st.title,
      type: st.type,
      isVisual: st.isVisual,
      completed: false,
      x: st.x,
      y: st.y,
    }));

    const spawn = getSpawnPositionForIndex(map, idx, totalPlayers);

    return {
      ...player,
      role: isImpostor ? 'impostor' : 'crewmate',
      subRole: subRoleByIndex.get(idx) ?? 'none',
      isAlive: true,
      tasks,
      emergenciesLeft: settings.emergencyMeetings,
      x: spawn.x,
      y: spawn.y,
      vx: 0,
      vy: 0,
      facing: spawn.x >= map.spawnCenter.x ? 'left' : 'right',
      inVentId: null,
      isScanning: false,
      disguisedAsPlayerId: null,
      disguiseUntil: null,
      trackedByPlayerId: null,
      trackedUntil: null,
      killsThisMatch: 0,
    };
  });
}

/**
 * Calculates total crewmate task bar progress (includes dead crewmate ghosts, excludes impostors).
 */
export function calculateTaskProgress(players: RoomPlayer[]): {
  completed: number;
  total: number;
  ratio: number;
} {
  let completed = 0;
  let total = 0;

  for (const p of players) {
    if (p.role !== 'crewmate') continue;
    for (const task of p.tasks) {
      total += 1;
      if (task.completed) completed += 1;
    }
  }

  return {
    completed,
    total,
    ratio: total > 0 ? completed / total : 0,
  };
}

/**
 * Evaluates all four authentic Among Us victory conditions.
 */
export function evaluateWinCondition(
  players: RoomPlayer[],
  gameState: GameState,
  now: number
): MatchResult | null {
  const startedPlayers = players.filter((p) => p.role !== null);
  if (startedPlayers.length === 0) return null;

  const impostors = startedPlayers.filter((p) => p.role === 'impostor');
  const aliveImpostors = impostors.filter((p) => p.isAlive);
  const aliveCrewmates = startedPlayers.filter((p) => p.role === 'crewmate' && p.isAlive);
  const taskProgress = calculateTaskProgress(startedPlayers);
  const durationSeconds = gameState.matchStartedAt
    ? Math.max(1, Math.round((now - gameState.matchStartedAt) / 1000))
    : 0;
  const impostorIds = impostors.map((p) => p.id);

  // 1. Critical sabotage timeout -> Impostors win
  if (
    gameState.activeSabotage &&
    gameState.activeSabotage.expiresAt !== null &&
    now >= gameState.activeSabotage.expiresAt
  ) {
    const sabName =
      gameState.activeSabotage.type === 'reactor'
        ? 'Fusión del Reactor'
        : 'Agotamiento de Oxígeno (O2)';
    return {
      winner: 'impostors',
      reason: `Sabotaje crítico completado: ${sabName}.`,
      finishedAt: now,
      durationSeconds,
      impostorIds,
      taskCompletionRatio: taskProgress.ratio,
    };
  }

  // 2. All impostors eliminated -> Crewmates win
  if (impostors.length > 0 && aliveImpostors.length === 0) {
    return {
      winner: 'crewmates',
      reason: 'Todos los Impostores han sido expulsados de la nave.',
      finishedAt: now,
      durationSeconds,
      impostorIds,
      taskCompletionRatio: taskProgress.ratio,
    };
  }

  // 3. Impostor numerical parity (alive impostors >= alive crewmates) -> Impostors win
  if (aliveImpostors.length > 0 && aliveImpostors.length >= aliveCrewmates.length) {
    return {
      winner: 'impostors',
      reason: `Los Impostores alcanzaron dominio numérico (${aliveImpostors.length} vs ${aliveCrewmates.length}).`,
      finishedAt: now,
      durationSeconds,
      impostorIds,
      taskCompletionRatio: taskProgress.ratio,
    };
  }

  // 4. All crewmate tasks completed -> Crewmates win
  if (taskProgress.total > 0 && taskProgress.completed >= taskProgress.total) {
    return {
      winner: 'crewmates',
      reason: 'La tripulación completó el 100% de las tareas.',
      finishedAt: now,
      durationSeconds,
      impostorIds,
      taskCompletionRatio: 1,
    };
  }

  return null;
}

export function canPerformKill(
  killer: RoomPlayer,
  target: RoomPlayer,
  killDistance: KillDistance,
  cooldownRemainingSec: number
): boolean {
  if (!killer.isAlive || killer.role !== 'impostor' || killer.inVentId) return false;
  if (!target.isAlive || target.role === 'impostor' || target.inVentId) return false;
  if (killer.id === target.id) return false;
  if (cooldownRemainingSec > 0) return false;

  const dist = distanceBetween(killer.x, killer.y, target.x, target.y);
  return dist <= KILL_DISTANCE_PX[killDistance];
}

export function findNearestKillTarget(
  killer: RoomPlayer,
  players: RoomPlayer[],
  killDistance: KillDistance
): RoomPlayer | null {
  if (!killer.isAlive || killer.role !== 'impostor' || killer.inVentId) return null;
  const maxDist = KILL_DISTANCE_PX[killDistance];

  let nearest: RoomPlayer | null = null;
  let bestDist = Infinity;

  for (const p of players) {
    if (p.id === killer.id || !p.isAlive || p.role === 'impostor' || p.inVentId) continue;
    const d = distanceBetween(killer.x, killer.y, p.x, p.y);
    if (d <= maxDist && d < bestDist) {
      bestDist = d;
      nearest = p;
    }
  }
  return nearest;
}

export interface VoteResolution {
  ejectedPlayerId: string | null;
  ejectedPlayerName: string | null;
  ejectedWasImpostor: boolean | null;
  message: string;
  impostorsRemaining: number;
  counts: Record<string, number>;
  skipCount: number;
  wasTie: boolean;
}

/**
 * Resolves meeting votes faithfully to Among Us:
 * - Strict plurality beats all other targets AND Skip.
 * - Tie between top targets or tie with Skip -> Nobody ejected.
 * - Respects `confirmEjects` toggle.
 */
export function resolveMeetingVotes(
  meeting: MeetingState,
  players: RoomPlayer[],
  settings: RoomSettings
): VoteResolution {
  const counts: Record<string, number> = {};
  let skipCount = 0;

  const aliveIdSet = new Set(players.filter((p) => p.isAlive).map((p) => p.id));

  for (const [voterId, target] of Object.entries(meeting.votes)) {
    if (!aliveIdSet.has(voterId)) continue;
    if (target === 'skip') {
      skipCount += 1;
    } else if (aliveIdSet.has(target)) {
      counts[target] = (counts[target] ?? 0) + 1;
    }
  }

  let topPlayerId: string | null = null;
  let topCount = 0;
  let tiedTop = false;

  for (const [targetId, count] of Object.entries(counts)) {
    if (count > topCount) {
      topCount = count;
      topPlayerId = targetId;
      tiedTop = false;
    } else if (count === topCount && count > 0) {
      tiedTop = true;
    }
  }

  const currentAliveImpostors = players.filter((p) => p.isAlive && p.role === 'impostor').length;

  // Skip wins or ties with top player, or top players tied
  if (!topPlayerId || topCount === 0 || tiedTop || skipCount >= topCount) {
    const isTie = tiedTop || (topCount > 0 && skipCount === topCount);
    const reasonText = isTie
      ? 'Nadie fue expulsado (Empate).'
      : 'Nadie fue expulsado (Voto saltado).';
    return {
      ejectedPlayerId: null,
      ejectedPlayerName: null,
      ejectedWasImpostor: null,
      message: reasonText,
      impostorsRemaining: currentAliveImpostors,
      counts,
      skipCount,
      wasTie: isTie,
    };
  }

  const ejected = players.find((p) => p.id === topPlayerId) ?? null;
  if (!ejected) {
    return {
      ejectedPlayerId: null,
      ejectedPlayerName: null,
      ejectedWasImpostor: null,
      message: 'Nadie fue expulsado.',
      impostorsRemaining: currentAliveImpostors,
      counts,
      skipCount,
      wasTie: false,
    };
  }

  const wasImpostor = ejected.role === 'impostor';
  const remaining = wasImpostor ? Math.max(0, currentAliveImpostors - 1) : currentAliveImpostors;

  let message: string;
  if (settings.confirmEjects) {
    const roleSentence = wasImpostor
      ? `${ejected.displayName} era un Impostor.`
      : `${ejected.displayName} no era un Impostor.`;
    const remSentence =
      remaining === 1
        ? 'Queda 1 Impostor.'
        : `Quedan ${remaining} Impostores.`;
    message = `${roleSentence} ${remSentence}`;
  } else {
    message = `${ejected.displayName} fue expulsado al espacio.`;
  }

  return {
    ejectedPlayerId: ejected.id,
    ejectedPlayerName: ejected.displayName,
    ejectedWasImpostor: wasImpostor,
    message,
    impostorsRemaining: remaining,
    counts,
    skipCount,
    wasTie: false,
  };
}

export function createSabotage(
  type: SabotageType,
  map: GameMap,
  now: number,
  alivePlayerCount: number
): ActiveSabotage {
  const stations = map.sabotageStations.filter((s) => s.sabotageType === type);
  const isCritical = type === 'reactor' || type === 'o2';

  // For reactor in tiny rooms (<4 alive), require only 1 panel so solo/small tests aren't impossible
  const requiredStations =
    type === 'reactor' && alivePlayerCount < 4
      ? stations.slice(0, 1).map((s) => s.id)
      : stations.map((s) => s.id);

  const code =
    type === 'o2'
      ? String(Math.floor(10000 + Math.random() * 90000))
      : undefined;

  return {
    type,
    startedAt: now,
    expiresAt: isCritical ? now + SABOTAGE_CRITICAL_DURATION_MS : null,
    fixedStations: [],
    requiredStations,
    code,
  };
}

export function getSubRoleLabel(subRole: PlayerSubRole): string {
  switch (subRole) {
    case 'engineer':
      return 'Ingeniero';
    case 'scientist':
      return 'Científico';
    case 'tracker':
      return 'Rastreador';
    case 'shapeshifter':
      return 'Cambiaformas';
    default:
      return '';
  }
}

export function getSubRoleDescription(subRole: PlayerSubRole): string {
  switch (subRole) {
    case 'engineer':
      return 'Puede usar conductos de ventilación temporalmente.';
    case 'scientist':
      return 'Acceso portátil al monitor de Signos Vitales.';
    case 'tracker':
      return 'Puede rastrear a un jugador en el minimapa.';
    case 'shapeshifter':
      return 'Puede disfrazarse temporalmente como otro jugador vivo.';
    default:
      return '';
  }
}
