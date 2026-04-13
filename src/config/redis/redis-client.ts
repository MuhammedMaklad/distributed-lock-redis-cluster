import {Cluster, type ClusterOptions} from "ioredis";

interface INode {
   host:string;
   port:number;
}

// Default cluster nodes for local development (outside Docker)
const defaultNodes: INode[] = [
  { host: '127.0.0.1', port: 7000 },
  { host: '127.0.0.1', port: 7001 },
  { host: '127.0.0.1', port: 7002 },
  { host: '127.0.0.1', port: 7003 },
  { host: '127.0.0.1', port: 7004 },
  { host: '127.0.0.1', port: 7005 },
];

// Cluster nodes for inside Docker environment
const dockerNodes: INode[] = [
  { host: 'redis-node-1', port: 6379 },
  { host: 'redis-node-2', port: 6379 },
  { host: 'redis-node-3', port: 6379 },
  { host: 'redis-node-4', port: 6379 },
  { host: 'redis-node-5', port: 6379 },
  { host: 'redis-node-6', port: 6379 },
];

const isDocker = process.env.IS_DOCKER === 'true';
const clusterNodes = isDocker ? dockerNodes : defaultNodes;

const clusterOptions:ClusterOptions ={
  // Max number of retries when a command fails
  maxRedirections: 16,

  // Retry strategy for connection errors
  retryStrategy: (times) => {
      return Math.min(times * 100, 3000);
  },

  // Enable pipelining to batch commands sent to the same node
  // This significantly improves throughput
  enableAutoPipelining: true,

  // When in Docker, we might need to handle how Redis announces its IP
  // but ioredis often handles this automatically if nodes are reachable by hostname
  dnsLookup: (address, callback) => callback(null, address),
  
  redisOptions: {
    connectTimeout: 10000
  }
}

// create cluster instance
const redisCluster = new Cluster(clusterNodes, clusterOptions);

// Event Listeners for Observability
redisCluster.on('connect', () => {
  console.log('✅ Redis Cluster Connected');
});

redisCluster.on('error', (err) => {
  console.error('❌ Redis Cluster Error:', err.message);
});

redisCluster.on('close', () => {
  console.warn('⚠️ Redis Cluster Connection Closed');
});

redisCluster.on('redirection', (err) => {
  // This happens when a key moves to a different node (e.g., during resharding)
  console.debug('🔄 Redis Cluster Redirection:', err?.message);
});

// Graceful Shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down Redis Cluster...');
  await redisCluster.quit();
  process.exit(0);
});

export default redisCluster;
