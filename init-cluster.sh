#!/bin/bash
# init-cluster.sh

echo "Waiting for Redis nodes to start..."

# Wait for all 6 nodes to be pingable
for i in $(seq 1 30); do
  if redis-cli -h redis-node-1 -p 6379 ping | grep -q PONG && \
     redis-cli -h redis-node-2 -p 6379 ping | grep -q PONG && \
     redis-cli -h redis-node-3 -p 6379 ping | grep -q PONG && \
     redis-cli -h redis-node-4 -p 6379 ping | grep -q PONG && \
     redis-cli -h redis-node-5 -p 6379 ping | grep -q PONG && \
     redis-cli -h redis-node-6 -p 6379 ping | grep -q PONG; then
    echo "All nodes are up!"
    break
  fi
  echo "Waiting... ($i/30)"
  sleep 2
done

echo "Creating Redis Cluster..."

# Create the cluster with 3 masters and 3 replicas
# --cluster-yes automatically accepts the configuration
redis-cli --cluster create \
  redis-node-1:6379 \
  redis-node-2:6379 \
  redis-node-3:6379 \
  redis-node-4:6379 \
  redis-node-5:6379 \
  redis-node-6:6379 \
  --cluster-replicas 1 \
  --cluster-yes

echo "Redis Cluster initialized successfully!"

# Keep the container alive
tail -f /dev/null