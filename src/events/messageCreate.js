import { PermissionFlagsBits } from 'discord.js';
import { parsePrefix } from '../commands/parsePrefix.js';
import { messageContext } from '../commands/messageContext.js';
import { execute } from '../commands/execute.js';
import { publicError, UserError } from '../utils/errors.js';
import { createCooldown } from '../utils/cooldown.js';

export function messageHandler(manager, logger, { cooldown = createCooldown() } = {}) {
  const prefix = manager.config?.prefix ?? '>';
  return async message => {
    if (!message.inGuild() || message.author.bot || message.webhookId || !message.content?.startsWith(prefix)) return;
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
      cooldown(message.guildId, message.author.id);
      const parsed = parsePrefix(message.content, prefix);
      if (!parsed) return;
      action = parsed.commandName;
      context = messageContext(message, parsed, prefix);
      if (!permissions.has(PermissionFlagsBits.EmbedLinks)) throw new UserError('The bot needs Embed Links permission here to show music replies and the player.');
      await execute(context, manager, action);
    } catch (error) {
      logger.warn('prefix_command_failed', { guildId: message.guildId, command: action, error });
      try {
        const payload = { content: publicError(error), embeds: [], allowedMentions: { parse: [], repliedUser: false } };
        if (context) await context.editReply(payload);
        else await message.reply({ ...payload, failIfNotExists: false });
      } catch (replyError) { logger.debug('prefix_reply_failed', { code: replyError.code }); }
    }
  };
}
