export interface MockRedisData {
  strings: Map<string, string>;
  hashes: Map<string, Map<string, string>>;
  sortedSets: Map<string, Map<string, number>>;
  expiries: Map<string, number>;
}

// Create a type-safe mock that doesn't extend RedisWrapper to avoid interface conflicts
export class MockRedisClient {
  private data: MockRedisData;
  private currentTime: number;

  constructor(initialData?: Partial<MockRedisData>) {
    this.data = {
      strings: new Map(initialData?.strings || []),
      hashes: new Map(initialData?.hashes || []),
      sortedSets: new Map(initialData?.sortedSets || []),
      expiries: new Map(initialData?.expiries || [])
    };
    this.currentTime = Date.now();
  }

  setCurrentTime(time: number) {
    this.currentTime = time;
  }

  getCurrentTime(): number {
    return this.currentTime;
  }

  async incr(key: string): Promise<number> {
    const current = parseInt(this.data.strings.get(key) || '0', 10);
    const newValue = current + 1;
    this.data.strings.set(key, newValue.toString());
    return newValue;
  }

  async expire(key: string, seconds: number): Promise<number> {
    this.data.expiries.set(key, this.currentTime + (seconds * 1000));
    return 1;
  }

  async get(key: string): Promise<string | null> {
    this.checkExpiry(key);
    return this.data.strings.get(key) || null;
  }

  async set(key: string, value: string): Promise<'OK'> {
    this.data.strings.set(key, value);
    return 'OK';
  }

  async zadd(key: string, score: number, member: string): Promise<number | null> {
    this.checkExpiry(key);
    if (!this.data.sortedSets.has(key)) {
      this.data.sortedSets.set(key, new Map());
    }
    const set = this.data.sortedSets.get(key)!;
    const existed = set.has(member);
    set.set(member, score);
    return existed ? 0 : 1;
  }

  async zrange(key: string, start: number, stop: number, options?: { rev: boolean }): Promise<string[]> {
    this.checkExpiry(key);
    const set = this.data.sortedSets.get(key);
    if (!set) return [];

    const entries = Array.from(set.entries());
    entries.sort((a, b) => options?.rev ? b[1] - a[1] : a[1] - b[1]);

    const normalizedStart = start < 0 ? entries.length + start : start;
    const normalizedStop = stop < 0 ? entries.length + stop : stop;

    return entries
      .slice(normalizedStart, normalizedStop + 1)
      .map(([member]) => member);
  }

  async zremrangebyscore(key: string, min: number, max: number): Promise<number> {
    this.checkExpiry(key);
    const set = this.data.sortedSets.get(key);
    if (!set) return 0;

    let removed = 0;
    for (const [member, score] of set.entries()) {
      if (score >= min && score <= max) {
        set.delete(member);
        removed++;
      }
    }
    return removed;
  }

  async zcard(key: string): Promise<number> {
    this.checkExpiry(key);
    const set = this.data.sortedSets.get(key);
    return set ? set.size : 0;
  }

  async hgetall<T extends Record<string, unknown>>(key: string): Promise<T | null> {
    this.checkExpiry(key);
    const hash = this.data.hashes.get(key);
    if (!hash || hash.size === 0) return null;
    
    const result: Record<string, unknown> = {};
    for (const [field, value] of hash.entries()) {
      result[field] = value;
    }
    return result as T;
  }

  async hmset(key: string, value: Record<string, any>): Promise<'OK' | number> {
    if (!this.data.hashes.has(key)) {
      this.data.hashes.set(key, new Map());
    }
    const hash = this.data.hashes.get(key)!;
    
    for (const [field, val] of Object.entries(value)) {
      hash.set(field, String(val));
    }
    return 'OK';
  }

  async del(key: string): Promise<number> {
    const existed = this.data.strings.has(key) || this.data.hashes.has(key) || this.data.sortedSets.has(key);
    this.data.strings.delete(key);
    this.data.hashes.delete(key);
    this.data.sortedSets.delete(key);
    this.data.expiries.delete(key);
    return existed ? 1 : 0;
  }

  async zrem(key: string, member: string): Promise<number> {
    this.checkExpiry(key);
    const set = this.data.sortedSets.get(key);
    if (!set) return 0;
    return set.delete(member) ? 1 : 0;
  }

  pipeline() {
    return new MockPipeline(this);
  }

  private checkExpiry(key: string) {
    const expiry = this.data.expiries.get(key);
    if (expiry && expiry <= this.currentTime) {
      this.data.strings.delete(key);
      this.data.hashes.delete(key);
      this.data.sortedSets.delete(key);
      this.data.expiries.delete(key);
    }
  }

  // Helper methods for testing
  getData(): MockRedisData {
    return this.data;
  }

  clear() {
    this.data.strings.clear();
    this.data.hashes.clear();
    this.data.sortedSets.clear();
    this.data.expiries.clear();
  }
}

export class MockPipeline {
  private commands: Array<() => Promise<any>> = [];
  private client: MockRedisClient;
  // Add pipeline property to match the interface
  pipeline: any;

  constructor(client: MockRedisClient) {
    this.client = client;
    // Self-reference to satisfy the interface requirement
    this.pipeline = this;
  }

  hgetall(key: string) {
    this.commands.push(() => this.client.hgetall(key));
    return this;
  }

  del(key: string) {
    this.commands.push(() => this.client.del(key));
    return this;
  }

  zrem(key: string, member: string) {
    this.commands.push(() => this.client.zrem(key, member));
    return this;
  }

  hmset(key: string, value: Record<string, any>) {
    this.commands.push(() => this.client.hmset(key, value));
    return this;
  }

  zremrangebyscore(key: string, min: number, max: number) {
    this.commands.push(() => this.client.zremrangebyscore(key, min, max));
    return this;
  }

  zadd(key: string, score: number, member: string) {
    this.commands.push(() => this.client.zadd(key, score, member));
    return this;
  }

  zcard(key: string) {
    this.commands.push(() => this.client.zcard(key));
    return this;
  }

  expire(key: string, seconds: number) {
    this.commands.push(() => this.client.expire(key, seconds));
    return this;
  }

  zrange(key: string, start: number, stop: number) {
    this.commands.push(() => this.client.zrange(key, start, stop));
    return this;
  }

  incr(key: string) {
    this.commands.push(() => this.client.incr(key));
    return this;
  }

  get(key: string) {
    this.commands.push(() => this.client.get(key));
    return this;
  }

  async exec(): Promise<[Error | null, any][]> {
    const results: [Error | null, any][] = [];
    for (const command of this.commands) {
      try {
        const result = await command();
        results.push([null, result]);
      } catch (error) {
        results.push([error as Error, null]);
      }
    }
    return results;
  }
} 