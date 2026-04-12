/**
 * Message Orchestrator
 *
 * Priority hierarchy for every incoming message:
 *   1. Visual bot_flow match  → execute its nodes, then RETURN
 *   2. Visual flow with a "pass_to_ai" node → continue into Smart Bot Engine
 *   3. No flow matched → Smart Bot Engine as intelligent fallback
 *
 * The orchestrator is channel-agnostic: message delivery is delegated to the
 * `sendMessage` callback supplied by the caller (webhooks.ts / simulator.ts).
 */

import { db } from '../db';
import { findMatchingFlow, isWithinBusinessHours } from '../routes/flows';
import { handleIncomingMessage, IncomingMessageParams, BotResponse } from './smart-bot-engine';
import { assignFromGroup } from '../routes/agent-groups';
import { generateEmbedding, findBestAnswer, getAIResponse } from '../ai.service';

// ─────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────

export type OrchestratorPath =
    | 'visual_flow'           // flow matched, all nodes executed, done
    | 'visual_flow_pass_to_ai'// flow matched, hit pass_to_ai node, Smart Bot continues
    | 'smart_bot_fallback';   // no flow matched, Smart Bot handled everything

export interface OrchestratorResult {
    path: OrchestratorPath;
    flowId?: string;
    flowName?: string;
    /** Present when path is 'visual_flow_pass_to_ai' or 'smart_bot_fallback' */
    smartBotResponse?: BotResponse;
}

export interface OrchestratorParams {
    conversationId: string;
    channelId: string;
    customerId: string;
    messageText: string;
    /** Channel provider string, e.g. 'whatsapp' | 'facebook' | 'instagram' */
    channelProvider: string;
    isFirstMessage: boolean;
    campaignId?: string | null;
    referralData?: Record<string, any>;
    aiProvider?: string;
    apiKey?: string;
    modelName?: string;
    /** Callback used by the orchestrator to deliver messages to the customer */
    sendMessage: (content: string) => Promise<void>;
}

// ─────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────

export async function orchestrateMessage(params: OrchestratorParams): Promise<OrchestratorResult> {
    const {
        conversationId, channelId, customerId, messageText, channelProvider,
        isFirstMessage, campaignId, referralData, aiProvider, apiKey, modelName, sendMessage,
    } = params;

    const afterHours = !(await isWithinBusinessHours());

    // ── STEP 1: Check for a matching visual bot_flow ──────────────────────────
    let matchedFlow: any = null;
    try {
        matchedFlow = await findMatchingFlow({
            provider: channelProvider,
            messageText,
            isFirstMessage,
            campaignId,
            isAfterHours: afterHours,
        });
    } catch (flowErr) {
        console.error('[Orchestrator] Error in findMatchingFlow — falling through to Smart Bot:', flowErr);
    }

    if (matchedFlow) {
        console.log(`[Orchestrator] PATH=visual_flow | flow="${matchedFlow.name}" id=${matchedFlow.id} type=${matchedFlow.flow_type} | conv=${conversationId}`);

        if (matchedFlow.flow_type === 'visual' && matchedFlow.nodes) {
            // ── STEP 2: Execute the visual flow's nodes ───────────────────────
            const passToAI = await executeVisualFlowNodes({
                flow: matchedFlow,
                conversationId,
                channelId,
                customerId,
                messageText,
                aiProvider,
                apiKey,
                modelName,
                sendMessage,
            });

            if (passToAI) {
                // ── STEP 3: pass_to_ai node found — hand off to Smart Bot ─────
                console.log(`[Orchestrator] PATH=visual_flow_pass_to_ai | flow="${matchedFlow.name}" → Smart Bot | conv=${conversationId}`);
                const smartBotResponse = await callSmartBot({
                    conversationId, customerId, messageText, channelProvider,
                    referralData, isFirstMessage, aiProvider, apiKey,
                });
                return { path: 'visual_flow_pass_to_ai', flowId: matchedFlow.id, flowName: matchedFlow.name, smartBotResponse };
            }

            return { path: 'visual_flow', flowId: matchedFlow.id, flowName: matchedFlow.name };
        }

        // Simple (non-visual) flow — fall through to Smart Bot for now
        // (simple flows lack structured node execution; Smart Bot provides the reply)
        console.log(`[Orchestrator] Simple flow "${matchedFlow.name}" matched but has no nodes — falling through to Smart Bot | conv=${conversationId}`);
    }

    // ── STEP 4: No visual flow matched — Smart Bot Engine as fallback ─────────
    console.log(`[Orchestrator] PATH=smart_bot_fallback | conv=${conversationId}`);
    const smartBotResponse = await callSmartBot({
        conversationId, customerId, messageText, channelProvider,
        referralData, isFirstMessage, aiProvider, apiKey,
    });
    return { path: 'smart_bot_fallback', smartBotResponse };
}

// ─────────────────────────────────────────────
// Visual flow node executor
// Returns true if a pass_to_ai node was encountered
// ─────────────────────────────────────────────

interface ExecuteFlowParams {
    flow: any;
    conversationId: string;
    channelId: string;
    customerId: string;
    messageText: string;
    aiProvider?: string;
    apiKey?: string;
    modelName?: string;
    sendMessage: (content: string) => Promise<void>;
}

async function executeVisualFlowNodes(p: ExecuteFlowParams): Promise<boolean> {
    const nodes: any[] = p.flow.nodes || [];
    const edges: any[] = p.flow.edges || [];

    const triggerNode = nodes.find((n: any) => n.type === 'trigger');
    if (!triggerNode) return false;

    function getNextNodes(nodeId: string): string[] {
        return edges.filter((e: any) => e.source === nodeId).map((e: any) => e.target);
    }

    const visited = new Set<string>();
    const queue: string[] = getNextNodes(triggerNode.id);
    let passToAI = false;

    while (queue.length > 0) {
        const nodeId = queue.shift()!;
        if (visited.has(nodeId)) continue;
        visited.add(nodeId);

        const node = nodes.find((n: any) => n.id === nodeId);
        if (!node) continue;

        switch (node.type) {

            case 'send_message': {
                if (node.data?.message) {
                    await p.sendMessage(node.data.message);
                }
                queue.push(...getNextNodes(nodeId));
                break;
            }

            case 'menu_buttons': {
                const buttons: any[] = node.data?.buttons || [];
                let menuText: string = node.data?.message || '';
                if (buttons.length > 0) {
                    menuText += '\n\n' + buttons.map((b: any, i: number) => `${i + 1}. ${b.text}`).join('\n');
                }
                if (menuText.trim()) {
                    await p.sendMessage(menuText);
                }
                // Pause point — customer's next message re-enters the orchestrator
                break;
            }

            case 'conditional': {
                const condition = (node.data?.condition || '').toLowerCase();
                const text = p.messageText.toLowerCase();
                const conditionMet = condition.split('|').some((part: string) => text.includes(part.trim()));
                const nextNodes = getNextNodes(nodeId);
                if (conditionMet && nextNodes.length > 0) {
                    queue.push(nextNodes[0]); // true branch
                } else if (nextNodes.length > 1) {
                    queue.push(nextNodes[1]); // false branch
                }
                break;
            }

            case 'transfer_to_group': {
                if (node.data?.group_id) {
                    const agentId = await assignFromGroup(node.data.group_id, p.conversationId);
                    if (agentId) {
                        await p.sendMessage('Te estamos conectando con un agente. Un momento por favor...');
                    }
                }
                // Stop — agent takes over
                break;
            }

            case 'pass_to_ai': {
                // Signal: hand off remaining handling to Smart Bot Engine
                passToAI = true;
                break;
            }

            case 'ai_response': {
                // RAG + AI node inside a visual flow
                try {
                    const aiProvider = p.aiProvider;
                    const apiKey = p.apiKey;
                    const modelName = p.modelName;
                    if (aiProvider && apiKey) {
                        const settings = await db.query(
                            `SELECT provider, api_key_encrypted, system_prompt, model_name
                             FROM ai_settings WHERE is_default = TRUE LIMIT 1`
                        );
                        if (settings.rows.length > 0) {
                            const s = settings.rows[0];
                            const prov = aiProvider || s.provider;
                            const key = apiKey || s.api_key_encrypted;
                            const prompt = node.data?.custom_prompt || s.system_prompt || '';
                            const model = modelName || s.model_name;
                            const embedding = await generateEmbedding(p.messageText, prov, key);
                            const hit = await findBestAnswer(p.messageText, embedding);
                            let context: string | undefined;
                            if (hit && hit.confidence > 0.30) {
                                context = `Info: ${hit.question} → ${hit.answer}`;
                            }
                            const reply = await getAIResponse(
                                prov as any, prompt, p.messageText, key, model, p.customerId, context, p.conversationId
                            );
                            await p.sendMessage(reply);
                        }
                    }
                } catch (aiErr) {
                    console.error('[Orchestrator] ai_response node error:', aiErr);
                    await p.sendMessage('Lo siento, hubo un error al procesar tu solicitud.');
                }
                queue.push(...getNextNodes(nodeId));
                break;
            }

            case 'wait_response': {
                // Pause — stop flow; customer's next message re-enters the orchestrator
                break;
            }

            default:
                queue.push(...getNextNodes(nodeId));
                break;
        }
    }

    return passToAI;
}

// ─────────────────────────────────────────────
// Thin wrapper around Smart Bot Engine
// ─────────────────────────────────────────────

async function callSmartBot(params: {
    conversationId: string;
    customerId: string;
    messageText: string;
    channelProvider: string;
    referralData?: Record<string, any>;
    isFirstMessage: boolean;
    aiProvider?: string;
    apiKey?: string;
}): Promise<BotResponse> {
    const smartBotParams: IncomingMessageParams = {
        conversationId: params.conversationId,
        customerId: params.customerId,
        message: params.messageText,
        channelType: params.channelProvider,
        referralData: params.referralData,
        isFirstMessage: params.isFirstMessage,
        aiProvider: params.aiProvider,
        apiKey: params.apiKey,
    };
    return handleIncomingMessage(smartBotParams);
}
