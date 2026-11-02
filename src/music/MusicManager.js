import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { root } from '../config/config.js';
import { Semaphore } from '../utils/async.js';
import { UserError } from '../utils/errors.js';
import { SpotifyResolver } from './SpotifyResolver.js';
import { SpotifyApi } from './SpotifyApi.js';
import { YouTubeResolver } from './YouTubeResolver.js';
import { LocalMediaResolver } from './LocalMediaResolver.js';
import { AudioManager } from './AudioManager.js';
import { AutoplayManager } from './AutoplayManager.js';
import { DiscoveryService } from './DiscoveryService.js';
import { GuildPlayer } from './GuildPlayer.js';
import { PlayerPresenter } from '../components/PlayerPresenter.js';
import { PlayerMessageStore } from '../components/PlayerMessageStore.js';
import { GuildSettings } from '../config/GuildSettings.js';
import { requireLogChannel } from '../utils/channels.js';
import { startCacheCleanup } from '../utils/cache.js';
async function adapter(file,method) {
  if (!file) return null;
  const module=await import(pathToFileURL(path.resolve(root,file)).href);
  if (typeof module[method]!=='function') throw new UserError(`Configured adapter must export ${method}().`);
  return module;
}
export class MusicManager {
  static async create(config,logger) {
    const [search,recommendations]=await Promise.all([adapter(config.adapters.spotify,'search'),adapter(config.adapters.recommendations,'recommend')]);
    const credentials=config.spotify??{};
    const official=credentials.clientId&&credentials.clientSecret ? new SpotifyApi({...credentials,cacheMs:config.cacheMs}) : null;
    if(Boolean(credentials.clientId)!==Boolean(credentials.clientSecret))logger.warn('spotify_api_credentials_incomplete',{message:'Set both Spotify Client ID and Client Secret to enable optional official metadata search.'});
    const semaphore=new Semaphore(config.concurrency), youtube=new YouTubeResolver(config,semaphore), spotify=new SpotifyResolver(config,semaphore,search??official), local=new LocalMediaResolver(config);
    const settings=await GuildSettings.open(config.settingsFile);
    return new MusicManager(config,logger,{discovery:new DiscoveryService(spotify,youtube,local,config),audio:new AudioManager(config,youtube,local),autoplay:new AutoplayManager(youtube,recommendations),settings,caches:[youtube.cache,youtube.sourceCache,spotify.cache,official?.cache].filter(Boolean)});
  }
  constructor(config,logger,services) { Object.assign(this,{config,logger,...services});this.settings=services.settings??new GuildSettings();this.messageStore=new PlayerMessageStore(this.settings);this.players=new Map(); this.presenters=new Map(); this.imports=new Map(); this.closing=false; this.stopCacheCleanup=startCacheCleanup(services.caches??[]); }
  async outputChannel(guild,fallback){
    return this.destinationChannel(guild,fallback,'log');
  }
  async djChannel(guild,fallback){
    return this.destinationChannel(guild,fallback,'dj');
  }
  async destinationChannel(guild,fallback,kind){
    const id=kind==='dj'?this.settings.getDjChannel(guild.id):this.settings.getLogChannel(guild.id);if(!id)return fallback;
    let channel;
    try{channel=guild.channels.cache.get(id)??await guild.channels.fetch(id);if(!channel)throw Error();}
    catch{const command=kind==='dj'?'djchannel':'logchannel';throw new UserError(`The configured ${kind==='dj'?'DJ':'music log'} channel is unavailable. A moderator can use ${command} #channelname or ${command} off to fix it.`,'LOG_CHANNEL');}
    return requireLogChannel(guild,channel,{history:kind==='dj'});
  }
  async bindPresenter(guild,fallback){
    const channel=await this.djChannel(guild,fallback),notices=await this.outputChannel(guild,fallback),presenter=this.presenters.get(guild.id);
    if(!presenter)return;
    presenter.setNoticeChannel(notices);
    if(this.settings.getDjChannel(guild.id)&&presenter.channel&&presenter.channel.id!==channel.id)await presenter.relocate(channel);
    else presenter.bind(channel);
  }
  async setLogChannel(guild,channel,fallback){
    if(channel)await requireLogChannel(guild,channel);
    await this.settings.setLogChannel(guild.id,channel?.id??null);
    const presenter=this.presenters.get(guild.id);
    if(presenter)presenter.setNoticeChannel(channel??fallback);
  }
  async setDjChannel(guild,channel,fallback){
    if(channel)await requireLogChannel(guild,channel,{history:true});
    await this.settings.setDjChannel(guild.id,channel?.id??null);
    const presenter=this.presenters.get(guild.id);
    if(presenter){
      if(!presenter.noticeChannel)presenter.setNoticeChannel(fallback);
      const target=channel??fallback;
      if(presenter.channel?.id!==target.id)await presenter.relocate(target);else presenter.bind(target);
    }
  }
  get(guild,create=false) {
    let player=this.players.get(guild.id);
    if (!player && create) {
      if (this.closing) throw new UserError('The bot is shutting down. Try again after it restarts.');
      for(const stale of this.players.values()){
        if(!this.imports.has(stale.guild.id)&&!stale.idleHolds&&!stale.voice.channelId&&!stale.current&&!stale.queue.length)this.release(stale);
      }
      if (this.players.size>=this.config.maxPlayers) throw new UserError('The bot has reached its configured server session limit. Try again later.');
      player=new GuildPlayer(guild,this.config,{audio:this.audio,autoplay:this.autoplay,logger:this.logger,onRelease:p=>this.release(p)});
      this.players.set(guild.id,player); this.presenters.set(guild.id,new PlayerPresenter(player,this.logger,{messageStore:this.messageStore}));
    }
    return player;
  }
  release(player) {
    if (this.players.get(player.guild.id)!==player) return;
    this.players.delete(player.guild.id);
    const presenter=this.presenters.get(player.guild.id); this.presenters.delete(player.guild.id);
    // Release runs inside the player's mutex. Cleanup queues behind that operation.
    Promise.all([player.destroy(),presenter?.dispose()]).catch(error=>this.logger.warn('session_release_failed',{error}));
  }
  cancelImport(guildId) { this.imports.get(guildId)?.abort(); }
  clearCaches() {
    let removed=0;
    for(const cache of this.caches??[])removed+=cache.clear();
    return removed;
  }
  async import(guildId,fn) {
    if (this.imports.has(guildId)) throw new UserError(`A discovery/import request is already running in this server. Wait or use ${this.config.prefix ?? '>'}stop to cancel it.`);
    if (this.closing) throw new UserError('The bot is shutting down.');
    if (this.imports.size>=this.config.maxPlayers*2) throw new UserError('The discovery service is busy. Try again shortly.');
    const controller=new AbortController(); this.imports.set(guildId,controller);
    const timeout=setTimeout(()=>controller.abort(),120000); timeout.unref();
    try { return await fn(controller.signal); }
    finally { clearTimeout(timeout); this.imports.delete(guildId); }
  }
  async destroy() {
    this.closing=true; this.stopCacheCleanup(); for(const controller of this.imports.values())controller.abort();
    await Promise.allSettled([...this.players.values()].map(p=>p.destroy()));
    await Promise.allSettled([...this.presenters.values()].map(p=>p.dispose()));
    this.audio.dispose(); this.players.clear(); this.presenters.clear();
    this.clearCaches();
  }
}
