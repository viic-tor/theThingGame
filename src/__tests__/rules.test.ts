import { describe, expect, it } from 'vitest';
import { DEFAULT_COSMETICS } from '../config/cosmetics';
import { createInitialGameState, DEFAULT_ROOM_SETTINGS } from '../config/gameDefaults';
import {
  assignRolesAndTasks,
  calculateTaskProgress,
  canPerformKill,
  clampImpostorCount,
  createSabotage,
  evaluateWinCondition,
  generateRoomCode,
  resolveMeetingVotes,
} from '../engine/rules';
import { AEGIS_STATION_MAP } from '../maps/aegisStation';
import type { MeetingState, RoomPlayer, RoomSettings } from '../types/game';

function makePlayers(count: number): RoomPlayer[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p_${i + 1}`,
    userId: `u_${i + 1}`,
    botId: null,
    displayName: `Jugador ${i + 1}`,
    isBot: i > 0,
    isHost: i === 0,
    cosmetics: { ...DEFAULT_COSMETICS },
    role: null,
    subRole: 'none',
    isAlive: true,
    tasks: [],
    emergenciesLeft: 1,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    facing: 'right',
    inVentId: null,
  }));
}

describe('Among Us 2 — Reglas y Mecánicas', () => {
  it('genera códigos de sala válidos de 6 caracteres sin caracteres ambiguos', () => {
    for (let i = 0; i < 30; i++) {
      const code = generateRoomCode();
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    }
  });

  it('soporta hasta 40 jugadores y hasta 6 impostores simultáneos', () => {
    const players = makePlayers(40);
    const settings: RoomSettings = {
      ...DEFAULT_ROOM_SETTINGS,
      maxPlayers: 40,
      impostorCount: 6,
      enableAdvancedRoles: true,
    };

    const assigned = assignRolesAndTasks(players, AEGIS_STATION_MAP, settings);
    expect(assigned).toHaveLength(40);

    const impostors = assigned.filter((p) => p.role === 'impostor');
    const crewmates = assigned.filter((p) => p.role === 'crewmate');
    expect(impostors).toHaveLength(6);
    expect(crewmates).toHaveLength(34);

    // Every player receives tasks and valid non-zero spawn coordinates
    for (const p of assigned) {
      expect(p.tasks.length).toBeGreaterThanOrEqual(3);
      expect(p.x).toBeGreaterThan(0);
      expect(p.y).toBeGreaterThan(0);
    }

    // AU2 sub-roles assigned
    expect(assigned.some((p) => p.subRole === 'engineer')).toBe(true);
    expect(assigned.some((p) => p.subRole === 'scientist')).toBe(true);
    expect(assigned.some((p) => p.subRole === 'tracker')).toBe(true);
    expect(assigned.some((p) => p.subRole === 'shapeshifter')).toBe(true);
  });

  it('limita el número de impostores entre 1 y 6 y evita paridad inmediata', () => {
    expect(clampImpostorCount(6, 40)).toBe(6);
    expect(clampImpostorCount(9, 40)).toBe(6);
    expect(clampImpostorCount(0, 10)).toBe(1);
    expect(clampImpostorCount(6, 5)).toBe(2); // 2 vs 3 safe
    expect(clampImpostorCount(3, 4)).toBe(1); // 1 vs 3 safe
  });

  it('evalúa correctamente las 4 condiciones de victoria oficiales', () => {
    const now = Date.now();
    const baseState = { ...createInitialGameState(), matchStartedAt: now - 60_000 };

    // 1. All impostors ejected -> Crewmates win
    const roster1 = assignRolesAndTasks(makePlayers(6), AEGIS_STATION_MAP, {
      ...DEFAULT_ROOM_SETTINGS,
      impostorCount: 1,
    });
    const imp = roster1.find((p) => p.role === 'impostor')!;
    imp.isAlive = false;
    const res1 = evaluateWinCondition(roster1, baseState, now);
    expect(res1?.winner).toBe('crewmates');

    // 2. Crewmates reach 100% tasks (including dead crewmate ghosts) -> Crewmates win
    const roster2 = assignRolesAndTasks(makePlayers(6), AEGIS_STATION_MAP, {
      ...DEFAULT_ROOM_SETTINGS,
      impostorCount: 1,
    });
    roster2.forEach((p, idx) => {
      if (p.role === 'crewmate') {
        if (idx === 0) p.isAlive = false; // ghost completes tasks too
        p.tasks = p.tasks.map((t) => ({ ...t, completed: true }));
      }
    });
    const progress = calculateTaskProgress(roster2);
    expect(progress.ratio).toBe(1);
    const res2 = evaluateWinCondition(roster2, baseState, now);
    expect(res2?.winner).toBe('crewmates');

    // 3. Alive impostors >= Alive crewmates -> Impostors win
    const roster3 = assignRolesAndTasks(makePlayers(6), AEGIS_STATION_MAP, {
      ...DEFAULT_ROOM_SETTINGS,
      impostorCount: 2,
    });
    let killed = 0;
    for (const p of roster3) {
      if (p.role === 'crewmate' && killed < 2) {
        p.isAlive = false;
        killed++;
      }
    }
    const res3 = evaluateWinCondition(roster3, baseState, now);
    expect(res3?.winner).toBe('impostors');

    // 4. Critical sabotage expires -> Impostors win
    const roster4 = assignRolesAndTasks(makePlayers(8), AEGIS_STATION_MAP, {
      ...DEFAULT_ROOM_SETTINGS,
      impostorCount: 1,
    });
    const expiredSab = createSabotage('reactor', AEGIS_STATION_MAP, now - 50_000, 8);
    const res4 = evaluateWinCondition(
      roster4,
      { ...baseState, activeSabotage: expiredSab },
      now
    );
    expect(res4?.winner).toBe('impostors');
  });

  it('resuelve votaciones respetando pluralidad estricta, empates, skip y confirmEjects', () => {
    const roster = assignRolesAndTasks(makePlayers(6), AEGIS_STATION_MAP, {
      ...DEFAULT_ROOM_SETTINGS,
      impostorCount: 1,
      confirmEjects: true,
    });
    const impostor = roster.find((p) => p.role === 'impostor')!;
    const crew = roster.filter((p) => p.role === 'crewmate');

    const baseMeeting: MeetingState = {
      meetingNumber: 1,
      reason: 'emergency',
      callerId: crew[0].id,
      callerName: crew[0].displayName,
      phase: 'results',
      discussionEndsAt: 0,
      votingEndsAt: 0,
      votes: {},
    };

    // Case A: Clear plurality ejects impostor
    const resEject = resolveMeetingVotes(
      {
        ...baseMeeting,
        votes: {
          [crew[0].id]: impostor.id,
          [crew[1].id]: impostor.id,
          [crew[2].id]: impostor.id,
          [impostor.id]: crew[0].id,
          [crew[3].id]: 'skip',
        },
      },
      roster,
      { ...DEFAULT_ROOM_SETTINGS, confirmEjects: true }
    );
    expect(resEject.ejectedPlayerId).toBe(impostor.id);
    expect(resEject.ejectedWasImpostor).toBe(true);
    expect(resEject.impostorsRemaining).toBe(0);
    expect(resEject.message).toContain('era un Impostor');

    // Case B: Tie between two players -> Nobody ejected
    const resTie = resolveMeetingVotes(
      {
        ...baseMeeting,
        votes: {
          [crew[0].id]: impostor.id,
          [crew[1].id]: impostor.id,
          [crew[2].id]: crew[0].id,
          [crew[3].id]: crew[0].id,
        },
      },
      roster,
      DEFAULT_ROOM_SETTINGS
    );
    expect(resTie.ejectedPlayerId).toBeNull();
    expect(resTie.wasTie).toBe(true);

    // Case C: Tie with Skip -> Nobody ejected
    const resSkipTie = resolveMeetingVotes(
      {
        ...baseMeeting,
        votes: {
          [crew[0].id]: impostor.id,
          [crew[1].id]: impostor.id,
          [crew[2].id]: 'skip',
          [crew[3].id]: 'skip',
        },
      },
      roster,
      DEFAULT_ROOM_SETTINGS
    );
    expect(resSkipTie.ejectedPlayerId).toBeNull();
  });

  it('valida eliminaciones por rango, enfriamiento y bando', () => {
    const roster = assignRolesAndTasks(makePlayers(6), AEGIS_STATION_MAP, {
      ...DEFAULT_ROOM_SETTINGS,
      impostorCount: 2,
    });
    const [imp1, imp2] = roster.filter((p) => p.role === 'impostor');
    const crew = roster.find((p) => p.role === 'crewmate')!;

    imp1.x = 500;
    imp1.y = 500;
    imp2.x = 520;
    imp2.y = 500;
    crew.x = 560;
    crew.y = 500;

    expect(canPerformKill(imp1, crew, 'medium', 0)).toBe(true);
    expect(canPerformKill(imp1, crew, 'medium', 5)).toBe(false); // on cooldown
    expect(canPerformKill(imp1, imp2, 'medium', 0)).toBe(false); // fellow impostor
    expect(canPerformKill(crew, imp1, 'medium', 0)).toBe(false); // crew cannot kill

    crew.x = 900;
    expect(canPerformKill(imp1, crew, 'medium', 0)).toBe(false); // too far
  });
});
