import test from 'node:test';
import assert from 'node:assert/strict';
import { MusicManager } from '../src/music/MusicManager.js';
import { normalizeSpotify } from '../src/music/SpotifyResolver.js';
import { normalizeYouTube } from '../src/music/YouTubeResolver.js';
import { loadConfig } from '../src/config/config.js';
import { UserError } from '../src/utils/errors.js';
import { fixture,logger,track,settle } from './helpers.js';
import { createLogger } from '../src/utils/logger.js';

test('new guild creation cannot reclaim another guild while its play request is preparing',async t=>{
  const manager=new MusicManager(loadConfig({}),logger,{audio:{dispose(){}}});t.after(()=>manager.destroy());
  const first=manager.get({id:'first'},true),release=first.holdIdleTimeout();
  manager.get({id:'second'},true);assert.equal(manager.players.get('first'),first);assert.equal(first.closed,false);
  release();manager.get({id:'third'},true);assert.equal(manager.players.has('first'),false);
});
test('active discovery protects a disconnected guild session from stale-session cleanup',async t=>{
  const manager=new MusicManager(loadConfig({}),logger,{audio:{dispose(){}}});t.after(()=>manager.destroy());
  const first=manager.get({id:'first'},true);manager.imports.set('first',new AbortController());
  manager.get({id:'second'},true);assert.equal(manager.players.get('first'),first);assert.equal(first.closed,false);
});
test('malformed public Spotify artist entries do not abort an otherwise usable track',()=>{
  const value=normalizeSpotify({name:' Song ',artists:[null,{},42,{name:'Artist'},'Guest',false]});
  assert.equal(value.title,'Song');assert.equal(value.artist,'Artist, Guest');
  for(const item of [{name:'Song',artists:[null,{}]},{name:{bad:true},artists:['Artist']},{name:' ',artists:['Artist']}])assert.equal(normalizeSpotify(item),null);
});
test('YouTube normalization rejects malformed titles and unsafe text types',()=>{
  assert.equal(normalizeYouTube({id:'abcdefghijk',title:{bad:true}}),null);
  const value=normalizeYouTube({id:'abcdefghijk',title:' Song ',track:{bad:true},artist:42,channel:{bad:true},uploader:'Artist'});
  assert.equal(value.title,'Song');assert.equal(value.artist,undefined);assert.equal(value.channel,'Artist');
});
test('five consecutive runtime failures pause automatic advancement and preserve upcoming tracks',async t=>{
  const f=fixture();t.after(()=>f.player.destroy());const notices=[];f.player.on('notice',message=>notices.push(message));
  await f.player.enqueue(Array.from({length:10},(_,i)=>track(String(i))),f.channel);
  for(let i=0;i<5;i++){f.fakePlayer.emit('error',new UserError('Provider denied','ACCESS_DENIED'));await settle();await settle();}
  assert.equal(f.player.current,null);assert.equal(f.player.queue.length,5);assert.equal(f.prepared.length,5);
  assert.equal(f.player.queue.tracks[0].title,'5');assert.ok(notices.some(message=>message.includes('five consecutive')));
  await f.player.skip();assert.equal(f.player.current.title,'5');assert.equal(f.player.consecutiveFailures,0);
});
test('a completed track resets the consecutive failure budget',async t=>{
  const f=fixture();t.after(()=>f.player.destroy());await f.player.enqueue(['A','B','C'].map(track),f.channel);
  f.fakePlayer.emit('error',new UserError('Denied','ACCESS_DENIED'));await settle();await settle();assert.equal(f.player.consecutiveFailures,1);
  f.fakePlayer.finish();await settle();await settle();assert.equal(f.player.current.title,'C');assert.equal(f.player.consecutiveFailures,0);
});
test('logger redacts nested credentials and source URLs',t=>{
  let output='';t.mock.method(process.stdout,'write',value=>{output+=value;return true;});
  createLogger().info('audit_probe',{cookie:'private-cookie',nested:{clientSecret:'private-secret',authorization:'private-auth',headers:{Cookie:'private-header'},items:[{password:'private-password',message:'source https://example.test/signed?secret=private-url'}]},count:1});
  const entry=JSON.parse(output);assert.equal(entry.count,1);assert.equal(entry.nested.items[0].message,'source [url]');assert.ok(!output.includes('private-'));
});
test('logger bounds circular object traversal instead of crashing playback',t=>{
  let output='';t.mock.method(process.stdout,'write',value=>{output+=value;return true;});
  const value={};value.self=value;assert.doesNotThrow(()=>createLogger().warn('cycle',{value}));assert.ok(output.includes('[truncated]'));
});
