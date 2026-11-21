# W Tracker v2 — CHANGE-LOGS
## Estado final

- Rama `chore/upgrade-sdk-54` en commit `9b289a3`, pusheada.
- `git status` limpio para este fix (assets modificados quedan fuera).
- `npx tsc --noEmit` sin errores.
- PR #1 y PR #2 en Draft, sin merge.
- Diseño premium aplicado a Hoy: `tokens` + `Surface` + `HeroCard` + `Button` + `Pill` + `Timeline` + `MetricTile` + `Header` + `Input`.
- Ajustes split Worker / Admin funcionando en dev build + toast + `startDate` normalizado.

### changelog_261120_000030 — 9b289a3
**fix(settings): Ajustes toast no tapa AJUSTES + normalizar startDate a YYYY-MM-DD**

- `src/screens/AjustesScreen.tsx`
- Toast: `safeArea.paddingTop` Android `24` → `64`, iOS `0` → `16`. Reserva espacio para el toast global que es un overlay absoluto arriba. Sin este inset, el toast tapaba el título `AJUSTES`.
- `startDate`: nueva `normalizeStartDate()` — `20190308` → `2019-03-08`, `2019/03/08` → `2019-03-08`, valida fecha real (`20191340` / `20190230` = error).
- Normalización aplicada al cargar (`adminFormFromSettings`), al teclear 8 dígitos en vivo (`handleStartDateChange`), y al guardar Admin antes del Alert de confirmación. Si es inválido, no abre el Alert y muestra `Fecha Inicio debe ser YYYY-MM-DD, ej: 2019-03-08.`
- No toca radio, toggles duplicados, horas base / umbral ni almuerzo — esas decisiones siguen pendientes.
- Verificado con `npx tsc --noEmit` limpio.
- Pusheado como `HEAD -> origin/chore/upgrade-sdk-54` en `9b289a3`, `git status` limpio para este archivo.

=========


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
- Build con dev-client (no Expo Go) en 【entity-Samsung¦canonical_name=Samsung】 S22+.

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

## Diseño Premium — Sistema #0A0A0C / #D4AF37

### changelog_261120_000010 — e59469c
**design: aplica sistema premium #0A0A0C / dorado #D4AF37 a tokens**

- `src/theme/tokens.ts`
- `obsidian` `#050505` → `#0A0A0C`, `mutedGold` `#C5A059` → `#D4AF37`.
- Agrega `mutedGoldLight #E8C86A` y `mutedGoldTransparentStrong`.
- `h1` 32 → 34 con peso 800, `h2` 24 → 26.
- `RADIUS.cards` 20 → 24, nuevo `RADIUS.hero` 28.
- Nuevo `SHADOWS` con `card`, `hero` y `goldGlow`.
- Mantiene todos los exports para no romper `Button`, `Surface`, `HeroCard`, `Timeline`.

### changelog_261120_000011 — 573be09
**design: Surface premium con variante gold y sombras**

- `src/components/atoms/Surface.tsx`
- Nueva variante `gold` con borde dorado `#D4AF37` y sombra `goldGlow`.
- `elevated` / `highlight` usan sombra `card`.
- Mantiene `base | elevated | highlight` para no romper nada.

### changelog_261120_000012 — 12eaba9
**design: HeroCard premium con sombra hero y timer 48**

- `src/components/organisms/HeroCard.tsx`
- `Surface` con `radius="hero"` y sombra `hero`.
- Borde con `ui.theme.color`, ancho 1.2.
- Timer 44 → 48, peso 800, badge con tracking 1.2.
- Sin cambio de lógica de `ui` / `onAction`.

### changelog_261120_000013 — 6a7b44b
**design: Button premium con sombra dorada en primary**

- `src/components/atoms/Button.tsx`
- `primary` con fondo dorado `#D4AF37`, texto `#0A0A0C` y sombra `goldGlow`.
- `outline` con borde 1.2 dorado.
- Mantiene `primary | secondary | outline | danger` y `sm | md | lg`.

### changelog_261120_000014 — 5ddb50a
**design: Pill premium con tracking y punto 7px**

- `src/components/atoms/Pill.tsx`
- Padding y tracking premium, punto 6 → 7px, texto peso 800 con tracking 1.2.
- Mantiene lógica de `state` / `integrityType`.

### changelog_261120_000015 — 779742f
**design: Timeline premium con linea dorada**

- `src/components/organisms/Timeline.tsx`
- Línea vertical dorada sutil `mutedGoldTransparentStrong` en vez de gris.
- Círculo de icono 24 → 28, borde 1.2.
- Título con peso 800 y hora con tracking 1.
- Mantiene lógica de `events`.

### changelog_261120_000016 — 3910f53
**design: MetricTile premium con variante gold**

- `src/components/molecules/MetricTile.tsx`
- `highlight` ahora usa variante `gold` de `Surface` con sombra `goldGlow`.
- Valor 18 → 22, peso 800, etiqueta con tracking 1.2.
- Mantiene `label`, `value`, `icon`, `highlight`.

### changelog_261120_000017 — 1091916
**design: Header premium con titulo 800 y badge sistema**

- `src/components/molecules/Header.tsx`
- Título con peso 800 y tracking -0.3.
- Subtítulo con tracking 0.2.
- Badge de sistema en forma de píldora 999, punto 6 → 7px, texto con tracking 1.
- Mantiene `title`, `subtitle`, `healthStatus`.

### changelog_261120_000018 — 547730c
**design: Input premium con borde dorado al enfocar**

- `src/components/atoms/Input.tsx`
- Agrega estado `isFocused` para borde dorado `#D4AF37` al enfocar.
- Fondo `obsidian` → `graphite` para que se sienta como tarjeta.
- Etiqueta con peso 700 y tracking 1.2.
- Mantiene `label`, `error`, `containerStyle` + todo `TextInputProps`, y respeta `onFocus` / `onBlur` originales.

### changelog_261120_000019 — 9e11f5c
**fix: DailySetupModal — teclado no cubre input**

- `src/components/modals/DailySetupModal.tsx`
- Fix de teclado para que no tape el input al configurar jornada.
- Mantiene lógica de `startSession` / destino / alias.

### changelog_261120_000020 — DestinationModal
**fix: DestinationModal — teclado no cubre input**

- `src/components/modals/DestinationModal.tsx`
- Fix de teclado para que no tape el input al elegir destino.
- Mantiene regla: Destino = dirección real geocodificable, Alias = solo etiqueta.
- Hash no registrado en bitácora, commit aplicado como `DestinationModal` antes de `bac2635`.

### changelog_261120_000021 — bac2635
**fix: LunchModal — teclado no cubre input**

- `src/components/modals/LunchModal.tsx`
- Fix de teclado para que no tape el input de minutos de lunch.
- Mantiene regla: valor de Ajustes es solo default, valor del modal es el valor real del día, una sola deducción.

### changelog_261120_000022 — 3a30ab4
**fix: EditSessionModal — teclado no cubre input**

- `src/components/modals/EditSessionModal.tsx`
- Fix de teclado para que no tape el input al editar sesión.
- Mantiene edición sin romper totales / historial.

### changelog_261120_000023 — 65e79d9
**fix: ExitDetectionModal — limpieza de import muerto**

- `src/components/modals/ExitDetectionModal.tsx`
- Elimina import muerto de `Input` que no se usaba.
- Sin cambio de lógica de salida / traslado / fin de jornada.

### changelog_261120_000024 — 51ba241
**fix(notifications): check-in inmediato si ya estás adentro, sin duplicado del task de geofence**

- `src/services/sessionEngine/SessionEngineService.ts`
- `src/services/geofence/GeofenceService.ts`
- Causa: `startSession` ponía `ACTIVA` a las `1:29` cuando `alreadyInside = true`, pero no notificaba. El task `BACKGROUND_GEOFENCE_TASK` disparaba `Enter` tarde a las `13:33` y notificaba aunque ya estaba `ACTIVA`.
- Fix en `startSession`: si `alreadyInside`, notifica al momento con `Check-in Automático`.
- Fix en `GeofenceService`: `Enter` solo notifica si realmente hizo transición de `ESPERANDO` o `TRASLADO` a `ACTIVA` (`shouldNotify`). Si ya estaba `ACTIVA`, no duplica.
- Fix en `Exit`: solo notifica si sí había sesión `ACTIVA` para pasar a `SALIDA`.
- Corrige `TS2555` en `runAsync` y `}` extra que dejaba `else if (Exit)` huérfano.
- `npx tsc --noEmit` limpio.

## Ajustes — Split Trabajador vs Administrador

### changelog_261120_000025 — ca989af
**feat(settings): split UserSettings Worker vs Admin + PIN hash + validation types**

- Tipos de Settings divididos en Worker vs Admin.
- Agrega tipo para PIN hash + tipos de validación.
- Worker no puede tocar campos de Admin por tipos.
- Sin cambio de UI en este commit, solo contratos.

### changelog_261120_000026 — 108756a
**feat(db): migrate settings table Worker vs Admin + PIN hash columns**

- `DatabaseService`
- Migración de tabla `settings` para columnas Worker vs Admin + `PIN hash`.
- Mantiene datos existentes, no borra ajustes previos.

### changelog_261120_000027 — 563f077
**feat(settings): SettingsService Worker vs Admin + PIN hash SHA256 + separate saves**

- `src/services/settings/SettingsService.ts`
- Saves separados: `saveWorker` / `saveAdmin`, no un solo save que pise al otro.
- PIN guardado como hash SHA256, no en claro.
- Validación separada por rol.

### changelog_261120_000028 — 16587c8
**feat(settings): Ajustes split Worker vs Admin tabs + PIN lock + masked + separate saves**

- `src/screens/AjustesScreen.tsx`
- Tabs `TRABAJADOR` / `ADMINISTRADOR 🔒`.
- Trabajador sin PIN. Administrador bloqueado con PIN, vista enmascarada de nombre, correo, dirección, tarifa, multiplicador, radio y dirección principal.
- Botones separados: `Guardar Ajustes de Trabajador` / `Guardar Cambios de Administrador`.
- Admin pide confirmación: `Estos cambios afectan nómina, geocerca y control. ¿Confirmas guardar?`
- Dirty-state separado por tab: `Sin cambios` vs `Tienes cambios sin guardar`.
- QA en S22+ dev build: guardado Trabajador OK, cambio de PIN OK, desbloqueo Admin OK, guardado Admin OK, enmascarado OK, diálogo de confirmación OK.

### changelog_261120_000029 — 641ec5f
**fix(settings): quitar placeholder extra en INSERT 46 vs 45 columnas**

- `src/services/settings/SettingsService.ts`
- Causa: `INSERT INTO settings (...) VALUES (...)` tenía 46 `?` para 45 columnas. SQLite lanzaba `46 values for 45 columns` al guardar Trabajador o crear PIN.
- Fix: quitar un `?` de más. Queda `columnas=45 placeholders=45`.
- Verificado con conteo por regex + `npx tsc --noEmit` limpio.
- Pusheado como `HEAD -> origin/chore/upgrade-sdk-54` en `641ec5f`, `git status` limpio, sin `ahead`.

---

- Rama `chore/upgrade-sdk-54` en commit `641ec5f`, pusheada.
- `git status` limpio.
- `npx tsc --noEmit` sin errores.
- PR #1 y PR #2 en Draft, sin merge.
- Diseño premium aplicado a Hoy: `tokens` + `Surface` + `HeroCard` + `Button` + `Pill` + `Timeline` + `MetricTile` + `Header` + `Input`.
- Ajustes split Worker / Admin funcionando en dev build.

## QA pendiente en dispositivo (SDK 54 dev build)

- Destino real / Alias etiqueta estando ya dentro -> auto-activar a ACTIVA.
- Lejos del destino -> quedar ESPERANDO.
- Destino Principal -> quedar manual, sin auto check-in.
- Onboarding, Hoy, Historial, Reportes PDF, Ajustes persistencia.
- Modales: DailySetup / Destination / Lunch / EditSession / ExitDetection.
- Permiso geofence background y enter/exit.
- Cableado transversal Ajustes: Hoy / SessionEngine deben leer `geofenceRadius`, `gracePeriodMinutes`, `entryToleranceMinutes`, `principalAddress`; GeofenceService debe releer radio tras save Admin; PDF / Reportes deben usar `nombre`, `empresa`, `hourlyRate`, `overtimeMultiplier`, `currency`; notificaciones deben respetar `soundEnabled`, `vibrationEnabled`, `entryReminderEnabled`, `dailyReminder`.
- Toast tapa título `AJUSTES` — bajar toast / `marginTop` para que no cubra header.
- Normalizar `startDate` a `YYYY-MM-DD` con guiones, `20190308` -> `2019-03-08`, en save / validación Admin.
- Cableado idioma: `EN` seleccionado deja UI en español — verificar tras reinicio completo y cablear si sigue en español.
- Decidir radio geofence producción: prueba usó 1500 m, muy grande para producción.
- Build: `eas build --profile development --platform android`, instalar APK, `npx expo start --dev-client`.


<============================================================================================================================================================================================================================================================================================================================================================================================================>


- Rama `chore/upgrade-sdk-54` en commit `51ba241`, pusheada.
- `npx tsc --noEmit` sin errores.
- PR #1 y PR #2 en Draft, sin merge.

### changelog_261120_000019 — 9e11f5c
**fix: DailySetupModal — teclado no cubre input**

- `src/components/modals/DailySetupModal.tsx`
- Fix de teclado para que no tape el input al configurar jornada.
- Mantiene lógica de `startSession` / destino / alias.

### changelog_261120_000020 — DestinationModal
**fix: DestinationModal — teclado no cubre input**

- `src/components/modals/DestinationModal.tsx`
- Fix de teclado para que no tape el input al elegir destino.
- Mantiene regla: Destino = dirección real geocodificable, Alias = solo etiqueta.
- Hash no registrado en bitácora, commit aplicado como `DestinationModal` antes de `bac2635`.

### changelog_261120_000021 — bac2635
**fix: LunchModal — teclado no cubre input**

- `src/components/modals/LunchModal.tsx`
- Fix de teclado para que no tape el input de minutos de lunch.
- Mantiene regla: valor de Ajustes es solo default, valor del modal es el valor real del día, una sola deducción.

### changelog_261120_000022 — 3a30ab4
**fix: EditSessionModal — teclado no cubre input**

- `src/components/modals/EditSessionModal.tsx`
- Fix de teclado para que no tape el input al editar sesión.
- Mantiene edición sin romper totales / historial.

### changelog_261120_000023 — 65e79d9
**fix: ExitDetectionModal — limpieza de import muerto**

- `src/components/modals/ExitDetectionModal.tsx`
- Elimina import muerto de `Input` que no se usaba.
- Sin cambio de lógica de salida / traslado / fin de jornada.

### changelog_261120_000024 — 51ba241
**fix(notifications): check-in inmediato si ya estás adentro, sin duplicado del task de geofence**

- `src/services/sessionEngine/SessionEngineService.ts`
- `src/services/geofence/GeofenceService.ts`
- Causa: `startSession` ponía `ACTIVA` a las `1:29` cuando `alreadyInside = true`, pero no notificaba. El task `BACKGROUND_GEOFENCE_TASK` disparaba `Enter` tarde a las `13:33` y notificaba aunque ya estaba `ACTIVA`.
- Fix en `startSession`: si `alreadyInside`, notifica al momento con `Check-in Automático`.
- Fix en `GeofenceService`: `Enter` solo notifica si realmente hizo transición de `ESPERANDO` o `TRASLADO` a `ACTIVA` (`shouldNotify`). Si ya estaba `ACTIVA`, no duplica.
- Fix en `Exit`: solo notifica si sí había sesión `ACTIVA` para pasar a `SALIDA`.
- Corrige `TS2555` en `runAsync` y `}` extra que dejaba `else if (Exit)` huérfano.
- `npx tsc --noEmit` limpio.

- Rama `chore/upgrade-sdk-54` en commit `547730c`, pusheada.
- Diseño premium aplicado a sistema base + Hoy + Header + Input.

### changelog_261120_000017 — 1091916
**design: Header premium con titulo 800 y badge sistema**

- `src/components/molecules/Header.tsx`
- Título con peso 800 y tracking -0.3.
- Subtítulo con tracking 0.2.
- Badge de sistema en forma de píldora 999, punto 6 → 7px, texto con tracking 1.
- Mantiene `title`, `subtitle`, `healthStatus`.

### changelog_261120_000018 — 547730c
**design: Input premium con borde dorado al enfocar**

- `src/components/atoms/Input.tsx`
- Agrega estado `isFocused` para borde dorado `#D4AF37` al enfocar.
- Fondo `obsidian` → `graphite` para que se sienta como tarjeta.
- Etiqueta con peso 700 y tracking 1.2.
- Mantiene `label`, `error`, `containerStyle` + todo `TextInputProps`, y respeta `onFocus` / `onBlur` originales.

#=====

- Rama `chore/upgrade-sdk-54` en commit `3910f53`, pusheada.
- `git status` limpio.
- `npx tsc --noEmit` sin errores.
- PR #1 y PR #2 en Draft, sin merge.
- Diseño premium aplicado a Hoy: `tokens` + `Surface` + `HeroCard` + `Button` + `Pill` + `Timeline` + `MetricTile`.

---

## Diseño Premium — Sistema #0A0A0C / #D4AF37

### changelog_261120_000010 — e59469c
**design: aplica sistema premium #0A0A0C / dorado #D4AF37 a tokens**

- `src/theme/tokens.ts`
- `obsidian` `#050505` → `#0A0A0C`, `mutedGold` `#C5A059` → `#D4AF37`.
- Agrega `mutedGoldLight #E8C86A` y `mutedGoldTransparentStrong`.
- `h1` 32 → 34 con peso 800, `h2` 24 → 26.
- `RADIUS.cards` 20 → 24, nuevo `RADIUS.hero` 28.
- Nuevo `SHADOWS` con `card`, `hero` y `goldGlow`.
- Mantiene todos los exports para no romper `Button`, `Surface`, `HeroCard`, `Timeline`.

### changelog_261120_000011 — 573be09
**design: Surface premium con variante gold y sombras**

- `src/components/atoms/Surface.tsx`
- Nueva variante `gold` con borde dorado `#D4AF37` y sombra `goldGlow`.
- `elevated` / `highlight` usan sombra `card`.
- Mantiene `base | elevated | highlight` para no romper nada.

### changelog_261120_000012 — 12eaba9
**design: HeroCard premium con sombra hero y timer 48**

- `src/components/organisms/HeroCard.tsx`
- `Surface` con `radius="hero"` y sombra `hero`.
- Borde con `ui.theme.color`, ancho 1.2.
- Timer 44 → 48, peso 800, badge con tracking 1.2.
- Sin cambio de lógica de `ui` / `onAction`.

### changelog_261120_000013 — 6a7b44b
**design: Button premium con sombra dorada en primary**

- `src/components/atoms/Button.tsx`
- `primary` con fondo dorado `#D4AF37`, texto `#0A0A0C` y sombra `goldGlow`.
- `outline` con borde 1.2 dorado.
- Mantiene `primary | secondary | outline | danger` y `sm | md | lg`.

### changelog_261120_000014 — 5ddb50a
**design: Pill premium con tracking y punto 7px**

- `src/components/atoms/Pill.tsx`
- Padding y tracking premium, punto 6 → 7px, texto peso 800 con tracking 1.2.
- Mantiene lógica de `state` / `integrityType`.

### changelog_261120_000015 — 779742f
**design: Timeline premium con linea dorada**

- `src/components/organisms/Timeline.tsx`
- Línea vertical dorada sutil `mutedGoldTransparentStrong` en vez de gris.
- Círculo de icono 24 → 28, borde 1.2.
- Título con peso 800 y hora con tracking 1.
- Mantiene lógica de `events`.

### changelog_261120_000016 — 3910f53
**design: MetricTile premium con variante gold**

- `src/components/molecules/MetricTile.tsx`
- `highlight` ahora usa variante `gold` de `Surface` con sombra `goldGlow`.
- Valor 18 → 22, peso 800, etiqueta con tracking 1.2.
- Mantiene `label`, `value`, `icon`, `highlight`.

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
