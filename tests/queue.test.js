import test from 'node:test';
import assert from 'node:assert/strict';
import { QueueManager } from '../src/music/QueueManager.js';
import { track } from './helpers.js';
test('queue insertion caps memory and reports omitted entries',()=>{
  const q=new QueueManager(2);assert.deepEqual(q.add([track('A'),track('B'),track('C')]),{added:2,omitted:1});assert.equal(q.take().title,'A');
});
test('removal, move and jump preserve one-based queue order',()=>{
  const q=new QueueManager();q.add(['A','B','C','D'].map(track));q.move(1,3);assert.deepEqual(q.tracks.map(t=>t.title),['B','C','A','D']);
  assert.equal(q.remove(2).title,'C');q.jump(2);assert.equal(q.take().title,'A');assert.throws(()=>q.remove(100));
});
test('repeat modes distinguish queue completion from track repeat',()=>{
  const q=new QueueManager();q.complete(track('A'));assert.equal(q.length,0);q.setLoop('queue');q.complete(track('B'));assert.equal(q.take().title,'B');
  q.setLoop('track');q.complete(track('C'));assert.equal(q.length,0);assert.throws(()=>q.setLoop('invalid'));
});
test('shuffle preserves all track identities and can change order',()=>{
  const q=new QueueManager();const tracks=['A','B','C','D'].map(track);q.add(tracks);q.shuffle(()=>0);
  assert.deepEqual(new Set(q.tracks),new Set(tracks));assert.notDeepEqual(q.tracks,tracks);
});
test('history stays bounded and previous returns current to the queue',()=>{
  const q=new QueueManager(1);for(let i=0;i<100;i++)q.remember(track(String(i)));assert.equal(q.history.length,50);
  q.add([track('Upcoming')]);assert.throws(()=>q.previous(track('Current')),/queue is full/);q.clear();assert.equal(q.previous(track('Current')).title,'99');assert.equal(q.take().title,'Current');
});
