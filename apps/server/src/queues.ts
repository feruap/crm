import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
connection.on('error', (err) => console.error('[Redis] Connection error (non-fatal):', err.message));

export const bulkCampaignQueue = new Queue('bulkCampaigns', { connection: connection as any });

export { connection };
