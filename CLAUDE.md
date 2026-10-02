# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Moonlight**: an unofficial MoonBoard companion app (Expo / React Native, TypeScript) for iPhone and Android.
Browse and filter problems offline, log ascents locally, and light the board over Bluetooth LE.
The app lives in `moonboard/`. The rest of this file records the research that shaped the architecture.

## Commands

All run from `moonboard/`. `.npmrc` sets `legacy-peer-deps` because Expo 57's optional `react-dom` peer conflicts with lucide.

```bash
npm install                      # deps (Node 22)
npx expo install <pkg>           # always use this for Expo/RN packages, never npm add
npm run typecheck                # tsc --noEmit
npm run lint                     # expo lint (ESLint 9 flat config; ESLint 10 breaks eslint-plugin-react)
npx expo start                   # Metro dev server
npm run web                      # browser preview (Chrome: F12 > device toolbar > iPhone). Uses *.web.ts stubs, see below
npm run android                  # expo run:android (local dev build, needs Android SDK)
npm run build:android:dev        # eas build --profile development --platform android
npm run build:ios:dev            # eas build --profile development --platform ios (no Mac needed)
```

**Expo Go does not work** for this app: `react-native-ble-plx` and `expo-sqlite` are native modules, so a development
build is required (EAS cloud build or `expo run:android`). There is no Mac in this setup, so iOS builds go through EAS.
`ios/` and `android/` are generated (CNG); configure native things in `app.json` plugins, never by hand.

Quick logic test without a device (Node 22 can strip types):
```bash
node --experimental-strip-types path/to/test.mts   # import from 'file:///C:/.../src/lib/ble/protocol.ts'
```

## Installing on phones without app stores

- `.github/workflows/ios-ipa.yml` builds an **unsigned .ipa** on a macOS runner (`workflow_dispatch` or `v*` tag).
  Sign + install from Windows with Sideloadly using a free Apple ID (7-day validity, re-sideload weekly). A paid
  Apple Developer account + EAS is the only route to a 1-year signature / TestFlight.
- `.github/workflows/android-apk.yml` builds a release APK (debug keystore) installable directly on Android.
- Native `ios/` and `android/` folders are gitignored; CI regenerates them with `expo prebuild`.
- Scheme/workspace name is `Moonlight` (from `expo.name`); renaming the app in `app.json` breaks the iOS workflow paths.

## Web preview (how to see it on a PC)

There is no iOS Simulator on Windows, so `npm run web` + Chrome's device toolbar is the preview path. Metro picks
`*.web.ts` over `*.ts` automatically, and four modules have web variants that keep the same exports:
- `catalog/db.web.ts` filters `catalog/sample-problems.json` in memory (240 real problems each for 2016 and Mini 2025,
  regenerate from snapshots with a script if the shape changes).
- `catalog/snapshot.web.ts` fakes the manifest/download (the snapshot bucket has no CORS headers) and keeps "downloaded"
  state in localStorage.
- `ble/manager.web.ts` is a real Web Bluetooth implementation (Chrome/Edge desktop + Android; not iOS Safari).
- `logbook/db.web.ts` stores ascents in localStorage.
Keep the two variants' export lists in sync; `tsc` checks both.
**Pitfall:** a `.web.ts` file must never value-import from its own base name (`from './snapshot'`): on web Metro
resolves that to the `.web.ts` file itself and you get "Maximum call stack size exceeded". `import type` is fine
(erased). Put shared runtime helpers in a third file (e.g. `catalog/shared.ts`).
**Pitfall 2:** Metro's watcher on Windows often misses newly created files ("Unable to resolve module" although
`tsc` is happy). Restart with `npx expo start --clear`.

## Architecture

```
moonboard/src
  app/                     Expo Router. (tabs)/ = Problems, Logbook, Board, Settings.
    _layout.tsx            Root Stack + theme. (tabs)/_layout redirects to /onboarding when no layout chosen.
    onboarding.tsx         Pick layout, download its catalog. Writes settings.layoutId.
    problem/[uuid].tsx     Board render, "Light it up", log send, project flag.
    log/[uuid].tsx         Modal: attempts / felt grade / stars / notes -> logbook.
    filter.tsx             Modal: grade range chips, min ascents, tap-holds-on-board filter.
  components/              ui.tsx (Screen, Button, Chip, Segmented, EmptyState...), BoardView (SVG grid),
                           ProblemRow, GradeBadge, CatalogCard (download/refresh/remove a layout).
  lib/
    theme/                 Tokens + useTheme (dark-first; role colors green/blue/red).
    settings/store.ts      AsyncStorage-backed store, useSyncExternalStore. layoutId, angle, deviceId, LED options.
    constants/layouts.ts   Boardsesh layout ids -> name/rows/angles/mini. constants/data/*.json = extracted tables.
    catalog/snapshot.ts    Manifest fetch + per-layout download to Paths.document/catalogs (expo-file-system File API).
    catalog/db.ts          Opens the downloaded snapshot read-only via expo-sqlite `directory` param. All problem SQL.
    catalog/decode.ts      frames string -> holds via placements json; difficulty -> Font grade.
    catalog/filters.ts     In-memory filter store shared by list + filter modal. useProblems.ts = paged query hook.
    logbook/db.ts          App-owned SQLite (logbook.db): ascents + projects. Separate from catalogs on purpose.
    ble/protocol.ts        Pure functions: ledIndex, encodeFrame, chunk. Unit-tested via node strip-types.
    ble/manager.ts         Singleton BoardConnection over react-native-ble-plx; useBoard.ts binds it to React.
```

Data flow: onboarding/settings download a Boardsesh snapshot -> `catalogDb(layoutId)` opens it -> `queryProblems`
joins `board_climbs` with `board_climb_stats` on uuid (stats carry the angle; some climbs have NULL angle) ->
`decodeFrames` turns `p191r44...` into grid holds -> `BoardView` draws, `board.lightHolds` encodes to `l#S..,P..,E..#`.

Conventions: hold `col` is 0-based (A=0), `row` is 1-based (bottom=1). Benchmark == `benchmark_difficulty IS NOT NULL`.
Only `is_listed = 1 AND is_draft = 0` climbs are shown. Lists page 50 at a time.

## Key finding: there is no official MoonBoard API

Moon Climbing publishes no developer API and its app FAQ says it does not share data. Three routes exist:

| Route | Status | Use it for |
|---|---|---|
| **Boardsesh public snapshots + GraphQL** (community mirror) | Live, nightly, all 7 layouts, no auth | **Problem catalog — the recommended source** |
| Moon mobile-app REST API (`restapimoonboard.ems-x.com`) | Being sunset: Moon shipped a new app 2026-06-22 and announced the old API retires ~6 weeks after rollout. Wrappers unmaintained since 2023 | Avoid |
| moonboard.com website AJAX (cookie login) | Works for **user logbook** only, behind Cloudflare, UA-filtered, endpoints removed without notice | Importing a user's own logbook, via BoardLib |

Climbdex (lemeryfertitta/Climbdex) does **not** support MoonBoard. It is Aurora-board-only (Kilter/Tension/etc.).
Only its *shape* is reusable: SQLite catalog + thin server/PWA, hold-filter query, Web Bluetooth plumbing.

## Data source: Boardsesh snapshots

Manifest (verified live 2026-10-02):
`https://boardsesh-board-snapshots.t3.tigrisfiles.io/board-snapshots/v1/manifest.json`

Each entry is a per-layout SQLite file at
`.../board-snapshots/v1/moonboard/{layoutId}/<timestamp>.db`. Filter entries by `boardType == "moonboard"`.

Boardsesh MoonBoard `layoutId` values:

| layoutId | Layout | Climbs (2026-10-02) | Size |
|---|---|---|---|
| 1 | MoonBoard 2010 | 128 | <1 MB |
| 2 | MoonBoard 2016 | 95,705 | 53 MB |
| 3 | MoonBoard 2024 | 43,261 | 25 MB |
| 4 | Masters 2017 | 75,657 | 42 MB |
| 5 | Masters 2019 | 59,641 | 34 MB |
| 6 | Mini 2020 | 8,013 | 4 MB |
| 7 | Mini 2025 | 5,246 | 3 MB |

Snapshot schema (schemaVersion 10): tables `board_climbs`, `board_climb_stats`, `snapshot_meta`.
- `board_climbs`: `uuid` (PK), `layout_id`, `name`, `setter_username`, `angle`, `frames`, `is_listed`, `is_draft`,
  `created_at`, `updated_at`, `sync_seq`, `characteristics`, `required_set_ids`, `hold_fingerprint`.
- `board_climb_stats`: PK `(board_type, climb_uuid, angle)`, `display_difficulty`, `benchmark_difficulty`,
  `ascensionist_count`, `difficulty_average`, `quality_average`, `fa_username`.
- `snapshot_meta.watermark_sync_seq` is a decimal string (Postgres bigint); never parse it as a JS number.
  `sync_seq` is the incremental-sync watermark.

**Decoding (verified against Boardsesh source, 2026-10-02):**
- `frames` = `p<cell>r<role>...`. Cell id is a formula, identical for all layouts: `cell = (row-1)*11 + col + 1`
  with col 0-based (A=0) and row 1-based from the bottom. p191 = D18. Implemented in `lib/catalog/decode.ts`.
- Roles: 42 start (S), 43 hand (P), 44 finish (E). Moon foot/match moves are all stored as 43. 45-48 only appear in
  Boardsesh's BLE preview, never in saved climbs.
- `display_difficulty` uses the same scale as Aurora boards: 13 = 5A/5+ ... 18 = 6B ... 33 = 8C+. Round, then look up in
  `constants/data/difficulty-grades.json`. Values 10-12 never occur for MoonBoard.
- Benchmark iff `board_climb_stats.benchmark_difficulty IS NOT NULL AND > 0` for that (climb, angle). No flag column.
- `constants/data/moonboard-cells.json` lists which cells physically have a hold per layout (2016: 140, Masters/2024: 198,
  Mini 2020: 120, Mini 2025: 128). Used to draw sparse boards and limit hold-filter taps.
- Some `board_climbs.angle` values are NULL; always take the angle from `board_climb_stats`.
- 2016 has ~2k stats rows at 25° (0 benchmarks) vs 93k at 40°; the real 2016 board is 40° only, so `layouts.ts` lists just 40.
  2010, Mini 2020 and Mini 2025 are graded only at 40°. Masters 2017/2019 and 2024 have both 25° and 40°.
- Snapshot also has `board_holes`/`board_placements` tables for other boards; MoonBoard placement id there is
  `layoutId*1000 + cell`, which is NOT what frames use. Ignore those tables.
- Boardsesh GraphQL `searchClimbs(input)` exists as a fallback (fields: boardName, layoutId, angle, minGrade, maxGrade,
  onlyBenchmarks, holdsFilter, name, setter, sortBy...). Not used by the app.

Data is third-party and user-generated; grades/repeats can drift from Moon's own app. Depends on Boardsesh goodwill.

## Board geometry

Grid is 11 columns (A–K) × 18 rows (Mini: 12 rows), row 1 at the bottom. Hold ids are written `"E6"` style.
2024 layout uses all 198 positions; 2016 / Masters 2017 / Masters 2019 use sparse hold sets.
Board artwork and hold-set PNGs are Moon Climbing copyright: render a schematic grid with role-colored circles
rather than redistributing their images.

## Bluetooth LE protocol (lighting the board)

Simple, stable, and unchanged across box generations. No pairing or auth.

- Service: Nordic UART `6e400001-b5a3-f393-e0a9-e50e24dcca9e`; write (RX) `6e400002-...`; notify (TX) `6e400003-...`.
  Write-without-response. Scan by device name prefix `MoonBoard` / `Moonboard`.
- First-gen (2016, RedBearLab) box: service `713d0000-503e-4c75-ba94-3148f18d941e`, write char `713d0003-...`,
  write-with-response. Unverified on hardware by any open project.
- Frame: `l#S5,P9,P13,E18#`. Tokens are `<Role><ledIndex>`: `S` start, `P` progress/middle, `E` end. `l##` clears.
- Optional flag prefix before `l#`: `~D*` = also light the LED above the hold (app's "both lights"). e-sr's docs mention `~M*` for Mini
  boards but Boardsesh sends no flag and just uses rows=12 in the serpentine; the app does the same (flag exists in protocol.ts, unused).
- LED index: 0-based, column-major serpentine. Column A runs bottom→top (A1=0 ... A18=17), column B top→bottom, etc.
  Even col: `col*rows + (row-1)`; odd col: `col*rows + (rows-row)`. Some DIY boards are wired from the other end (flip flag).
- Chunk writes to ≤20 bytes with 5–30 ms gaps; larger MTUs silently truncate. v1 boxes cap ~250 bytes/frame (~49 LEDs).
- Web Bluetooth works on Chrome/Edge/Android only. iOS needs Bluefy or a native wrapper (Capacitor / WKWebView + CoreBluetooth).

Reference implementations: boardsesh `packages/shared/ble-protocol/src/moonboard.ts`, boardhang `docs/ble-hardware.md`,
willslawrence/moonboard (single HTML page driving a real v1 box), e-sr/moonboard and FabianRig/ArduinoMoonBoardLED
(firmware side, shows how the box parses frames).

## Moon's own endpoints (for reference only, fragile)

Website (cookie auth; needs browser-like `User-Agent`, `__RequestVerificationToken` + `form_key` scraped from the login form,
`POST https://moonboard.com/Account/Login` with `Login.Username` / `Login.Password`):
- `POST /Problems/GetProblems` — Kendo-grid filter syntax, e.g. `filter=setupId~eq~'15'~and~Holdsets~eq~'A,B,C'~and~Configuration~eq~'40'`
- `POST /Logbook/GetLogbook`, `POST /Logbook/GetLogbookEntries/{id}` — what BoardLib (`pip install boardlib`,
  `boardlib logbook moon...`) uses; the only sane way to import a user's existing Moon logbook. Moon's app also exports CSV.
- Web setup ids: 2016=1, Masters 2017=15, Masters 2019=17, Mini 2020=19, 2024=21. Angle ids differ per setup
  (2016: 40°=3; Masters: 25°=2, 40°=1; 2024: 25°=2, 40°=3).

Mobile API (`POST https://restapimoonboard.ems-x.com/token`, OAuth password grant, `client_id=com.moonclimbing.mb`,
`GET /v1/_moonapi/problems/v3/{holdsetupId}/{angleId}/{cursor}`): documented in spookykat/MoonBoard and rroohhh/moonboard-rs.
Being retired; do not build on it.

## Legal posture

No scraping / reverse-engineering clause found in Moon Climbing's T&Cs, and no known cease-and-desist against any
third-party MoonBoard project (Boardsesh, Boardhang, CruxCoach all operate openly). Moon is a UK company and could
assert database rights. Keep an "unofficial, not affiliated with Moon Climbing Ltd" disclaimer, avoid Moon branding
and artwork, prefer the community data path over Moon's servers.

## Reference projects

- **boardsesh/boardsesh** (Apache-2.0, very active): multi-board hub, source of the snapshots; `moonboard-sync`, `board-renderer`, `board-constants`, `ble-protocol` packages.
- **boardhang/boardhang-app** (MIT, active 2026): closest existing match to this project's goal. React/TS, flat JSON catalog, Web Bluetooth, local logbook + grade pyramid.
- **CruxCoach/CruxCoach** (GPL-3, Kotlin Multiplatform): offline Android client, encrypted logbook, `LEGAL.md` worth reading.
- **lemeryfertitta/BoardLib** (MIT, Python): Moon logbook import only. **lemeryfertitta/Climbdex**: architecture reference, no MoonBoard.
- **smchase/Moonboard-Guidebook** (MIT): `benchmarks.json` for all years/angles.
- Aurora protocol / schema writeup for the "SQLite catalog + frames string + role circles" pattern: https://bazun.me/blog/kiterboard
