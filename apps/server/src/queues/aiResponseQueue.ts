import { Queue } from 'bullmq';
import { connection } from '../queues';

export interface AIJobData {
  conversationId: string;
  channelId: string;
  customerId: string;
  messageText: string;
  inboundMsgId: string;
}

export const aiResponseQueue = new Queue<AIJobData>('ai-response', {
  connection: connection as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 500,
    removeOnFail: 200,
  },
});
