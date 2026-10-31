import { MessageFlags } from 'discord.js';
import { execute } from '../commands/execute.js';
import { UserError, publicError } from '../utils/errors.js';
import { createCooldown } from '../utils/cooldown.js';
export function interactionHandler(manager,logger,{cooldown=createCooldown()}={}) {
  return async interaction=>{
    if(!interaction.isButton()||!interaction.customId.startsWith('music:'))return;
    try {
      await interaction.deferReply({flags:MessageFlags.Ephemeral});
      if(!interaction.inGuild())throw new UserError('Use music commands inside a server.');
      const prefix=manager.config?.prefix ?? '>';
      cooldown(interaction.guildId,interaction.user.id);
      const [,nonce,action]=interaction.customId.split(':');
      const presenter=manager.presenters.get(interaction.guildId);
      if(!presenter || nonce!==presenter.nonce || presenter.message?.id!==interaction.message.id)throw new UserError(`These controls have expired. Use the current player or ${prefix}help.`);
      if(!['previous','pause','resume','skip','stop','loop','shuffle'].includes(action))throw new UserError('Unknown player control.');
      await execute(interaction,manager,action);
    }catch(error){
      logger.warn('interaction_failed',{guildId:interaction.guildId,command:interaction.commandName,error});
      try{
        const payload={content:publicError(error),embeds:[],allowedMentions:{parse:[]}};
        if(interaction.deferred||interaction.replied)await interaction.editReply(payload);
        else await interaction.reply({...payload,flags:MessageFlags.Ephemeral});
      }catch(replyError){logger.debug('interaction_expired',{code:replyError.code});}
    }
  };
}
