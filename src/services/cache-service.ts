

import redisCluster from "../config/redis/redis-client.ts";

export class CacheService {
  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    fetchFromDb: () => Promise<T | null>
  ): Promise<T | null> {
    try {
      // try to get from cache
      const cachedValue = await redisCluster.get(key);

      // cache hit
      if (cachedValue !== null)
        return JSON.parse(cachedValue) as T;
      // cache miss
      // -> use a distributed lock to prevent thundering herd
      // use SET NX EX for atomic lock acquisition
      const lockKey = `${key}:lock`;
      const lockAcquired = await redisCluster.set(
        lockKey,
        '1',
        'EX',
        10,
        'NX'
      );

      if (lockAcquired == 'OK') {
        try {
          // double-check cache lock (another request might have filled it)
          const recheck = await redisCluster.get(key);
          if (recheck != null)
            return JSON.parse(recheck) as T;

          // fetch data from db
          const data = await fetchFromDb();

          if (data != null)
            await redisCluster.setex(key, ttlSeconds, JSON.stringify(data));
          else
            // to prevent penetration attacks
            await redisCluster.setex(key, 60, JSON.stringify(null));
          return data;
        } finally {
          // release the lock
          const res = await redisCluster.del(lockKey);
        }
      }
      else{
        // Lock Not acquired: Wait briefly and retry recursively or return null
        // For simplicity, we wait 100ms and try again once
        await new Promise(resolve => setTimeout(resolve, 100));
        return this.getOrSet(key, ttlSeconds, fetchFromDb);
      }
    } catch (e) {
      console.error(`Error in getOrSet for key ${key}:`, e);
      return fetchFromDb();
    }
  }

  /*
    * Invalidate a key
   */
  async invalidate(key: string):Promise<void> {
    try{
      await  redisCluster.del(key);
    }
    catch (e) {
      console.log(`Error invalidating key ${key}:`, e);
    }
  }
  /*
    * Example of using Hashes for structured data (More memory efficient)
   */
  async setUserProfile(userId: string, profile:Record<string, any> | null){
    const key = `user:${userId}:profile`;

    // HSET allows updating individual fields without rewriting the whole object
    await redisCluster.hset(key, JSON.stringify(profile));
    // Set expiry on the has
    await redisCluster.expire(key, 3600);
  }

  async getUserProfile(userId: string):Promise<Record<string, any> | null> {
    const key = `user:${userId}:profile`;
    const exists = await redisCluster.exists(key);
    if(!exists)
      return null;
    return redisCluster.hgetall(key);
  }

}

export const cacheService = new CacheService();