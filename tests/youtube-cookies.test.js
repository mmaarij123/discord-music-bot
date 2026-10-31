import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp,mkdir,writeFile,readFile,readdir,rm,symlink,stat } from 'node:fs/promises';
import { validateYouTubeCookies,inspectYouTubeCookies,withYouTubeCookies } from '../src/utils/youtubeCookies.js';
import { loadConfig } from '../src/config/config.js';
import { YouTubeResolver } from '../src/music/YouTubeResolver.js';
import { Semaphore } from '../src/utils/async.js';

const header='# Netscape HTTP Cookie File\n';
const body=header+'.youtube.com\tTRUE\t/\tTRUE\t0\tSID\tsynthetic-cookie-value\n';
async function setup(t,text=body){
  const projectRoot=await mkdtemp(path.join(tmpdir(),'music-cookie-test-'));
  t.after(async()=>{const base=path.resolve(tmpdir());assert.ok(path.resolve(projectRoot).startsWith(base+path.sep));await rm(projectRoot,{recursive:true,force:true});});
  const cookiesRoot=path.join(projectRoot,'secrets');await mkdir(cookiesRoot);
  const youtubeCookiesFile=path.join(cookiesRoot,'youtube.cookies.txt');await writeFile(youtubeCookiesFile,text);
  return {projectRoot,cookiesRoot,youtubeCookiesFile};
}
test('cookies are optional and configuration confines exports to secrets',()=>{
  assert.equal(loadConfig({}).youtubeCookiesFile,undefined);
  assert.ok(loadConfig({YOUTUBE_COOKIES_FILE:'./secrets/youtube.cookies.txt'}).youtubeCookiesFile.endsWith('youtube.cookies.txt'));
  for(const value of ['.env','./secrets/../.env','./secrets'])assert.throws(()=>loadConfig({YOUTUBE_COOKIES_FILE:value}),{code:'COOKIE_CONFIG'});
});
test('Netscape validation accepts session, expiry and HttpOnly YouTube cookies',()=>{
  const text=body+'#HttpOnly_www.youtube.com\tFALSE\t/\tTRUE\t9999999999\tLOGIN_INFO\tsynthetic\n';
  assert.deepEqual(validateYouTubeCookies(text),{count:2,usable:2});
  assert.deepEqual(validateYouTubeCookies('\uFEFF'+body.replaceAll('\n','\r\n')),{count:1,usable:1});
});
test('invalid exports and other service cookies are rejected without echoing values',()=>{
  for(const text of ['synthetic-cookie-value',header,body.replace('.youtube.com','.google.com'),body.replace('.youtube.com','youtube.com.evil.test'),body.replace('\tSID\t','\tBad Name\t'),body.replace('\tTRUE\t/','\tINVALID\t/'),body.replace('\t0\t','\tNaN\t'),body+'bad\tline',body+'\0']){
    assert.throws(()=>validateYouTubeCookies(text),error=>error.code==='COOKIE_CONFIG'&&!error.message.includes('synthetic-cookie-value'));
  }
});
test('expired-only exports produce a distinct actionable error',()=>{
  assert.throws(()=>validateYouTubeCookies(body.replace('\t0\t','\t1\t')),{code:'COOKIE_EXPIRED'});
});
test('disabled cookies do not touch the filesystem or add arguments',async()=>{
  assert.deepEqual(await inspectYouTubeCookies({}),{enabled:false});
  assert.equal(await withYouTubeCookies({},args=>{assert.deepEqual(args,[]);return 'anonymous';}),'anonymous');
});
test('inspection returns safe counts without cookie content',async t=>{
  const config=await setup(t);assert.deepEqual(await inspectYouTubeCookies(config),{enabled:true,count:1,usable:1});
});
test('each request gets a private temporary copy and original remains untouched',async t=>{
  const config=await setup(t),copies=[];
  await Promise.all([1,2].map(()=>withYouTubeCookies(config,async args=>{
    assert.equal(args[0],'--cookies');copies.push(args[1]);assert.equal(await readFile(args[1],'utf8'),body);
    if(process.platform!=='win32')assert.equal((await stat(args[1])).mode&0o777,0o600);
    await writeFile(args[1],'simulated yt-dlp jar update');
  })));
  assert.notEqual(copies[0],copies[1]);assert.equal(await readFile(config.youtubeCookiesFile,'utf8'),body);
  assert.deepEqual(await readdir(config.cookiesRoot),['youtube.cookies.txt']);
});
test('failed and cancelled tool requests remove their temporary credentials',async t=>{
  const config=await setup(t);
  await assert.rejects(withYouTubeCookies(config,()=>{throw new Error('synthetic tool failure');}),/synthetic tool failure/);
  const controller=new AbortController();
  await assert.rejects(withYouTubeCookies(config,()=>{controller.abort();throw controller.signal.reason;},controller.signal),{name:'AbortError'});
  assert.deepEqual(await readdir(config.cookiesRoot),['youtube.cookies.txt']);
  await assert.rejects(withYouTubeCookies(config,()=>assert.fail('cancelled operation ran'),controller.signal),{name:'AbortError'});
});
test('missing and oversized cookie files fail safely',async t=>{
  const config=await setup(t);
  await assert.rejects(inspectYouTubeCookies({...config,youtubeCookiesFile:path.join(config.cookiesRoot,'missing.txt')}),{code:'COOKIE_CONFIG'});
  await writeFile(config.youtubeCookiesFile,Buffer.alloc(1024*1024+1));
  await assert.rejects(inspectYouTubeCookies(config),{code:'COOKIE_CONFIG'});
});
test('cookie file symlinks cannot escape the secrets folder',async t=>{
  const config=await setup(t),outside=path.join(config.projectRoot,'outside.txt');await writeFile(outside,body);
  const link=path.join(config.cookiesRoot,'link.txt');
  try{await symlink(outside,link);}catch(error){if(error.code==='EPERM'){t.skip('OS does not grant symlink creation');return;}throw error;}
  await assert.rejects(inspectYouTubeCookies({...config,youtubeCookiesFile:link}),{code:'COOKIE_CONFIG'});
});
test('resolver passes the working cookie jar as a subprocess argument and cleans it',async t=>{
  const settings=await setup(t),script=path.join(settings.projectRoot,'fake-tool.mjs');
  await writeFile(script,`import {readFileSync} from 'node:fs';
const cookie=process.argv[process.argv.indexOf('--cookies')+1];
const jar=readFileSync(cookie,'utf8');
process.stdout.write(JSON.stringify({cookieFlag:process.argv.includes('--cookies'),validJar:jar.startsWith('# Netscape HTTP Cookie File')}));`);
  const resolver=new YouTubeResolver({...loadConfig({}),...settings,ytdlp:process.execPath},new Semaphore(2));
  resolver.baseArgs=()=>[script];
  const {data}=await resolver.json(['--dump-single-json']);
  assert.deepEqual(data,{cookieFlag:true,validJar:true});
  assert.deepEqual(await readdir(settings.cookiesRoot),['youtube.cookies.txt']);
});
