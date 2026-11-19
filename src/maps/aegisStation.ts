import type { GameMap } from '../types/game';

export const AEGIS_STATION_MAP: GameMap = {
  id: 'aegis',
  name: 'Estación Orbital Aegis',
  subtitle: 'Crucero Espacial Clase-IV',
  theme: 'orbital',
  description:
    'Nave espacial de diseño clásico con 12 módulos presurizados, conductos triangulares y corredores estrechos perfectos para deducción táctica.',
  recommendedPlayers: '4 – 40 jugadores',
  width: 2800,
  height: 1950,
  ambientColor: '#0b1222',
  exteriorColor: '#050811',
  wallColor: '#1e293b',
  wallHighlight: '#38bdf8',
  spawnCenter: { x: 1400, y: 420 },
  emergencyButton: { x: 1400, y: 420, roomId: 'cafeteria' },
  adminTable: { x: 1750, y: 1020, roomId: 'admin' },
  securityConsole: { x: 760, y: 970, roomId: 'security' },
  vitalsConsole: { x: 1040, y: 690, roomId: 'medbay' },
  rooms: [
    {
      id: 'cafeteria',
      name: 'Cafetería',
      rect: { x: 1120, y: 160, w: 560, h: 480 },
      floorColor: '#293548',
      accentColor: '#38bdf8',
      pattern: 'tiles',
      isEmergencyRoom: true,
    },
    {
      id: 'weapons',
      name: 'Armería',
      rect: { x: 1920, y: 180, w: 360, h: 320 },
      floorColor: '#283142',
      accentColor: '#f59e0b',
      pattern: 'grid',
    },
    {
      id: 'navigation',
      name: 'Navegación',
      rect: { x: 2360, y: 680, w: 320, h: 420 },
      floorColor: '#1f2d3d',
      accentColor: '#22d3ee',
      pattern: 'grid',
    },
    {
      id: 'o2',
      name: 'Oxígeno (O2)',
      rect: { x: 1900, y: 660, w: 280, h: 240 },
      floorColor: '#1f3632',
      accentColor: '#34d399',
      pattern: 'tiles',
    },
    {
      id: 'shields',
      name: 'Escudos',
      rect: { x: 1940, y: 1240, w: 340, h: 320 },
      floorColor: '#2b2b44',
      accentColor: '#818cf8',
      pattern: 'metal',
    },
    {
      id: 'comms',
      name: 'Comunicaciones',
      rect: { x: 1580, y: 1480, w: 300, h: 270 },
      floorColor: '#2b2538',
      accentColor: '#c084fc',
      pattern: 'grid',
    },
    {
      id: 'storage',
      name: 'Almacén',
      rect: { x: 1140, y: 1160, w: 380, h: 520 },
      floorColor: '#2f2d2b',
      accentColor: '#fb923c',
      pattern: 'metal',
    },
    {
      id: 'admin',
      name: 'Administración',
      rect: { x: 1620, y: 880, w: 300, h: 270 },
      floorColor: '#253342',
      accentColor: '#38bdf8',
      pattern: 'tiles',
    },
    {
      id: 'medbay',
      name: 'Enfermería',
      rect: { x: 880, y: 560, w: 300, h: 300 },
      floorColor: '#203842',
      accentColor: '#2dd4bf',
      pattern: 'tiles',
    },
    {
      id: 'electrical',
      name: 'Electricidad',
      rect: { x: 780, y: 1140, w: 300, h: 330 },
      floorColor: '#2d2a20',
      accentColor: '#facc15',
      pattern: 'grid',
    },
    {
      id: 'security',
      name: 'Seguridad',
      rect: { x: 640, y: 840, w: 230, h: 260 },
      floorColor: '#262b38',
      accentColor: '#ef4444',
      pattern: 'metal',
    },
    {
      id: 'upper_engine',
      name: 'Motor Superior',
      rect: { x: 340, y: 240, w: 360, h: 320 },
      floorColor: '#32282c',
      accentColor: '#f97316',
      pattern: 'metal',
    },
    {
      id: 'reactor',
      name: 'Reactor',
      rect: { x: 140, y: 740, w: 340, h: 460 },
      floorColor: '#20263b',
      accentColor: '#06b6d4',
      pattern: 'grid',
    },
    {
      id: 'lower_engine',
      name: 'Motor Inferior',
      rect: { x: 340, y: 1360, w: 360, h: 320 },
      floorColor: '#32282c',
      accentColor: '#f97316',
      pattern: 'metal',
    },
  ],
  corridors: [
    // Cafeteria <-> Upper Engine (West)
    { x: 680, y: 340, w: 460, h: 120 },
    // MedBay connection to Cafeteria-UpperEngine corridor
    { x: 960, y: 440, w: 120, h: 140 },
    // Cafeteria <-> Weapons (East)
    { x: 1660, y: 310, w: 280, h: 120 },
    // Cafeteria <-> Storage (South vertical spine)
    { x: 1320, y: 620, w: 140, h: 560 },
    // Admin <-> Central vertical spine
    { x: 1440, y: 940, w: 200, h: 120 },
    // Weapons <-> O2 / Navigation / Shields (East vertical corridor)
    { x: 2140, y: 480, w: 130, h: 780 },
    // O2 <-> East corridor
    { x: 2140, y: 720, w: 60, h: 120 },
    // Navigation <-> East corridor
    { x: 2250, y: 830, w: 130, h: 120 },
    // Storage <-> Shields (South-East corridor)
    { x: 1500, y: 1340, w: 460, h: 120 },
    // Comms <-> South-East corridor
    { x: 1660, y: 1440, w: 120, h: 60 },
    // Storage <-> Lower Engine (South-West corridor)
    { x: 680, y: 1460, w: 480, h: 120 },
    // Electrical <-> South-West corridor
    { x: 870, y: 1440, w: 120, h: 60 },
    // Upper Engine <-> Reactor <-> Lower Engine (West vertical corridor)
    { x: 510, y: 540, w: 120, h: 840 },
    // Reactor <-> West vertical corridor
    { x: 460, y: 900, w: 80, h: 140 },
    // Security <-> West vertical corridor
    { x: 610, y: 910, w: 50, h: 120 },
  ],
  walls: [
    // Cafeteria emergency center table obstacle (hollow feel, players walk around it)
    { x: 1345, y: 365, w: 110, h: 110 },
    // Storage central cargo stack
    { x: 1280, y: 1350, w: 100, h: 120 },
  ],
  doors: [
    { id: 'door_cafe_w', roomId: 'cafeteria', label: 'Cafetería Oeste', rect: { x: 1100, y: 340, w: 28, h: 120 }, orientation: 'vertical' },
    { id: 'door_cafe_e', roomId: 'cafeteria', label: 'Cafetería Este', rect: { x: 1672, y: 310, w: 28, h: 120 }, orientation: 'vertical' },
    { id: 'door_cafe_s', roomId: 'cafeteria', label: 'Cafetería Sur', rect: { x: 1320, y: 632, w: 140, h: 28 }, orientation: 'horizontal' },
    { id: 'door_elec', roomId: 'electrical', label: 'Electricidad', rect: { x: 870, y: 1456, w: 120, h: 28 }, orientation: 'horizontal' },
    { id: 'door_medbay', roomId: 'medbay', label: 'Enfermería', rect: { x: 960, y: 544, w: 120, h: 28 }, orientation: 'horizontal' },
    { id: 'door_sec', roomId: 'security', label: 'Seguridad', rect: { x: 626, y: 910, w: 28, h: 120 }, orientation: 'vertical' },
  ],
  vents: [
    // Network 1: MedBay - Electrical - Security (Classic triangle!)
    { id: 'v_med', roomId: 'medbay', x: 930, y: 800, linksTo: ['v_elec', 'v_sec'] },
    { id: 'v_elec', roomId: 'electrical', x: 830, y: 1200, linksTo: ['v_med', 'v_sec'] },
    { id: 'v_sec', roomId: 'security', x: 700, y: 1040, linksTo: ['v_med', 'v_elec'] },
    // Network 2: Reactor - Upper Engine - Lower Engine
    { id: 'v_reac', roomId: 'reactor', x: 220, y: 830, linksTo: ['v_ueng', 'v_leng'] },
    { id: 'v_ueng', roomId: 'upper_engine', x: 420, y: 490, linksTo: ['v_reac', 'v_leng'] },
    { id: 'v_leng', roomId: 'lower_engine', x: 420, y: 1430, linksTo: ['v_reac', 'v_ueng'] },
    // Network 3: Cafeteria - Admin - Weapons - Shields - Navigation
    { id: 'v_cafe', roomId: 'cafeteria', x: 1610, y: 560, linksTo: ['v_admin', 'v_weap'] },
    { id: 'v_admin', roomId: 'admin', x: 1680, y: 1090, linksTo: ['v_cafe', 'v_shields'] },
    { id: 'v_weap', roomId: 'weapons', x: 2020, y: 240, linksTo: ['v_cafe', 'v_nav'] },
    { id: 'v_nav', roomId: 'navigation', x: 2440, y: 760, linksTo: ['v_weap', 'v_shields'] },
    { id: 'v_shields', roomId: 'shields', x: 2200, y: 1480, linksTo: ['v_nav', 'v_admin'] },
  ],
  taskStations: [
    { id: 't_aegis_wire1', roomId: 'electrical', roomName: 'Electricidad', title: 'Reparar Cableado', type: 'wiring', category: 'common', x: 910, y: 1190 },
    { id: 't_aegis_card', roomId: 'admin', roomName: 'Administración', title: 'Deslizar Tarjeta', type: 'swipe_card', category: 'common', x: 1840, y: 950 },
    { id: 't_aegis_ast', roomId: 'weapons', roomName: 'Armería', title: 'Destruir Asteroides', type: 'asteroids', category: 'long', isVisual: true, x: 2150, y: 310 },
    { id: 't_aegis_reac', roomId: 'reactor', roomName: 'Reactor', title: 'Iniciar Reactor', type: 'reactor_seq', category: 'long', x: 240, y: 970 },
    { id: 't_aegis_med', roomId: 'medbay', roomName: 'Enfermería', title: 'Escáner Biométrico', type: 'med_scan', category: 'long', isVisual: true, x: 1080, y: 780 },
    { id: 't_aegis_steer', roomId: 'navigation', roomName: 'Navegación', title: 'Estabilizar Rumbo', type: 'steering', category: 'short', x: 2600, y: 890 },
    { id: 't_aegis_dl1', roomId: 'cafeteria', roomName: 'Cafetería', title: 'Descargar Registros', type: 'download', category: 'short', x: 1580, y: 220 },
    { id: 't_aegis_dl2', roomId: 'comms', roomName: 'Comunicaciones', title: 'Subir Telemetría', type: 'download', category: 'short', x: 1740, y: 1680 },
    { id: 't_aegis_shld', roomId: 'shields', roomName: 'Escudos', title: 'Calibrar Escudos', type: 'shields', category: 'short', isVisual: true, x: 2050, y: 1460 },
    { id: 't_aegis_wire2', roomId: 'storage', roomName: 'Almacén', title: 'Conectar Fusibles', type: 'wiring', category: 'short', x: 1200, y: 1240 },
    { id: 't_aegis_eng1', roomId: 'upper_engine', roomName: 'Motor Superior', title: 'Alinear Turbina Norte', type: 'steering', category: 'short', x: 460, y: 320 },
    { id: 't_aegis_eng2', roomId: 'lower_engine', roomName: 'Motor Inferior', title: 'Calibrar Propulsor Sur', type: 'shields', category: 'short', x: 460, y: 1580 },
    { id: 't_aegis_o2', roomId: 'o2', roomName: 'Oxígeno (O2)', title: 'Limpiar Filtros O2', type: 'asteroids', category: 'short', x: 1980, y: 760 },
  ],
  sabotageStations: [
    { id: 'sab_aegis_reac_1', sabotageType: 'reactor', roomId: 'reactor', label: 'Reactor Norte', x: 210, y: 820 },
    { id: 'sab_aegis_reac_2', sabotageType: 'reactor', roomId: 'reactor', label: 'Reactor Sur', x: 210, y: 1120 },
    { id: 'sab_aegis_o2_1', sabotageType: 'o2', roomId: 'o2', label: 'Panel O2 Principal', x: 2040, y: 720 },
    { id: 'sab_aegis_o2_2', sabotageType: 'o2', roomId: 'admin', label: 'Panel O2 Admin', x: 1680, y: 940 },
    { id: 'sab_aegis_lights', sabotageType: 'lights', roomId: 'electrical', label: 'Tablero Eléctrico', x: 1010, y: 1210 },
    { id: 'sab_aegis_comms', sabotageType: 'comms', roomId: 'comms', label: 'Consola Comms', x: 1660, y: 1620 },
  ],
  cameras: [
    { id: 'cam_aegis_1', label: 'Pasillo Seguridad / Reactor', x: 570, y: 960 },
    { id: 'cam_aegis_2', label: 'Pasillo Cafetería / MedBay', x: 1020, y: 400 },
    { id: 'cam_aegis_3', label: 'Pasillo Central / Admin', x: 1390, y: 980 },
    { id: 'cam_aegis_4', label: 'Pasillo Este / Navegación', x: 2200, y: 880 },
  ],
  props: [
    { kind: 'table', x: 1345, y: 365, w: 110, h: 110, color: '#334155' },
    { kind: 'table', x: 1180, y: 240, w: 70, h: 70, color: '#334155' },
    { kind: 'table', x: 1550, y: 240, w: 70, h: 70, color: '#334155' },
    { kind: 'reactor_core', x: 160, y: 920, w: 50, h: 100, color: '#06b6d4' },
    { kind: 'engine', x: 370, y: 270, w: 70, h: 110, color: '#f97316' },
    { kind: 'engine', x: 370, y: 1520, w: 70, h: 110, color: '#f97316' },
    { kind: 'bed', x: 920, y: 600, w: 60, h: 34, color: '#38bdf8' },
    { kind: 'bed', x: 920, y: 660, w: 60, h: 34, color: '#38bdf8' },
    { kind: 'crate', x: 1280, y: 1350, w: 100, h: 120, color: '#b45309' },
    { kind: 'console', x: 1715, y: 990, w: 70, h: 48, color: '#0ea5e9' },
    { kind: 'console', x: 720, y: 930, w: 70, h: 44, color: '#ef4444' },
  ],
};
