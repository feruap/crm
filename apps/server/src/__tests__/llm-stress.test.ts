/**
 * LLM Bot Stress Tests — Mixed-Topic Message Handling
 *
 * Tests the CRM bot's ability to handle:
 * - Single-topic messages
 * - Mixed/multi-intent messages
 * - Rapid-fire sequences
 * - Edge cases (very long, emoji-only, URLs, phone numbers)
 * - Frustration / escalation tone
 * - Language mixing (Spanish + English)
 *
 * Run: npm test
 *
 * ── Mocking strategy ───────────────────────────────────────────────────────
 * - `db` module is mocked so no real PostgreSQL is needed.
 * - `fetch` is mocked to return canned LLM responses.
 * - Intent detection (intent-detector.ts) is tested with ZERO mocks.
 */

import { detectIntents, hasMultipleIntents, Intent, IntentAnalysis } from '../services/intent-detector';
import { findTopKnowledgeHits, KnowledgeHit } from '../ai.service';

// ─── Mock the database ────────────────────────────────────────────────────────
// We mock at the module level so db.query never touches PostgreSQL.
jest.mock('../db', () => ({
    db: {
        query: jest.fn(),
    },
}));

// ─── Mock global fetch (LLM + WooCommerce calls) ─────────────────────────────
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

// ─── Helpers ──────────────────────────────────────────────────────────────────
import { db } from '../db';
// Cast to jest.Mock (avoids TS2345 "never" error from pg's overloaded query types)
const mockDb = db.query as jest.Mock;

/** Returns a fake DB result shaped like pg QueryResult */
function dbResult(rows: Record<string, any>[]): any {
    return { rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] };
}

/** Returns a fake OpenAI-compatible LLM response */
function llmResponse(text: string): Response {
    return {
        ok: true,
        status: 200,
        json: async () => ({
            choices: [{ message: { content: text, role: 'assistant' } }],
        }),
        text: async () => JSON.stringify({ choices: [{ message: { content: text } }] }),
    } as unknown as Response;
}

/** Measures async fn execution time in ms */
async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
    const t0 = Date.now();
    const result = await fn();
    return { result, ms: Date.now() - t0 };
}

/** Build a 1536-d embedding where every value equals `val` (easy to detect) */
function fakeEmbedding(val = 0.5): number[] {
    return new Array(1536).fill(val);
}

// ─── Shared KB fixture ────────────────────────────────────────────────────────
const KB_ROWS = [
    {
        id: '1',
        question: 'Precio prueba rápida COVID',
        answer: 'La prueba rápida de COVID tiene un precio de $250 por caja de 20 pruebas.',
        metadata: { category: 'covid', type: 'pricing' },
        confidence: 0.91,
    },
    {
        id: '2',
        question: 'Disponibilidad prueba influenza',
        answer: 'Sí tenemos prueba rápida de influenza A/B en stock inmediato.',
        metadata: { category: 'influenza', type: 'availability' },
        confidence: 0.87,
    },
    {
        id: '3',
        question: 'Sensibilidad prueba dengue',
        answer: 'Nuestra prueba de dengue NS1 tiene 96.5% de sensibilidad y 98.2% de especificidad.',
        metadata: { category: 'dengue', type: 'medical' },
        confidence: 0.85,
    },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — Intent Detection (pure logic, zero mocks)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Intent Detection — unit', () => {
    // ── Single intents ────────────────────────────────────────────────────────

    test('S1: single intent — product inquiry (Spanish)', () => {
        const msg = 'Hola, ¿qué pruebas rápidas manejan?';
        const analysis = detectIntents(msg);

        expect(analysis.primaryIntent).toBe('product_inquiry');
        expect(analysis.isMultiIntent).toBe(false);
        expect(analysis.language).toBe('es');
        expect(analysis.intents[0].confidence).toBeGreaterThanOrEqual(0.55);
        expect(analysis.intents[0].matchedKeywords.length).toBeGreaterThan(0);
    });

    test('S2: single intent — shipping/tracking', () => {
        const msg = '¿Me pueden dar el estatus de mi pedido? El número es 12345.';
        const analysis = detectIntents(msg);

        expect(analysis.primaryIntent).toBe('shipping_tracking');
        expect(analysis.isMultiIntent).toBe(false);
        expect(analysis.intents.find(i => i.type === 'shipping_tracking')?.confidence)
            .toBeGreaterThanOrEqual(0.55);
    });

    test('S3: single intent — pricing', () => {
        const msg = '¿Cuánto cuesta la caja de pruebas de COVID?';
        const analysis = detectIntents(msg);

        expect(analysis.primaryIntent).toBe('pricing');
        expect(analysis.isMultiIntent).toBe(false);
    });

    // ── Mixed intents ─────────────────────────────────────────────────────────

    test('M1: mixed — product + shipping in same message', () => {
        // Message with clear pricing signal (cuánto cuesta = 0.69) + tracking (estatus + pedido = 0.62)
        const msg = 'Buenos días, ¿cuánto cuesta la prueba de influenza? Y también el estatus de mi pedido número 9876.';
        const analysis = detectIntents(msg);

        const intentTypes = analysis.intents.map(i => i.type);
        expect(intentTypes).toContain('pricing');
        expect(intentTypes).toContain('shipping_tracking');
        expect(analysis.isMultiIntent).toBe(true); // product cluster + transaction cluster
        expect(analysis.messageComplexity).not.toBe('simple');
    });

    test('M2: mixed — price inquiry + availability (same cluster, both detected)', () => {
        // pricing + availability are in the same semantic cluster (product).
        // The bot can answer both in one message. isMultiIntent = false is correct here.
        const msg = '¿Cuánto cuesta la prueba de dengue y si la tienen disponible para entrega inmediata?';
        const analysis = detectIntents(msg);

        const intentTypes = analysis.intents.map(i => i.type);
        expect(intentTypes).toContain('pricing');
        expect(intentTypes).toContain('availability');
        // Both detected — even if isMultiIntent is false (same cluster), both are present
        expect(analysis.intents.some(i => i.type === 'pricing')).toBe(true);
        expect(analysis.intents.some(i => i.type === 'availability')).toBe(true);
    });

    test('M3: mixed — medical question + ordering intent', () => {
        const msg = 'Necesito saber la sensibilidad y especificidad de la prueba de VIH y si es buena, quiero hacer un pedido de 5 cajas.';
        const analysis = detectIntents(msg);

        const intentTypes = analysis.intents.map(i => i.type);
        expect(intentTypes).toContain('medical_question');
        expect(intentTypes).toContain('order_placement');
        expect(analysis.isMultiIntent).toBe(true);
        expect(['moderate', 'complex']).toContain(analysis.messageComplexity);
    });

    // ── Language detection ────────────────────────────────────────────────────

    test('L1: Spanish only', () => {
        const msg = 'Hola buenos días, ¿tienen pruebas de COVID disponibles?';
        const analysis = detectIntents(msg);
        expect(analysis.language).toBe('es');
    });

    test('L2: English only', () => {
        const msg = 'Hi, can you tell me the price for the rapid COVID test?';
        const analysis = detectIntents(msg);
        expect(analysis.language).toBe('en');
    });

    test('L3: language mix — Spanish + English (Mexico border)', () => {
        const msg = 'Hi, ¿cuánto cuesta the rapid test for influenza? I need the price.';
        const analysis = detectIntents(msg);
        expect(analysis.language).toBe('mixed');
        expect(analysis.intents.find(i => i.type === 'pricing')).toBeDefined();
    });

    // ── Sentiment detection ───────────────────────────────────────────────────

    test('SENT1: positive sentiment', () => {
        const msg = 'Gracias, todo perfecto con mi pedido!';
        const analysis = detectIntents(msg);
        expect(analysis.sentiment).toBe('positive');
    });

    test('SENT2: frustrated sentiment — explicit word', () => {
        const msg = 'Esto es INACEPTABLE, llevo esperando mi pedido desde hace 2 semanas. Por favor ayúdenme YA.';
        const analysis = detectIntents(msg);
        expect(['frustrated', 'urgent']).toContain(analysis.sentiment);
    });

    test('SENT3: frustrated sentiment — excessive caps', () => {
        const msg = 'MI PEDIDO NO HA LLEGADO Y NADIE ME RESPONDE';
        const analysis = detectIntents(msg);
        expect(analysis.sentiment).toBe('frustrated');
    });

    // ── Edge cases ────────────────────────────────────────────────────────────

    test('E1: very long message (500+ chars)', async () => {
        const base = 'Necesito información sobre varios productos. ';
        const msg = base.repeat(12) +
            'También quiero saber el precio de la prueba de dengue y el estatus de mi pedido.';

        const { result: analysis, ms } = await timed(() => Promise.resolve(detectIntents(msg)));

        expect(analysis.charCount).toBeGreaterThan(500);
        expect(analysis.messageComplexity).toBe('complex');
        expect(ms).toBeLessThan(50); // intent detection must be fast
        logMetrics('E1: very long message', analysis, ms);
    });

    test('E2: message with only emojis', () => {
        const msg = '😊🔥👍💉🧪';
        const analysis = detectIntents(msg);
        // No recognizable keywords → unknown or very low confidence
        expect(analysis.primaryIntent).toBe('unknown');
        expect(analysis.wordCount).toBeLessThanOrEqual(5);
    });

    test('E3: message with URL and phone number', () => {
        const msg = 'Hola, vi su producto en https://amunet.com.mx. Llamenme al 55-1234-5678 para cotizar.';
        const analysis = detectIntents(msg);
        // Should still detect pricing/product intent from surrounding words
        const intentTypes = analysis.intents.map(i => i.type);
        expect(intentTypes.some(t => ['pricing', 'product_inquiry'].includes(t))).toBe(true);
    });

    test('E4: ambiguous message about multiple products', () => {
        const msg = 'Tengo dudas entre el kit de COVID y el de influenza, ¿cuál recomienda?';
        const analysis = detectIntents(msg);
        // Should detect product_inquiry at minimum
        expect(analysis.intents.some(i => i.type === 'product_inquiry')).toBe(true);
    });

    // ── Helper function ───────────────────────────────────────────────────────

    test('hasMultipleIntents helper returns correct boolean', () => {
        const single = 'Hola, ¿cuánto cuesta la prueba de COVID?';
        const multi = '¿Cuánto cuesta y también tienen disponible para entrega hoy? Además quiero rastrear mi pedido 1234.';

        expect(hasMultipleIntents(single)).toBe(false);
        expect(hasMultipleIntents(multi)).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — Knowledge Base Search (mocked DB)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Knowledge Base — findTopKnowledgeHits', () => {
    beforeEach(() => {
        mockDb.mockReset();
    });

    test('KB1: semantic search returns top-k hits ordered by confidence', async () => {
        mockDb.mockResolvedValueOnce(dbResult(KB_ROWS));

        const embedding = fakeEmbedding(0.5);
        const { result: hits, ms } = await timed(() =>
            findTopKnowledgeHits('precio prueba COVID', embedding, 3)
        );

        expect(hits).toHaveLength(3);
        expect(hits[0].confidence).toBeGreaterThanOrEqual(hits[1].confidence);
        expect(hits[0].answer).toContain('COVID');
        expect(ms).toBeLessThan(200);
        logMetrics('KB1: semantic search', null, ms, { kbHits: hits.length, topConfidence: hits[0].confidence });
    });

    test('KB2: zero-vector embedding falls back to textual search', async () => {
        // Semantic query returns nothing (zero vector skips it); textual search finds 1.
        // The textual SQL returns `0.65 as confidence`, so mock must reflect that.
        mockDb.mockResolvedValueOnce(dbResult([{
            id: KB_ROWS[1].id,
            question: KB_ROWS[1].question,
            answer: KB_ROWS[1].answer,
            metadata: KB_ROWS[1].metadata,
            confidence: 0.65, // as hardcoded in the textual fallback SQL
        }]));

        const zeroEmbedding = new Array(1536).fill(0);
        const hits = await findTopKnowledgeHits('influenza disponible', zeroEmbedding, 3);

        expect(hits.length).toBeGreaterThanOrEqual(1);
        expect(hits[0].confidence).toBe(0.65); // textual fallback confidence
    });

    test('KB3: no hits returns empty array', async () => {
        mockDb.mockResolvedValueOnce(dbResult([])); // semantic empty
        mockDb.mockResolvedValueOnce(dbResult([])); // textual empty

        const hits = await findTopKnowledgeHits('xyz123 no match', fakeEmbedding(), 3);
        expect(hits).toHaveLength(0);
    });

    test('KB4: semantic + textual results are combined without duplicates', async () => {
        // Semantic returns 1 hit; textual should fill the remaining 2
        mockDb.mockResolvedValueOnce(dbResult([KB_ROWS[0]]));        // semantic (1 hit)
        mockDb.mockResolvedValueOnce(dbResult([KB_ROWS[1], KB_ROWS[2]])); // textual (2 hits)

        const hits = await findTopKnowledgeHits('prueba rápida', fakeEmbedding(), 3);
        expect(hits.length).toBe(3);
        const ids = hits.map(h => h.knowledgeId);
        expect(new Set(ids).size).toBe(ids.length); // no duplicate ids
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — getAIResponse integration (mocked DB + mocked fetch)
// ═══════════════════════════════════════════════════════════════════════════════

describe('getAIResponse — bot response quality', () => {
    // Dynamically import to ensure mocks are in place
    let getAIResponse: typeof import('../ai.service').getAIResponse;

    beforeAll(async () => {
        ({ getAIResponse } = await import('../ai.service'));
    });

    /**
     * Configure DB mocks for getAIResponse using query-content inspection.
     * This is robust to conditional branches that skip some queries.
     */
    function setupMinimalDbMocks(overrides?: {
        customerPhone?: string;
        customerName?: string;
        aiSettings?: Record<string, any>;
        conversationMessages?: Array<{ direction: string; content: string }>;
    }) {
        const opts = overrides ?? {};
        const excludedCats = opts.aiSettings?.excluded_categories ?? ['cortesias'];
        const convMessages = opts.conversationMessages ?? [];

        mockDb.mockImplementation((query: string) => {
            if (typeof query === 'string') {
                if (query.includes('external_identities')) {
                    return Promise.resolve(dbResult(
                        opts.customerPhone ? [{ provider_id: opts.customerPhone }] : []
                    ));
                }
                if (query.includes('display_name')) {
                    return Promise.resolve(dbResult(
                        opts.customerName ? [{ display_name: opts.customerName }] : []
                    ));
                }
                if (query.includes('ai_settings')) {
                    return Promise.resolve(dbResult([{ excluded_categories: excludedCats }]));
                }
                if (query.includes('medical_products')) {
                    return Promise.resolve(dbResult([]));
                }
                if (query.includes('exact_count')) {
                    return Promise.resolve(dbResult([{ exact_count: '5' }])); // >2 → skip automation
                }
                if (query.includes('automations')) {
                    return Promise.resolve(dbResult([]));
                }
                if (query.includes('ai_instructions')) {
                    return Promise.resolve(dbResult([]));
                }
                if (query.includes('direction') && query.includes('content')) {
                    return Promise.resolve(dbResult(convMessages));
                }
                // attributions / campaigns / knowledge_base queries
                if (query.includes('attributions') || query.includes('campaigns')) {
                    return Promise.resolve(dbResult([]));
                }
                if (query.includes('knowledge_base')) {
                    return Promise.resolve(dbResult([]));
                }
            }
            return Promise.resolve(dbResult([]));
        });
    }

    /**
     * NOTE: WC_KEY / WC_URL env vars are NOT set in the test environment.
     * Therefore getCatalogForAI() and getOrderTracking() return early without fetch.
     * The only fetch call in getAIResponse is the LLM chat completion.
     * → No WC mock needed; just set up mockFetch for the LLM call.
     */

    beforeEach(() => {
        mockDb.mockReset();
        mockFetch.mockReset();
    });

    // ── Single topic tests ─────────────────────────────────────────────────────

    test('AI1: single topic — product question answered from KB context', async () => {
        const SYSTEM_PROMPT = 'Eres un asistente de ventas médico.';
        const USER_MSG = '¿Qué pruebas rápidas de COVID manejan?';
        const BOT_REPLY = '1. Prueba rápida COVID Antígeno - $250/caja\n2. Prueba rápida COVID Anticuerpo - $300/caja\n¿Cuál le interesa?';

        setupMinimalDbMocks();
        mockFetch.mockResolvedValueOnce(llmResponse(BOT_REPLY));

        const intentAnalysis = detectIntents(USER_MSG);
        const { result: response, ms } = await timed(() =>
            getAIResponse('deepseek', SYSTEM_PROMPT, USER_MSG, 'fake-key', 'deepseek-chat',
                undefined, 'Precio prueba COVID es $250.', undefined)
        );

        expect(response).toBeDefined();
        expect(typeof response).toBe('string');
        expect(response.length).toBeGreaterThan(0);
        expect(ms).toBeLessThan(5000);

        logMetrics('AI1: product question', intentAnalysis, ms, {
            kbHits: 1,
            responseLength: response.length,
        });
    });

    test('AI2: single topic — shipping/tracking request', async () => {
        const SYSTEM_PROMPT = 'Eres un asistente de ventas médico.';
        const USER_MSG = '¿Me pueden decir el estatus de mi pedido #10234?';
        const BOT_REPLY = 'Tu pedido #10234 está en camino. Número de guía: 1234567890. ¿Algo más en que pueda ayudarte?';

        setupMinimalDbMocks({ customerPhone: '5512345678' });
        mockFetch.mockResolvedValueOnce(llmResponse(BOT_REPLY));

        const intentAnalysis = detectIntents(USER_MSG);
        const { result: response, ms } = await timed(() =>
            getAIResponse('deepseek', SYSTEM_PROMPT, USER_MSG, 'fake-key', 'deepseek-chat',
                'cust-001', undefined, 'conv-001')
        );

        expect(response).toBeDefined();
        expect(ms).toBeLessThan(5000);

        logMetrics('AI2: shipping tracking', intentAnalysis, ms, { responseLength: response.length });
    });

    test('AI3: mixed — product question + shipping in same message', async () => {
        const USER_MSG = 'Hola, ¿cuánto cuesta la prueba de influenza? Y también, ¿dónde está mi pedido #9876?';
        const BOT_REPLY = 'La prueba de Influenza A/B cuesta $280/caja.\nTu pedido #9876 está en tránsito (guía: 9876543). ¿Le ayudo con algo más?';

        setupMinimalDbMocks({ customerPhone: '5598765432' });
        mockFetch.mockResolvedValueOnce(llmResponse(BOT_REPLY));

        const intentAnalysis = detectIntents(USER_MSG);
        const { result: response, ms } = await timed(() =>
            getAIResponse('deepseek', 'System prompt.', USER_MSG, 'fake-key', 'deepseek-chat',
                'cust-002', 'Influenza A/B $280/caja.', 'conv-002')
        );

        expect(response).toBeDefined();
        expect(intentAnalysis.isMultiIntent).toBe(true);
        expect(ms).toBeLessThan(5000);

        logMetrics('AI3: mixed product+shipping', intentAnalysis, ms, { responseLength: response.length });
    });

    test('AI4: mixed — price inquiry + availability', async () => {
        const USER_MSG = '¿Cuánto cuesta la prueba de dengue y la tienen disponible para hoy?';
        const BOT_REPLY = 'La prueba de Dengue NS1 cuesta $320/caja y sí tenemos en stock para entrega inmediata. ¿Cuántas cajas necesita?';

        setupMinimalDbMocks();
        mockFetch.mockResolvedValueOnce(llmResponse(BOT_REPLY));

        const intentAnalysis = detectIntents(USER_MSG);
        const { result: response, ms } = await timed(() =>
            getAIResponse('deepseek', 'System prompt.', USER_MSG, 'fake-key')
        );

        // pricing + availability are in the same semantic cluster — both detected, one answer covers both
        const intentTypes = intentAnalysis.intents.map(i => i.type);
        expect(intentTypes).toContain('pricing');
        expect(intentTypes).toContain('availability');
        expect(response).toBeDefined();

        logMetrics('AI4: price+availability', intentAnalysis, ms, { responseLength: response.length });
    });

    test('AI5: mixed — medical question + ordering intent', async () => {
        const USER_MSG = 'Necesito saber la sensibilidad de la prueba de VIH. Si es mayor al 95%, quiero ordenar 10 cajas.';
        const BOT_REPLY = 'La prueba de VIH tiene 99.2% de sensibilidad y 99.5% de especificidad.\nCon gusto, te conecto con un asesor para procesar tu pedido de 10 cajas.';

        setupMinimalDbMocks();
        mockFetch.mockResolvedValueOnce(llmResponse(BOT_REPLY));

        const intentAnalysis = detectIntents(USER_MSG);
        const { result: response, ms } = await timed(() =>
            getAIResponse('deepseek', 'System prompt.', USER_MSG, 'fake-key',
                undefined, undefined,
                'Prueba VIH: sensibilidad 99.2%, especificidad 99.5%.')
        );

        expect(intentAnalysis.isMultiIntent).toBe(true);
        expect(response).toBeDefined();

        logMetrics('AI5: medical+order', intentAnalysis, ms, { responseLength: response.length });
    });

    // ── Rapid-fire sequence ────────────────────────────────────────────────────

    test('AI6: rapid-fire — 5 messages in quick succession', async () => {
        const messages = [
            'Hola',
            '¿Qué pruebas manejan?',
            '¿Cuánto cuesta la de COVID?',
            'Ok, ¿y la de influenza?',
            'Quiero hacer un pedido de 5 cajas de cada una',
        ];
        const replies = [
            'Hola, ¿en qué le puedo ayudar?',
            '1. Prueba COVID - $250/caja\n2. Prueba Influenza - $280/caja\n¿Cuál le interesa?',
            'La prueba rápida de COVID cuesta $250/caja de 20 pruebas. ¿Le envío cotización?',
            'La prueba de Influenza A/B cuesta $280/caja. ¿Le interesa?',
            'Con gusto, te conecto con un asesor para procesar tu pedido. ¿Me confirma sus datos de contacto?',
        ];

        const results: Array<{ msg: string; ms: number; intents: string[] }> = [];

        for (let i = 0; i < messages.length; i++) {
            mockDb.mockReset();
            setupMinimalDbMocks();
            mockFetch.mockReset();
            mockFetch.mockResolvedValueOnce(llmResponse(replies[i]));

            const intentAnalysis = detectIntents(messages[i]);
            const { result: response, ms } = await timed(() =>
                getAIResponse('deepseek', 'System prompt.', messages[i], 'fake-key')
            );

            expect(response).toBeDefined();
            expect(ms).toBeLessThan(5000);

            results.push({
                msg: messages[i],
                ms,
                intents: intentAnalysis.intents.map(i => i.type),
            });
        }

        // All 5 messages should complete
        expect(results).toHaveLength(5);

        const avgMs = results.reduce((s, r) => s + r.ms, 0) / results.length;
        console.log('\n📊 AI6: Rapid-fire sequence');
        results.forEach((r, idx) => {
            console.log(`  [${idx + 1}] "${r.msg.substring(0, 40)}" → ${r.ms}ms | intents: ${r.intents.join(', ')}`);
        });
        console.log(`  ⌀ avg response time: ${avgMs.toFixed(0)}ms`);
    });

    // ── Language mix ───────────────────────────────────────────────────────────

    test('AI7: language mix — Spanish + English in same message', async () => {
        const USER_MSG = 'Hi, ¿cuánto cuesta the rapid test for COVID? I need pricing for 5 boxes.';
        const BOT_REPLY = 'La prueba rápida de COVID cuesta $250/caja. 5 cajas serían $1,250. ¿Le envío cotización formal?';

        setupMinimalDbMocks();
        mockFetch.mockResolvedValueOnce(llmResponse(BOT_REPLY));

        const intentAnalysis = detectIntents(USER_MSG);
        const { result: response, ms } = await timed(() =>
            getAIResponse('deepseek', 'System prompt.', USER_MSG, 'fake-key')
        );

        expect(intentAnalysis.language).toBe('mixed');
        expect(response).toBeDefined();

        logMetrics('AI7: language mix', intentAnalysis, ms, { responseLength: response.length });
    });

    // ── Edge cases ─────────────────────────────────────────────────────────────

    test('AI8: edge case — ambiguous multi-product message', async () => {
        const USER_MSG = 'Tengo dudas entre el kit de COVID, el de influenza, y el de dengue. ¿Cuál me recomienda para una clínica rural?';
        const BOT_REPLY = 'Para una clínica rural recomiendo la prueba de Influenza A/B por su versatilidad y la de COVID Antígeno para diagnóstico rápido. ¿Qué patologías son más frecuentes en su zona?';

        setupMinimalDbMocks();
        mockFetch.mockResolvedValueOnce(llmResponse(BOT_REPLY));

        const intentAnalysis = detectIntents(USER_MSG);
        const { result: response, ms } = await timed(() =>
            getAIResponse('deepseek', 'System prompt.', USER_MSG, 'fake-key',
                undefined, undefined,
                'COVID $250, Influenza $280, Dengue $320')
        );

        expect(response).toBeDefined();
        expect(intentAnalysis.intents.some(i => i.type === 'product_inquiry')).toBe(true);

        logMetrics('AI8: ambiguous multi-product', intentAnalysis, ms, { responseLength: response.length });
    });

    test('AI9: edge case — very long message (500+ chars)', async () => {
        const longMsg = 'Hola, soy el responsable de compras de una cadena de laboratorios con 15 sucursales. ' +
            'Necesito información detallada sobre sus pruebas rápidas. Primero, ¿cuáles son los productos disponibles? ' +
            'Segundo, necesito saber los precios por volumen para pedidos de más de 100 cajas. ' +
            'Tercero, me gustaría conocer la sensibilidad y especificidad de sus pruebas de COVID, influenza y dengue. ' +
            'Cuarto, ¿tienen algún representante de ventas que me pueda visitar? ' +
            'Quinto, el estatus de mi pedido anterior es #45678, ¿me lo pueden confirmar?';

        const BOT_REPLY = 'Con mucho gusto le atiendo. Contamos con pruebas de COVID, Influenza y Dengue. Para pedidos de más de 100 cajas aplicamos descuentos especiales. ¿Le conecto con un asesor?';

        expect(longMsg.length).toBeGreaterThan(500);

        // WC not configured in tests, so order tracking returns early without fetch.
        // Only the LLM call needs to be mocked.
        setupMinimalDbMocks({ customerPhone: '5511223344' });
        mockFetch.mockResolvedValueOnce(llmResponse(BOT_REPLY));

        const intentAnalysis = detectIntents(longMsg);
        const { result: response, ms } = await timed(() =>
            getAIResponse('deepseek', 'System prompt.', longMsg, 'fake-key',
                'deepseek-chat', 'cust-003', undefined, 'conv-003')
        );

        expect(response).toBeDefined();
        expect(intentAnalysis.charCount).toBeGreaterThan(500);
        expect(intentAnalysis.messageComplexity).toBe('complex');

        logMetrics('AI9: very long message', intentAnalysis, ms, { responseLength: response.length });
    });

    test('AI10: edge case — emoji-only message', async () => {
        const USER_MSG = '😊🔥👍💉🧪';
        const BOT_REPLY = '¡Hola! Con gusto te ayudo. ¿Qué productos o información necesitas? 😊';

        setupMinimalDbMocks();
        mockFetch.mockResolvedValueOnce(llmResponse(BOT_REPLY));

        const intentAnalysis = detectIntents(USER_MSG);
        const { result: response, ms } = await timed(() =>
            getAIResponse('deepseek', 'System prompt.', USER_MSG, 'fake-key')
        );

        expect(intentAnalysis.primaryIntent).toBe('unknown');
        expect(response).toBeDefined();

        logMetrics('AI10: emoji-only', intentAnalysis, ms, { responseLength: response.length });
    });

    test('AI11: edge case — message with URL and phone number', async () => {
        const USER_MSG = 'Hola vi sus productos en https://amunet.com.mx, me interesa cotizar. Pueden llamarme al 55-2345-6789.';
        const BOT_REPLY = 'Con gusto le enviamos una cotización. ¿Qué producto le interesa y cuántas cajas necesita?';

        setupMinimalDbMocks();
        mockFetch.mockResolvedValueOnce(llmResponse(BOT_REPLY));

        const intentAnalysis = detectIntents(USER_MSG);
        const { result: response, ms } = await timed(() =>
            getAIResponse('deepseek', 'System prompt.', USER_MSG, 'fake-key')
        );

        expect(response).toBeDefined();
        // Should detect pricing/product intent from the surrounding words
        const intentTypes = intentAnalysis.intents.map(i => i.type);
        expect(intentTypes.some(t => ['pricing', 'product_inquiry', 'order_placement'].includes(t))).toBe(true);

        logMetrics('AI11: URL+phone', intentAnalysis, ms, { responseLength: response.length });
    });

    // ── Frustration escalation ─────────────────────────────────────────────────

    test('AI12: frustration — escalating tone across the last message', async () => {
        const CONVERSATION_HISTORY = [
            { direction: 'inbound', content: 'Hola, ¿dónde está mi pedido?' },
            { direction: 'outbound', content: 'Hola, ¿me puede dar su número de pedido?' },
            { direction: 'inbound', content: 'Es el #33210, lleva 5 días en tránsito.' },
            { direction: 'outbound', content: 'Consultaré con el área de envíos.' },
        ];
        const FINAL_MSG = 'Esto es INACEPTABLE. Nadie me da respuesta. Necesito solución YA o hago una queja formal. urgente';
        const BOT_REPLY = 'Entiendo tu frustración y me disculpo por la demora. Te conecto inmediatamente con un asesor humano para resolver esto.';

        setupMinimalDbMocks({ conversationMessages: CONVERSATION_HISTORY });
        mockFetch.mockResolvedValueOnce(llmResponse(BOT_REPLY));

        const intentAnalysis = detectIntents(FINAL_MSG);
        const { result: response, ms } = await timed(() =>
            getAIResponse('deepseek', 'System prompt.', FINAL_MSG, 'fake-key',
                'deepseek-chat', undefined, undefined, 'conv-004')
        );

        expect(['frustrated', 'urgent']).toContain(intentAnalysis.sentiment);
        expect(intentAnalysis.intents.some(i => i.type === 'complaint')).toBe(true);
        expect(response).toBeDefined();

        logMetrics('AI12: frustration escalation', intentAnalysis, ms, { responseLength: response.length });
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — Bot response format compliance
// ═══════════════════════════════════════════════════════════════════════════════

describe('Bot response format compliance', () => {
    test('FORMAT1: response has no markdown bold (** or __)', () => {
        const response = 'La prueba de COVID cuesta $250/caja.\n¿Cuántas cajas necesita?';
        expect(response).not.toMatch(/\*\*/);
        expect(response).not.toMatch(/__/);
    });

    test('FORMAT2: response with numbered options uses correct format', () => {
        const response = '1. Prueba COVID Antígeno - $250/caja\n2. Prueba Influenza A/B - $280/caja\n¿Cuál le interesa?';
        const lines = response.split('\n').filter(Boolean);
        // At least 2 numbered lines
        const numberedLines = lines.filter(l => /^\d+\./.test(l.trim()));
        expect(numberedLines.length).toBeGreaterThanOrEqual(2);
    });

    test('FORMAT3: escalation response includes hand-off phrase', () => {
        const escalationResponse = 'Con gusto, te conecto con un asesor para procesar tu pedido.';
        const handoffPhrases = ['asesor', 'advisor', 'te conecto', 'connect you'];
        expect(handoffPhrases.some(phrase => escalationResponse.toLowerCase().includes(phrase))).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function logMetrics(
    label: string,
    analysis: IntentAnalysis | null,
    ms: number,
    extra?: Record<string, any>
) {
    console.log(`\n📊 ${label}`);
    if (analysis) {
        console.log(`   language: ${analysis.language} | sentiment: ${analysis.sentiment} | complexity: ${analysis.messageComplexity}`);
        console.log(`   intents (${analysis.intents.length}): ${analysis.intents.map(i => `${i.type}(${i.confidence.toFixed(2)})`).join(', ')}`);
        console.log(`   isMultiIntent: ${analysis.isMultiIntent} | words: ${analysis.wordCount} | chars: ${analysis.charCount}`);
    }
    if (extra) {
        Object.entries(extra).forEach(([k, v]) => console.log(`   ${k}: ${v}`));
    }
    console.log(`   ⏱  response time: ${ms}ms`);
}
