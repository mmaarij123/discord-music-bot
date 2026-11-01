import { UserError } from '../utils/errors.js';

export const OWNER_USER_ID = '1037886658462371860';
export const ownerCommands = new Set(['clearcache', 'shutdown', 'restart']);

export function requireOwner(userId) {
  if (userId !== OWNER_USER_ID) throw new UserError('Only the bot owner can use this command.', 'OWNER_ONLY');
}
