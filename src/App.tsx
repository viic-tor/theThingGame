import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { CustomizerModal } from './components/CustomizerModal';
import { GameView } from './components/GameView';
import { HomeScreen } from './components/HomeScreen';
import { LobbyScreen } from './components/LobbyScreen';
import {
  getCurrentProfile,
  logoutAccount,
  recordUserMatchStats,
  updateUserCustomization,
} from './services/authService';
import {
  addBotsToRoom,
  createRoom,
  joinRoomByCode,
  leaveRoom,
  persistRoomAndPlayersState,
  removeBotFromRoom,
  resetRoomToLobby,
  sendRoomChatMessage,
  startMatchInRoom,
  submitVoteRecord,
  subscribeToRoom,
  syncPlayerCosmeticsInRoom,
  updateRoomSettings,
  type RoomTransport,
} from './services/roomService';
import type {
  ChatMessage,
  MapId,
  PlayerCosmetics,
  RoomData,
  RoomPlayer,
  RoomSettings,
  UserProfile,
} from './types/game';
import { enterFullscreen, isTouchMobileDevice } from './utils/fullscreen';

export const App: React.FC = () => {
  const [booting, setBooting] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showCustomizer, setShowCustomizer] = useState(false);

  const [room, setRoom] = useState<RoomData | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [transport, setTransport] = useState<RoomTransport | null>(null);

  const playersRef = useRef<RoomPlayer[]>([]);
  const statsRecordedMatchRef = useRef<number | null>(null);

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  // Parse invite ?room=XXXXXX query param
  const initialRoomCode =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('room') ?? ''
      : '';

  // Hydrate user session on startup
  useEffect(() => {
    void getCurrentProfile()
      .then((p) => setProfile(p))
      .finally(() => setBooting(false));
  }, []);

  // Automatically enter true fullscreen on the first touch/click gesture on mobile devices
  // so the browser URL bar hides immediately and maximizes playable screen space.
  useEffect(() => {
    if (!isTouchMobileDevice()) return;
    const handleFirstGesture = () => {
      void enterFullscreen();
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('touchend', handleFirstGesture);
    };
    window.addEventListener('pointerdown', handleFirstGesture, { passive: true });
    window.addEventListener('touchend', handleFirstGesture, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('touchend', handleFirstGesture);
    };
  }, []);

  // Subscribe to Realtime transport whenever entering a room
  useEffect(() => {
    if (!room || !myPlayerId || !profile) return;

    const handle = subscribeToRoom(
      room,
      myPlayerId,
      () => playersRef.current,
      {
        onRoomUpdate: (updatedRoom) => setRoom(updatedRoom),
        onPlayersUpdate: (updatedPlayers) => setPlayers(updatedPlayers),
        onMessageReceived: (msg) =>
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev.slice(-90), msg])),
        onVoteReceived: ({ meetingNumber, voterPlayerId, target }) => {
          setRoom((prev) => {
            if (!prev || !prev.gameState.meeting) return prev;
            if (prev.gameState.meeting.meetingNumber !== meetingNumber) return prev;
            if (prev.gameState.meeting.votes[voterPlayerId] === target) return prev;
            const nextVotes = { ...prev.gameState.meeting.votes, [voterPlayerId]: target };
            const aliveIds = playersRef.current.filter((p) => p.isAlive).map((p) => p.id);
            const everyoneVoted = aliveIds.length > 0 && aliveIds.every((id) => Boolean(nextVotes[id]));
            return {
              ...prev,
              gameState: {
                ...prev.gameState,
                meeting: {
                  ...prev.gameState.meeting,
                  votes: nextVotes,
                  phase:
                    everyoneVoted && prev.gameState.meeting.phase === 'voting'
                      ? 'results'
                      : prev.gameState.meeting.phase,
                  resultsEndsAt:
                    everyoneVoted && !prev.gameState.meeting.resultsEndsAt
                      ? Date.now() + 4000
                      : prev.gameState.meeting.resultsEndsAt,
                },
              },
            };
          });
        },
        onPlayerMove: (payload) => {
          setPlayers((prev) =>
            prev.map((p) =>
              p.id === payload.playerId
                ? {
                    ...p,
                    x: payload.x,
                    y: payload.y,
                    vx: payload.vx,
                    vy: payload.vy,
                    facing: payload.facing,
                    inVentId: payload.inVentId,
                    isScanning: payload.isScanning,
                    disguisedAsPlayerId: payload.disguisedAsPlayerId,
                    disguiseUntil: payload.disguiseUntil,
                  }
                : p
            )
          );
        },
        onBotBatch: (batch) => {
          const mapById = new Map(batch.updates.map((u) => [u.playerId, u]));
          setPlayers((prev) =>
            prev.map((p) => {
              const u = mapById.get(p.id);
              return u
                ? { ...p, x: u.x, y: u.y, vx: u.vx, vy: u.vy, facing: u.facing, inVentId: u.inVentId }
                : p;
            })
          );
        },
      },
      Boolean(profile.isLocalDemo)
    );

    setTransport(handle);
    return () => {
      handle.cleanup();
      setTransport(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, myPlayerId, profile?.id]);

  // Persist user career stats once when match finishes
  useEffect(() => {
    if (!room || room.status !== 'finished' || !room.gameState.result || !profile || !myPlayerId) {
      return;
    }
    const finishedAt = room.gameState.result.finishedAt;
    if (statsRecordedMatchRef.current === finishedAt) return;
    statsRecordedMatchRef.current = finishedAt;

    const me = players.find((p) => p.id === myPlayerId);
    if (!me) return;
    const wasImpostor = me.role === 'impostor';
    const won =
      (room.gameState.result.winner === 'impostors' && wasImpostor) ||
      (room.gameState.result.winner === 'crewmates' && !wasImpostor);
    const doneTasks = me.role === 'crewmate' ? me.tasks.filter((t) => t.completed).length : 0;

    void recordUserMatchStats(profile, won, wasImpostor, doneTasks, me.killsThisMatch ?? 0).then(
      (updated) => setProfile(updated)
    );
  }, [room, players, profile, myPlayerId]);

  const handleSaveCustomization = async (username: string, cosmetics: PlayerCosmetics) => {
    if (!profile) return;
    const updated = await updateUserCustomization(profile, username, cosmetics);
    setProfile(updated);

    if (room && myPlayerId) {
      await syncPlayerCosmeticsInRoom(room, myPlayerId, username, cosmetics, Boolean(updated.isLocalDemo));
      const nextPlayers = players.map((p) =>
        p.id === myPlayerId ? { ...p, displayName: username, cosmetics } : p
      );
      setPlayers(nextPlayers);
      transport?.notifyLocalStateChanged({ room, players: nextPlayers, messages });
    }
  };

  const handleCreateRoom = async (mapId: MapId) => {
    if (!profile) return;
    const created = await createRoom(profile, { mapId });
    setRoom(created.room);
    setPlayers(created.players);
    setMyPlayerId(created.myPlayerId);
    setMessages([]);
  };

  const handleJoinRoom = async (code: string) => {
    if (!profile) return;
    const joined = await joinRoomByCode(code, profile);
    setRoom(joined.room);
    setPlayers(joined.players);
    setMyPlayerId(joined.myPlayerId);
    setMessages(joined.messages);
  };

  const handleLeaveRoom = async () => {
    if (room && myPlayerId && profile) {
      await leaveRoom(room, myPlayerId, players, Boolean(profile.isLocalDemo));
    }
    setRoom(null);
    setPlayers([]);
    setMyPlayerId(null);
    setMessages([]);
  };

  const handleUpdateSettings = async (settings: RoomSettings) => {
    if (!room || !profile) return;
    const updatedRoom = await updateRoomSettings(room, settings, Boolean(profile.isLocalDemo));
    setRoom(updatedRoom);
    transport?.notifyLocalStateChanged({ room: updatedRoom, players, messages });
  };

  const handleAddBots = async (count: number) => {
    if (!room || !profile) return;
    const updatedPlayers = await addBotsToRoom(room, players, count, Boolean(profile.isLocalDemo));
    setPlayers(updatedPlayers);
    transport?.notifyLocalStateChanged({ room, players: updatedPlayers, messages });
  };

  const handleRemoveBot = async (botId: string) => {
    if (!room || !profile) return;
    const updatedPlayers = await removeBotFromRoom(room, botId, players, Boolean(profile.isLocalDemo));
    setPlayers(updatedPlayers);
    transport?.notifyLocalStateChanged({ room, players: updatedPlayers, messages });
  };

  const handleStartMatch = async () => {
    if (!room || !profile) return;
    const started = await startMatchInRoom(room, players, Boolean(profile.isLocalDemo));
    setRoom(started.room);
    setPlayers(started.players);
    transport?.notifyLocalStateChanged({
      room: started.room,
      players: started.players,
      messages,
    });
  };

  const handleSyncMatchState = useCallback(
    (nextRoom: RoomData, nextPlayers: RoomPlayer[], changedIds?: string[]) => {
      setRoom(nextRoom);
      setPlayers(nextPlayers);
      if (profile) {
        void persistRoomAndPlayersState(
          nextRoom,
          nextPlayers,
          changedIds,
          Boolean(profile.isLocalDemo)
        );
      }
      transport?.notifyLocalStateChanged({
        room: nextRoom,
        players: nextPlayers,
        messages,
      });
    },
    [messages, profile, transport]
  );

  const handleSendMessage = useCallback(
    async (content: string, channel: ChatMessage['channel']) => {
      if (!room || !profile) return;
      const me = playersRef.current.find((p) => p.id === myPlayerId);
      const sender =
        channel === 'system'
          ? { id: null, name: 'SISTEMA', color: 'amber' }
          : {
              id: me?.id ?? null,
              name: me?.displayName ?? profile.username,
              color: me?.cosmetics.color ?? profile.cosmetics.color,
            };

      const msg = await sendRoomChatMessage(
        room,
        sender,
        content,
        channel,
        Boolean(profile.isLocalDemo)
      );
      setMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev.slice(-90), msg]
      );
      transport?.notifyLocalStateChanged({
        room,
        players: playersRef.current,
        messages: [...messages.slice(-90), msg],
      });
    },
    [messages, myPlayerId, profile, room, transport]
  );

  const handleReturnToLobby = async () => {
    if (!room || !profile) return;
    const reset = await resetRoomToLobby(room, players, Boolean(profile.isLocalDemo));
    setRoom(reset.room);
    setPlayers(reset.players);
    transport?.notifyLocalStateChanged({
      room: reset.room,
      players: reset.players,
      messages,
    });
  };

  const handleLogout = async () => {
    await handleLeaveRoom();
    await logoutAccount();
    setProfile(null);
  };

  if (booting) {
    return (
      <div className="min-h-[100dvh] stars-bg flex items-center justify-center">
        <div className="font-display text-xl tracking-widest text-cyan-300 animate-pulse">
          CARGANDO AMONG US 2...
        </div>
      </div>
    );
  }

  if (!profile) {
    return <AuthScreen onAuthenticated={setProfile} />;
  }

  return (
    <>
      {!room || !myPlayerId ? (
        <HomeScreen
          profile={profile}
          initialRoomCode={initialRoomCode}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onOpenCustomizer={() => setShowCustomizer(true)}
          onLogout={handleLogout}
        />
      ) : room.status === 'lobby' ? (
        <LobbyScreen
          room={room}
          players={players}
          myPlayerId={myPlayerId}
          messages={messages}
          onUpdateSettings={handleUpdateSettings}
          onAddBots={handleAddBots}
          onRemoveBot={handleRemoveBot}
          onStartMatch={handleStartMatch}
          onSendMessage={(content) => handleSendMessage(content, 'lobby')}
          onOpenCustomizer={() => setShowCustomizer(true)}
          onLeaveRoom={handleLeaveRoom}
        />
      ) : (
        <GameView
          room={room}
          players={players}
          myPlayerId={myPlayerId}
          messages={messages}
          transport={transport}
          onSyncMatchState={handleSyncMatchState}
          onSubmitVote={(meetingNumber, voterId, target) => {
            if (room && profile) {
              void submitVoteRecord(room, meetingNumber, voterId, target, Boolean(profile.isLocalDemo));
            }
          }}
          onSendMessage={(content, channel) => void handleSendMessage(content, channel)}
          onReturnToLobby={() => void handleReturnToLobby()}
          onLeaveRoom={() => void handleLeaveRoom()}
        />
      )}

      {showCustomizer && (
        <CustomizerModal
          profile={profile}
          onSave={handleSaveCustomization}
          onClose={() => setShowCustomizer(false)}
        />
      )}
    </>
  );
};

export default App;
