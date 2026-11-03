import { PermissionFlagsBits } from 'discord.js';
import mentionPanels from '../components/mentionPanels.json' with { type: 'json' };
import { panelsMessage, commandMessage } from '../components/messages.js';
import { parsePrefix } from '../commands/parsePrefix.js';
import { messageContext } from '../commands/messageContext.js';
import { execute } from '../commands/execute.js';
import { publicError } from '../utils/errors.js';
import { createCooldown } from '../utils/cooldown.js';
import { guildPrefix, prefixPanels } from '../config/prefix.js';

export function messageHandler(manager, logger, { cooldown = createCooldown() } = {}) {
  return async message => {
    if (!message.inGuild() || message.author.bot || message.webhookId) return;
    const prefix = guildPrefix(manager,message.guildId);
    const botId=message.client?.user?.id??message.guild.members.me?.id;
    const mentioned=Boolean(botId&&[`<@${botId}>`,`<@!${botId}>`].includes(message.content?.trim()));
    if(!mentioned&&!message.content?.startsWith(prefix))return;
    let context;
    let action;
    try {
      const bot = message.guild.members.me ?? await message.guild.members.fetchMe();
      const permissions = message.channel.permissionsFor(bot);
      const send = message.channel.isThread() ? PermissionFlagsBits.SendMessagesInThreads : PermissionFlagsBits.SendMessages;
      if (!permissions?.has([PermissionFlagsBits.ViewChannel, send])) {
        logger.warn('prefix_reply_permission_missing', { guildId: message.guildId });
        return;
      }
      if(mentioned){
        action='mention';
        cooldown(message.guildId,message.author.id);
        await message.reply({...panelsMessage(prefixPanels(mentionPanels,prefix)),failIfNotExists:false});
        return;
      }
      const head=message.content.slice(prefix.length).trim().split(/\s+/,1)[0]?.toLowerCase();
      if(!head)return;
      cooldown(message.guildId, message.author.id);
      const parsed = parsePrefix(message.content, prefix);
      if (!parsed) return;
      action = parsed.commandName;
      context = messageContext(message, parsed, prefix);
      await execute(context, manager, action);
    } catch (error) {
      logger.warn('prefix_command_failed', { guildId: message.guildId, command: action, error });
      try {
        const payload=commandMessage(publicError(error));
        if (context) await context.editReply(payload);
        else await message.reply({...payload,failIfNotExists:false});
      } catch (replyError) { logger.debug('prefix_reply_failed', { code: replyError.code }); }
    }
  };
}
