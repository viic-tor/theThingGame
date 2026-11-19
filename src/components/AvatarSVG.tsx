import React from 'react';
import { getColorOption } from '../config/cosmetics';
import type { PlayerCosmetics } from '../types/game';

interface AvatarSVGProps {
  cosmetics: PlayerCosmetics;
  size?: number;
  dead?: boolean;
  className?: string;
}

export const AvatarSVG: React.FC<AvatarSVGProps> = ({
  cosmetics,
  size = 56,
  dead = false,
  className = '',
}) => {
  const color = getColorOption(cosmetics.color);

  return (
    <svg
      width={size}
      height={size}
      viewBox="-34 -44 68 78"
      className={`shrink-0 ${dead ? 'opacity-50 grayscale-[35%]' : ''} ${className}`}
      aria-hidden="true"
    >
      {/* Shadow */}
      <ellipse cx="0" cy="24" rx="17" ry="5" fill="rgba(0,0,0,0.35)" />

      {/* Backpack */}
      <rect
        x="-23"
        y="-7"
        width="10"
        height="22"
        rx="5"
        fill={color.shadow}
        stroke="#090d16"
        strokeWidth="2.8"
      />

      {/* Legs */}
      <rect
        x="-12"
        y="11"
        width="9"
        height="12"
        rx="4"
        fill={color.shadow}
        stroke="#090d16"
        strokeWidth="2.8"
      />
      <rect
        x="3"
        y="11"
        width="9"
        height="12"
        rx="4"
        fill={color.primary}
        stroke="#090d16"
        strokeWidth="2.8"
      />

      {/* Body */}
      <rect
        x="-15"
        y="-20"
        width="30"
        height="35"
        rx="14"
        fill={color.primary}
        stroke="#090d16"
        strokeWidth="2.8"
      />
      <ellipse cx="-4" cy="-12" rx="7" ry="4" fill={color.highlight} opacity="0.28" />

      {/* Suit */}
      {cosmetics.skin === 'captain' && (
        <>
          <rect x="-13" y="2" width="26" height="11" rx="3" fill="#f8fafc" />
          <rect x="-13" y="2" width="26" height="3" fill="#eab308" />
        </>
      )}
      {cosmetics.skin === 'labcoat' && (
        <>
          <rect x="-13" y="1" width="26" height="12" rx="3" fill="#f1f5f9" />
          <line x1="0" y1="1" x2="0" y2="13" stroke="#38bdf8" strokeWidth="1.8" />
        </>
      )}
      {cosmetics.skin === 'armor' && (
        <>
          <rect x="-13" y="1" width="26" height="12" rx="3" fill="#475569" />
          <rect x="-5" y="4" width="10" height="4" fill="#38bdf8" />
        </>
      )}
      {cosmetics.skin === 'tuxedo' && (
        <>
          <rect x="-13" y="1" width="26" height="12" rx="3" fill="#0f172a" />
          <polygon points="-4,1 4,1 0,9" fill="#ffffff" />
          <rect x="-3" y="2" width="6" height="3" fill="#ef4444" />
        </>
      )}
      {cosmetics.skin === 'engineer' && (
        <>
          <rect x="-13" y="2" width="26" height="11" rx="3" fill="#f97316" />
          <rect x="-13" y="5" width="26" height="2.5" fill="#fef08a" />
        </>
      )}
      {cosmetics.skin === 'tactical' && (
        <>
          <rect x="-13" y="1" width="26" height="12" rx="3" fill="#1e293b" />
          <rect x="-9" y="4" width="6" height="5" fill="#64748b" />
          <rect x="3" y="4" width="6" height="5" fill="#64748b" />
        </>
      )}
      {cosmetics.skin === 'pilot' && (
        <>
          <rect x="-13" y="1" width="26" height="12" rx="3" fill="#7c2d12" />
          <rect x="-12" y="1" width="24" height="3" fill="#fbbf24" />
        </>
      )}

      {/* Visor */}
      <rect
        x="-2"
        y="-13"
        width="19"
        height="11"
        rx="5"
        fill={
          cosmetics.visor === 'sunglasses'
            ? '#090d16'
            : cosmetics.visor === 'cyber' || cosmetics.visor === 'laser'
              ? '#0f172a'
              : '#7dd3fc'
        }
        stroke="#090d16"
        strokeWidth="2.4"
      />
      {cosmetics.visor === 'cyber' && <rect x="0" y="-9" width="15" height="3" fill="#22d3ee" />}
      {cosmetics.visor === 'laser' && <rect x="0" y="-9" width="15" height="3" fill="#ef4444" />}
      {cosmetics.visor !== 'cyber' && cosmetics.visor !== 'laser' && (
        <ellipse cx="9" cy="-9.5" rx="4.5" ry="2" fill="#e0f2fe" opacity="0.7" />
      )}
      {cosmetics.visor === 'eyepatch' && <rect x="6" y="-12" width="8" height="9" fill="#0f172a" />}
      {cosmetics.visor === 'goggles' && (
        <g stroke="#fbbf24" strokeWidth="2" fill="none">
          <circle cx="4" cy="-7.5" r="4" />
          <circle cx="12" cy="-7.5" r="4" />
        </g>
      )}
      {cosmetics.visor === 'monocle' && (
        <circle cx="11" cy="-7.5" r="4.5" stroke="#f59e0b" strokeWidth="1.8" fill="none" />
      )}
      {cosmetics.visor === 'scar' && (
        <line x1="9" y1="-12" x2="13" y2="-3" stroke="#f43f5e" strokeWidth="2" />
      )}

      {/* Hat */}
      {cosmetics.hat === 'crown' && (
        <polygon
          points="-10,-19 -12,-32 -4,-25 0,-34 4,-25 12,-32 10,-19"
          fill="#fbbf24"
          stroke="#090d16"
          strokeWidth="2"
        />
      )}
      {cosmetics.hat === 'captain' && (
        <g>
          <rect x="-13" y="-30" width="26" height="10" rx="4" fill="#f8fafc" stroke="#090d16" strokeWidth="2" />
          <rect x="-10" y="-22" width="25" height="4" fill="#1e293b" />
          <circle cx="2" cy="-25" r="2.5" fill="#fbbf24" />
        </g>
      )}
      {cosmetics.hat === 'halo' && (
        <ellipse cx="0" cy="-29" rx="11" ry="3.8" fill="none" stroke="#fde047" strokeWidth="3" />
      )}
      {cosmetics.hat === 'horns' && (
        <g fill="#ef4444" stroke="#090d16" strokeWidth="2">
          <polygon points="-10,-18 -16,-32 -4,-20" />
          <polygon points="10,-18 16,-32 4,-20" />
        </g>
      )}
      {cosmetics.hat === 'leaf' && (
        <g>
          <line x1="0" y1="-20" x2="0" y2="-30" stroke="#22c55e" strokeWidth="2.6" />
          <ellipse cx="-6" cy="-29" rx="6" ry="3" fill="#4ade80" transform="rotate(-22 -6 -29)" />
          <ellipse cx="6" cy="-30" rx="6" ry="3" fill="#4ade80" transform="rotate(22 6 -30)" />
        </g>
      )}
      {cosmetics.hat === 'tophat' && (
        <g>
          <rect x="-14" y="-22" width="28" height="4" fill="#0f172a" />
          <rect x="-9" y="-38" width="18" height="16" fill="#0f172a" stroke="#090d16" strokeWidth="2" />
          <rect x="-9" y="-26" width="18" height="3" fill="#ef4444" />
        </g>
      )}
      {cosmetics.hat === 'cat' && (
        <g fill="#f472b6" stroke="#090d16" strokeWidth="2">
          <polygon points="-11,-18 -9,-31 -2,-20" />
          <polygon points="11,-18 9,-31 2,-20" />
        </g>
      )}
      {cosmetics.hat === 'antenna' && (
        <g>
          <line x1="0" y1="-20" x2="0" y2="-33" stroke="#94a3b8" strokeWidth="2.4" />
          <circle cx="0" cy="-34" r="4" fill="#22d3ee" stroke="#090d16" strokeWidth="1.5" />
        </g>
      )}
      {cosmetics.hat === 'ninja' && (
        <g fill="#dc2626">
          <rect x="-14" y="-19" width="28" height="5" />
          <polygon points="-14,-17 -23,-13 -19,-20" />
        </g>
      )}
      {cosmetics.hat === 'viking' && (
        <g>
          <path d="M -13 -18 A 13 13 0 0 1 13 -18 Z" fill="#64748b" stroke="#090d16" strokeWidth="2" />
          <polygon points="-12,-21 -21,-30 -10,-26" fill="#f8fafc" stroke="#090d16" strokeWidth="1.5" />
          <polygon points="12,-21 21,-30 10,-26" fill="#f8fafc" stroke="#090d16" strokeWidth="1.5" />
        </g>
      )}
      {cosmetics.hat === 'astronaut' && (
        <circle cx="1" cy="-10" r="21" fill="rgba(186,230,253,0.16)" stroke="rgba(224,242,254,0.85)" strokeWidth="2" />
      )}

      {/* Pet indicator badge */}
      {cosmetics.pet !== 'none' && (
        <g transform="translate(21, 14)">
          <circle
            cx="0"
            cy="0"
            r="7"
            fill={
              cosmetics.pet === 'slime'
                ? '#4ade80'
                : cosmetics.pet === 'drone'
                  ? '#38bdf8'
                  : cosmetics.pet === 'cat'
                    ? '#f8fafc'
                    : cosmetics.pet === 'robodog'
                      ? '#94a3b8'
                      : color.primary
            }
            stroke="#090d16"
            strokeWidth="2"
          />
          <circle cx="2" cy="-1" r="2" fill="#090d16" />
        </g>
      )}

      {/* Dead X overlay */}
      {dead && (
        <g stroke="#ef4444" strokeWidth="4" strokeLinecap="round">
          <line x1="-18" y1="-16" x2="18" y2="18" />
          <line x1="18" y1="-16" x2="-18" y2="18" />
        </g>
      )}
    </svg>
  );
};
