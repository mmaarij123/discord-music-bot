export class TTLCache {
  constructor(ttlMs, max = 250) { this.ttlMs = ttlMs; this.max = max; this.items = new Map(); }
  get(key) {
    const item = this.items.get(key);
    if (!item) return undefined;
    if (item.expires <= Date.now()) { this.items.delete(key); return undefined; }
    return structuredClone(item.value);
  }
  delete(key) { return this.items.delete(key); }
  set(key, value) {
    for (const [k,v] of this.items) if (v.expires <= Date.now()) this.items.delete(k);
    this.items.delete(key);
    if (this.items.size >= this.max) this.items.delete(this.items.keys().next().value);
    this.items.set(key, { expires: Date.now() + this.ttlMs, value: structuredClone(value) });
    return value;
  }
}
