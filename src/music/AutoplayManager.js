import { normalize, unrequestedVersion, trackIdentity } from './TrackMatcher.js';
export class AutoplayManager {
  constructor(youtube,adapter) { this.youtube=youtube; this.adapter=adapter; }
  async next(previous, recent, signal) {
    if (!previous) return null;
    const seen = new Set(recent.map(trackIdentity));
    const seenUrls = new Set(recent.map(t => t.youtubeUrl ?? t.sourceUrl).filter(Boolean));
    let candidates;
    if (this.adapter) candidates = await this.adapter.recommend(previous,{signal,recent});
    else {
      // A known artist is required. Arbitrary channel names are not artist metadata.
      if (!previous.artist || ['local','stream'].includes(previous.source)) return null;
      candidates = await this.youtube.search(`${previous.artist} official audio`,signal);
    }
    for (const raw of (candidates ?? []).slice(0,8)) {
      const candidate={...raw};
      const channel=normalize(candidate.channel).replace(/\b(topic|official)\b/g,'').trim();
      if(!candidate.artist && !this.adapter && channel===normalize(previous.artist)) candidate.artist=previous.artist;
      if (!candidate.title || !candidate.artist || candidate.live || unrequestedVersion(previous,candidate) || seen.has(trackIdentity(candidate)) || seenUrls.has(candidate.youtubeUrl ?? candidate.sourceUrl)) continue;
      if (!this.adapter && normalize(candidate.artist) !== normalize(previous.artist)) continue;
      const match = await this.youtube.match(candidate,signal);
      if (seenUrls.has(match.youtubeUrl)) continue;
      return {...candidate,youtubeUrl:match.youtubeUrl,requestedBy:{name:'Autoplay'}};
    }
    return null;
  }
}
