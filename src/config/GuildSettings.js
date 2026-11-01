import { readFile,mkdir,writeFile,rename,rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Mutex } from '../utils/async.js';
import { UserError } from '../utils/errors.js';

const validId=value=>typeof value==='string'&&/^\d{17,22}$/.test(value);
export class GuildSettings {
  constructor(file=null,values=[]){this.file=file;this.values=new Map(values);this.lock=new Mutex();}
  static async open(file){
    try{
      const text=await readFile(file,'utf8');
      if(Buffer.byteLength(text)>1024*1024)throw Error();
      const data=JSON.parse(text);
      if(data?.version!==1||!data.guilds||typeof data.guilds!=='object'||Array.isArray(data.guilds))throw Error();
      const values=Object.entries(data.guilds).map(([id,value])=>{
        if(!validId(id)||!validId(value?.logChannelId))throw Error();
        return [id,value.logChannelId];
      });
      return new GuildSettings(file,values);
    }catch(error){
      if(error.code==='ENOENT')return new GuildSettings(file);
      throw new UserError('The saved guild settings file is invalid or unreadable. Check data/guild-settings.json before starting.','GUILD_SETTINGS');
    }
  }
  getLogChannel(guildId){return this.values.get(guildId)??null;}
  setLogChannel(guildId,channelId){
    if(!validId(guildId)||(channelId!==null&&!validId(channelId)))throw new UserError('Invalid server or log channel ID.','GUILD_SETTINGS');
    return this.lock.run(async()=>{
      const next=new Map(this.values);
      if(channelId===null)next.delete(guildId);else next.set(guildId,channelId);
      if(this.file){
        const directory=path.dirname(this.file),temporary=path.join(directory,`.guild-settings-${randomUUID()}.tmp`);
        try{
          await mkdir(directory,{recursive:true,mode:0o700});
          const guilds=Object.fromEntries([...next].map(([id,logChannelId])=>[id,{logChannelId}]));
          const serialized=JSON.stringify({version:1,guilds},null,2)+'\n';
          if(Buffer.byteLength(serialized)>1024*1024)throw Error();
          await writeFile(temporary,serialized,{mode:0o600,flag:'wx'});
          await rename(temporary,this.file);
        }catch{throw new UserError('The log channel setting could not be saved. Check write access to the data folder.','GUILD_SETTINGS');}
        finally{await rm(temporary,{force:true}).catch(()=>{});}
      }
      this.values=next;
    });
  }
}
