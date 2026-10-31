import path from 'node:path';
import { open,realpath,mkdtemp,writeFile,rm,chmod } from 'node:fs/promises';
import { UserError } from './errors.js';

const MAX_BYTES=1024*1024;
const inside=(directory,file)=>{const relative=path.relative(directory,file);return relative!==''&&!relative.startsWith(`..${path.sep}`)&&relative!=='..'&&!path.isAbsolute(relative);};
const invalid=()=>new UserError('YouTube cookies must be a Netscape-format export containing only youtube.com cookies. Cookie values must never be pasted into chat.','COOKIE_CONFIG');

export function validateYouTubeCookies(text,now=Date.now()) {
  const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/);
  if(!/^# (?:Netscape )?HTTP Cookie File\s*$/.test(lines[0]??'')||text.includes('\0'))throw invalid();
  let count=0,usable=0;
  for(const line of lines.slice(1)){
    if(!line.trim()||(line.startsWith('#')&&!line.startsWith('#HttpOnly_')))continue;
    const cells=line.replace(/^#HttpOnly_/,'').split('\t');
    if(cells.length!==7)throw invalid();
    const [domain,subdomains,cookiePath,secure,expiry,name,value]=cells;
    const hostname=domain.replace(/^\./,'').toLowerCase();
    if(!(hostname==='youtube.com'||hostname.endsWith('.youtube.com'))||/[\s/:]/.test(hostname)
      ||!['TRUE','FALSE'].includes(subdomains)||!['TRUE','FALSE'].includes(secure)
      ||!cookiePath.startsWith('/')||/[\r\n\x00-\x1f]/.test(cookiePath)
      ||!/^\d+$/.test(expiry)||!Number.isSafeInteger(Number(expiry))
      ||! /^[!#$%&'*+.^_`|~\w-]+$/.test(name)||/[\r\n\x00-\x1f]/.test(value))throw invalid();
    count++;if(Number(expiry)===0||Number(expiry)*1000>now)usable++;
  }
  if(!count)throw invalid();
  if(!usable)throw new UserError('All cookies in the YouTube cookie file have expired. Replace the local export.','COOKIE_EXPIRED');
  return {count,usable};
}

async function readCookies(config) {
  if(!config.youtubeCookiesFile)return null;
  let file;
  try{
    const [root,project,target]=await Promise.all([realpath(config.cookiesRoot),realpath(config.projectRoot),realpath(config.youtubeCookiesFile)]);
    if(!inside(project,root)||!inside(root,target))throw invalid();
    file=await open(target,'r');
    const stats=await file.stat();
    if(!stats.isFile()||stats.size>MAX_BYTES)throw invalid();
    // Read at most 1 MiB, including when another process replaces/grows the export.
    const bytes=Buffer.alloc(MAX_BYTES+1),{bytesRead}=await file.read(bytes,0,bytes.length,0);
    if(bytesRead>MAX_BYTES)throw invalid();
    const text=bytes.subarray(0,bytesRead).toString('utf8').replace(/^\uFEFF/,'');
    return {text,root,...validateYouTubeCookies(text)};
  }catch(error){
    if(error instanceof UserError)throw error;
    throw new UserError('The configured YouTube cookie file cannot be read. Save the export inside the project secrets folder and check its permissions.','COOKIE_CONFIG');
  }finally{await file?.close();}
}

export async function inspectYouTubeCookies(config) {
  const cookies=await readCookies(config);
  return cookies?{enabled:true,count:cookies.count,usable:cookies.usable}:{enabled:false};
}

export async function withYouTubeCookies(config,operation,signal) {
  signal?.throwIfAborted();
  const cookies=await readCookies(config);
  if(!cookies)return operation([]);
  signal?.throwIfAborted();
  // yt-dlp writes its cookie jar on exit. Isolate each request so concurrent
  // guilds never overwrite the user's original export or each other's jar.
  const directory=await mkdtemp(path.join(cookies.root,'.yt-cookies-'));
  if(!inside(cookies.root,directory)||!path.basename(directory).startsWith('.yt-cookies-'))throw invalid();
  try{
    await chmod(directory,0o700);
    const file=path.join(directory,'cookies.txt');
    await writeFile(file,cookies.text,{mode:0o600});
    signal?.throwIfAborted();
    return await operation(['--cookies',file]);
  }finally{
    await rm(directory,{recursive:true,force:true,maxRetries:3,retryDelay:100});
  }
}
