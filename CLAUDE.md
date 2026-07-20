# CLAUDE.md — Frontend (polla-frontend · Mundial 2026)

Orienta a Claude Code al trabajar en el **frontend**. La documentación COMPLETA del proyecto
entero (backend, frontend, base de datos, Firebase/notificaciones, infra, deploy, y los checklists
para **bajar/subir de producción**) está en **`PROJECT_HANDBOOK.md`** (en este mismo repo). Leé el
handbook para reactivación o contexto profundo; este archivo es el resumen operativo.

## Estado del proyecto
**ARCHIVADO** tras un Mundial 2026 exitoso (salieron 9 ganadores). Se baja de producción para
revivirlo en el próximo Mundial/polla. Para **bajarlo/subirlo igual que ahora**, ver
`PROJECT_HANDBOOK.md` **§10/§11**.

## Qué es este repo
App **Expo 54 / React Native 0.81 / Expo Router** (yarn 4) que buildea para **iOS, Android y Web**
(PWA). Backend NestJS en el repo hermano `nodejs_space` (`LeizarM/polla-backend`), apunta a
`https://app.esppapel.com:9443`. Este repo es `LeizarM/polla-frontend`. Owner EAS `renmleizar`,
projectId `64a3d4b2-b4d6-4ff0-8dc5-6f6eed85b8dc`, package `com.leizarm.mundial2026`.

## Comandos
```bash
yarn start                 # expo start
yarn web                   # expo start --web
yarn android / yarn ios
yarn build-icons           # node scripts/build-icons.js (requiere sharp)
# Export web (deploy): EXPO_PUBLIC_API_URL=https://app.esppapel.com:9443 npx expo export --platform web
```
**No hay `yarn test`** (jest-expo instalado pero sin script).

## Reglas críticas / gotchas (no romper)
- **Babel:** `react-native-worklets/plugin` DEBE ser el ÚLTIMO plugin (Reanimated 4). Usar el viejo
  `react-native-reanimated/plugin` → **crash en APK release** (a veces anda en dev y enmascara el bug).
- **`global.css` es el PRIMER import** en `app/_layout.tsx` (requisito NativeWind).
- **`services/api.ts`** auto-invalida queries tras POST/PATCH/PUT/DELETE (setTimeout 50ms). **NO
  agregar `invalidateQueries` manuales redundantes** para la misma key.
- **`constants/api.ts`:** `EXPO_PUBLIC_API_URL` gana; el **fallback móvil es prod hardcodeado**
  (`https://app.esppapel.com:9443`) — un OTA con env vacío no debe apuntar a localhost.
- **Storage:** el JWT SIEMPRE va por `services/secureStorage.ts` (nunca AsyncStorage). Logout limpia
  ambos.
- **`staleTime` real = 8000 ms** (React Query), pese a que docs viejas dicen 0.
- **Codificación de picks: `L`/`E`/`V`** (Local/Empate/Visitante).
- **Bug conocido** (no arreglado): `utils/flags.ts::getFlagImageUrl` devuelve SIEMPRE la bandera de
  Papúa Nueva Guinea — mitigado por el fallback de `TeamFlag` (usa `shield_url` o emoji).
- Guards de ruta en `app/_layout.tsx`: sin token → `/auth/login`; user → `/user`; admin → `/admin`;
  segmentos admin-only (`admin`, `admin-usuario`, `tournament`) expulsan no-admins.
- Convención: try/catch en todo path async; optional chaining + nullish coalescing (los errores de
  Expo web son silenciosos). Haptics solo iOS/Android.

## Features (dónde están)
- **Apuestas por jornada:** `app/quiniela/[id].tsx` (lock por-partido, reloj vivo 1s, picks L/E/V).
- **Ranking / bet-log:** `app/quiniela/ranking/[matchdayId].tsx`, `app/quiniela/bet-log/[matchdayId].tsx`
  (matriz de aciertos, revelado por-partido, flip card si `flip_own_picks`).
- **Polla Final:** `app/user/polla.tsx`, `app/admin/polla.tsx` (switch visibilidad + resolver),
  `app/admin/participar.tsx` (el admin también apuesta). Podio 1º-4º, puntos 12/8/4/2, repetidos
  permitidos, editable hasta `final_bet_deadline` (banner prominente), ofuscación de picks ajenos.
- **Resultados + avance de fase:** `app/admin/partidos.tsx` (setea marcador y `advanced_team_id` en
  partidos de eliminación); badge "Avanza:" read-only en `quiniela/[id]` y `tournament/matchday/[id]`.
- **Reportes PDF:** `services/downloadPdf.ts` (server-side pdfkit).
- **Avatares:** `services/avatar.ts` (comprime ≤500KB). **PWA/offline:** `public/sw.js` (Web Push,
  Background Sync). **Seguridad:** `components/security/*` (FLAG_SECURE, root detection, AdminRouteGuard).
- **Temas:** 7 paletas en `constants/palettes.ts` (default `claro`), `contexts/ThemeContext.tsx`.

## Build y distribución
- **OTA (JS/assets, mismo `runtimeVersion`):** `scripts/ota-update.ps1 -Message "..."` (branch
  `preview`). Fuerza la URL de prod — usar SIEMPRE este script, no `eas update` directo.
- **Build nativo** (deps nativas, permisos, plugins, o al subir `version`): `eas build --profile
  preview` (APK) / `production` (AAB). `app.json`: `version 1.0.0`, `runtimeVersion.policy appVersion`.
- **Web:** push a `main` → CI exporta y publica a la rama `web-build` (Plesk auto-pull en
  `apuestamundial.impexpap.com`).
- **SSL pinning** (`plugins/withSSLPinning.js`): `pin-set` expira **2027-01-01**; antes de esa fecha
  un cert de otra CA rompe APKs viejos → rebuild nativo con pines nuevos (no basta OTA). Ver handbook §7.8/§10.

## Idioma
Todo en español (UI, comentarios, commits). Commits terminan con:
`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
