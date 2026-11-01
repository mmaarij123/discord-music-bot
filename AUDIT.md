# Full code audit — 2 November 2026

The audit reviewed all 43 runtime modules: command parsing/dispatch, exact-owner controls, same-voice/session-host permissions, queue and playback transitions, source matching/discovery, FFmpeg/yt-dlp subprocess lifecycle, connection recovery, caching, credential handling, log/DJ/help routing, shutdown/restart supervision, Windows launchers and deployment configuration. Historical changes are recorded in VALIDATION.md.

## Confirmed issue and fix

Help was routed through the configured music log destination. A deleted/inaccessible log channel could also prevent help from working, and placing help among text-only local replies without a separate permission check would lose its clear Embed Links error.

The message router now treats help as a local reply and checks Embed Links in the invoking channel. Normal help, malformed help usage and permission failures stay in that channel/thread. Help never resolves the configured log or DJ destination. Existing play confirmations and owner/setup acknowledgements remain local; other music-control replies and playback notices retain their configured log routing, and the automatic player remains in its DJ destination.

Four new tests cover two invoking channels with independent log/DJ settings, missing destinations without any channel lookup, local usage/Embed Links errors, and custom-prefix uppercase help in a thread with Send Messages in Threads permission. The pre-existing queue/log tests still exercise the unchanged music routing. No additional confirmed blocking runtime defect was found during this review; the dependency limitation below remains open.

## Current code and checks

| Check | Result |
|---|---|
| Automated Node tests | **279 passed**, zero failures/skips |
| Expanded ESLint 10.14.0 scan | **75 JavaScript files**, zero errors/warnings |
| Syntax checks | All JavaScript files passed |
| Runtime ESM reachability | **43/43 modules** reachable from wrapper/worker entrypoints, no orphan modules or unused exports |
| Command surface | **20 commands**, five player buttons; removed commands remain rejected |
| Installed package tree | All six direct/optional packages present, no missing/invalid dependency reported |
| Runtime doctor | Node 24.22.2, FFmpeg 9.0, yt-dlp 2026.10.26, Opus/DAVE and cookie-file format checks passed |
| Real local paced playback | Pause, paused interruption recovery, natural completion, queue transition, full 12-second next track and fresh playback passed |
| Real Spotify metadata | Authentication and official search passed without exposing credentials/tokens |
| Real permitted YouTube audio | Blender Creative Commons source passed extraction → FFmpeg → ten Opus packets, then disposal |

Evidence: [unit tests](validation/automated-tests.tap), [static scan](validation/static-audit.json), [reachability](validation/reachability.json), [dependency scan](validation/dependency-audit.json).

The review retained active functionality rather than deleting code based only on feature names. Internal queue clearing is used for stop/shutdown; history is bounded and supports autoplay; recovery offsets and paused-state restoration are used after interruptions even though public seek was removed. The three process/cache controls still accept only the exact ID 1037886658462371860, without server-admin exceptions. Manual disconnect remains terminal, transient reconnection is bounded, and shutdown exits are not automatically restarted by the standalone wrapper. PM2 runtime execution was not performed; the supplied configuration is checked by tests.

## Dependency finding still open

The fresh npm audit reports **7 moderate affected-package findings, zero high/critical**, propagated from one [minimatch advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249) through glob/rimraf and the native Opus installer. npm reports no automatic compatible fix. The installed callable/callback-based installer chain is not compatible with a blind major-version override. Native Opus is actually used for encoding and was retained; its portable fallback remains useful too.

Discord searches/URLs/queue values are not passed as glob patterns to those installation utilities. That reduces the observed application exposure, while npm's finding remains unresolved. No incompatible force override, dependency-source patch or audit suppression was applied. The strict CI npm-audit step still reports/fails on these findings. No runtime dependency was added or upgraded for this routing fix.

## Deployment and privacy

The bot is restarted after validation and checked for gateway ready with one supervised worker. The Windows launcher and exact-project stop helper remain available. The private .env and cookie exports are checked against a local before/after hash baseline, without displaying their contents. The staged source is scanned against known local credential/cookie values and prohibited paths before upload to the existing private repository; remote privacy, commit and file tree are verified. The release ZIP is rebuilt to match the scanned tracked files. Runtime data, media, logs and actual secret files remain excluded.

Discord sends, permission/channel lookups and help routing were mocked in automated tests. Provider probes and the paced local audio test sent no server messages or voice packets. Gateway ready confirms login rather than full-track human listening, and no real help message was posted in the user's server during validation.
