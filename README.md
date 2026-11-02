# Music Bot

A self-hosted Discord music bot using Node.js ES modules, discord.js, @discordjs/voice, FFmpeg, yt-dlp, and public Spotify metadata. Spotify and YouTube API credentials are not required for the default mode. Optional official Spotify metadata search can use your own Client ID and Client Secret. There are no external databases, dashboards, or audio servers.

Spotify supplies **metadata only**. All audio comes from a supported public YouTube source or your authorized local/direct-stream library. Only play material you have permission to use and follow provider terms. An optional local YouTube cookie export can provide your own account session to yt-dlp. Age-restricted sources, regional restrictions, DRM and paywall bypasses remain unsupported.

## What works

- All 20 prefix commands (default `>`), including three controls restricted to the configured bot owner, plus five functional player buttons.
- Independent bounded queues and history per server; concurrent skips advance once; adding tracks leaves current playback running.
- Song/artist searches with weighted matching, official/Topic preferences, duration comparison, and rejection of unwanted covers, live performances, remixes, karaoke, nightcore, slowed and sped-up versions.
- Spotify track, album, and public playlist metadata through `spotify-url-info`. Public collections can be partial; imports always say so. No full Spotify audio or previews are played.
- YouTube video links and public playlists, bounded imports, lazy audio extraction, TTL search cache, and limited concurrent requests.
- FFmpeg streaming, dynamic volume, Opus encoding, pause/resume, deterministic resource disposal, bounded error recovery, idle disconnect, and optional 24/7 connection.
- Conservative autoplay: another track by a known artist, with recent-track/version filtering. A known matching artist/Topic channel is required. An optional recommendation adapter supports other lawful sources.
- Discord Components V2 player with a green container, artwork, album, playback status, requester mention, queue count, volume and nested controls. State changes update the player, with edits coalesced at least two seconds apart. Deleted player messages never interrupt audio.
- JSON logging with token/URL redaction, configuration validation, safe subprocess argument arrays, same-voice-channel authorization, and Manage Server checks for settings.
- A single search reply uses ``Searching of `song name` `` and then changes to ``Added `resolved song title` in the queue``. Metadata fallback details stay in debug diagnostics rather than cluttering chat. Failed searches finish with a concise not-found message; partial playlist and queue-limit notices remain visible.

**Explicit limitations:** Public Spotify text search has no supported built-in API-free endpoint. Plain-text input uses YouTube metadata unless you configure optional official Spotify credentials or a trusted Spotify search adapter; fallback details are available in debug diagnostics. Public metadata may change or be inaccessible by region. YouTube delivery may fail on some networks/VPS IP ranges. The bot reports such failures and can continue with your authorized library. 24/7 keeps a connection while the application runs; it cannot provide uptime while your host is offline. Queues, history and playback settings reset on restart/session release; the independent log/DJ channel destinations are saved separately on disk.

See [AUDIT.md](AUDIT.md) for the current code/dependency audit and [VALIDATION.md](VALIDATION.md) for the checks executed and remaining live Discord checks. A real Discord token and server are required to validate login, prefix handling and voice delivery; these are not simulated claims.

## Requirements and package choices

Use **Node.js 24.17.0 or newer**, preferably a supported patched LTS release. Validation used Node 24.22.2. Install FFmpeg and yt-dlp separately and put them on PATH, or configure absolute executable paths.

Direct package versions are pinned in `package.json` and `package-lock.json`: discord.js 14.27.0, @discordjs/voice 0.19.2, spotify-url-info 3.3.3, dotenv 17.4.2, opusscript 0.1.1, and optional native @discordjs/opus 0.10.0. Voice installs the DAVE encryption library transitively. Native Opus improves efficiency; if it cannot install, opusscript provides a portable fallback with higher CPU use. Native packages may need build tools on unusual platforms. `npm ci --omit=optional` also omits optional native platform packages, including DAVE binaries on some hosts: use ordinary `npm ci` for voice installations.

The optional native Opus installer depends on an older `tar` range. A targeted override pins `tar` 7.5.22 to remove known archive vulnerabilities; installation and encoding were checked with this override. Review it when updating Opus.

Prism's optional opusscript peer range predates opusscript 0.1.1. A targeted override selects 0.1.1; actual audio encoding was also tested with that portable fallback. `npm ls` checks the resolved graph without invalid peer dependencies. Native Opus may compile from source on Node 24 if an upstream prebuilt binary is absent; this is optional and can take several minutes.

Compatibility references: [voice installation and DAVE dependencies](https://discord.js.org/docs/packages/voice/0.19.2), [spotify-url-info metadata methods and collection limitations](https://github.com/microlinkhq/spotify-url-info), [yt-dlp installation](https://github.com/yt-dlp/yt-dlp#installation), [yt-dlp JavaScript runtime/EJS setup](https://github.com/yt-dlp/yt-dlp/wiki/EJS), and [Node.js downloads](https://nodejs.org/en/download).

yt-dlp needs its EJS component and a supported JavaScript runtime for current YouTube support. The bot explicitly passes its running Node executable as `--js-runtimes node:PATH`. The official yt-dlp executables and Python installation with `[default]` include EJS. The bot ignores machine/user yt-dlp configuration and plugin directories, so unrelated cookies, output templates, proxies and plugins cannot silently change execution.

## 1. Create the Discord application

1. Open the [Discord Developer Portal](https://discord.com/developers/applications), choose **New Application**, and name it.
2. Open **Bot**. Create the bot if prompted. Use **Reset Token** / token generation to obtain its token. Treat this like a password; keep it only in `.env`. Reset it if exposed.
3. Copy **Application ID** from **General Information** for the bot invite URL below. The runtime does not need an application ID setting.
4. Under **Bot**, enable **Public Bot** and leave **Requires OAuth2 Code Grant** off for ordinary server invites. No server/guild IDs are needed in configuration.
5. Under **OAuth2 → URL Generator**, select the **bot** scope (application-command scope is not required for prefix commands). Grant **View Channels**, **Send Messages**, **Embed Links**, **Read Message History**, **Connect**, and **Speak**. If using threads, also grant **Send Messages in Threads**. Enable **Message Content Intent** under **Bot → Privileged Gateway Intents**. Administrator, Server Members and Presence privileged intents are unnecessary.
6. Open the generated invite URL, select your server, and authorize it. You must have permission to add applications. Check channel permission overrides too.

The runtime requests Guilds, GuildVoiceStates, GuildMessages and MessageContent intents. All commands are server-only. Message Content Intent must also be enabled in the Developer Portal. Prefix command replies are ordinary channel messages, not ephemeral replies. Playback controls require a regular voice channel matching the active bot session, except stop/leave: only the session host or a Manage Server moderator may use these, including from outside voice. Stage channels are explicitly unsupported. A full voice channel must have room for the bot; Move Members is optional if you want it to enter full channels.

## 2. Windows development

Install a supported Node LTS release from the [official installer](https://nodejs.org/en/download). Verify `node --version` is at least 24.17.0. Windows Package Manager can install the media tools:

```powershell
winget install --exact --id Gyan.FFmpeg
winget install --exact --id yt-dlp.yt-dlp
```

Close and reopen PowerShell after installation so PATH refreshes. Enter the folder you received:

```powershell
cd 'C:\path\to\Music Bot'
node --version
ffmpeg -version
yt-dlp --version
npm ci
Copy-Item .env.example .env
notepad .env
npm run doctor
npm start
```

Set your bot token and enable Message Content Intent before starting. Application/server IDs are unnecessary in configuration. If tools are not on PATH, set `FFMPEG_PATH` and `YTDLP_PATH` to their full `.exe` paths in `.env`, for example `FFMPEG_PATH="C:/Tools/ffmpeg/bin/ffmpeg.exe"`. If native Opus needs to compile, install Python and Visual Studio Build Tools with the C++ workload; otherwise its optional failure should leave opusscript available. Use `npm run doctor` and the local audio smoke test to confirm.

Press Ctrl+C to stop cleanly. `npm run dev` restarts on source changes; it disconnects active music sessions. For production use one process, not watch mode.

For double-click startup on Windows, open **Start Music Bot.bat** in this folder. Keep its console open while the bot runs; press Ctrl+C to stop. The launcher uses Node 24.17+ from PATH, or the compatible workspace runtime when present, and respects `.env`. If yt-dlp is configured by its default command name and is absent from PATH, it can use the workspace's existing tool. Setup still requires installed npm dependencies and FFmpeg/yt-dlp. It starts `src/run.js`, which supervises one bot worker and replaces it only on an explicit restart request. Simultaneous launcher clicks are guarded; both the wrapper and legacy absolute `src/index.js` processes are detected. Avoid a separate duplicate supervisor instance. To check the launcher without starting a bot, run `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-windows.ps1 -CheckOnly`.

Double-click **Stop Music Bot.bat** to force-close this project's running bot and its audio/extractor child processes. It matches the absolute bot entry path, rechecks process identity and leaves other Node applications alone. Running it when the bot is offline is harmless. Unsaved in-memory queues are lost; Ctrl+C in the running console remains the graceful shutdown option. These launchers manage a local standalone process; use `pm2 stop music-bot` for a PM2-managed bot so its supervisor does not restart it. A non-destructive check is available with `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop-windows.ps1 -CheckOnly`.

## 3. Ubuntu / Linux setup

Install Node from the official [Node downloads](https://nodejs.org/en/download) or a trusted version manager. With an existing `nvm` installation, for example:

```bash
nvm install 24.22.2
nvm use 24.22.2
nvm alias default 24.22.2
node --version
sudo apt update
sudo apt install -y ffmpeg python3 python3-venv build-essential
mkdir -p "$HOME/.local/share/music-bot-tools"
python3 -m venv "$HOME/.local/share/music-bot-tools/venv"
"$HOME/.local/share/music-bot-tools/venv/bin/python" -m pip install -U 'yt-dlp[default]'
```

If you do not have nvm, this official prebuilt Node installation is another option on **x86-64 Ubuntu**. For ARM64, replace every `linux-x64` with `linux-arm64`. Download into a temporary working directory, check the archive's published checksum, and put the executable on PATH:

```bash
sudo apt update
sudo apt install -y curl xz-utils ca-certificates
mkdir -p /tmp/music-bot-node-setup
cd /tmp/music-bot-node-setup
curl --fail --location --remote-name https://nodejs.org/dist/v24.22.2/node-v24.22.2-linux-x64.tar.xz
curl --fail --location --remote-name https://nodejs.org/dist/v24.22.2/SHASUMS256.txt
sha256sum --check --ignore-missing SHASUMS256.txt
mkdir -p "$HOME/.local/lib"
tar -xJf node-v24.22.2-linux-x64.tar.xz -C "$HOME/.local/lib"
export PATH="$HOME/.local/lib/node-v24.22.2-linux-x64/bin:$PATH"
printf '\nexport PATH="$HOME/.local/lib/node-v24.22.2-linux-x64/bin:$PATH"\n' >> "$HOME/.profile"
node --version
sudo apt install -y ffmpeg python3 python3-venv build-essential
mkdir -p "$HOME/.local/share/music-bot-tools"
python3 -m venv "$HOME/.local/share/music-bot-tools/venv"
"$HOME/.local/share/music-bot-tools/venv/bin/python" -m pip install -U 'yt-dlp[default]'
```

Continue only when checksum verification says `OK`. The official download page also explains signature verification for the checksum file. Use one Node installation approach, then return to the project directory for the following steps.

Using a virtual environment avoids Ubuntu's system-Python package restrictions. Set `YTDLP_PATH=/home/YOUR_USER/.local/share/music-bot-tools/venv/bin/yt-dlp` in `.env` (substitute your actual username; `.env` does not expand `$HOME`). On minimal servers, native voice packages may also require the appropriate standard C/C++ runtime for the OS and architecture.

Copy the entire project, including the lockfile, to your Linux host:

```bash
cd '/path/to/Music Bot'
npm ci
cp .env.example .env
chmod 600 .env
nano .env
npm run doctor
npm run check
npm test
npm run test:audio
npm start
```

Do not copy Windows `node_modules` to Linux; install on the destination. Choose absolute executable paths if your service manager has a different PATH. Run from the project directory so `.env` is loaded.

## 4. Ubuntu VPS and PM2

Use a normal non-root account and follow the Linux installation above. Allow outbound HTTPS and Discord voice UDP traffic in your host and cloud firewall. No public inbound application port is needed. This bot is not an HTTP server. Some hosting providers block or rate-limit YouTube extraction; use the authorized library if that happens.

```bash
cd '/path/to/Music Bot'
npm install --global pm2
pm2 start ecosystem.config.cjs
pm2 logs music-bot --lines 50
pm2 status
pm2 save
pm2 startup
```

Run the exact privileged startup command PM2 prints, then `pm2 save` again. This registers process startup with your OS. PM2 is an optional process supervisor, not an application dependency. Its startup instructions may need refreshing after a Node version change.

```bash
pm2 restart music-bot --update-env
pm2 stop music-bot
pm2 start music-bot
```

The supplied ecosystem file runs **one forked instance** directly under PM2 and sets a restart delay and memory ceiling. It marks the worker as supervised and uses [PM2 stop_exit_codes](https://pm2.keymetrics.io/docs/usage/restart-strategies/#skip-auto-restart-for-specific-exit-codes) to keep an owner-requested shutdown offline while allowing restart/failure exits to restart. If you previously registered an older ecosystem configuration, re-register it with `pm2 delete music-bot`, `pm2 start ecosystem.config.cjs`, then `pm2 save`. Do not use PM2 cluster mode or multiple instances with the same token; in-memory queues and guild voice ownership must have one owner. Enable log rotation, for example with `pm2 install pm2-logrotate`, and monitor CPU/memory. The bot limits each FFmpeg process to one decoder thread, but multiple streams still consume CPU and bandwidth. Start small and adjust `MAX_PLAYERS` for your host.

## 5. Configuration

Copy `.env.example` to `.env`. Never commit `.env`, tokens, private media, or provider credentials.

| Variable | Default | Meaning |
|---|---|---|
| DISCORD_TOKEN | empty | Required normal bot token. Never share it. |
| PREFIX | > | Text command prefix, 1–5 characters without whitespace; restart after changing. |
| SPOTIFY_CLIENT_ID | empty | Optional Spotify developer application Client ID; pair with its Client Secret for official text metadata search. Use your Spotify application credentials, not your Discord application ID. |
| SPOTIFY_CLIENT_SECRET | empty | Optional Spotify application secret. Store only in .env; never paste it into chat or commit it. |
| SPOTIFY_MARKET | empty | Optional two-letter catalog country filter, such as PK for Pakistan. Leave empty for no explicit market filter; use the appropriate market for your app. |
| DEFAULT_VOLUME | 70 | Initial volume, integer 0–100. |
| MAX_QUEUE_LENGTH | 500 | Maximum upcoming entries per guild, 1–5000. Current track is separate. |
| MAX_PLAYLIST_TRACKS | 100 | Import cap, 1–1000. Spotify's public library usually exposes at most 100; raising this does not retrieve hidden entries. |
| IDLE_TIMEOUT_SECONDS | 300 | Delay before leaving after playback ends with 24/7 off; 10–86400. |
| AUTOPLAY_ENABLED | false | Initial autoplay setting for each new guild session. |
| ENABLE_247_MODE | false | Operator-only initial persistent connection setting; no Discord toggle command. Joins only when commanded. |
| LOG_LEVEL | info | debug, info, warn, or error. Logs are JSON on stdout. |
| FFMPEG_PATH | ffmpeg | Trusted executable name on PATH or absolute path. |
| YTDLP_PATH | yt-dlp | Trusted executable name on PATH or absolute path. |
| YOUTUBE_COOKIES_FILE | empty | Optional local Netscape YouTube cookie export, e.g. ./secrets/youtube.cookies.txt. Must stay inside the project secrets folder. Blank keeps anonymous extraction. Restart after enabling/replacing an export to clear source/search caches. |
| SEARCH_CACHE_SECONDS | 900 | Successful search/Spotify metadata TTL; 1–86400. Caches hold at most 250 keys each and are also fully cleared every five minutes. |
| AUDIO_SOURCE_CACHE_SECONDS | 300 | Short-lived successful YouTube source metadata cache; 0–300. Contains no song files. Near-expiry signed URLs are not reused; 0 disables caching/warmup. |
| YOUTUBE_FAST_EXTRACTION | false | Optional manifest-skipping optimization. Full extraction is the reliability default; candidate formats are availability-checked in either mode. |
| SPOTIFY_DISCOVERY_TIMEOUT_MS | 2000 | Optional Spotify metadata budget during startup, 250–10000 ms. Spotify and YouTube discovery run concurrently; a slow optional catalog lookup falls back to validated YouTube metadata. |
| METADATA_CONCURRENCY | 2 | Global concurrent provider subprocess/metadata operations; 1–8. |
| PROCESS_TIMEOUT_SECONDS | 45 | Metadata and audio-start deadline; 5–120. |
| MAX_TRACK_SECONDS | 7200 | Maximum supported track runtime; 10–86400. Live streams are not supported. |
| MAX_PLAYERS | 20 | Maximum retained guild sessions; 1–1000. Discovery also has a global request cap. |
| AUDIO_STALL_TIMEOUT_SECONDS | 20 | Consecutive missing-audio-frame tolerance before a stalled resource ends; 3–60. Ordinary short buffering gaps keep the current track. |
| PLAYBACK_RETRY_LIMIT | 2 | Maximum re-extractions/resumes for an interrupted track; 0–3. The budget spans the whole track and does not reset after a successful reconnect. |
| MEDIA_ROOT | ./media | Local media root; filesystem links escaping this root are denied. |
| MEDIA_MANIFEST | ./media.json | Trusted operator-owned authorized media catalog. |
| SPOTIFY_SEARCH_ADAPTER | empty | Optional trusted ESM module exporting `search`. |
| RECOMMENDATION_ADAPTER | empty | Optional trusted ESM module exporting `recommend`. |

Boolean variables accept exactly `true` or `false`. Paths for media and adapters resolve relative to the project root. Executable settings are not shell commands: do not append flags, `python -m`, or quotes within the path value. For a Python yt-dlp installation, point to its generated `yt-dlp` / `yt-dlp.exe` launcher.

`>autoplay` requires Manage Server permission and change only the current guild session. Both `>stop` and `>leave` override 24/7, clear the queue and disconnect. The first play/join requester owns that session; adding tracks does not transfer ownership. The host and Manage Server moderators can stop even after changing/leaving voice. Idle cleanup releases playback settings; environment defaults apply to new sessions. Application restarts reset queues/playback settings but retain the saved log/DJ channel destinations.

### Optional YouTube cookie file

Keep cookies on the host; never paste or upload them to chat, Discord, an issue, or a repository. They are account credentials. Export **only youtube.com** cookies in Netscape cookies.txt format from an account you control, following the [official yt-dlp export instructions](https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies). The official docs warn about account bans when using accounts with yt-dlp; cookies do not guarantee playback or resolve every HTTP 403.

1. Save the export as `secrets/youtube.cookies.txt` inside this project. Keep Windows file access limited to your user and the service account; on Linux use `chmod 700 secrets` and `chmod 600 secrets/youtube.cookies.txt`.
2. Set `YOUTUBE_COOKIES_FILE=./secrets/youtube.cookies.txt` in the local `.env`.
3. Run `npm run doctor`. It validates file format and expiry without printing any cookie values or logging into YouTube. A valid format does not establish that the account session is still accepted.
4. Restart the bot. Test a permitted public source with `npm run test:source -- VIDEO_URL` and then test live voice yourself. Clear the environment setting and restart to disable cookies.

For a JSON export, save your YouTube-only cookie array (or an object with a `cookies` array) as `secrets/youtube.cookies.json`, then run `npm run cookies:import`. The command validates and atomically converts it to Netscape format and enables the output path in your local `.env`; it prints counts only. Restart afterwards. An empty `[]` template is not a usable account export. Invalid JSON/fields leave the previous valid Netscape file untouched. To retire an old account, stop the bot, clear YOUTUBE_COOKIES_FILE, remove the old exports and temporary cookie directories, and restart; this also clears in-memory source caches. Local cleanup does not revoke browser sessions remotely.

The source export remains untouched. Every extractor request receives a private temporary copy under `secrets`, deleted when the tool finishes, fails or is cancelled. Concurrent requests cannot overwrite each other's cookie jars. Files outside the secrets directory, oversized/invalid exports, non-YouTube cookies and expired-only exports are rejected with safe messages. Cookie files and temporary copies are excluded from Git and release ZIPs. A hard host/process crash can leave a temporary directory under `secrets`; remove stale `.yt-cookies-*` directories only while the bot is stopped.

This supports **one account**, with no automatic multi-account rotation. Cookie-enabled live extraction is unverified until an operator supplies and tests a real local export. Fresh HTTP denials remain terminal; authentication does not grant permissions to play someone else's media or bypass other restrictions.

## 6. Start prefix commands

```bash
npm start
```

The default prefix is `>`. Send `>help`, `>play Artist Song`, `>queue`, or `>volume 70` in a server text channel. Set `PREFIX` in `.env` to change it, then restart. No slash registration and no server/guild IDs are required. Keep Public Bot enabled so administrators can invite the bot to other servers. Every server gets independent queues automatically.

The earlier slash-command migration was completed and its one-off cleanup script has been removed. Prefix commands need no deployment/registration step. The interaction handler processes music buttons only.

`>help` always replies in the invoking channel or thread, including usage and permission errors. It renders the operator's [Discohook design](https://share.discohook.app/go/omgtuvtp) as five Components V2 containers, preserving the text and ordering from `src/components/helpPanels.json`. Per the operator's latest preference, help and all other command responses have no accent colour. The shared design displays the literal default prefix `>`; update that template separately if you change `PREFIX`. No extra help or owner sections are appended. It does not depend on the configured log or DJ channel. Text-only help/queue/mention layouts require channel send permission, without an Embed Links requirement.

Mention the bot by itself in a server channel or thread to receive the [prefix reminder design](https://share.discohook.app/go/kumiba4b), stored in `src/components/mentionPanels.json` and rendered as a V2 container with its original text/colour. It replies in that channel, without using log/DJ settings or requiring voice. Extra conversation text, reply notification pings, bot/webhook messages and direct messages do not trigger it. Mention responses share the command cooldown and never ping the requesting user. This supplied design also displays the literal default prefix `>`.

The player, help, mention and queue interfaces use native Containers, Text Displays and optional Section/Thumbnail artwork, with MessageFlags.IsComponentsV2. Player buttons are nested inside the same container and retain voice/host authorization. Existing player messages upgrade in place: legacy content/embeds are cleared while their message IDs stay the same. Every command response uses an unaccented V2 box: search progress, queue confirmations, settings/status, help/queue/nowplaying, owner controls, errors and private button acknowledgements. Progress edits one message from the first response. No colour value is set for command boxes; the separate automatic DJ player and mention reminder keep their existing designs. Actual playback/recovery/disconnect logs remain plain text in their configured log destination. Components V2 is supported by the installed discord.js 14.27.0; no additional UI dependency is needed. See the official [Discord components overview](https://docs.discord.com/developers/components/overview) and [discord.js ContainerBuilder API](https://discord.js.org/docs/packages/discord.js/14.27.0/ContainerBuilder:Class).

Join claims its session host before asynchronous setup begins. The host can cancel a pending join with `>stop`, including from outside voice; destroying the connection also cancels its readiness waiter promptly.

If `>help` is ignored, verify **Message Content Intent** in the [Bot settings](https://discord.com/developers/applications) and restart. Discord documents this requirement in its [Message Content Intent guide](https://docs.discord.com/developers/events/gateway#message-content-intent). A server administrator still needs to invite the bot; changing prefixes never grants server access.

When started, logs should include `ready`. Join a voice channel and use `>play local:demo` after setting up the local library below, or request a permitted public YouTube track. No token is included in this project.

## 7. Commands and buttons

| Command | Behavior |
|---|---|
| >play query | Song/artist, Spotify track/playlist/album URL, YouTube video/playlist URL, local:id, stream:id. Playlist progress updates are coalesced; final import count and limitations are explicit. |
| >pause | Pause current audio. |
| >resume | Resume paused audio. |
| >skip | Advance once; explicit skips ignore track repeat. |
| >stop | Host/moderator only; stop audio, clear the queue, cancel discovery and leave voice, even in 24/7 mode. Works outside voice. |
| >queue page | Upcoming tracks, ten per page, one-based positions. |
| >nowplaying | Snapshot of the current compact player. |
| >volume level | 0–100, applied live without restarting audio. |
| >loop mode | off, track, queue. Queue repeat appends successfully completed tracks. Failed tracks are not requeued. |
| >shuffle | Fisher–Yates shuffle of upcoming entries only. |
| >remove position | Remove one upcoming entry. |
| >join | Join your regular voice channel. |
| >leave | Same host/moderator authorization as stop; clear and disconnect, overriding 24/7. |
| >autoplay on/off | Manage Server: enable/disable conservative recommendations. Default off. |
| >logchannel [channel/off] | Manage Server: select the playback-log channel, show its setting, or reset it. |
| >djchannel [channel/off] | Manage Server: select the player channel independently, show its setting, or reset it. |
| >clearcache | Bot owner only: clear all built-in metadata/search/audio-link caches across servers without stopping playback or clearing queues. |
| >shutdown | Bot owner only: gracefully stop audio, leave voice in all servers and shut down the application. |
| >restart | Bot owner only: cleanly stop the worker and launch a fresh process; all in-memory queues reset. |
| >help | Current command names and short descriptions, always in the invoking channel/thread. |

Buttons: Pause/Resume, Skip, Stop, Loop, Shuffle. They use the same authorization and queue methods as prefix commands. Old session controls expire. Read-only queue, nowplaying and help do not require voice membership. Playback and settings controls do. Volume/control changes are available to listeners in the session channel; restrict channel access for stricter listener control. Discord application-command permissions do not apply to text prefix commands.

Only Discord user ID **1037886658462371860** may use `clearcache`, `shutdown` and `restart`. This exact ID is fixed in `src/config/owner.js`; server ownership, Administrator and Manage Server never grant access. These server-only owner controls require no voice membership or existing session and acknowledge in the invoking channel, independently from log/DJ settings. They are omitted from the shared help design for all users. Cache clearing preserves audio, queues, saved settings and authentication; in-flight metadata requests can populate fresh entries afterwards. Shutdown/restart acknowledgements must succeed before the process action is requested, and concurrent requests are rejected.

Use `npm start`, **Start Music Bot.bat**, or the supplied PM2 configuration for `>restart`. An unsupported direct `node src/index.js` or watch/dev launch returns instructions rather than claiming it can restart. The standalone wrapper waits for the old worker to exit before replacing it and does not restart shutdown or crash exits; external PM2 can still recover crashes. After `>shutdown`, use the Start BAT or `npm start` again (or `pm2 start music-bot` under PM2). A stopped bot cannot receive `>restart` through Discord.

Only one discovery/import runs per guild at a time, with a two-minute deadline. Playback controls and queue changes use a separate per-guild mutex. Stop/skip interrupt pending source preparation. Five consecutive track failures, whether at startup or during playback, stop further automatic attempts and preserve remaining entries. Completing a track or explicitly resuming via play/skip resets that failure budget. Temporary voice disconnections get a grace period and at most two rejoin attempts; persistent failures require a fresh `>join` or `>play` and never spin indefinitely.

An authoritative gateway voice removal terminates the session immediately and cancels its pending import; the bot respects a manual disconnect, including in 24/7 mode. Voice close 4014 permits only passive library-managed recovery for a possible channel move and never sends explicit rejoin attempts. Other temporary network failures retain bounded recovery, whose waiters are cancelled when the session is stopped.

Manual voice removal also sends a disconnect notice to the configured log channel. Pending notices are delivered during session cleanup so destroying the player cannot cancel that final log. Repeated removal events are ignored once the session is closed. If Discord denies channel access, the failure is recorded locally while playback cleanup still completes.

Short media-buffer underruns are tolerated for up to AUDIO_STALL_TIMEOUT_SECONDS rather than ending a track after the voice library's five-frame default. A bounded PCM buffer absorbs small source jitter. FFmpeg retries transient network/HTTP 5xx failures with a small reconnect-delay ceiling; it does not retry authentication denials or reconnect at normal EOF. If a known-duration track ends more than two seconds early, the player re-resolves its source and resumes from the amount of audio actually played, up to PLAYBACK_RETRY_LIMIT times. Genuine completion still advances the queue once. Unknown-duration sources, access restrictions and exhausted retries stop or advance with an explanation. A voice session stuck without a usable subscription is cleared after a deadline, allowing fresh play requests.

Startup avoids duplicate direct-video extraction: the same validated source metadata supplies discovery and immediate playback. Spotify metadata and the first YouTube candidate search run concurrently, with artist/title/duration scoring retained and a canonical-query fallback when needed. Recent source metadata is cached briefly, identical concurrent metadata requests share work, and cancelling the last waiting caller cancels its subprocess. Playback interruption recovery always requests fresh source metadata; signed URLs denied by the provider are invalidated.

Every five minutes while running, one background timer clears all YouTube search/source and Spotify public/API metadata caches, including entries that have not yet expired. Active audio streams, queues, cookies, Spotify authentication and saved guild settings are preserved. In-flight requests can populate fresh entries after cleanup; the next uncached search needs a new provider request. No song files are stored in these caches. Shutdown stops the timer and clears remaining entries.

Voice connection preparation now runs alongside discovery; source resolution begins before the final permission check, and delivering the search reply does not delay ready audio. Permissions are rechecked before queue insertion. Cancellation aborts pending voice preparation, and a failed discovery releases a newly created idle connection. Idle leave is suspended while a play request is preparing. The `play_request_ready` log records elapsed command preparation time (not a guarantee of when a listener hears audio).

Full extraction is the default. Before caching a source, yt-dlp `--check-formats` verifies that the selected candidate is actually downloadable; it does not check every listed format. This can add cold-start latency. Genuine permission/login/region denials still fail explicitly. Decoder startup requires actual PCM bytes, not the readable event from an empty EOF.

Optional fast extraction uses yt-dlp's documented [YouTube `skip` extractor argument](https://github.com/yt-dlp/yt-dlp#extractor-arguments), with a single normal-extraction fallback for missing formats. It preserves default client selection, webpage/account checks, player configuration and JavaScript/signature handling. Restricted sources and network failures do not trigger alternate extraction strategies. Five-minute source metadata caching remains bounded by each URL's actual expiry and is invalidated on access errors; full songs are not downloaded ahead of playback; source validation may fetch a small test sample. Cold requests still depend on provider/network latency; a fresh cached source can start much faster.

A 401/403 from a reused signed link can trigger one fresh extraction; a denial from the freshly extracted source is terminal. This renews stale links without looping around access restrictions. FFmpeg error classification matches actual HTTP status messages, rather than arbitrary digits inside signed URLs. Logs include safe HTTP status, decoder exit/reason and track identifiers; signed media URLs, credentials and raw decoder stderr are excluded.

Source metadata for the immediate first track can resolve while Discord voice connects. During playback, only the next queued track gets a best-effort metadata warmup within roughly 20 seconds of the current track ending. This does not preload full songs or create a persistent playback resource. yt-dlp may read a small format-test sample during availability validation. Queue changes, pause, stop and shutdown cancel obsolete warmups. Background warmup is capped at one globally and skipped when it would consume the remaining foreground metadata slot; a one-slot deployment skips background warmup. Actual Discord startup time still depends on provider/network response and voice handshakes.

### Choose separate music log and DJ channels

Use `>logchannel #music-logs` with your actual channel name/mention, or supply its channel ID. `>logchannel` shows the saved destination; `>logchannel off` resets it. Manage Server permission is required, and the bot needs View Channel, Send Messages and Embed Links in a text/announcement channel in the same server. If duplicate channel names exist, use a mention or ID.

If the configured log channel is deleted or inaccessible, playback and the DJ player continue. The bot records a local warning and disables Discord notice delivery until a working log channel is selected. It does not redirect those notices into the DJ or command channel.

Use `>djchannel #dj` to select the player-only destination independently. `>djchannel` shows it and `>djchannel off` resets it. All command replies, including volume, join, leave, queue, validation errors, searching and queue confirmations, stay in the channel/thread where the command was entered. Play progress edits one reply. Actual playback, recovery and disconnect notices go to the configured log channel. Button acknowledgements remain private to the user who clicked them.

The configured DJ channel has one permanent player message: song/playlist transitions, queued additions, pause/volume changes and new voice sessions edit that same message. Its ID is saved and reused after bot restarts. The bot needs **Read Message History** in the DJ channel to fetch it. On upgrade, a bounded scan of the latest 100 messages adopts the newest existing player owned by this bot. Old sessions cannot overwrite the current session's display. If someone deletes the player message, one replacement is created on the next player update; access/network errors do not trigger duplicate creation. Stop/leave keep the message and disable its controls until the next session. This does not preserve in-memory queues across application restarts.

Changing the log destination moves notices only. Changing the DJ destination invalidates old controls and selects a player in the new channel while leaving audio playing. With a DJ destination set, `>nowplaying` replies locally with that channel rather than posting another player. Configuration errors explain how to repair/reset the destination, and player controls still enforce voice/session-host permissions.

Both destinations and the DJ player message ID are stored independently per server in versioned `data/guild-settings.json` with serialized atomic writes and survive restarts; ordinary queues/history/voice settings remain in memory. The data directory is private runtime state and excluded from Git and release ZIPs. Keep a private backup if you move hosts. To recover from a deleted destination or removed channel permissions, fix them or run the matching `>logchannel off` / `>djchannel off` in a channel where the bot can reply. Version 1/2 channel settings load and migrate safely to version 3. No additional music API keys or external database are required.

## 8. Authorized local and direct-stream fallback

Users cannot pass file paths or arbitrary stream URLs. The operator maps safe IDs to owned/licensed files or explicitly authorized HTTPS streams in `media.json`. The manifest and media directory are ignored by Git.

```powershell
Copy-Item media.example.json media.json
ffmpeg -f lavfi -i 'sine=frequency=440:duration=5' -ar 48000 -ac 2 media/demo.wav
```

```bash
cp media.example.json media.json
ffmpeg -f lavfi -i 'sine=frequency=440:duration=5' -ar 48000 -ac 2 media/demo.wav
```

In Discord: `>play local:demo`. The generated tone is a reliable, authorized integration source. Replace it with media you are authorized to play. Local files must resolve within `MEDIA_ROOT`, including after symlink resolution.

To configure a direct HTTPS source, add an entry under `streams`:

```json
{
  "local": {},
  "streams": {
    "licensed-track": {
      "title": "My licensed track",
      "artist": "My artist",
      "url": "https://media.example.org/my-authorized-track.ogg",
      "authorized": true,
      "duration": 180
    }
  }
}
```

The example domain is illustrative; replace it with your actual authorized media URL. Request `>play stream:licensed-track`. Known durations support playback tracking and interruption recovery; recovery offsets require a seekable stream. Streams and manifests are trusted operator configuration, not an open proxy. Do not give untrusted users write access. Do not configure internal network URLs, redirects to private services, or manifest playlists that reference private services. Remote FFmpeg inputs are restricted to HTTPS/TLS/TCP/crypto protocols, while local inputs use file/pipe.

## 9. Optional adapter contracts

### Built-in official Spotify metadata search

To use your developer application for text searches, set both `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` in the local `.env`. The bot selects the built-in SpotifyApi adapter when both values are present, unless `SPOTIFY_SEARCH_ADAPTER` specifies your own adapter. Missing credentials keep API-free mode available; incomplete credentials produce a configuration warning without disabling ordinary playback.

```env
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_MARKET=PK
```

`SPOTIFY_MARKET` selects a catalog country. `PK` requests Pakistan; it is optional and can remain blank. It does not select your hosting region or grant access to restricted media. The implementation uses the documented [Client Credentials flow](https://developer.spotify.com/documentation/web-api/tutorials/client-credentials-flow), so there is no user-login callback or redirect server to run. URL track/album/playlist imports retain their existing best-effort public metadata implementation; this optional adapter adds official **text search**.

```bash
npm run test:spotify
npm run test:spotify -- Stephen Sanchez Until I Found You
```

The checker performs real authentication and a five-result metadata search; it prints only safe track information. It does not print credentials/access tokens, log in to Discord, or play audio. Runtime token acquisition is shared across concurrent searches; tokens and successful searches are cached. A rejected access token is refreshed once. Rate/quota limits honor Retry-After with a local cooldown; denied access is not repeatedly retried. Failed metadata searches use the existing fallback rather than fabricating Spotify results. Request deadlines and response-size limits apply.

Official API access does not license audio playback or grant Spotify broadcast rights. Spotify's [Developer Policy](https://developer.spotify.com/policy) prohibits integrations with streams/content from another service; a Spotify-to-YouTube workflow is not thereby an approved Spotify integration. Check your app's eligibility and permissions before using this adapter in a public deployment. A successful connection test confirms technical endpoint access only. Development Mode eligibility, Premium requirements and quotas are governed by Spotify's current rules.

### Custom adapters

Adapters are **trusted server-side ESM code**, loaded only from operator-configured paths. They must obey the provided AbortSignal, limit output, and use lawful accessible sources. No adapter can make a paid API mandatory for normal playback. An absent adapter returns the documented unavailable behavior.

- `SPOTIFY_SEARCH_ADAPTER`: named export `async search(query, { signal })`. Return a real Spotify metadata object (`name`/`title`, `artists`/`artist`/`subtitle`, `duration_ms` or `duration` in milliseconds, album, artwork, URI), or `null`. Never label non-Spotify results as Spotify. Ten-second caller timeout, metadata semaphore and fallback apply.
- `RECOMMENDATION_ADAPTER`: named export `async recommend(previousTrack, { signal, recent })`. Return at most eight candidate objects with `title`, `artist`, and optional duration in **seconds**. Candidates still undergo duplicate/version filtering and YouTube matching. This call has a configured deadline and must not scrape restricted content.

Keep private adapter catalogs outside version control. Avoid installing arbitrary unreviewed adapter code. The player/resolver interface is replaceable independently of Discord commands.

## 10. Tests and real-server verification

```bash
npm run check
npm test
npm run test:audio
```

For an additional paced regression check, run `npm run test:playback`. It uses the real FFmpeg/Opus pipeline and real voice audio scheduler offline: pause, paused interruption recovery, natural completion, a full 12-second second track, queue advancement and fresh playback after completion. It takes roughly 20 seconds and sends nothing to Discord. Unit tests also inject a 400 ms frame gap to check that the complete audio survives, and cover premature EOF, cumulative retry limits, cancellation, late resource errors and denied-source handling.

Use `RUN_PROVIDER_TESTS=true npm run benchmark:startup` on Linux (or set `$env:RUN_PROVIDER_TESTS='true'` first in PowerShell) to measure cold/warm discovery, source resolution and the first Opus packet from the authorized Blender test video. It sends no Discord messages, performs no voice join and does not download a full song. The output is a live sample for that host/network, not a latency guarantee.

The built-in Node test runner uses mocks for Discord and provider responses. It covers prefix parsing, typed command arguments, message routing/replies, channel/voice/admin permissions, button controls, normalization, URLs, Spotify shapes, matching and rejected variants, queue order/limits, repeat/shuffle, simultaneous skips, guild isolation, pause/resume and recovery offsets, stop during extraction, error/idle races, autoplay filtering, idle/24/7 behavior, stale controls, caching, subprocess timeouts and shell metacharacters, and local path containment. `test:audio` makes a temporary generated tone, runs the real FFmpeg/Opus pipeline and checks packets and cleanup without Discord. It removes only its own generated temporary directory.

Optional live metadata probes:

```powershell
$env:RUN_PROVIDER_TESTS='true'
npm run test:providers
```

```bash
RUN_PROVIDER_TESTS=true npm run test:providers
```

For a video you are permitted to play:

```bash
npm run test:source -- 'https://www.youtube.com/watch?v=aqz-KE-bpKQ'
```

The example was tested as the official Blender Foundation Big Buck Bunny video, with extractor metadata identifying Creative Commons Attribution. Check current source permissions and attribution before your use. This probe extracts and decodes ten audio packets, then tears down the pipeline; it never downloads a full song or connects to Discord.

Real Discord acceptance checklist (requires your server/token):

1. Set `.env`, run doctor, start, and confirm the `ready` log.
2. Join a regular voice channel, run `>play local:demo`, and hear the generated tone. Verify Now Playing and buttons.
3. Queue two authorized tracks. Test pause/resume, volume 0/70, skip, loop, remove and stop. Add a track during playback and confirm the current song is uninterrupted.
4. Test a permitted public YouTube link, a song search, a public Spotify track, album and playlist. Compare reported import counts with accessible metadata, not an assumed full catalog.
5. Try controls from another voice channel and a settings change without Manage Server; they should be rejected. Remove bot permissions temporarily and check the explanation.
6. Play in a second guild and confirm isolation. Delete the player message and verify audio continues; use `>play` or `>join` to recreate it.
7. Empty the queue and observe idle behavior (persistent mode, if desired, is configured through ENABLE_247_MODE). Simulate a brief network interruption and a permanent disconnect; check bounded recovery. `>leave` must always stop the session.
8. Stop the process while playing; ensure voice disconnects and FFmpeg/yt-dlp processes exit. Restart through PM2 and confirm the intentionally empty in-memory state.

The GitHub Actions workflow exercises syntax, unit tests and dependency audit on Windows and Ubuntu when this folder is the repository root. Those hosted CI jobs are provided, not claimed to have been run here.

## 11. Update and restart

Keep the lockfile, back up `.env` and your authorized library, and stop playback before maintenance.

```bash
pm2 stop music-bot
npm outdated
npm update
npm audit --omit=dev
npm run check
npm test
npm run test:audio
pm2 start music-bot
```

Direct dependencies are pinned: `npm update` primarily refreshes compatible transitive dependencies. For a direct version upgrade, review official release notes, change the specific pinned version with `npm install package-name@VERSION`, then repeat checks and commit both package files. Do not use `npm audit fix --force` without reviewing compatibility. Update yt-dlp in its virtual environment with `python -m pip install -U 'yt-dlp[default]'`, or use your chosen package manager/official executable updater. Prefix command changes load on the next restart; use `pm2 restart music-bot --update-env` after code/config changes. Rotate exposed tokens immediately and restart.

## 12. Troubleshooting

| Symptom | Checks |
|---|---|
| Startup says token missing | `.env` must be in the project directory; use a normal bot token. No Spotify credentials are needed. |
| Invalid token / migration cleanup rejected | Verify the bot token and application ID belong to the same application. Reset an exposed or invalid token, check the bot invite, and enable Message Content Intent. No server IDs are needed. |
| Prefix commands ignored | Enable Message Content Intent in the Developer Portal, check PREFIX and channel permissions, then restart. No command registration or guild IDs are needed. |
| FFmpeg/yt-dlp missing | Run doctor, reopen terminal after installation, and set full executable paths. A Python module command is not an executable path. |
| Voice timeout / silent bot | Confirm View Channel, Connect, Speak, no server mute, a free channel slot, working UDP, native crypto/DAVE/Opus availability, and nonzero volume. Test `local:demo` first. |
| Local tone works, YouTube does not | Update yt-dlp and EJS together, check the configured runtime and provider network availability. Provider denial/region/age/private access is reported and never bypassed. Use your authorized library. |
| YouTube format / extractor errors | Use current official yt-dlp plus EJS and supported Node. Optional local cookies provide your own session; they are not a guaranteed fix for 403. Impersonation and region evasion are not supplied. |
| Spotify URL fails | Verify the exact public open.spotify.com URL. Short links, artist/podcast links, private collections, and hidden entries are unsupported. Use title/artist search or a permitted direct video. |
| Playlist is smaller than expected | Imports are capped and public metadata is incomplete; skipped/private/restricted entries are not silently counted as success. No audio is preloaded. |
| Autoplay stops | The known artist or a suitably distinct related track may be unavailable. This is expected; unrelated tracks are not added to maintain activity. |
| Lyrics unavailable | Configure a lawful adapter with source URL/license, or leave the feature unavailable. |
| Unexpected disconnection | A grace period and two reconnect attempts are allowed; then use >join or >play. 24/7 does not override server permissions, kicks or offline hosts. |
| High CPU/memory | Keep native Opus if available, reduce MAX_PLAYERS, use fewer simultaneous guild streams, lower metadata concurrency and queue limits, inspect provider failures and PM2 logs. Do not run duplicate instances. |
| Player message missing | Audio continues. In a configured DJ channel, the next update replaces a deleted message once. Check Read Message History, View Channel, Send Messages and Embed Links. |

Logs avoid source URLs, headers, tokens and provider stderr. Errors include guild, event and safe error codes for debugging. Do not publish `.env`, raw extractor dumps or signed CDN URLs. Ordinary source failures are caught per guild; unexpected fatal exceptions initiate shutdown so a supervisor can restart cleanly.

## Project layout and architecture

```text
Music Bot/
  src/
    run.js                      Standalone worker supervisor entry
    index.js                    Discord startup, signals and shutdown
    runtime/                    Owner process control and child supervision
    config/owner.js             Exact owner ID and protected command names
    config/config.js            Validated environment configuration
    config/GuildSettings.js     Atomic channel preferences and DJ message IDs
    commands/definitions.js     All 20 prefix definitions
    commands/execute.js         Shared prefix/button business logic
    commands/parsePrefix.js     Typed argument parsing and usage
    commands/messageContext.js  Single-message reply/progress adapter
    events/                     Message, button and voice-state handlers
    components/                 V2 containers, panels, buttons and message presenter
    music/
      MusicManager.js           Bounded guild ownership and discovery jobs
      GuildPlayer.js            Serialized playback state and lifecycle
      QueueManager.js           Upcoming entries, history and repeat
      VoiceSession.js           Join, bounded recovery and disconnect
      AudioManager.js           FFmpeg PCM, volume, Opus and cleanup
      DiscoveryService.js       Input routing and metadata fallback
      SpotifyResolver.js        Replaceable public metadata adapter
      YouTubeResolver.js        Bounded search/import and JIT extraction
      TrackMatcher.js           Normalization and weighted matching
      LocalMediaResolver.js     Operator-authorized fallback catalog
      AutoplayManager.js        Conservative distinct-track discovery
    utils/                      Locks, cache, validation, tools and logs
  tests/                        Mocked deterministic automated suite
  scripts/                      Doctor, syntax and real pipeline probes
  media/                        Your authorized local files
  .github/workflows/ci.yml       Windows/Ubuntu validation workflow
  .env.example
  media.example.json
  ecosystem.config.cjs
  package.json
  package-lock.json
  README.md
  VALIDATION.md
  AUDIT.md
```

Provider subprocesses run without a shell. Metadata uses one global semaphore; playback state uses one mutex per guild. Each resource has a generation and explicit cleanup handle so stale end/error callbacks cannot skip the next song. Stop/skip abort pending work, process stdout is bounded, audio is streamed with backpressure, and shutdown terminates resources and voice connections. This is a single-process in-memory service; persistent queues or multi-host sharding would require an explicit ownership/storage design.
