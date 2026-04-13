import express from "express"
import type {Request, Response} from "express";
import {userRouter} from "./routes/user.route.ts";
import {errorHandler} from "./middlewares/error.middleware.ts";
import {getClusterTopology} from "./config/redis/redis-client.ts";

const app = express();

app.use(express.json());

/**
 * Log Cluster Topology
 * It's better to keep this logic separate from the main app flow
 * or call it in your server.ts file before app.listen()
 */

const inspectCluster = async () => {
  try {
    console.log('🔍 Inspecting Redis Cluster Topology...\n');
    // Ensure getClusterTopology is defined/imported
    const nodes = await getClusterTopology();

    nodes.forEach(node => {
      const roleLabel = node.role === 'master' ? '👑 MASTER' : '🔄 REPLICA';
      const masterInfo = node.role === 'slave' && node.masterId
        ? `(of Master ${node.masterId.substring(0, 8)}...)`
        : '';

      console.log(`${roleLabel} | ${node.ip}:${node.port} | ID: ${node.id.substring(0, 8)}... ${masterInfo}`);
    });
  } catch (err) {
    console.error('❌ Redis Topology Inspection Failed:', err);
  }
};

// Execute inspection
inspectCluster();

app.use("/api/v1/user", userRouter);


app.use((req: Request, res:Response) => {
  return res.status(404).json({
    status:"This URL NOT FOUND",
    timestamp : new Date().toISOString(),
  })
})

app.use(errorHandler);

export default  app;