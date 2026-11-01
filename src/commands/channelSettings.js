import { PermissionFlagsBits } from 'discord.js';
import { UserError } from '../utils/errors.js';
import { findLogChannel } from '../utils/channels.js';

export async function channelSettings(interaction,manager,reply,kind){
  const dj=kind==='dj',command=dj?'djchannel':'logchannel',label=dj?'DJ player':'Music log';
  const prefix=interaction.commandPrefix??manager.config?.prefix??'>';
  const member=await interaction.guild.members.fetch(interaction.user.id);
  if(!member.permissions.has(PermissionFlagsBits.ManageGuild))throw new UserError(`Manage Server permission is required to configure the ${dj?'DJ':'log'} channel.`);
  const selection=interaction.options.getString('channel');
  if(!selection){
    const id=dj?manager.settings.getDjChannel(interaction.guildId):manager.settings.getLogChannel(interaction.guildId);
    return reply(id?`${label} channel: <#${id}>. Use ${prefix}${command} off to reset.`:`No ${label.toLowerCase()} channel is configured. Use ${prefix}${command} #channelname to set one.`);
  }
  const channel=selection.toLowerCase()==='off'?null:await findLogChannel(interaction.guild,selection);
  if(dj)await manager.setDjChannel(interaction.guild,channel,interaction.channel);
  else await manager.setLogChannel(interaction.guild,channel,interaction.channel);
  if(!channel)return reply(`${label} channel disabled. ${dj?'New player messages':'Logs'} will use the command channel.`);
  return reply(`${label} channel set to <#${channel.id}>. ${dj?'Only the player embed and controls will go there.':'Playback notices and other logs will go there; play confirmations stay in the command channel.'}`);
}
