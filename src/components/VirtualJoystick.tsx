import React, { useRef, useState } from 'react';

interface VirtualJoystickProps {
  onVectorChange: (vec: { x: number; y: number }) => void;
}

const OUTER_RADIUS = 56;
const KNOB_MAX_DIST = 36;

export const VirtualJoystick: React.FC<VirtualJoystickProps> = ({ onVectorChange }) => {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  const updateFromClientPos = (clientX: number, clientY: number) => {
    const el = baseRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, KNOB_MAX_DIST);
    const angle = Math.atan2(dy, dx);
    const kx = dist > 3 ? Math.cos(angle) * clamped : 0;
    const ky = dist > 3 ? Math.sin(angle) * clamped : 0;

    setKnob({ x: kx, y: ky });
    onVectorChange({
      x: dist > 6 ? kx / KNOB_MAX_DIST : 0,
      y: dist > 6 ? ky / KNOB_MAX_DIST : 0,
    });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== null) return;
    pointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    setActive(true);
    updateFromClientPos(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    updateFromClientPos(e.clientX, e.clientY);
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    pointerIdRef.current = null;
    setActive(false);
    setKnob({ x: 0, y: 0 });
    onVectorChange({ x: 0, y: 0 });
  };

  return (
    <div
      ref={baseRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      className={`game-touch-surface relative rounded-full border-2 flex items-center justify-center transition-colors ${
        active
          ? 'bg-slate-900/75 border-cyan-400/80 shadow-lg shadow-cyan-500/20'
          : 'bg-slate-900/45 border-slate-500/45'
      }`}
      style={{
        width: OUTER_RADIUS * 2,
        height: OUTER_RADIUS * 2,
      }}
      aria-label="Joystick de movimiento"
    >
      {/* Subtle directional cross */}
      <div className="w-16 h-px bg-white/10 absolute pointer-events-none" />
      <div className="h-16 w-px bg-white/10 absolute pointer-events-none" />

      {/* Thumb knob */}
      <div
        className={`w-12 h-12 rounded-full border-2 pointer-events-none transition-transform duration-75 ${
          active
            ? 'bg-cyan-400/90 border-white shadow-md shadow-cyan-400/40'
            : 'bg-slate-300/75 border-slate-100/80'
        }`}
        style={{
          transform: `translate(${knob.x}px, ${knob.y}px)`,
        }}
      />
    </div>
  );
};
