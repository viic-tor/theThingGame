import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Crosshair, Download, Shield, Sparkles } from 'lucide-react';
import { soundEngine } from '../../engine/audio';

interface MiniGameProps {
  onComplete: () => void;
}

// ============================================================================
// 1. FIX WIRING (Tap left color -> Tap matching right color)
// ============================================================================
const WIRE_COLORS = [
  { id: 'red', label: 'Rojo', hex: '#ef4444' },
  { id: 'blue', label: 'Azul', hex: '#3b82f6' },
  { id: 'yellow', label: 'Amarillo', hex: '#eab308' },
  { id: 'pink', label: 'Rosa', hex: '#ec4899' },
];

export const WiringGame: React.FC<MiniGameProps> = ({ onComplete }) => {
  const rightOrder = useMemo(
    () => [...WIRE_COLORS].sort(() => Math.random() - 0.5),
    []
  );
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [connected, setConnected] = useState<string[]>([]);

  const handleRightTap = (colorId: string) => {
    if (!selectedLeft || connected.includes(colorId)) return;
    if (selectedLeft === colorId) {
      soundEngine.playClick();
      const next = [...connected, colorId];
      setConnected(next);
      setSelectedLeft(null);
      if (next.length === WIRE_COLORS.length) {
        setTimeout(onComplete, 320);
      }
    } else {
      setSelectedLeft(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-300 text-center">
        Toca un cable de la izquierda y luego conéctalo con su color correspondiente a la derecha.
      </p>
      <div className="grid grid-cols-2 gap-6 py-2">
        <div className="space-y-3">
          {WIRE_COLORS.map((w) => {
            const isDone = connected.includes(w.id);
            const isSel = selectedLeft === w.id;
            return (
              <button
                key={w.id}
                type="button"
                disabled={isDone}
                onClick={() => {
                  soundEngine.playClick();
                  setSelectedLeft(w.id);
                }}
                className={`w-full py-3.5 px-3 rounded-xl font-bold text-xs flex items-center justify-between border-2 transition min-h-[48px] ${
                  isDone
                    ? 'opacity-45 border-emerald-500 bg-slate-900 text-emerald-300'
                    : isSel
                      ? 'scale-[1.03] border-white shadow-lg'
                      : 'border-slate-700 hover:border-slate-400'
                }`}
                style={{ backgroundColor: isDone ? undefined : `${w.hex}33` }}
              >
                <span className="w-5 h-5 rounded-full border border-black/40" style={{ backgroundColor: w.hex }} />
                <span className="text-white">{w.label}</span>
                <span className="w-3 h-3 rounded-full bg-slate-200" />
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          {rightOrder.map((w) => {
            const isDone = connected.includes(w.id);
            return (
              <button
                key={w.id}
                type="button"
                disabled={isDone}
                onClick={() => handleRightTap(w.id)}
                className={`w-full py-3.5 px-3 rounded-xl font-bold text-xs flex items-center justify-between border-2 transition min-h-[48px] ${
                  isDone
                    ? 'opacity-45 border-emerald-500 bg-slate-900 text-emerald-300'
                    : 'border-slate-700 hover:border-cyan-400'
                }`}
                style={{ backgroundColor: isDone ? undefined : `${w.hex}33` }}
              >
                <span className="w-3 h-3 rounded-full bg-slate-200" />
                <span className="text-white">{w.label}</span>
                {isDone ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <span className="w-5 h-5 rounded-full border border-black/40" style={{ backgroundColor: w.hex }} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 2. START REACTOR (Simon-says 3x3 sequence, 3 rounds)
// ============================================================================
export const ReactorSeqGame: React.FC<MiniGameProps> = ({ onComplete }) => {
  const sequence = useMemo(
    () => [
      Math.floor(Math.random() * 9),
      Math.floor(Math.random() * 9),
      Math.floor(Math.random() * 9),
      Math.floor(Math.random() * 9),
    ],
    []
  );
  const [round, setRound] = useState(1);
  const [showingIdx, setShowingIdx] = useState<number | null>(null);
  const [isPlayback, setIsPlayback] = useState(true);
  const [inputStep, setInputStep] = useState(0);
  const [statusMsg, setStatusMsg] = useState('Observa la secuencia...');

  useEffect(() => {
    let cancelled = false;
    setIsPlayback(true);
    setInputStep(0);
    setStatusMsg(`Ronda ${round}/3 — Observa...`);

    const timers: number[] = [];
    const targetLen = round + 1;
    for (let i = 0; i < targetLen; i++) {
      timers.push(
        window.setTimeout(() => {
          if (cancelled) return;
          setShowingIdx(sequence[i]);
          soundEngine.playClick();
        }, 450 + i * 580)
      );
      timers.push(
        window.setTimeout(() => {
          if (cancelled) return;
          setShowingIdx(null);
        }, 450 + i * 580 + 360)
      );
    }

    timers.push(
      window.setTimeout(() => {
        if (cancelled) return;
        setIsPlayback(false);
        setStatusMsg('¡Repite la secuencia!');
      }, 450 + targetLen * 580 + 120)
    );

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [round, sequence]);

  const handleCellTap = (idx: number) => {
    if (isPlayback) return;
    soundEngine.playClick();
    if (sequence[inputStep] === idx) {
      const nextStep = inputStep + 1;
      if (nextStep >= round + 1) {
        if (round >= 3) {
          setStatusMsg('¡Reactor estabilizado!');
          setTimeout(onComplete, 320);
        } else {
          setRound((r) => r + 1);
        }
      } else {
        setInputStep(nextStep);
      }
    } else {
      setStatusMsg('Secuencia incorrecta, reintentando...');
      setRound(1);
    }
  };

  return (
    <div className="space-y-4 text-center">
      <div className="text-xs font-semibold text-cyan-300">{statusMsg}</div>
      <div className="grid grid-cols-3 gap-2.5 max-w-[240px] mx-auto">
        {Array.from({ length: 9 }).map((_, idx) => {
          const lit = showingIdx === idx;
          return (
            <button
              key={idx}
              type="button"
              disabled={isPlayback}
              onClick={() => handleCellTap(idx)}
              className={`h-16 rounded-xl border-2 transition-all ${
                lit
                  ? 'bg-cyan-400 border-white shadow-lg shadow-cyan-400/50 scale-95'
                  : 'bg-slate-800 border-slate-700 hover:border-cyan-400 active:bg-cyan-500/40'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// 3. SWIPE CARD (Slide range / touch swipe at steady speed)
// ============================================================================
export const SwipeCardGame: React.FC<MiniGameProps> = ({ onComplete }) => {
  const [pos, setPos] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const [feedback, setFeedback] = useState('Desliza la tarjeta de izquierda a derecha a ritmo medio.');

  const handleChange = (val: number) => {
    if (pos === 0 && val > 0) {
      startTimeRef.current = performance.now();
    }
    setPos(val);
    if (val >= 98) {
      const elapsed = startTimeRef.current ? performance.now() - startTimeRef.current : 500;
      if (elapsed < 180) {
        setFeedback('¡Demasiado rápido! Intenta deslizar más suave.');
        setPos(0);
        startTimeRef.current = null;
      } else if (elapsed > 2600) {
        setFeedback('¡Demasiado lento! Desliza con ritmo firme.');
        setPos(0);
        startTimeRef.current = null;
      } else {
        soundEngine.playClick();
        setFeedback('¡Tarjeta aceptada!');
        setTimeout(onComplete, 320);
      }
    }
  };

  return (
    <div className="space-y-5 py-2">
      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-700 space-y-3">
        <div className="flex items-center justify-between text-xs font-mono text-emerald-400">
          <span>LECTOR DE CREDENCIALES</span>
          <span>{pos}%</span>
        </div>
        <div className="relative h-14 rounded-xl bg-slate-900 border-2 border-slate-700 overflow-hidden flex items-center px-2">
          <div
            className="h-10 w-24 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 border border-white/40 flex items-center justify-center text-[11px] font-bold text-white shadow transition-all"
            style={{ transform: `translateX(${pos * 1.8}px)` }}
          >
            ID AU-2
          </div>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => handleChange(Number(e.target.value))}
          onMouseUp={() => pos < 98 && setPos(0)}
          onTouchEnd={() => pos < 98 && setPos(0)}
          className="w-full h-8 accent-cyan-400 cursor-grab"
        />
      </div>
      <p className="text-xs text-center text-amber-300 font-medium">{feedback}</p>
    </div>
  );
};

// ============================================================================
// 4. CLEAR ASTEROIDS (Tap 8 moving targets)
// ============================================================================
export const AsteroidsGame: React.FC<MiniGameProps> = ({ onComplete }) => {
  const TARGET_COUNT = 8;
  const [destroyed, setDestroyed] = useState(0);
  const [targets, setTargets] = useState(() =>
    Array.from({ length: 4 }, (_, i) => ({
      id: i,
      x: 15 + Math.random() * 70,
      y: 15 + Math.random() * 70,
    }))
  );

  const hitTarget = (id: number) => {
    soundEngine.playClick();
    const next = destroyed + 1;
    setDestroyed(next);
    if (next >= TARGET_COUNT) {
      setTimeout(onComplete, 250);
      return;
    }
    setTargets((prev) =>
      prev.map((t) =>
        t.id === id
          ? { id: Date.now() + Math.random(), x: 12 + Math.random() * 74, y: 12 + Math.random() * 74 }
          : t
      )
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="text-slate-300">Toca los objetivos en el radar</span>
        <span className="text-emerald-400">
          {destroyed} / {TARGET_COUNT}
        </span>
      </div>
      <div className="relative h-56 rounded-2xl bg-emerald-950/50 border-2 border-emerald-500/40 overflow-hidden">
        {/* Radar rings */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-25">
          <div className="w-40 h-40 rounded-full border border-emerald-400" />
          <div className="w-20 h-20 rounded-full border border-emerald-400 absolute" />
        </div>

        {targets.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => hitTarget(t.id)}
            className="absolute -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-amber-500/25 border-2 border-amber-400 flex items-center justify-center hover:scale-110 active:scale-90 transition"
            style={{ left: `${t.x}%`, top: `${t.y}%` }}
          >
            <Crosshair className="w-6 h-6 text-amber-300" />
          </button>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// 5. DOWNLOAD / UPLOAD DATA (Tap accelerate packets + progress bar)
// ============================================================================
export const DownloadGame: React.FC<MiniGameProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!started) return;
    const id = window.setInterval(() => {
      setProgress((p) => {
        const next = Math.min(100, p + 8);
        if (next >= 100) {
          window.clearInterval(id);
          setTimeout(onComplete, 260);
        }
        return next;
      });
    }, 260);
    return () => window.clearInterval(id);
  }, [started, onComplete]);

  return (
    <div className="space-y-5 py-3 text-center">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center">
        <Download className="w-8 h-8 text-cyan-300" />
      </div>

      <div className="space-y-2">
        <div className="h-5 rounded-full bg-slate-950 border border-slate-700 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="text-xs font-mono text-cyan-300">{progress}% transferido</div>
      </div>

      {!started ? (
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            setStarted(true);
          }}
          className="px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display font-bold text-sm min-h-[46px]"
        >
          Iniciar Transferencia
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            setProgress((p) => {
              const next = Math.min(100, p + 12);
              if (next >= 100) setTimeout(onComplete, 220);
              return next;
            });
          }}
          className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-cyan-500/40 text-cyan-200 text-xs font-bold"
        >
          Acelerar Paquetes (+12%)
        </button>
      )}
    </div>
  );
};

// ============================================================================
// 6. STABILIZE STEERING (Tap center alignment crosshair)
// ============================================================================
export const SteeringGame: React.FC<MiniGameProps> = ({ onComplete }) => {
  const [offsetX, setOffsetX] = useState(() => (Math.random() > 0.5 ? 65 : -65));
  const [offsetY, setOffsetY] = useState(() => (Math.random() > 0.5 ? 50 : -50));
  const locked = Math.hypot(offsetX, offsetY) < 16;

  const handleFieldTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const tx = e.clientX - rect.left - cx;
    const ty = e.clientY - rect.top - cy;
    setOffsetX(tx);
    setOffsetY(ty);
    if (Math.hypot(tx, ty) < 18) {
      soundEngine.playClick();
      setOffsetX(0);
      setOffsetY(0);
      setTimeout(onComplete, 320);
    }
  };

  return (
    <div className="space-y-3 text-center">
      <p className="text-xs text-slate-300">Toca el centro exacto de la mira para estabilizar la nave.</p>
      <div
        onClick={handleFieldTap}
        className="relative h-56 rounded-2xl bg-slate-950 border-2 border-cyan-500/40 cursor-crosshair overflow-hidden flex items-center justify-center"
      >
        <div className="w-40 h-40 rounded-full border border-cyan-500/30" />
        <div className="w-12 h-12 rounded-full border-2 border-emerald-400/70 absolute" />
        <div className="w-full h-px bg-cyan-500/20 absolute" />
        <div className="h-full w-px bg-cyan-500/20 absolute" />

        <div
          className={`absolute w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all ${
            locked ? 'border-emerald-400 bg-emerald-400/30' : 'border-rose-400 bg-rose-400/20'
          }`}
          style={{ transform: `translate(${offsetX}px, ${offsetY}px)` }}
        >
          <div className="w-2 h-2 rounded-full bg-white" />
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 7. MEDBAY SCAN (Visual Task!)
// ============================================================================
export const MedScanGame: React.FC<MiniGameProps> = ({ onComplete }) => {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setPct((p) => {
        const next = Math.min(100, p + 5);
        if (next >= 100) {
          window.clearInterval(id);
          setTimeout(onComplete, 300);
        }
        return next;
      });
    }, 180);
    return () => window.clearInterval(id);
  }, [onComplete]);

  return (
    <div className="space-y-4 py-3 text-center">
      <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/15 border-2 border-emerald-400 flex items-center justify-center animate-pulse">
        <Sparkles className="w-9 h-9 text-emerald-300" />
      </div>
      <div className="font-mono text-xs text-emerald-300 space-y-1">
        <div>ESCANEANDO BIOMETRÍA DE TRIPULANTE...</div>
        <div>PULSO: 74 BPM • OXÍGENO: 99% • ADN: VERIFICADO</div>
      </div>
      <div className="h-4 rounded-full bg-slate-950 border border-slate-700 overflow-hidden">
        <div className="h-full bg-emerald-400 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-slate-400">
        Tarea visual: otros jugadores cercanos ven el haz verde de verificación.
      </p>
    </div>
  );
};

// ============================================================================
// 8. PRIME SHIELDS (Tap all red hexagons to activate shields)
// ============================================================================
export const ShieldsGame: React.FC<MiniGameProps> = ({ onComplete }) => {
  const [cells, setCells] = useState<boolean[]>([false, true, false, false, true, false, false]);

  const toggle = (idx: number) => {
    soundEngine.playClick();
    const next = cells.map((v, i) => (i === idx ? true : v));
    setCells(next);
    if (next.every(Boolean)) {
      setTimeout(onComplete, 280);
    }
  };

  return (
    <div className="space-y-4 text-center">
      <p className="text-xs text-slate-300">Activa todos los paneles rojos del generador de escudos.</p>
      <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto">
        {cells.map((active, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => toggle(idx)}
            className={`h-16 rounded-2xl border-2 flex items-center justify-center transition-all ${
              active
                ? 'bg-cyan-400/25 border-cyan-400 text-cyan-200'
                : 'bg-rose-500/30 border-rose-500 text-rose-200 hover:scale-105'
            }`}
          >
            <Shield className="w-6 h-6" />
          </button>
        ))}
      </div>
    </div>
  );
};
