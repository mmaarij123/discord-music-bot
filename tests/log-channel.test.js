import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp,readFile,writeFile,rm,readdir } from 'node:fs/promises';
import { ChannelType } from 'discord.js';
import { GuildSettings } from '../src/config/GuildSettings.js';
import { findLogChannel,requireLogChannel } from '../src/utils/channels.js';
import { MusicManager } from '../src/music/MusicManager.js';
import { PlayerPresenter } from '../src/components/PlayerPresenter.js';
import { parsePrefix } from '../src/commands/parsePrefix.js';
import { messageHandler } from '../src/events/messageCreate.js';
import { messageContext } from '../src/commands/messageContext.js';
import { loadConfig } from '../src/config/config.js';
import { fixture,logger,track } from './helpers.js';

const GUILD='111111111111111111',OTHER_GUILD='222222222222222222',SOURCE='333333333333333333',OUTPUT='444444444444444444',SECOND='555555555555555555';
async function folder(t){
  const directory=await mkdtemp(path.join(tmpdir(),'music-log-settings-'));
  t.after(async()=>{assert.ok(path.resolve(directory).startsWith(path.resolve(tmpdir())+path.sep));await rm(directory,{recursive:true,force:true});});
  return directory;
}
function channel(id,name='music-logs',guildId=GUILD){
  const messages=[],edits=[],permissions={has:()=>true};
  const value={id,name,guildId,type:ChannelType.GuildText,isTextBased:()=>true,isThread:()=>false,permissionsFor:()=>permissions,messages,edits,permissions};
  value.send=async payload=>{messages.push(payload);const message={id:`message-${messages.length}`,edit:async next=>{edits.push(next);return message;}};return message;};
  return value;
}
function setup(t){
  const source=channel(SOURCE,'commands'),output=channel(OUTPUT),other=channel(SECOND,'other');
  const member={voice:{channel:null},permissions:{has:()=>true}};
  const channels=new Map([source,output,other].map(value=>[value.id,value]));
  const guild={id:GUILD,members:{me:{id:'bot',voice:{}},fetch:async()=>member},channels:{cache:channels,fetch:async id=>id?channels.get(id)??null:channels}};
  const manager=new MusicManager(loadConfig({}),logger,{audio:{dispose(){}}});t.after(()=>manager.destroy());
  const message=content=>({content,author:{id:'666666666666666666',username:'Listener'},guildId:GUILD,guild,channel:source,inGuild:()=>true,reply:payload=>source.send(payload)});
  const run=content=>messageHandler(manager,logger,{cooldown:()=>{}})(message(content));
  return {source,output,other,member,guild,channels,manager,message,run};
}

test('logchannel accepts a channel name, mention, ID, off and status query',()=>{
  for(const text of ['#music-logs',`<#${OUTPUT}>`,OUTPUT,'off'])assert.equal(parsePrefix(`>logchannel ${text}`).values.channel,text);
  assert.equal(parsePrefix('>logchannel').values.channel,undefined);
  assert.throws(()=>parsePrefix('>logchannel #one #two'),/Too many/);
});
test('settings start empty and persist independently across guilds and restart',async t=>{
  const file=path.join(await folder(t),'data','guild-settings.json'),settings=await GuildSettings.open(file);
  assert.equal(settings.getLogChannel(GUILD),null);
  await Promise.all([settings.setLogChannel(GUILD,OUTPUT),settings.setLogChannel(OTHER_GUILD,SECOND)]);
  const loaded=await GuildSettings.open(file);assert.equal(loaded.getLogChannel(GUILD),OUTPUT);assert.equal(loaded.getLogChannel(OTHER_GUILD),SECOND);
  await loaded.setLogChannel(GUILD,null);const final=await GuildSettings.open(file);
  assert.equal(final.getLogChannel(GUILD),null);assert.equal(final.getLogChannel(OTHER_GUILD),SECOND);
  assert.deepEqual(await readdir(path.dirname(file)),['guild-settings.json']);
});
test('failed persistent writes do not apply a setting in memory',async t=>{
  const base=await folder(t),blocked=path.join(base,'file');await writeFile(blocked,'not a directory');
  const settings=new GuildSettings(path.join(blocked,'settings.json'));
  await assert.rejects(settings.setLogChannel(GUILD,OUTPUT),{code:'GUILD_SETTINGS'});assert.equal(settings.getLogChannel(GUILD),null);
});
test('malformed and oversized settings fail safely without silent routing fallback',async t=>{
  const file=path.join(await folder(t),'settings.json');
  for(const text of ['invalid private-settings-value',JSON.stringify({version:1,guilds:{bad:{logChannelId:OUTPUT}}}),' '.repeat(1024*1024+1)]){
    await writeFile(file,text);await assert.rejects(GuildSettings.open(file),error=>error.code==='GUILD_SETTINGS'&&!error.message.includes('private-settings-value'));
  }
});
test('settings validate IDs before writing',()=>{
  const settings=new GuildSettings();assert.throws(()=>settings.setLogChannel('../outside',OUTPUT),{code:'GUILD_SETTINGS'});
  assert.throws(()=>settings.setLogChannel(GUILD,'not-a-channel'),{code:'GUILD_SETTINGS'});
});
test('channel lookup supports names/mentions while rejecting duplicate names',async t=>{
  const f=setup(t);assert.equal(await findLogChannel(f.guild,'#music-logs'),f.output);assert.equal(await findLogChannel(f.guild,`<#${OUTPUT}>`),f.output);
  f.other.name='music-logs';await assert.rejects(findLogChannel(f.guild,'music-logs'),/Multiple channels/);
});
test('other-guild, voice and inaccessible channels cannot be configured',async t=>{
  const f=setup(t);await assert.rejects(requireLogChannel(f.guild,channel(SECOND,'private',OTHER_GUILD)),{code:'LOG_CHANNEL'});
  f.output.type=ChannelType.GuildVoice;await assert.rejects(requireLogChannel(f.guild,f.output),{code:'LOG_CHANNEL'});
  f.output.type=ChannelType.GuildText;f.output.permissions.has=()=>false;await assert.rejects(requireLogChannel(f.guild,f.output),/View Channel, Send Messages and Embed Links/);
});
test('moderators can configure the channel without joining voice',async t=>{
  const f=setup(t);await f.run('>logchannel #music-logs');assert.equal(f.manager.settings.getLogChannel(GUILD),OUTPUT);
  assert.match(f.source.messages.at(-1).content,new RegExp(OUTPUT));assert.equal(f.output.messages.length,0);
});
test('non-moderators cannot inspect, change or disable the setting',async t=>{
  const f=setup(t);await f.manager.settings.setLogChannel(GUILD,OUTPUT);f.member.permissions.has=()=>false;
  for(const command of ['>logchannel','>logchannel #other','>logchannel off'])await f.run(command);
  assert.equal(f.manager.settings.getLogChannel(GUILD),OUTPUT);assert.ok(f.source.messages.every(value=>value.content.includes('Manage Server')));
});
test('configured replies route to the selected channel instead of the command channel',async t=>{
  const f=setup(t);await f.manager.settings.setLogChannel(GUILD,OUTPUT);await f.run('>help');
  assert.equal(f.source.messages.length,0);assert.equal(f.output.messages.length,1);assert.ok(f.output.messages[0].embeds.length);
  assert.deepEqual(f.output.messages[0].allowedMentions,{parse:[],repliedUser:false});
});
test('malformed commands and validation errors also route to the configured channel',async t=>{
  const f=setup(t);await f.manager.settings.setLogChannel(GUILD,OUTPUT);await f.run('>volume bad');await f.run('>unknown');
  assert.equal(f.source.messages.length,0);assert.equal(f.output.messages.length,2);assert.match(f.output.messages[0].content,/Usage/);
});
test('search progress edits one message in the destination channel',async t=>{
  const f=setup(t),context=messageContext(f.message('>play Song'),parsePrefix('>play Song'));context.setResponseChannel(f.output);
  await context.editReply('Searching of `Song`');await context.editReply('Added `Song` in the queue');
  assert.equal(context.channel,f.output);assert.equal(f.source.messages.length,0);assert.equal(f.output.messages.length,1);assert.equal(f.output.edits.length,1);
});
test('deleted or inaccessible configured channels do not silently send music elsewhere',async t=>{
  const f=setup(t);await f.manager.settings.setLogChannel(GUILD,OUTPUT);f.channels.delete(OUTPUT);
  await assert.rejects(f.manager.outputChannel(f.guild,f.source),{code:'LOG_CHANNEL'});
  await f.run('>help');assert.equal(f.output.messages.length,0);assert.match(f.source.messages[0].content,/text channel|unavailable/);
  assert.equal(f.manager.settings.getLogChannel(GUILD),OUTPUT);
});
test('logchannel off is usable when the old destination is missing',async t=>{
  const f=setup(t);await f.manager.settings.setLogChannel(GUILD,OUTPUT);f.channels.delete(OUTPUT);await f.run('>logchannel off');
  assert.equal(f.manager.settings.getLogChannel(GUILD),null);await f.run('>help');assert.ok(f.source.messages.at(-1).embeds.length);
});
test('changing output invalidates old controls and preserves active audio',async t=>{
  const f=setup(t),music=fixture({id:GUILD});await music.player.enqueue([track('A')],music.channel);
  const presenter=new PlayerPresenter(music.player,logger);f.manager.players.set(GUILD,music.player);f.manager.presenters.set(GUILD,presenter);
  presenter.bind(f.source);await presenter.render();const handle=music.player.handle,nonce=presenter.nonce;
  await f.manager.setLogChannel(f.guild,f.output,f.source);await presenter.render();
  assert.equal(music.player.handle,handle);assert.equal(music.player.current.title,'A');assert.notEqual(presenter.nonce,nonce);
  assert.deepEqual(f.source.edits.at(-1).components,[]);assert.equal(f.output.messages.length,1);assert.equal(presenter.channel,f.output);
});
test('relocation waits for an in-flight render so an old send cannot replace the new player',async t=>{
  const music=fixture({id:GUILD}),presenter=new PlayerPresenter(music.player,logger);t.after(async()=>{await music.player.destroy();await presenter.dispose();});
  let release;const pending=new Promise(resolve=>{release=resolve;});const oldMessage={edit:async()=>{}};
  const old=channel(SOURCE),target=channel(OUTPUT);old.send=async()=>{await pending;return oldMessage;};presenter.channel=old;
  const rendering=presenter.render(),moving=presenter.relocate(target);release();await Promise.all([rendering,moving]);
  assert.equal(presenter.channel,target);assert.equal(presenter.message,null);await presenter.render();assert.equal(target.messages.length,1);
});
test('default binding preserves the original session output without a configured destination',async t=>{
  const f=setup(t),music=fixture({id:GUILD}),presenter=new PlayerPresenter(music.player,logger);
  f.manager.players.set(GUILD,music.player);f.manager.presenters.set(GUILD,presenter);presenter.bind(f.source);
  await f.manager.bindPresenter(f.guild,f.other);assert.equal(presenter.channel,f.source);
});
test('saved JSON contains only channel preferences and no runtime player data',async t=>{
  const file=path.join(await folder(t),'settings.json'),settings=new GuildSettings(file);await settings.setLogChannel(GUILD,OUTPUT);
  assert.deepEqual(JSON.parse(await readFile(file,'utf8')),{version:1,guilds:{[GUILD]:{logChannelId:OUTPUT}}});
});
test('production manager factory reloads saved routing after a restart',async t=>{
  const f=setup(t),config={...loadConfig({}),settingsFile:path.join(await folder(t),'settings.json')};
  const first=await MusicManager.create(config,logger);await first.setLogChannel(f.guild,f.output,f.source);await first.destroy();
  const restarted=await MusicManager.create(config,logger);t.after(()=>restarted.destroy());
  assert.equal(await restarted.outputChannel(f.guild,f.source),f.output);
});
