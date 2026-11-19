import { PLAYER_RADIUS } from '../config/gameDefaults';
import type { GameMap, MapRoomZone, Rect } from '../types/game';

export function pointInRect(x: number, y: number, r: Rect, inset = 0): boolean {
  return (
    x >= r.x + inset &&
    x <= r.x + r.w - inset &&
    y >= r.y + inset &&
    y <= r.y + r.h - inset
  );
}

export function circleIntersectsRect(cx: number, cy: number, radius: number, r: Rect): boolean {
  const closestX = Math.max(r.x, Math.min(cx, r.x + r.w));
  const closestY = Math.max(r.y, Math.min(cy, r.y + r.h));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < radius * radius;
}

export function isPointInsideWalkableArea(map: GameMap, x: number, y: number): boolean {
  for (const room of map.rooms) {
    if (pointInRect(x, y, room.rect)) return true;
  }
  for (const corridor of map.corridors) {
    if (pointInRect(x, y, corridor)) return true;
  }
  return false;
}

export function isPositionValid(
  map: GameMap,
  x: number,
  y: number,
  doorsClosedUntil: Record<string, number>,
  now: number,
  isGhost = false,
  radius = PLAYER_RADIUS
): boolean {
  // Keep within map outer bounds
  if (x < radius + 20 || x > map.width - radius - 20 || y < radius + 20 || y > map.height - radius - 20) {
    return false;
  }

  // Ghosts can float across walls and closed doors anywhere inside map bounds
  if (isGhost) {
    return true;
  }

  // Check 4 perimeter + center sample points inside walkable floor union
  const sampleOffset = radius * 0.72;
  const samples: [number, number][] = [
    [x, y],
    [x - sampleOffset, y],
    [x + sampleOffset, y],
    [x, y - sampleOffset],
    [x, y + sampleOffset],
  ];

  for (const [sx, sy] of samples) {
    if (!isPointInsideWalkableArea(map, sx, sy)) {
      return false;
    }
  }

  // Check interior obstacles (tables, crates, pillars)
  for (const wall of map.walls) {
    if (circleIntersectsRect(x, y, radius, wall)) {
      return false;
    }
  }

  // Check currently sealed sabotage doors
  for (const door of map.doors) {
    const closedUntil = doorsClosedUntil[door.id];
    if (closedUntil && closedUntil > now) {
      if (circleIntersectsRect(x, y, radius, door.rect)) {
        return false;
      }
    }
  }

  return true;
}

export function resolveMovement(
  map: GameMap,
  currentX: number,
  currentY: number,
  dx: number,
  dy: number,
  doorsClosedUntil: Record<string, number>,
  now: number,
  isGhost = false
): { x: number; y: number } {
  const targetX = currentX + dx;
  const targetY = currentY + dy;

  if (isPositionValid(map, targetX, targetY, doorsClosedUntil, now, isGhost)) {
    return { x: targetX, y: targetY };
  }

  // Axis-separated smooth sliding
  let nextX = currentX;
  let nextY = currentY;

  if (dx !== 0 && isPositionValid(map, currentX + dx, currentY, doorsClosedUntil, now, isGhost)) {
    nextX = currentX + dx;
  }

  if (dy !== 0 && isPositionValid(map, nextX, currentY + dy, doorsClosedUntil, now, isGhost)) {
    nextY = currentY + dy;
  }

  return { x: nextX, y: nextY };
}

export function getRoomAtPoint(map: GameMap, x: number, y: number): MapRoomZone | null {
  for (const room of map.rooms) {
    if (pointInRect(x, y, room.rect)) {
      return room;
    }
  }
  return null;
}

export function getRoomNameAtPoint(map: GameMap, x: number, y: number): string {
  return getRoomAtPoint(map, x, y)?.name ?? 'Pasillo';
}

export function distanceBetween(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

/**
 * Computes valid spawn ring coordinates around the map's Emergency Table for up to 40 players.
 */
export function getSpawnPositionForIndex(
  map: GameMap,
  index: number,
  total: number
): { x: number; y: number } {
  const count = Math.max(1, total);
  const ringCapacity = 16;
  const ring = Math.floor(index / ringCapacity);
  const indexInRing = index % ringCapacity;
  const itemsInThisRing = Math.min(ringCapacity, count - ring * ringCapacity);
  const baseRadius = 112 + ring * 44;
  const angle = (indexInRing / Math.max(1, itemsInThisRing)) * Math.PI * 2 - Math.PI / 2;

  const candidateX = map.spawnCenter.x + Math.cos(angle) * baseRadius;
  const candidateY = map.spawnCenter.y + Math.sin(angle) * baseRadius;

  if (isPositionValid(map, candidateX, candidateY, {}, 0, false)) {
    return { x: Math.round(candidateX), y: Math.round(candidateY) };
  }

  // Fallback closer to emergency room perimeter
  const fallbackRadius = 98;
  const fx = map.spawnCenter.x + Math.cos(angle) * fallbackRadius;
  const fy = map.spawnCenter.y + Math.sin(angle) * fallbackRadius;
  return { x: Math.round(fx), y: Math.round(fy) };
}
