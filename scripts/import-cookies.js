import { readFile,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from '../src/config/config.js';
import { importYouTubeCookieJson } from '../src/utils/youtubeCookies.js';
import { publicError } from '../src/utils/errors.js';

try{
  const config=loadConfig(),envFile=path.join(config.projectRoot,'.env');
  // Check configuration is available before changing any credential export.
  const original=await readFile(envFile,'utf8');
  const result=await importYouTubeCookieJson(config);
  const line='YOUTUBE_COOKIES_FILE=./secrets/youtube.cookies.txt',newline=original.includes('\r\n')?'\r\n':'\n';
  const updated=/^YOUTUBE_COOKIES_FILE\s*=/m.test(original)
    ?original.replace(/^YOUTUBE_COOKIES_FILE[^\r\n]*$/gm,line)
    :original.replace(/\s*$/,'')+newline+line+newline;
  await writeFile(envFile,updated,{mode:0o600});
  console.log(`Imported ${result.count} YouTube cookies and enabled the local export. No cookie values displayed.`);
  console.log('Restart the bot to load the replacement and clear cached sources.');
}catch(error){console.error(`Cookie import failed: ${publicError(error)}`);process.exitCode=1;}
