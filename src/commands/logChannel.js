import { PermissionFlagsBits } from 'discord.js';
import { UserError } from '../utils/errors.js';
import { findLogChannel } from '../utils/channels.js';

export async function logChannel(interaction,manager,reply){
  const prefix=interaction.commandPrefix??manager.config?.prefix??'>';
  const member=await interaction.guild.members.fetch(interaction.user.id);
  if(!member.permissions.has(PermissionFlagsBits.ManageGuild))throw new UserError('Manage Server permission is required to configure the log channel.');
  const selection=interaction.options.getString('channel');
  if(!selection){
    const id=manager.settings.getLogChannel(interaction.guildId);
    return reply(id?`Music log channel: <#${id}>. Use ${prefix}logchannel off to reset.`:`No music log channel is configured. Use ${prefix}logchannel #channelname to set one.`);
  }
  if(selection.toLowerCase()==='off'){
    await manager.setLogChannel(interaction.guild,null,interaction.channel);
    return reply('Music log channel disabled. New replies will use the command channel.');
  }
  const channel=await findLogChannel(interaction.guild,selection);
  await manager.setLogChannel(interaction.guild,channel,interaction.channel);
  return reply(`Music log channel set to <#${channel.id}>. Player messages, notices and new command replies will go there.`);
}
