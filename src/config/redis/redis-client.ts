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
// console.log(isDocker)
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
  
  redisOptions: {
    connectTimeout: 10000
  }
}

// create cluster instance
const redisCluster = new Cluster(clusterNodes, clusterOptions);

// --- Helper: Parse Cluster Nodes Info ---
interface NodeInfo {
  id: string;
  ip: string;
  port: number;
  role: 'master' | 'slave';
  masterId: string | null; // If slave, this is the master's ID
  status: string;
  slots?: string[]; // Added to store slots for masters
}

async function getClusterTopology(): Promise<NodeInfo[]> {
  // We can ask ANY node for the full cluster state
  // ioredis will pick one automatically
  const rawInfo = await redisCluster.cluster('NODES') as string;

  return rawInfo.split('\n').filter(line => line.length > 0).map(line => {
    const parts = line.split(' ');
    const id = parts[0];
    const address = parts[1].split('@')[0]; // Remove bus port
    const lastColonIndex = address.lastIndexOf(':');
    const ip = address.substring(0, lastColonIndex);
    const port = address.substring(lastColonIndex + 1);
    const flags = parts[2]; // e.g., "myself,master" or "slave"

    let role: 'master' | 'slave' = 'master';
    let masterId: string | null = null;

    if (flags.includes('slave')) {
      role = 'slave';
      // Format: id ip:port@cport flags master-id ping-sent pong-recv config-epoch link-state slots...
      masterId = parts[3] === '-' ? null : parts[3];
    } else if (flags.includes('master')) {
      role = 'master';
    }

    const node: NodeInfo = {
      id,
      ip,
      port: parseInt(port, 10),
      role,
      masterId,
      status: parts[7] // connected/disconnected
    };

    if (role === 'master') {
      node.slots = parts.slice(8);
    }

    return node;
  });
}

// --- Helper: Find Which Node Holds a Key ---
async function getNodeForKey(key: string): Promise<NodeInfo | null> {
  const topology = await getClusterTopology();

  // 1. Get the slot for the key (ioredis calculation)
  // We can use the cluster's internal method or a utility, 
  // but asking Redis is also fine for a helper.
  const slot = await redisCluster.cluster('KEYSLOT', key) as number;

  // 2. Find which Master owns this slot
  for (const node of topology) {
    if (node.role !== 'master' || !node.slots) continue;

    for (const range of node.slots) {
      if (range.startsWith('[')) continue; // Ignore importing/migrating slots
      
      if (range.includes('-')) {
        const [start, end] = range.split('-').map(Number);
        if (slot >= start && slot <= end) {
          return node;
        }
      } else {
        if (parseInt(range, 10) === slot) {
          return node;
        }
      }
    }
  }

  return null;
}

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
export {getClusterTopology, getNodeForKey };
export default redisCluster;
