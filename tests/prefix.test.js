import test from 'node:test';
import assert from 'node:assert/strict';
import { ChannelType,PermissionFlagsBits } from 'discord.js';
import { parsePrefix } from '../src/commands/parsePrefix.js';
import { messageContext } from '../src/commands/messageContext.js';
import { messageHandler } from '../src/events/messageCreate.js';
import { interactionHandler } from '../src/events/interactionCreate.js';
import { createCooldown } from '../src/utils/cooldown.js';
import { loadConfig } from '../src/config/config.js';
import { fixture,logger } from './helpers.js';
import helpEmbeds from '../src/components/helpEmbeds.json' with { type: 'json' };

function message(content='>help') {
  const replies=[],edits=[];
  const permissions={has:()=>true};
  const member={voice:{channel:{id:'voice',type:ChannelType.GuildVoice,full:false,permissionsFor:()=>permissions}},permissions};
  const guild={id:'guild',members:{me:{voice:{}},fetch:async()=>member}};
  const response={id:'reply',edit:async payload=>{edits.push(payload);return response;}};
  return {content,author:{id:'listener',username:'Listener',bot:false},guild,guildId:'guild',
    channel:{isThread:()=>false,isTextBased:()=>true,permissionsFor:()=>permissions},
    inGuild:()=>true,reply:async payload=>{replies.push(payload);return response;},replies,edits,response,permissions,member};
}

test('prefix defaults to > and validates custom prefixes',()=>{
  assert.equal(loadConfig({}).prefix,'>');assert.equal(loadConfig({PREFIX:'!!'}).prefix,'!!');
  for(const prefix of ['', ' ', 'too-long', '>\n'])assert.throws(()=>loadConfig({PREFIX:prefix}),/PREFIX/);
});
test('ignores ordinary messages, slash syntax and empty prefixes',()=>{
  for(const text of ['hello','/play song',' >help','>','>   '])assert.equal(parsePrefix(text),null);
});
test('play preserves full search text and public URLs',()=>{
  assert.deepEqual(parsePrefix('>PLAY Stephen Sanchez Until I Found You'),{commandName:'play',values:{query:'Stephen Sanchez Until I Found You'}});
  assert.equal(parsePrefix('> play https://open.spotify.com/track/1234567890123456789012').values.query,'https://open.spotify.com/track/1234567890123456789012');
});
test('supports every prefix command with typed arguments',()=>{
  const samples=['play Song','pause','resume','skip','stop','queue 2','nowplaying','volume 70','loop queue','shuffle','remove 2','join','leave','autoplay off','logchannel','djchannel','clearcache','shutdown','restart','help'];
  for(const sample of samples)assert.ok(parsePrefix(`>${sample}`));
  assert.equal(parsePrefix('>volume 0').values.level,0);assert.equal(parsePrefix('>queue').values.page,undefined);
  assert.equal(parsePrefix('>autoplay true').values.enabled,true);assert.equal(parsePrefix('>autoplay false').values.enabled,false);
});
test('custom prefix affects parsing and usage errors',()=>{
  assert.equal(parsePrefix('!!help','!!').commandName,'help');assert.equal(parsePrefix('>help','!!'),null);
  assert.throws(()=>parsePrefix('!!volume nope','!!'),/Usage: !!volume/);
});
test('rejects unknown, missing, excess and invalid arguments',()=>{
  for(const text of ['>unknown','>play','>volume -1','>volume 101','>volume 5.5','>volume 1e2','>volume 1 2','>pause extra','>loop invalid','>autoplay yes','>remove 0','>play a\nb',`>play ${'a'.repeat(501)}`])assert.throws(()=>parsePrefix(text));
});
test('message context edits a single progress reply and suppresses mentions',async()=>{
  const m=message(),context=messageContext(m,parsePrefix('>help'));
  await Promise.all([context.editReply('Searching…'),context.editReply({embeds:[] ,content:'Added.'})]);
  assert.equal(m.replies.length,1);assert.equal(m.edits.length,1);
  assert.deepEqual(m.replies[0].allowedMentions,{parse:[],repliedUser:false});
});
test('typed options preserve false and zero',()=>{
  const volume=messageContext(message(),parsePrefix('>volume 0'));
  const autoplay=messageContext(message(),parsePrefix('>autoplay off'));
  assert.equal(volume.options.getInteger('level',true),0);assert.equal(autoplay.options.getBoolean('enabled',true),false);
  assert.equal(volume.options.getInteger('page'),null);assert.throws(()=>volume.options.getString('level',true),/Invalid/);
});
test('deleted progress responses can be safely recreated',async()=>{
  const m=message(),context=messageContext(m,parsePrefix('>help'));
  await context.editReply('Searching');m.response.edit=async()=>{const error=Error('deleted');error.code=10008;throw error;};
  await context.editReply('Done');assert.equal(m.replies.length,2);
});
test('help reproduces all five Discohook embeds without changing text, colours or order',async()=>{
  const m=message();await messageHandler({config:{prefix:'>'},get:()=>undefined},logger)(m);
  assert.equal(m.replies.length,1);const embeds=m.replies[0].embeds.map(embed=>embed.toJSON());
  assert.deepEqual(embeds,helpEmbeds);
  assert.deepEqual(embeds.map(embed=>embed.color),[16711904,7405312,65515,16711762,7471104]);
  assert.equal(embeds[0].title,'**Your Prefix is **`>`');
  assert.equal(embeds[1].title,'**Playback Controls**');
  assert.equal(embeds[2].title,'**Queue Management**');
  assert.equal(embeds[3].title,'**Voice & Audio**');
  assert.equal(embeds[4].title,'**Channel Configuration**');
  assert.ok(embeds[1].description.startsWith('`Play` Search for a song and start playing, or add it to the queue.'));
  assert.ok(embeds.reduce((length,embed)=>length+embed.title.length+(embed.description?.length??0),0)<=6000);
});
test('message handler ignores bot, webhook and direct messages',async()=>{
  for(const change of [{author:{id:'bot',bot:true}},{webhookId:'hook'},{inGuild:()=>false},{content:'ordinary message'}]){
    const m=Object.assign(message(),change);await messageHandler({config:{prefix:'>'},get:()=>assert.fail('ignored message')},logger)(m);assert.equal(m.replies.length,0);
  }
});
test('prefix controls enforce voice membership and shared queue methods',async t=>{
  const f=fixture();t.after(()=>f.player.destroy());const m=message('>volume 25');
  const manager={config:{prefix:'>'},get:()=>f.player};await messageHandler(manager,logger)(m);assert.equal(f.player.volume,25);
  const other=message('>skip');other.member.voice.channel=null;
  await messageHandler(manager,logger)(other);assert.match(other.replies[0].content,/Join a voice channel/);
});
test('prefix play reaches discovery with the complete query',async t=>{
  const f=fixture();t.after(()=>f.player.destroy());const m=message('>play Artist Long Song Name');let query;
  const manager={config:{prefix:'>'},get:()=>f.player,presenters:new Map(),import:async(_id,fn)=>fn(new AbortController().signal),
    discovery:{resolve:async text=>{query=text;return {tracks:[{title:'Song',source:'local',mediaId:'Song'}],notices:[]};}}};
  await messageHandler(manager,logger)(m);assert.equal(query,'Artist Long Song Name');assert.equal(f.player.current.title,'Song');
  assert.equal(m.replies[0].content,'Searching of `Artist Long Song Name`');assert.equal(m.edits.at(-1).content,'Added `Song` in the queue');
});
test('prefix settings retain Manage Server authorization',async()=>{
  const m=message('>autoplay on');m.member.permissions={has:()=>false};
  await messageHandler({config:{prefix:'>'},get:()=>undefined},logger)(m);assert.match(m.replies[0].content,/Manage Server/);
});
test('malformed messages and missing Embed Links give useful replies',async()=>{
  const manager={config:{prefix:'>'},get:()=>undefined};
  const bad=message('>volume nope');await messageHandler(manager,logger)(bad);assert.match(bad.replies[0].content,/Usage: >volume/);
  const missing=message();missing.permissions.has=value=>value!==PermissionFlagsBits.EmbedLinks;
  await messageHandler(manager,logger)(missing);assert.match(missing.replies[0].content,/Embed Links/);
});
test('reply failures cannot crash the message handler',async()=>{
  const m=message('>unknown');m.reply=async()=>{throw Error('missing access');};
  await assert.doesNotReject(messageHandler({config:{prefix:'>'}},logger)(m));
});
test('button handler ignores slash and unrelated interactions',async()=>{
  for(const interaction of [{isButton:()=>false},{isButton:()=>true,customId:'other:action'}]){
    interaction.deferReply=()=>assert.fail('unrelated interaction was acknowledged');
    await interactionHandler({},logger)(interaction);
  }
});
test('cooldown scopes users and guilds independently',()=>{
  const cooldown=createCooldown();cooldown('a','u');assert.throws(()=>cooldown('a','u'),/wait/);assert.doesNotThrow(()=>cooldown('b','u'));assert.doesNotThrow(()=>cooldown('a','v'));
});
