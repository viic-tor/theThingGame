import type { GameMap, MapId } from '../types/game';
import { AEGIS_STATION_MAP } from './aegisStation';
import { BOREALIS_BASE_MAP } from './borealisBase';
import { SOLARIS_AIRSHIP_MAP } from './solarisAirship';

export const MAPS: Record<MapId, GameMap> = {
  aegis: AEGIS_STATION_MAP,
  borealis: BOREALIS_BASE_MAP,
  solaris: SOLARIS_AIRSHIP_MAP,
};

export const MAP_LIST: GameMap[] = [
  AEGIS_STATION_MAP,
  BOREALIS_BASE_MAP,
  SOLARIS_AIRSHIP_MAP,
];

export function getMapById(mapId: MapId): GameMap {
  return MAPS[mapId] ?? AEGIS_STATION_MAP;
}
