import { randomBytes } from 'node:crypto';
import { playerEmbed } from './playerEmbed.js';
import { playerButtons } from './playerButtons.js';
import { Mutex } from '../utils/async.js';
export class PlayerPresenter {
  constructor(player,logger) {
    this.player=player; this.logger=logger; this.nonce=randomBytes(6).toString('hex'); this.message=null; this.channel=null; this.lock=new Mutex(); this.lastEdit=0; this.disposed=false;
    this.onChange=()=>this.schedule(); this.onNotice=message=>this.notice(message);
    player.on('change',this.onChange); player.on('notice',this.onNotice);
  }
  bind(channel) { if (!this.channel) this.channel=channel; this.schedule(); }
  async relocate(channel){
    await this.lock.run(async()=>{
      if(this.disposed)return;
      clearTimeout(this.timer);this.timer=null;
      const previous=this.message;this.message=null;this.channel=channel;this.nonce=randomBytes(6).toString('hex');
      if(previous)await previous.edit({components:[]}).catch(error=>this.logger.debug('old_player_controls_cleanup_failed',{code:error.code}));
    });
    this.schedule();
  }
  schedule() {
    if (this.disposed || !this.channel || this.timer) return;
    this.timer=setTimeout(()=>{this.timer=null; this.render().catch(error=>this.logger.warn('player_message_failed',{guildId:this.player.guild.id,error}));},Math.max(100,2000-(Date.now()-this.lastEdit)));
    this.timer.unref();
  }
  render() { return this.lock.run(async()=>{
    if (this.disposed || !this.channel) return;
    const payload={embeds:[playerEmbed(this.player)],components:playerButtons(this.player,this.nonce),allowedMentions:{parse:[]}};
    this.lastEdit=Date.now();
    if (this.message) {
      try { await this.message.edit(payload); }
      catch (error) {
        if (error.code===10008) { this.message=null; this.channel=null; }
        else throw error;
      }
    } else this.message=await this.channel.send(payload);
  }); }
  notice(message) {
    this.pendingNotice=message;
    if (this.noticeTimer || !this.channel || this.disposed) return;
    this.noticeTimer=setTimeout(()=>{
      this.noticeTimer=null;
      this.channel?.send({content:this.pendingNotice.slice(0,1900),allowedMentions:{parse:[]}}).catch(error=>this.logger.warn('notice_failed',{guildId:this.player.guild.id,error}));
    },3000); this.noticeTimer.unref();
  }
  async dispose() {
    this.disposed=true; clearTimeout(this.timer); clearTimeout(this.noticeTimer);
    this.player.off('change',this.onChange); this.player.off('notice',this.onNotice);
    await this.lock.run(async()=>{
      if (this.message) await this.message.edit({embeds:[playerEmbed(this.player)],components:[]}).catch(()=>{});
    });
  }
}
