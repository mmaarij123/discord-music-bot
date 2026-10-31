import { ChannelType, PermissionFlagsBits, EmbedBuilder, escapeMarkdown } from 'discord.js';
import { commands, usage } from './definitions.js';
import { playerEmbed, duration } from '../components/playerEmbed.js';
import { UserError } from '../utils/errors.js';
import { integer, parseTime, classifyInput } from '../utils/validators.js';
import { withAbort } from '../utils/async.js';
import { performance } from 'node:perf_hooks';
const readOnly=new Set(['help','queue','nowplaying','lyrics']);
const songLabel=value=>`\`${String(value).replace(/`/g,'ˋ').replace(/[\r\n]/g,' ').slice(0,500)}\``;
export async function voiceAccess(interaction,player) {
  const member=await interaction.guild.members.fetch(interaction.user.id);
  const channel=member.voice.channel;
  if (!channel) throw new UserError('Join a voice channel before controlling music.');
  if (channel.type!==ChannelType.GuildVoice) throw new UserError('Use a regular voice channel. Stage channels are not supported.');
  const active=player?.voice.channelId;
  if (active && active!==channel.id) throw new UserError('Join the bot’s voice channel to control this session.');
  const bot=interaction.guild.members.me ?? await interaction.guild.members.fetchMe();
  if (!channel.permissionsFor(bot)?.has([PermissionFlagsBits.ViewChannel,PermissionFlagsBits.Connect,PermissionFlagsBits.Speak])) throw new UserError('The bot needs View Channel, Connect, and Speak permissions in your voice channel.');
  if (channel.full && !channel.permissionsFor(bot)?.has(PermissionFlagsBits.MoveMembers) && bot.voice.channelId!==channel.id) throw new UserError('That voice channel is full. Free a slot for the bot.');
  return {channel,member};
}
function requirePlayer(player,prefix) { if (!player) throw new UserError(`No music session is active. Use ${prefix}play or ${prefix}join first.`); return player; }
function admin(member) { if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) throw new UserError('Manage Server permission is required to change this setting.'); }
function textAccess(interaction){
  const channel=interaction.channel,bot=interaction.guild.members.me;
  const permissions=[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.EmbedLinks,channel?.isThread()?PermissionFlagsBits.SendMessagesInThreads:PermissionFlagsBits.SendMessages];
  if(!channel?.isTextBased()||!channel.permissionsFor(bot)?.has(permissions))throw new UserError('The bot needs View Channel, Send Messages (or Send Messages in Threads), and Embed Links here to show the music player.');
}
export async function execute(interaction,manager,action=interaction.commandName) {
  if (!interaction.inGuild()) throw new UserError('Music commands are available in servers only.');
  const prefix=interaction.commandPrefix ?? manager.config?.prefix ?? '>';
  let player=manager.get(interaction.guild), access;
  if (!readOnly.has(action)) access=await voiceAccess(interaction,player);
  const option=interaction.options;
  const reply=content=>interaction.editReply(typeof content==='string' ? {content,allowedMentions:{parse:[]}} : content);
  if (action==='help') {
    const help=commands.map(command=>`**${escapeMarkdown(usage(command,prefix))}** — ${command.description}`).join('\n');
    return reply({embeds:[new EmbedBuilder().setColor(0x1db954).setTitle('Your listening room').setDescription(help).addFields({name:'Try it',value:`${prefix}play Stephen Sanchez Until I Found You\n${prefix}play local:demo\n${prefix}seek 1:30\n${prefix}autoplay on`},{name:'Sources',value:'Spotify metadata is best-effort. Audio uses supported public YouTube sources or the operator’s authorized media library. No music API keys.'})]});
  }
  if (action==='play') {
    textAccess(interaction);
    const query=option.getString('query',true);
    classifyInput(query);
    // A server has one outstanding discovery request; queue mutations stay independent.
    return manager.import(interaction.guildId,async signal=>{
      const started=performance.now(),preparation=new AbortController();
      const prepareSignal=AbortSignal.any([signal,preparation.signal]);
      player=manager.get(interaction.guild,true);
      const releaseIdle=player.holdIdleTimeout();
      const wasConnected=Boolean(player.voice.channelId),wasPlaying=Boolean(player.current);
      // Voice handshake and discovery run together; the first chat reply is
      // sent concurrently too. No track or audio resource is queued early.
      const voiceReady=wasPlaying?Promise.resolve():player.join(access.channel,{signal:prepareSignal});
      voiceReady.catch(error=>preparation.abort(error));
      const searchingReply=reply(`Searching of ${songLabel(query)}`);
      searchingReply.catch(error=>preparation.abort(error));
      let accepted=false;
      try{
        let result;
        try{result=await manager.discovery.resolve(query,prepareSignal);}
        catch(error){
          if(['NO_MATCH','NO_RESULTS'].includes(error.code))throw new UserError(`Could not find ${songLabel(query)}.`,error.code);
          throw error;
        }
        prepareSignal.throwIfAborted();
        for(const diagnostic of result.diagnostics??[])manager.logger?.debug('music_discovery_fallback',{guildId:interaction.guildId,message:diagnostic});
        const tracks=result.tracks.map(track=>({...track,requestedBy:{id:interaction.user.id,name:interaction.user.globalName || interaction.user.username}}));
        if(!player.current){
          const next=player.queue.tracks[0]??tracks[0];
          manager.audio?.prefetch?.(next,{signal:prepareSignal}).catch(error=>{if(!prepareSignal.aborted)manager.logger?.debug('source_warmup_failed',{guildId:interaction.guildId,error});});
        }
        await voiceReady;
        // A user can move channels or lose permissions during discovery.
        access=await voiceAccess(interaction,manager.get(interaction.guild));
        prepareSignal.throwIfAborted();
        manager.presenters.get(interaction.guildId)?.bind(interaction.channel);
        const queued=await player.enqueue(tracks,access.channel,{signal:prepareSignal});
        accepted=true;
        manager.logger?.info('play_request_ready',{guildId:interaction.guildId,elapsedMs:Math.round(performance.now()-started),queuedDuringPlayback:wasPlaying});
        await searchingReply;
        const notices=[...result.notices];
        if(queued.omitted)notices.push(`${queued.omitted} tracks omitted because the queue limit was reached.`);
        const added=queued.added===1
          ? `Added ${songLabel(tracks[0].title)} in the queue`
          : `Added ${songLabel(tracks[0].title)} and ${queued.added-1} more track${queued.added===2?'':'s'} in the queue`;
        return await reply(`${added}${notices.length?'\n'+notices.join('\n'):''}`.slice(0,1900));
      }finally{
        preparation.abort();await Promise.allSettled([voiceReady,searchingReply]);
        releaseIdle();
        if(!accepted&&!wasConnected&&!player.closed&&!player.current&&!player.queue.length&&!player.persistent)await player.stop(true);
      }
    });
  }
  if(action==='join'){
    textAccess(interaction);
    player=manager.get(interaction.guild,true); manager.presenters.get(interaction.guildId)?.bind(interaction.channel);
    await player.join(access.channel); return reply('Connected to your voice channel.');
  }
  if(action==='stop'||action==='leave') {
    manager.cancelImport(interaction.guildId);
    if(player)await player.stop(action==='leave');
    return reply(action==='leave'?'Disconnected and cleared the queue.':'Stopped playback, cleared the queue, and cancelled pending discovery.');
  }
  if(action==='247'||action==='autoplay'){
    admin(access.member);
    player=manager.get(interaction.guild,true);
    await player.join(access.channel);
    const enabled=option.getBoolean('enabled',true);
    if(action==='247')await player.setPersistent(enabled); else await player.setAutoplay(enabled);
    return reply(`${action==='247'?'24/7 voice mode':'Autoplay'} ${enabled?'enabled':'disabled'} for this running session.${action==='247'?' The application must remain online.':''}`);
  }
  player=requirePlayer(player,prefix);
  switch(action){
    case 'pause': await player.pause(); return reply('Paused.');
    case 'resume': await player.resume(); return reply('Resumed.');
    case 'skip': return reply(await player.skip()?'Skipped.':'A skip was already handled.');
    case 'previous': await player.previous(); return reply('Playing the previous track.');
    case 'volume': await player.setVolume(option.getInteger('level',true)); return reply(`Volume set to ${player.volume}%.`);
    case 'loop': {
      const mode=interaction.isButton() ? ['off','track','queue'][(['off','track','queue'].indexOf(player.queue.loop)+1)%3] : option.getString('mode',true);
      await player.editQueue(queue=>queue.setLoop(mode)); return reply(`Repeat: ${mode}.`);
    }
    case 'shuffle': await player.editQueue(queue=>queue.shuffle()); return reply('Shuffled upcoming tracks.');
    case 'remove': {
      const removed=await player.editQueue(queue=>queue.remove(option.getInteger('position',true)));
      return reply(`Removed “${removed.title}”.`);
    }
    case 'clear': await player.editQueue(queue=>queue.clear()); return reply('Cleared upcoming tracks.');
    case 'move': await player.editQueue(queue=>queue.move(option.getInteger('from',true),option.getInteger('to',true))); return reply('Moved the queued track.');
    case 'jump': await player.jump(option.getInteger('position',true)); return reply('Jumped to the selected track.');
    case 'seek': await player.seek(parseTime(option.getString('position',true))); return reply('Playback position updated.');
    case 'nowplaying': return reply({embeds:[playerEmbed(player)]});
    case 'queue': {
      const page=option.getInteger('page')??1, pages=Math.max(1,Math.ceil(player.queue.length/10));
      integer(page,1,pages,'Page');
      const lines=player.queue.tracks.slice((page-1)*10,page*10).map((track,index)=>`**${(page-1)*10+index+1}.** ${escapeMarkdown(track.title.slice(0,120))} • ${duration(track.duration)}`);
      return reply({embeds:[new EmbedBuilder().setColor(0x1db954).setTitle(`Up next • ${player.queue.length} tracks`).setDescription(lines.join('\n')||'The upcoming queue is empty.').setFooter({text:`Page ${page}/${pages} • Repeat ${player.queue.loop}`})]});
    }
    case 'lyrics': {
      if(!player.current)throw new UserError('Start a track before requesting lyrics.');
      if(!manager.lyrics)throw new UserError('Lyrics are unavailable. The operator must configure a lawful LYRICS_ADAPTER; the bot does not scrape copyrighted lyric sites.');
      const signal=AbortSignal.timeout(10000);
      const result=await withAbort(manager.lyrics.lookup(player.current,{signal}),signal);
      let source; try{source=new URL(result?.sourceUrl);}catch{}
      if(!result?.text||!result?.license||source?.protocol!=='https:')throw new UserError('The lyrics adapter returned no usable text, license, or source attribution.');
      return reply({embeds:[new EmbedBuilder().setColor(0x1db954).setTitle('Lyrics').setDescription(result.text.slice(0,3500)).addFields({name:'Source and license',value:`[Source](${source.href}) • ${String(result.license).slice(0,200)}${result.text.length>3500?'\nExcerpt shown; see source for full lyrics.':''}`})]});
    }
    default: throw new UserError(`Unknown music command. Use ${prefix}help.`);
  }
}
