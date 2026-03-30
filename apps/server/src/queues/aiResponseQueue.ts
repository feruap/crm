// AI Response Queue — disabled until worker infrastructure is ready
// This file exists to prevent import errors but the queue is not active
// Bot responses are processed inline in webhooks.ts handleBotResponse

export interface AIJobData {
    conversationId: string;
    channelId: string;
    customerId: string;
    messageText: string;
    inboundMsgId: string;
}

// Placeholder — queue not initialized to avoid Redis dependency issues
export const aiResponseQueue: any = null;
