import test from 'node:test';
import assert from 'node:assert/strict';
import { PlayerPresenter } from '../src/components/PlayerPresenter.js';
import { fixture,logger,track } from './helpers.js';
test('deleted message leaves playback active and can be rebound',async t=>{
  const f=fixture(),presenter=new PlayerPresenter(f.player,logger);t.after(async()=>{await f.player.destroy();await presenter.dispose();});
  await f.player.enqueue([track('A')],f.channel);
  presenter.channel={send:async()=>({id:'message',edit:async()=>{const error=Error('deleted');error.code=10008;throw error;}})};
  await presenter.render();await presenter.render();assert.equal(f.player.current.title,'A');assert.equal(f.player.state,'playing');assert.equal(presenter.channel,null);
  let sent=0;presenter.bind({send:async()=>{sent++;return {id:'new',edit:async()=>{}};}});await presenter.render();assert.equal(sent,1);
});
test('coalesces frequent changes into one scheduled edit',async t=>{
  const f=fixture(),presenter=new PlayerPresenter(f.player,logger);t.after(async()=>{await f.player.destroy();await presenter.dispose();});
  let sent=0;presenter.bind({send:async()=>{sent++;return {edit:async()=>{sent++;}};}});
  for(let i=0;i<50;i++)f.player.changed();await new Promise(resolve=>{setTimeout(resolve,130);});assert.equal(sent,1);
});
