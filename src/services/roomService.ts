import type { RealtimeChannel } from '@supabase/supabase-js';
import { randomBotCosmetics } from '../config/cosmetics';
import {
  BOT_NAMES,
  createInitialGameState,
  DEFAULT_ROOM_SETTINGS,
  MAX_IMPOSTORS_LIMIT,
  MAX_PLAYERS_LIMIT,
} from '../config/gameDefaults';
import { getSpawnPositionForIndex } from '../engine/collision';
import { assignRolesAndTasks, clampImpostorCount, generateRoomCode } from '../engine/rules';
import { getMapById } from '../maps';
import type {
  BotBatchPayload,
  ChatMessage,
  GameState,
  PlayerCosmetics,
  PlayerMovePayload,
  RoomData,
  RoomPlayer,
  RoomSettings,
  RoomStatus,
  UserProfile,
} from '../types/game';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';

// ============================================================================
// DB ROW MAPPERS
// ============================================================================

interface RoomRow {
  id: string;
  code: string;
  host_id: string;
  map_id: RoomSettings['mapId'];
  max_players: number;
  impostor_count: number;
  status: RoomStatus;
  settings: Partial<RoomSettings>;
  game_state: Partial<GameState>;
  created_at: string;
}

interface RoomPlayerRow {
  id: string;
  room_id: string;
  user_id: string | null;
  bot_id: string | null;
  display_name: string;
  is_bot: boolean;
  is_host: boolean;
  cosmetics: PlayerCosmetics;
  role: RoomPlayer['role'];
  sub_role: RoomPlayer['subRole'];
  is_alive: boolean;
  tasks: RoomPlayer['tasks'];
  emergencies_left: number;
}

interface MessageRow {
  id: string;
  room_id: string;
  sender_player_id: string | null;
  sender_name: string;
  sender_color: string;
  content: string;
  channel: ChatMessage['channel'];
  created_at: string;
}

function mapRoomRow(row: RoomRow): RoomData {
  const settings: RoomSettings = {
    ...DEFAULT_ROOM_SETTINGS,
    ...(row.settings ?? {}),
    mapId: row.map_id ?? row.settings?.mapId ?? 'aegis',
    maxPlayers: Math.min(MAX_PLAYERS_LIMIT, Math.max(4, row.max_players ?? row.settings?.maxPlayers ?? 40)),
    impostorCount: Math.min(MAX_IMPOSTORS_LIMIT, Math.max(1, row.impostor_count ?? row.settings?.impostorCount ?? 2)),
  };

  const gameState: GameState = {
    ...createInitialGameState(),
    ...(row.game_state ?? {}),
    deadBodies: row.game_state?.deadBodies ?? [],
    doorsClosedUntil: row.game_state?.doorsClosedUntil ?? {},
    cameraWatchers: row.game_state?.cameraWatchers ?? [],
  };

  return {
    id: row.id,
    code: row.code,
    hostId: row.host_id,
    status: row.status,
    settings,
    gameState,
    createdAt: row.created_at,
  };
}

function mapPlayerRow(
  row: RoomPlayerRow,
  index: number,
  total: number,
  mapId: RoomSettings['mapId'],
  existing?: RoomPlayer
): RoomPlayer {
  const map = getMapById(mapId);
  const spawn = getSpawnPositionForIndex(map, index, total);
  return {
    id: row.id,
    userId: row.user_id,
    botId: row.bot_id,
    displayName: row.display_name,
    isBot: row.is_bot,
    isHost: row.is_host,
    cosmetics: row.cosmetics,
    role: row.role,
    subRole: row.sub_role ?? 'none',
    isAlive: row.is_alive,
    tasks: Array.isArray(row.tasks) ? row.tasks : [],
    emergenciesLeft: row.emergencies_left ?? 1,
    x: existing?.x ?? spawn.x,
    y: existing?.y ?? spawn.y,
    vx: existing?.vx ?? 0,
    vy: existing?.vy ?? 0,
    facing: existing?.facing ?? 'right',
    inVentId: existing?.inVentId ?? null,
    isScanning: existing?.isScanning ?? false,
    disguisedAsPlayerId: existing?.disguisedAsPlayerId ?? null,
    disguiseUntil: existing?.disguiseUntil ?? null,
    trackedByPlayerId: existing?.trackedByPlayerId ?? null,
    trackedUntil: existing?.trackedUntil ?? null,
    killsThisMatch: existing?.killsThisMatch ?? 0,
  };
}

function mapMessageRow(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    roomId: row.room_id,
    senderPlayerId: row.sender_player_id,
    senderName: row.sender_name,
    senderColor: row.sender_color,
    content: row.content,
    channel: row.channel,
    createdAt: row.created_at,
  };
}

// ============================================================================
// LOCAL DEMO MULTI-TAB STORAGE (works offline & across browser tabs!)
// ============================================================================

const LOCAL_ROOM_PREFIX = 'au2_local_room_';

interface LocalRoomBundle {
  room: RoomData;
  players: RoomPlayer[];
  messages: ChatMessage[];
}

function loadLocalRoom(code: string): LocalRoomBundle | null {
  try {
    const raw = localStorage.getItem(LOCAL_ROOM_PREFIX + code.toUpperCase());
    return raw ? (JSON.parse(raw) as LocalRoomBundle) : null;
  } catch {
    return null;
  }
}

function saveLocalRoom(bundle: LocalRoomBundle): void {
  localStorage.setItem(LOCAL_ROOM_PREFIX + bundle.room.code.toUpperCase(), JSON.stringify(bundle));
}

// ============================================================================
// REALTIME TRANSPORT HANDLE
// ============================================================================

export interface RoomSubscriptionCallbacks {
  onRoomUpdate: (room: RoomData) => void;
  onPlayersUpdate: (players: RoomPlayer[]) => void;
  onMessageReceived: (message: ChatMessage) => void;
  onVoteReceived: (vote: { meetingNumber: number; voterPlayerId: string; target: string | 'skip' }) => void;
  onPlayerMove: (payload: PlayerMovePayload) => void;
  onBotBatch: (payload: BotBatchPayload) => void;
  onOnlineCountChange?: (count: number) => void;
}

export interface RoomTransport {
  sendPlayerMove: (payload: PlayerMovePayload) => void;
  sendBotBatch: (payload: BotBatchPayload) => void;
  notifyLocalStateChanged: (bundle: LocalRoomBundle) => void;
  cleanup: () => void;
}

// ============================================================================
// ROOM CRUD & MULTIPLAYER OPERATIONS
// ============================================================================

export async function createRoom(
  profile: UserProfile,
  initialSettings?: Partial<RoomSettings>
): Promise<{ room: RoomData; players: RoomPlayer[]; myPlayerId: string }> {
  const settings: RoomSettings = {
    ...DEFAULT_ROOM_SETTINGS,
    ...(initialSettings ?? {}),
  };
  const code = generateRoomCode();
  const initialState = createInitialGameState();

  const supabase = !profile.isLocalDemo ? getSupabaseClient() : null;
  if (supabase && isSupabaseConfigured) {
    const { data: roomRow, error: roomErr } = await supabase
      .from('rooms')
      .insert({
        code,
        host_id: profile.id,
        map_id: settings.mapId,
        max_players: settings.maxPlayers,
        impostor_count: settings.impostorCount,
        status: 'lobby',
        settings,
        game_state: initialState,
      })
      .select('*')
      .single<RoomRow>();

    if (roomErr || !roomRow) {
      throw new Error(roomErr?.message ?? 'No se pudo crear la sala en Supabase.');
    }

    const { data: playerRow, error: playerErr } = await supabase
      .from('room_players')
      .insert({
        room_id: roomRow.id,
        user_id: profile.id,
        display_name: profile.username,
        is_bot: false,
        is_host: true,
        cosmetics: profile.cosmetics,
        emergencies_left: settings.emergencyMeetings,
      })
      .select('*')
      .single<RoomPlayerRow>();

    if (playerErr || !playerRow) {
      throw new Error(playerErr?.message ?? 'No se pudo registrar al anfitrión en la sala.');
    }

    const room = mapRoomRow(roomRow);
    const player = mapPlayerRow(playerRow, 0, 1, room.settings.mapId);
    return { room, players: [player], myPlayerId: player.id };
  }

  // Local Demo Room
  const roomId = `local_room_${crypto.randomUUID()}`;
  const playerId = `local_player_${crypto.randomUUID()}`;
  const map = getMapById(settings.mapId);
  const spawn = getSpawnPositionForIndex(map, 0, 1);

  const room: RoomData = {
    id: roomId,
    code,
    hostId: profile.id,
    status: 'lobby',
    settings,
    gameState: initialState,
    createdAt: new Date().toISOString(),
  };

  const hostPlayer: RoomPlayer = {
    id: playerId,
    userId: profile.id,
    botId: null,
    displayName: profile.username,
    isBot: false,
    isHost: true,
    cosmetics: { ...profile.cosmetics },
    role: null,
    subRole: 'none',
    isAlive: true,
    tasks: [],
    emergenciesLeft: settings.emergencyMeetings,
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    facing: 'right',
    inVentId: null,
  };

  saveLocalRoom({ room, players: [hostPlayer], messages: [] });
  return { room, players: [hostPlayer], myPlayerId: playerId };
}

export async function joinRoomByCode(
  code: string,
  profile: UserProfile
): Promise<{ room: RoomData; players: RoomPlayer[]; messages: ChatMessage[]; myPlayerId: string }> {
  const normalizedCode = code.trim().toUpperCase();
  if (normalizedCode.length !== 6) {
    throw new Error('El código de sala debe tener 6 caracteres.');
  }

  const supabase = !profile.isLocalDemo ? getSupabaseClient() : null;
  if (supabase && isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('join_room_by_code', {
      p_code: normalizedCode,
      p_display_name: profile.username,
      p_cosmetics: profile.cosmetics,
    });

    if (error || !data) {
      throw new Error(error?.message ?? 'No se pudo unir a la sala.');
    }

    const parsed = data as { room: RoomRow; player: RoomPlayerRow };
    const room = mapRoomRow(parsed.room);

    const [{ data: allPlayers }, { data: allMessages }] = await Promise.all([
      supabase
        .from('room_players')
        .select('*')
        .eq('room_id', room.id)
        .order('joined_at', { ascending: true }),
      supabase
        .from('room_messages')
        .select('*')
        .eq('room_id', room.id)
        .order('created_at', { ascending: true })
        .limit(80),
    ]);

    const playerRows = (allPlayers ?? []) as RoomPlayerRow[];
    const players = playerRows.map((row, idx) =>
      mapPlayerRow(row, idx, playerRows.length, room.settings.mapId)
    );
    const messages = ((allMessages ?? []) as MessageRow[]).map(mapMessageRow);

    return {
      room,
      players,
      messages,
      myPlayerId: parsed.player.id,
    };
  }

  // Local Demo join (also supports multi-tab!)
  const bundle = loadLocalRoom(normalizedCode);
  if (!bundle) {
    throw new Error(`No se encontró ninguna sala local con el código ${normalizedCode}.`);
  }

  const existing = bundle.players.find((p) => p.userId === profile.id);
  if (existing) {
    existing.displayName = profile.username;
    existing.cosmetics = { ...profile.cosmetics };
    saveLocalRoom(bundle);
    return { ...bundle, myPlayerId: existing.id };
  }

  if (bundle.room.status !== 'lobby') {
    throw new Error('Esta partida ya ha comenzado.');
  }
  if (bundle.players.length >= bundle.room.settings.maxPlayers) {
    throw new Error(`La sala está llena (${bundle.players.length}/${bundle.room.settings.maxPlayers}).`);
  }

  const map = getMapById(bundle.room.settings.mapId);
  const spawn = getSpawnPositionForIndex(map, bundle.players.length, bundle.players.length + 1);
  const newPlayer: RoomPlayer = {
    id: `local_player_${crypto.randomUUID()}`,
    userId: profile.id,
    botId: null,
    displayName: profile.username,
    isBot: false,
    isHost: false,
    cosmetics: { ...profile.cosmetics },
    role: null,
    subRole: 'none',
    isAlive: true,
    tasks: [],
    emergenciesLeft: bundle.room.settings.emergencyMeetings,
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    facing: 'right',
    inVentId: null,
  };

  bundle.players.push(newPlayer);
  saveLocalRoom(bundle);
  return { ...bundle, myPlayerId: newPlayer.id };
}

export async function leaveRoom(
  room: RoomData,
  myPlayerId: string,
  players: RoomPlayer[],
  isLocalDemo = false
): Promise<void> {
  const supabase = !isLocalDemo ? getSupabaseClient() : null;
  if (supabase && isSupabaseConfigured) {
    await supabase.from('room_players').delete().eq('id', myPlayerId);
    const remainingHumans = players.filter((p) => !p.isBot && p.id !== myPlayerId);
    if (remainingHumans.length === 0) {
      await supabase.from('rooms').delete().eq('id', room.id);
    } else if (players.find((p) => p.id === myPlayerId)?.isHost) {
      const nextHost = remainingHumans[0];
      if (nextHost.userId) {
        await supabase.from('rooms').update({ host_id: nextHost.userId }).eq('id', room.id);
        await supabase.from('room_players').update({ is_host: true }).eq('id', nextHost.id);
      }
    }
    return;
  }

  const bundle = loadLocalRoom(room.code);
  if (!bundle) return;
  bundle.players = bundle.players.filter((p) => p.id !== myPlayerId);
  saveLocalRoom(bundle);
}

export async function updateRoomSettings(
  room: RoomData,
  settings: RoomSettings,
  isLocalDemo = false
): Promise<RoomData> {
  const sanitized: RoomSettings = {
    ...settings,
    maxPlayers: Math.min(MAX_PLAYERS_LIMIT, Math.max(4, settings.maxPlayers)),
    impostorCount: Math.min(MAX_IMPOSTORS_LIMIT, Math.max(1, settings.impostorCount)),
  };

  const supabase = !isLocalDemo ? getSupabaseClient() : null;
  if (supabase && isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('rooms')
      .update({
        map_id: sanitized.mapId,
        max_players: sanitized.maxPlayers,
        impostor_count: sanitized.impostorCount,
        settings: sanitized,
      })
      .eq('id', room.id)
      .select('*')
      .single<RoomRow>();

    if (error || !data) {
      throw new Error(error?.message ?? 'Error actualizando configuración de sala.');
    }
    return mapRoomRow(data);
  }

  const updatedRoom: RoomData = { ...room, settings: sanitized };
  const bundle = loadLocalRoom(room.code);
  if (bundle) {
    bundle.room = updatedRoom;
    saveLocalRoom(bundle);
  }
  return updatedRoom;
}

export async function addBotsToRoom(
  room: RoomData,
  existingPlayers: RoomPlayer[],
  countToAdd: number,
  isLocalDemo = false
): Promise<RoomPlayer[]> {
  const availableSlots = Math.max(0, room.settings.maxPlayers - existingPlayers.length);
  const actualCount = Math.min(countToAdd, availableSlots);
  if (actualCount <= 0) return existingPlayers;

  const usedNames = new Set(existingPlayers.map((p) => p.displayName));
  const map = getMapById(room.settings.mapId);
  const newBots: RoomPlayer[] = [];

  for (let i = 0; i < actualCount; i++) {
    const idx = existingPlayers.length + i;
    let candidateName = BOT_NAMES[idx % BOT_NAMES.length];
    let suffix = 2;
    while (usedNames.has(candidateName)) {
      candidateName = `${BOT_NAMES[idx % BOT_NAMES.length]}-${suffix++}`;
    }
    usedNames.add(candidateName);

    const botId = `bot_${Date.now()}_${idx}_${Math.floor(Math.random() * 999)}`;
    const spawn = getSpawnPositionForIndex(map, idx, existingPlayers.length + actualCount);
    newBots.push({
      id: `local_bot_${crypto.randomUUID()}`,
      userId: null,
      botId,
      displayName: candidateName,
      isBot: true,
      isHost: false,
      cosmetics: randomBotCosmetics(idx + 3),
      role: null,
      subRole: 'none',
      isAlive: true,
      tasks: [],
      emergenciesLeft: room.settings.emergencyMeetings,
      x: spawn.x,
      y: spawn.y,
      vx: 0,
      vy: 0,
      facing: 'right',
      inVentId: null,
    });
  }

  const supabase = !isLocalDemo ? getSupabaseClient() : null;
  if (supabase && isSupabaseConfigured) {
    const rows = newBots.map((b) => ({
      room_id: room.id,
      user_id: null,
      bot_id: b.botId,
      display_name: b.displayName,
      is_bot: true,
      is_host: false,
      cosmetics: b.cosmetics,
      emergencies_left: room.settings.emergencyMeetings,
    }));

    const { data, error } = await supabase
      .from('room_players')
      .insert(rows)
      .select('*');

    if (error) {
      throw new Error(error.message);
    }

    const inserted = ((data ?? []) as RoomPlayerRow[]).map((row, idx) =>
      mapPlayerRow(row, existingPlayers.length + idx, existingPlayers.length + actualCount, room.settings.mapId)
    );
    return [...existingPlayers, ...inserted];
  }

  const merged = [...existingPlayers, ...newBots];
  const bundle = loadLocalRoom(room.code);
  if (bundle) {
    bundle.players = merged;
    saveLocalRoom(bundle);
  }
  return merged;
}

export async function removeBotFromRoom(
  room: RoomData,
  botPlayerId: string,
  existingPlayers: RoomPlayer[],
  isLocalDemo = false
): Promise<RoomPlayer[]> {
  const supabase = !isLocalDemo ? getSupabaseClient() : null;
  if (supabase && isSupabaseConfigured) {
    await supabase.from('room_players').delete().eq('id', botPlayerId).eq('is_bot', true);
  }

  const filtered = existingPlayers.filter((p) => p.id !== botPlayerId);
  if (isLocalDemo) {
    const bundle = loadLocalRoom(room.code);
    if (bundle) {
      bundle.players = filtered;
      saveLocalRoom(bundle);
    }
  }
  return filtered;
}

export async function syncPlayerCosmeticsInRoom(
  room: RoomData,
  playerId: string,
  displayName: string,
  cosmetics: PlayerCosmetics,
  isLocalDemo = false
): Promise<void> {
  const supabase = !isLocalDemo ? getSupabaseClient() : null;
  if (supabase && isSupabaseConfigured) {
    await supabase
      .from('room_players')
      .update({ display_name: displayName, cosmetics })
      .eq('id', playerId);
    return;
  }

  const bundle = loadLocalRoom(room.code);
  if (bundle) {
    bundle.players = bundle.players.map((p) =>
      p.id === playerId ? { ...p, displayName, cosmetics } : p
    );
    saveLocalRoom(bundle);
  }
}

export async function startMatchInRoom(
  room: RoomData,
  players: RoomPlayer[],
  isLocalDemo = false
): Promise<{ room: RoomData; players: RoomPlayer[] }> {
  const map = getMapById(room.settings.mapId);
  const now = Date.now();
  const effectiveImpostors = clampImpostorCount(room.settings.impostorCount, players.length);
  const adjustedSettings: RoomSettings = {
    ...room.settings,
    impostorCount: effectiveImpostors,
  };

  const assignedPlayers = assignRolesAndTasks(players, map, adjustedSettings);
  const gameState: GameState = {
    ...createInitialGameState(),
    matchStartedAt: now,
    sabotageCooldownUntil: now + 15_000,
    emergencyCooldownUntil: now + adjustedSettings.emergencyCooldown * 1000,
  };

  const updatedRoom: RoomData = {
    ...room,
    status: 'playing',
    settings: adjustedSettings,
    gameState,
  };

  const supabase = !isLocalDemo ? getSupabaseClient() : null;
  if (supabase && isSupabaseConfigured) {
    // Update all players in parallel batches
    await Promise.all(
      assignedPlayers.map((p) =>
        supabase
          .from('room_players')
          .update({
            role: p.role,
            sub_role: p.subRole,
            is_alive: true,
            tasks: p.tasks,
            emergencies_left: p.emergenciesLeft,
          })
          .eq('id', p.id)
      )
    );

    const { error } = await supabase
      .from('rooms')
      .update({
        status: 'playing',
        impostor_count: effectiveImpostors,
        settings: adjustedSettings,
        game_state: gameState,
      })
      .eq('id', room.id);

    if (error) {
      throw new Error(error.message);
    }
  } else {
    const bundle = loadLocalRoom(room.code);
    if (bundle) {
      bundle.room = updatedRoom;
      bundle.players = assignedPlayers;
      saveLocalRoom(bundle);
    }
  }

  return { room: updatedRoom, players: assignedPlayers };
}

export async function persistRoomAndPlayersState(
  room: RoomData,
  players: RoomPlayer[],
  changedPlayerIds?: string[],
  isLocalDemo = false
): Promise<void> {
  const supabase = !isLocalDemo ? getSupabaseClient() : null;
  if (supabase && isSupabaseConfigured) {
    await supabase
      .from('rooms')
      .update({
        status: room.status,
        game_state: room.gameState,
      })
      .eq('id', room.id);

    if (changedPlayerIds && changedPlayerIds.length > 0) {
      const toUpdate = players.filter((p) => changedPlayerIds.includes(p.id));
      await Promise.all(
        toUpdate.map((p) =>
          supabase
            .from('room_players')
            .update({
              is_alive: p.isAlive,
              tasks: p.tasks,
              emergencies_left: p.emergenciesLeft,
            })
            .eq('id', p.id)
        )
      );
    }

    if (room.status === 'finished' && room.gameState.result) {
      await supabase.from('match_history').insert({
        room_code: room.code,
        map_id: room.settings.mapId,
        winner: room.gameState.result.winner,
        reason: room.gameState.result.reason,
        player_count: players.length,
        impostor_count: room.gameState.result.impostorIds.length,
        duration_seconds: room.gameState.result.durationSeconds,
        summary: room.gameState.result,
      });
    }
    return;
  }

  const bundle = loadLocalRoom(room.code);
  if (bundle) {
    bundle.room = room;
    bundle.players = players;
    saveLocalRoom(bundle);
  }
}

export async function resetRoomToLobby(
  room: RoomData,
  players: RoomPlayer[],
  isLocalDemo = false
): Promise<{ room: RoomData; players: RoomPlayer[] }> {
  const map = getMapById(room.settings.mapId);
  const resetPlayers = players.map((p, idx) => {
    const spawn = getSpawnPositionForIndex(map, idx, players.length);
    return {
      ...p,
      role: null,
      subRole: 'none' as const,
      isAlive: true,
      tasks: [],
      emergenciesLeft: room.settings.emergencyMeetings,
      x: spawn.x,
      y: spawn.y,
      vx: 0,
      vy: 0,
      inVentId: null,
      isScanning: false,
      disguisedAsPlayerId: null,
      disguiseUntil: null,
      trackedByPlayerId: null,
      trackedUntil: null,
      killsThisMatch: 0,
    };
  });

  const resetRoom: RoomData = {
    ...room,
    status: 'lobby',
    gameState: createInitialGameState(),
  };

  const supabase = !isLocalDemo ? getSupabaseClient() : null;
  if (supabase && isSupabaseConfigured) {
    await Promise.all(
      resetPlayers.map((p) =>
        supabase
          .from('room_players')
          .update({
            role: null,
            sub_role: 'none',
            is_alive: true,
            tasks: [],
            emergencies_left: room.settings.emergencyMeetings,
          })
          .eq('id', p.id)
      )
    );
    await supabase
      .from('rooms')
      .update({
        status: 'lobby',
        game_state: resetRoom.gameState,
      })
      .eq('id', room.id);
  } else {
    const bundle = loadLocalRoom(room.code);
    if (bundle) {
      bundle.room = resetRoom;
      bundle.players = resetPlayers;
      saveLocalRoom(bundle);
    }
  }

  return { room: resetRoom, players: resetPlayers };
}

export async function submitVoteRecord(
  room: RoomData,
  meetingNumber: number,
  voterPlayerId: string,
  target: string | 'skip',
  isLocalDemo = false
): Promise<void> {
  const supabase = !isLocalDemo ? getSupabaseClient() : null;
  if (supabase && isSupabaseConfigured) {
    await supabase.from('match_votes').upsert(
      {
        room_id: room.id,
        meeting_number: meetingNumber,
        voter_player_id: voterPlayerId,
        target_player_id: target === 'skip' ? null : target,
      },
      { onConflict: 'room_id,meeting_number,voter_player_id' }
    );
  }
}

export async function sendRoomChatMessage(
  room: RoomData,
  sender: { id: string | null; name: string; color: string },
  content: string,
  channel: ChatMessage['channel'],
  isLocalDemo = false
): Promise<ChatMessage> {
  const clean = content.trim().slice(0, 380);
  const supabase = !isLocalDemo ? getSupabaseClient() : null;
  if (supabase && isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('room_messages')
      .insert({
        room_id: room.id,
        sender_player_id: sender.id,
        sender_name: sender.name,
        sender_color: sender.color,
        content: clean,
        channel,
      })
      .select('*')
      .single<MessageRow>();

    if (error || !data) {
      throw new Error(error?.message ?? 'Error enviando mensaje.');
    }
    return mapMessageRow(data);
  }

  const msg: ChatMessage = {
    id: `local_msg_${crypto.randomUUID()}`,
    roomId: room.id,
    senderPlayerId: sender.id,
    senderName: sender.name,
    senderColor: sender.color,
    content: clean,
    channel,
    createdAt: new Date().toISOString(),
  };

  const bundle = loadLocalRoom(room.code);
  if (bundle) {
    bundle.messages = [...bundle.messages.slice(-90), msg];
    saveLocalRoom(bundle);
  }
  return msg;
}

// ============================================================================
// REALTIME SUBSCRIPTION (Supabase Broadcast + Presence + Postgres Changes)
// ============================================================================

export function subscribeToRoom(
  room: RoomData,
  myPlayerId: string,
  getCurrentPlayers: () => RoomPlayer[],
  callbacks: RoomSubscriptionCallbacks,
  isLocalDemo = false
): RoomTransport {
  const supabase = !isLocalDemo ? getSupabaseClient() : null;

  if (supabase && isSupabaseConfigured) {
    let channel: RealtimeChannel | null = supabase.channel(`au2_room_${room.code}`, {
      config: {
        broadcast: { self: false },
        presence: { key: myPlayerId },
      },
    });

    channel
      .on('broadcast', { event: 'player_move' }, ({ payload }) => {
        callbacks.onPlayerMove(payload as PlayerMovePayload);
      })
      .on('broadcast', { event: 'bot_batch' }, ({ payload }) => {
        callbacks.onBotBatch(payload as BotBatchPayload);
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel?.presenceState() ?? {};
        callbacks.onOnlineCountChange?.(Object.keys(state).length);
      })
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` },
        (payload) => {
          const updated = mapRoomRow(payload.new as RoomRow);
          callbacks.onRoomUpdate(updated);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${room.id}` },
        async () => {
          const { data } = await supabase
            .from('room_players')
            .select('*')
            .eq('room_id', room.id)
            .order('joined_at', { ascending: true });

          if (!data) return;
          const prevMap = new Map(getCurrentPlayers().map((p) => [p.id, p]));
          const rows = data as RoomPlayerRow[];
          const mapped = rows.map((row, idx) =>
            mapPlayerRow(row, idx, rows.length, room.settings.mapId, prevMap.get(row.id))
          );
          callbacks.onPlayersUpdate(mapped);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'room_messages', filter: `room_id=eq.${room.id}` },
        (payload) => {
          callbacks.onMessageReceived(mapMessageRow(payload.new as MessageRow));
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'match_votes', filter: `room_id=eq.${room.id}` },
        (payload) => {
          const row = payload.new as {
            meeting_number: number;
            voter_player_id: string;
            target_player_id: string | null;
          };
          callbacks.onVoteReceived({
            meetingNumber: row.meeting_number,
            voterPlayerId: row.voter_player_id,
            target: row.target_player_id ?? 'skip',
          });
        }
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && channel) {
          await channel.track({ playerId: myPlayerId, onlineAt: Date.now() });
        }
      });

    return {
      sendPlayerMove: (payload) => {
        void channel?.send({ type: 'broadcast', event: 'player_move', payload });
      },
      sendBotBatch: (payload) => {
        void channel?.send({ type: 'broadcast', event: 'bot_batch', payload });
      },
      notifyLocalStateChanged: () => {},
      cleanup: () => {
        if (channel) {
          void supabase.removeChannel(channel);
          channel = null;
        }
      },
    };
  }

  // Local Demo Multi-Tab BroadcastChannel transport
  const bc =
    typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel(`au2_local_channel_${room.code}`)
      : null;

  if (bc) {
    bc.onmessage = (event) => {
      const data = event.data as
        | { kind: 'player_move'; payload: PlayerMovePayload }
        | { kind: 'bot_batch'; payload: BotBatchPayload }
        | { kind: 'state_sync'; bundle: LocalRoomBundle };

      if (data.kind === 'player_move') {
        callbacks.onPlayerMove(data.payload);
      } else if (data.kind === 'bot_batch') {
        callbacks.onBotBatch(data.payload);
      } else if (data.kind === 'state_sync') {
        callbacks.onRoomUpdate(data.bundle.room);
        callbacks.onPlayersUpdate(data.bundle.players);
        const latestMsg = data.bundle.messages[data.bundle.messages.length - 1];
        if (latestMsg) callbacks.onMessageReceived(latestMsg);
      }
    };
  }

  return {
    sendPlayerMove: (payload) => {
      bc?.postMessage({ kind: 'player_move', payload });
    },
    sendBotBatch: (payload) => {
      bc?.postMessage({ kind: 'bot_batch', payload });
    },
    notifyLocalStateChanged: (bundle) => {
      saveLocalRoom(bundle);
      bc?.postMessage({ kind: 'state_sync', bundle });
    },
    cleanup: () => {
      bc?.close();
    },
  };
}
