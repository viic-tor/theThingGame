import React, { useState } from 'react';
import { Check, Save, Sparkles, X } from 'lucide-react';
import {
  AVATAR_COLORS,
  AVATAR_HATS,
  AVATAR_PETS,
  AVATAR_SKINS,
  AVATAR_VISORS,
} from '../config/cosmetics';
import type { PlayerCosmetics, UserProfile } from '../types/game';
import { AvatarSVG } from './AvatarSVG';

interface CustomizerModalProps {
  profile: UserProfile;
  onSave: (username: string, cosmetics: PlayerCosmetics) => Promise<void>;
  onClose: () => void;
}

type CustomTab = 'color' | 'hat' | 'visor' | 'skin' | 'pet';

export const CustomizerModal: React.FC<CustomizerModalProps> = ({
  profile,
  onSave,
  onClose,
}) => {
  const [username, setUsername] = useState(profile.username);
  const [cosmetics, setCosmetics] = useState<PlayerCosmetics>({ ...profile.cosmetics });
  const [tab, setTab] = useState<CustomTab>('color');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      await onSave(username, cosmetics);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const tabs: { id: CustomTab; label: string }[] = [
    { id: 'color', label: 'Color' },
    { id: 'hat', label: 'Sombrero' },
    { id: 'visor', label: 'Visor' },
    { id: 'skin', label: 'Traje' },
    { id: 'pet', label: 'Mascota' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92dvh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <h2 className="font-display text-xl font-bold text-white">Personalizar Personaje</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preview + Name */}
        <div className="p-4 sm:p-5 bg-slate-950/60 border-b border-slate-800 flex flex-col sm:flex-row items-center gap-4">
          <div className="w-28 h-28 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-950 border border-slate-700 flex items-center justify-center shrink-0">
            <AvatarSVG cosmetics={cosmetics} size={92} />
          </div>
          <div className="w-full space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Nombre visible en partida
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              minLength={2}
              maxLength={24}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-cyan-400 focus:outline-none text-white text-sm font-semibold"
            />
            <p className="text-[11px] text-slate-400">
              Los cambios se guardan en tu perfil y se mantienen automáticamente en todas tus partidas.
            </p>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-1.5 px-4 pt-3 overflow-x-auto border-b border-slate-800 pb-3">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition min-h-[38px] ${
                tab === t.id
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Options Grid */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1">
          {tab === 'color' && (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5">
              {AVATAR_COLORS.map((c) => {
                const selected = cosmetics.color === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCosmetics((prev) => ({ ...prev, color: c.id }))}
                    className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition ${
                      selected
                        ? 'bg-slate-800 border-cyan-400 ring-2 ring-cyan-400/30'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <span
                      className="w-9 h-9 rounded-full border-2 border-slate-950 flex items-center justify-center shadow-inner"
                      style={{ backgroundColor: c.primary }}
                    >
                      {selected && <Check className="w-4 h-4 text-white drop-shadow" />}
                    </span>
                    <span className="text-[11px] font-medium text-slate-200 truncate w-full text-center">
                      {c.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {tab === 'hat' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {AVATAR_HATS.map((item) => {
                const selected = cosmetics.hat === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCosmetics((prev) => ({ ...prev, hat: item.id }))}
                    className={`p-3 rounded-xl border flex items-center gap-2.5 text-left transition ${
                      selected
                        ? 'bg-slate-800 border-cyan-400'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <AvatarSVG cosmetics={{ ...cosmetics, hat: item.id }} size={40} />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{item.label}</div>
                      {item.badge && (
                        <span className="text-[10px] font-bold text-amber-300">{item.badge}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {tab === 'visor' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {AVATAR_VISORS.map((item) => {
                const selected = cosmetics.visor === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCosmetics((prev) => ({ ...prev, visor: item.id }))}
                    className={`p-3 rounded-xl border flex items-center gap-2.5 text-left transition ${
                      selected
                        ? 'bg-slate-800 border-cyan-400'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <AvatarSVG cosmetics={{ ...cosmetics, visor: item.id }} size={40} />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{item.label}</div>
                      {item.badge && (
                        <span className="text-[10px] font-bold text-cyan-300">{item.badge}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {tab === 'skin' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {AVATAR_SKINS.map((item) => {
                const selected = cosmetics.skin === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCosmetics((prev) => ({ ...prev, skin: item.id }))}
                    className={`p-3 rounded-xl border flex items-center gap-2.5 text-left transition ${
                      selected
                        ? 'bg-slate-800 border-cyan-400'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <AvatarSVG cosmetics={{ ...cosmetics, skin: item.id }} size={40} />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{item.label}</div>
                      {item.badge && (
                        <span className="text-[10px] font-bold text-cyan-300">{item.badge}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {tab === 'pet' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {AVATAR_PETS.map((item) => {
                const selected = cosmetics.pet === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCosmetics((prev) => ({ ...prev, pet: item.id }))}
                    className={`p-3 rounded-xl border flex items-center gap-2.5 text-left transition ${
                      selected
                        ? 'bg-slate-800 border-cyan-400'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <AvatarSVG cosmetics={{ ...cosmetics, pet: item.id }} size={40} />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{item.label}</div>
                      {item.badge && (
                        <span className="text-[10px] font-bold text-emerald-300">{item.badge}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 space-y-2">
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm min-h-[46px]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-[2] py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-display font-bold text-sm flex items-center justify-center gap-2 min-h-[46px]"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Guardando...' : 'Guardar en Perfil'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
