import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { TTLCache, startCacheCleanup, CACHE_CLEANUP_INTERVAL_MS } from '../src/utils/cache.js';
import { MusicManager } from '../src/music/MusicManager.js';
import { loadConfig } from '../src/config/config.js';
import { logger } from './helpers.js';

test('cache cleanup clears fresh and expired entries every five minutes, including idle caches', t => {
  t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: 0 });
  const caches = [new TTLCache(900000), new TTLCache(1000)];
  const stop = startCacheCleanup(caches);
  t.after(stop);
  caches[0].set('fresh', { title: 'Song' });
  caches[1].set('expired', 'Old metadata');
  assert.equal(CACHE_CLEANUP_INTERVAL_MS, 300000);
  t.mock.timers.tick(299999);
  assert.equal(caches[0].get('fresh').title, 'Song');
  assert.equal(caches[1].items.size, 1);
  t.mock.timers.tick(1);
  for (const cache of caches) assert.equal(cache.items.size, 0);
  caches[0].set('new', 'Next result');
  t.mock.timers.tick(300000);
  assert.equal(caches[0].get('new'), undefined);
});

test('stopping cleanup cancels subsequent periodic clears', t => {
  t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: 0 });
  const cache = new TTLCache(900000), stop = startCacheCleanup([cache]);
  stop();
  stop();
  cache.set('kept', 'Result');
  t.mock.timers.tick(300000);
  assert.equal(cache.get('kept'), 'Result');
});

test('production manager cleans all four provider caches without changing playback or queues', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'music-cache-cleanup-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: 0 });
  const manager = await MusicManager.create({
    ...loadConfig({ SPOTIFY_CLIENT_ID: 'test-client', SPOTIFY_CLIENT_SECRET: 'test-secret' }),
    settingsFile: path.join(directory, 'settings.json')
  }, logger);
  t.after(() => manager.destroy());
  const youtube = manager.discovery.youtube, spotify = manager.discovery.spotify;
  const caches = [youtube.cache, youtube.sourceCache, spotify.cache, spotify.searchAdapter.cache];
  assert.equal(new Set(manager.caches).size, 4);
  const current = { title: 'Current song' }, queue = [{ title: 'Next song' }];
  let disposed = false;
  const handle = { dispose() { disposed = true; } };
  manager.audio.handles.add(handle);
  manager.players.set('guild', { current, queue, destroy: async () => {} });
  for (const cache of caches) cache.set('cached', { title: 'Metadata' });
  t.mock.timers.tick(300000);
  for (const cache of caches) assert.equal(cache.items.size, 0);
  assert.equal(manager.players.get('guild').current, current);
  assert.equal(manager.players.get('guild').queue, queue);
  assert.equal(manager.audio.handles.has(handle), true);
  assert.equal(disposed, false);
  for (const cache of caches) cache.set('refilled', 'Result');
  await manager.destroy();
  assert.equal(disposed, true);
  for (const cache of caches) {
    assert.equal(cache.items.size, 0);
    cache.set('after-shutdown', 'Result');
  }
  t.mock.timers.tick(300000);
  assert.equal(youtube.cache.get('after-shutdown'), 'Result');
});
