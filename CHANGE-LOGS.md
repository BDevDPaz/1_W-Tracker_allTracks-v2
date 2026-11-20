# W Tracker v2 — CHANGE-LOGS

Repo: BDevDPaz/1_W-Tracker_allTracks-v2
Rama: chore/upgrade-sdk-54
Base: master
Fecha: 20 Nov 2026

## Resumen

Estabilización en SDK 52, upgrade a SDK 54 y fixes de jornada, historial, geofence y PDF.
2 Draft PRs creados, sin merge hasta aprobación.

- PR #1: chore/stabilize-sdk52 -> master
  https://github.com/BDevDPaz/1_W-Tracker_allTracks-v2/pull/1
- PR #2: chore/upgrade-sdk-54 -> master
  https://github.com/BDevDPaz/1_W-Tracker_allTracks-v2/pull/2

---

## PR #1 — chore/stabilize-sdk52

### changelog_261120_000001 — d0dc2c3
**chore: estabiliza SDK 52, pinning exacto, refactor a components/modals y limpieza de legacy**

- Pinning exacto de dependencias en SDK 52 como base estable.
- Refactor a componentes y modales.
- Limpieza de código legacy.
- Sin cambios funcionales de SDK 54.
- Rama base para el upgrade.

---

## PR #2 — chore/upgrade-sdk-54

### changelog_261120_000002 — 0610d0b
**chore: upgrade a Expo SDK 54, React 19.1, RN 0.81.5, Reanimated 4 + Worklets, fix NotificationBehavior**

- Upgrade Expo SDK 52 -> SDK 54.
- React 19.1, React Native 0.81.5.
- Reanimated 4 + Worklets.
- Fix de NotificationBehavior para SDK 54.
- Build con dev-client (no Expo Go) en Samsung S22+.

### changelog_261120_000003 — 766a6fd
**fix: habilita unstable_transformImportMeta para zustand y migra SafeAreaView a safe-area-context en SDK 54**

- Habilita `unstable_transformImportMeta` en Babel para compatibilidad con zustand en SDK 54.
- Migra SafeAreaView de react-native a `react-native-safe-area-context`.
- Evita crash / layout roto en SDK 54.

### changelog_261120_000004 — a2bcefb
**fix: mapea history a clock en Feather para SDK 54**

- Icon.tsx: `history` de Feather no existe como tal, se mapea a `clock`.
- También mapeados: `shield-check` -> `shield`, `pencil` -> `edit-2`.
- Sin cast genérico ni `@ts-expect-error` que oculte bug en runtime.

### changelog_261120_000005 — 35b1fb9
**fix: ids únicos por sesión en buildDailyTimeline para evitar keys duplicadas**

- `buildDailyTimeline` ahora genera ids con prefijo de sesión.
- Evita keys duplicadas en React cuando hay varias sesiones en el mismo día.
- Elimina warning de keys y renders incorrectos.

### changelog_261120_000006 — 66a6ea7
**fix: horas en vivo en HOY y PDF para sesión activa**

- HoyScreen: horas y ganancias en vivo desde `elapsedTime` para sesión ACTIVA.
- DatabaseService: horas en vivo para sesiones activas.
- PDF: no muestra 0.0h cuando la jornada sigue activa, calcula desde el tiempo transcurrido.

### changelog_261120_000007 — 3f94b6e
**fix: Historial solo muestra sesiones CERRADA**

- HistorialScreen filtra solo `state = 'CERRADA'`.
- Sesiones ESPERANDO / ACTIVA / TRASLADO / SALIDA ya no aparecen en historial.
- Historial = registro cerrado, Hoy = jornada en curso.

### changelog_261120_000008 — f75cb62
**fix: geofence auto check-in con geocodificación y sin shouldShowAlert; alias no se geocodifica**

- GeofenceService: `resolveDestinationCoords` geocodifica el Destino real.
- `register` retorna `alreadyInside` usando Haversine (distancia <= radio).
- SessionEngine usa ese retorno para auto-activar a ACTIVA si ya estás dentro al configurar la jornada.
- Eliminado `shouldShowAlert` (deprecated en SDK 54), se usa `shouldShowBanner` / `shouldShowList`.
- Solo `Principal` es manual. El alias nunca se geocodifica, solo es etiqueta.
- Regla: Destino = dirección real geocodificable, Alias = etiqueta visible.

### changelog_261120_000009 — 9f8bec8
**fix: PDF timeline configurada vs llegada y totales al cerrar con pausas y traslados**

- PDFService `_generateTimeline`:
  - Separa `Jornada configurada` (createdAt) de `Llegada al destino` (startTime).
  - Antes mezclaba ambos en un solo evento.
- Todos los tiempos con `_formatTime` en hora local (es-US, HH:MM), no ISO UTC crudo.
- `_getRelativeMinutes` parsea ISO primero con `Date.parse`, con fallback a HH:MM y guard contra NaN.
- `_formatMinutesDiff` protege contra NaN / negativos, retorna "0 min".
- SessionEngine `finishWorkDay`:
  - Calcula `pauseMinutes` desde breaks, `transferMinutes` desde transfers.
  - Calcula `totalMinutes` = end - start, `netMinutes` = total - lunch.
  - Calcula `totalHours`, `overtimeHours` (sobre 8h), `totalEarnings` con `snapshot_rate` y multiplicador 1.5 por defecto.
  - Guarda `total_hours`, `total_earnings`, `overtime_hours`, `paid_minutes`, `pause_minutes`, `transfer_minutes` al cerrar.
- SessionEngine `endLunch`:
  - Calcula `duration_minutes` del break abierto en vez de solo cerrar `end_time`.
- SessionEngine `startSession` / `confirmArrival` / `startTransfer` / `cancelTransfer`:
  - Todos pasan `destination` a `geofence.register`.

---

## Estado final

- Rama `chore/upgrade-sdk-54` en commit `9f8bec8`, pusheada.
- `git status` limpio.
- `npx tsc --noEmit` sin errores.
- PR #1 y PR #2 en Draft, sin merge.

## QA pendiente en dispositivo (SDK 54 dev build)

- Destino real / Alias etiqueta estando ya dentro -> auto-activar a ACTIVA.
- Lejos del destino -> quedar ESPERANDO.
- Destino Principal -> quedar manual, sin auto check-in.
- Onboarding, Hoy, Historial, Reportes PDF, Ajustes persistencia.
- Modales: DailySetup / Destination / Lunch / EditSession / ExitDetection.
- Permiso geofence background y enter/exit.
- Build: `eas build --profile development --platform android`, instalar APK, `npx expo start --dev-client`.
