const string = (name, extra = {}) => ({ name, type: 'string', required: true, ...extra });
const integer = (name, min = 1, max = 5000, required = true) => ({ name, type: 'integer', min, max, required });
const boolean = { name: 'enabled', type: 'boolean', required: true };
const command = (name, description, usage = '', args = [], extra = {}) => ({ name, description, usage, args, ...extra });

export const commands = [
  command('play', 'Play a song or add it to the queue.', '<song, artist, URL, local:id or stream:id>', [string('query', { rest: true, maxLength: 500 })]),
  command('pause', 'Pause the current song.'),
  command('resume', 'Resume the paused song.'),
  command('skip', 'Play the next song.'),
  command('stop', 'Stop music and leave voice.'),
  command('queue', 'Show the song queue.', '[page]', [integer('page', 1, 500, false)]),
  command('nowplaying', 'Show the current song.'),
  command('volume', 'Set the volume from 0 to 100.', '<0–100>', [integer('level', 0, 100)]),
  command('loop', 'Repeat a song or the queue.', '<off|track|queue>', [string('mode', { choices: ['off', 'track', 'queue'] })]),
  command('shuffle', 'Shuffle queued songs.'),
  command('remove', 'Remove a song from the queue.', '<position>', [integer('position')]),
  command('join', 'Join your voice channel'),
  command('leave', 'Leave voice and clear the queue.'),
  command('autoplay', 'Turn autoplay on or off.', '<on|off>', [boolean]),
  command('logchannel','Choose where music logs are sent.','[#channelname|channel mention|off]',[string('channel',{required:false,maxLength:100})]),
  command('djchannel','Choose where the music player is shown.','[#channelname|channel mention|off]',[string('channel',{required:false,maxLength:100})]),
  command('clearcache','Clear the music cache.','',[],{ownerOnly:true}),
  command('shutdown','Turn the bot off.','',[],{ownerOnly:true}),
  command('restart','Restart the bot.','',[],{ownerOnly:true}),
  command('help', 'Show this command list.')
];

export const commandMap = new Map(commands.map(command => [command.name, command]));
export function usage(command, prefix = '>') {
  return `${prefix}${command.name}${command.usage ? ` ${command.usage}` : ''}`;
}
