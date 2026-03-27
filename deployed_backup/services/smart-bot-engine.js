"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCampaignResponse = generateCampaignResponse;
exports.runQualificationFlow = runQualificationFlow;
exports.generateMedicalAdvisory = generateMedicalAdvisory;
exports.classifyIntent = classifyIntent;
exports.routeConversation = routeConversation;
exports.handleIncomingMessage = handleIncomingMessage;
const db_1 = require("../db");
const ai_service_1 = require("../ai.service");
const recommendation_engine_1 = require("./recommendation-engine");
const campaign_responder_1 = require("./campaign-responder");
const medical_advisor_1 = require("../prompts/medical-advisor");
const qualification_flows_1 = require("../data/qualification-flows");
const wc_integration_engine_1 = require("./wc-integration-engine");
// ─────────────────────────────────────────────
// POINT 1: INSTANT CAMPAIGN RESPONSE
// ─────────────────────────────────────────────
async function generateCampaignResponse(referralData, customerId, conversationId) {
    if (!referralData || !referralData.ad_id) {
        return null;
    }
    try {
        const mapping = await (0, campaign_responder_1.findCampaignMapping)(referralData);
        if (!mapping)
            return null;
        // Send campaign auto-reply
        await (0, campaign_responder_1.sendCampaignAutoReply)(conversationId, '', customerId, mapping);
        // Record bot interaction
        await db_1.db.query(`INSERT INTO bot_interactions
             (conversation_id, customer_id, interaction_type, intent_classification, confidence, action_taken, result)
             VALUES ($1, $2, 'campaign_response', 'CAMPAIGN_RESPONSE', 1.0, 'send_campaign_auto_reply', $3)`, [conversationId, customerId, JSON.stringify({ campaign_id: mapping.campaign_id, product_name: mapping.product_name })]);
        // Update conversation to campaign_response mode
        await db_1.db.query(`UPDATE conversations SET bot_mode = 'campaign_response' WHERE id = $1`, [conversationId]);
        return {
            message: mapping.welcome_message,
            confidence: 1.0,
            intent_type: 'CAMPAIGN_RESPONSE',
            action_type: 'reply',
        };
    }
    catch (err) {
        console.error('[Campaign Response Error]', err);
        return null;
    }
}
// ─────────────────────────────────────────────
// POINT 2: AUTOMATIC LEAD QUALIFICATION
// ─────────────────────────────────────────────
async function runQualificationFlow(conversationId, customerId, message, currentStep) {
    try {
        // Get or initialize conversation state
        let state = await db_1.db.query(`SELECT * FROM conversation_state WHERE conversation_id = $1`, [conversationId]);
        let stepId = currentStep;
        if (!stepId) {
            // Initialize flow
            const firstStep = (0, qualification_flows_1.getFirstQualificationStep)('campaign_lead');
            stepId = firstStep?.id;
            if (!stepId) {
                return {
                    message: 'Error al inicializar flujo de calificación. Por favor intente después.',
                    confidence: 0.0,
                    intent_type: 'HUMAN_NEEDED',
                    action_type: 'escalate',
                };
            }
            await db_1.db.query(`INSERT INTO conversation_state (conversation_id, current_step, step_data)
                 VALUES ($1, $2, '{}')
                 ON CONFLICT (conversation_id) DO UPDATE
                   SET current_step = EXCLUDED.current_step`, [conversationId, stepId]);
        }
        // Get current step
        const currentStepObj = (0, qualification_flows_1.getQualificationStepById)('campaign_lead', stepId || '');
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
        const qualData = {};
        qualData[currentStepObj.id] = message;
        // Update conversation state
        const nextStepId = matched ? currentStepObj.next_step : currentStepObj.alternative_step || 'complete';
        await db_1.db.query(`UPDATE conversation_state
             SET current_step = $1, step_data = step_data || $2
             WHERE conversation_id = $3`, [nextStepId, JSON.stringify(qualData), conversationId]);
        // If qualification is complete, calculate score
        let finalResponse = '';
        let isComplete = false;
        if (nextStepId === 'complete') {
            // Get all qualification data
            const stepData = await db_1.db.query(`SELECT step_data FROM conversation_state WHERE conversation_id = $1`, [conversationId]);
            const allAnswers = stepData.rows[0]?.step_data || {};
            const score = (0, qualification_flows_1.calculateQualificationScore)(allAnswers);
            // Store in customer profile
            await db_1.db.query(`INSERT INTO customer_profiles (customer_id, qualification_data, lead_score)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (customer_id) DO UPDATE
                   SET qualification_data = EXCLUDED.qualification_data,
                       lead_score = EXCLUDED.lead_score`, [customerId, JSON.stringify(allAnswers), score.total_score]);
            // Record lead score
            await db_1.db.query(`INSERT INTO lead_scores
                 (customer_id, conversation_id, professional_score, volume_score, engagement_score, total_score)
                 VALUES ($1, $2, $3, $4, $5, $6)`, [
                customerId,
                conversationId,
                score.professional_score,
                score.volume_score,
                score.engagement_score,
                score.total_score,
            ]);
            const routing = (0, qualification_flows_1.getRoutingRecommendation)(score);
            finalResponse = `Excelente. Hemos recopilado su información. Un especialista en ${routing.priority === 'hot' ? 'ventas' : 'soporte'} se comunicará con usted en breve.`;
            isComplete = true;
        }
        else {
            // Ask next question
            const nextStepObj = (0, qualification_flows_1.getQualificationStepById)('campaign_lead', nextStepId || '');
            finalResponse = nextStepObj?.question || 'Continuando con el siguiente paso...';
        }
        // Update conversation mode
        await db_1.db.query(`UPDATE conversations
             SET bot_mode = $1, qualification_step = $2, bot_interaction_count = bot_interaction_count + 1
             WHERE id = $3`, [isComplete ? 'human_handoff' : 'qualification', nextStepId, conversationId]);
        // Record interaction
        await db_1.db.query(`INSERT INTO bot_interactions
             (conversation_id, customer_id, interaction_type, intent_classification, confidence, action_taken)
             VALUES ($1, $2, 'qualification_q', 'QUALIFICATION', 0.95, $3)`, [conversationId, customerId, isComplete ? 'qualification_complete' : 'qualification_ask']);
        return {
            message: finalResponse,
            confidence: 0.95,
            intent_type: 'QUALIFICATION',
            action_type: isComplete ? 'escalate' : 'continue_qualification',
        };
    }
    catch (err) {
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
async function generateMedicalAdvisory(message, customerId, conversationId, aiProvider, apiKey) {
    try {
        // Get customer profile to determine audience type
        const profile = await (0, recommendation_engine_1.getCustomerProfile)(customerId);
        const audienceType = profile?.business_type === 'laboratorio' ? 'laboratorio' : 'medico';
        // Generate embedding for semantic search
        const embedding = await (0, ai_service_1.generateEmbedding)(message, aiProvider, apiKey);
        // Find relevant medical knowledge (RAG) — audience-aware, with keyword fallback
        const { context: medicalContext, products: matchedProducts, hasGap } = await (0, ai_service_1.findMedicalContext)(embedding, 3, audienceType, message);
        // Track knowledge gap if nothing matched
        if (hasGap) {
            await trackKnowledgeGap(message, customerId, conversationId);
        }
        // Get AI recommendations
        const recommendations = await (0, recommendation_engine_1.getRecommendations)(message, customerId, aiProvider, apiKey);
        // Load prompt_additions from AI settings (UI-configured extra rules)
        let promptAdditions = null;
        try {
            const paResult = await db_1.db.query(`SELECT prompt_additions FROM ai_settings WHERE is_default = TRUE LIMIT 1`);
            if (paResult.rows.length > 0) {
                promptAdditions = paResult.rows[0].prompt_additions || null;
            }
        }
        catch { /* ignore — column may not exist yet */ }
        // Build system prompt with context — now audience-aware
        const systemPrompt = (0, medical_advisor_1.buildMedicalPrompt)({
            customerProfile: profile,
            recommendations,
            knowledgeContext: medicalContext || undefined,
            promptAdditions,
        });
        // Call AI service
        const response = await generateAIResponse(message, systemPrompt, aiProvider, apiKey);
        // Record interaction
        await db_1.db.query(`INSERT INTO bot_interactions
             (conversation_id, customer_id, interaction_type, intent_classification, confidence, action_taken, result)
             VALUES ($1, $2, 'medical_advisory', 'MEDICAL_INQUIRY', $3, 'generate_advisory', $4)`, [
            conversationId,
            customerId,
            hasGap ? 0.4 : 0.88,
            JSON.stringify({
                recommendations_count: recommendations.length,
                context_used: !!medicalContext,
                audience_type: audienceType,
                matched_products: matchedProducts.map((p) => p.name),
                knowledge_gap: hasGap,
            }),
        ]);
        return {
            message: response,
            confidence: hasGap ? 0.4 : 0.88,
            intent_type: 'MEDICAL_INQUIRY',
            action_type: 'reply',
        };
    }
    catch (err) {
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
// Knowledge Gap Tracking
// ─────────────────────────────────────────────
async function trackKnowledgeGap(question, customerId, conversationId) {
    try {
        // Check if a similar question already exists (exact match or close)
        const existing = await db_1.db.query(`SELECT id, frequency FROM knowledge_gaps WHERE question = $1 AND status != 'resolved'`, [question]);
        if (existing.rows.length > 0) {
            // Increment frequency
            await db_1.db.query(`UPDATE knowledge_gaps SET frequency = frequency + 1, updated_at = NOW() WHERE id = $1`, [existing.rows[0].id]);
        }
        else {
            // Create new gap
            await db_1.db.query(`INSERT INTO knowledge_gaps (question, customer_id, conversation_id, status)
                 VALUES ($1, $2, $3, 'pending')`, [question, customerId, conversationId]);
        }
        console.log(`[Knowledge Gap] Tracked: "${question.substring(0, 80)}..."`);
    }
    catch (err) {
        console.error('[Knowledge Gap] Error tracking:', err);
    }
}
// ─────────────────────────────────────────────
// POINT 4: SMART ROUTING
// ─────────────────────────────────────────────
async function classifyIntent(message, conversationHistory) {
    const lowerMsg = message.toLowerCase();
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
                'prueba',
                'test',
                'médico',
                'paciente',
                'recomienda',
                'infarto',
                'cardíaco',
                'cardiólogo',
                'dolor de pecho',
                'troponina',
                'dímero',
                'hba1c',
                'diabetes',
                'covid',
                'influenza',
                'strep',
                'mycoplasma',
                'neumococo',
                'embarazo',
                'antígeno',
                'anticuerpo',
                'ets',
                'vih',
                'sífilis',
                'hepatitis',
                'perfil',
                'laboratorio',
                'consultorio',
                'descartar',
                'detectar',
                'tamizaje',
                'bnp',
                'procalcitonina',
                'pcr',
                'análisis',
                'marcador',
            ],
            weight: 0.8,
        },
        DISTRIBUTION_INQUIRY: {
            keywords: [
                'distribuidor', 'distribuidora', 'distribuir', 'comercializar',
                'representante comercial', 'socio comercial', 'alianza comercial',
                'importar', 'exportar', 'otro país', 'otro pais', 'internacional',
                'licencia', 'registro sanitario', 'franquicia',
            ],
            weight: 0.95,
        },
        HUMAN_NEEDED: {
            keywords: ['hablar con alguien', 'agente humano', 'persona real', 'representante', 'asesor'],
            weight: 1.0,
        },
    };
    // Score each intent
    const scores = {};
    for (const [intent, pattern] of Object.entries(intentPatterns)) {
        let matchCount = 0;
        const matched = [];
        for (const keyword of pattern.keywords) {
            if (lowerMsg.includes(keyword)) {
                matchCount++;
                matched.push(keyword);
            }
        }
        // Use match-count-based scoring: 1 match = 0.65, 2+ matches = 0.8+
        // This prevents large keyword lists from diluting confidence
        let score = 0;
        if (matchCount > 0) {
            score = Math.min((0.5 + matchCount * 0.15) * pattern.weight, 1.0);
        }
        scores[intent] = {
            score,
            matched,
        };
    }
    // Find best match
    let bestIntent = 'QUALIFICATION';
    let bestScore = 0;
    let bestMatched = [];
    for (const [intent, data] of Object.entries(scores)) {
        if (data.score > bestScore) {
            bestScore = data.score;
            bestIntent = intent;
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
async function routeConversation(classification, conversationId, customerId) {
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
            return {
                should_escalate: false,
                target_type: 'bot',
                reason: 'Bot puede procesar reorden desde historial',
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
        case 'DISTRIBUTION_INQUIRY':
            return {
                should_escalate: true,
                target_type: 'senior_agent',
                reason: 'Consulta de distribución/alianza comercial — lead de alto valor',
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
// DB ESCALATION MESSAGE LOOKUP
// Checks if there's a UI-configured escalation_message
// for a given intent/condition_type. Falls back to null.
// ─────────────────────────────────────────────
const INTENT_TO_CONDITION_MAP = {
    DISCOUNT_REQUEST: 'discount_request',
    DISTRIBUTION_INQUIRY: 'distribution_inquiry',
    COMPLAINT: 'complaint',
    HUMAN_NEEDED: 'explicit_request',
    PURCHASE_INTENT: 'purchase_intent',
    REORDER: 'reorder',
    PRICE_REQUEST: 'price_request',
};
async function getEscalationMessageForIntent(intentType) {
    try {
        const conditionType = INTENT_TO_CONDITION_MAP[intentType];
        if (!conditionType)
            return null;
        const result = await db_1.db.query(`SELECT escalation_message FROM escalation_rules
             WHERE condition_type = $1 AND is_active = TRUE AND escalation_message IS NOT NULL
             ORDER BY priority DESC LIMIT 1`, [conditionType]);
        return result.rows.length > 0 ? result.rows[0].escalation_message : null;
    }
    catch {
        return null;
    }
}
// ─────────────────────────────────────────────
// CONTEXTUAL ESCALATION MESSAGES
// Instead of generic "espera un momento", give the client
// useful info and pass context to the agent via routing.
// Uses DB-configured message if available, else hardcoded fallback.
// ─────────────────────────────────────────────
function buildContextualEscalationMessage(intent, routing, originalMessage, dbEscalationMessage) {
    const agentType = routing.target_type === 'sales_agent'
        ? 'especialista en ventas'
        : routing.target_type === 'senior_agent'
            ? 'ejecutivo comercial'
            : 'asesor';
    // If a DB-configured escalation message exists, use it (replace {agent_type} placeholder)
    if (dbEscalationMessage) {
        return dbEscalationMessage.replace(/\{agent_type\}/g, agentType);
    }
    // Fallback: hardcoded messages per intent (legacy — migrate these to DB rules)
    switch (intent.intent) {
        case 'DISCOUNT_REQUEST':
            return `Entiendo que te interesa un precio especial. Voy a conectarte con un ${agentType} que puede revisar opciones de descuento según el volumen que manejes. Mientras tanto, te comento que manejamos precios escalonados por volumen en todas nuestras líneas de producto.`;
        case 'DISTRIBUTION_INQUIRY':
            return `¡Excelente! Nos da gusto tu interés en ser parte de nuestra red de distribuidores. Voy a conectarte con un ${agentType} de nuestro equipo de alianzas comerciales que podrá darte toda la información sobre el programa de distribuidores, requisitos y condiciones. Para agilizar el proceso, ¿podrías compartirnos tu nombre completo, empresa y país?`;
        case 'COMPLAINT':
            return `Lamento escuchar que tienes una situación que resolver. Voy a conectarte de inmediato con un ${agentType} para atenderte. Tu caso tiene prioridad.`;
        case 'HUMAN_NEEDED':
            return `Por supuesto, voy a conectarte con un ${agentType}. En un momento te atiende.`;
        default:
            return `Voy a conectarte con un ${agentType} que podrá ayudarte mejor con tu consulta. En un momento te atiende.`;
    }
}
// ─────────────────────────────────────────────
// MAIN ENTRY POINT
// ─────────────────────────────────────────────
async function handleIncomingMessage(params) {
    const { conversationId, customerId, message, channelType, referralData, isFirstMessage, aiProvider = 'deepseek', apiKey = '', } = params;
    try {
        // Step 0: Get customer WC purchase context for personalization
        // This uses ACTUAL WC order history, not synthetic data
        let wcContext = null;
        try {
            const customer = await db_1.db.query(`SELECT email FROM customers WHERE id = $1`, [customerId]).catch(() => ({ rows: [] }));
            if (customer.rows.length > 0) {
                wcContext = await (0, wc_integration_engine_1.buildCustomerWCContext)(customer.rows[0].email);
            }
        }
        catch (err) {
            console.warn('[WC Context Load] Failed, continuing without context', err);
        }
        // Step 1: First message from ad? Try campaign response
        if (isFirstMessage && referralData) {
            const campaignReply = await generateCampaignResponse(referralData, customerId, conversationId);
            if (campaignReply) {
                // After campaign response, continue with qualification
                const qualReply = await runQualificationFlow(conversationId, customerId, message);
                return qualReply;
            }
        }
        // Step 1b: First message - use WC context greeting if available
        if (isFirstMessage && wcContext && wcContext.greeting_context) {
            // Store context in conversation for later use
            await db_1.db.query(`UPDATE conversation_state
                 SET purchase_context = $1, reorder_candidate = $2
                 WHERE conversation_id = $3`, [JSON.stringify(wcContext), wcContext.is_reorder_candidate, conversationId]).catch(() => null);
            return {
                message: wcContext.greeting_context,
                confidence: 0.95,
                intent_type: wcContext.is_reorder_candidate ? 'REORDER' : 'QUALIFICATION',
                action_type: 'reply',
            };
        }
        // Step 2: Check conversation state
        const convState = await db_1.db.query(`SELECT bot_mode, qualification_step, bot_interaction_count FROM conversations WHERE id = $1`, [conversationId]);
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
            await db_1.db.query(`INSERT INTO bot_interactions
                 (conversation_id, customer_id, interaction_type, intent_classification, confidence, action_taken)
                 VALUES ($1, $2, 'routing', $3, $4, 'escalate')`, [conversationId, customerId, intent.intent, intent.confidence]);
            // Look for a DB-configured escalation message for this intent
            const dbMsg = await getEscalationMessageForIntent(intent.intent);
            // Build contextual escalation message — uses DB message if available, else hardcoded fallback
            const escalationMsg = buildContextualEscalationMessage(intent, routing, message, dbMsg);
            return {
                message: escalationMsg,
                confidence: intent.confidence,
                intent_type: intent.intent,
                action_type: 'escalate',
                routing_decision: routing,
            };
        }
        // Step 7: Handle different intent types
        if (intent.intent === 'MEDICAL_INQUIRY') {
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
        // Gap #9 & #6: Handle ORDER_TRACKING and ORDER_STATUS
        if (intent.intent === 'ORDER_TRACKING' || intent.intent === 'ORDER_STATUS') {
            // Extract order number from message
            const orderMatch = message.match(/#?(\d+)/);
            if (orderMatch && orderMatch[1]) {
                try {
                    const kanbanState = await (0, wc_integration_engine_1.getOrderWithKanbanState)(orderMatch[1]);
                    const statusMap = {
                        'Esperando Pago': 'en espera de pago',
                        'En Preparación': 'en preparación para envío',
                        'Enviado': 'ha sido enviado',
                        'Entregado': 'ha sido entregado',
                        'Cancelado': 'ha sido cancelado',
                    };
                    const status = statusMap[kanbanState.kanban_column] || kanbanState.kanban_column.toLowerCase();
                    return {
                        message: `Tu pedido #${orderMatch[1]} ${status}. ${kanbanState.last_moved_at
                            ? `Último actualizado: ${new Date(kanbanState.last_moved_at).toLocaleDateString('es-MX')}.`
                            : ''} ¿Hay algo más en lo que pueda ayudarte?`,
                        confidence: 0.9,
                        intent_type: 'ORDER_TRACKING',
                        action_type: 'reply',
                    };
                }
                catch (err) {
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
        // Handle PRICE_REQUEST - show catalog pricing, offer to connect with agent for quote
        if (intent.intent === 'PRICE_REQUEST') {
            return {
                message: 'Con gusto te doy información de precios. ¿Qué producto te interesa? Tenemos pruebas rápidas de HbA1c, Embarazo, Antidoping, Influenza, COVID-19, VIH, Sífilis, Hepatitis B, Vitamina D, RSV y Panel Respiratorio. Si necesitas una cotización formal, un asesor te generará un carrito con precios personalizados y link de pago.',
                confidence: 0.85,
                intent_type: 'PRICE_REQUEST',
                action_type: 'reply',
            };
        }
        // Gap #8: Handle DISCOUNT_REQUEST (escalate to agent with context)
        if (intent.intent === 'DISCOUNT_REQUEST') {
            const discountDbMsg = await getEscalationMessageForIntent('DISCOUNT_REQUEST');
            const discountRouting = {
                should_escalate: true,
                target_type: 'sales_agent',
                reason: `Solicitud de descuento — mensaje original: "${message.substring(0, 120)}"`,
                priority: 'high',
            };
            return {
                message: buildContextualEscalationMessage(intent, discountRouting, message, discountDbMsg),
                confidence: 0.85,
                intent_type: 'DISCOUNT_REQUEST',
                action_type: 'escalate',
                routing_decision: discountRouting,
            };
        }
        // Handle DISTRIBUTION_INQUIRY (high-value B2B lead — escalate with priority)
        if (intent.intent === 'DISTRIBUTION_INQUIRY') {
            const distDbMsg = await getEscalationMessageForIntent('DISTRIBUTION_INQUIRY');
            const distRouting = {
                should_escalate: true,
                target_type: 'senior_agent',
                reason: `Consulta de distribución/alianza comercial — mensaje: "${message.substring(0, 120)}"`,
                priority: 'critical',
            };
            return {
                message: buildContextualEscalationMessage(intent, distRouting, message, distDbMsg),
                confidence: 0.9,
                intent_type: 'DISTRIBUTION_INQUIRY',
                action_type: 'escalate',
                routing_decision: distRouting,
            };
        }
        // Default: ask for clarification
        return {
            message: '¿Puedo ayudarte con información sobre nuestras pruebas de diagnóstico? O si prefieres, puedo conectarte con un asesor.',
            confidence: 0.7,
            intent_type: 'QUALIFICATION',
            action_type: 'reply',
        };
    }
    catch (err) {
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
// Helper: Generate AI Response (real API calls)
// ─────────────────────────────────────────────
async function generateAIResponse(userMessage, systemPrompt, provider, apiKey) {
    try {
        if (provider === 'deepseek') {
            const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userMessage }
                    ],
                    temperature: 0.7,
                    max_tokens: 300,
                }),
            });
            if (!resp.ok) {
                const errText = await resp.text();
                console.error(`[AI DeepSeek] Error ${resp.status}: ${errText.substring(0, 200)}`);
                throw new Error(`DeepSeek API error: ${resp.status}`);
            }
            const data = await resp.json();
            return data.choices?.[0]?.message?.content || 'No pude generar una respuesta.';
        }
        if (provider === 'z_ai') {
            const resp = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: 'glm-4-flash',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userMessage }
                    ],
                    temperature: 0.7,
                    max_tokens: 300,
                }),
            });
            if (!resp.ok) {
                const errText = await resp.text();
                console.error(`[AI Z.ai] Error ${resp.status}: ${errText.substring(0, 200)}`);
                throw new Error(`Z.ai API error: ${resp.status}`);
            }
            const data = await resp.json();
            return data.choices?.[0]?.message?.content || 'No pude generar una respuesta.';
        }
        // Fallback for other providers
        console.warn(`[AI] Provider ${provider} not implemented, using template`);
        return `Gracias por tu consulta. Te recomendamos contactar a un asesor especializado para más información sobre nuestras pruebas de diagnóstico.`;
    }
    catch (err) {
        console.error(`[AI Response Error] ${err.message}`);
        throw err;
    }
}
