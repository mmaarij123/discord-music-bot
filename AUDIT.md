# Code and dependency audit — 1 November 2026

The audit covered production modules, command/button routing, queue and player transitions, concurrent guild ownership, voice recovery, extractor/FFmpeg subprocesses, cookie handling, logging, configuration, dependencies, tests, verification scripts and deployment documentation. It is a code/runtime check, not a claim that every external source or live Discord scenario was tested.

## Removed

- Completed slash-command migration: `src/commands/register.js`, `deploy-commands.js`, their obsolete tests, the npm deploy command and join-time REST cleanup. The bot uses prefix commands and music buttons; new guilds need no registration request.
- Obsolete slash-interaction handling and redundant button branches. Unrelated interactions are ignored, while current-message/nonce and voice permissions still protect music controls.
- Unused Discord application/guild ID settings, progress-update interval configuration and the write-only catalogDuration property. Spotify application credentials remain supported.
- Unused variables/imports, unreachable video branches after an early return and unused promise-executor return values. Stale setup/troubleshooting instructions were updated.

The remaining **36 runtime modules** are all reachable from `src/index.js`; no orphan production modules were found. No runtime dependencies were removed: native Opus is actually used, opusscript remains its portable fallback, and spotify-url-info still serves public Spotify URL imports. External adapters and diagnostic scripts remain because they support documented features and validation.

## Issues fixed

1. Creating a player for another guild could reclaim a session whose discovery/voice preparation was still pending. Active imports and idle-timeout holds now protect that session from stale-session reclamation.
2. The five-failure limit previously applied only to startup errors. Consecutive runtime failures could drain an entire queue. Both startup and runtime track failures now share the limit; upcoming tracks remain queued, and an explicit play/skip or successful completion resets it.
3. A null artist entry could make Spotify normalization throw and fail a usable track/import. Invalid artists are omitted, malformed titles are rejected, and YouTube normalization rejects invalid text types.
4. Logger redaction was shallow. Nested credentials/headers/cookies are now omitted, nested URLs are redacted, and traversal is bounded for circular/deep objects. No actual credential exposure was observed in this audit.
5. Syntax verification now skips the secrets directory. Cookie directory safety validation was moved out of a finally block, removing unsafe control flow while retaining bounded cleanup and directory confinement.

## Checks executed

| Check | Result |
|---|---|
| Node built-in automated tests | **175 passed**, zero failures/skips |
| ESLint 10.14.0 static scan | **61 files**, zero errors/warnings |
| JavaScript syntax verification | Passed |
| Runtime import reachability | 36/36 modules reachable |
| npm dependency compatibility | All direct dependencies resolved; no invalid/extraneous direct packages |
| Doctor | Node 24.22.2, FFmpeg 9.0, yt-dlp 2026.10.26, Opus/DAVE and configured local-cookie format passed |
| Official Spotify API | Real authentication and catalog metadata search passed; no credentials/tokens printed |
| Real local paced audio | FFmpeg/Opus, pause, paused seek, full next-track playback, completion and fresh playback passed |
| Real permitted YouTube audio | Ten Opus packets passed with configured cookies |
| Real permitted remote ending | Last eight seconds completed naturally at 634.62/635 seconds, zero retries/notices, clean idle |

The remote source was the official Blender Foundation Creative Commons video. Audio probes were offline and sent no messages or voice packets to Discord. The normal bot restart/ready check confirms login, not human listening in a voice channel.

Machine-readable evidence: [automated tests](validation/automated-tests.tap), [static scan](validation/static-audit.json), [dependency scan](validation/dependency-audit.json).

## Unresolved dependency advisory

`npm audit` currently reports **7 moderate package findings, zero high/critical**, propagated from one minimatch advisory through `glob → rimraf → @discordjs/node-pre-gyp → @discordjs/opus → prism-media → @discordjs/voice`. The installed minimatch is 3.1.5. npm reports no automatic compatible fix. The [upstream advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249) lists versions below 11.0.1 as affected; its detailed description concerns attacker-controlled glob-pattern amplification.

The affected chain is used by native Opus installation/cleaning utilities. This bot does not pass Discord searches, URLs or queue values as glob patterns to those utilities. That reduces the observed application exposure; it does not remove npm's finding. Native Opus remains installed because it is used for actual encoding and improves VPS efficiency. Blindly overriding minimatch/rimraf to new majors would break the legacy callable/callback APIs expected by the existing installer. No force upgrade, package-source patch or audit suppression was applied.

An upstream compatible release or a separately validated installer migration is still needed. The existing CI audit check remains strict and will report/fail on these findings. Re-run `npm audit` when dependencies/advisory data change; this audit does not claim a vulnerability-free dependency tree.

## Deployment result

The bot was restarted after the changes and verified to reach Discord ready in three guilds with prefix `>`. Environment credentials, the original local cookie JSON and its converted export were preserved. Cookie exports and credential values remain excluded from release ZIPs. Queue state remains in memory and resets during restart, as documented.
