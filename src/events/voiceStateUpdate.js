export function voiceStateHandler(manager,client,logger){
  return (oldState,newState)=>{
    if(newState.id!==client.user.id)return;
    const player=manager.players.get(newState.guild.id);
    if(!player)return;
    if(oldState.channelId&&!newState.channelId){
      logger.info('voice_removed',{guildId:newState.guild.id});
      // @discordjs/voice owns its bounded recovery; this event only refreshes UI.
      player.changed();
    }
    if(newState.channelId&&newState.serverMute)player.notify('The bot is server-muted. A moderator must unmute it for audio to be heard.');
  };
}
