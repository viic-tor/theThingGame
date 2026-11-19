import React from 'react';
import { AlertTriangle, Wrench, X } from 'lucide-react';
import type { AssignedTask, SabotageType } from '../../types/game';
import {
  AsteroidsGame,
  DownloadGame,
  MedScanGame,
  ReactorSeqGame,
  ShieldsGame,
  SteeringGame,
  SwipeCardGame,
  WiringGame,
} from './CrewMiniGames';
import { CommsFixGame, LightsFixGame, O2FixGame, ReactorFixGame } from './SabotageFixGames';

interface TaskModalProps {
  task?: AssignedTask | null;
  sabotageFix?: {
    type: SabotageType;
    stationId: string;
    label: string;
    code?: string;
  } | null;
  onCompleteTask: (taskId: string) => void;
  onFixSabotage: (stationId: string) => void;
  onClose: () => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  task,
  sabotageFix,
  onCompleteTask,
  onFixSabotage,
  onClose,
}) => {
  if (!task && !sabotageFix) return null;

  return (
    <div className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        <div
          className={`px-4 py-3.5 border-b flex items-center justify-between ${
            sabotageFix
              ? 'bg-rose-950/60 border-rose-500/40'
              : 'bg-slate-950/70 border-slate-800'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {sabotageFix ? (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            ) : (
              <Wrench className="w-5 h-5 text-amber-300 shrink-0" />
            )}
            <div className="min-w-0">
              <div className="font-display font-bold text-base text-white truncate">
                {sabotageFix ? sabotageFix.label : task?.title}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {sabotageFix ? 'Reparación de Sabotaje' : task?.roomName}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {sabotageFix && (
            <>
              {sabotageFix.type === 'lights' && (
                <LightsFixGame onFixed={() => onFixSabotage(sabotageFix.stationId)} />
              )}
              {sabotageFix.type === 'o2' && (
                <O2FixGame
                  o2Code={sabotageFix.code}
                  onFixed={() => onFixSabotage(sabotageFix.stationId)}
                />
              )}
              {sabotageFix.type === 'reactor' && (
                <ReactorFixGame onFixed={() => onFixSabotage(sabotageFix.stationId)} />
              )}
              {sabotageFix.type === 'comms' && (
                <CommsFixGame onFixed={() => onFixSabotage(sabotageFix.stationId)} />
              )}
            </>
          )}

          {task && !sabotageFix && (
            <>
              {task.type === 'wiring' && <WiringGame onComplete={() => onCompleteTask(task.id)} />}
              {task.type === 'reactor_seq' && (
                <ReactorSeqGame onComplete={() => onCompleteTask(task.id)} />
              )}
              {task.type === 'swipe_card' && (
                <SwipeCardGame onComplete={() => onCompleteTask(task.id)} />
              )}
              {task.type === 'asteroids' && (
                <AsteroidsGame onComplete={() => onCompleteTask(task.id)} />
              )}
              {task.type === 'download' && (
                <DownloadGame onComplete={() => onCompleteTask(task.id)} />
              )}
              {task.type === 'steering' && (
                <SteeringGame onComplete={() => onCompleteTask(task.id)} />
              )}
              {task.type === 'med_scan' && (
                <MedScanGame onComplete={() => onCompleteTask(task.id)} />
              )}
              {task.type === 'shields' && (
                <ShieldsGame onComplete={() => onCompleteTask(task.id)} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
