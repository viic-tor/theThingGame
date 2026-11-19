import { describe, expect, it } from 'vitest';
import { getRoomNameAtPoint, isPositionValid, resolveMovement } from '../engine/collision';
import { AEGIS_STATION_MAP } from '../maps/aegisStation';

describe('Motor de colisiones y puertas selladas', () => {
  it('identifica correctamente la sala actual o pasillo', () => {
    expect(getRoomNameAtPoint(AEGIS_STATION_MAP, 1200, 260)).toBe('Cafetería');
    expect(getRoomNameAtPoint(AEGIS_STATION_MAP, 240, 960)).toBe('Reactor');
    expect(getRoomNameAtPoint(AEGIS_STATION_MAP, 850, 400)).toBe('Pasillo');
  });

  it('bloquea jugadores vivos ante puertas selladas pero permite cruzar a fantasmas', () => {
    const door = AEGIS_STATION_MAP.doors[0];
    const now = Date.now();
    const closedDoors = { [door.id]: now + 10_000 };
    const cx = door.rect.x + door.rect.w / 2;
    const cy = door.rect.y + door.rect.h / 2;

    expect(isPositionValid(AEGIS_STATION_MAP, cx, cy, closedDoors, now, false)).toBe(false);
    expect(isPositionValid(AEGIS_STATION_MAP, cx, cy, closedDoors, now, true)).toBe(true);
  });

  it('desliza suavemente a lo largo de los límites de las salas', () => {
    const startX = 1220;
    const startY = 200;
    const moved = resolveMovement(AEGIS_STATION_MAP, startX, startY, 12, -100, {}, 0, false);
    // Y blocked by top cafeteria wall, X still slides smoothly
    expect(moved.x).toBeGreaterThan(startX);
    expect(moved.y).toBe(startY);
  });
});
