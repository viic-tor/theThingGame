import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  Ghost,
  LogOut,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Radar,
  Skull,
  Volume2,
  VolumeX,
  Wind,
  Wrench,
  X,
} from 'lucide-react';
import {
  BASE_PLAYER_SPEED,
  DOOR_CLOSE_DURATION_MS,
  INTERACT_RADIUS,
  REPORT_RADIUS,
  SABOTAGE_COOLDOWN_MS,
  SHAPESHIFT_COOLDOWN_MS,
  SHAPESHIFT_DURATION_MS,
  TRACKER_DURATION_MS,
  VENT_RADIUS,
} from '../config/gameDefaults';
import { soundEngine } from '../engine/audio';
import { BotSimulationManager } from '../engine/botAI';
import {
  distanceBetween,
  getRoomNameAtPoint,
  getSpawnPositionForIndex,
  resolveMovement,
} from '../engine/collision';
import { renderGameWorld } from '../engine/renderer';
import {
  calculateTaskProgress,
  canPerformKill,
  createSabotage,
  evaluateWinCondition,
  findNearestKillTarget,
  getSubRoleDescription,
  getSubRoleLabel,
  resolveMeetingVotes,
} from '../engine/rules';
import { getMapById } from '../maps';
import type { RoomTransport } from '../services/roomService';
import type {
  AssignedTask,
  ChatMessage,
  RoomData,
  RoomPlayer,
  SabotageType,
} from '../types/game';
import { MeetingModal } from './MeetingModal';
import { MinimapModal } from './MinimapModal';
import { ResultsModal } from './ResultsModal';
import { SecurityModal, type UtilityModalMode } from './SecurityModal';
import { VirtualJoystick } from './VirtualJoystick';
import { TaskModal } from './minigames/TaskModal';
import { useFullscreen } from '../utils/fullscreen';

interface GameViewProps {
  room: RoomData;
  players: RoomPlayer[];
  myPlayerId: string;
  messages: ChatMessage[];
  transport: RoomTransport | null;
  onSyncMatchState: (
    nextRoom: RoomData,
    nextPlayers: RoomPlayer[],
    changedPlayerIds?: string[]
  ) => void;
  onSubmitVote: (meetingNumber: number, voterPlayerId: string, target: string | 'skip') => void;
  onSendMessage: (content: string, channel: 'meeting' | 'ghost' | 'system') => void;
  onReturnToLobby: () => void;
  onLeaveRoom: () => void;
}

export const GameView: React.FC<GameViewProps> = ({
  room,
  players,
  myPlayerId,
  messages,
  transport,
  onSyncMatchState,
  onSubmitVote,
  onSendMessage,
  onReturnToLobby,
  onLeaveRoom,
}) => {
  const map = useMemo(() => getMapById(room.settings.mapId), [room.settings.mapId]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const playersRef = useRef<RoomPlayer[]>(players);
  const remoteTargetsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const roomRef = useRef<RoomData>(room);
  const keysRef = useRef<Set<string>>(new Set());
  const joystickRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const botManagerRef = useRef<BotSimulationManager>(new BotSimulationManager());
  const lastBroadcastRef = useRef<number>(0);
  const lastBotBroadcastRef = useRef<number>(0);
  const botVotedMeetingRef = useRef<number>(0);

  const [nowTick, setNowTick] = useState(() => Date.now());
  const [showRoleIntro, setShowRoleIntro] = useState(true);
  const [tasksExpanded, setTasksExpanded] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );
  const [muted, setMuted] = useState(false);

  // Cooldowns (local player)
  const [killCooldownUntil, setKillCooldownUntil] = useState(
    () => Date.now() + Math.min(12, room.settings.killCooldown) * 1000
  );
  const [shapeshiftCooldownUntil, setShapeshiftCooldownUntil] = useState(0);

  // Active modals
  const [activeTask, setActiveTask] = useState<AssignedTask | null>(null);
  const [activeSabotageFix, setActiveSabotageFix] = useState<{
    type: SabotageType;
    stationId: string;
    label: string;
    code?: string;
  } | null>(null);
  const [minimapMode, setMinimapMode] = useState<'off' | 'map' | 'sabotage'>('off');
  const [utilityModal, setUtilityModal] = useState<UtilityModalMode>(null);
  const [activeCameraIdx, setActiveCameraIdx] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dismissedFsHint, setDismissedFsHint] = useState(false);
  const fullscreen = useFullscreen();

  // Keep refs synced with latest React props:
  // - Locally simulated actors (self + host-simulated bots) keep local 60fps coordinates
  // - Remote players store incoming coordinates into remoteTargetsRef for smooth 60fps lerp
  useEffect(() => {
    const prevById = new Map(playersRef.current.map((p) => [p.id, p]));
    const meIsHost = Boolean(players.find((p) => p.id === myPlayerId)?.isHost);

    playersRef.current = players.map((p) => {
      const prev = prevById.get(p.id);
      if (prev && room.status === 'playing' && roomRef.current.status === 'playing') {
        const isLocallyDriven = p.id === myPlayerId || (p.isBot && meIsHost);
        if (isLocallyDriven) {
          return {
            ...p,
            x: prev.x,
            y: prev.y,
            vx: prev.vx,
            vy: prev.vy,
            facing: prev.facing,
            inVentId: prev.inVentId,
            isScanning: prev.isScanning,
            disguisedAsPlayerId: prev.disguisedAsPlayerId,
            disguiseUntil: prev.disguiseUntil,
            trackedByPlayerId: prev.trackedByPlayerId,
            trackedUntil: prev.trackedUntil,
            killsThisMatch: p.killsThisMatch ?? prev.killsThisMatch ?? 0,
          };
        }

        // Remote player / non-host bot: record target for smooth interpolation
        remoteTargetsRef.current.set(p.id, { x: p.x, y: p.y });
        return {
          ...p,
          x: prev.x,
          y: prev.y,
          trackedByPlayerId: p.trackedByPlayerId ?? prev.trackedByPlayerId,
          trackedUntil: p.trackedUntil ?? prev.trackedUntil,
          killsThisMatch: p.killsThisMatch ?? prev.killsThisMatch ?? 0,
        };
      }
      remoteTargetsRef.current.delete(p.id);
      return p;
    });
  }, [players, room.status, myPlayerId]);

  useEffect(() => {
    const prevStatus = roomRef.current.status;
    roomRef.current = room;

    // Reset spawn positions & kill cooldown whenever transitioning back from meeting to playing
    if (prevStatus === 'meeting' && room.status === 'playing') {
      playersRef.current = playersRef.current.map((p, idx) => {
        const sp = getSpawnPositionForIndex(map, idx, playersRef.current.length);
        return { ...p, x: sp.x, y: sp.y, vx: 0, vy: 0, inVentId: null, isScanning: false };
      });
      setKillCooldownUntil(Date.now() + room.settings.killCooldown * 1000);
      setActiveTask(null);
      setActiveSabotageFix(null);
      setActiveCameraIdx(null);
    }

    if (room.status === 'finished' && prevStatus !== 'finished') {
      const me = playersRef.current.find((p) => p.id === myPlayerId);
      const won =
        (room.gameState.result?.winner === 'crewmates' && me?.role === 'crewmate') ||
        (room.gameState.result?.winner === 'impostors' && me?.role === 'impostor');
      if (won) soundEngine.playVictory();
      else soundEngine.playDefeat();
    }
  }, [room, map, myPlayerId]);

  // Reset bot AI when match begins
  useEffect(() => {
    botManagerRef.current.reset(playersRef.current, room.settings, Date.now());
    const timer = window.setTimeout(() => setShowRoleIntro(false), 3800);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.gameState.matchStartedAt]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 2600);
  }, []);

  const localPlayer =
    playersRef.current.find((p) => p.id === myPlayerId) ??
    players.find((p) => p.id === myPlayerId) ??
    players[0];

  const isHost = Boolean(localPlayer?.isHost);

  // ==========================================================================
  // CORE GAMEPLAY ACTIONS
  // ==========================================================================

  const commitStateWithWinCheck = useCallback(
    (nextRoom: RoomData, nextPlayers: RoomPlayer[], changedIds?: string[]) => {
      const now = Date.now();
      let finalRoom = nextRoom;
      if (nextRoom.status === 'playing') {
        const result = evaluateWinCondition(nextPlayers, nextRoom.gameState, now);
        if (result) {
          finalRoom = {
            ...nextRoom,
            status: 'finished',
            gameState: {
              ...nextRoom.gameState,
              result,
              activeSabotage: null,
              meeting: null,
            },
          };
        }
      }
      playersRef.current = nextPlayers;
      roomRef.current = finalRoom;
      onSyncMatchState(finalRoom, nextPlayers, changedIds);
    },
    [onSyncMatchState]
  );

  const handleCompleteTask = useCallback(
    (taskId: string, actorId = myPlayerId) => {
      const currRoom = roomRef.current;
      const nextPlayers = playersRef.current.map((p) => {
        if (p.id !== actorId) return p;
        return {
          ...p,
          isScanning: false,
          tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, completed: true } : t)),
        };
      });
      if (actorId === myPlayerId) {
        soundEngine.playTaskComplete();
        setActiveTask(null);
        showToast('¡Tarea completada!');
      }
      commitStateWithWinCheck(currRoom, nextPlayers, [actorId]);
    },
    [commitStateWithWinCheck, myPlayerId, showToast]
  );

  const handleKill = useCallback(
    (killerId: string, victimId: string) => {
      const currRoom = roomRef.current;
      if (currRoom.status !== 'playing') return;
      const killer = playersRef.current.find((p) => p.id === killerId);
      const victim = playersRef.current.find((p) => p.id === victimId);
      if (!killer || !victim || !killer.isAlive || !victim.isAlive) return;

      const bodyRoomName = getRoomNameAtPoint(map, victim.x, victim.y);
      const newBody = {
        id: `body_${Date.now()}_${victim.id}`,
        victimId: victim.id,
        victimName: victim.displayName,
        cosmetics: victim.cosmetics,
        x: victim.x,
        y: victim.y,
        roomName: bodyRoomName,
        killedAt: Date.now(),
      };

      const nextPlayers = playersRef.current.map((p) => {
        if (p.id === victim.id) {
          return { ...p, isAlive: false, inVentId: null, isScanning: false };
        }
        if (p.id === killer.id) {
          // Classic Among Us kill lunge onto victim coordinates
          return {
            ...p,
            x: victim.x,
            y: victim.y,
            killsThisMatch: (p.killsThisMatch ?? 0) + 1,
          };
        }
        return p;
      });

      const nextRoom: RoomData = {
        ...currRoom,
        gameState: {
          ...currRoom.gameState,
          deadBodies: [...currRoom.gameState.deadBodies, newBody],
        },
      };

      if (killerId === myPlayerId || victimId === myPlayerId) {
        soundEngine.playKill();
      }
      if (killerId === myPlayerId) {
        setKillCooldownUntil(Date.now() + currRoom.settings.killCooldown * 1000);
      }

      commitStateWithWinCheck(nextRoom, nextPlayers, [killerId, victimId]);
    },
    [commitStateWithWinCheck, map, myPlayerId]
  );

  const triggerMeeting = useCallback(
    (
      reason: 'emergency' | 'body_report',
      callerId: string,
      reportedBodyId?: string
    ) => {
      const currRoom = roomRef.current;
      if (currRoom.status !== 'playing') return;
      const caller = playersRef.current.find((p) => p.id === callerId);
      if (!caller || !caller.isAlive) return;

      const now = Date.now();
      const body = reportedBodyId
        ? currRoom.gameState.deadBodies.find((b) => b.id === reportedBodyId)
        : undefined;

      // Emergency meeting rules: blocked during critical sabotage, needs charges & cooldown
      if (reason === 'emergency') {
        if (currRoom.gameState.activeSabotage) {
          if (callerId === myPlayerId) {
            showToast('No puedes convocar reunión durante un sabotaje activo.');
          }
          return;
        }
        if (caller.emergenciesLeft <= 0) {
          if (callerId === myPlayerId) showToast('Ya usaste todas tus reuniones de emergencia.');
          return;
        }
        if (now < currRoom.gameState.emergencyCooldownUntil) {
          if (callerId === myPlayerId) showToast('Botón de emergencia en enfriamiento.');
          return;
        }
      }

      const meetingNumber = currRoom.gameState.meetingCount + 1;
      const discussionEndsAt = now + currRoom.settings.discussionTime * 1000;
      const votingEndsAt = discussionEndsAt + currRoom.settings.votingTime * 1000;

      const nextPlayers = playersRef.current.map((p) =>
        p.id === callerId && reason === 'emergency'
          ? { ...p, emergenciesLeft: Math.max(0, p.emergenciesLeft - 1), inVentId: null }
          : { ...p, inVentId: null, isScanning: false }
      );

      const nextRoom: RoomData = {
        ...currRoom,
        status: 'meeting',
        gameState: {
          ...currRoom.gameState,
          meetingCount: meetingNumber,
          activeSabotage: null,
          doorsClosedUntil: {},
          cameraWatchers: [],
          meeting: {
            meetingNumber,
            reason,
            callerId: caller.id,
            callerName: caller.displayName,
            reportedVictimName: body?.victimName,
            reportedVictimColor: body?.cosmetics.color,
            reportedRoomName: body?.roomName,
            phase: 'discussion',
            discussionEndsAt,
            votingEndsAt,
            votes: {},
          },
        },
      };

      if (reason === 'body_report') soundEngine.playReport();
      else soundEngine.playEmergency();

      setActiveTask(null);
      setActiveSabotageFix(null);
      setMinimapMode('off');
      setUtilityModal(null);
      setActiveCameraIdx(null);

      onSendMessage(
        reason === 'body_report'
          ? `${caller.displayName} reportó el cuerpo de ${body?.victimName ?? 'un tripulante'} en ${body?.roomName ?? 'la nave'}.`
          : `${caller.displayName} convocó una Reunión de Emergencia.`,
        'system'
      );

      commitStateWithWinCheck(nextRoom, nextPlayers, [callerId]);
    },
    [commitStateWithWinCheck, myPlayerId, onSendMessage, showToast]
  );

  const handleCastVote = useCallback(
    (target: string | 'skip', voterId = myPlayerId) => {
      const currRoom = roomRef.current;
      const meeting = currRoom.gameState.meeting;
      if (!meeting || meeting.phase !== 'voting') return;
      if (meeting.votes[voterId]) return;

      if (voterId === myPlayerId) soundEngine.playVote();
      onSubmitVote(meeting.meetingNumber, voterId, target);

      const updatedVotes = { ...meeting.votes, [voterId]: target };
      const aliveIds = playersRef.current.filter((p) => p.isAlive).map((p) => p.id);
      const everyoneVoted = aliveIds.every((id) => Boolean(updatedVotes[id]));

      const now = Date.now();
      const nextRoom: RoomData = {
        ...currRoom,
        gameState: {
          ...currRoom.gameState,
          meeting: {
            ...meeting,
            votes: updatedVotes,
            phase: everyoneVoted ? 'results' : 'voting',
            resultsEndsAt: everyoneVoted ? now + 4000 : meeting.resultsEndsAt,
          },
        },
      };

      commitStateWithWinCheck(nextRoom, playersRef.current);
    },
    [commitStateWithWinCheck, myPlayerId, onSubmitVote]
  );

  const handleTriggerSabotage = useCallback(
    (type: SabotageType) => {
      const currRoom = roomRef.current;
      const now = Date.now();
      if (currRoom.gameState.activeSabotage || now < currRoom.gameState.sabotageCooldownUntil) {
        return;
      }
      const aliveCount = playersRef.current.filter((p) => p.isAlive).length;
      const sabotage = createSabotage(type, map, now, aliveCount);
      soundEngine.playSabotage();
      const nextRoom: RoomData = {
        ...currRoom,
        gameState: {
          ...currRoom.gameState,
          activeSabotage: sabotage,
          sabotageCooldownUntil: now + SABOTAGE_COOLDOWN_MS,
        },
      };
      commitStateWithWinCheck(nextRoom, playersRef.current);
      showToast(`Sabotaje activado: ${type.toUpperCase()}`);
    },
    [commitStateWithWinCheck, map, showToast]
  );

  const handleCloseDoor = useCallback(
    (doorId: string) => {
      const currRoom = roomRef.current;
      const now = Date.now();
      const nextRoom: RoomData = {
        ...currRoom,
        gameState: {
          ...currRoom.gameState,
          doorsClosedUntil: {
            ...currRoom.gameState.doorsClosedUntil,
            [doorId]: now + DOOR_CLOSE_DURATION_MS,
          },
        },
      };
      soundEngine.playClick();
      commitStateWithWinCheck(nextRoom, playersRef.current);
    },
    [commitStateWithWinCheck]
  );

  const handleFixSabotageStation = useCallback(
    (stationId: string) => {
      const currRoom = roomRef.current;
      const sab = currRoom.gameState.activeSabotage;
      if (!sab) return;
      const fixedStations = sab.fixedStations.includes(stationId)
        ? sab.fixedStations
        : [...sab.fixedStations, stationId];
      const allFixed = sab.requiredStations.every((req) => fixedStations.includes(req));

      soundEngine.playTaskComplete();
      setActiveSabotageFix(null);

      const nextRoom: RoomData = {
        ...currRoom,
        gameState: {
          ...currRoom.gameState,
          activeSabotage: allFixed ? null : { ...sab, fixedStations },
        },
      };
      commitStateWithWinCheck(nextRoom, playersRef.current);
      if (allFixed) showToast('¡Sabotaje reparado!');
    },
    [commitStateWithWinCheck, showToast]
  );

  // ==========================================================================
  // PROXIMITY / CONTEXTUAL INTERACTABLE DETECTION
  // ==========================================================================
  const meLive = playersRef.current.find((p) => p.id === myPlayerId) ?? localPlayer;

  const nearestBody = useMemo(() => {
    if (!meLive?.isAlive) return null;
    for (const body of room.gameState.deadBodies) {
      if (distanceBetween(meLive.x, meLive.y, body.x, body.y) <= REPORT_RADIUS) {
        return body;
      }
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.gameState.deadBodies, nowTick]);

  const killTarget = useMemo(() => {
    if (!meLive) return null;
    return findNearestKillTarget(meLive, playersRef.current, room.settings.killDistance);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.settings.killDistance, nowTick]);

  const nearestVent = useMemo(() => {
    if (!meLive?.isAlive) return null;
    if (meLive.role !== 'impostor' && meLive.subRole !== 'engineer') return null;
    for (const v of map.vents) {
      if (distanceBetween(meLive.x, meLive.y, v.x, v.y) <= VENT_RADIUS) {
        return v;
      }
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map.vents, nowTick]);

  const contextualUse = useMemo(() => {
    if (!meLive) return null;

    // 1. Active Sabotage Station (highest priority if alive!)
    if (meLive.isAlive && room.gameState.activeSabotage) {
      for (const reqId of room.gameState.activeSabotage.requiredStations) {
        if (room.gameState.activeSabotage.fixedStations.includes(reqId)) continue;
        const st = map.sabotageStations.find((s) => s.id === reqId);
        if (st && distanceBetween(meLive.x, meLive.y, st.x, st.y) <= INTERACT_RADIUS + 14) {
          return {
            kind: 'sabotage' as const,
            label: `Reparar ${st.label}`,
            station: st,
          };
        }
      }
    }

    // 2. Crewmate Task (even as ghost!)
    if (meLive.role === 'crewmate') {
      for (const task of meLive.tasks) {
        if (task.completed) continue;
        if (distanceBetween(meLive.x, meLive.y, task.x, task.y) <= INTERACT_RADIUS) {
          return {
            kind: 'task' as const,
            label: task.title,
            task,
          };
        }
      }
    }

    // 3. Emergency Button (alive only)
    if (
      meLive.isAlive &&
      distanceBetween(meLive.x, meLive.y, map.emergencyButton.x, map.emergencyButton.y) <=
        INTERACT_RADIUS + 20
    ) {
      return {
        kind: 'emergency' as const,
        label: `Emergencia (${meLive.emergenciesLeft})`,
      };
    }

    // 4. Admin Table
    if (distanceBetween(meLive.x, meLive.y, map.adminTable.x, map.adminTable.y) <= INTERACT_RADIUS) {
      return { kind: 'admin' as const, label: 'Mesa Admin' };
    }

    // 5. Security Cameras
    if (
      distanceBetween(meLive.x, meLive.y, map.securityConsole.x, map.securityConsole.y) <=
      INTERACT_RADIUS
    ) {
      return { kind: 'cameras' as const, label: 'Cámaras CCTV' };
    }

    // 6. Vitals Console
    if (
      map.vitalsConsole &&
      distanceBetween(meLive.x, meLive.y, map.vitalsConsole.x, map.vitalsConsole.y) <=
        INTERACT_RADIUS
    ) {
      return { kind: 'vitals' as const, label: 'Signos Vitales' };
    }

    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, room.gameState.activeSabotage, nowTick]);

  const executeContextualUse = useCallback(() => {
    if (!contextualUse) return;
    soundEngine.playClick();
    if (contextualUse.kind === 'sabotage') {
      setActiveSabotageFix({
        type: contextualUse.station.sabotageType,
        stationId: contextualUse.station.id,
        label: contextualUse.station.label,
        code: roomRef.current.gameState.activeSabotage?.code,
      });
    } else if (contextualUse.kind === 'task') {
      // Activate visual scan animation on MedBay scan
      if (contextualUse.task.type === 'med_scan') {
        const me = playersRef.current.find((p) => p.id === myPlayerId);
        if (me) me.isScanning = true;
      }
      setActiveTask(contextualUse.task);
    } else if (contextualUse.kind === 'emergency') {
      triggerMeeting('emergency', myPlayerId);
    } else if (contextualUse.kind === 'admin') {
      setUtilityModal('admin');
    } else if (contextualUse.kind === 'vitals') {
      setUtilityModal('vitals');
    } else if (contextualUse.kind === 'cameras') {
      if (roomRef.current.gameState.activeSabotage?.type === 'comms') {
        showToast('Cámaras sin señal por sabotaje de Comunicaciones.');
        return;
      }
      setActiveCameraIdx(0);
      const watchers = Array.from(
        new Set([...roomRef.current.gameState.cameraWatchers, myPlayerId])
      );
      commitStateWithWinCheck(
        {
          ...roomRef.current,
          gameState: { ...roomRef.current.gameState, cameraWatchers: watchers },
        },
        playersRef.current
      );
    }
  }, [commitStateWithWinCheck, contextualUse, myPlayerId, showToast, triggerMeeting]);

  const handleToggleVent = useCallback(() => {
    const me = playersRef.current.find((p) => p.id === myPlayerId);
    if (!me || !me.isAlive) return;
    if (me.role !== 'impostor' && me.subRole !== 'engineer') return;

    if (me.inVentId) {
      me.inVentId = null;
      soundEngine.playVent();
      setNowTick(Date.now());
      return;
    }

    if (nearestVent) {
      me.inVentId = nearestVent.id;
      me.x = nearestVent.x;
      me.y = nearestVent.y;
      me.vx = 0;
      me.vy = 0;
      soundEngine.playVent();
      setNowTick(Date.now());
    }
  }, [myPlayerId, nearestVent]);

  const handleJumpVent = useCallback(
    (targetVentId: string) => {
      const me = playersRef.current.find((p) => p.id === myPlayerId);
      const target = map.vents.find((v) => v.id === targetVentId);
      if (!me || !target) return;
      me.inVentId = target.id;
      me.x = target.x;
      me.y = target.y;
      soundEngine.playVent();
      setNowTick(Date.now());
    },
    [map.vents, myPlayerId]
  );

  // ==========================================================================
  // KEYBOARD CONTROLS (DESKTOP COMPATIBILITY)
  // ==========================================================================
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      keysRef.current.add(key);

      if (roomRef.current.status !== 'playing') return;

      if (key === 'e' || key === ' ') {
        e.preventDefault();
        executeContextualUse();
      } else if (key === 'r' && nearestBody) {
        triggerMeeting('body_report', myPlayerId, nearestBody.id);
      } else if (key === 'q' && killTarget) {
        const cd = Math.max(0, (killCooldownUntil - Date.now()) / 1000);
        const me = playersRef.current.find((p) => p.id === myPlayerId);
        if (me && canPerformKill(me, killTarget, roomRef.current.settings.killDistance, cd)) {
          handleKill(myPlayerId, killTarget.id);
        }
      } else if (key === 'v') {
        handleToggleVent();
      } else if (key === 'm' || key === 'tab') {
        e.preventDefault();
        setMinimapMode((curr) => (curr === 'map' ? 'off' : 'map'));
      } else if (key === 'f' && meLive?.role === 'impostor') {
        setMinimapMode((curr) => (curr === 'sabotage' ? 'off' : 'sabotage'));
      } else if (key === 'escape') {
        setActiveTask(null);
        setActiveSabotageFix(null);
        setMinimapMode('off');
        setUtilityModal(null);
        setActiveCameraIdx(null);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [
    executeContextualUse,
    handleKill,
    handleToggleVent,
    killCooldownUntil,
    killTarget,
    meLive?.role,
    myPlayerId,
    nearestBody,
    triggerMeeting,
  ]);

  // ==========================================================================
  // HOST MEETING & SABOTAGE TIMER CONTROLLER (1Hz authoritative tick)
  // ==========================================================================
  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now();
      setNowTick(now);

      const currRoom = roomRef.current;
      if (!isHost) return;

      // 1. Check critical sabotage timeout during gameplay
      if (currRoom.status === 'playing' && currRoom.gameState.activeSabotage?.expiresAt) {
        if (now >= currRoom.gameState.activeSabotage.expiresAt) {
          commitStateWithWinCheck(currRoom, playersRef.current);
          return;
        }
      }

      // 2. Manage Meeting phase state machine + AI Bot voting
      if (currRoom.status === 'meeting' && currRoom.gameState.meeting) {
        const m = currRoom.gameState.meeting;

        // Discussion -> Voting
        if (m.phase === 'discussion' && now >= m.discussionEndsAt) {
          commitStateWithWinCheck(
            {
              ...currRoom,
              gameState: {
                ...currRoom.gameState,
                meeting: { ...m, phase: 'voting' },
              },
            },
            playersRef.current
          );
          return;
        }

        // Trigger AI bot votes smoothly once voting opens
        if (m.phase === 'voting' && botVotedMeetingRef.current !== m.meetingNumber) {
          botVotedMeetingRef.current = m.meetingNumber;
          const aliveBots = playersRef.current.filter((p) => p.isBot && p.isAlive);
          aliveBots.forEach((bot, idx) => {
            window.setTimeout(() => {
              const latestRoom = roomRef.current;
              const latestM = latestRoom.gameState.meeting;
              if (!latestM || latestM.phase !== 'voting' || latestM.meetingNumber !== m.meetingNumber) {
                return;
              }
              const decision = botManagerRef.current.decideBotVote(
                bot,
                playersRef.current,
                latestM.votes
              );
              if (decision.chatLine) {
                onSendMessage(`${bot.displayName}: ${decision.chatLine}`, 'meeting');
              }
              handleCastVote(decision.target, bot.id);
            }, 900 + idx * 240);
          });
        }

        // Voting timeout -> Results
        if (m.phase === 'voting' && now >= m.votingEndsAt) {
          commitStateWithWinCheck(
            {
              ...currRoom,
              gameState: {
                ...currRoom.gameState,
                meeting: {
                  ...m,
                  phase: 'results',
                  resultsEndsAt: now + 4000,
                },
              },
            },
            playersRef.current
          );
          return;
        }

        // Results -> Ejection cutscene
        if (m.phase === 'results' && m.resultsEndsAt && now >= m.resultsEndsAt) {
          const res = resolveMeetingVotes(m, playersRef.current, currRoom.settings);
          const nextPlayers = playersRef.current.map((p) =>
            res.ejectedPlayerId && p.id === res.ejectedPlayerId ? { ...p, isAlive: false } : p
          );
          commitStateWithWinCheck(
            {
              ...currRoom,
              gameState: {
                ...currRoom.gameState,
                meeting: {
                  ...m,
                  phase: 'ejection',
                  ejectedPlayerId: res.ejectedPlayerId,
                  ejectedPlayerName: res.ejectedPlayerName,
                  ejectedWasImpostor: res.ejectedWasImpostor,
                  ejectionMessage: res.message,
                  impostorsRemaining: res.impostorsRemaining,
                  resultsEndsAt: now + 4400,
                },
              },
            },
            nextPlayers,
            res.ejectedPlayerId ? [res.ejectedPlayerId] : undefined
          );
          return;
        }

        // Ejection cutscene done -> Resume match (or Win Condition!)
        if (m.phase === 'ejection' && m.resultsEndsAt && now >= m.resultsEndsAt) {
          const resumedPlayers = playersRef.current.map((p, idx) => {
            const sp = getSpawnPositionForIndex(map, idx, playersRef.current.length);
            return { ...p, x: sp.x, y: sp.y, vx: 0, vy: 0, inVentId: null };
          });
          const resumedRoom: RoomData = {
            ...currRoom,
            status: 'playing',
            gameState: {
              ...currRoom.gameState,
              deadBodies: [], // Classic Among Us: bodies clear after meeting!
              meeting: null,
              emergencyCooldownUntil: now + currRoom.settings.emergencyCooldown * 1000,
            },
          };
          commitStateWithWinCheck(resumedRoom, resumedPlayers);
        }
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, [commitStateWithWinCheck, handleCastVote, isHost, map, onSendMessage]);

  // ==========================================================================
  // 60 FPS RENDER & PHYSICS LOOP
  // ==========================================================================
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();

    const frame = (ts: number) => {
      const dtSec = Math.min(0.05, (ts - lastTime) / 1000);
      lastTime = ts;
      const now = Date.now();
      const currRoom = roomRef.current;

      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const rect = canvas.getBoundingClientRect();
        const targetW = Math.max(1, Math.floor(rect.width * dpr));
        const targetH = Math.max(1, Math.floor(rect.height * dpr));
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }

        const me = playersRef.current.find((p) => p.id === myPlayerId);
        const canMove =
          currRoom.status === 'playing' &&
          Boolean(me) &&
          !me?.inVentId &&
          !activeTask &&
          !activeSabotageFix &&
          activeCameraIdx === null &&
          minimapMode === 'off' &&
          utilityModal === null;

        if (me && canMove) {
          let ix = joystickRef.current.x;
          let iy = joystickRef.current.y;

          const keys = keysRef.current;
          if (keys.has('w') || keys.has('arrowup')) iy -= 1;
          if (keys.has('s') || keys.has('arrowdown')) iy += 1;
          if (keys.has('a') || keys.has('arrowleft')) ix -= 1;
          if (keys.has('d') || keys.has('arrowright')) ix += 1;

          const mag = Math.hypot(ix, iy);
          if (mag > 1) {
            ix /= mag;
            iy /= mag;
          }

          const speed = BASE_PLAYER_SPEED * currRoom.settings.playerSpeed;
          const vx = ix * speed;
          const vy = iy * speed;

          if (Math.abs(vx) > 1 || Math.abs(vy) > 1) {
            const resolved = resolveMovement(
              map,
              me.x,
              me.y,
              vx * dtSec,
              vy * dtSec,
              currRoom.gameState.doorsClosedUntil,
              now,
              !me.isAlive
            );
            me.x = resolved.x;
            me.y = resolved.y;
            me.vx = vx;
            me.vy = vy;
            if (Math.abs(vx) > 4) me.facing = vx > 0 ? 'right' : 'left';
          } else {
            me.vx = 0;
            me.vy = 0;
          }

          // Throttled ~15Hz position broadcast for 40-player scalability
          if (transport && now - lastBroadcastRef.current >= 66) {
            lastBroadcastRef.current = now;
            transport.sendPlayerMove({
              playerId: me.id,
              x: Math.round(me.x),
              y: Math.round(me.y),
              vx: Math.round(me.vx),
              vy: Math.round(me.vy),
              facing: me.facing,
              inVentId: me.inVentId,
              isScanning: me.isScanning,
              disguisedAsPlayerId: me.disguisedAsPlayerId,
              disguiseUntil: me.disguiseUntil,
              ts: now,
            });
          }
        }

        // Host steps AI Bots & broadcasts batch at ~12Hz
        if (isHost && currRoom.status === 'playing') {
          const botEvents = botManagerRef.current.step(
            playersRef.current,
            map,
            currRoom.gameState,
            currRoom.settings,
            dtSec,
            now
          );

          for (const ev of botEvents) {
            if (ev.type === 'complete_task' && ev.taskId) {
              handleCompleteTask(ev.taskId, ev.botId);
            } else if (ev.type === 'kill' && ev.victimId) {
              handleKill(ev.botId, ev.victimId);
            } else if (ev.type === 'report_body' && ev.bodyId) {
              triggerMeeting('body_report', ev.botId, ev.bodyId);
              break;
            } else if (ev.type === 'fix_sabotage' && ev.stationId) {
              handleFixSabotageStation(ev.stationId);
            }
          }

          if (transport && now - lastBotBroadcastRef.current >= 85) {
            lastBotBroadcastRef.current = now;
            const botUpdates = playersRef.current
              .filter((p) => p.isBot)
              .map((b) => ({
                playerId: b.id,
                x: Math.round(b.x),
                y: Math.round(b.y),
                vx: Math.round(b.vx),
                vy: Math.round(b.vy),
                facing: b.facing,
                inVentId: b.inVentId,
                ts: now,
              }));
            if (botUpdates.length > 0) {
              transport.sendBotBatch({ updates: botUpdates, ts: now });
            }
          }
        }

        // Smoothly interpolate remote players & remote bots at 60fps
        const lerpFactor = Math.min(1, dtSec * 14);
        for (const p of playersRef.current) {
          if (p.id === myPlayerId || (p.isBot && isHost)) continue;
          const target = remoteTargetsRef.current.get(p.id);
          if (!target) continue;
          const dx = target.x - p.x;
          const dy = target.y - p.y;
          if (Math.hypot(dx, dy) > 260) {
            // Snap across large jumps (vents / respawns)
            p.x = target.x;
            p.y = target.y;
          } else {
            p.x += dx * lerpFactor;
            p.y += dy * lerpFactor;
          }
        }

        const ctx = canvas.getContext('2d');
        if (ctx && me) {
          ctx.save();
          ctx.scale(dpr, dpr);
          const camOverride =
            activeCameraIdx !== null && map.cameras[activeCameraIdx]
              ? map.cameras[activeCameraIdx]
              : null;

          renderGameWorld({
            ctx,
            width: rect.width,
            height: rect.height,
            map,
            players: playersRef.current,
            localPlayer: me,
            gameState: currRoom.gameState,
            settings: currRoom.settings,
            now,
            killTargetId: killTarget?.id ?? null,
            cameraOverride: camOverride,
          });
          ctx.restore();
        }
      }

      rafId = window.requestAnimationFrame(frame);
    };

    rafId = window.requestAnimationFrame(frame);
    return () => window.cancelAnimationFrame(rafId);
  }, [
    activeCameraIdx,
    activeSabotageFix,
    activeTask,
    handleCompleteTask,
    handleFixSabotageStation,
    handleKill,
    isHost,
    killTarget?.id,
    map,
    minimapMode,
    myPlayerId,
    transport,
    triggerMeeting,
    utilityModal,
  ]);

  if (!meLive) return null;

  const taskProgress = calculateTaskProgress(playersRef.current);
  const currentRoomName = getRoomNameAtPoint(map, meLive.x, meLive.y);
  const aliveCount = playersRef.current.filter((p) => p.isAlive).length;
  const killCdSec = Math.max(0, Math.ceil((killCooldownUntil - nowTick) / 1000));
  const canKillNow = Boolean(
    killTarget &&
      canPerformKill(meLive, killTarget, room.settings.killDistance, killCdSec)
  );
  const activeSab = room.gameState.activeSabotage;
  const sabCountdown =
    activeSab?.expiresAt ? Math.max(0, Math.ceil((activeSab.expiresAt - nowTick) / 1000)) : null;
  const commsBlocked = activeSab?.type === 'comms' && meLive.role === 'crewmate';
  const currentVent = meLive.inVentId
    ? map.vents.find((v) => v.id === meLive.inVentId)
    : null;
  const shapeshiftCdSec = Math.max(0, Math.ceil((shapeshiftCooldownUntil - nowTick) / 1000));

  const exitCameras = () => {
    setActiveCameraIdx(null);
    const watchers = roomRef.current.gameState.cameraWatchers.filter((id) => id !== myPlayerId);
    commitStateWithWinCheck(
      {
        ...roomRef.current,
        gameState: { ...roomRef.current.gameState, cameraWatchers: watchers },
      },
      playersRef.current
    );
  };

  return (
    <div className="fixed inset-0 h-[100dvh] w-[100dvw] bg-[#050811] overflow-hidden select-none game-touch-surface">
      {/* FULL-SCREEN 60FPS GAME CANVAS */}
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Critical Sabotage Alarm Red Screen Pulse */}
      {activeSab?.expiresAt && (
        <div className="fixed inset-0 pointer-events-none border-[6px] border-rose-500/80 bg-rose-600/15 alarm-flash z-10" />
      )}

      {/* ROLE REVEAL INTRO OVERLAY */}
      {showRoleIntro && room.status === 'playing' && (
        <div
          onClick={() => {
            void fullscreen.enterIfMobile();
            setShowRoleIntro(false);
          }}
          className="fixed inset-0 z-50 bg-slate-950/92 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center cursor-pointer"
        >
          <div className="max-w-md space-y-4">
            <div className="text-xs uppercase tracking-[0.35em] text-slate-400 font-bold">
              {map.name}
            </div>
            <h1
              className={`font-display text-5xl sm:text-6xl font-bold tracking-wider ${
                meLive.role === 'impostor' ? 'text-rose-500' : 'text-cyan-400'
              }`}
            >
              {meLive.role === 'impostor' ? 'IMPOSTOR' : 'TRIPULANTE'}
            </h1>
            {meLive.subRole !== 'none' && (
              <div className="inline-block px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 font-display font-bold text-sm">
                Rol AU2: {getSubRoleLabel(meLive.subRole)}
              </div>
            )}
            <p className="text-sm text-slate-300">
              {meLive.role === 'impostor'
                ? 'Elimina a la tripulación, usa conductos y sabotea la nave sin ser descubierto.'
                : 'Completa tus tareas, vigila a los sospechosos y expulsa a todos los Impostores.'}
            </p>
            {meLive.subRole !== 'none' && (
              <p className="text-xs text-amber-200/90">{getSubRoleDescription(meLive.subRole)}</p>
            )}
            {meLive.role === 'impostor' && (
              <div className="pt-2 text-xs text-rose-300">
                Equipo Impostor:{' '}
                <strong>
                  {playersRef.current
                    .filter((p) => p.role === 'impostor')
                    .map((p) => p.displayName)
                    .join(', ')}
                </strong>
              </div>
            )}
            <div className="text-[11px] text-slate-500 pt-2">Toca en cualquier lugar para empezar</div>
          </div>
        </div>
      )}

      {/* TOP HUD BAR */}
      <div className="fixed top-0 left-0 right-0 z-20 p-1.5 sm:p-3 pt-[max(0.45rem,var(--safe-top))] pointer-events-none flex items-start justify-between gap-1.5">
        {/* Left: Task Bar + Collapsible Task List */}
        <div className="pointer-events-auto flex flex-col gap-1.5 max-w-[62vw] sm:max-w-xs">
          {/* Global Task Progress Bar */}
          <div className="bg-slate-950/85 backdrop-blur-md border border-slate-700/80 rounded-xl p-2 shadow-lg">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider mb-1">
              <span className="text-slate-300">
                {commsBlocked ? 'SEÑAL INTERFERIDA' : 'Progreso de Tareas'}
              </span>
              <span className="text-emerald-400">
                {commsBlocked ? '???' : `${Math.round(taskProgress.ratio * 100)}%`}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  commsBlocked ? 'bg-rose-500/60 animate-pulse w-full' : 'bg-gradient-to-r from-emerald-500 to-cyan-400'
                }`}
                style={commsBlocked ? undefined : { width: `${Math.round(taskProgress.ratio * 100)}%` }}
              />
            </div>
          </div>

          {/* Personal Tasks Drawer */}
          <div className="bg-slate-950/80 backdrop-blur-md border border-slate-700/70 rounded-xl overflow-hidden shadow-lg">
            <button
              type="button"
              onClick={() => setTasksExpanded((v) => !v)}
              className="w-full px-2.5 py-1.5 flex items-center justify-between text-[11px] font-bold text-slate-200 hover:bg-slate-800/60"
            >
              <span className="flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-amber-300" />
                {meLive.role === 'impostor' ? 'Tareas Falsas' : 'Mis Tareas'}
              </span>
              {tasksExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {tasksExpanded && (
              <div className="px-2.5 pb-2 space-y-1 max-h-36 overflow-y-auto">
                {commsBlocked ? (
                  <div className="text-[11px] text-rose-300 py-1">
                    Repara Comunicaciones para ver tus tareas.
                  </div>
                ) : (
                  meLive.tasks.map((t) => (
                    <div
                      key={t.id}
                      className={`text-[11px] flex items-center gap-1.5 ${
                        t.completed ? 'text-emerald-400 line-through opacity-75' : 'text-slate-200'
                      }`}
                    >
                      <CheckCircle2
                        className={`w-3.5 h-3.5 shrink-0 ${
                          t.completed ? 'text-emerald-400' : 'text-slate-600'
                        }`}
                      />
                      <span className="truncate">
                        <strong>{t.roomName}:</strong> {t.title}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Center-Top: Location & Critical Sabotage Alert */}
        <div className="hidden md:flex flex-col items-center gap-1.5">
          <div className="px-4 py-1.5 rounded-full bg-slate-950/85 border border-slate-700/80 text-xs font-display font-bold tracking-wider text-cyan-300 shadow">
            {currentRoomName.toUpperCase()} • {aliveCount} VIVOS
          </div>
          {!meLive.isAlive && (
            <div className="px-3 py-1 rounded-full bg-purple-950/85 border border-purple-500/50 text-[11px] font-bold text-purple-200 flex items-center gap-1.5">
              <Ghost className="w-3.5 h-3.5" />
              Modo Fantasma — Atraviesa paredes y termina tus tareas
            </div>
          )}
        </div>

        {/* Right: Fullscreen, Map, Audio, Leave */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          {fullscreen.supported && !fullscreen.standalone && (
            <button
              type="button"
              onClick={() => void fullscreen.toggle()}
              className={`p-2 sm:p-2.5 rounded-xl border shadow-lg transition ${
                fullscreen.isFullscreen
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                  : 'bg-slate-950/85 border-slate-700 hover:border-cyan-400 text-slate-200'
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
            onClick={() => setMinimapMode('map')}
            className="p-2 sm:p-2.5 rounded-xl bg-slate-950/85 border border-slate-700 hover:border-cyan-400 text-cyan-300 shadow-lg"
            title="Mapa Táctico (M)"
          >
            <MapIcon className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              const next = !muted;
              setMuted(next);
              soundEngine.setMuted(next);
            }}
            className="p-2 sm:p-2.5 rounded-xl bg-slate-950/85 border border-slate-700 hover:border-cyan-400 text-slate-300 shadow-lg"
            title={muted ? 'Activar sonido' : 'Silenciar'}
          >
            {muted ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5" />}
          </button>
          <button
            type="button"
            onClick={onLeaveRoom}
            className="p-2 sm:p-2.5 rounded-xl bg-slate-950/85 border border-slate-700 hover:border-rose-500 text-slate-300 hover:text-rose-300 shadow-lg"
            title="Salir de la partida"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* MOBILE ROOM PILL + FULLSCREEN PROMPT + ACTIVE SABOTAGE ALERT */}
      <div className="fixed top-[64px] left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center gap-1.5 w-[92vw] max-w-md">
        <div className="md:hidden px-3 py-1 rounded-full bg-slate-950/80 border border-slate-700/70 text-[11px] font-display font-bold text-cyan-300">
          {currentRoomName.toUpperCase()} {!meLive.isAlive ? '• FANTASMA' : `• ${aliveCount} VIVOS`}
        </div>

        {/* 1-tap Mobile Fullscreen Prompt (hides browser URL bar!) */}
        {fullscreen.isMobile && !fullscreen.isFullscreen && !dismissedFsHint && (
          <div className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-950/95 border border-cyan-400/70 text-[11px] text-cyan-100 shadow-xl">
            {fullscreen.supported ? (
              <button
                type="button"
                onClick={() => void fullscreen.enter()}
                className="flex items-center gap-1.5 font-bold text-cyan-200 hover:text-white"
              >
                <Maximize2 className="w-3.5 h-3.5 text-cyan-300" />
                Toca aquí para Pantalla Completa
              </button>
            ) : fullscreen.ios ? (
              <span className="text-[10px]">
                iPhone: <strong>Compartir → Añadir a inicio</strong> para ocultar la barra
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => setDismissedFsHint(true)}
              className="p-0.5 text-cyan-300/80 hover:text-white"
              aria-label="Cerrar aviso"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {activeSab && (
          <div className="px-4 py-2 rounded-xl bg-rose-950/92 border border-rose-500 text-rose-100 text-xs font-bold flex items-center gap-2 shadow-xl">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 animate-bounce" />
            <span>
              {activeSab.type === 'reactor' && `¡FUSIÓN DEL REACTOR! (${sabCountdown}s)`}
              {activeSab.type === 'o2' && `¡OXÍGENO AGOTÁNDOSE! (${sabCountdown}s)`}
              {activeSab.type === 'lights' && '¡LUCES SABOTEADAS! Repara el tablero eléctrico.'}
              {activeSab.type === 'comms' && '¡COMUNICACIONES CORTADAS!'}
            </span>
          </div>
        )}

        {toast && (
          <div className="px-4 py-1.5 rounded-full bg-cyan-500 text-slate-950 text-xs font-bold shadow-lg">
            {toast}
          </div>
        )}
      </div>

      {/* LIVE SECURITY CAMERAS CCTV HUD OVERLAY */}
      {activeCameraIdx !== null && (
        <div className="fixed inset-x-0 bottom-6 z-30 flex flex-col items-center gap-3 px-4">
          <div className="px-4 py-2 rounded-xl bg-emerald-950/90 border border-emerald-400/60 text-emerald-200 font-mono text-xs flex items-center gap-3 shadow-2xl">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <span>
              CCTV CAM {activeCameraIdx + 1}/{map.cameras.length}: {map.cameras[activeCameraIdx]?.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setActiveCameraIdx((i) => ((i ?? 0) - 1 + map.cameras.length) % map.cameras.length)
              }
              className="p-3 rounded-xl bg-slate-900 border border-slate-600 text-white"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={exitCameras}
              className="px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-display font-bold text-sm flex items-center gap-2"
            >
              <Camera className="w-4 h-4" />
              Cerrar Cámaras
            </button>
            <button
              type="button"
              onClick={() => setActiveCameraIdx((i) => ((i ?? 0) + 1) % map.cameras.length)}
              className="p-3 rounded-xl bg-slate-900 border border-slate-600 text-white"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* VENT JUMP NAVIGATION OVERLAY */}
      {currentVent && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-30 bg-slate-950/90 border border-amber-500/60 rounded-2xl p-3 flex flex-wrap items-center justify-center gap-2 shadow-2xl max-w-[92vw]">
          <span className="text-xs font-bold text-amber-300 mr-1">Conductos conectados:</span>
          {currentVent.linksTo.map((linkId) => {
            const targetVent = map.vents.find((v) => v.id === linkId);
            const targetRoom = map.rooms.find((r) => r.id === targetVent?.roomId);
            return (
              <button
                key={linkId}
                type="button"
                onClick={() => handleJumpVent(linkId)}
                className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-200 hover:text-slate-950 border border-amber-400/50 text-xs font-bold transition"
              >
                Saltar a {targetRoom?.name ?? linkId}
              </button>
            );
          })}
        </div>
      )}

      {/* BOTTOM CONTROLS: MOBILE VIRTUAL JOYSTICK (LEFT) + ERGONOMIC ACTION CLUSTER (RIGHT) */}
      {activeCameraIdx === null && room.status === 'playing' && (
        <>
          {/* Left Thumb Virtual Joystick + Desktop Hint */}
          <div className="fixed bottom-5 left-4 sm:bottom-7 sm:left-6 pb-[var(--safe-bottom)] z-20 flex flex-col items-start gap-2">
            <VirtualJoystick
              onVectorChange={(v) => {
                joystickRef.current = v;
              }}
            />
            <div className="hidden lg:block text-[10px] text-slate-400 bg-slate-950/75 px-2.5 py-1 rounded-lg border border-slate-800">
              PC: WASD/Flechas • E Usar • R Reportar • Q Matar • V Conducto • M Mapa
            </div>
          </div>

          {/* Right Thumb Action Buttons */}
          <div className="fixed bottom-5 right-4 sm:bottom-7 sm:right-6 pb-[var(--safe-bottom)] z-20 flex flex-col items-end gap-2.5">
            {/* Secondary Row: Sub-role & Sabotage/Vent */}
            <div className="flex items-center gap-2">
              {meLive.role === 'impostor' && (
                <ActionCircleButton
                  label="SABOTAJE"
                  icon={<AlertTriangle className="w-5 h-5" />}
                  variant="amber"
                  active={true}
                  onClick={() => setMinimapMode('sabotage')}
                />
              )}

              {meLive.isAlive &&
                (meLive.role === 'impostor' || meLive.subRole === 'engineer') && (
                  <ActionCircleButton
                    label={meLive.inVentId ? 'SALIR' : 'VENTILAR'}
                    icon={<Wind className="w-5 h-5" />}
                    variant="amber"
                    active={Boolean(nearestVent || meLive.inVentId)}
                    onClick={handleToggleVent}
                  />
                )}

              {meLive.isAlive && meLive.subRole === 'scientist' && (
                <ActionCircleButton
                  label="VITALES"
                  icon={<Activity className="w-5 h-5" />}
                  variant="emerald"
                  active={true}
                  onClick={() => setUtilityModal('vitals')}
                />
              )}

              {meLive.isAlive && meLive.subRole === 'tracker' && (
                <ActionCircleButton
                  label="GPS"
                  icon={<Radar className="w-5 h-5" />}
                  variant="emerald"
                  active={true}
                  onClick={() => setUtilityModal('tracker')}
                />
              )}

              {meLive.isAlive && meLive.subRole === 'shapeshifter' && (
                <ActionCircleButton
                  label={shapeshiftCdSec > 0 ? `${shapeshiftCdSec}s` : 'DISFRAZ'}
                  icon={<Eye className="w-5 h-5" />}
                  variant="rose"
                  active={shapeshiftCdSec === 0}
                  onClick={() => setUtilityModal('shapeshift')}
                />
              )}
            </div>

            {/* Primary Row: KILL + REPORT + USE */}
            <div className="flex items-center gap-2.5">
              {meLive.isAlive && meLive.role === 'impostor' && (
                <ActionCircleButton
                  label={killCdSec > 0 ? `${killCdSec}s` : 'MATAR'}
                  icon={<Skull className="w-6 h-6" />}
                  variant="rose"
                  size="lg"
                  active={canKillNow}
                  onClick={() => {
                    if (killTarget && canKillNow) {
                      handleKill(myPlayerId, killTarget.id);
                    }
                  }}
                />
              )}

              {meLive.isAlive && (
                <ActionCircleButton
                  label="REPORTAR"
                  icon={<AlertOctagon className="w-6 h-6" />}
                  variant="rose"
                  size="lg"
                  active={Boolean(nearestBody)}
                  onClick={() => {
                    if (nearestBody) {
                      triggerMeeting('body_report', myPlayerId, nearestBody.id);
                    }
                  }}
                />
              )}

              <ActionCircleButton
                label={contextualUse ? contextualUse.label.slice(0, 12) : 'USAR'}
                icon={<Wrench className="w-6 h-6" />}
                variant="cyan"
                size="lg"
                active={Boolean(contextualUse)}
                onClick={executeContextualUse}
              />
            </div>
          </div>
        </>
      )}

      {/* TASK & SABOTAGE MINI-GAME MODAL */}
      <TaskModal
        task={activeTask}
        sabotageFix={activeSabotageFix}
        onCompleteTask={(tid) => handleCompleteTask(tid, myPlayerId)}
        onFixSabotage={(stId) => handleFixSabotageStation(stId)}
        onClose={() => {
          const me = playersRef.current.find((p) => p.id === myPlayerId);
          if (me) me.isScanning = false;
          setActiveTask(null);
          setActiveSabotageFix(null);
        }}
      />

      {/* MINIMAP & SABOTAGE OVERLAY */}
      {minimapMode !== 'off' && (
        <MinimapModal
          map={map}
          localPlayer={meLive}
          players={playersRef.current}
          gameState={room.gameState}
          now={nowTick}
          sabotageMode={minimapMode === 'sabotage'}
          onTriggerSabotage={handleTriggerSabotage}
          onCloseDoor={handleCloseDoor}
          onClose={() => setMinimapMode('off')}
        />
      )}

      {/* ADMIN / VITALS / SHAPESHIFT / TRACKER MODAL */}
      <SecurityModal
        mode={utilityModal}
        map={map}
        players={playersRef.current}
        localPlayer={meLive}
        gameState={room.gameState}
        onSelectTarget={(targetId) => {
          const now = Date.now();
          if (utilityModal === 'shapeshift') {
            meLive.disguisedAsPlayerId = targetId;
            meLive.disguiseUntil = now + SHAPESHIFT_DURATION_MS;
            setShapeshiftCooldownUntil(now + SHAPESHIFT_COOLDOWN_MS);
            showToast('¡Disfraz activado por 20s!');
          } else if (utilityModal === 'tracker') {
            const target = playersRef.current.find((p) => p.id === targetId);
            if (target) {
              target.trackedByPlayerId = myPlayerId;
              target.trackedUntil = now + TRACKER_DURATION_MS;
              showToast(`Rastreando a ${target.displayName} en el Mapa (25s).`);
            }
          }
        }}
        onClose={() => setUtilityModal(null)}
      />

      {/* MEETING & VOTING MODAL */}
      {room.status === 'meeting' && room.gameState.meeting && (
        <MeetingModal
          meeting={room.gameState.meeting}
          players={playersRef.current}
          localPlayer={meLive}
          settings={room.settings}
          messages={messages}
          now={nowTick}
          onCastVote={(target) => handleCastVote(target, myPlayerId)}
          onSendMessage={(content, channel) => onSendMessage(content, channel)}
        />
      )}

      {/* MATCH RESULTS MODAL */}
      {room.status === 'finished' && room.gameState.result && (
        <ResultsModal
          result={room.gameState.result}
          players={playersRef.current}
          localPlayer={meLive}
          isHost={isHost}
          onReturnToLobby={onReturnToLobby}
          onLeaveRoom={onLeaveRoom}
        />
      )}
    </div>
  );
};

interface ActionCircleButtonProps {
  label: string;
  icon: React.ReactNode;
  variant: 'cyan' | 'rose' | 'amber' | 'emerald';
  size?: 'md' | 'lg';
  active: boolean;
  onClick: () => void;
}

const ActionCircleButton: React.FC<ActionCircleButtonProps> = ({
  label,
  icon,
  variant,
  size = 'md',
  active,
  onClick,
}) => {
  const palette = {
    cyan: active
      ? 'bg-cyan-500/90 border-cyan-200 text-slate-950 shadow-lg shadow-cyan-500/35'
      : 'bg-slate-900/65 border-slate-700 text-slate-500',
    rose: active
      ? 'bg-rose-600/95 border-rose-200 text-white shadow-lg shadow-rose-500/40'
      : 'bg-slate-900/65 border-slate-700 text-slate-500',
    amber: active
      ? 'bg-amber-500/90 border-amber-200 text-slate-950 shadow-lg shadow-amber-500/35'
      : 'bg-slate-900/65 border-slate-700 text-slate-500',
    emerald: active
      ? 'bg-emerald-500/90 border-emerald-200 text-slate-950 shadow-lg shadow-emerald-500/35'
      : 'bg-slate-900/65 border-slate-700 text-slate-500',
  }[variant];

  const dims = size === 'lg' ? 'w-[74px] h-[74px] sm:w-[82px] sm:h-[82px]' : 'w-14 h-14 sm:w-16 sm:h-16';

  return (
    <button
      type="button"
      disabled={!active}
      onClick={onClick}
      className={`${dims} rounded-2xl border-2 flex flex-col items-center justify-center gap-0.5 transition active:scale-95 ${palette}`}
    >
      {icon}
      <span className="text-[9px] sm:text-[10px] font-display font-bold uppercase tracking-tight leading-none px-1 truncate max-w-full">
        {label}
      </span>
    </button>
  );
};
