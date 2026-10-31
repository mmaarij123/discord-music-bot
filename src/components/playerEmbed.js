import { EmbedBuilder, escapeMarkdown } from 'discord.js';
export function duration(seconds) {
  if (!Number.isFinite(seconds) || seconds<0) return 'Unknown';
  const value=Math.floor(seconds), parts=[Math.floor(value/60),value%60];
  if (value>=3600) return `${Math.floor(value/3600)}:${String(Math.floor(value/60)%60).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;
  return `${parts[0]}:${String(parts[1]).padStart(2,'0')}`;
}
function safeUrl(value) { try { const url=new URL(value); return url.protocol==='https:' ? url.href : undefined; } catch { return undefined; } }
export function playerEmbed(session) {
  const prefix=session.config.prefix ?? '>';
  const track=session.current;
  const embed=new EmbedBuilder().setColor(0x1db954).setAuthor({name:'MUSIC • YOUR SERVER’S LISTENING ROOM'});
  if (!track) return embed.setTitle(session.state==='disconnected' ? 'Disconnected' : 'Ready for the next track')
    .setDescription(session.queue.length ? `${session.queue.length} tracks waiting. Use ${prefix}play or ${prefix}skip to continue.` : `Use ${prefix}play to discover music or select your authorized library.`)
    .setFooter({text:session.persistent ? '24/7 on' : 'Idle timeout enabled'});
  const status={paused:'Paused',preparing:'Preparing',buffering:'Buffering',recovering:'Reconnecting','waiting-for-voice':'Connecting'}[session.state] ?? 'Playing';
  const requester=/^\d{17,22}$/.test(track.requestedBy?.id ?? '')
    ? `<@${track.requestedBy.id}>`
    : escapeMarkdown((track.requestedBy?.name ?? 'Unknown').slice(0,100));
  embed.setTitle(track.title.slice(0,256)).setDescription(`**${escapeMarkdown((track.artist || track.channel || 'Unknown artist').slice(0,200))}**\n\n${status}`)
    .addFields(
      {name:'Requested by',value:requester,inline:true},
      {name:'Up next',value:String(session.queue.length),inline:true},
      {name:'Volume',value:`${session.volume}%`,inline:true});
  if (track.album) embed.addFields({name:'Album',value:String(track.album).slice(0,1024)});
  const url=safeUrl(track.youtubeUrl ?? track.sourceUrl), artwork=safeUrl(track.artwork);
  if (url) embed.setURL(url);
  if (artwork) embed.setThumbnail(artwork);
  return embed;
}
