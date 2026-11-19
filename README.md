# Among Us 2 — Juego Web Multijugador en Tiempo Real

Juego web multijugador en tiempo real inspirado en **Among Us**, diseñado **mobile-first** con compatibilidad completa en PC, soporte para **hasta 40 jugadores por sala**, **hasta 6 impostores configurables**, **3 mapas únicos**, personalización persistente y sincronización mediante **Supabase**.

---

## Características Principales

### Multijugador y Cuentas (Supabase)
- **Salas de hasta 40 jugadores** con acceso por **código de 6 caracteres** y enlace directo de invitación (`?room=CODIGO`).
- **Registro e inicio de sesión** gestionados con **Supabase Auth**.
- **Personalización persistente** guardada en el perfil (`public.profiles`): 20 colores, 12 sombreros, 8 visores, 8 trajes y 6 mascotas que siguen al jugador en el mapa, además de estadísticas de carrera (victorias, tareas completadas y eliminaciones).
- **Sincronización híbrida escalable para 40 jugadores**:
  - **Supabase Realtime Broadcast (~15 Hz)** para movimiento fluido en 60 FPS sin saturar escrituras SQL.
  - **Supabase Realtime Presence** para seguimiento en vivo de jugadores conectados.
  - **Supabase Postgres + Postgres Changes + RLS** para estado autoritativo (salas, roles, tareas, votaciones, sabotajes, resultados y chat de fantasmas aislado mediante políticas RLS).
- **Bots IA opcionales en el Lobby**: el anfitrión puede añadir Bots IA (+1, +5, +10 o llenar hasta 40 jugadores) para probar o completar partidas masivas al instante.
- **Modo Práctica Local**: si no hay variables de entorno de Supabase configuradas, la app funciona en modo local (`localStorage` + `BroadcastChannel` entre pestañas del navegador) para pruebas rápidas sin bloquear el desarrollo.

### 3 Mapas Distintos
1. **Estación Orbital Aegis** *(Crucero Espacial Clase-IV)*: 14 módulos presurizados clásicos (Cafetería, Reactor, Motor Superior/Inferior, Electricidad, Enfermería, Seguridad, Administración, Armería, Navegación, O2, Escudos, Comunicaciones, Almacén), 3 redes de conductos y 4 cámaras CCTV.
2. **Base Polar Borealis** *(Estación Exoplanetaria Ártica)*: 10 domos científicos conectados por un patio exterior nevado, Planta Geotérmica, Laboratorio Bio, Observatorio, Invernadero O2, Almacén Criogénico y monitor de Signos Vitales.
3. **Aeronave Solaris IX** *(Dirigible Orbital de Lujo)*: 11 estancias de gran escala con doble circuito panorámico (Gran Atrio, Cabina de Mando, Bóveda Real, Galería Imperial, Bahía Médica, Seguridad Central, Cubierta de Carga, Mirador, Cocina Real, Motores y Torre Comms) ideal para partidas de 20–40 jugadores.

### Mecánicas Fieles a Among Us + Novedades de Among Us 2
- **Tripulantes**: 8 minijuegos interactivos táctiles/ratón (Cableado, Secuencia de Reactor, Tarjeta Admin, Asteroides, Descarga de Datos, Estabilizar Rumbo, Escáner Visual MedBay, Escudos). Los fantasmas atraviesan paredes y siguen completando sus tareas para llenar la barra global.
- **Impostores (1 a 6 configurables)**: eliminación por distancia y enfriamiento con cuerpo en el suelo, redes de conductos (vents), sabotajes críticos con cuenta regresiva (**Reactor** y **O2**), sabotajes tácticos (**Luces** que reducen la visión de tripulantes y **Comunicaciones** que ocultan tareas/cámaras/admin) y sellado temporal de puertas.
- **Reuniones y Votaciones escalables a 40 jugadores**: reporte de cadáveres y botón de emergencia (con límite por jugador, enfriamiento y bloqueo durante sabotajes), buscador y filtros (`Vivos / Todos / Muertos`), chat rápido táctil para móvil, chat de fantasmas privado, regla fiel de empate/skip, opción de votos anónimos, confirmación de expulsión y cinemática de expulsión al espacio.
- **Roles Avanzados de Among Us 2** *(activables en ajustes de sala)*:
  - **Ingeniero** *(Tripulante)*: acceso a conductos de ventilación.
  - **Científico** *(Tripulante)*: acceso portátil al monitor de Signos Vitales.
  - **Rastreador** *(Tripulante)*: baliza GPS temporal visible en el minimapa.
  - **Cambiaformas** *(Impostor)*: disfraz temporal con la apariencia y nombre de otro jugador vivo.
- **Sistemas de Seguridad**: Cámaras CCTV en tiempo real (con LED rojo parpadeante en el mapa cuando alguien observa), Mesa de Administración (ocupación por sala) y Monitor de Signos Vitales.

---

## Controles (Mobile-First y Escritorio)

| Acción | Móvil (Táctil) | PC (Teclado / Ratón) |
| --- | --- | --- |
| Moverse | Joystick virtual (pulgar izquierdo) | `W A S D` o Flechas |
| Usar / Tarea / Reparar / Consola | Botón **USAR** (pulgar derecho) | `E` o `Espacio` |
| Reportar cuerpo | Botón **REPORTAR** | `R` |
| Eliminar *(Impostor)* | Botón **MATAR** | `Q` |
| Entrar/Salir de conducto | Botón **VENTILAR** | `V` |
| Mapa táctico | Botón Mapa (arriba derecha) | `M` o `Tab` |
| Sabotajes *(Impostor)* | Botón **SABOTAJE** | `F` |
| Cerrar ventanas | Botón `X` | `Esc` |

---

## Decisiones Técnicas y Arquitectura

1. **Vite + React 19 + TypeScript + Tailwind CSS v4**: elegido frente a frameworks SSR porque un juego Canvas 2D en tiempo real a 60 FPS opera íntegramente en el cliente con WebSockets persistentes, `requestAnimationFrame` y `AudioContext`. Elimina errores de hidratación, ofrece despliegues instantáneos en Vercel y mantiene una separación estricta entre motor (`src/engine`), mapas (`src/maps`), servicios (`src/services`) e interfaz (`src/components`).
2. **Renderizado 2D Procedural + SVG**: todos los avatares, cosméticos, mascotas, efectos de iluminación/niebla de guerra (fog of war) y audio (`Web Audio API`) se generan de forma procedural. Esto elimina dependencias de assets pesados, reduce drásticamente el tiempo de carga en redes móviles 4G y mantiene 60 FPS incluso con 40 jugadores en pantalla.
3. **Colisión por Unión de Áreas Caminables**: cada mapa define explícitamente sus salas y pasillos caminables más obstáculos/puertas cerrables. Esta arquitectura hace imposible que un jugador atraviese muros hacia el vacío y permite verificar matemáticamente la conectividad mediante pruebas automatizadas BFS (`src/__tests__/maps.test.ts`).
4. **Supabase Realtime Broadcast + Postgres Autorizado**: enviar coordenadas de 40 jugadores a 15 Hz mediante SQL saturaría cualquier base relacional. Por ello el movimiento viaja por **Realtime Broadcast** efímero, mientras que los eventos críticos (creación/unión atómica por RPC `join_room_by_code`, asignación de roles, muertes, votos, chat y estadísticas) persisten en PostgreSQL protegidos por **Row Level Security (RLS)**.

### Estructura del Proyecto

```text
├── supabase/
│   ├── config.toml
│   └── migrations/
│       └── 20261119000001_among_us_2_schema.sql   # Tablas, triggers, RLS, RPCs y Realtime
├── src/
│   ├── config/          # Cosméticos (20 colores, sombreros, visores, trajes, mascotas) y defaults
│   ├── engine/          # Colisiones, reglas de juego, Bots IA, audio WebAudio y renderer Canvas
│   ├── maps/            # 3 mapas completos (Aegis, Borealis, Solaris)
│   ├── services/        # Cliente Supabase, autenticación/perfiles y salas/Realtime
│   ├── components/      # Pantallas Auth, Home, Lobby, Customizer, GameView, Meeting, Minijuegos
│   └── __tests__/       # Suite Vitest (reglas 40p/6imp, colisiones y prueba BFS de los 3 mapas)
├── vercel.json          # Rewrites SPA y cabeceras de seguridad para producción en Vercel
└── .env.example         # Plantilla de variables de entorno (sin secretos en código)
```

---

## Instalación y Configuración Local

### Requisitos
- Node.js `>= 20`
- npm `>= 10`
- Proyecto en [Supabase](https://supabase.com) (opcional para modo local, obligatorio para multijugador online)

### Pasos

1. **Clonar e instalar dependencias**:
   ```bash
   git clone https://github.com/viic-tor/theThingGame.git
   cd theThingGame
   npm install
   ```

2. **Configurar variables de entorno**:
   ```bash
   cp .env.example .env.local
   ```
   Edita `.env.local` con las credenciales de tu proyecto Supabase (**Project Settings → API**):
   ```env
   VITE_SUPABASE_URL=https://TU_PROJECT_REF.supabase.co
   VITE_SUPABASE_ANON_KEY=TU_ANON_PUBLIC_KEY
   ```
   > **Seguridad**: Nunca subas `.env` ni `.env.local` al repositorio; están excluidos en `.gitignore`.

3. **Aplicar el esquema en Supabase**:
   - **Opción A (Supabase CLI)**:
     ```bash
     npx supabase link --project-ref TU_PROJECT_REF
     npx supabase db push
     ```
   - **Opción B (SQL Editor en Supabase Dashboard o Supabase MCP)**:
     Ejecuta el contenido completo de [`supabase/migrations/20261119000001_among_us_2_schema.sql`](./supabase/migrations/20261119000001_among_us_2_schema.sql).
   - En **Authentication → Providers → Email**, asegúrate de tener Email habilitado (para registro instantáneo sin verificación por correo en pruebas rápidas, puedes desactivar *"Confirm email"* en Supabase Auth).

4. **Ejecutar en desarrollo**:
   ```bash
   npm run dev
   ```

5. **Ejecutar pruebas y compilación de producción**:
   ```bash
   npm run typecheck
   npm test
   npm run build
   ```

---

## Despliegue en Vercel

El repositorio incluye [`vercel.json`](./vercel.json) listo para producción.

1. Sube este repositorio a **GitHub**:
   ```bash
   git remote add origin https://github.com/viic-tor/theThingGame.git
   git push -u origin main
   ```
2. Importa el repositorio en [Vercel](https://vercel.com/new).
3. En **Environment Variables** del proyecto en Vercel añade:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Haz clic en **Deploy**. Vercel ejecutará `npm run build` y servirá `dist/` con rutas SPA y cabeceras de seguridad configuradas.
