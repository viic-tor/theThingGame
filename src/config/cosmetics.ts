import type { PlayerCosmetics } from '../types/game';

export interface ColorOption {
  id: string;
  label: string;
  primary: string;
  shadow: string;
  highlight: string;
}

export interface CosmeticItem {
  id: string;
  label: string;
  badge?: string;
}

export const AVATAR_COLORS: ColorOption[] = [
  { id: 'red', label: 'Rojo', primary: '#dc2626', shadow: '#991b1b', highlight: '#f87171' },
  { id: 'blue', label: 'Azul', primary: '#2563eb', shadow: '#1e3a8a', highlight: '#60a5fa' },
  { id: 'green', label: 'Verde', primary: '#15803d', shadow: '#14532d', highlight: '#4ade80' },
  { id: 'pink', label: 'Rosa', primary: '#ec4899', shadow: '#9d174d', highlight: '#f9a8d4' },
  { id: 'orange', label: 'Naranja', primary: '#f97316', shadow: '#9a3412', highlight: '#fdba74' },
  { id: 'yellow', label: 'Amarillo', primary: '#eab308', shadow: '#854d0e', highlight: '#fde047' },
  { id: 'black', label: 'Obsidiana', primary: '#334155', shadow: '#0f172a', highlight: '#64748b' },
  { id: 'white', label: 'Blanco', primary: '#e2e8f0', shadow: '#94a3b8', highlight: '#ffffff' },
  { id: 'purple', label: 'Morado', primary: '#7e22ce', shadow: '#4c1d95', highlight: '#c084fc' },
  { id: 'brown', label: 'Marrón', primary: '#92400e', shadow: '#451a03', highlight: '#d97706' },
  { id: 'cyan', label: 'Cian', primary: '#06b6d4', shadow: '#155e75', highlight: '#67e8f9' },
  { id: 'lime', label: 'Lima', primary: '#65a30d', shadow: '#365314', highlight: '#bef264' },
  { id: 'maroon', label: 'Granate', primary: '#881337', shadow: '#4c0519', highlight: '#fb7185' },
  { id: 'rose', label: 'Pastel', primary: '#f472b6', shadow: '#be185d', highlight: '#fbcfe8' },
  { id: 'banana', label: 'Banana', primary: '#fef08a', shadow: '#ca8a04', highlight: '#fef9c3' },
  { id: 'gray', label: 'Titanio', primary: '#64748b', shadow: '#334155', highlight: '#cbd5e1' },
  { id: 'coral', label: 'Coral', primary: '#fb7185', shadow: '#be123c', highlight: '#fecdd3' },
  { id: 'indigo', label: 'Índigo', primary: '#4f46e5', shadow: '#312e81', highlight: '#818cf8' },
  { id: 'emerald', label: 'Esmeralda', primary: '#10b981', shadow: '#065f46', highlight: '#6ee7b7' },
  { id: 'gold', label: 'Dorado', primary: '#d97706', shadow: '#78350f', highlight: '#fcd34d' },
];

export const AVATAR_HATS: CosmeticItem[] = [
  { id: 'none', label: 'Sin sombrero' },
  { id: 'crown', label: 'Corona Real', badge: 'VIP' },
  { id: 'captain', label: 'Gorra Capitán' },
  { id: 'halo', label: 'Halo Angelical' },
  { id: 'horns', label: 'Cuernos', badge: 'SUS' },
  { id: 'leaf', label: 'Brote Espacial' },
  { id: 'tophat', label: 'Sombrero Copa' },
  { id: 'cat', label: 'Orejas Gato' },
  { id: 'antenna', label: 'Antena Alien' },
  { id: 'ninja', label: 'Bandana Ninja' },
  { id: 'viking', label: 'Casco Vikingo' },
  { id: 'astronaut', label: 'Casco Lunar' },
];

export const AVATAR_VISORS: CosmeticItem[] = [
  { id: 'classic', label: 'Cristal Clásico' },
  { id: 'sunglasses', label: 'Gafas Negras' },
  { id: 'cyber', label: 'Visor Cyber', badge: 'AU2' },
  { id: 'eyepatch', label: 'Parche Pirata' },
  { id: 'goggles', label: 'Gafas Científico' },
  { id: 'laser', label: 'Ojos Láser' },
  { id: 'monocle', label: 'Monóculo' },
  { id: 'scar', label: 'Cicatriz' },
];

export const AVATAR_SKINS: CosmeticItem[] = [
  { id: 'default', label: 'Traje Base' },
  { id: 'captain', label: 'Uniforme Capitán' },
  { id: 'labcoat', label: 'Bata Científica' },
  { id: 'armor', label: 'Armadura Aegis', badge: 'AU2' },
  { id: 'tuxedo', label: 'Esmoquin' },
  { id: 'engineer', label: 'Chaleco Técnico' },
  { id: 'tactical', label: 'Traje Táctico' },
  { id: 'pilot', label: 'Piloto Solaris' },
];

export const AVATAR_PETS: CosmeticItem[] = [
  { id: 'none', label: 'Sin mascota' },
  { id: 'mini', label: 'Mini Tripulante' },
  { id: 'drone', label: 'Dron Orbital', badge: 'AU2' },
  { id: 'cat', label: 'Gato Lunar' },
  { id: 'slime', label: 'Slime Alien' },
  { id: 'robodog', label: 'Perro Robot' },
];

export const DEFAULT_COSMETICS: PlayerCosmetics = {
  color: 'cyan',
  hat: 'none',
  visor: 'classic',
  skin: 'default',
  pet: 'none',
};

export function getColorOption(colorId: string): ColorOption {
  return AVATAR_COLORS.find((c) => c.id === colorId) ?? AVATAR_COLORS[0];
}

export function randomBotCosmetics(seedIndex: number): PlayerCosmetics {
  const color = AVATAR_COLORS[seedIndex % AVATAR_COLORS.length].id;
  const hat = AVATAR_HATS[(seedIndex * 3 + 1) % AVATAR_HATS.length].id;
  const visor = AVATAR_VISORS[(seedIndex * 5) % AVATAR_VISORS.length].id;
  const skin = AVATAR_SKINS[(seedIndex * 2) % AVATAR_SKINS.length].id;
  const pet = seedIndex % 3 === 0 ? AVATAR_PETS[(seedIndex % (AVATAR_PETS.length - 1)) + 1].id : 'none';
  return { color, hat, visor, skin, pet };
}
