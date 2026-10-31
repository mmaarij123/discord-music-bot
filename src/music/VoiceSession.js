import { joinVoiceChannel, entersState, VoiceConnectionStatus as Status } from '@discordjs/voice';
import { UserError } from '../utils/errors.js';
export class VoiceSession {
  constructor(guild, audioPlayer, onLost, logger) {
    Object.assign(this,{guild,audioPlayer,onLost,logger}); this.connection=null; this.recovering=false; this.closed=false;
  }
  get channelId() { return this.connection?.joinConfig.channelId; }
  ensureSubscription(){
    if(this.connection?.state.status===Status.Ready)this.connection.subscribe(this.audioPlayer);
  }
  async join(channel,{signal}={}) {
    signal?.throwIfAborted();
    if (this.channelId && this.channelId !== channel.id) throw new UserError('The bot is already active in another voice channel.');
    if (this.connection?.state.status === Status.Ready) {this.ensureSubscription();return;}
    this.closed=false;
    if (!this.connection) {
      const connection=joinVoiceChannel({ channelId:channel.id,guildId:this.guild.id,adapterCreator:this.guild.voiceAdapterCreator,selfDeaf:true,selfMute:false });
      this.connection=connection;
      connection.on('error',error=>this.logger.warn('voice_error',{guildId:this.guild.id,error}));
      connection.on(Status.Disconnected,()=>this.recover(connection));
      connection.on(Status.Destroyed,()=>{ if (!this.closed && this.connection===connection) { this.connection=null; this.onLost(); } });
      connection.subscribe(this.audioPlayer);
    }
    try {
      const readySignal=AbortSignal.any([signal,AbortSignal.timeout(20000)].filter(Boolean));
      await entersState(this.connection,Status.Ready,readySignal);signal?.throwIfAborted();this.ensureSubscription();
    }catch {
      this.destroy();
      if(signal?.aborted)throw signal.reason;
      throw new UserError('Voice connection timed out. Check Connect/Speak permissions and outbound UDP networking.','VOICE_TIMEOUT');
    }
  }
  async recover(connection) {
    if (this.closed || this.recovering || connection !== this.connection) return;
    this.recovering=true;
    try {
      // Allow the library to complete a server move / resume first.
      try { await entersState(connection,Status.Ready,5000);this.ensureSubscription();return; } catch {}
      for (let attempt=0;attempt<2;attempt++) {
        if (this.closed || connection !== this.connection) return;
        connection.rejoin();
        try { await entersState(connection,Status.Ready,10000);this.ensureSubscription();return; } catch {}
      }
      if (!this.closed && connection===this.connection) { this.destroy(); this.onLost(); }
    } catch (error) {
      this.logger.warn('voice_recovery_failed',{guildId:this.guild.id,error});
      if (!this.closed) { this.destroy(); this.onLost(); }
    } finally { this.recovering=false; }
  }
  destroy() {
    this.closed=true;
    const connection=this.connection; this.connection=null;
    if (connection && connection.state.status !== Status.Destroyed) connection.destroy();
  }
}
