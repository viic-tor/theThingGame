import { BASE_PLAYER_SPEED, KILL_DISTANCE_PX, REPORT_RADIUS } from '../config/gameDefaults';
import type { GameMap, GameState, RoomPlayer, RoomSettings } from '../types/game';
import { distanceBetween, getRoomNameAtPoint, resolveMovement } from './collision';

export interface BotMemory {
  targetX: number;
  targetY: number;
  waypointX: number | null;
  waypointY: number | null;
  pauseUntil: number;
  taskWorkingId: string | null;
  killCooldownUntil: number;
  stuckTicks: number;
  lastX: number;
  lastY: number;
  sawKillerId?: string | null;
}

export interface BotActionEvent {
  type: 'complete_task' | 'kill' | 'report_body' | 'fix_sabotage';
  botId: string;
  taskId?: string;
  victimId?: string;
  bodyId?: string;
  stationId?: string;
}

export class BotSimulationManager {
  private memory = new Map<string, BotMemory>();

  reset(players: RoomPlayer[], settings: RoomSettings, now: number): void {
    this.memory.clear();
    for (const p of players) {
      if (!p.isBot) continue;
      this.memory.set(p.id, {
        targetX: p.x,
        targetY: p.y,
        waypointX: null,
        waypointY: null,
        pauseUntil: now + 800 + Math.random() * 1400,
        taskWorkingId: null,
        killCooldownUntil: now + (settings.killCooldown * 0.6 + Math.random() * 8) * 1000,
        stuckTicks: 0,
        lastX: p.x,
        lastY: p.y,
        sawKillerId: null,
      });
    }
  }

  private getOrCreateMemory(bot: RoomPlayer, settings: RoomSettings, now: number): BotMemory {
    let mem = this.memory.get(bot.id);
    if (!mem) {
      mem = {
        targetX: bot.x,
        targetY: bot.y,
        waypointX: null,
        waypointY: null,
        pauseUntil: now + 600,
        taskWorkingId: null,
        killCooldownUntil: now + settings.killCooldown * 1000,
        stuckTicks: 0,
        lastX: bot.x,
        lastY: bot.y,
        sawKillerId: null,
      };
      this.memory.set(bot.id, mem);
    }
    return mem;
  }

  private pickDestination(bot: RoomPlayer, map: GameMap, gameState: GameState): { x: number; y: number; taskId: string | null } {
    // 1. Living crewmate bots respond to critical sabotages
    if (bot.role === 'crewmate' && bot.isAlive && gameState.activeSabotage) {
      const unfixed = gameState.activeSabotage.requiredStations.filter(
        (id) => !gameState.activeSabotage!.fixedStations.includes(id)
      );
      if (unfixed.length > 0 && Math.random() < 0.72) {
        const station = map.sabotageStations.find((s) => s.id === unfixed[0]);
        if (station) {
          return { x: station.x, y: station.y, taskId: null };
        }
      }
    }

    // 2. Crewmate bots (living or ghost) pursue uncompleted tasks
    if (bot.role === 'crewmate') {
      const remaining = bot.tasks.filter((t) => !t.completed);
      if (remaining.length > 0) {
        const chosen = remaining[Math.floor(Math.random() * remaining.length)];
        return { x: chosen.x, y: chosen.y, taskId: chosen.id };
      }
    }

    // 3. Impostor bots roam between task stations and rooms
    const randomRoom = map.rooms[Math.floor(Math.random() * map.rooms.length)];
    return {
      x: randomRoom.rect.x + 60 + Math.random() * Math.max(40, randomRoom.rect.w - 120),
      y: randomRoom.rect.y + 60 + Math.random() * Math.max(40, randomRoom.rect.h - 120),
      taskId: null,
    };
  }

  step(
    players: RoomPlayer[],
    map: GameMap,
    gameState: GameState,
    settings: RoomSettings,
    dtSec: number,
    now: number
  ): BotActionEvent[] {
    const events: BotActionEvent[] = [];
    const speed = BASE_PLAYER_SPEED * settings.playerSpeed * 0.88;

    for (const bot of players) {
      if (!bot.isBot) continue;
      const mem = this.getOrCreateMemory(bot, settings, now);

      // Pause while doing task or waiting
      if (now < mem.pauseUntil) {
        bot.vx = 0;
        bot.vy = 0;
        continue;
      }

      // Finish working on a task if paused at it
      if (mem.taskWorkingId) {
        const task = bot.tasks.find((t) => t.id === mem.taskWorkingId && !t.completed);
        if (task && bot.role === 'crewmate') {
          events.push({ type: 'complete_task', botId: bot.id, taskId: task.id });
        }
        mem.taskWorkingId = null;
      }

      // Check sabotage fix if standing near an unfixed station
      if (bot.isAlive && bot.role === 'crewmate' && gameState.activeSabotage) {
        for (const reqId of gameState.activeSabotage.requiredStations) {
          if (gameState.activeSabotage.fixedStations.includes(reqId)) continue;
          const st = map.sabotageStations.find((s) => s.id === reqId);
          if (st && distanceBetween(bot.x, bot.y, st.x, st.y) < 95) {
            events.push({ type: 'fix_sabotage', botId: bot.id, stationId: st.id });
            mem.pauseUntil = now + 2200;
            break;
          }
        }
      }

      // Alive crewmate bot spots dead body -> reports it
      if (bot.isAlive && bot.role === 'crewmate' && gameState.deadBodies.length > 0) {
        for (const body of gameState.deadBodies) {
          if (distanceBetween(bot.x, bot.y, body.x, body.y) < REPORT_RADIUS * 1.15) {
            // Check if a player was standing right next to body
            const suspect = players.find(
              (p) => p.id !== bot.id && p.isAlive && distanceBetween(p.x, p.y, body.x, body.y) < 180
            );
            mem.sawKillerId = suspect?.id ?? null;
            events.push({ type: 'report_body', botId: bot.id, bodyId: body.id });
            return events; // Immediately trigger meeting
          }
        }
      }

      // Alive impostor bot hunts isolated crewmate
      if (bot.isAlive && bot.role === 'impostor' && now >= mem.killCooldownUntil) {
        const killRange = KILL_DISTANCE_PX[settings.killDistance];
        const target = players.find(
          (p) =>
            p.id !== bot.id &&
            p.isAlive &&
            p.role === 'crewmate' &&
            distanceBetween(bot.x, bot.y, p.x, p.y) <= killRange
        );
        if (target) {
          // Only kill if at most 1 nearby witness
          const witnesses = players.filter(
            (p) =>
              p.id !== bot.id &&
              p.id !== target.id &&
              p.isAlive &&
              p.role === 'crewmate' &&
              distanceBetween(bot.x, bot.y, p.x, p.y) < 260
          );
          if (witnesses.length === 0 || Math.random() < 0.12) {
            mem.killCooldownUntil = now + (settings.killCooldown + 3) * 1000;
            events.push({ type: 'kill', botId: bot.id, victimId: target.id });
            // Move away right after kill
            const escape = this.pickDestination(bot, map, gameState);
            mem.targetX = escape.x;
            mem.targetY = escape.y;
            mem.waypointX = map.spawnCenter.x;
            mem.waypointY = map.spawnCenter.y;
            continue;
          }
        }
      }

      // Pick new destination if arrived
      const distToFinal = distanceBetween(bot.x, bot.y, mem.targetX, mem.targetY);
      if (distToFinal < 46) {
        if (mem.taskWorkingId) {
          mem.pauseUntil = now + 2600 + Math.random() * 2200;
        } else {
          const next = this.pickDestination(bot, map, gameState);
          mem.targetX = next.x;
          mem.targetY = next.y;
          mem.taskWorkingId = next.taskId;
          mem.waypointX = null;
          mem.waypointY = null;
          mem.pauseUntil = now + 500 + Math.random() * 900;
        }
        bot.vx = 0;
        bot.vy = 0;
        continue;
      }

      // Active navigation point (waypoint or final target)
      const navX = mem.waypointX ?? mem.targetX;
      const navY = mem.waypointY ?? mem.targetY;
      const distToNav = distanceBetween(bot.x, bot.y, navX, navY);

      if (mem.waypointX !== null && distToNav < 75) {
        mem.waypointX = null;
        mem.waypointY = null;
      }

      const angle = Math.atan2(navY - bot.y, navX - bot.x);
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      const resolved = resolveMovement(
        map,
        bot.x,
        bot.y,
        vx * dtSec,
        vy * dtSec,
        gameState.doorsClosedUntil,
        now,
        !bot.isAlive
      );

      const moved = distanceBetween(bot.x, bot.y, resolved.x, resolved.y);
      bot.x = resolved.x;
      bot.y = resolved.y;
      bot.vx = vx;
      bot.vy = vy;
      if (Math.abs(vx) > 5) {
        bot.facing = vx >= 0 ? 'right' : 'left';
      }

      // Simple unstuck routing via map corridors/rooms
      if (moved < speed * dtSec * 0.25) {
        mem.stuckTicks += 1;
        if (mem.stuckTicks > 18) {
          mem.stuckTicks = 0;
          if (mem.waypointX === null) {
            // Route via a corridor center closest to midpoint
            const midX = (bot.x + mem.targetX) / 2;
            const midY = (bot.y + mem.targetY) / 2;
            let bestCorridor = map.corridors[0];
            let bestScore = Infinity;
            for (const c of map.corridors) {
              const cx = c.x + c.w / 2;
              const cy = c.y + c.h / 2;
              const score = distanceBetween(bot.x, bot.y, cx, cy) * 0.65 + distanceBetween(midX, midY, cx, cy);
              if (score < bestScore) {
                bestScore = score;
                bestCorridor = c;
              }
            }
            mem.waypointX = bestCorridor.x + bestCorridor.w / 2;
            mem.waypointY = bestCorridor.y + bestCorridor.h / 2;
          } else {
            // Pick a fresh nearby destination
            const fresh = this.pickDestination(bot, map, gameState);
            mem.targetX = fresh.x;
            mem.targetY = fresh.y;
            mem.taskWorkingId = fresh.taskId;
            mem.waypointX = null;
            mem.waypointY = null;
          }
        }
      } else {
        mem.stuckTicks = Math.max(0, mem.stuckTicks - 1);
      }

      mem.lastX = bot.x;
      mem.lastY = bot.y;
    }

    return events;
  }

  /**
   * Generates bot votes and optional chat commentary during a meeting.
   */
  decideBotVote(
    bot: RoomPlayer,
    players: RoomPlayer[],
    currentVotes: Record<string, string | 'skip'>
  ): { target: string | 'skip'; chatLine?: string } {
    const aliveOthers = players.filter((p) => p.isAlive && p.id !== bot.id);
    if (aliveOthers.length === 0) return { target: 'skip' };

    const mem = this.memory.get(bot.id);

    // If crewmate bot saw a suspect near the body, accuse and vote them!
    if (bot.role === 'crewmate' && mem?.sawKillerId) {
      const suspect = aliveOthers.find((p) => p.id === mem.sawKillerId);
      if (suspect) {
        mem.sawKillerId = null;
        return {
          target: suspect.id,
          chatLine: `¡Vi a ${suspect.displayName} muy cerca del cuerpo!`,
        };
      }
    }

    // Impostor bots never vote fellow impostors; they follow bandwagon or skip
    const validTargets =
      bot.role === 'impostor'
        ? aliveOthers.filter((p) => p.role !== 'impostor')
        : aliveOthers;

    // Look at leading vote candidate
    const tally: Record<string, number> = {};
    for (const v of Object.values(currentVotes)) {
      if (v !== 'skip') {
        tally[v] = (tally[v] ?? 0) + 1;
      }
    }
    const leadingEntry = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
    if (leadingEntry && leadingEntry[1] >= 1 && Math.random() < 0.52) {
      const candidate = validTargets.find((p) => p.id === leadingEntry[0]);
      if (candidate) {
        return { target: candidate.id };
      }
    }

    // 45% skip when unsure, otherwise pick a suspect
    if (Math.random() < 0.48 || validTargets.length === 0) {
      return {
        target: 'skip',
        chatLine: Math.random() < 0.14 ? 'No tengo pruebas claras, salto voto.' : undefined,
      };
    }

    const picked = validTargets[Math.floor(Math.random() * validTargets.length)];
    return {
      target: picked.id,
      chatLine:
        Math.random() < 0.16
          ? `${picked.displayName} actuó muy extraño en los pasillos.`
          : undefined,
    };
  }

  getBotLocationReport(bot: RoomPlayer, map: GameMap): string {
    return getRoomNameAtPoint(map, bot.x, bot.y);
  }
}
