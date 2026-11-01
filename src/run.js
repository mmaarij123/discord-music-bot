import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Supervisor } from './runtime/Supervisor.js';
import { createLogger } from './utils/logger.js';

const entry = fileURLToPath(new URL('./index.js', import.meta.url));
process.chdir(path.dirname(path.dirname(entry)));
const supervisor = new Supervisor({ entry, logger: createLogger(process.env.LOG_LEVEL) });
process.once('SIGINT', () => supervisor.stop());
process.once('SIGTERM', () => supervisor.stop());
supervisor.start();
