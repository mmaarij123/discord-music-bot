# Discord Music Bot

A Discord music bot with prefix commands, a server music queue, and an interactive voice player.

**Proprietary software. Written permission is required to run, reuse, modify, or redistribute the original project.** See [LICENSE](LICENSE).

## What it does

- Plays music in Discord voice channels and keeps each server's queue separate.
- Accepts song searches, YouTube video and playlist links, and public Spotify track, album, and playlist links.
- Matches Spotify track information to supported YouTube audio.
- Provides player buttons, queue management, skip voting, volume, repeat, and optional autoplay.
- Supports per-server prefixes, a permanent DJ player message, and a separate log channel.
- Stores server settings and owner-only beta playlists locally.

For two bot accounts with shared saved playlists and lookup caches, see [Discord Music Duo](https://github.com/mmaarij123/discord-music-duo).

## Requirements

- Node.js **24.17.0 or newer** and npm.
- FFmpeg available as an executable.
- A current official yt-dlp release with its EJS component.
- Discord bot tokens and permission to install the bots in your servers.
- A host that allows long-running Node processes, child processes, and Discord voice traffic.

Install the runtime and audio tools before starting the bot. Verify them from a terminal.

```bash
node --version
ffmpeg -version
yt-dlp --version
```

Use the official installation guides for your operating system. The official yt-dlp executables include EJS. The bot passes its Node executable to yt-dlp for JavaScript support.

[Node.js downloads](https://nodejs.org/en/download) · [FFmpeg downloads](https://ffmpeg.org/download.html) · [yt-dlp installation](https://github.com/yt-dlp/yt-dlp/wiki/Installation) · [yt-dlp EJS setup](https://github.com/yt-dlp/yt-dlp/wiki/EJS)

## Discord setup

1. Open the Discord Developer Portal and create an application with a bot.
2. Enable **Message Content Intent** on the Bot page.
3. Save the token in your private configuration.
4. Invite the bot with the `bot` scope and the permissions below.

Give the bot **View Channels**, **Send Messages**, **Embed Links**, **Read Message History**, **Connect**, and **Speak** in the channels it uses. Threads need **Send Messages in Threads**.

Use regular voice channels for playback. Configure the DJ and log channels with the prefix commands after the bot is online.

[Discord Developer Portal](https://discord.com/developers/applications) · [Message Content Intent](https://docs.discord.com/developers/events/gateway#message-content-intent)

## Installation

After obtaining permission to run the project, clone the repository and install its dependencies.

```bash
git clone https://github.com/mmaarij123/discord-music-bot.git
cd discord-music-bot
npm ci
```

Copy `.env.example` to `.env` using your file manager, then edit `.env`.

```env
DISCORD_TOKEN=your_bot_token
PREFIX=">"
FFMPEG_PATH=ffmpeg
YTDLP_PATH=yt-dlp
```

The values above are placeholders. Use your bot token and executable paths for the machine that will run the bot.

Start from the project folder.

```bash
npm start
```

Wait for `Bot ready`, join a voice channel, and try the following messages in Discord.

```text
>join
>play Stephen Sanchez Until I Found You
>queue
>help
```

Press Ctrl+C in the terminal to shut down the process.

## Commands

Put the server's prefix before each command. The default prefix is `>`. For example, `>volume 50` sets the volume to 50%.

| Command | What it does |
| --- | --- |
| `play <song or link>` | Play a song or add it to the queue. |
| `pause` / `resume` | Pause or continue the current song. |
| `skip` | Skip a song you requested, or open a vote for another person's song. |
| `stop` | Stop music, empty the queue, and leave voice. |
| `queue [page]` | Show upcoming songs. |
| `nowplaying` | Show the current song or point to the configured DJ channel. |
| `volume <0–100>` | Change playback volume. |
| `loop <off\|track\|queue>` | Turn repeat off, repeat the song, or repeat the queue. |
| `shuffle` | Shuffle upcoming songs. |
| `remove <position>` | Remove an upcoming song by its queue position. |
| `join` / `leave` | Join your voice channel or disconnect and clear the queue. |
| `autoplay <on\|off>` | Enable or disable related songs when the queue ends. Requires Manage Server. |
| `logchannel [#channel\|off]` | View, set, or reset the playback log channel. Requires Manage Server. |
| `djchannel [#channel\|off]` | View, set, or reset the permanent music player channel. Requires Manage Server. |
| `prefix [characters]` | View the prefix. Administrators can set a prefix of one or two characters. |
| `help` | Show the command guide. |

Skip votes use a majority of the human listeners who were in voice when the vote opened. Votes have a 60-second deadline.

## Owner controls

The owner account is set by `OWNER_USER_ID` in `src/config/owner.js`. For an authorized deployment, set it to your Discord user ID before starting.

| Command | What it does |
| --- | --- |
| `clearcache` | Clear played-song cache entries while protecting current and upcoming tracks. |
| `shutdown` | Shut down the receiving bot across its servers. |
| `restart` | Restart the receiving bot through the startup supervisor. |

These commands and all personal playlist beta commands require the configured owner account.

The `npm start` entry runs the supervisor needed for the restart command.

Voice sessions and in-memory queues reset when a worker restarts.

## Personal playlists

Personal playlists are a beta feature restricted to the configured bot owner. Each user can have one unnamed playlist.

| Command | What it does |
| --- | --- |
| `playlist create` | Create your playlist. |
| `playlist add <song or link>` | Save a song to your playlist. |
| `playlist save` | Save the song currently playing. |
| `playlist import <Spotify playlist link>` | Import the Spotify tracks that can be retrieved. |
| `playlist play` | Add your saved playlist to the music queue. |
| `playlist show [page]` | Browse your saved songs. |
| `playlist remove <position>` | Remove a saved song. |
| `playlist delete` | Delete your playlist. |

Playlist imports can be partial because of public availability, unsupported entries, duplicates, or configured limits.

## Configuration

Configure the bot in `.env`. It runs with a Discord bot token. The default Spotify-link and YouTube flow uses public lookups without Spotify or YouTube API credentials.

| Setting | Default | Meaning |
| --- | --- | --- |
| `DISCORD_TOKEN` | empty | Your private Discord bot token. |
| `PREFIX` | `>` | Default command prefix for servers without an override. |
| `DEFAULT_VOLUME` | `70` | Starting playback volume from 0 to 100. |
| `MAX_QUEUE_LENGTH` | `500` | Maximum upcoming tracks per server. |
| `MAX_PLAYLIST_TRACKS` | `100` | Maximum tracks requested in one collection import. |
| `MAX_SAVED_PLAYLIST_TRACKS` | `500` | Maximum tracks in a saved personal playlist. |
| `IDLE_TIMEOUT_SECONDS` | `300` | Delay before an idle session leaves voice. |
| `AUTOPLAY_ENABLED` | `false` | Initial related-song autoplay setting. |
| `ENABLE_247_MODE` | `false` | Keep an idle voice connection while the process runs. |
| `LOG_LEVEL` | `info` | Use `debug`, `info`, `warn`, or `error`. |
| `FFMPEG_PATH` | `ffmpeg` | FFmpeg command name or full executable path. |
| `YTDLP_PATH` | `yt-dlp` | yt-dlp command name or full executable path. |

### Optional settings

| Settings | Purpose |
| --- | --- |
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | Enable optional official Spotify text search. Set both together. |
| `SPOTIFY_MARKET` | Optional two-letter country code for Spotify search, such as `PK`. |
| `SEARCH_CACHE_SECONDS` | Lifetime of cached search results. Default `900`. |
| `AUDIO_SOURCE_CACHE_SECONDS` | Lifetime of cached audio source links. Default `300`. |
| `METADATA_CONCURRENCY` | Parallel lookup limit. Default `2`. |
| `PROCESS_TIMEOUT_SECONDS`, `SPOTIFY_DISCOVERY_TIMEOUT_MS` | Tool and Spotify search deadlines. |
| `MAX_TRACK_SECONDS`, `MAX_PLAYERS` | Track duration and active server limits. Defaults `7200` and `20`. |
| `AUDIO_STALL_TIMEOUT_SECONDS`, `PLAYBACK_RETRY_LIMIT` | Bounded audio recovery settings. Defaults `20` and `2`. |
| `YOUTUBE_FAST_EXTRACTION` | Optional extraction setting. Default `false`. |
| `MEDIA_ROOT`, `MEDIA_MANIFEST` | Paths for your authorized local media library. |
| `YOUTUBE_COOKIES_FILE` | Optional private Netscape-format cookie file inside `secrets/`. |
| `SPOTIFY_SEARCH_ADAPTER`, `RECOMMENDATION_ADAPTER` | Paths to trusted, operator-provided ESM adapters. |

Use `.env.example` for the full configuration template. Keep tokens, Spotify secrets, cookie exports, and runtime data out of commits and shared logs.

Optional cookie files carry account session data. Configure them privately on the host when authorized. Login, age, region, and other provider restrictions can still make a source unavailable.

## Files and saved data

| Path | Purpose |
| --- | --- |
| `src/run.js` | Startup entry and worker supervisor. |
| `src/commands/` | Prefix commands and validation. |
| `src/music/` | Playback, matching, queues, and storage. |
| `src/components/` | Discord player cards and controls. |
| `scripts/` | Diagnostics and validation tools. |
| `tests/` | Automated test suite. |
| `data/guild-settings.json` | Saved server prefixes, channel settings, and player message IDs. |
| `data/playlists.json` | Saved owner-only beta playlists. |

Live queues and track history stay in memory. Back up `data/` and private configuration before moving hosts.

## Hosting

Install the required Node runtime and audio tools on the host, then run the project as a long-running process.

| Panel field | Value |
| --- | --- |
| Startup command | `npm start` or `node src/run.js` |
| Main JavaScript file | `src/run.js` |
| Runtime | Node.js 24.17+ |

On Linux, use Linux executables and Linux paths in `.env`. A hosted yt-dlp installation might use `YTDLP_PATH=/home/container/bin/yt-dlp`. Test the executable directly with `--version` before starting the bot.

Install packages with `npm ci` on the target operating system. Keep `data/`, `.env`, `media/`, and `secrets/` private and persistent where applicable. Keep one running instance per bot token.

## Checks and updates

```bash
npm run check
npm test
```

These run JavaScript syntax checks and automated tests. Most external services and voice sessions are mocked in the test suite. Validate real playback separately by joining a test voice channel and playing an authorized source.

Check local dependencies and tool paths.

```bash
npm run doctor
```

To update an authorized deployment, stop the process, back up private configuration and saved data, pull the code, run `npm ci`, run the checks, and start it again.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| `EBADENGINE` or unsupported syntax | Select Node.js 24.17+ in the host's runtime settings. |
| Process exits immediately | Use `npm start` or `node src/run.js`, then read the first startup error. |
| Prefix commands get no response | Enable Message Content Intent and check the server prefix and channel permissions. |
| FFmpeg or yt-dlp cannot start | Run its version command directly on the host and check the configured executable path. |
| YouTube playback is denied | Check the exact source, current yt-dlp/EJS installation, and provider availability on the host's network. |
| Spotify collection imports fewer songs | Check the import limit and whether those entries are publicly available. |
| No audio or a voice timeout | Check Connect/Speak, server mute, channel capacity, volume, and host UDP support. |
| DJ player card is missing | Check the selected channel and Read Message History permission. |

Queue positions start at 1. Session controls normally require the user's voice channel to match the bot's. The session host or a member with Manage Server can use `stop` or `leave` from outside voice.

Source availability depends on the provider. Spotify links supply track information, and available tracks are matched to supported YouTube sources. Local and direct-stream library entries must be configured by the operator with permission to use the media.

## License

Copyright © 2026 Maarij (@mmaarij123). All rights reserved.

The original project is proprietary. Running, modifying, reusing, or redistributing it requires prior written permission from the copyright holder, subject to applicable law and platform terms. Third-party materials retain their own license terms.

Public source availability allows inspection. See [LICENSE](LICENSE) for the full terms. The setup instructions above describe an authorized deployment.
