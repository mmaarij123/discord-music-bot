const string = (name, extra = {}) => ({ name, type: 'string', required: true, ...extra });
const integer = (name, min = 1, max = 5000, required = true) => ({ name, type: 'integer', min, max, required });
const boolean = { name: 'enabled', type: 'boolean', required: true };
const command = (name, description, usage = '', args = []) => ({ name, description, usage, args });

export const commands = [
  command('play', 'Discover and queue music, a supported URL, or authorized local:id / stream:id', '<song, artist, URL, local:id or stream:id>', [string('query', { rest: true, maxLength: 500 })]),
  command('pause', 'Pause the current track'),
  command('resume', 'Resume the paused track'),
  command('skip', 'Skip the current track'),
  command('previous', 'Play the most recently played track'),
  command('stop', 'Stop and leave voice (session host or Manage Server, including outside voice)'),
  command('queue', 'Show upcoming tracks', '[page]', [integer('page', 1, 500, false)]),
  command('nowplaying', 'Show the current track and player'),
  command('volume', 'Set playback volume from 0 to 100', '<0–100>', [integer('level', 0, 100)]),
  command('loop', 'Set the repeat mode', '<off|track|queue>', [string('mode', { choices: ['off', 'track', 'queue'] })]),
  command('shuffle', 'Shuffle upcoming tracks'),
  command('remove', 'Remove an upcoming track', '<position>', [integer('position')]),
  command('clear', 'Clear upcoming tracks'),
  command('seek', 'Seek within a track with a known duration', '<seconds|mm:ss|hh:mm:ss>', [string('position', { maxLength: 20 })]),
  command('jump', 'Skip to an upcoming queue position', '<position>', [integer('position')]),
  command('move', 'Move an upcoming track to a new queue position', '<from> <to>', [integer('from'), integer('to')]),
  command('join', 'Join your voice channel'),
  command('leave', 'Stop and disconnect (session host or Manage Server)'),
  command('247', 'Keep connected while the application runs (Manage Server)', '<on|off>', [boolean]),
  command('autoplay', 'Enable or disable related-track discovery (Manage Server)', '<on|off>', [boolean]),
  command('lyrics', 'Retrieve lyrics through an operator-configured lawful source'),
  command('help', 'Show music commands and input examples')
];

export const commandMap = new Map(commands.map(command => [command.name, command]));
export function usage(command, prefix = '>') {
  return `${prefix}${command.name}${command.usage ? ` ${command.usage}` : ''}`;
}
