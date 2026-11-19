import { getColorOption } from '../config/cosmetics';
import type {
  DeadBody,
  GameMap,
  GameState,
  PlayerCosmetics,
  RoomPlayer,
  RoomSettings,
} from '../types/game';
import { distanceBetween } from './collision';

export interface RenderContextOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  map: GameMap;
  players: RoomPlayer[];
  localPlayer: RoomPlayer;
  gameState: GameState;
  settings: RoomSettings;
  now: number;
  killTargetId: string | null;
  cameraOverride?: { x: number; y: number; label: string } | null;
}

export function getEffectiveVisionRadius(
  viewer: RoomPlayer,
  gameState: GameState,
  settings: RoomSettings
): number {
  if (!viewer.isAlive) return 9999; // Ghosts have full vision
  const baseRadius = 330;
  if (viewer.role === 'impostor') {
    return baseRadius * settings.impostorVision;
  }
  const lightsOut = gameState.activeSabotage?.type === 'lights';
  return baseRadius * settings.crewVision * (lightsOut ? 0.42 : 1.0);
}

export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cosmetics: PlayerCosmetics,
  facing: 'left' | 'right',
  isMoving: boolean,
  isGhost: boolean,
  now: number,
  scale = 1
): void {
  const color = getColorOption(cosmetics.color);
  const dir = facing === 'left' ? -1 : 1;
  const walkPhase = isMoving ? Math.sin(now * 0.016) : 0;
  const bob = isMoving ? Math.abs(Math.sin(now * 0.016)) * 2.5 : Math.sin(now * 0.004) * 0.8;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  if (isGhost) {
    ctx.globalAlpha = 0.48;
  }

  // Ground shadow
  if (!isGhost) {
    ctx.fillStyle = 'rgba(0,0,0,0.36)';
    ctx.beginPath();
    ctx.ellipse(0, 21, 16, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Pet companion trailing behind
  if (cosmetics.pet !== 'none' && !isGhost) {
    drawPet(ctx, -dir * 30, 12 + Math.sin(now * 0.008) * 2.5, cosmetics.pet, color.primary, now);
  }

  ctx.save();
  ctx.scale(dir, 1);
  ctx.translate(0, -bob);

  // Backpack
  ctx.fillStyle = color.shadow;
  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = 2.6;
  roundRect(ctx, -21, -8, 10, 22, 5);
  ctx.fill();
  ctx.stroke();

  // Legs (or ethereal ghost tail)
  if (!isGhost) {
    ctx.fillStyle = color.shadow;
    const leftLegY = 10 + walkPhase * 4.5;
    const rightLegY = 10 - walkPhase * 4.5;

    roundRect(ctx, -11, leftLegY, 9, 11, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = color.primary;
    roundRect(ctx, 2, rightLegY, 9, 11, 4);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillStyle = color.primary;
    ctx.beginPath();
    ctx.moveTo(-14, 6);
    ctx.quadraticCurveTo(-8, 22 + Math.sin(now * 0.01) * 3, 0, 15);
    ctx.quadraticCurveTo(8, 22 - Math.sin(now * 0.01) * 3, 14, 6);
    ctx.closePath();
    ctx.fill();
  }

  // Main body bean
  ctx.fillStyle = color.primary;
  roundRect(ctx, -14, -20, 28, 34, 13);
  ctx.fill();

  // Subtle top highlight
  ctx.fillStyle = color.highlight;
  ctx.globalAlpha = isGhost ? 0.16 : 0.25;
  ctx.beginPath();
  ctx.ellipse(-3, -12, 8, 5, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = isGhost ? 0.48 : 1;

  // Body outline
  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = 2.8;
  roundRect(ctx, -14, -20, 28, 34, 13);
  ctx.stroke();

  // Suit / Skin overlay on torso
  drawSuit(ctx, cosmetics.skin);

  // Visor
  drawVisor(ctx, cosmetics.visor);

  // Hat
  drawHat(ctx, cosmetics.hat, now);

  ctx.restore();
  ctx.restore();
}

function drawSuit(ctx: CanvasRenderingContext2D, skin: string): void {
  if (skin === 'default') return;
  ctx.save();
  if (skin === 'captain') {
    ctx.fillStyle = '#f8fafc';
    roundRect(ctx, -12, 1, 24, 11, 3);
    ctx.fill();
    ctx.fillStyle = '#eab308';
    ctx.fillRect(-12, 1, 24, 3);
    ctx.fillRect(-3, 5, 6, 4);
  } else if (skin === 'labcoat') {
    ctx.fillStyle = '#f1f5f9';
    roundRect(ctx, -12, 0, 24, 13, 3);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 13);
    ctx.stroke();
  } else if (skin === 'armor') {
    ctx.fillStyle = '#475569';
    roundRect(ctx, -13, 0, 26, 12, 3);
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-5, 3, 10, 4);
  } else if (skin === 'tuxedo') {
    ctx.fillStyle = '#0f172a';
    roundRect(ctx, -12, 0, 24, 13, 3);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(4, 0);
    ctx.lineTo(0, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-3, 1, 6, 3);
  } else if (skin === 'engineer') {
    ctx.fillStyle = '#f97316';
    roundRect(ctx, -12, 1, 24, 11, 3);
    ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(-12, 4, 24, 2.5);
    ctx.fillRect(-12, 8.5, 24, 2);
  } else if (skin === 'tactical') {
    ctx.fillStyle = '#1e293b';
    roundRect(ctx, -12, 0, 24, 12, 3);
    ctx.fill();
    ctx.fillStyle = '#64748b';
    ctx.fillRect(-9, 3, 6, 5);
    ctx.fillRect(3, 3, 6, 5);
  } else if (skin === 'pilot') {
    ctx.fillStyle = '#7c2d12';
    roundRect(ctx, -12, 0, 24, 12, 3);
    ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-11, 0, 22, 3);
  }
  ctx.restore();
}

function drawVisor(ctx: CanvasRenderingContext2D, visor: string): void {
  ctx.save();
  // Base glass visor
  const vx = -2;
  const vy = -13;
  const vw = 18;
  const vh = 11;

  if (visor === 'cyber') {
    ctx.fillStyle = '#0f172a';
    roundRect(ctx, vx, vy, vw, vh, 5);
    ctx.fill();
    ctx.fillStyle = '#22d3ee';
    ctx.fillRect(vx + 2, vy + 4, vw - 4, 3);
  } else if (visor === 'sunglasses') {
    ctx.fillStyle = '#090d16';
    roundRect(ctx, vx, vy + 1, vw, vh - 1, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(vx + 3, vy + 2.5, 5, 2);
  } else if (visor === 'laser') {
    ctx.fillStyle = '#1e293b';
    roundRect(ctx, vx, vy, vw, vh, 5);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 8;
    ctx.fillRect(vx + 2, vy + 4, vw - 3, 3);
    ctx.shadowBlur = 0;
  } else {
    // Classic glass base
    ctx.fillStyle = '#7dd3fc';
    roundRect(ctx, vx, vy, vw, vh, 5.5);
    ctx.fill();
    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.ellipse(vx + 10, vy + 3.5, 5, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = 2.2;
  roundRect(ctx, vx, vy, vw, vh, 5);
  ctx.stroke();

  if (visor === 'eyepatch') {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(vx + 7, vy + 1, 8, 9);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(vx - 1, vy + 2);
    ctx.lineTo(vx + 16, vy + 6);
    ctx.stroke();
  } else if (visor === 'goggles') {
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(vx + 5, vy + 5.5, 4.2, 0, Math.PI * 2);
    ctx.arc(vx + 13, vy + 5.5, 4.2, 0, Math.PI * 2);
    ctx.stroke();
  } else if (visor === 'monocle') {
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(vx + 12, vy + 5.5, 4.5, 0, Math.PI * 2);
    ctx.stroke();
  } else if (visor === 'scar') {
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(vx + 10, vy + 1);
    ctx.lineTo(vx + 14, vy + 10);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHat(ctx: CanvasRenderingContext2D, hat: string, now: number): void {
  if (hat === 'none') return;
  ctx.save();
  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = 2;

  switch (hat) {
    case 'crown':
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(-10, -19);
      ctx.lineTo(-12, -31);
      ctx.lineTo(-4, -25);
      ctx.lineTo(0, -33);
      ctx.lineTo(4, -25);
      ctx.lineTo(12, -31);
      ctx.lineTo(10, -19);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case 'captain':
      ctx.fillStyle = '#f8fafc';
      roundRect(ctx, -13, -29, 26, 10, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-10, -21, 25, 4);
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(2, -24, 2.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'halo':
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, -28 + Math.sin(now * 0.006) * 1.5, 11, 3.8, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'horns':
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(-10, -18);
      ctx.lineTo(-16, -31);
      ctx.lineTo(-4, -20);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(10, -18);
      ctx.lineTo(16, -31);
      ctx.lineTo(4, -20);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case 'leaf':
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.lineTo(0, -29);
      ctx.stroke();
      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.ellipse(-6, -28, 6, 3.2, -0.4, 0, Math.PI * 2);
      ctx.ellipse(6, -29, 6, 3.2, 0.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'tophat':
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-14, -22, 28, 4);
      ctx.fillRect(-9, -37, 18, 16);
      ctx.strokeRect(-9, -37, 18, 16);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-9, -25, 18, 3);
      break;
    case 'cat':
      ctx.fillStyle = '#f472b6';
      ctx.beginPath();
      ctx.moveTo(-11, -18);
      ctx.lineTo(-9, -30);
      ctx.lineTo(-2, -20);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(11, -18);
      ctx.lineTo(9, -30);
      ctx.lineTo(2, -20);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case 'antenna':
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.lineTo(0, -33);
      ctx.stroke();
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.arc(0, -34, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'ninja':
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(-14, -19, 28, 5);
      ctx.beginPath();
      ctx.moveTo(-14, -17);
      ctx.lineTo(-22, -13);
      ctx.lineTo(-19, -20);
      ctx.closePath();
      ctx.fill();
      break;
    case 'viking':
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.arc(0, -18, 13, Math.PI, 0);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(-12, -21);
      ctx.lineTo(-20, -29);
      ctx.lineTo(-10, -26);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(12, -21);
      ctx.lineTo(20, -29);
      ctx.lineTo(10, -26);
      ctx.closePath();
      ctx.fill();
      break;
    case 'astronaut':
      ctx.strokeStyle = 'rgba(224,242,254,0.8)';
      ctx.fillStyle = 'rgba(186,230,253,0.18)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(1, -10, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
  }
  ctx.restore();
}

function drawPet(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  pet: string,
  ownerColor: string,
  now: number
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = 1.8;

  if (pet === 'mini') {
    ctx.fillStyle = ownerColor;
    roundRect(ctx, -6, -9, 12, 15, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#7dd3fc';
    roundRect(ctx, -1, -6, 7, 5, 2);
    ctx.fill();
  } else if (pet === 'drone') {
    ctx.translate(0, -12 + Math.sin(now * 0.01) * 3);
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.arc(2, 0, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (pet === 'cat') {
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f472b6';
    ctx.fillRect(-3, -2, 2, 2);
    ctx.fillRect(2, -2, 2, 2);
  } else if (pet === 'slime') {
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.arc(0, 2, 8, Math.PI, 0);
    ctx.lineTo(8, 6);
    ctx.lineTo(-8, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (pet === 'robodog') {
    ctx.fillStyle = '#94a3b8';
    roundRect(ctx, -8, -4, 16, 10, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(3, -2, 4, 3);
  }
  ctx.restore();
}

function drawDeadBody(ctx: CanvasRenderingContext2D, body: DeadBody): void {
  const color = getColorOption(body.cosmetics.color);
  ctx.save();
  ctx.translate(body.x, body.y);

  // Blood pool
  ctx.fillStyle = 'rgba(185, 28, 28, 0.72)';
  ctx.beginPath();
  ctx.ellipse(0, 8, 24, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  // Lower half of suit lying down
  ctx.fillStyle = color.primary;
  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = 2.5;
  roundRect(ctx, -14, -4, 24, 16, 6);
  ctx.fill();
  ctx.stroke();

  // Protruding cartoon bone
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(8, -1, 13, 6);
  ctx.beginPath();
  ctx.arc(21, -1, 4, 0, Math.PI * 2);
  ctx.arc(21, 5, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function renderGameWorld(opts: RenderContextOptions): void {
  const { ctx, width, height, map, players, localPlayer, gameState, settings, now, killTargetId, cameraOverride } = opts;

  const camX = cameraOverride ? cameraOverride.x : localPlayer.x;
  const camY = cameraOverride ? cameraOverride.y : localPlayer.y;
  const isCCTV = Boolean(cameraOverride);

  // Clear exterior background
  ctx.fillStyle = map.exteriorColor;
  ctx.fillRect(0, 0, width, height);

  // Subtle parallax starfield / snow exterior
  ctx.save();
  const starCount = 45;
  for (let i = 0; i < starCount; i++) {
    const sx = ((i * 397 - camX * 0.12) % width + width) % width;
    const sy = ((i * 251 - camY * 0.12) % height + height) % height;
    ctx.fillStyle =
      map.theme === 'arctic'
        ? 'rgba(186, 230, 253, 0.35)'
        : map.theme === 'luxury'
          ? 'rgba(253, 224, 71, 0.25)'
          : 'rgba(255, 255, 255, 0.38)';
    ctx.fillRect(sx, sy, (i % 2) + 1.5, (i % 2) + 1.5);
  }
  ctx.restore();

  // Camera transform
  ctx.save();
  ctx.translate(width / 2 - camX, height / 2 - camY);

  const wallPad = 16;

  // PASS 1: Outer architectural hull / walls around rooms & corridors
  ctx.fillStyle = map.wallColor;
  ctx.strokeStyle = map.wallHighlight;
  ctx.lineWidth = 3;
  for (const c of map.corridors) {
    roundRect(ctx, c.x - wallPad, c.y - wallPad, c.w + wallPad * 2, c.h + wallPad * 2, 12);
    ctx.fill();
    ctx.stroke();
  }
  for (const r of map.rooms) {
    roundRect(ctx, r.rect.x - wallPad, r.rect.y - wallPad, r.rect.w + wallPad * 2, r.rect.h + wallPad * 2, 18);
    ctx.fill();
    ctx.stroke();
  }

  // PASS 2: Walkable corridors floor
  const corridorFloor =
    map.theme === 'arctic' ? '#475f78' : map.theme === 'luxury' ? '#2c1926' : '#1b2434';
  ctx.fillStyle = corridorFloor;
  for (const c of map.corridors) {
    ctx.fillRect(c.x, c.y, c.w, c.h);
  }

  // PASS 3: Walkable rooms floor + subtle architectural grid/pattern
  for (const room of map.rooms) {
    ctx.fillStyle = room.floorColor;
    roundRect(ctx, room.rect.x, room.rect.y, room.rect.w, room.rect.h, 8);
    ctx.fill();

    // Subtle floor tiles
    ctx.save();
    ctx.beginPath();
    ctx.rect(room.rect.x, room.rect.y, room.rect.w, room.rect.h);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    ctx.lineWidth = 1;
    const step = room.pattern === 'grid' ? 40 : 60;
    for (let gx = room.rect.x; gx < room.rect.x + room.rect.w; gx += step) {
      ctx.beginPath();
      ctx.moveTo(gx, room.rect.y);
      ctx.lineTo(gx, room.rect.y + room.rect.h);
      ctx.stroke();
    }
    for (let gy = room.rect.y; gy < room.rect.y + room.rect.h; gy += step) {
      ctx.beginPath();
      ctx.moveTo(room.rect.x, gy);
      ctx.lineTo(room.rect.x + room.rect.w, gy);
      ctx.stroke();
    }

    // Room floor watermark label
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.font = '700 22px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(room.name.toUpperCase(), room.rect.x + room.rect.w / 2, room.rect.y + 38);
    ctx.restore();
  }

  // PASS 4: Interior Props
  for (const prop of map.props) {
    ctx.save();
    ctx.fillStyle = prop.color ?? '#334155';
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 3;
    roundRect(ctx, prop.x, prop.y, prop.w, prop.h, prop.kind === 'table' ? 20 : 8);
    ctx.fill();
    ctx.stroke();

    if (prop.kind === 'reactor_core') {
      const pulse = 0.5 + 0.5 * Math.sin(now * 0.008);
      ctx.fillStyle = `rgba(34, 211, 238, ${0.3 + pulse * 0.45})`;
      roundRect(ctx, prop.x + 8, prop.y + 8, prop.w - 16, prop.h - 16, 6);
      ctx.fill();
    }
    ctx.restore();
  }

  // Emergency Button on Emergency Table
  ctx.save();
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(map.emergencyButton.x, map.emergencyButton.y, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ef4444';
  ctx.shadowColor = '#ef4444';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(map.emergencyButton.x, map.emergencyButton.y, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 10px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('EMERG', map.emergencyButton.x, map.emergencyButton.y + 3.5);
  ctx.restore();

  // Admin, Security & Vitals interactive console highlights
  drawStationBadge(ctx, map.adminTable.x, map.adminTable.y, 'ADMIN', '#38bdf8');
  drawStationBadge(ctx, map.securityConsole.x, map.securityConsole.y, 'CÁMARAS', '#ef4444');
  if (map.vitalsConsole) {
    drawStationBadge(ctx, map.vitalsConsole.x, map.vitalsConsole.y, 'VITALES', '#34d399');
  }

  // PASS 5: Vents
  const canUseVents =
    localPlayer.isAlive &&
    (localPlayer.role === 'impostor' || localPlayer.subRole === 'engineer');
  for (const vent of map.vents) {
    ctx.save();
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = canUseVents ? '#f59e0b' : '#475569';
    ctx.lineWidth = canUseVents ? 2.5 : 1.5;
    roundRect(ctx, vent.x - 19, vent.y - 13, 38, 26, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#090d16';
    for (let i = -11; i <= 11; i += 7) {
      ctx.fillRect(vent.x + i - 1.5, vent.y - 8, 3, 16);
    }
    ctx.restore();
  }

  // PASS 6: Security Cameras (blinking red light if someone is watching!)
  const camerasActive = gameState.cameraWatchers.length > 0 && gameState.activeSabotage?.type !== 'comms';
  for (const cam of map.cameras) {
    ctx.save();
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    roundRect(ctx, cam.x - 12, cam.y - 8, 24, 14, 4);
    ctx.fill();
    ctx.stroke();
    if (camerasActive && Math.floor(now / 450) % 2 === 0) {
      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(cam.x + 6, cam.y - 1, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // PASS 7: Doors (Open vs Closed blast doors)
  for (const door of map.doors) {
    const closedUntil = gameState.doorsClosedUntil[door.id];
    const isClosed = Boolean(closedUntil && closedUntil > now);
    ctx.save();
    if (isClosed) {
      ctx.fillStyle = '#7f1d1d';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.fillRect(door.rect.x, door.rect.y, door.rect.w, door.rect.h);
      ctx.strokeRect(door.rect.x, door.rect.y, door.rect.w, door.rect.h);
      // Warning stripes
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(door.rect.x + 4, door.rect.y + 4, Math.min(12, door.rect.w - 8), Math.min(12, door.rect.h - 8));
    } else {
      ctx.strokeStyle = 'rgba(148,163,184,0.28)';
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2;
      ctx.strokeRect(door.rect.x, door.rect.y, door.rect.w, door.rect.h);
    }
    ctx.restore();
  }

  // PASS 8: Local Player's Task Markers (hidden during Comms sabotage for Crewmates!)
  const commsSabotaged = gameState.activeSabotage?.type === 'comms' && localPlayer.role === 'crewmate';
  if (!commsSabotaged) {
    for (const task of localPlayer.tasks) {
      if (task.completed) continue;
      const pulse = 0.65 + 0.35 * Math.sin(now * 0.007);
      ctx.save();
      ctx.strokeStyle = localPlayer.role === 'impostor' ? 'rgba(250, 204, 21, 0.35)' : `rgba(250, 204, 21, ${pulse})`;
      ctx.fillStyle = 'rgba(250, 204, 21, 0.16)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(task.x, task.y, 20 + pulse * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fde047';
      ctx.font = '700 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★', task.x, task.y + 4);
      ctx.restore();
    }
  }

  // PASS 9: Active Sabotage Repair Markers
  if (gameState.activeSabotage) {
    for (const stId of gameState.activeSabotage.requiredStations) {
      if (gameState.activeSabotage.fixedStations.includes(stId)) continue;
      const st = map.sabotageStations.find((s) => s.id === stId);
      if (!st) continue;
      const pulse = 0.5 + 0.5 * Math.sin(now * 0.012);
      ctx.save();
      ctx.strokeStyle = `rgba(239, 68, 68, ${0.5 + pulse * 0.5})`;
      ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(st.x, st.y, 24 + pulse * 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fecaca';
      ctx.font = '800 12px "Chakra Petch", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('! REPARAR !', st.x, st.y - 32);
      ctx.restore();
    }
  }

  const visionRadius = isCCTV ? 340 : getEffectiveVisionRadius(localPlayer, gameState, settings);

  // PASS 10: Dead Bodies (only drawn within vision)
  for (const body of gameState.deadBodies) {
    const dist = distanceBetween(camX, camY, body.x, body.y);
    if (dist <= visionRadius + 40) {
      drawDeadBody(ctx, body);
    }
  }

  // PASS 11: Players (Y-sorted for natural depth, up to 40 players!)
  const visiblePlayers = players
    .filter((p) => {
      if (p.inVentId && p.id !== localPlayer.id) return false;
      // Living players cannot see ghosts
      if (!p.isAlive && localPlayer.isAlive) return false;
      // Vision distance culling (local player always visible)
      if (!isCCTV && p.id !== localPlayer.id) {
        if (distanceBetween(camX, camY, p.x, p.y) > visionRadius + 35) return false;
      }
      return true;
    })
    .sort((a, b) => a.y - b.y);

  for (const p of visiblePlayers) {
    // Handle Shapeshifter disguise
    const disguisedTarget =
      p.disguisedAsPlayerId && p.disguiseUntil && p.disguiseUntil > now
        ? players.find((other) => other.id === p.disguisedAsPlayerId)
        : null;

    const shownCosmetics = disguisedTarget ? disguisedTarget.cosmetics : p.cosmetics;
    const shownName = disguisedTarget ? disguisedTarget.displayName : p.displayName;
    const isMoving = Math.hypot(p.vx, p.vy) > 12;

    // MedBay visual scan beam
    if (p.isScanning && settings.visualTasks) {
      ctx.save();
      const beamY = p.y - 26 + ((now * 0.06) % 52);
      ctx.fillStyle = 'rgba(52, 211, 153, 0.22)';
      ctx.fillRect(p.x - 24, p.y - 28, 48, 56);
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x - 26, beamY);
      ctx.lineTo(p.x + 26, beamY);
      ctx.stroke();
      ctx.restore();
    }

    // Kill target highlight reticle
    if (killTargetId === p.id && !isCCTV) {
      ctx.save();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(p.x, p.y + 4, 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Local player inside vent visual cue
    if (p.inVentId && p.id === localPlayer.id) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      drawCharacter(ctx, p.x, p.y, shownCosmetics, p.facing, false, false, now);
      ctx.restore();
    } else {
      drawCharacter(ctx, p.x, p.y, shownCosmetics, p.facing, isMoving, !p.isAlive, now);
    }

    // Nameplate
    const showRedImpostorName =
      p.role === 'impostor' &&
      (localPlayer.role === 'impostor' || !localPlayer.isAlive);

    ctx.save();
    ctx.font = '700 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    const tagText = p.isBot ? `${shownName}` : shownName;
    const textWidth = ctx.measureText(tagText).width;
    ctx.fillStyle = 'rgba(7, 11, 20, 0.72)';
    roundRect(ctx, p.x - textWidth / 2 - 6, p.y - 54, textWidth + 12, 18, 6);
    ctx.fill();

    ctx.fillStyle = showRedImpostorName
      ? '#f87171'
      : !p.isAlive
        ? '#94a3b8'
        : p.id === localPlayer.id
          ? '#67e8f9'
          : '#f8fafc';
    ctx.fillText(tagText, p.x, p.y - 41);
    ctx.restore();
  }

  ctx.restore(); // End world camera transform

  // PASS 12: Dynamic Fog-of-War / Vision Vignette (Screen Space)
  if (!isCCTV && localPlayer.isAlive) {
    const grad = ctx.createRadialGradient(
      width / 2,
      height / 2,
      visionRadius * 0.52,
      width / 2,
      height / 2,
      visionRadius * 1.12
    );
    grad.addColorStop(0, 'rgba(5, 8, 17, 0)');
    grad.addColorStop(0.7, 'rgba(5, 8, 17, 0.55)');
    grad.addColorStop(1, 'rgba(5, 8, 17, 0.94)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  // PASS 13: Directional Arrow Guide for Active Critical Sabotage
  if (!isCCTV && gameState.activeSabotage) {
    for (const stId of gameState.activeSabotage.requiredStations) {
      if (gameState.activeSabotage.fixedStations.includes(stId)) continue;
      const st = map.sabotageStations.find((s) => s.id === stId);
      if (!st) continue;
      const dist = distanceBetween(localPlayer.x, localPlayer.y, st.x, st.y);
      if (dist > 140) {
        const angle = Math.atan2(st.y - localPlayer.y, st.x - localPlayer.x);
        const arrowDist = Math.min(width, height) * 0.28;
        const ax = width / 2 + Math.cos(angle) * arrowDist;
        const ay = height / 2 + Math.sin(angle) * arrowDist;
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(angle);
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.lineTo(-8, -9);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-8, 9);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // CCTV Scanlines overlay when viewing Security Cameras
  if (isCCTV) {
    ctx.save();
    ctx.fillStyle = 'rgba(16, 185, 129, 0.07)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
    for (let sy = 0; sy < height; sy += 4) {
      ctx.fillRect(0, sy, width, 1);
    }
    ctx.restore();
  }
}

function drawStationBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  color: string
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  roundRect(ctx, x - 34, y - 14, 68, 24, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = '700 10px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y + 2);
  ctx.restore();
}
