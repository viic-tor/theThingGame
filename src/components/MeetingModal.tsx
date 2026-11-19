import React, { useMemo, useState } from 'react';
import {
  AlertOctagon,
  Check,
  Clock,
  Ghost,
  MessageSquare,
  Search,
  Send,
  SkipForward,
  Skull,
  Users,
} from 'lucide-react';
import { getColorOption } from '../config/cosmetics';
import { QUICK_CHAT_PHRASES } from '../config/gameDefaults';
import type { ChatMessage, MeetingState, RoomPlayer, RoomSettings } from '../types/game';
import { AvatarSVG } from './AvatarSVG';

interface MeetingModalProps {
  meeting: MeetingState;
  players: RoomPlayer[];
  localPlayer: RoomPlayer;
  settings: RoomSettings;
  messages: ChatMessage[];
  now: number;
  onCastVote: (target: string | 'skip') => void;
  onSendMessage: (content: string, channel: 'meeting' | 'ghost') => void;
}

export const MeetingModal: React.FC<MeetingModalProps> = ({
  meeting,
  players,
  localPlayer,
  settings,
  messages,
  now,
  onCastVote,
  onSendMessage,
}) => {
  const [selectedTarget, setSelectedTarget] = useState<string | 'skip' | null>(null);
  const [mobilePanel, setMobilePanel] = useState<'vote' | 'chat'>('vote');
  const [filterMode, setFilterMode] = useState<'all' | 'alive' | 'dead'>('alive');
  const [searchQuery, setSearchQuery] = useState('');
  const [chatText, setChatText] = useState('');

  const myVote = meeting.votes[localPlayer.id];
  const canVoteNow =
    localPlayer.isAlive && meeting.phase === 'voting' && !myVote;

  const discussionLeft = Math.max(0, Math.ceil((meeting.discussionEndsAt - now) / 1000));
  const votingLeft = Math.max(0, Math.ceil((meeting.votingEndsAt - now) / 1000));

  const alivePlayers = useMemo(() => players.filter((p) => p.isAlive), [players]);
  const totalVotesCast = Object.keys(meeting.votes).length;

  const filteredPlayers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...players]
      .filter((p) => {
        if (filterMode === 'alive' && !p.isAlive) return false;
        if (filterMode === 'dead' && p.isAlive) return false;
        if (q && !p.displayName.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => Number(b.isAlive) - Number(a.isAlive));
  }, [players, filterMode, searchQuery]);

  // Compute voters per target for results reveal
  const votersByTarget = useMemo(() => {
    const map: Record<string, RoomPlayer[]> = { skip: [] };
    for (const [voterId, target] of Object.entries(meeting.votes)) {
      const voter = players.find((p) => p.id === voterId);
      if (!voter) continue;
      if (!map[target]) map[target] = [];
      map[target].push(voter);
    }
    return map;
  }, [meeting.votes, players]);

  const visibleMessages = useMemo(() => {
    return messages.filter((m) => {
      if (m.channel === 'meeting' || m.channel === 'system') return true;
      if (m.channel === 'ghost' && !localPlayer.isAlive) return true;
      return false;
    });
  }, [messages, localPlayer.isAlive]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatText.trim()) return;
    onSendMessage(chatText.trim(), localPlayer.isAlive ? 'meeting' : 'ghost');
    setChatText('');
  };

  // Ejection cinematic overlay
  if (meeting.phase === 'ejection') {
    const ejectedPlayer = meeting.ejectedPlayerId
      ? players.find((p) => p.id === meeting.ejectedPlayerId)
      : null;

    return (
      <div className="fixed inset-0 z-50 stars-bg flex flex-col items-center justify-center p-6 text-center overflow-hidden">
        {ejectedPlayer && (
          <div className="absolute top-1/3 left-0 animate-eject pointer-events-none">
            <AvatarSVG cosmetics={ejectedPlayer.cosmetics} size={96} />
          </div>
        )}
        <div className="relative z-10 max-w-lg space-y-4 bg-slate-950/70 backdrop-blur-md border border-slate-800 rounded-2xl p-6">
          <div className="text-xs uppercase tracking-[0.3em] text-cyan-400 font-bold">
            Resultado de la Votación
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-white leading-snug">
            {meeting.ejectionMessage ?? 'Nadie fue expulsado.'}
          </h2>
          <p className="text-xs text-slate-400">Reanudando la misión en breve...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col overflow-hidden">
      {/* Header Banner */}
      <header className="px-3 sm:px-5 py-3 border-b border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`p-2 rounded-xl shrink-0 ${
              meeting.reason === 'body_report'
                ? 'bg-rose-500/20 text-rose-400'
                : 'bg-amber-500/20 text-amber-400'
            }`}
          >
            {meeting.reason === 'body_report' ? (
              <Skull className="w-5 h-5" />
            ) : (
              <AlertOctagon className="w-5 h-5" />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-base sm:text-xl font-bold text-white truncate">
              {meeting.reason === 'body_report'
                ? `¡Cuerpo de ${meeting.reportedVictimName} en ${meeting.reportedRoomName}!`
                : `¡Reunión de Emergencia por ${meeting.callerName}!`}
            </h2>
            <p className="text-[11px] text-slate-400">
              Votos registrados: <strong className="text-cyan-300">{totalVotesCast}</strong> /{' '}
              {alivePlayers.length} vivos
            </p>
          </div>
        </div>

        {/* Phase Countdown */}
        <div
          className={`px-3.5 py-2 rounded-xl border font-mono text-xs sm:text-sm font-bold flex items-center gap-2 ${
            meeting.phase === 'discussion'
              ? 'bg-amber-950/60 border-amber-500/50 text-amber-300'
              : meeting.phase === 'voting'
                ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300'
                : 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
          }`}
        >
          <Clock className="w-4 h-4" />
          {meeting.phase === 'discussion' && `Discusión: ${discussionLeft}s`}
          {meeting.phase === 'voting' && `Votación: ${votingLeft}s`}
          {meeting.phase === 'results' && 'Conteo de votos...'}
        </div>
      </header>

      {/* Mobile View Switcher (Voting vs Chat) */}
      <div className="lg:hidden grid grid-cols-2 gap-1.5 p-2 bg-slate-900/70 border-b border-slate-800">
        <button
          type="button"
          onClick={() => setMobilePanel('vote')}
          className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${
            mobilePanel === 'vote' ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 bg-slate-800/60'
          }`}
        >
          <Users className="w-4 h-4" />
          Votar ({alivePlayers.length})
        </button>
        <button
          type="button"
          onClick={() => setMobilePanel('chat')}
          className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${
            mobilePanel === 'chat' ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 bg-slate-800/60'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Chat ({visibleMessages.length})
        </button>
      </div>

      {/* Main Split Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* VOTING PANEL (scales cleanly to 40 players!) */}
        <section
          className={`lg:col-span-8 flex flex-col overflow-hidden p-3 sm:p-4 gap-3 ${
            mobilePanel === 'vote' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {/* Search & Filter Bar (Crucial for 40-player rooms!) */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar tripulante..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>
            <div className="flex gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
              {(['alive', 'all', 'dead'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setFilterMode(m)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition ${
                    filterMode === m ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {m === 'alive' ? 'Vivos' : m === 'dead' ? 'Muertos' : 'Todos'}
                </button>
              ))}
            </div>
          </div>

          {/* 40-Player Responsive Cards Grid */}
          <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 content-start pr-1">
            {filteredPlayers.map((p) => {
              const hasVoted = Boolean(meeting.votes[p.id]);
              const isSelected = selectedTarget === p.id;
              const isMyVoted = myVote === p.id;
              const voters = meeting.phase === 'results' ? votersByTarget[p.id] ?? [] : [];
              const showRedName =
                p.role === 'impostor' &&
                (localPlayer.role === 'impostor' || !localPlayer.isAlive);

              return (
                <div
                  key={p.id}
                  onClick={() => {
                    if (canVoteNow && p.isAlive) {
                      setSelectedTarget(p.id);
                    }
                  }}
                  className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between gap-2 ${
                    !p.isAlive
                      ? 'bg-slate-950/60 border-slate-800/70 opacity-60'
                      : isMyVoted
                        ? 'bg-cyan-950/50 border-cyan-400 ring-2 ring-cyan-400/30'
                        : isSelected
                          ? 'bg-rose-950/50 border-rose-400 cursor-pointer'
                          : canVoteNow
                            ? 'bg-slate-900/90 border-slate-700 hover:border-cyan-400 cursor-pointer'
                            : 'bg-slate-900/80 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <AvatarSVG cosmetics={p.cosmetics} size={38} dead={!p.isAlive} />
                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-xs font-bold truncate ${
                          showRedName ? 'text-rose-400' : 'text-white'
                        }`}
                      >
                        {p.displayName}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                        {p.id === meeting.callerId && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                            REPORTÓ
                          </span>
                        )}
                        {hasVoted && p.isAlive && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                            VOTÓ
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Confirm Vote inline button */}
                  {canVoteNow && isSelected && p.isAlive && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCastVote(p.id);
                        setSelectedTarget(null);
                      }}
                      className="w-full py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold flex items-center justify-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Confirmar Voto
                    </button>
                  )}

                  {/* Vote Tally Dots on Results Phase */}
                  {meeting.phase === 'results' && voters.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-800">
                      {voters.map((v) => (
                        <span
                          key={v.id}
                          title={settings.anonymousVotes ? 'Voto anónimo' : v.displayName}
                          className="w-4 h-4 rounded-full border border-slate-950 inline-block"
                          style={{
                            backgroundColor: settings.anonymousVotes
                              ? '#64748b'
                              : getColorOption(v.cosmetics.color).primary,
                          }}
                        />
                      ))}
                      <span className="text-[10px] font-bold text-cyan-300 ml-auto">
                        {voters.length}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom Skip Vote + Results Bar */}
          <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
            {!localPlayer.isAlive ? (
              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                <Ghost className="w-4 h-4 text-cyan-400" />
                Eres fantasma: no puedes votar, pero puedes usar el Chat de Fantasmas.
              </div>
            ) : myVote ? (
              <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                Voto registrado ({myVote === 'skip' ? 'Saltar Voto' : players.find((p) => p.id === myVote)?.displayName})
              </div>
            ) : meeting.phase === 'discussion' ? (
              <div className="text-xs text-amber-300">
                La votación se abrirá al terminar la discusión ({discussionLeft}s)...
              </div>
            ) : (
              <button
                type="button"
                disabled={!canVoteNow}
                onClick={() => onCastVote('skip')}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-xs font-bold flex items-center gap-2 min-h-[44px]"
              >
                <SkipForward className="w-4 h-4 text-cyan-400" />
                Saltar Voto (Skip)
              </button>
            )}

            {meeting.phase === 'results' && (
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span>Saltaron voto:</span>
                <strong className="text-amber-300">{(votersByTarget.skip ?? []).length}</strong>
              </div>
            )}
          </div>
        </section>

        {/* CHAT + QUICK-CHAT PANEL */}
        <section
          className={`lg:col-span-4 border-t lg:border-t-0 lg:border-l border-slate-800 bg-slate-900/70 flex flex-col overflow-hidden p-3 ${
            mobilePanel === 'chat' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-display text-sm font-bold text-white flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-cyan-400" />
              {localPlayer.isAlive ? 'Chat de Reunión' : 'Chat de Fantasmas'}
            </h3>
            {!localPlayer.isAlive && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold">
                Solo Fantasmas
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-2">
            {visibleMessages.map((msg) => (
              <div
                key={msg.id}
                className={`p-2 rounded-xl text-xs border ${
                  msg.channel === 'ghost'
                    ? 'bg-purple-950/40 border-purple-500/30 text-purple-200'
                    : msg.channel === 'system'
                      ? 'bg-amber-950/40 border-amber-500/30 text-amber-200'
                      : 'bg-slate-950/80 border-slate-800 text-slate-200'
                }`}
              >
                <span className="font-bold text-cyan-300 mr-1.5">
                  {msg.channel === 'ghost' ? '👻 ' : ''}
                  {msg.senderName}:
                </span>
                <span>{msg.content}</span>
              </div>
            ))}
          </div>

          {/* Mobile-Friendly Quick Chat Chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-2 mb-1">
            {QUICK_CHAT_PHRASES.map((phrase) => (
              <button
                key={phrase}
                type="button"
                onClick={() => onSendMessage(phrase, localPlayer.isAlive ? 'meeting' : 'ghost')}
                className="px-2.5 py-1.5 rounded-full bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-[11px] font-medium text-slate-200 whitespace-nowrap transition shrink-0"
              >
                {phrase}
              </button>
            ))}
          </div>

          <form onSubmit={handleSend} className="flex gap-1.5 pb-[var(--safe-bottom)]">
            <input
              type="text"
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              placeholder={
                localPlayer.isAlive
                  ? 'Escribe tu defensa o acusación...'
                  : 'Hablar con otros fantasmas...'
              }
              maxLength={300}
              className="flex-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-400 focus:outline-none text-xs text-white"
            />
            <button
              type="submit"
              className="p-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};
