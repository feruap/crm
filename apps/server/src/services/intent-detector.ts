/**
 * Intent Detector — preprocessing helper for mixed-topic messages.
 *
 * Analyzes a customer message and returns all detected intents, their confidence
 * scores, the message language, and an overall sentiment signal.  The result
 * lets the bot (or tests) decide whether a single inline answer is enough or
 * whether the response should be split / escalated.
 *
 * Deliberately dependency-free so it can be used in unit tests without mocking
 * the database or any external API.
 */

export type Intent =
    | 'product_inquiry'   // asking about a product in general
    | 'pricing'           // explicit price question
    | 'availability'      // stock / delivery availability
    | 'shipping_tracking' // order tracking, shipping status
    | 'medical_question'  // clinical / technical question
    | 'order_placement'   // wants to buy / place an order
    | 'greeting'          // hi, hello, hola…
    | 'complaint'         // dissatisfaction / frustration
    | 'unknown';

export interface DetectedIntent {
    type: Intent;
    confidence: number; // 0–1
    matchedKeywords: string[];
}

export type Language = 'es' | 'en' | 'mixed';
export type Sentiment = 'positive' | 'neutral' | 'frustrated' | 'urgent';
export type Complexity = 'simple' | 'moderate' | 'complex';

export interface IntentAnalysis {
    intents: DetectedIntent[];
    primaryIntent: Intent;
    isMultiIntent: boolean;
    language: Language;
    sentiment: Sentiment;
    messageComplexity: Complexity;
    wordCount: number;
    charCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Keyword dictionaries (lower-case, trimmed)
// ─────────────────────────────────────────────────────────────────────────────

const INTENT_KEYWORDS: Record<Intent, string[]> = {
    product_inquiry: [
        'producto', 'prueba', 'kit', 'test', 'antígeno', 'antigeno',
        'anticuerpo', 'reactivo', 'diagnóstico', 'diagnostico', 'rapid',
        'rápida', 'rapida', 'detección', 'deteccion', 'tienen', 'manejan',
        'qué tienen', 'que tienen', 'qué manejan', 'que manejan',
        'información', 'informacion', 'info', 'product', 'catalog', 'catálogo',
    ],
    pricing: [
        'precio', 'costo', 'cuánto', 'cuanto', 'vale', 'cobran', 'tarifa',
        'cotización', 'cotizacion', 'cotizar', 'presupuesto', 'cost', 'price',
        'how much', 'quote', 'pricing', '¿cuánto', '¿cuanto', 'cuánto cuesta',
        'cuanto cuesta',
    ],
    availability: [
        'disponible', 'disponibilidad', 'inventario', 'stock', 'hay', 'tienen en',
        'en existencia', 'surtido', 'entrega', 'cuándo llega', 'cuando llega',
        'available', 'in stock', 'delivery time', 'lead time', 'cuándo tienen',
        'cuando tienen',
    ],
    shipping_tracking: [
        'pedido', 'guía', 'guia', 'rastrear', 'rastreo', 'paquete', 'envío',
        'envio', 'estatus', 'status', 'dónde está', 'donde esta', 'shipment',
        'tracking', 'order', 'número de pedido', 'numero de pedido', 'cuando llega',
        'cuándo llega', 'mi paquete', 'mi pedido', 'llegó', 'llego',
    ],
    medical_question: [
        'sensibilidad', 'especificidad', 'certeza', 'confiabilidad', 'exactitud',
        'clínico', 'clinico', 'médico', 'medico', 'diagnóstico diferencial',
        'diagnostico diferencial', 'validación', 'validacion', 'fda', 'ce', 'iso',
        'muestra', 'suero', 'plasma', 'sangre', 'orina', 'hisopado', 'saliva',
        'lectura', 'interpretación', 'interpretacion', 'resultado', 'positivo',
        'negativo', 'falso', 'especimen', 'clinical', 'sensitivity', 'specificity',
    ],
    order_placement: [
        'quiero comprar', 'quiero pedir', 'quiero ordenar', 'hacer un pedido',
        'realizar un pedido', 'me interesa', 'lo quiero', 'quiero uno', 'quiero',
        'necesito', 'voy a llevar', 'me lo llevas', 'cómo compro', 'como compro',
        'place order', 'buy', 'purchase', 'order now', 'i want', 'add to cart',
    ],
    greeting: [
        'hola', 'buenas', 'buenos días', 'buenos dias', 'buenas tardes',
        'buenas noches', 'hey', 'hi', 'hello', 'good morning', 'good afternoon',
        'saludos', 'buen día', 'buen dia',
    ],
    complaint: [
        'mal', 'malo', 'pésimo', 'pesimo', 'terrible', 'horrible', 'molesto',
        'enojado', 'frustrated', 'upset', 'angry', 'queja', 'reclamo', 'inconformidad',
        'no funciona', 'no funciono', 'no sirve', 'error', 'falla', 'problem',
        'issue', 'complaint',
    ],
    unknown: [],
};

const ES_WORDS = ['el', 'la', 'de', 'que', 'en', 'por', 'con', 'su', 'una', 'un',
    'los', 'las', 'del', 'al', 'es', 'se', 'no', 'le', 'ya', 'pero'];
const EN_WORDS = ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can',
    'her', 'was', 'one', 'our', 'out', 'have', 'with', 'this', 'that', 'they'];

const FRUSTRATED_CUES = [
    '!!!', 'urgente', 'urgent', 'ya!', 'por favor ya', 'cuanto antes',
    'necesito ya', 'de inmediato', 'inmediatamente', 'esto es un escándalo',
    'escandalo', 'inaceptable', 'no puede ser',
];
const POSITIVE_CUES = ['gracias', 'thank', 'excelente', 'perfecto', 'genial', 'great', 'thanks'];

// ─────────────────────────────────────────────────────────────────────────────
// Semantic intent clusters
// Intents within the same cluster are considered complementary, not "mixed".
// Multi-intent is only signalled when intents from DIFFERENT clusters coexist.
// ─────────────────────────────────────────────────────────────────────────────
const INTENT_CLUSTERS: Record<string, Intent[]> = {
    product: ['product_inquiry', 'pricing', 'availability'],  // all about a product
    transaction: ['shipping_tracking', 'order_placement'],     // post-sale flow
    clinical: ['medical_question'],                             // technical/clinical
    social: ['greeting', 'complaint'],                         // opener/closer
};

function clusterOf(intent: Intent): string {
    for (const [cluster, intents] of Object.entries(INTENT_CLUSTERS)) {
        if ((intents as Intent[]).includes(intent)) return cluster;
    }
    return 'other';
}

// ─────────────────────────────────────────────────────────────────────────────
// Core detection logic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect all intents present in `message`.  Returns a fully populated
 * IntentAnalysis object.
 */
export function detectIntents(message: string): IntentAnalysis {
    const lower = message.toLowerCase();
    const words = lower.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const charCount = message.length;

    // ── Language detection ──────────────────────────────────────────────────
    // Spanish indicator: structural ES_WORDS OR Spanish-specific chars (accents, ñ, ¿, ¡)
    const hasSpanishChars = /[áéíóúüñ¿¡]/i.test(message);
    const esHits = words.filter(w => ES_WORDS.includes(w)).length + (hasSpanishChars ? 2 : 0);
    const enHits = words.filter(w => EN_WORDS.includes(w)).length;
    let language: Language = 'es'; // default: Spanish (primary user base)
    if (enHits > 0 && esHits > 0) language = 'mixed';
    else if (enHits > 0 && esHits === 0 && !hasSpanishChars) language = 'en';

    // ── Sentiment ────────────────────────────────────────────────────────────
    let sentiment: Sentiment = 'neutral';
    if (POSITIVE_CUES.some(c => lower.includes(c))) sentiment = 'positive';
    if (FRUSTRATED_CUES.some(c => lower.includes(c))) sentiment = 'frustrated';
    // Excessive caps signals frustration
    const capsRatio = (message.match(/[A-ZÁÉÍÓÚÜÑ]/g) || []).length / Math.max(message.length, 1);
    if (capsRatio > 0.4 && wordCount > 2) sentiment = 'frustrated';
    if (lower.includes('urgente') || lower.includes('urgent')) sentiment = 'urgent';

    // ── Intent scoring ───────────────────────────────────────────────────────
    const detected: DetectedIntent[] = [];

    for (const [intentType, keywords] of Object.entries(INTENT_KEYWORDS) as [Intent, string[]][]) {
        if (intentType === 'unknown') continue;
        const matched: string[] = [];
        for (const kw of keywords) {
            if (lower.includes(kw)) matched.push(kw);
        }
        if (matched.length === 0) continue;

        // Confidence: base + small bonus per extra keyword, capped at 0.95
        const base = 0.55;
        const bonus = Math.min(matched.length - 1, 5) * 0.07;
        const confidence = Math.min(base + bonus, 0.95);

        detected.push({ type: intentType, confidence, matchedKeywords: matched });
    }

    // Sort by confidence desc
    detected.sort((a, b) => b.confidence - a.confidence);

    const primaryIntent: Intent = detected.length > 0 ? detected[0].type : 'unknown';
    if (detected.length === 0) {
        detected.push({ type: 'unknown', confidence: 0.3, matchedKeywords: [] });
    }

    // Multi-intent: true only when confident intents span MORE THAN ONE semantic cluster
    // (exclude 'social' cluster — greetings are always paired with something else)
    const meaningfulIntents = detected.filter(
        d => d.confidence >= 0.60 && d.type !== 'unknown' && clusterOf(d.type) !== 'social'
    );
    const distinctClusters = new Set(meaningfulIntents.map(d => clusterOf(d.type)));
    const isMultiIntent = distinctClusters.size > 1;

    // ── Message complexity ───────────────────────────────────────────────────
    let messageComplexity: Complexity = 'simple';
    if (wordCount > 25 || charCount > 180) messageComplexity = 'complex';
    else if (wordCount > 10 || isMultiIntent || meaningfulIntents.length > 1) messageComplexity = 'moderate';

    return {
        intents: detected,
        primaryIntent,
        isMultiIntent,
        language,
        sentiment,
        messageComplexity,
        wordCount,
        charCount,
    };
}

/**
 * Convenience wrapper: returns true if the message contains intents from
 * more than one distinct semantic cluster (e.g., product + transaction).
 * Delegates to detectIntents() so cluster exclusions are consistent.
 */
export function hasMultipleIntents(message: string): boolean {
    return detectIntents(message).isMultiIntent;
}
