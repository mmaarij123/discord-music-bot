# Validation record

Validated on **30 October 2026**, on Windows x64. Initial provider/audio checks ran without a Discord token. The user subsequently configured the token locally and requested live deployment and public command registration. No credential values are recorded here. This records observed results, not an assertion that every source or Discord server will work.

## Runtime and dependencies

- Project-local Node.js **24.22.2** ran the tests and probes. The machine's default Node was **24.16.0**; upgrade the default Node before running `npm start` normally. The project enforces **>=24.17.0**.
- FFmpeg **9.0** was available on PATH.
- yt-dlp **2026.10.26**, installed with Python's `[default]` extras including EJS, was used for live provider checks. It was installed in a workspace-local tooling environment; configure your own YTDLP_PATH or install it on PATH as documented.
- discord.js **14.27.0**, @discordjs/voice **0.19.2**, and @snazzah/davey **0.1.12** loaded successfully. AES-256-GCM was available in Node crypto.
- Both the portable opusscript **0.1.1** path and optional native Opus path were exercised with real encoding. An initial clean install succeeded using the portable fallback after the optional native install failed. A subsequent foreground optional installation compiled native @discordjs/opus **0.10.0** successfully using the installed Windows C++ build tools.
- The optional Opus installer brings deprecated upstream build utilities. The vulnerable archive dependency is overridden to `tar` **7.5.22**; Prism's older optional opusscript peer range is overridden to **0.1.1**, whose encoding was tested. These override choices should be reviewed during upgrades.
- Dependency audit after the override: **0 known vulnerabilities reported**. This is a registry audit result at validation time, not a guarantee of absence of vulnerabilities.

## Executed checks

| Check | Observed result |
|---|---|
| `npm install` and a clean `npm ci` | Completed; portable Opus available when native optional installation failed. Native subsequently built successfully. |
| `npm run check` | All project JavaScript syntax checks passed. |
| `npm test` | **138 tests passed**, 0 failed, 0 skipped/cancelled, including startup optimization, shared-request cancellation, cache expiry, next-track metadata warmup and existing playback/Spotify/prefix behavior. |
| `npm run test:audio` | Real generated WAV → FFmpeg PCM → volume → Opus, **100 packets / 25,089 bytes**, resources disposed. |
| Doctor with configured tool paths | Node, FFmpeg, yt-dlp, crypto, DAVE and an Opus implementation available; token reported missing. |
| Startup with missing token | Exited with code 1 and a clear DISCORD_TOKEN configuration error; no login attempted. |
| Spotify public track metadata | **1 accessible track** returned for the sample URL in `scripts/provider-smoke.js`. |
| Spotify public playlist metadata | **50 accessible entries** returned. Import explicitly warned that public metadata could be incomplete; full playlist completeness was not verified. |
| YouTube search + weighted matching | A close Stephen Sanchez / Until I Found You candidate was selected from multiple search results. |
| Permitted YouTube extraction + decode | Official Blender Foundation Big Buck Bunny video `aqz-KE-bpKQ` identified by extractor metadata as **Creative Commons Attribution (reuse allowed)**. Read **10 Opus packets** through the real pipeline, then disposed; no full-file download. |
| Process cleanup | No remaining FFmpeg or yt-dlp processes observed after completed smoke checks. |

Automated coverage includes track normalization, strict URL validation, metadata normalization, weighted song scoring/version exclusion, queue caps/order/remove/move/jump, repeats, shuffle, bounded history, duplicate skips including the last track, guild isolation, playback states, seek/pause/resume/volume, source failures, stop during preparation, cancellation before enqueue, error/idle races, idle/24/7 behavior, voice loss and reconnectable queues, autoplay filtering, command authorization/validation, expired interactions/buttons, deleted/coalesced player messages, TTL cache behavior, concurrency limits, safe subprocess arguments/timeouts, and local-media containment.

The full final test-run output is included in [validation/automated-tests.tap](validation/automated-tests.tap).

Discord behavior is covered by mocks in these tests. Network provider probes used real public endpoints, without music API keys. Provider results can change by date, network, source or region.

## Public deployment follow-up

- Real bot login succeeded and the restarted process emitted `ready` with **2 connected guilds**.
- Discord's current-application API confirmed **Public Bot enabled** and **OAuth2 code grant not required**.
- All **22 commands were registered globally** and read back successfully from Discord.
- **22 old guild-specific music commands were removed**, with **0 cleanup failures**. A follow-up query found **0 remaining guild commands** across the bot's two accessible servers.
- Server/guild ID configuration was removed. Deployment always publishes globally and discovers servers only to clean legacy registrations; new server installs need no manual ID configuration.
- The runtime removes old guild music copies on joins/rejoins, preserving unrelated commands. Tests verify that global deployment must succeed before cleanup can run.
- No invite is automatically accepted on behalf of a server administrator; the bot still needs an authorized server invitation.

## Not verified here

- Joining an actual server voice channel, DAVE negotiation with Discord, hearing sound in Discord, and clicking real Discord components were not verified by the agent. Login and global command registration are verified as recorded above.
- Real multi-server voice playback, real voice server moves/network recovery, long-duration load/soak testing or actual 24-hour uptime. These behaviors have automated state coverage and bounded runtime handling but require deployment validation.
- Native Ubuntu execution, PM2 boot persistence, or the supplied GitHub Actions matrix. Cross-platform source, installation instructions and a Windows/Ubuntu workflow are included; only Windows execution was performed in this workspace.
- Completeness of Spotify playlists/albums; inaccessible/private metadata; other regions; restricted YouTube content; every provider format. No attempt was made to bypass access restrictions.
- Default public Spotify text search (unavailable by design), external recommendation adapters or lyric redistribution services. These are explicit optional adapter interfaces, with informative unavailable behavior.
- Direct-stream playback against an operator-owned external host. The authorized adapter is implemented and validation-tested; local real audio and permitted YouTube real decoding were verified separately.

Use the real-server checklist in README.md before relying on the bot in your production server. Keep the lockfile, update media tools, and repeat the smoke tests after changes.

## Prefix migration — 31 October 2026

The user requested replacing slash commands with a default `>` prefix. The previous global-deployment section above records the earlier deployment, not the current command interface.

- All 22 commands now use text prefixes. Examples: `>play Artist Song`, `>queue`, `>volume 70`, `>seek 1:30`, `>move 2 5`, `>247 on`, `>autoplay off`, `>help`.
- PREFIX is configurable and defaults to `>`. Server/guild IDs remain unnecessary. Player buttons retain the same voice-channel and permission checks as prefix commands.
- The runtime requests GuildMessages and MessageContent in addition to voice/guild intents. The live application API confirmed GatewayMessageContentLimited was already enabled before migration.
- All project syntax checks and **100 automated tests passed**. The final TAP output includes prefix parsing, invalid inputs, complete play queries, help rendering, ordinary/bot/webhook/DM filtering, channel/voice/admin permissions, typed zero/false options, coalesced replies, deleted reply recovery, cooldowns, and old slash fallback.
- Prefix message replies are ordinary channel replies. They do not log unrelated message content or expose credentials. Unit tests use mocked messages; they do not send test messages to real Discord users.
- The cleanup script removes only known music slash commands and preserves unrelated application commands. It does not register slash commands anymore.

- Live migration removed **22 global music slash commands**, with **0 cleanup failures**. Follow-up API checks confirmed **0 global slash commands** and **0 guild slash commands** across the two accessible servers.
- The new process emitted **ready**, with **commandMode: prefix**, **prefix: >**, and **2 guilds**. Discord accepted the Message Content gateway intent; Public Bot remains enabled.

Actual user-message delivery and audible voice playback still require testing in Discord as a human user. No test messages were posted to real server channels by the agent.

## Playback interruption fix — 31 October 2026

The user reported that songs could stop partway through while the bot remained in voice, then fail to continue. Existing logs did not identify the precise cause of their particular stream, but an audio-scheduler failure was reproduced without Discord: the default five missed frames ended an 800 ms stream at 400 ms when a 400 ms gap occurred. With the corrected missing-frame tolerance, the same real scheduler consumed all 800 ms.

- Added bounded PCM buffering and transient FFmpeg network/5xx reconnects. Normal EOF and access denials are not retried by FFmpeg.
- Premature EOF and source errors now use one per-track retry budget and re-extract the source at the actually heard playback position. Exhaustion leaves the player able to accept a new request. Late errors from older resources cannot stop their replacements.
- Voice sessions restore their subscription before reuse; a resource waiting indefinitely for voice gets a deadline and a cleared session. Logs now distinguish resource start, end, interruption and retry, including played position and expected duration without signed source URLs.
- **110 automated tests passed**, plus all syntax checks. Tests cover early EOF resume offsets, cumulative retry exhaustion, a fresh play after exhaustion, stop during recovery, natural completion after recovery and stale resource callbacks.
- The real generated-tone decoder smoke passed with **100 Opus packets / 25,089 bytes**.
- The new real-time playback smoke passed pause, paused seek, last-seconds completion, the entire 12-second next track, queue advancement, cleanup and a fresh playback request. It used no Discord connection.
- The permitted official Blender YouTube source passed extraction/decoding again. A separate real-time test sought to the last eight seconds of the 635-second video and completed naturally at **634.62 seconds**, with zero recovery attempts, no notices and all resources released. No full-file download or real server messages were used.

The updated live process emitted `ready` after restart with **3 guilds**, prefix mode and prefix `>`, with no startup errors. No FFmpeg or yt-dlp processes from the completed test probes remained. Human listening in Discord is still needed to confirm the original reported incident is resolved on that server/network.

## Search reply wording — 1 November 2026

At the user's request, search stages now use one `Searching of` reply with the requested/resolved title in inline code. Single-track confirmations use `Added` plus the resolved title in inline code, followed by `in the queue`. Routine Spotify text-search fallback diagnostics no longer appear in the queue confirmation; they remain available in debug logging. Playlist incompleteness and queue-cap notices still appear, and terminal search failures use short explicit not-found messages. The bot was kept offline as previously requested; no live server messages were sent for this wording change.

## Optional official Spotify text search — 1 November 2026

The user added their Spotify application credentials directly to the ignored local .env file and authorized a connection check. A native-fetch Client Credentials adapter was added without new dependencies; no secret or access-token values were displayed, logged or included in the deliverable archive.

- Real Client Credentials authentication succeeded.
- Real official catalog search succeeded for Stephen Sanchez / Until I Found You: **178 seconds**, artist **Stephen Sanchez**, album **Until I Found You**.
- The bot's actual discovery service was exercised without Discord: it returned **Spotify metadata**, **177.72-second** precise duration and a matched YouTube candidate. The optional market was blank during this successful check. This tested discovery wiring only, not audio playback.
- The adapter is optional: both local credential values enable it for runtime text search; a custom search adapter takes precedence. Public URL imports retain their existing public resolver. No Spotify audio is downloaded or played.
- **124 automated tests passed**, plus all syntax checks. Added coverage includes credential/header routing, token/search caching, shared token acquisition, caller cancellation, token expiry and one-time refresh, ranking/version rejection, missing results, safe auth/access errors, quota cooldown, malformed responses, normalization and fallback.
- The bot was kept offline; no real Discord messages or voice playback were attempted. Endpoint access is a technical check, not a determination that the broader app use case complies with Spotify's Developer Policy. Restrictions on combining Spotify content with another service's streams are documented in README.md.

## Faster startup — 1 November 2026

The user reported slow song starts. A live baseline identified repeated extraction of the same direct video: discovery and playback each launched yt-dlp and cost roughly six seconds. The implementation now reuses short-lived validated source metadata, overlaps Spotify/YouTube candidate discovery, limits optional Spotify wait time, shares identical concurrent metadata requests and overlaps initial source resolution with voice connection. Only one upcoming track can receive a late metadata warmup per player; background work is globally capped and yields foreground capacity. No audio is prefetched or saved to disk.

The same live benchmark script was run before/after using this Windows host and current network:

| Measured stage | Before | After |
|---|---:|---:|
| Cold text discovery, Stephen Sanchez / Until I Found You | 3728 ms | 2552 ms |
| Cold selected-video audio metadata | 6353 ms | 6896 ms |
| Warm text discovery | 1 ms | 1 ms |
| Warm selected-video audio metadata | 6368 ms | 0 ms (rounded, cached) |
| Cold permitted direct-video discovery | 6308 ms | 5789 ms |
| Cold permitted direct-video metadata-to-first-Opus-packet stage | 6197 ms | 329 ms |
| **Cold direct-video total** | **12505 ms** | **6119 ms** |
| **Warm direct-video total** | **11822 ms** | **153 ms** |

The direct-video audio probe used the official Blender Foundation Creative Commons Big Buck Bunny video. Text-search probes fetched metadata only. These are single network samples; source extraction itself remains provider-bound and was slightly slower in the after sample. The improvement comes from avoiding duplicate/repeated work and overlapping independent stages. Timings exclude Discord voice handshakes, real server messages and human listening; the warm result depends on a fresh cache entry. They are not guarantees for arbitrary songs or network conditions.

- **138 automated tests passed**, with no failures/skips, plus all syntax checks. New coverage includes direct-video extraction reuse, conservative signed-URL expiry, fresh recovery, denied/restricted source handling, normalized search caching, shared metadata cancellation, concurrent discovery, optional-metadata deadlines, canonical matching fallback and bounded/cancellable next-source warmup.
- Real local decoder/Opus smoke and real-time playback regression checks passed again, including pause, paused seek, end-of-track transitions and fresh playback after completion.
- The permitted remote last-eight-seconds test passed again at 634.62 / 635 seconds, with zero recovery attempts or notices.
- The buffering tolerance and bounded recovery fixes remain active. Recovery bypasses cached source metadata, and provider-denied URLs are invalidated instead of repeatedly reused.
- The bot was left offline as previously requested. Reproduce the benchmark with `RUN_PROVIDER_TESTS=true npm run benchmark:startup` after configuring the media-tool paths.

## Reported audio access errors — 1 November 2026

The running bot logged two audio failures immediately after resource startup, both classified as ACCESS_DENIED. Those old logs did not retain an HTTP status or safe decoder reason, so they cannot establish the exact underlying cause. A code review found that matching any `403`/`401` substring in decoder stderr could incorrectly classify another decoder failure when a signed URL happened to contain those digits.

- Corrected HTTP status classification and added safe status/exit/reason diagnostics, track title and video ID. Raw stderr and signed URLs remain private.
- A reused cached link can be renewed once on HTTP denial, during startup or bounded runtime recovery. A freshly extracted link that is still denied remains terminal; no alternate clients, cookies, authentication or restriction bypass was added.
- **145 automated tests passed**, with no failures/skips; all JavaScript syntax checks and the real local FFmpeg/Opus smoke test passed. Seven new regression tests cover misleading URL digits, actual 401/403 responses, cached-link renewal and cleanup, terminal fresh denial, bounded attempts and resuming at heard position.
- The official Blender Creative Commons source passed a real ten-Opus-packet remote smoke test. The user's selected Saiyaara candidate was resolved again and played for **8.02 seconds** through the real FFmpeg/Opus pipeline and voice audio scheduler, using prewarmed source metadata, with no decoder errors. This was an offline audio test; no Discord voice packets or chat messages were sent.
- The supplied second title did not produce a confident discovery match during the check, so its audio was not verified. The old reported denial could not be reliably reproduced; full-song and live Discord listening remain unverified for this incident.
- The updated bot was restarted and reached Discord ready in three guilds with prefix `>`. A user playback check was requested.

## Optional local YouTube account cookies — 1 November 2026

The user chose to begin with one account. Added the optional YOUTUBE_COOKIES_FILE setting; no cookie values were requested in chat, read from a browser, or added to the repository. The setting remains disabled until the user saves their own local export and configures its path.

- **156 automated tests passed**, no failures/skips, plus all JavaScript syntax checks. Eleven new tests cover optional configuration, Netscape/HttpOnly/session-cookie parsing, domain restrictions, safe errors, expiry, bounded file size, path/symlink confinement, private per-request copies, concurrent isolation, original-file preservation, cleanup on failure/cancellation and actual safe subprocess argument wiring with a fake local extractor.
- The doctor check passed with cookies disabled and reports format validation separately from real account authentication. The permitted Blender video again passed real yt-dlp → FFmpeg → ten Opus packets with anonymous extraction, then cleanup.
- Git and release ZIP rules exclude cookie exports and the entire secrets directory except its empty placeholder. Actual account-authenticated extraction, cookie acceptance and live Discord playback with an account have **not** been verified because the user has not yet supplied a local export. No multi-account rotation was added.

### Operator-provided export check — 1 November 2026

The user subsequently saved their own JSON export locally under secrets and requested a live check. Its structure was inspected without printing cookie values; 20 YouTube-only entries were converted to a validated Netscape file, preserving the original JSON. All 20 entries passed the expiry/session-cookie check. The local .env now enables that export.

- A real yt-dlp metadata probe detected YouTube account cookies, completed extraction successfully and emitted no invalid/rotated-account-cookie warning. This does not establish account entitlement to every video or future cookie validity.
- With the cookie file explicitly enabled, both the official Blender Creative Commons source and the user's previously selected Saiyaara video passed real yt-dlp → FFmpeg → ten Opus packets, followed by disposal. These were short offline audio probes; full-track and live Discord voice listening were not tested.
- The bot was restarted with the local cookie setting. No credential values were printed, placed into source/config examples, or included in the release ZIP. Temporary request jars were removed; only the user's original JSON and converted Netscape export remain locally.

## Further startup optimization — 1 November 2026

The user requested immediate-feeling playback. Benchmarked the existing cookie-enabled implementation, then overlapped the voice handshake with discovery, removed search-message delivery from the audio startup path, started source metadata warming before the final authorization check and increased the source metadata cache default/local setting from 60 to 300 seconds. Actual signed-URL expiry and access-error invalidation still bound reuse. No audio files or credentials are persisted in the cache.

Fast source extraction now skips unused HLS/DASH manifests and translated subtitles using a documented yt-dlp option. It retains normal clients, webpage/account validation, player configuration and signature handling. A missing format/source gets one full-extraction fallback; access denials and network errors do not trigger alternate extraction strategies. The option can be disabled with YOUTUBE_FAST_EXTRACTION=false. An exploratory experiment skipping player config requests was not shipped because the marginal timing difference did not justify reduced extraction robustness.

One before/after network sample per stage on the same host, with the local cookie file enabled:

| Stage | Before | After |
|---|---:|---:|
| Cold text discovery | 3631 ms | 3645 ms |
| Cold selected-video source metadata | 7191 ms | 5189 ms |
| Warm text discovery | 1 ms | 1 ms |
| Warm selected-video source metadata | 0 ms rounded | 0 ms rounded |
| Cold permitted direct-video discovery | 6889 ms | 4863 ms |
| Cold direct-video first-Opus stage | 383 ms | 351 ms |
| **Cold permitted direct-video total** | **7272 ms** | **5214 ms** |
| Warm direct-video total | 167 ms | 175 ms |

Text/selected-video probes fetched metadata only. Audio measurements used the official Blender Creative Commons source and exclude Discord voice handshakes, chat delivery and human listening. Warm startup remains about 0.17 seconds for the measured offline audio path; it was not faster in this single sample. Cache reuse now lasts up to five minutes rather than one minute, subject to URL validity. Cold YouTube requests remain network/provider-bound and are not instantaneous. Live voice overlap is covered by ordering/cancellation tests, not a timed real Discord connection.

- **172 automated tests passed**, no failures/skips; all JavaScript syntax checks passed. Sixteen new tests cover fast/full extraction, restriction handling, URL expiry, parallel voice/discovery, early source warming, nonblocking chat replies, channel changes, cancellation, idle timeout suspension/restoration and failed-request rollback. A real voice-library handshake waiter was cancelled against a fake connection without contacting Discord.
- Real-time local FFmpeg/Opus checks passed: pause, paused seek, near-end completion, full 12-second next track, queue advancement and fresh play after completion.
- The permitted remote final-eight-seconds check passed at 634.62/635 seconds with no recovery attempts/notices and clean disposal. The user's Saiyaara candidate again passed a ten-packet decoder/Opus probe with cookies and fast extraction enabled. Neither probe sent packets or messages to Discord.
- Local cookie files remain excluded from Git and the release archive. The running bot was restarted with the optimized settings.

## Full code audit and cleanup — 1 November 2026

See [AUDIT.md](AUDIT.md) for the current findings, cleanup, actual checks and unresolved dependency advisory. Completed legacy slash migration code/configuration and other unused code were removed. Guild preparation isolation, cumulative startup/runtime failure protection, malformed provider metadata and nested logger redaction received regression coverage.

The resulting suite has **175 passing tests**, zero failures/skips. This replaces five obsolete migration tests with eight audit regressions; it is not a claim that deleted migration functionality remains supported. All 36 remaining runtime modules are reachable, all 61 scanned JavaScript files pass static checks, and syntax verification passed. Real official Spotify search and local/remote permitted audio probes passed. npm audit reports **7 moderate findings propagated from one upstream minimatch advisory**, with no high/critical findings and no automatic compatible fix. Those findings remain visible in the saved report and strict CI check.

## Host stop, manual removal and cookie replacement — 1 November 2026

The user reproduced manual disconnect/rejoin loops and could not stop after changing voice channels. Stop/leave now require the session host or Manage Server permission and work from outside voice. Both commands and the Stop button always disconnect, clear the queue and cancel pending preparation/recovery. Gateway removal ends the session immediately, including in 24/7 mode. Voice close 4014 never sends an explicit rejoin; passive channel moves remain supported. Other transient failures retain two bounded recovery attempts, cancelled on stop. Late callbacks cannot revive stopped sessions.

**195 automated tests passed**, zero failures/skips; **63 JavaScript files** passed the static scan, and syntax checks passed. Twenty new tests cover the cases above plus local JSON-to-Netscape conversion, field/domain validation, safe error handling and atomic replacement with preservation on invalid input. The real-time local FFmpeg/Opus playback regression passed again. These checks mock Discord network events; they do not establish live human listening.

YOUTUBE_COOKIES_FILE was initially cleared after scans against the old account values. Automatic approval review blocked direct deletion, so operator cleanup was requested. The user replaced the JSON and manually deleted the old converted export; filesystem verification confirmed only the replacement JSON, freshly converted file and Git placeholder remain. Nineteen replacement entries passed validation and a real permitted-source ten-packet audio probe. Only that replacement path is enabled. A blank standalone JSON template and updated project ZIP were provided. An anonymous permitted-source probe also passed before enabling the replacement. The bot was restarted and the existing private GitHub repo updated with secret-free source, not the local `.env` or any real cookie exports.

## Persistent music log channel — 1 November 2026

Added the 23rd prefix command: `>logchannel #channelname` (also mention/ID, no-argument status and `off`). Manage Server users can configure it outside voice. New command replies and errors route to the chosen channel; player messages/notices use it too. Existing players move without restarting audio; old button nonces are invalidated. Missing/deleted destinations produce repair instructions rather than silently posting music elsewhere.

Settings survive manager/application restarts in a versioned local JSON file with atomic serialized writes. They remain independent across servers, and failed writes leave the current setting unchanged. Runtime data is excluded from Git and ZIPs. **214 tests passed** with no failures/skips, all syntax checks passed, and **67 JavaScript files** passed static analysis. Nineteen new tests cover actual manager factory reload, persistence, routing, permission/type/guild validation, malformed configuration, concurrent saves, errors, message edits and in-flight player relocation. Discord message sends/channel lookups were mocked; the user must select their real channel after deployment. No real log-channel messages were sent by the validation tools.

## Split command, log and DJ destinations — 1 November 2026

Added the 24th prefix command, `>djchannel`, independently from `>logchannel`. Play progress and queue confirmations stay in the invoking channel. Automatic player embeds/buttons use the DJ destination; notices and other command replies use the log destination. Old log-only preference files remain readable and migrate on update without losing IDs or assigning a DJ destination. Changing log preferences does not move/recreate the player; a configured DJ player is reused by `>nowplaying` instead of creating a snapshot in logs.

**223 automated tests passed** without failures/skips; all syntax checks passed, and **67 JavaScript files** passed static analysis. The new end-to-end mocked routing check verifies Searching/Added locally, exactly one DJ embed, playback notices in logs, preserved audio handles and no extra snapshot. Additional coverage includes migration, concurrent independent fields, resets, authorization and missing-channel recovery. A play channel can lack Embed Links when an authorized DJ channel supplies embeds.

The user's replacement cookie JSON contained **22 valid entries**. `npm run cookies:import` converted it locally and enabled its Netscape output, and a real permitted Blender source passed extraction → FFmpeg → ten Opus packets. No cookie values were printed, staged or archived. These probes did not connect to Discord voice or post server messages. The bot was restarted with the new cookie setting and existing private GitHub repository updated after secret scans.

## Fresh-source HTTP 403 and empty-startup fix — 1 November 2026

The user's Maula Mere Maula source returned real HTTP 403 during input opening, before any playback. Both fast and normal extraction produced failing format-251 URLs in repeated probes; normal extraction alone was not a sufficient fix. Source extraction now validates selected download candidates with yt-dlp `--check-formats`; full extraction is the default, while fast manifest skipping remains optional. Stable yt-dlp 2026.10.26 was verified current. No account rotation or access-control bypass was introduced.

An empty PCM EOF could trigger readable before the decoder close event and be returned as a successful resource. Startup now requires nonzero PCM bytes and waits for decoder status on empty EOF. Two new tests reproduce delayed 403/clean decoder exits with zero bytes; another verifies availability checks and the normal-mode default.

**226 automated tests passed**, zero failures/skips; syntax checks and the **67-file static scan** passed. Two independently extracted instances of the affected video played **4.02 seconds each** through real FFmpeg/Opus and the real audio scheduler without errors. Full-song and real Discord human listening remain unverified. Real-time local decoder/pause/seek/queue regression checks passed. The running bot was restarted and reached ready in three guilds; local credentials/cookies remained excluded from source publishing and ZIPs.

## Automatic five-minute cache cleanup — 1 November 2026

One manager-owned, unreferenced timer now clears all four in-memory provider caches every 300,000 milliseconds: YouTube search results, YouTube source metadata, public Spotify metadata and optional official Spotify search results. Existing per-entry expiry still applies. Cleanup preserves active audio handles, queues, credentials/cookies, authentication tokens and persistent guild settings. It does not cancel ongoing requests, which may refill caches with fresh results. Shutdown cancels the timer and clears remaining cache entries.

**229 automated tests passed**, zero failures/skips; all JavaScript syntax checks passed and **68 files** passed static analysis without errors/warnings. Three new tests use a controlled clock to verify the five-minute boundary, idle/expired and fresh entries, repeated intervals, cancellation and actual production-manager registration of all four caches. The manager test also verifies that playback handles and queued/current tracks survive periodic cleanup. These are deterministic tests; no five-minute wait or new live Discord audio probe was performed for this change.

## Disconnect notice delivery — 1 November 2026

The reported manual removal was present as a local `voice_removed` event, but the gateway handler did not emit a Discord notice. It now emits a disconnect/playback-stop/queue-cleared notice. Presenter disposal flushes its latest pending notice before final message cleanup, rather than losing it when the three-second coalescing timer is cancelled. Already-sent notices are cleared from pending state; closed sessions and disposed presenters ignore repeated/late events. Failed log sends are caught and do not prevent cleanup.

**233 automated tests passed**, zero failures/skips; all syntax checks and the **68-file static scan** passed. Four new tests cover actual event → manager release → configured log-channel delivery, duplicate removal events, separate command/DJ destinations, final-notice coalescing, no re-send after timed delivery, and cleanup when Discord rejects a log send. Existing host permissions, manual-disconnect/no-rejoin and bounded recovery tests also passed. Discord delivery was mocked; no real test message was posted in the user's server.

## Full follow-up audit and cleanup — 1 November 2026

Re-reviewed all 39 runtime modules and their command, player, provider, queue, resource, cache, channel-routing and security paths. Static ESM reachability found no orphan runtime modules. Removed the unused discovery-progress callback/status strings, an unused internal-helper export, the write-only audio-handle exitCode field and an obsolete slash-command test predicate. Remaining diagnostic scripts, metadata/audio adapters and Opus dependencies have actual consumers and were retained.

Fixed early join ownership/session holds, cancellation of a voice readiness waiter without an external caller signal, and UTF-8 metadata corruption across subprocess buffer boundaries. The Unicode failure and missing pending-join ownership/hold were reproduced before their fixes. Four regression tests use fake Discord/voice connections, including the real voice library's waiter; no live server messages were sent.

**237 automated tests passed**, zero failures/skips; **68 JavaScript files** passed the expanded static checks and syntax verification passed. Fresh installed dependency checks found no missing/invalid package. The runtime doctor passed with Node 24.22.2, FFmpeg 9.0, yt-dlp 2026.10.26, native Opus/DAVE and locally validated cookie format. Real Spotify authentication/search and a permitted Blender source's extraction/FFmpeg/ten-Opus-packet probe passed. The real-time local pause/seek/queue/full-12-second-next-track test passed. These are short/offline checks rather than full-song Discord listening.

The fresh npm audit retains 7 moderate findings from one upstream minimatch advisory, no high/critical finding and no automatic compatible fix. No incompatible force override, package removal or audit suppression was applied. The latest report in AUDIT.md and validation artifacts documents that limitation. Deployment restarts the bot and updates the existing private repository after secret scans, while preserving local credentials/cookies and excluding all private runtime files from source and ZIPs.

## Windows double-click launcher — 1 November 2026

Added Start Music Bot.bat with a Windows PowerShell helper. It resolves the project relative to the launcher, checks prerequisites, selects an installed compatible Node or existing workspace runtime, respects configured .env tool paths and falls back to the existing workspace yt-dlp when its default command is missing from PATH. It keeps logs in the foreground console, pauses when finished and guards concurrent clicks with a project-specific named mutex. A process check recognizes an existing bot using its absolute entry path with either Windows slash style. Independently managed npm/PM2 sessions should still be kept to one instance.

Executed PowerShell syntax validation, the helper's CheckOnly mode, real launcher startup to Discord ready in three guilds and the BAT itself through cmd.exe. The latter detected the running bot; process inspection confirmed exactly one bot remained. Validation used the current installed Node 24.22.1 and existing yt-dlp 2026.10.26. No real Discord messages or voice playback were sent by these launcher checks. No bot runtime JavaScript or automated tests changed, so the unit suite was not rerun for this launcher-only addition.
