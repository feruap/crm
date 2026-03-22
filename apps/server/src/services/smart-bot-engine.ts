/**
 * Smart Bot Engine for Botón Médico CRM
 *
 * Handles all 4 optimization points:
 * 1. Instant Campaign Response - Auto-reply to ad clicks with product info
 * 2. Automatic Lead Qualification - Sequential questions to score leads
 * 3. Medical Advisory AI - Clinical questions with RAG + medical rules
 * 4. Smart Routing - Intent classification and intelligent escalation
 *
 * This is the CORE engine that replaces basic bot logic.
 */

import { db } from '../db';
import { findMedicalContext, generateEmbedding, AIProvider } from '../ai.service';
import { getRecommendations, getCustomerProfile, CustomerProfile } from './recommendation-engine';
import { findCampaignMapping, sendCampaignAutoReply } from './campaign-responder';
import { buildMedicalPrompt } from '../prompts/medical-advisor';
import {
    getFirstQualificationStep,
    getQualificationStepById,
    calculateQualificationScore,
    shouldRouteToSalesAgent,
    getRoutingRecommendation,
} from '../data/qualification-flows';
import {
    buildCustomerWCContext,
    generateWCCartLink,
    getCustomerWCOrders,
    getOrderWithKanbanState,
    mapWCStatusToKanban,
    requestSKDiscount,
    createOrderFromBot,
    CustomerWCContext,
} from './wc-integration-engine';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type IntentType =
    | 'CAMPAIGN_RESPONSE'
    | 'QUALIFICATION'
    | 'MEDICAL_INQUIRY'
    | 'PRICE_REQUEST'
    | 'ORDER_STATUS'
    | 'COMPLAINT'
    | 'HUMAN_NEEDED'
    | 'REORDER'
    | 'ORDER_TRACKING'
    | 'DISCOUNT_REQUEST'
    | 'ORDER_CREATE';

export interface IntentClassification {
    intent: IntentType;
    confidence: number;        // 0.0 - 1.0
    reason: string;
    keywords_matched: string[];
}

export interface BotResponse {
    message: string;
    confidence: number;
    intent_type: IntentType;
    action_type: string;      // 'reply', 'escalate', 'continue_qualification'
    routing_decision?: RoutingDecision;
    interaction_data?: any;
}

export interface RoutingDecision {
    should_escalate: boolean;
    target_type: 'bot' | 'support_agent' | 'sales_agent' | 'senior_agent';
    reason: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    with_summary?: string;
}

// ─────────────────────────────────────────────
// POINT 1: INSTANT CAMPAIGN RESPONSE
// ─────────────────────────────────────────────

export async function generateCampaignResponse(
    referralData: any,
    customerId: string,
    conversationId: string
): Promise<BotResponse | null> {
    if (!referralData || !referralData.ad_id) {
        return null;
    }

    try {
        const mapping = await findCampaignMapping(referralData);

        if (mapping) {
            // ── Has campaign config: send configured auto-reply ──
            await sendCampaignAutoReply(conversationId, '', customerId, mapping);

            await db.query(
                `INSERT INTO bot_interactions
                 (conversation_id, customer_id, interaction_type, intent_classification, confidence, action_taken, result)
                 VALUES ($1, $2, 'campaign_response', 'CAMPAIGN_RESPONSE', 1.0, 'send_campaign_auto_reply', $3)`,
                [conversationId, customerId, JSON.stringify({ campaign_id: mapping.campaign_id, product_name: mapping.product_name })]
            );

            await db.query(
                `UPDATE conversations SET bot_mode = 'campaign_response' WHERE id = $1`,
                [conversationId]
            );

            return {
                message: mapping.welcome_message,
                confidence: 1.0,
                intent_type: 'CAMPAIGN_RESPONSE',
                action_type: 'reply',
            };
        }

        // ── No campaign config: smart fallback with ad context ──
        // The customer clicked an ad but there's no auto-reply configured.
        // Generate a contextual greeting using the ad title so the bot
        // still acknowledges the ad and provides a good first impression.
        const adTitle = referralData.ads_context_data?.ad_title || '';
        const adContext = adTitle
            ? `¡Hola! Gracias por tu interés en "${adTitle}". Estoy aquí para ayudarte con cualquier duda sobre este producto. ¿Qué te gustaría saber?`
            : '¡Hola! Gracias por contactarnos a través de nuestra publicidad. ¿En qué puedo ayudarte?';

        // Record that a customer arrived via ad even without config
        await db.query(
            `INSERT INTO bot_interactions
             (conversation_id, customer_id, interaction_type, intent_classification, confidence, action_taken, result)
             VALUES ($1, $2, 'campaign_response', 'CAMPAIGN_FALLBACK', 0.9, 'send_ad_fallback_greeting', $3)`,
            [conversationId, customerId, JSON.stringify({ ad_id: referralData.ad_id, ad_title: adTitle, fallback: true })]
        );

        await db.query(
            `UPDATE conversations SET bot_mode = 'campaign_response' WHERE id = $1`,
            [conversationId]
        );

        console.log(`[Campaign Fallback] No config for ad ${referralData.ad_id} — sending contextual greeting for conv ${conversationId}`);

        return {
            message: adContext,
            confidence: 0.9,
            intent_type: 'CAMPAIGN_RESPONSE',
            action_type: 'reply',
        };
    } catch (err) {
        console.error('[Campaign Response Error]', err);
        return null;
    }
}

// ─────────────────────────────────────────────
// POINT 2: AUTOMATIC LEAD QUALIFICATION
// ─────────────────────────────────────────────

export async function runQualificationFlow(
    conversationId: string,
    customerId: string,
    message: string,
    currentStep?: string
): Promise<BotResponse> {
    try {
        // Get or initialize conversation state
        let state = await db.query(
            `SELECT * FROM conversation_state WHERE conversation_id = $1`,
            [conversationId]
        );

        let stepId = currentStep;
        if (!stepId) {
            // Initialize flow
            const firstStep = getFirstQualificationStep('campaign_lead');
            stepId = firstStep?.id;

            if (!stepId) {
                return {
                    message: 'Error al inicializar flujo de calificación. Por favor intente después.',
                    confidence: 0.0,
                    intent_type: 'HUMAN_NEEDED',
                    action_type: 'escalate',
                };
            }

            await db.query(
                `INSERT INTO conversation_state (conversation_id, current_step, step_data)
                 VALUES ($1, $2, '{}')
                 ON CONFLICT (conversation_id) DO UPDATE
                   SET current_step = EXCLUDED.current_step`,
                [conversationId, stepId]
            );
        }

        // Get current step
        const currentStepObj = getQualificationStepById('campaign_lead', stepId || '');
        if (!currentStepObj) {
            return {
                message: 'Flujo de calificación completado. Un asesor se comunicará con usted.',
                confidence: 0.9,
                intent_type: 'HUMAN_NEEDED',
                action_type: 'escalate',
            };
        }

        // Validate answer
        let matched = false;
        if (currentStepObj.expected_patterns) {
            const lowerMsg = message.toLowerCase();
            const keywords = currentStepObj.expected_patterns.keywords || [];
            matched = keywords.some(kw => lowerMsg.includes(kw.toLowerCase()));
        }

        // Store answer
        const qualData: any = {};
        qualData[currentStepObj.id] = message;

        // Update conversation state
        const nextStepId = matched ? currentStepObj.next_step : currentStepObj.alternative_step || 'complete';

        await db.query(
            `UPDATE conversation_state
             SET current_step = $1, step_data = step_data || $2
             WHERE conversation_id = $3`,
            [nextStepId, JSON.stringify(qualData), conversationId]
        );

        // If qualification is complete, calculate score
        let finalResponse = '';
        let isComplete = false;

        if (nextStepId === 'complete') {
            // Get all qualification data
            const stepData = await db.query(
                `SELECT step_data FROM conversation_state WHERE conversation_id = $1`,
                [conversationId]
            );

            const allAnswers = stepData.rows[0]?.step_data || {};
            const score = calculateQualificationScore(allAnswers);

            // Store in customer profile
            await db.query(
                `INSERT INTO customer_profiles (customer_id, qualification_data, lead_score)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (customer_id) DO UPDATE
                   SET qualification_data = EXCLUDED.qualification_data,
                       lead_score = EXCLUDED.lead_score`,
                [customerId, JSON.stringify(allAnswers), score.total_score]
            );

            // Record lead score
            await db.query(
                `INSERT INTO lead_scores
                 (customer_id, conversation_id, professional_score, volume_score, engagement_score, total_score)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    customerId,
                    conversationId,
                    score.professional_score,
                    score.volume_score,
                    score.engagement_score,
                    score.total_score,
                ]
            );

            const routing = getRoutingRecommendation(score);
            finalResponse = `Excelente. Hemos recopilado su información. Un especialista en ${routing.priority === 'hot' ? 'ventas' : 'soporte'} se comunicará con usted en breve.`;
            isComplete = true;
        } else {
            // Ask next question
            const nextStepObj = getQualificationStepById('campaign_lead', nextStepId || '');
            finalResponse = nextStepObj?.question || 'Continuando con el siguiente paso...';
        }

        // Update conversation mode
        await db.query(
            `UPDATE conversations
             SET bot_mode = $1, qualification_step = $2, bot_interaction_count = bot_interaction_count + 1
             WHERE id = $3`,
            [isComplete ? 'human_handoff' : 'qualification', nextStepId, conversationId]
        );

        // Record interaction
        await db.query(
            `INSERT INTO bot_interactions
             (conversation_id, customer_id, interaction_type, intent_classification, confidence, action_taken)
             VALUES ($1, $2, 'qualification_q', 'QUALIFICATION', 0.95, $3)`,
            [conversationId, customerId, isComplete ? 'qualification_complete' : 'qualification_ask']
        );

        return {
            message: finalResponse,
            confidence: 0.95,
            intent_type: 'QUALIFICATION',
            action_type: isComplete ? 'escalate' : 'continue_qualification',
        };
    } catch (err) {
        console.error('[Qualification Flow Error]', err);
        return {
            message: 'Ocurrió un error en el proceso de calificación. Un asesor lo contactará.',
            confidence: 0.0,
            intent_type: 'HUMAN_NEEDED',
            action_type: 'escalate',
        };
    }
}

// ─────────────────────────────────────────────
// POINT 3: MEDICAL ADVISORY AI
// ─────────────────────────────────────────────

export async function generateMedicalAdvisory(
    message: string,
    customerId: string,
    conversationId: string,
    aiProvider: AIProvider,
    apiKey: string
): Promise<BotResponse> {
    try {
        // Get customer profile
        const profile = await getCustomerProfile(customerId);

        // Generate embedding for semantic search
        const embedding = await generateEmbedding(message, aiProvider, apiKey);

        // Find relevant medical knowledge (RAG)
        const medicalContext = await findMedicalContext(embedding, 3);

        // Get AI recommendations
        const recommendations = await getRecommendations(message, customerId, aiProvider, apiKey);

        // Build system prompt with context
        const systemPrompt = buildMedicalPrompt({
            customerProfile: profile,
            recommendations,
            knowledgeContext: medicalContext || undefined,
        });

        // Call AI service (simplified - in real implementation, call actual AI)
        // For now, return a template response
        const response = await generateAIResponse(message, systemPrompt, aiProvider, apiKey);

        // Record interaction
        await db.query(
            `INSERT INTO bot_interactions
             (conversation_id, customer_id, interaction_type, intent_classification, confidence, action_taken, result)
             VALUES ($1, $2, 'medical_advisory', 'MEDICAL_INQUIRY', $3, 'generate_advisory', $4)`,
            [
                conversationId,
                customerId,
                0.88,
                JSON.stringify({
                    recommendations_count: recommendations.length,
                    context_used: !!medicalContext,
                }),
            ]
        );

        return {
            message: response,
            confidence: 0.88,
            intent_type: 'MEDICAL_INQUIRY',
            action_type: 'reply',
        };
    } catch (err) {
        console.error('[Medical Advisory Error]', err);
        return {
            message: 'Perdón, hubo un error al procesar tu pregunta médica. Un asesor especializado te contactará en breve.',
            confidence: 0.0,
            intent_type: 'HUMAN_NEEDED',
            action_type: 'escalate',
        };
    }
}

// ─────────────────────────────────────────────
// POINT 4: SMART ROUTING
// ─────────────────────────────────────────────

export async function classifyIntent(message: string, conversationHistory: any[]): Promise<IntentClassification> {
    const lowerMsg = message.toLowerCase();

    // Check if the message mentions any product by name or keyword
    try {
        const productKeywords = await db.query(
            `SELECT name, palabras_clave FROM medical_products WHERE is_active = TRUE`
        );
        for (const row of productKeywords.rows) {
            const nameWords = (row.name || '').toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
            const keywords = (row.palabras_clave || []) as string[];
            const allTerms = [...nameWords, ...keywords.map((k: string) => k.toLowerCase())];
            for (const term of allTerms) {
                if (lowerMsg.includes(term)) {
                    return {
                        intent: 'PRICE_REQUEST',
                        confidence: 0.85,
                        reason: `Producto detectado: ${row.name} (keyword: ${term})`,
                        keywords_matched: [term],
                    };
                }
            }
        }
    } catch { /* ignore product lookup errors */ }

    // Define keyword sets for each intent
    const intentPatterns = {
        COMPLAINT: {
            keywords: ['queja', 'reclamo', 'problema', 'defecto', 'no llegó', 'devolución', 'insatisfecho'],
            weight: 1.0,
        },
        PRICE_REQUEST: {
            keywords: ['precio', 'costo', 'cotización', 'presupuesto', 'cuánto cuesta', 'valor', 'factura'],
            weight: 0.9,
        },
        ORDER_STATUS: {
            keywords: ['pedido', 'orden', 'envío', 'tracking', 'estado', 'cuándo llega', 'dónde está', 'número de pedido'],
            weight: 0.85,
        },
        ORDER_TRACKING: {
            keywords: ['dónde está mi pedido', 'tracking', 'número de seguimiento', 'guía', 'rastrear'],
            weight: 0.9,
        },
        ORDER_CREATE: {
            keywords: ['quiero comprar', 'hacer pedido', 'quiero pedir', 'necesito comprar', 'quiero ordenar', 'me interesa comprar', 'cómo compro', 'cómo pido', 'agregar al carrito'],
            weight: 0.9,
        },
        REORDER: {
            keywords: ['quiero reordenar', 'voy a comprar de nuevo', 'otra vez lo mismo', 'repetir pedido', 'comprar más'],
            weight: 0.85,
        },
        DISCOUNT_REQUEST: {
            keywords: ['descuento', 'rebaja', 'promoción', 'oferta', 'precio especial', 'cupon'],
            weight: 0.8,
        },
        MEDICAL_INQUIRY: {
            keywords: [
                'sensibilidad',
                'especificidad',
                'muestra',
                'procedimiento',
                'interpretación',
                'resultado',
                'clínico',
                'diagnóstico',
                'síntomas',
            ],
            weight: 0.8,
        },
        HUMAN_NEEDED: {
            keywords: ['hablar con alguien', 'agente humano', 'persona real', 'representante', 'asesor'],
            weight: 1.0,
        },
    };

    // Score each intent
    const scores: Record<string, { score: number; matched: string[] }> = {};

    for (const [intent, pattern] of Object.entries(intentPatterns)) {
        let matchCount = 0;
        const matched = [];

        for (const keyword of pattern.keywords) {
            if (lowerMsg.includes(keyword)) {
                matchCount++;
                matched.push(keyword);
            }
        }

        scores[intent] = {
            score: matchCount > 0 ? (matchCount / pattern.keywords.length) * pattern.weight : 0,
            matched,
        };
    }

    // Find best match
    let bestIntent: IntentType = 'QUALIFICATION';
    let bestScore = 0;
    let bestMatched: string[] = [];

    for (const [intent, data] of Object.entries(scores)) {
        if (data.score > bestScore) {
            bestScore = data.score;
            bestIntent = intent as IntentType;
            bestMatched = data.matched;
        }
    }

    return {
        intent: bestIntent,
        confidence: Math.min(bestScore, 1.0),
        reason: `Detectado por palabras clave: ${bestMatched.join(', ') || 'contexto general'}`,
        keywords_matched: bestMatched,
    };
}

export async function routeConversation(
    classification: IntentClassification,
    conversationId: string,
    customerId: string
): Promise<RoutingDecision> {
    // Check bot confidence
    if (classification.confidence < 0.6) {
        return {
            should_escalate: true,
            target_type: 'support_agent',
            reason: 'Confianza baja en clasificación de intención',
            priority: 'medium',
        };
    }

    // Route by intent
    switch (classification.intent) {
        case 'CAMPAIGN_RESPONSE':
        case 'QUALIFICATION':
        case 'MEDICAL_INQUIRY':
            return {
                should_escalate: false,
                target_type: 'bot',
                reason: 'Bot puede manejar este tipo de solicitud',
                priority: 'low',
            };

        case 'REORDER':
        case 'ORDER_CREATE':
            return {
                should_escalate: false,
                target_type: 'bot',
                reason: 'Bot puede procesar orden/reorden',
                priority: 'low',
            };

        case 'DISCOUNT_REQUEST':
            return {
                should_escalate: true,
                target_type: 'sales_agent',
                reason: 'Solicitud de descuento - requiere autorización de supervisor',
                priority: 'high',
            };

        case 'PRICE_REQUEST':
            // Bot can show catalog prices; agent handles custom quotes
            return {
                should_escalate: false,
                target_type: 'bot',
                reason: 'Bot muestra precios del catálogo; escala a agente si pide cotización personalizada',
                priority: 'medium',
            };

        case 'ORDER_STATUS':
        case 'ORDER_TRACKING':
            return {
                should_escalate: false,
                target_type: 'bot',
                reason: 'Bot puede consultar estado de pedido en WooCommerce',
                priority: 'medium',
            };

        case 'COMPLAINT':
            return {
                should_escalate: true,
                target_type: 'senior_agent',
                reason: 'Queja del cliente - requiere agente senior',
                priority: 'critical',
            };

        case 'HUMAN_NEEDED':
            return {
                should_escalate: true,
                target_type: 'support_agent',
                reason: 'Cliente solicita hablar con humano',
                priority: 'high',
            };

        default:
            return {
                should_escalate: true,
                target_type: 'support_agent',
                reason: 'Clasificación desconocida - escalar por seguridad',
                priority: 'medium',
            };
    }
}

// ─────────────────────────────────────────────
// MAIN ENTRY POINT
// ─────────────────────────────────────────────

export async function handleIncomingMessage(params: {
    conversationId: string;
    customerId: string;
    message: string;
    channelType: 'whatsapp' | 'messenger' | 'instagram' | 'webchat';
    referralData?: any;
    isFirstMessage: boolean;
    aiProvider?: AIProvider;
    apiKey?: string;
}): Promise<BotResponse> {
    const {
        conversationId,
        customerId,
        message,
        channelType,
        referralData,
        isFirstMessage,
        aiProvider = 'deepseek',
        apiKey = '',
    } = params;

    try {
        // Step 0a: Auto-classify client based on message content
        autoClassifyClient(customerId, message, conversationId).catch(
            (err: Error) => console.warn('[Auto-classify error]', err.message)
        );

        // Step 0: Get customer WC purchase context for personalization
        // This uses ACTUAL WC order history, not synthetic data
        let wcContext = null;
        try {
            const customer = await db.query(
                `SELECT email FROM customers WHERE id = $1`,
                [customerId]
            ).catch(() => ({ rows: [] }));

            if (customer.rows.length > 0) {
                wcContext = await buildCustomerWCContext(customer.rows[0].email);
            }
        } catch (err) {
            console.warn('[WC Context Load] Failed, continuing without context', err);
        }

        // Step 1: First message from ad? Try campaign response
        // NOTE: generateCampaignResponse already inserts its welcome message via sendCampaignAutoReply.
        // We only return the qualification question here — handleBotResponse will insert it once.
        if (isFirstMessage && referralData) {
            const campaignReply = await generateCampaignResponse(referralData, customerId, conversationId);
            if (campaignReply) {
                // Campaign auto-reply already sent. Now start qualification flow.
                const qualReply = await runQualificationFlow(conversationId, customerId, message);
                return qualReply;
            }
        }

        // Step 1b: First message - use WC context greeting if available
        if (isFirstMessage && wcContext && wcContext.greeting_context) {
            // Store context in conversation for later use
            await db.query(
                `UPDATE conversation_state
                 SET purchase_context = $1, reorder_candidate = $2
                 WHERE conversation_id = $3`,
                [JSON.stringify(wcContext), wcContext.is_reorder_candidate, conversationId]
            ).catch(() => null);

            return {
                message: wcContext.greeting_context,
                confidence: 0.95,
                intent_type: wcContext.is_reorder_candidate ? 'REORDER' : 'QUALIFICATION',
                action_type: 'reply',
            };
        }

        // Step 2: Check conversation state
        const convState = await db.query(
            `SELECT bot_mode, qualification_step, bot_interaction_count FROM conversations WHERE id = $1`,
            [conversationId]
        );

        const conv = convState.rows[0];
        const botMode = conv?.bot_mode || 'idle';
        const qualStep = conv?.qualification_step;
        const botIntCount = conv?.bot_interaction_count || 0;

        // Step 3: Continue qualification if in progress
        if (botMode === 'qualification' && qualStep) {
            return await runQualificationFlow(conversationId, customerId, message, qualStep);
        }

        // Step 4: Classify intent
        const intent = await classifyIntent(message, []);

        // Step 5: Route based on intent
        const routing = await routeConversation(intent, conversationId, customerId);

        // Step 6: Generate response based on routing
        if (routing.should_escalate) {
            // Record escalation
            await db.query(
                `INSERT INTO bot_interactions
                 (conversation_id, customer_id, interaction_type, intent_classification, confidence, action_taken)
                 VALUES ($1, $2, 'routing', $3, $4, 'escalate')`,
                [conversationId, customerId, intent.intent, intent.confidence]
            );

            return {
                message: `Entendido. Voy a conectarte con un ${routing.target_type === 'sales_agent' ? 'especialista en ventas' : routing.target_type === 'senior_agent' ? 'supervisor' : 'asesor'}. Por favor espera un momento.`,
                confidence: intent.confidence,
                intent_type: intent.intent,
                action_type: 'escalate',
                routing_decision: routing,
            };
        }

        // Step 7: Handle different intent types
        if (intent.intent === 'MEDICAL_INQUIRY') {
            // Try product catalog first for specific product questions
            const matchedProducts = await findMatchingProducts(message);
            if (matchedProducts.length > 0) {
                const clientInfo = await getClientClassification(customerId);
                const response = buildProductResponse(matchedProducts, clientInfo.classification);
                return {
                    message: response,
                    confidence: 0.9,
                    intent_type: 'MEDICAL_INQUIRY',
                    action_type: 'reply',
                };
            }
            // Fall back to medical advisory RAG
            return await generateMedicalAdvisory(message, customerId, conversationId, aiProvider, apiKey);
        }

        if (intent.intent === 'QUALIFICATION') {
            return await runQualificationFlow(conversationId, customerId, message);
        }

        // Gap #5: Handle REORDER intent
        if (intent.intent === 'REORDER') {
            if (wcContext && wcContext.cross_sell_opportunities && wcContext.cross_sell_opportunities.length > 0) {
                const suggestions = wcContext.cross_sell_opportunities.join(', ');
                return {
                    message: `¡Excelente! Puedo ayudarte a reordenar. También te recomendamos: ${suggestions}. ¿Con cuál producto te gustaría comenzar? Nuestro asesor te preparará un carrito con link de pago.`,
                    confidence: 0.9,
                    intent_type: 'REORDER',
                    action_type: 'reply',
                };
            }
            return {
                message: '¡Claro! ¿Qué producto te gustaría comprar? Un asesor te preparará un carrito personalizado con link de pago directo.',
                confidence: 0.85,
                intent_type: 'REORDER',
                action_type: 'reply',
            };
        }

        // Handle ORDER_CREATE — guide customer to place an order
        if (intent.intent === 'ORDER_CREATE') {
            // Try to match a product from the message
            const orderProducts = await findMatchingProducts(message);
            const clientInfo = await getClientClassification(customerId);

            // Check if the message contains order-ready data (email, quantity)
            const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w+/);
            const qtyMatch = message.match(/(\d+)\s*(cajas?|piezas?|unidades?|paquetes?)/i);
            const phoneMatch = message.match(/\b\d{10,13}\b/);

            // If we have a product + email (minimal data to create order)
            if (orderProducts.length > 0 && emailMatch) {
                const p = orderProducts[0];
                const quantity = qtyMatch ? parseInt(qtyMatch[1]) : 1;

                if (p.wc_product_id) {
                    try {
                        const unitPrice = clientInfo.classification === 'laboratorio' && p.precio_laboratorio
                            ? p.precio_laboratorio
                            : p.precio_publico || undefined;

                        const orderResult = await createOrderFromBot({
                            items: [{
                                productId: p.id,
                                wcProductId: p.wc_product_id,
                                quantity,
                                unitPrice: unitPrice ?? undefined,
                            }],
                            customer: {
                                email: emailMatch[0],
                                phone: phoneMatch ? phoneMatch[0] : undefined,
                                name: '', // Will be filled by WC checkout
                            },
                            agentId: undefined,
                            conversationId: conversationId || undefined,
                            campaignId: undefined,
                        });

                        if (orderResult.success) {
                            return {
                                message: `¡Orden creada exitosamente!\n\nOrden #${orderResult.wcOrderId}\nProducto: ${p.name}\nCantidad: ${quantity}\nTotal: $${orderResult.total} MXN\n\nPuede completar su pago en nuestra tienda en línea. ¿Necesita algo más?`,
                                confidence: 0.95,
                                intent_type: 'ORDER_CREATE',
                                action_type: 'reply',
                            };
                        } else {
                            // Fall back to cart link
                            const cartLink = generateWCCartLink({
                                productIds: [{ wcProductId: p.wc_product_id, quantity }],
                                agentId: '',
                            });
                            return {
                                message: `No pude crear la orden automáticamente, pero aquí tiene un link directo para su compra:\n\n${cartLink}\n\nProducto: ${p.name} x${quantity}\n\n¿Necesita ayuda con algo más?`,
                                confidence: 0.85,
                                intent_type: 'ORDER_CREATE',
                                action_type: 'reply',
                            };
                        }
                    } catch (err) {
                        console.error('[ORDER_CREATE auto-create error]', err);
                    }
                }
            }

            // If we have a product but no email yet — ask for data
            if (orderProducts.length > 0) {
                const p = orderProducts[0];
                const price = clientInfo.classification === 'laboratorio' && p.precio_laboratorio
                    ? `$${p.precio_laboratorio} (precio laboratorio)`
                    : p.precio_publico
                        ? `$${p.precio_publico}`
                        : 'disponible en nuestra tienda';

                // If product has WC ID, also offer cart link
                const cartLinkNote = p.wc_product_id
                    ? `\n\nTambién puede comprar directamente aquí:\n${generateWCCartLink({ productIds: [{ wcProductId: p.wc_product_id, quantity: 1 }], agentId: '' })}`
                    : '';

                return {
                    message: `¡Perfecto! Para la ${p.name} (${price}), necesito los siguientes datos para crear su pedido:\n\n1. Nombre completo\n2. Email\n3. Teléfono\n4. Cantidad de cajas\n\nO si prefiere, un asesor puede preparar un carrito personalizado con link de pago directo.${cartLinkNote}`,
                    confidence: 0.9,
                    intent_type: 'ORDER_CREATE',
                    action_type: 'reply',
                };
            }

            return {
                message: '¡Con gusto le ayudo a hacer un pedido! ¿Qué producto le interesa? Puedo mostrarle nuestro catálogo de pruebas rápidas con precios y disponibilidad. También puede decirme el nombre del producto directamente.',
                confidence: 0.85,
                intent_type: 'ORDER_CREATE',
                action_type: 'reply',
            };
        }

        // Gap #9 & #6: Handle ORDER_TRACKING and ORDER_STATUS
        if (intent.intent === 'ORDER_TRACKING' || intent.intent === 'ORDER_STATUS') {
            // Extract order number from message
            const orderMatch = message.match(/#?(\d+)/);
            if (orderMatch && orderMatch[1]) {
                try {
                    const kanbanState = await getOrderWithKanbanState(orderMatch[1]);
                    const statusMap: Record<string, string> = {
                        'Esperando Pago': 'en espera de pago',
                        'En Preparación': 'en preparación para envío',
                        'Enviado': 'ha sido enviado',
                        'Entregado': 'ha sido entregado',
                        'Cancelado': 'ha sido cancelado',
                    };

                    const status = statusMap[kanbanState.kanban_column] || kanbanState.kanban_column.toLowerCase();
                    return {
                        message: `Tu pedido #${orderMatch[1]} ${status}. ${
                            kanbanState.last_moved_at
                                ? `Último actualizado: ${new Date(kanbanState.last_moved_at).toLocaleDateString('es-MX')}.`
                                : ''
                        } ¿Hay algo más en lo que pueda ayudarte?`,
                        confidence: 0.9,
                        intent_type: 'ORDER_TRACKING',
                        action_type: 'reply',
                    };
                } catch (err) {
                    console.warn('[Order Tracking Error]', err);
                }
            }

            return {
                message: 'Para consultar el estado de tu pedido, necesito el número del pedido. ¿Puedes proporcionar el número?',
                confidence: 0.7,
                intent_type: 'ORDER_TRACKING',
                action_type: 'reply',
            };
        }

        // Handle PRICE_REQUEST - search product catalog and show pricing
        if (intent.intent === 'PRICE_REQUEST') {
            const matchedProducts = await findMatchingProducts(message);
            const clientInfo = await getClientClassification(customerId);

            if (matchedProducts.length > 0) {
                const response = buildProductResponse(matchedProducts, clientInfo.classification);
                return {
                    message: response,
                    confidence: 0.9,
                    intent_type: 'PRICE_REQUEST',
                    action_type: 'reply',
                };
            }

            // No specific product match — list categories
            const categories = await db.query(
                `SELECT diagnostic_category, COUNT(*) AS cnt
                 FROM medical_products WHERE is_active = TRUE
                 GROUP BY diagnostic_category ORDER BY cnt DESC`
            );
            const catList = categories.rows.map((c: any) => c.diagnostic_category).join(', ');

            return {
                message: `Con gusto te doy información de precios. ¿Qué producto te interesa? Tenemos pruebas en las categorías: ${catList}. Si necesitas una cotización formal, un asesor te generará un carrito con precios personalizados y link de pago.`,
                confidence: 0.85,
                intent_type: 'PRICE_REQUEST',
                action_type: 'reply',
            };
        }

        // Gap #8: Handle DISCOUNT_REQUEST (escalate to agent)
        if (intent.intent === 'DISCOUNT_REQUEST') {
            return {
                message: 'Entiendo que necesitas un descuento. Voy a conectarte con un supervisor que puede ayudarte con eso. Por favor espera un momento.',
                confidence: 0.85,
                intent_type: 'DISCOUNT_REQUEST',
                action_type: 'escalate',
                routing_decision: {
                    should_escalate: true,
                    target_type: 'sales_agent',
                    reason: 'Solicitud de descuento requiere autorización de supervisor',
                    priority: 'high',
                },
            };
        }

        // Step 8: Try product search as last resort before generic response
        const lastResortProducts = await findMatchingProducts(message);
        if (lastResortProducts.length > 0) {
            const clientInfo = await getClientClassification(customerId);
            const response = buildProductResponse(lastResortProducts, clientInfo.classification);
            return {
                message: response,
                confidence: 0.85,
                intent_type: 'PRICE_REQUEST',
                action_type: 'reply',
            };
        }

        // Default: ask for clarification
        return {
            message: '¿Puedo ayudarte con información sobre nuestras pruebas de diagnóstico? O si prefieres, puedo conectarte con un asesor.',
            confidence: 0.7,
            intent_type: 'QUALIFICATION',
            action_type: 'reply',
        };
    } catch (err) {
        console.error('[Smart Bot Engine Error]', err);
        return {
            message: 'Disculpe, hubo un error procesando su mensaje. Un asesor lo contactará en breve.',
            confidence: 0.0,
            intent_type: 'HUMAN_NEEDED',
            action_type: 'escalate',
        };
    }
}

// ─────────────────────────────────────────────
// PRODUCT Q&A: Find matching products and respond
// ─────────────────────────────────────────────

interface ProductMatch {
    id: number;
    name: string;
    diagnostic_category: string;
    precio_publico: number | null;
    precio_laboratorio: number | null;
    result_time: string | null;
    sensitivity: string | null;
    specificity: string | null;
    sample_type: string | null;
    analito: string | null;
    pitch_venta: string | null;
    ventaja_competitiva: string | null;
    clinical_indications: string[];
    storage_conditions: string | null;
    interpretation_guide: string | null;
    target_audience: string;
}

async function findMatchingProducts(message: string): Promise<ProductMatch[]> {
    const lowerMsg = message.toLowerCase();

    // Search by name, analito, keywords, and clinical indications
    const result = await db.query(
        `SELECT id, name, diagnostic_category, precio_publico, precio_laboratorio,
                result_time, sensitivity, specificity, sample_type, analito,
                pitch_venta, ventaja_competitiva, clinical_indications,
                storage_conditions, interpretation_guide, target_audience,
                palabras_clave
         FROM medical_products
         WHERE is_active = TRUE
         ORDER BY name`
    );

    // Score each product against the message
    const scored = result.rows.map((p: any) => {
        let score = 0;
        const nameLower = (p.name || '').toLowerCase();
        const analitoLower = (p.analito || '').toLowerCase();
        const keywords = (p.palabras_clave || []) as string[];
        const indications = (p.clinical_indications || []) as string[];

        // Name match (strongest)
        if (lowerMsg.includes(nameLower) || nameLower.includes(lowerMsg)) score += 10;
        // Partial name words
        const nameWords = nameLower.split(/\s+/);
        for (const w of nameWords) {
            if (w.length > 3 && lowerMsg.includes(w)) score += 3;
        }
        // Analito match
        if (analitoLower && lowerMsg.includes(analitoLower)) score += 8;
        // Keyword match
        for (const kw of keywords) {
            if (lowerMsg.includes(kw.toLowerCase())) score += 5;
        }
        // Clinical indication match
        for (const ind of indications) {
            if (lowerMsg.includes(ind.toLowerCase())) score += 4;
        }
        // Category match
        if (lowerMsg.includes(p.diagnostic_category)) score += 2;

        return { ...p, score };
    });

    // Return top matches
    return scored
        .filter((p: any) => p.score > 0)
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 3);
}

async function getClientClassification(customerId: string): Promise<{
    classification: string;
    tone: string;
}> {
    try {
        const result = await db.query(
            `SELECT client_classification, preferred_language_tone
             FROM customer_profiles WHERE customer_id = $1`,
            [customerId]
        );
        if (result.rows.length > 0) {
            return {
                classification: result.rows[0].client_classification || 'desconocido',
                tone: result.rows[0].preferred_language_tone || 'formal',
            };
        }
    } catch { /* ignore */ }
    return { classification: 'desconocido', tone: 'formal' };
}

function buildProductResponse(products: ProductMatch[], classification: string): string {
    if (products.length === 0) {
        return 'No encontré un producto que coincida con tu consulta. ¿Podrías ser más específico? Tenemos pruebas rápidas en las categorías: Cardiología, Infecciosas, ETS, Metabolicas, Drogas, Embarazo y Respiratorias.';
    }

    const isLab = classification === 'laboratorio';
    const isDoc = classification === 'medico';

    const lines: string[] = [];

    for (const p of products) {
        const parts: string[] = [`*${p.name}*`];

        // Price based on classification
        if (isLab && p.precio_laboratorio) {
            parts.push(`Precio lab: $${p.precio_laboratorio}`);
        } else if (p.precio_publico) {
            parts.push(`Precio: $${p.precio_publico}`);
        }

        if (p.result_time) parts.push(`Resultado: ${p.result_time}`);
        if (p.sensitivity) parts.push(`Sensibilidad: ${p.sensitivity}%`);
        if (p.specificity) parts.push(`Especificidad: ${p.specificity}%`);
        if (p.sample_type) parts.push(`Muestra: ${p.sample_type.replace(/_/g, ' ')}`);

        // Different detail levels based on classification
        if (isLab) {
            if (p.storage_conditions) parts.push(`Almacenamiento: ${p.storage_conditions}`);
            if (p.ventaja_competitiva) parts.push(p.ventaja_competitiva);
        } else if (isDoc) {
            if (p.clinical_indications?.length > 0) parts.push(`Indicaciones: ${p.clinical_indications.join(', ')}`);
            if (p.pitch_venta) parts.push(p.pitch_venta);
        } else {
            if (p.pitch_venta) parts.push(p.pitch_venta);
        }

        lines.push(parts.join(' | '));
    }

    const greeting = isLab
        ? 'Con gusto le comparto la información técnica-comercial:'
        : isDoc
            ? 'Aquí tiene la información clínica del producto:'
            : 'Aquí está la información del producto:';

    const closing = products.length === 1
        ? '¿Le gustaría hacer un pedido o necesita más información?'
        : '¿Cuál le interesa más? Puedo darle información detallada o ayudarle a hacer un pedido.';

    return `${greeting}\n\n${lines.join('\n\n')}\n\n${closing}`;
}

// ─────────────────────────────────────────────
// AUTO-CLASSIFY: Detect client type from message
// ─────────────────────────────────────────────

async function autoClassifyClient(
    customerId: string,
    message: string,
    conversationId: string
): Promise<void> {
    const lowerMsg = message.toLowerCase();

    // Check if already classified with high confidence
    const existing = await db.query(
        `SELECT classification_confidence FROM customer_profiles WHERE customer_id = $1`,
        [customerId]
    ).catch(() => ({ rows: [] }));

    if (existing.rows.length > 0 && existing.rows[0].classification_confidence >= 0.8) {
        return; // Already classified with high confidence
    }

    // Keyword-based detection
    let classification = 'desconocido';
    let confidence = 0.0;

    const labKeywords = ['laboratorio', 'lab ', 'qfb', 'químico', 'volumen', 'mayoreo', 'distribuir', 'reactivos', 'lote'];
    const docKeywords = ['doctor', 'dr.', 'dra.', 'consultorio', 'paciente', 'clínica', 'hospital', 'médico', 'diagnóstico clínico', 'consultorio'];
    const farmKeywords = ['farmacia', 'farmacéutico', 'mostrador', 'punto de venta'];

    let labScore = 0;
    let docScore = 0;
    let farmScore = 0;

    for (const kw of labKeywords) { if (lowerMsg.includes(kw)) labScore++; }
    for (const kw of docKeywords) { if (lowerMsg.includes(kw)) docScore++; }
    for (const kw of farmKeywords) { if (lowerMsg.includes(kw)) farmScore++; }

    if (labScore > docScore && labScore > farmScore && labScore >= 1) {
        classification = 'laboratorio';
        confidence = Math.min(0.6 + labScore * 0.1, 0.9);
    } else if (docScore > labScore && docScore > farmScore && docScore >= 1) {
        classification = 'medico';
        confidence = Math.min(0.6 + docScore * 0.1, 0.9);
    } else if (farmScore >= 1) {
        classification = 'farmacia';
        confidence = Math.min(0.5 + farmScore * 0.1, 0.8);
    }

    if (confidence > 0.5) {
        const tone = classification === 'laboratorio' ? 'tecnico-comercial' : 'profesional';
        await db.query(
            `INSERT INTO customer_profiles (customer_id, client_classification, classification_confidence, classification_source, preferred_language_tone)
             VALUES ($1, $2, $3, 'ai_detected', $4)
             ON CONFLICT (customer_id) DO UPDATE SET
                 client_classification = CASE
                     WHEN customer_profiles.classification_confidence < $3 THEN $2
                     ELSE customer_profiles.client_classification
                 END,
                 classification_confidence = GREATEST(customer_profiles.classification_confidence, $3),
                 classification_source = CASE
                     WHEN customer_profiles.classification_source = 'manual' THEN customer_profiles.classification_source
                     ELSE 'ai_detected'
                 END,
                 preferred_language_tone = CASE
                     WHEN customer_profiles.classification_source = 'manual' THEN customer_profiles.preferred_language_tone
                     ELSE $4
                 END`,
            [customerId, classification, confidence, tone]
        );
    }
}

// ─────────────────────────────────────────────
// Helper: Generate AI Response (stub for now)
// ─────────────────────────────────────────────

async function generateAIResponse(
    userMessage: string,
    systemPrompt: string,
    provider: AIProvider,
    apiKey: string
): Promise<string> {
    // This would call the actual AI provider
    // For now, return a template response
    return `Basándome en tu pregunta sobre diagnóstico, te recomendamos consultar con un profesional de salud o conectarte con nuestro asesor especializado. ¿Te gustaría saber más sobre algún producto específico?`;
}
