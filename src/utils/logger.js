const levels = { debug: 10, info: 20, warn: 30, error: 40 };
function redact(value) {
  return String(value).replace(/https?:\/\/\S+/gi, '[url]').replace(/[\w-]{20,}\.[\w-]{6,}\.[\w-]{20,}/g, '[token]');
}
function safeValue(value,depth=0){
  if(typeof value==='string')return redact(value);
  if(typeof value==='bigint')return String(value);
  if(value instanceof Error)return {name:value.name,code:value.code,message:redact(value.message),httpStatus:value.httpStatus,exitCode:value.exitCode,decoderReason:value.decoderReason};
  if(!value||typeof value!=='object')return value;
  if(depth>=5)return '[truncated]';
  if(Array.isArray(value))return value.slice(0,50).map(item=>safeValue(item,depth+1));
  return Object.fromEntries(Object.entries(value).filter(([key])=>!/token|secret|password|headers|url|cookie|authorization/i.test(key)).slice(0,50).map(([key,item])=>[key,safeValue(item,depth+1)]));
}
export function createLogger(level = 'info') {
  return Object.fromEntries(Object.entries(levels).map(([name, rank]) => [name, (event, fields = {}) => {
    if (rank < (levels[level] ?? 20)) return;
    const safe=safeValue(fields);
    process.stdout.write(`${JSON.stringify({ time: new Date().toISOString(), level: name, event, ...safe })}\n`);
  }]));
}
