# Full code and dependency audit — 1 November 2026

The audit covers every runtime module, prefix commands and buttons, per-guild queues, playback transitions, connection recovery, FFmpeg/yt-dlp lifecycle, metadata adapters, cache cleanup, log/DJ routing, configuration, credentials and deployment checks. External providers and real Discord listening remain separate from mocked tests.

## Cleanup completed

- Removed the unused discovery-progress callback and its obsolete provider-status strings. No runtime command, script or test supplied that callback; the existing single Searching/Added reply remains the command interface.
- Removed the unused public export of the internal media-provider error classifier. Its error handling remains active inside subprocess execution.
- Removed the write-only audio-handle exitCode field; decoder failures still carry classified exit status for safe logging.
- Removed an obsolete slash-command predicate from a button test fixture.

All **39 runtime modules** are reachable through static ESM imports from src/index.js. No orphan module was found or deleted. Every remaining exported symbol has a consumer in runtime code, tests or supported diagnostic scripts. Native Opus, its portable fallback, local playback, lawful optional adapters and provider smoke scripts remain in use and were retained. The Spotify retry-after field is used by the connection checker and was retained.

## Bugs fixed

1. **Pending join ownership and guild isolation.** A join requester was assigned ownership only after voice connection completed. During asynchronous presenter/channel preparation, the session also lacked the hold that protects pending play requests from another guild's stale-session cleanup. Join now claims its host immediately, holds the session throughout preparation/connection/reply and releases the hold on success or failure. The host can cancel while outside voice without waiting for setup to finish.
2. **Cancelling a handshake without an external signal.** Destroying a voice connection did not cancel the library's pending Ready waiter when join had no caller signal. Stop could therefore queue behind the handshake's 20-second timeout. VoiceSession now owns a cancellable join waiter, aborts it during destruction and removes it after completion. Existing caller cancellation, bounded recovery and no-rejoin-on-removal behavior remain covered.
3. **Split UTF-8 metadata.** Subprocess stdout decoded each buffer independently. A reproduced byte split inside an emoji introduced replacement characters, which could corrupt Urdu or other multilingual titles and matching. The native StringDecoder now preserves partial characters across chunks and flushes at close, retaining the existing byte limit, deadlines and safe subprocess arguments.

## Checks executed

| Check | Result |
|---|---|
| Node built-in automated tests | **237 passed**, zero failures/skips |
| ESLint 10.14.0 | **68 JavaScript files**, zero errors/warnings, including seven additional dead/unsafe-code rules |
| JavaScript syntax checks | Passed |
| ESM reachability and export review | 39/39 runtime modules reachable; no orphan modules or unused exports |
| Installed dependency tree | Six direct/optional packages present; no missing or invalid package reported |
| Local runtime doctor | Node 24.22.2, FFmpeg 9.0, yt-dlp 2026.10.26, native Opus and DAVE available; cookie format valid |
| Real local paced playback | Pause, paused seek, near-end completion, full 12-second next track, queue transition and fresh play passed |
| Real Spotify metadata | Client Credentials authentication and official search passed without displaying credentials/tokens |
| Real permitted YouTube source | Blender Creative Commons source passed yt-dlp → FFmpeg → ten Opus packets, then disposal |

The four new regression tests cover pending-join host cancellation, protection from cross-guild reclamation and cleanup after setup failure, split Unicode subprocess output, and cancellation of the real voice library's waiter against a fake connection. Network/channel delivery is mocked in command tests. Audio smoke checks sent no packets or messages to Discord. A successful bot login after restart confirms gateway readiness, not full-song human listening.

Evidence: [automated tests](validation/automated-tests.tap), [static scan](validation/static-audit.json), [reachability](validation/reachability.json), [dependency scan](validation/dependency-audit.json). Historical feature checks are retained in [VALIDATION.md](VALIDATION.md).

## Dependency limitation

The fresh npm audit still reports **7 moderate package findings, zero high/critical**, propagated from one [upstream minimatch advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249) through glob/rimraf and the native Opus installer. npm reports no automatic compatible fix. The reviewed advisory lists versions below 11.0.1 as affected and describes attacker-controlled pattern amplification.

The bot does not supply Discord input as glob patterns to those installation utilities. That limits the observed runtime exposure; it does not eliminate the audit finding. Replacing old callback/callable APIs with incompatible major versions would require a separately validated installer migration. Native Opus is actively used and retained for encoding efficiency. No force override or audit suppression was applied; the strict CI audit step will still fail/report these findings.

Registry review also found newer discord.js and dotenv releases; this cleanup retains the tested pinned versions, which satisfy the current Node runtime. It does not silently introduce a dotenv major migration or claim all packages are latest.

## Deployment and privacy

The bot is restarted after validation and checked for Discord ready. The existing private GitHub repository receives the reviewed source and validation reports after an index scan against local credential/cookie values and prohibited paths. The remote repository's privacy, commit and file tree are verified. Local .env, actual cookie exports, runtime guild preferences, logs, media and node_modules remain excluded. The release ZIP is rebuilt from the same secret-scanned tracked files. Credentials and cookie exports are preserved locally; no secret rotation or cookie deletion is part of this audit. Queues are in memory and reset during restart.
