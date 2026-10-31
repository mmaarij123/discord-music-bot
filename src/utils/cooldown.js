import { UserError } from './errors.js';

export function createCooldown(delayMs = 750, max = 2000) {
  const recent = new Map();
  return (guildId, userId) => {
    const key = `${guildId}:${userId}`;
    const now = Date.now();
    if (recent.has(key) && now - recent.get(key) < delayMs) throw new UserError('Please wait a moment before sending another control.');
    recent.delete(key);
    recent.set(key, now);
    if (recent.size > max) recent.delete(recent.keys().next().value);
  };
}
