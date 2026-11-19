import React, { useState } from 'react';
import { Fingerprint, Radio, Zap } from 'lucide-react';
import { soundEngine } from '../../engine/audio';

interface SabotageFixProps {
  onFixed: () => void;
  o2Code?: string;
}

export const LightsFixGame: React.FC<SabotageFixProps> = ({ onFixed }) => {
  const [switches, setSwitches] = useState<boolean[]>(() => {
    const arr = Array.from({ length: 5 }, () => Math.random() > 0.5);
    if (arr.every(Boolean)) arr[2] = false;
    return arr;
  });

  const flip = (idx: number) => {
    soundEngine.playClick();
    const next = switches.map((v, i) => (i === idx ? !v : v));
    setSwitches(next);
    if (next.every(Boolean)) {
      setTimeout(onFixed, 250);
    }
  };

  return (
    <div className="space-y-4 text-center">
      <p className="text-xs text-amber-200">
        Enciende los 5 interruptores en verde para restaurar la visibilidad eléctrica.
      </p>
      <div className="grid grid-cols-5 gap-2 py-2">
        {switches.map((on, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => flip(idx)}
            className={`h-24 rounded-xl border-2 flex flex-col items-center justify-between p-2 transition ${
              on
                ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300'
                : 'bg-slate-950 border-slate-700 text-slate-500'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span className="text-[10px] font-bold">{on ? 'ON' : 'OFF'}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export const O2FixGame: React.FC<SabotageFixProps> = ({ onFixed, o2Code = '48219' }) => {
  const [input, setInput] = useState('');

  const pressDigit = (d: string) => {
    soundEngine.playClick();
    if (d === 'C') {
      setInput('');
      return;
    }
    const next = (input + d).slice(0, 5);
    setInput(next);
    if (next === o2Code) {
      setTimeout(onFixed, 240);
    } else if (next.length === 5) {
      setTimeout(() => setInput(''), 350);
    }
  };

  return (
    <div className="space-y-3 text-center">
      <div className="inline-block px-4 py-2 rounded-xl bg-amber-200 text-slate-950 font-mono font-bold text-sm shadow -rotate-1">
        CÓDIGO O2: {o2Code}
      </div>
      <div className="py-2.5 px-4 rounded-xl bg-slate-950 border border-emerald-500/40 font-mono text-2xl tracking-[0.35em] text-emerald-300">
        {input.padEnd(5, '_')}
      </div>
      <div className="grid grid-cols-3 gap-2 max-w-[230px] mx-auto">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0'].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => pressDigit(d)}
            className="h-12 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-cyan-500 active:text-slate-950 font-display font-bold text-lg text-white transition"
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  );
};

export const ReactorFixGame: React.FC<SabotageFixProps> = ({ onFixed }) => {
  const [holdPct, setHoldPct] = useState(0);

  const handlePress = () => {
    soundEngine.playClick();
    const next = Math.min(100, holdPct + 34);
    setHoldPct(next);
    if (next >= 100) {
      setTimeout(onFixed, 220);
    }
  };

  return (
    <div className="space-y-4 text-center py-2">
      <p className="text-xs text-rose-200">
        Toca repetidamente el escáner biométrico para estabilizar este panel del Reactor.
      </p>
      <button
        type="button"
        onClick={handlePress}
        className="w-32 h-32 mx-auto rounded-3xl bg-rose-500/20 border-2 border-rose-400 hover:bg-rose-500/30 active:scale-95 flex flex-col items-center justify-center gap-2 transition"
      >
        <Fingerprint className="w-12 h-12 text-rose-300" />
        <span className="font-mono text-sm font-bold text-white">{holdPct}%</span>
      </button>
      <div className="h-3 rounded-full bg-slate-950 overflow-hidden max-w-xs mx-auto">
        <div className="h-full bg-rose-400 transition-all" style={{ width: `${holdPct}%` }} />
      </div>
    </div>
  );
};

export const CommsFixGame: React.FC<SabotageFixProps> = ({ onFixed }) => {
  const [target] = useState(() => 20 + Math.floor(Math.random() * 60));
  const [freq, setFreq] = useState(50);
  const diff = Math.abs(freq - target);

  const handleChange = (v: number) => {
    setFreq(v);
    if (Math.abs(v - target) <= 3) {
      soundEngine.playClick();
      setTimeout(onFixed, 260);
    }
  };

  return (
    <div className="space-y-4 text-center py-2">
      <div className="flex items-center justify-center gap-2 text-purple-300 text-xs font-bold">
        <Radio className="w-4 h-4" />
        Sintoniza la frecuencia hasta alcanzar señal óptima (verde)
      </div>
      <div className="p-4 rounded-xl bg-slate-950 border border-slate-700 space-y-2">
        <div
          className={`text-sm font-mono font-bold ${
            diff <= 5 ? 'text-emerald-400' : diff <= 16 ? 'text-amber-300' : 'text-rose-400'
          }`}
        >
          SEÑAL: {Math.max(0, 100 - diff * 2)}%
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={freq}
          onChange={(e) => handleChange(Number(e.target.value))}
          className="w-full h-8 accent-purple-400"
        />
      </div>
    </div>
  );
};
