import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { createAudioPlayer,NoSubscriberBehavior } from '@discordjs/voice';
import { loadConfig } from '../src/config/config.js';
import { createLogger } from '../src/utils/logger.js';
import { runTool } from '../src/utils/process.js';
import { AudioManager } from '../src/music/AudioManager.js';
import { LocalMediaResolver } from '../src/music/LocalMediaResolver.js';
import { GuildPlayer } from '../src/music/GuildPlayer.js';
import { playbackBehaviors } from '../src/music/playbackPolicy.js';

const folder=await mkdtemp(path.join(tmpdir(),'music-bot-paced-'));
let audio,session;
try{
  const config={...loadConfig(),mediaRoot:folder,manifest:path.join(folder,'media.json'),persistent:true};
  await runTool(config.ffmpeg,['-hide_banner','-loglevel','error','-f','lavfi','-i','sine=frequency=440:duration=12','-ar','48000','-ac','2',path.join(folder,'tone.wav')]);
  await writeFile(config.manifest,JSON.stringify({local:{tone:{title:'Generated authorized tone',artist:'Test',file:'tone.wav',duration:12}},streams:{}}));
  const local=new LocalMediaResolver(config);
  audio=new AudioManager(config,null,local);
  const realPlayer=createAudioPlayer({behaviors:{...playbackBehaviors(config),noSubscriber:NoSubscriberBehavior.Play}});
  session=new GuildPlayer({id:'offline-paced-test'},config,{audio,audioPlayer:realPlayer,logger:createLogger('warn'),autoplay:{next:async()=>null},
    voiceFactory:()=>({channelId:null,async join(channel){this.channelId=channel.id;},destroy(){this.channelId=null;}})});
  const notices=[];session.on('notice',notice=>notices.push(notice));
  const waitFor=async(predicate,timeoutMs=20000)=>{
    const deadline=Date.now()+timeoutMs;
    while(!predicate()){if(Date.now()>=deadline)throw Error(`Timed out; state=${session.state}`);await delay(25);}
  };
  const {tracks}=await local.resolve('local','tone');
  await session.enqueue([{...tracks[0],title:'First'},{...tracks[0],title:'Second'}],{id:'offline'});
  await waitFor(()=>session.state==='playing');await delay(1000);await session.pause();
  const position=session.progress;await delay(1000);assert.ok(session.progress-position<0.2,'Paused playback must not drain audio.');
  await session.seek(8);await waitFor(()=>session.state==='paused');await delay(300);assert.ok(session.progress<8.2,'Seeking a paused track must keep it paused.');
  await session.resume();await waitFor(()=>session.current?.title==='Second',10000);
  await waitFor(()=>session.current===null&&session.state==='idle',18000);
  assert.equal(session.queue.history.length,2);assert.equal(notices.length,0);
  await session.enqueue([{...tracks[0],title:'After completion'}],{id:'offline'});
  await waitFor(()=>session.state==='playing');assert.equal(session.current.title,'After completion');await session.stop();
  assert.equal(audio.handles.size,0);
  console.log('PASS: real-time FFmpeg/Opus playback, pause, paused seek, near-end completion, queue transition, full 12-second second track, and a fresh play after completion.');
  console.log('No Discord voice connection or server messages were used.');
}finally{await session?.destroy();audio?.dispose();await rm(folder,{recursive:true,force:true,maxRetries:10,retryDelay:200});}
