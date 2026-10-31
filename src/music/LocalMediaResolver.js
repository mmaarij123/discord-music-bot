import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { httpsUrl } from '../utils/validators.js';
import { UserError } from '../utils/errors.js';
export class LocalMediaResolver {
  constructor(config) { this.config = config; }
  async entry(kind,id) {
    let manifest;
    try { manifest = JSON.parse(await readFile(this.config.manifest,'utf8')); }
    catch { throw new UserError('The authorized media library is not configured. Ask the operator to create media.json.'); }
    const section = kind === 'local' ? manifest.local : manifest.streams;
    const entry = Object.hasOwn(section ?? {}, id) ? section[id] : undefined;
    if (!entry?.title) throw new UserError('That media ID is not in the operator’s authorized library.');
    if (kind === 'local') {
      const root = await realpath(this.config.mediaRoot);
      let input;
      try { input = await realpath(path.resolve(root,entry.file)); } catch { throw new UserError('The configured local media file is missing.'); }
      const relative = path.relative(root,input);
      if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || !(await stat(input)).isFile()) throw new UserError('Local media must be a regular file within MEDIA_ROOT.');
      return { kind:'local', input, duration:entry.duration };
    }
    const url = httpsUrl(entry.url);
    // Only an operator can add stream URLs. Users can select IDs, never URLs.
    if (entry.authorized !== true) throw new UserError('The operator must mark this stream as authorized in media.json.');
    return { kind:'remote', input:url.href, headers:{}, duration:entry.duration };
  }
  async resolve(kind,id) {
    await this.entry(kind,id);
    const manifest = JSON.parse(await readFile(this.config.manifest,'utf8'));
    const entry = (kind === 'local' ? manifest.local : manifest.streams)[id];
    return { tracks:[{ title:entry.title, artist:entry.artist || 'Authorized library', album:entry.album, duration:entry.duration,
      artwork:entry.artwork, source:kind, mediaId:id }], notices:[] };
  }
}
