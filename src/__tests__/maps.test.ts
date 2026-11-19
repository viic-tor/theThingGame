import { describe, expect, it } from 'vitest';
import { getSpawnPositionForIndex, isPointInsideWalkableArea, isPositionValid } from '../engine/collision';
import { MAP_LIST } from '../maps';
import type { GameMap } from '../types/game';

/**
 * Grid BFS reachability proof from a walkable start point near spawnCenter.
 */
function computeReachableGrid(map: GameMap, cellSize = 20): Set<string> {
  const start = getSpawnPositionForIndex(map, 0, 1);
  const sx = Math.round(start.x / cellSize);
  const sy = Math.round(start.y / cellSize);
  const visited = new Set<string>();
  const queue: [number, number][] = [[sx, sy]];
  visited.add(`${sx},${sy}`);

  while (queue.length > 0) {
    const [cx, cy] = queue.shift()!;
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;
      const wx = nx * cellSize;
      const wy = ny * cellSize;
      if (isPositionValid(map, wx, wy, {}, 0, false, 12)) {
        visited.add(key);
        queue.push([nx, ny]);
      }
    }
  }
  return visited;
}

function isNearReachable(visited: Set<string>, x: number, y: number, cellSize = 20): boolean {
  const gx = Math.round(x / cellSize);
  const gy = Math.round(y / cellSize);
  for (let dx = -3; dx <= 3; dx++) {
    for (let dy = -3; dy <= 3; dy++) {
      if (visited.has(`${gx + dx},${gy + dy}`)) return true;
    }
  }
  return false;
}

describe('Integridad geométrica y navegabilidad de los 3 mapas', () => {
  it('incluye al menos 3 mapas distintos', () => {
    expect(MAP_LIST.length).toBeGreaterThanOrEqual(3);
    const ids = new Set(MAP_LIST.map((m) => m.id));
    expect(ids.size).toBe(MAP_LIST.length);
  });

  for (const map of MAP_LIST) {
    describe(`Mapa: ${map.name} (${map.id})`, () => {
      const reachable = computeReachableGrid(map, 20);

      it('tiene al menos 10 salas, 12 tareas, 4 cámaras y los 4 tipos de sabotaje', () => {
        expect(map.rooms.length).toBeGreaterThanOrEqual(10);
        expect(map.taskStations.length).toBeGreaterThanOrEqual(12);
        expect(map.cameras.length).toBeGreaterThanOrEqual(4);
        const sabTypes = new Set(map.sabotageStations.map((s) => s.sabotageType));
        expect(sabTypes.has('reactor')).toBe(true);
        expect(sabTypes.has('o2')).toBe(true);
        expect(sabTypes.has('lights')).toBe(true);
        expect(sabTypes.has('comms')).toBe(true);
      });

      it('los 40 puntos de spawn alrededor de la mesa son caminables', () => {
        for (let i = 0; i < 40; i++) {
          const sp = getSpawnPositionForIndex(map, i, 40);
          expect(isPositionValid(map, sp.x, sp.y, {}, 0, false)).toBe(true);
        }
      });

      it('todas las estaciones de tareas son alcanzables caminando desde el spawn', () => {
        for (const task of map.taskStations) {
          expect(isPointInsideWalkableArea(map, task.x, task.y)).toBe(true);
          expect(isNearReachable(reachable, task.x, task.y)).toBe(true);
        }
      });

      it('todos los conductos (vents) son alcanzables y tienen enlaces válidos', () => {
        const ventIds = new Set(map.vents.map((v) => v.id));
        for (const vent of map.vents) {
          expect(isNearReachable(reachable, vent.x, vent.y)).toBe(true);
          expect(vent.linksTo.length).toBeGreaterThan(0);
          for (const targetId of vent.linksTo) {
            expect(ventIds.has(targetId)).toBe(true);
          }
        }
      });

      it('todas las estaciones de sabotaje, admin y cámaras son alcanzables', () => {
        for (const sab of map.sabotageStations) {
          expect(isNearReachable(reachable, sab.x, sab.y)).toBe(true);
        }
        expect(isNearReachable(reachable, map.adminTable.x, map.adminTable.y)).toBe(true);
        expect(isNearReachable(reachable, map.securityConsole.x, map.securityConsole.y)).toBe(true);
      });
    });
  }
});
