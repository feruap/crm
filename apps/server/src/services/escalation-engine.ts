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

import { db } from '../db';
import { getAIResponse } from '../ai.service';
import { getCustomerProfile } from './recommendation-engine';

interface ConditionConfig {
  keywords?: string[];
  min_lifetime_spend?: number;
  [key: string]: any;
}

interface EscalationRule {
  id: number;
  name: string;
  condition_type: string;
  target_type: string;
  target_id: number | null;
  target_role: string | null;
  generate_summary: boolean;
  escalation_message: string | null;
  condition_config?: ConditionConfig;
  is_active?: boolean;
  priority?: number;
}

interface EscalationResult {
  shouldEscalate: boolean;
  reason: string;
  rule?: EscalationRule;
}

interface HandoffResult {
  agent_id: number | null;
  summary: string;
}

interface MessageRow {
  direction: 'inbound' | 'outbound';
  content: string;
  handled_by: string;
  bot_action: string;
  created_at: Date;
}

interface CustomerRow {
  display_name: string;
  business_type: string;
  specialty: string;
  organization_name: string;
}

interface OrderRow {
  external_order_id: string;
  total_amount: number;
  status: string;
  items: any;
  order_date: Date;
}

interface AgentRow {
  id: number;
  role?: string;
  is_active?: boolean;
}

interface SentimentInsightRow {
  last_sentiment: string;
}

interface LifetimeSpendRow {
  lifetime_spend: string | number;
}

const HUMAN_REQUEST_KEYWORDS: string[] = [
  'hablar con alguien', 'agente humano', 'persona real', 'representante',
  'quiero hablar con', 'transfiere', 'operador', 'talk to a human',
  'asesor', 'ejecutivo',
];

const PURCHASE_INTENT_KEYWORDS: string[] = [
  'quiero comprar', 'cotización', 'cotizacion', 'pedido', 'ordenar',
  'precio', 'cuánto cuesta', 'cuanto cuesta', 'costo', 'factura',
  'comprar', 'adquirir', 'presupuesto', 'lista de precios',
];

const DISCOUNT_KEYWORDS: string[] = [
  'descuento', 'precio especial', 'oferta', 'promoción', 'promocion',
  'mayoreo', 'volumen', 'rebaja', 'negociar precio',
];

const COMPLAINT_KEYWORDS: string[] = [
  'queja', 'reclamo', 'problema con mi pedido', 'no llegó', 'no llego',
  'producto defectuoso', 'mal estado', 'devolución', 'devolucion',
  'insatisfecho', 'molesto', 'pésimo', 'pesimo', 'terrible',
];

const ORDER_ISSUE_KEYWORDS: string[] = [
  'mi pedido', 'mi orden', 'número de seguimiento', 'tracking',
  'no he recibido', 'cuándo llega', 'cuando llega', 'estado de mi pedido',
  'dónde está mi', 'donde esta mi',
];

function matchesKeywords(message: string, keywords: string[]): boolean {
  const lower = message.toLowerCase();
  return keywords.some(kw => lower.includes(kw.toLowerCase()));
}


async function evaluateRule(
  rule: EscalationRule,
  messageText: string,
  customerId: number,
  conversationId: number
): Promise<boolean> {
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
      const spend = await db.query<LifetimeSpendRow>(
        `SELECT COALESCE(SUM(total_amount), 0) AS lifetime_spend
         FROM orders WHERE customer_id = $1 AND status NOT IN ('cancelled', 'refunded', 'failed')`,
        [customerId]
      );
      return parseFloat(String(spend.rows[0].lifetime_spend)) >= minSpend;
    }

    case 'sentiment_negative': {
      const insight = await db.query<SentimentInsightRow>(
        `SELECT last_sentiment FROM ai_insights
         WHERE customer_id = $1 ORDER BY updated_at DESC LIMIT 1`,
        [customerId]
      );
      return insight.rows.length > 0 && insight.rows[0].last_sentiment === 'negative';
    }

    case 'technical_question': {
      const technicalIndicators: string[] = [
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


export async function evaluateEscalation(
  messageText: string,
  customerId: number,
  conversationId: number
): Promise<EscalationResult> {
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

  const rules = await db.query<EscalationRule>(
    `SELECT * FROM escalation_rules WHERE is_active = TRUE ORDER BY priority DESC`
  );

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


export async function generateHandoffSummary(
  conversationId: number,
  customerId: number,
  escalationReason: string,
  provider: string,
  apiKey: string
): Promise<string> {
  const messages = await db.query<MessageRow>(
    `SELECT direction, content, handled_by, bot_action, created_at
     FROM messages WHERE conversation_id = $1 AND content IS NOT NULL
     ORDER BY created_at ASC LIMIT 30`,
    [conversationId]
  );

  if (messages.rows.length === 0) return 'Sin mensajes previos.';

  const customer = await db.query<CustomerRow>(
    `SELECT c.display_name, cp.business_type, cp.specialty, cp.organization_name
     FROM customers c
     LEFT JOIN customer_profiles cp ON cp.customer_id = c.id
     WHERE c.id = $1`,
    [customerId]
  );

  const orders = await db.query<OrderRow>(
    `SELECT external_order_id, total_amount, status, items
     FROM orders WHERE customer_id = $1
     ORDER BY order_date DESC LIMIT 3`,
    [customerId]
  );

  const customerInfo = customer.rows[0] || {};

  const messageLog = messages.rows
    .map((m: MessageRow) => {
      const who = m.direction === 'inbound' 
        ? 'Cliente' 
        : (m.handled_by === 'bot' ? 'Bot' : 'Agente');
      return `${who}: ${m.content}`;
    })
    .join('\n');

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
Pedidos recientes: ${
    orders.rows.length > 0
      ? orders.rows
          .map((o: OrderRow) => `#${o.external_order_id} ($${o.total_amount}, ${o.status})`)
          .join(', ')
      : 'Ninguno'
  }
Razón de transferencia: ${escalationReason}

Conversación:
${messageLog}`;

  try {
    const summary = await getAIResponse(provider as any, '', summaryPrompt, apiKey);
    return summary;
  } catch {
    return `Cliente: ${customerInfo.display_name || 'Desconocido'}. Razón de transferencia: ${escalationReason}. Últimos mensajes del cliente: ${messages.rows
      .filter((m: MessageRow) => m.direction === 'inbound')
      .slice(-2)
      .map((m: MessageRow) => m.content)
      .join(' | ')}`;
  }
}


export async function executeHandoff(
  conversationId: number,
  customerId: number,
  escalation: EscalationResult,
  provider: string,
  apiKey: string
): Promise<HandoffResult> {
  let summary = '';
  if (escalation.rule?.generate_summary) {
    summary = await generateHandoffSummary(
      conversationId,
      customerId,
      escalation.reason,
      provider,
      apiKey
    );
  }

  let agentId: number | null = null;

  if (escalation.rule?.target_type === 'specific_agent' && escalation.rule.target_id) {
    agentId = escalation.rule.target_id;
  } else if (escalation.rule?.target_role) {
    const agent = await db.query<AgentRow>(
      `SELECT id FROM agents
       WHERE role = $1 AND is_active = TRUE
       ORDER BY COALESCE(active_conversation_count, 0) ASC
       LIMIT 1`,
      [escalation.rule.target_role]
    );
    if (agent.rows.length > 0) agentId = agent.rows[0].id;
  } else {
    const agent = await db.query<AgentRow>(
      `SELECT id FROM agents
       WHERE is_active = TRUE
       ORDER BY COALESCE(active_conversation_count, 0) ASC
       LIMIT 1`
    );
    if (agent.rows.length > 0) agentId = agent.rows[0].id;
  }

  // Atomic handoff: transaction wraps both UPDATE + INSERT
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE conversations
       SET assigned_agent_id = $1, handoff_summary = $2, escalation_reason = $3, updated_at = NOW()
       WHERE id = $4`,
      [agentId, summary, escalation.reason, conversationId]
    );
    if (agentId) {
      await client.query(
        `UPDATE agents SET active_conversation_count = COALESCE(active_conversation_count,0) + 1 WHERE id = $1`,
        [agentId]
      );
    }
    const profile = await getCustomerProfile(customerId);
    await client.query(
      `INSERT INTO handoff_events
        (conversation_id, from_handler, to_agent_id, escalation_rule_id, trigger_reason, ai_summary, customer_profile_snapshot)
       VALUES ($1, 'bot', $2, $3, $4, $5, $6)`,
      [conversationId, agentId, escalation.rule?.id || null, escalation.reason, summary, profile ? JSON.stringify(profile) : null]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return { agent_id: agentId, summary };
}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 