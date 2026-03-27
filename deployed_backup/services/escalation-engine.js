"use strict";
/**
 * Escalation Engine
 *
 * Evaluates incoming messages against escalation rules and decides
 * whether to transfer the conversation from bot to a human agent.
 *
 * Rule types:
 * - keyword_match: Message contains specific keywords
 * - sentiment_negative: AI-detected negative sentiment
 * - purchase_intent: Customer wants to buy
 * - discount_request: Customer asks for discount/pricing
 * - vip_customer: High-value customer based on lifetime spend
 * - complaint: Customer has a complaint
 * - technical_question: Question beyond bot's knowledge
 * - order_issue: Problem with an existing order
 * - explicit_request: Customer explicitly asks for a human
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateEscalation = evaluateEscalation;
exports.generateHandoffSummary = generateHandoffSummary;
exports.executeHandoff = executeHandoff;
const db_1 = require("../db");
const ai_service_1 = require("../ai.service");
const recommendation_engine_1 = require("./recommendation-engine");
// ─────────────────────────────────────────────
// Keyword sets for built-in detection
// ─────────────────────────────────────────────
const HUMAN_REQUEST_KEYWORDS = [
    'hablar con alguien', 'agente humano', 'persona real', 'representante',
    'quiero hablar con', 'transfiere', 'operador', 'talk to a human',
    'asesor', 'ejecutivo',
];
const PURCHASE_INTENT_KEYWORDS = [
    'quiero comprar', 'cotización', 'cotizacion', 'pedido', 'ordenar',
    'precio', 'cuánto cuesta', 'cuanto cuesta', 'costo', 'factura',
    'comprar', 'adquirir', 'presupuesto', 'lista de precios',
];
const DISCOUNT_KEYWORDS = [
    'descuento', 'precio especial', 'oferta', 'promoción', 'promocion',
    'mayoreo', 'volumen', 'rebaja', 'negociar precio',
];
const COMPLAINT_KEYWORDS = [
    'queja', 'reclamo', 'problema con mi pedido', 'no llegó', 'no llego',
    'producto defectuoso', 'mal estado', 'devolución', 'devolucion',
    'insatisfecho', 'molesto', 'pésimo', 'pesimo', 'terrible',
];
const ORDER_ISSUE_KEYWORDS = [
    'mi pedido', 'mi orden', 'número de seguimiento', 'tracking',
    'no he recibido', 'cuándo llega', 'cuando llega', 'estado de mi pedido',
    'dónde está mi', 'donde esta mi',
];
// ─────────────────────────────────────────────
// Rule Evaluators
// ─────────────────────────────────────────────
function matchesKeywords(message, keywords) {
    const lower = message.toLowerCase();
    return keywords.some(kw => lower.includes(kw.toLowerCase()));
}
async function evaluateRule(rule, messageText, customerId, conversationId) {
    const config = rule.condition_config || {};
    const lower = messageText.toLowerCase();
    switch (rule.condition_type) {
        case 'keyword_match': {
            const keywords = config.keywords || [];
            return matchesKeywords(messageText, keywords);
        }
        case 'explicit_request':
            return matchesKeywords(messageText, HUMAN_REQUEST_KEYWORDS);
        case 'purchase_intent':
            return matchesKeywords(messageText, [
                ...PURCHASE_INTENT_KEYWORDS,
                ...(config.keywords || []),
            ]);
        case 'discount_request':
            return matchesKeywords(messageText, [
                ...DISCOUNT_KEYWORDS,
                ...(config.keywords || []),
            ]);
        case 'complaint':
            return matchesKeywords(messageText, [
                ...COMPLAINT_KEYWORDS,
                ...(config.keywords || []),
            ]);
        case 'order_issue':
            return matchesKeywords(messageText, [
                ...ORDER_ISSUE_KEYWORDS,
                ...(config.keywords || []),
            ]);
        case 'vip_customer': {
            const minSpend = config.min_lifetime_spend || 50000;
            const spend = await db_1.db.query(`SELECT COALESCE(SUM(total_amount), 0) AS lifetime_spend
                 FROM orders WHERE customer_id = $1 AND status NOT IN ('cancelled', 'refunded', 'failed')`, [customerId]);
            return parseFloat(spend.rows[0].lifetime_spend) >= minSpend;
        }
        case 'sentiment_negative': {
            // Check if last AI insight was negative
            const insight = await db_1.db.query(`SELECT last_sentiment FROM ai_insights
                 WHERE customer_id = $1 ORDER BY updated_at DESC LIMIT 1`, [customerId]);
            return insight.rows.length > 0 && insight.rows[0].last_sentiment === 'negative';
        }
        case 'technical_question': {
            // If the message contains medical/technical terms not in our knowledge base
            const technicalIndicators = [
                'protocolo', 'validación', 'calibración', 'control de calidad',
                'acreditación', 'norma', 'certificación', 'COFEPRIS',
                'FDA', 'lineamiento', 'guía clínica',
            ];
            return matchesKeywords(messageText, technicalIndicators);
        }
        default:
            return false;
    }
}
// ─────────────────────────────────────────────
// Main Evaluation
// ─────────────────────────────────────────────
/**
 * Evaluate all active escalation rules against a message.
 * Returns the first matching rule (highest priority wins).
 */
async function evaluateEscalation(messageText, customerId, conversationId) {
    // Always check explicit human request first (highest priority)
    if (matchesKeywords(messageText, HUMAN_REQUEST_KEYWORDS)) {
        return {
            shouldEscalate: true,
            reason: 'Cliente solicitó hablar con un humano',
            rule: {
                id: 0,
                name: 'Solicitud explícita de humano',
                condition_type: 'explicit_request',
                target_type: 'any_available',
                target_id: null,
                target_role: null,
                generate_summary: true,
                escalation_message: null,
            },
        };
    }
    // Load all active rules, ordered by priority
    const rules = await db_1.db.query(`SELECT * FROM escalation_rules WHERE is_active = TRUE ORDER BY priority DESC`);
    for (const rule of rules.rows) {
        const matched = await evaluateRule(rule, messageText, customerId, conversationId);
        if (matched) {
            return {
                shouldEscalate: true,
                rule: {
                    id: rule.id,
                    name: rule.name,
                    condition_type: rule.condition_type,
                    target_type: rule.target_type,
                    target_id: rule.target_id,
                    target_role: rule.target_role,
                    generate_summary: rule.generate_summary,
                    escalation_message: rule.escalation_message || null,
                },
                reason: `Regla "${rule.name}" activada (${rule.condition_type})`,
            };
        }
    }
    return { shouldEscalate: false, reason: '' };
}
// ─────────────────────────────────────────────
// Handoff Summary Generation
// ─────────────────────────────────────────────
/**
 * Generate an AI summary of the conversation for the receiving agent.
 */
async function generateHandoffSummary(conversationId, customerId, escalationReason, provider, apiKey) {
    // Get conversation messages
    const messages = await db_1.db.query(`SELECT direction, content, handled_by, bot_action, created_at
         FROM messages WHERE conversation_id = $1 AND content IS NOT NULL
         ORDER BY created_at ASC LIMIT 30`, [conversationId]);
    if (messages.rows.length === 0)
        return 'Sin mensajes previos.';
    // Get customer info
    const customer = await db_1.db.query(`SELECT c.display_name, cp.business_type, cp.specialty, cp.organization_name
         FROM customers c
         LEFT JOIN customer_profiles cp ON cp.customer_id = c.id
         WHERE c.id = $1`, [customerId]);
    // Get recent orders
    const orders = await db_1.db.query(`SELECT external_order_id, total_amount, status, items
         FROM orders WHERE customer_id = $1
         ORDER BY order_date DESC LIMIT 3`, [customerId]);
    const customerInfo = customer.rows[0] || {};
    const messageLog = messages.rows.map((m) => {
        const who = m.direction === 'inbound' ? 'Cliente' : (m.handled_by === 'bot' ? 'Bot' : 'Agente');
        return `${who}: ${m.content}`;
    }).join('\n');
    const summaryPrompt = `Genera un resumen BREVE (3-5 líneas) de esta conversación para un agente humano que va a tomar el control. Incluye:
1. Quién es el cliente y qué tipo de negocio tiene
2. Qué preguntó o necesita
3. Qué le recomendó el bot
4. Por qué se está transfiriendo
5. Siguiente paso sugerido

Cliente: ${customerInfo.display_name || 'Desconocido'}
Tipo de negocio: ${customerInfo.business_type || 'No identificado'}
Especialidad: ${customerInfo.specialty || 'No identificada'}
Organización: ${customerInfo.organization_name || 'No identificada'}
Pedidos recientes: ${orders.rows.length > 0 ? orders.rows.map((o) => `#${o.external_order_id} ($${o.total_amount}, ${o.status})`).join(', ') : 'Ninguno'}
Razón de transferencia: ${escalationReason}

Conversación:
${messageLog}`;
    try {
        const summary = await (0, ai_service_1.getAIResponse)(provider, '', summaryPrompt, apiKey);
        return summary;
    }
    catch {
        // Fallback: simple concatenation
        return `Cliente: ${customerInfo.display_name || 'Desconocido'}. Razón de transferencia: ${escalationReason}. Últimos mensajes del cliente: ${messages.rows.filter((m) => m.direction === 'inbound').slice(-2).map((m) => m.content).join(' | ')}`;
    }
}
/**
 * Execute a handoff: assign to agent, save summary, record event.
 */
async function executeHandoff(conversationId, customerId, escalation, provider, apiKey) {
    // Generate summary if configured
    let summary = '';
    if (escalation.rule?.generate_summary) {
        summary = await generateHandoffSummary(conversationId, customerId, escalation.reason, provider, apiKey);
    }
    // Find the target agent
    let agentId = null;
    if (escalation.rule?.target_type === 'specific_agent' && escalation.rule.target_id) {
        agentId = escalation.rule.target_id;
    }
    else if (escalation.rule?.target_role) {
        // Find available agent with the specified role
        const agent = await db_1.db.query(`SELECT id FROM agents
             WHERE role = $1 AND is_active = TRUE
             ORDER BY (
                 SELECT COUNT(*) FROM conversations
                 WHERE assigned_agent_id = agents.id AND status IN ('open', 'pending')
             ) ASC
             LIMIT 1`, [escalation.rule.target_role]);
        if (agent.rows.length > 0)
            agentId = agent.rows[0].id;
    }
    else {
        // Round-robin: assign to least-busy agent
        const agent = await db_1.db.query(`SELECT id FROM agents
             WHERE is_active = TRUE
             ORDER BY (
                 SELECT COUNT(*) FROM conversations
                 WHERE assigned_agent_id = agents.id AND status IN ('open', 'pending')
             ) ASC
             LIMIT 1`);
        if (agent.rows.length > 0)
            agentId = agent.rows[0].id;
    }
    // Update the conversation
    await db_1.db.query(`UPDATE conversations
         SET assigned_agent_id = $1, handoff_summary = $2, escalation_reason = $3, updated_at = NOW()
         WHERE id = $4`, [agentId, summary, escalation.reason, conversationId]);
    // Get customer profile snapshot
    const profile = await (0, recommendation_engine_1.getCustomerProfile)(customerId);
    // Record the handoff event
    await db_1.db.query(`INSERT INTO handoff_events
            (conversation_id, from_handler, to_agent_id, escalation_rule_id, trigger_reason, ai_summary, customer_profile_snapshot)
         VALUES ($1, 'bot', $2, $3, $4, $5, $6)`, [
        conversationId,
        agentId,
        escalation.rule?.id || null,
        escalation.reason,
        summary,
        profile ? JSON.stringify(profile) : null,
    ]);
    return { agent_id: agentId, summary };
}
