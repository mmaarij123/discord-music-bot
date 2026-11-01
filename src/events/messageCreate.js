import { PermissionFlagsBits } from 'discord.js';
import { parsePrefix } from '../commands/parsePrefix.js';
import { messageContext } from '../commands/messageContext.js';
import { execute } from '../commands/execute.js';
import { publicError, UserError } from '../utils/errors.js';
import { createCooldown } from '../utils/cooldown.js';
import { ownerCommands } from '../config/owner.js';
const localReplies=new Set(['help','play','logchannel','djchannel',...ownerCommands]);
const stopCommands=new Set(['stop','leave']);

export function messageHandler(manager, logger, { cooldown = createCooldown() } = {}) {
  const prefix = manager.config?.prefix ?? '>';
  return async message => {
    if (!message.inGuild() || message.author.bot || message.webhookId || !message.content?.startsWith(prefix)) return;
    let context;
    let action;
    let output=message.channel;
    try {
      const bot = message.guild.members.me ?? await message.guild.members.fetchMe();
      const permissions = message.channel.permissionsFor(bot);
      const send = message.channel.isThread() ? PermissionFlagsBits.SendMessagesInThreads : PermissionFlagsBits.SendMessages;
      if (!permissions?.has([PermissionFlagsBits.ViewChannel, send])) {
        logger.warn('prefix_reply_permission_missing', { guildId: message.guildId });
        return;
      }
      const head=message.content.slice(prefix.length).trim().split(/\s+/,1)[0]?.toLowerCase();
      if(!head)return;
      if(!localReplies.has(head)){
        try{output=await manager.outputChannel?.(message.guild,message.channel)??message.channel;}
        catch(error){
          if(!stopCommands.has(head))throw error;
          logger.warn('stop_reply_channel_unavailable',{guildId:message.guildId,error});
        }
      }
      const outputPermissions=output.permissionsFor(bot);
      const needsEmbeds=head==='help'||(!localReplies.has(head)&&!stopCommands.has(head));
      if(needsEmbeds&&!outputPermissions?.has(PermissionFlagsBits.EmbedLinks))throw new UserError('The bot needs Embed Links permission in the output channel to show music replies and the player.');
      cooldown(message.guildId, message.author.id);
      const parsed = parsePrefix(message.content, prefix);
      if (!parsed) return;
      action = parsed.commandName;
      context = messageContext(message, parsed, prefix);
      context.setResponseChannel(output);
      await execute(context, manager, action);
    } catch (error) {
      logger.warn('prefix_command_failed', { guildId: message.guildId, command: action, error });
      try {
        const payload = { content: publicError(error), embeds: [], allowedMentions: { parse: [], repliedUser: false } };
        if (context) await context.editReply(payload);
        else if(output===message.channel)await message.reply({...payload,failIfNotExists:false});
        else await output.send(payload);
      } catch (replyError) { logger.debug('prefix_reply_failed', { code: replyError.code }); }
    }
  };
}
