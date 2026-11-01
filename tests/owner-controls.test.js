import test from 'node:test';
import assert from 'node:assert/strict';
import { PermissionFlagsBits } from 'discord.js';
import { OWNER_USER_ID, ownerCommands } from '../src/config/owner.js';
import { ProcessLifecycle, RESTART_EXIT_CODE } from '../src/runtime/ProcessLifecycle.js';
import { execute } from '../src/commands/execute.js';
import { parsePrefix } from '../src/commands/parsePrefix.js';
import { messageHandler } from '../src/events/messageCreate.js';
import { MusicManager } from '../src/music/MusicManager.js';
import { TTLCache } from '../src/utils/cache.js';
import { loadConfig } from '../src/config/config.js';
import { fixture, logger, track, settle } from './helpers.js';

function context(userId=OWNER_USER_ID) {
  const replies=[];
  return { user:{id:userId},inGuild:()=>true,guildId:'guild',guild:{id:'guild',members:{fetch:()=>assert.fail('Owner commands must not require voice or server permissions')}},options:{},
    editReply:async payload=>{replies.push(payload);},replies };
}

for(const action of ownerCommands) {
  test(`${action} rejects every identity except the exact owner, including server administrators`,async()=>{
    for(const id of [undefined,null,'admin','1037886658462371861',OWNER_USER_ID+'0',Number(OWNER_USER_ID)]){
      const manager={get:()=>assert.fail('Unauthorized command touched a guild player'),clearCaches:()=>assert.fail('Unauthorized cache clear'),lifecycle:{request:()=>assert.fail('Unauthorized process control')}};
      const i=context();i.user.id=id;
      await assert.rejects(execute(i,manager,action),{code:'OWNER_ONLY'});
    }
  });
  test(`${action} parses with no arguments and rejects extras`,()=>{
    assert.equal(parsePrefix(`>${action}`).commandName,action);
    assert.throws(()=>parsePrefix(`>${action} other`),/Too many/);
  });
}

test('manual cache clear removes all provider entries while preserving two guild players and their audio',async t=>{
  const caches=Array.from({length:4},()=>new TTLCache(900000));
  for(const cache of caches){cache.set('one',1);cache.set('two',2);}
  const a=fixture(),b=fixture({id:'second'});
  await a.player.enqueue([track('A'),track('Next A')],a.channel);
  await b.player.enqueue([track('B'),track('Next B')],b.channel);
  const manager=new MusicManager(loadConfig({}),logger,{caches,audio:{dispose(){}}});
  manager.players.set('guild',a.player);manager.players.set('second',b.player);t.after(()=>manager.destroy());
  const i=context();await execute(i,manager,'clearcache');
  assert.match(i.replies[0].content,/Cleared 8/);
  for(const cache of caches)assert.equal(cache.items.size,0);
  for(const f of [a,b]){assert.equal(f.player.state,'playing');assert.equal(f.player.queue.length,1);assert.equal(f.handles[0].disposed,false);}
  await execute(i,manager,'clearcache');assert.match(i.replies[1].content,/Cleared 0/);
});

for(const action of ['shutdown','restart'])test(`owner ${action} acknowledges before requesting process exit`,async()=>{
  const calls=[],i=context();
  i.editReply=async payload=>{calls.push('reply');assert.match(payload.content,action==='shutdown'?/Shutting down/:/Restarting/);};
  const lifecycle=new ProcessLifecycle({canRestart:true,shutdown:async(reason,code)=>{calls.push('shutdown');assert.equal(reason,`owner_${action}`);assert.equal(code,action==='restart'?RESTART_EXIT_CODE:0);}});
  await execute(i,{lifecycle,get:()=>assert.fail('Process control must work without a session')},action);
  assert.deepEqual(calls,['reply','shutdown']);
});

test('failed owner acknowledgement does not stop the bot and permits a later request',async()=>{
  let stopped=0;const lifecycle=new ProcessLifecycle({canRestart:true,shutdown:async()=>{stopped++;}});
  await assert.rejects(lifecycle.request('shutdown',async()=>{throw Error('Discord reply failed');}),/reply failed/);
  assert.equal(stopped,0);assert.equal(lifecycle.pending,null);
  await lifecycle.request('shutdown',async()=>{});assert.equal(stopped,1);
});

test('concurrent shutdown and restart produce exactly one process action',async()=>{
  let release,stopped=0;const wait=new Promise(resolve=>{release=resolve;});
  const lifecycle=new ProcessLifecycle({canRestart:true,shutdown:async()=>{stopped++;}});
  const first=lifecycle.request('restart',()=>wait);await settle();
  await assert.rejects(lifecycle.request('shutdown',()=>assert.fail('Second request replied')),/already in progress/);
  release();await first;assert.equal(stopped,1);
});

test('unsupported direct-process restart gives setup instructions before acknowledgement',async()=>{
  const lifecycle=new ProcessLifecycle({shutdown:()=>assert.fail('Unsupported restart shut down the bot')});
  await assert.rejects(lifecycle.request('restart',()=>assert.fail('Unsupported restart was acknowledged')),/npm start/);
  assert.equal(lifecycle.pending,null);
});

test('help shows owner controls only to the exact owner and fits the embed limit',async()=>{
  for(const id of [OWNER_USER_ID,'server-admin']){
    const i=context(id);await execute(i,{get:()=>undefined},'help');
    const help=i.replies[0].embeds[0].toJSON().description;
    for(const action of ownerCommands)assert.equal(help.includes(`**${action}**`),id===OWNER_USER_ID);
    assert.ok(help.length<=4096);
  }
});

for(const action of ownerCommands)test(`prefix ${action} uses the invoking channel without voice, log lookup or Embed Links`,async()=>{
  for(const id of [OWNER_USER_ID,'server-admin']){
    const replies=[],calls=[];
    const message={content:`>${action}`,author:{id},guildId:'guild',guild:{id:'guild',members:{me:{}}},inGuild:()=>true,
      channel:{isThread:()=>false,permissionsFor:()=>({has:values=>![values].flat().includes(PermissionFlagsBits.EmbedLinks)})},
      reply:async payload=>{replies.push(payload);return {edit:async()=>{}};}};
    const manager={config:{prefix:'>'},get:()=>assert.fail('Owner action looked up a player'),outputChannel:()=>assert.fail('Owner action depends on log channel'),
      clearCaches:()=>{calls.push('clearcache');return 3;},lifecycle:{request:async(value,reply)=>{await reply();calls.push(value);}}};
    await messageHandler(manager,logger,{cooldown:()=>{}})(message);
    assert.equal(replies.length,1);
    if(id===OWNER_USER_ID)assert.deepEqual(calls,[action]);
    else{assert.deepEqual(calls,[]);assert.match(replies[0].content,/Only the bot owner/);}
  }
});
