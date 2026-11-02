# Full code audit — 2 November 2026

Reviewed all 44 runtime modules and the supplied launchers, diagnostics, smoke checks and deployment configuration. The review covered command parsing/routing, exact-owner and voice permissions, per-guild queue/state transitions, recovery/stop races, persistent DJ messages, metadata/matching, local-file containment, cookie isolation, subprocess handling, cache lifetimes and shutdown supervision. Current command replies remain local; the custom Discohook help/mention designs and the permanent DJ player are preserved.

## Confirmed fixes

- Released-session cleanup was not tracked after its player/presenter left the manager maps. Shutdown could finish before a pending final notice or presenter cleanup. The manager now tracks every release, waits for both cleanup operations even if one fails, and drains that work before audio/client shutdown.
- Cached Discord message references and owner tokens survived session release indefinitely. They are now removed after cleanup when the retiring presenter still owns the entry. A newer session's ownership is preserved; saved DJ message IDs remain on disk and are fetched again when needed.
- A missing/inaccessible log channel prevented player binding, blocking otherwise valid play/join requests. Log lookup failures now produce a structured local warning and disable that notice destination while playback and the DJ player continue. Notices are not redirected into the DJ/command channel. Selecting a working log channel restores delivery.
- Failed empty join requests retained their host/session. They now release those resources, allowing the next session to claim its actual host. A successful voice join is preserved if only its text acknowledgement fails.
- An already-cancelled withAbort call ignored an operation that had already begun, potentially leaving its rejection unhandled. It now observes that operation while returning the cancellation reason. Subprocess failure handling is idempotent, preventing repeated termination launches for oversized output; it also preserves falsy abort reasons.
- Invalid YouTube/local-library durations could enter timing as negative/infinite values. They now normalize to unknown. Invalid local titles are rejected before playback, malformed optional metadata is normalized, a missing media root has a useful error, and safe filenames beginning with two dots are accepted without weakening traversal checks.

## Dead code and duplication removed

The generated command-description strings became unused when help switched to the operator's fixed Discohook JSON; those duplicate strings and the unused description field were removed. Owner-command membership is now derived from the existing ownerOnly definitions instead of maintained in a second list. Local discovery now uses metadata from the same validated manifest read, removing the second read and the window where metadata could change between validation and return. Session message references are released rather than retained as unused runtime state.

Queue history, internal queue clearing, recovery offsets, optional metadata/recommendation adapters, the portable Opus fallback, cache TTLs and persistent message IDs remain active and were retained. No dependency was removed solely to make npm audit appear clean. No runtime dependency versions changed.

## Executed validation

| Check | Result |
|---|---|
| Node test suite | **309 passed**, zero failures/skips; ten new regression cases |
| Expanded ESLint scan | **77 JavaScript files**, zero errors/warnings |
| JavaScript syntax | All files passed |
| Runtime import reachability | **44/44 modules** reachable; no orphan runtime modules |
| Installed dependency tree | Six direct/optional packages present; no missing/invalid package |
| Runtime doctor | Node 24.22.2, FFmpeg 9.0, yt-dlp 2026.10.26, Opus/DAVE and cookie format checks passed |
| Real paced local playback | Pause, paused interruption recovery, natural completion, queue transition, complete 12-second second track and fresh playback passed |
| Real Spotify checks | Client Credentials authentication/search, one public track and 50 accessible public playlist entries passed |
| Real YouTube checks | Search/weighted matching and permitted Blender source extraction → FFmpeg → ten Opus packets passed |
| Windows launchers | Read-only start/stop checks passed without starting a duplicate or stopping the running bot |
| Historical private paths | No actual .env, cookie export, node_modules, log or key paths found in Git history |

Evidence: [test run](validation/automated-tests.tap), [static analysis](validation/static-audit.json), [reachability](validation/reachability.json), [fresh dependency audit](validation/dependency-audit.json). The controlled local interruption warning during the paced test is intentional. Public-provider results apply to this host/time; 50 accessible playlist entries are not a completeness guarantee.

Discord messages, channel permissions and queue controls were mocked in automated tests. Provider/local probes sent no Discord messages or voice packets, and a ten-packet source probe is not a full-song listening test. Gateway ready verifies login rather than audible voice delivery. PM2 behavior is configuration/test covered; PM2 itself was not run on this Windows host. Ubuntu CI was not executed locally.

## Open upstream dependency finding

The fresh npm audit still reports **7 moderate affected-package findings, zero high/critical**, propagated from the [minimatch advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249) through glob/rimraf in the native Opus installation chain. npm reports no automatic compatible fix. A blind major override breaks the callable/callback APIs used by the older chain, so none was applied. Native Opus is used at runtime and retained for encoding efficiency; the portable fallback remains available.

Discord command values are not passed to those installation utilities as glob patterns, which limits the observed application exposure but does not resolve the package advisory. The strict CI audit step remains enabled and will report/fail on this finding. Dependency versions were not changed or audit results suppressed.

## Deployment and privacy

The validated update is deployed through the existing Windows launcher, then checked for one supervised worker and real Discord gateway ready. Existing local DJ message IDs are retained. The .env/cookie contents are checked against a private before/after hash baseline, without printing their values. Exact staged files are scanned against local secret/cookie values and prohibited paths before upload to the existing private GitHub repository. Repository privacy, final commit and file tree are verified. The release ZIP excludes runtime settings, secrets, logs, media, node_modules and Git data.
