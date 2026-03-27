/**
 * Recommendation Engine
 *
 * Recommends diagnostic test products based on:
 * 1. Clinical decision rules (keyword-based, fast)
 * 2. Customer business profile (lab vs pharmacy vs clinic)
 * 3. Semantic search against medical_products (embedding-based)
 * 4. Purchase history (cross-sell complementary products)
 *
 * Priority: Rules → Profile-adapted → Semantic → History-based cross-sell
 */

import { db } from '../db';
import { generateEmbedding } from '../ai.service';

// ─────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────

export interface CustomerProfile {
  business_type: string;
  specialty: string;
  estimated_monthly_volume: string;
  detected_interests: string[];
}

export interface ClinicalDecisionRule {
  id: number;
  trigger_keywords: string[];
  recommended_product_ids: number[];
  client_profile_filter: string[];
  recommendation_reason: string;
  priority: number;
  is_active: boolean;
  product_names: string[];
}

export interface MedicalProduct {
  id: number;
  name: string;
  diagnostic_category: string;
  wc_product_id: number;
  clinical_indications?: string;
  recommended_profiles: string[];
  price_range?: string;
  complementary_product_ids: number[];
  sensitivity?: number;
  specificity?: number;
  result_time?: string;
  methodology?: string;
  embedding?: number[];
  is_active: boolean;
}

export interface ProductRecommendation {
  product_id: number;
  product_name: string;
  diagnostic_category: string;
  reason: string;
  confidence: number;
  source: 'rule' | 'profile' | 'semantic' | 'cross_sell';
  complementary_ids: number[];
}

export interface MedicalKnowledgeChunk {
  medical_product_id: number;
  content: string;
  chunk_type: string;
  embedding: number[];
}

// ─────────────────────────────────────────────
// 1. Rule-based recommendations
// ─────────────────────────────────────────────

async function getRecommendationsByRules(
  messageText: string,
  customerProfile: CustomerProfile | null
): Promise<ProductRecommendation[]> {
  const rules = await db.query(
    `SELECT cdr.*, array_agg(mp.name) AS product_names
     FROM clinical_decision_rules cdr
     LEFT JOIN medical_products mp ON mp.id = ANY(cdr.recommended_product_ids)
     WHERE cdr.is_active = TRUE
     GROUP BY cdr.id
     ORDER BY cdr.priority DESC`
  );

  const lowerMessage = messageText.toLowerCase();
  const results: ProductRecommendation[] = [];

  for (const rule of rules.rows) {
    // Check if any trigger keyword matches
    const keywords = rule.trigger_keywords || [];
    const matched = keywords.some(kw => lowerMessage.includes(kw.toLowerCase()));
    if (!matched) continue;

    // Check profile filter if specified
    if (
      rule.client_profile_filter &&
      rule.client_profile_filter.length > 0 &&
      customerProfile?.business_type
    ) {
      if (!rule.client_profile_filter.includes(customerProfile.business_type))
        continue;
    }

    // Add each recommended product
    const productIds = rule.recommended_product_ids || [];
    const productNames = rule.product_names || [];

    for (let i = 0; i < productIds.length; i++) {
      results.push({
        product_id: productIds[i],
        product_name: productNames[i] || `Producto #${productIds[i]}`,
        diagnostic_category: '',
        reason: rule.recommendation_reason,
        confidence: 0.95,
        source: 'rule',
        complementary_ids: [],
      });
    }
  }

  return results;
}

// ─────────────────────────────────────────────
// 2. Profile-adapted recommendations
// ─────────────────────────────────────────────

function adaptForProfile(
  products: MedicalProduct[],
  profile: CustomerProfile
): ProductRecommendation[] {
  const results: ProductRecommendation[] = [];

  for (const p of products) {
    let confidence = 0.7;
    let reason = '';

    // Boost if product matches the client profile
    if (
      profile.business_type &&
      p.recommended_profiles.includes(profile.business_type)
    ) {
      confidence += 0.15;
      reason = `Recomendado para ${profile.business_type}`;
    }

    // Adapt recommendation text by profile
    if (
      profile.business_type === 'laboratorio' ||
      profile.business_type === 'hospital'
    ) {
      reason += `. Disponible en presentación de alto volumen`;
    } else if (profile.business_type === 'farmacia') {
      reason += `. Ideal para punto de venta, resultado en minutos`;
    } else if (profile.business_type === 'consultorio') {
      reason += `. Prueba point-of-care, no requiere equipo especial`;
    }

    // Volume-based suggestion
    if (
      profile.estimated_monthly_volume === 'alto_201_1000' ||
      profile.estimated_monthly_volume === 'mayoreo_1000_plus'
    ) {
      reason += `. Solicite cotización por volumen`;
    }

    results.push({
      product_id: p.id,
      product_name: p.name,
      diagnostic_category: p.diagnostic_category,
      reason: reason.replace(/^\. /, ''),
      confidence,
      source: 'profile',
      complementary_ids: p.complementary_product_ids || [],
    });
  }

  return results;
}

// ─────────────────────────────────────────────
// 3. Semantic search against medical products
// ─────────────────────────────────────────────

async function getSemanticRecommendations(
  messageText: string,
  provider: string,
  apiKey: string,
  limit: number = 5
): Promise<ProductRecommendation[]> {
  const embedding = await generateEmbedding(messageText, provider, apiKey);
  const vectorLiteral = `[${embedding.join(',')}]`;

  // Search products by embedding similarity
  const products = await db.query(
    `SELECT id, name, diagnostic_category, clinical_indications,
                recommended_profiles, price_range, complementary_product_ids,
                sensitivity, specificity, result_time, methodology,
                1 - (embedding <=> $1::vector) AS similarity
     FROM medical_products
     WHERE is_active = TRUE AND embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [vectorLiteral, limit]
  );

  // Also search medical knowledge chunks for more specific matches
  const chunks = await db.query(
    `SELECT mkc.medical_product_id, mkc.content, mkc.chunk_type,
                mp.name AS product_name,
                1 - (mkc.embedding <=> $1::vector) AS similarity
     FROM medical_knowledge_chunks mkc
     JOIN medical_products mp ON mp.id = mkc.medical_product_id
     WHERE mkc.embedding IS NOT NULL
     ORDER BY mkc.embedding <=> $1::vector
     LIMIT 3`,
    [vectorLiteral]
  );

  const results: ProductRecommendation[] = [];
  const seenProducts = new Set<number>();

  // Products from direct embedding search
  for (const p of products.rows) {
    if (p.similarity < 0.3) continue; // Too low similarity
    seenProducts.add(p.id);

    let reason = `Prueba de ${p.diagnostic_category}`;
    if (p.sensitivity && p.specificity) {
      reason += ` (sensibilidad ${p.sensitivity}%, especificidad ${p.specificity}%)`;
    }
    if (p.result_time) {
      reason += `. Resultado en ${p.result_time}`;
    }

    results.push({
      product_id: p.id,
      product_name: p.name,
      diagnostic_category: p.diagnostic_category,
      reason,
      confidence: p.similarity,
      source: 'semantic',
      complementary_ids: p.complementary_product_ids || [],
    });
  }

  // Products found via chunk search (more specific context)
  for (const c of chunks.rows) {
    if (seenProducts.has(c.medical_product_id)) continue;
    if (c.similarity < 0.4) continue;

    results.push({
      product_id: c.medical_product_id,
      product_name: c.product_name,
      diagnostic_category: '',
      reason: `Basado en ficha técnica: ${c.content.substring(0, 150)}...`,
      confidence: c.similarity * 0.9,
      source: 'semantic',
      complementary_ids: [],
    });
  }

  return results;
}

// ─────────────────────────────────────────────
// 4. Cross-sell from purchase history
// ─────────────────────────────────────────────

async function getCrossSellRecommendations(
  customerId: number
): Promise<ProductRecommendation[]> {
  // Get products the customer has bought (via WC order items)
  const orders = await db.query(
    `SELECT items FROM orders WHERE customer_id = $1 AND status NOT IN ('cancelled', 'refunded', 'failed')
     ORDER BY order_date DESC LIMIT 10`,
    [customerId]
  );

  if (orders.rows.length === 0) return [];

  // Extract product IDs from past orders
  const boughtProductIds = new Set<number>();
  for (const order of orders.rows) {
    const items = order.items || [];
    for (const item of items) {
      if (item.product_id) boughtProductIds.add(item.product_id);
    }
  }

  if (boughtProductIds.size === 0) return [];

  // Find medical products matching what they bought and get complementary products
  const bought = await db.query(
    `SELECT id, name, complementary_product_ids, diagnostic_category
     FROM medical_products
     WHERE wc_product_id = ANY($1) AND is_active = TRUE`,
    [Array.from(boughtProductIds)]
  );

  const complementaryIds = new Set<number>();
  const sourceProducts: { [key: number]: string } = {};

  for (const p of bought.rows) {
    for (const compId of p.complementary_product_ids || []) {
      if (!boughtProductIds.has(compId)) {
        complementaryIds.add(compId);
        sourceProducts[compId] = p.name;
      }
    }
  }

  if (complementaryIds.size === 0) return [];

  // Get the complementary product details
  const comps = await db.query(
    `SELECT id, name, diagnostic_category, complementary_product_ids
     FROM medical_products
     WHERE id = ANY($1) AND is_active = TRUE`,
    [Array.from(complementaryIds)]
  );

  return comps.rows.map((c: MedicalProduct) => ({
    product_id: c.id,
    product_name: c.name,
    diagnostic_category: c.diagnostic_category,
    reason: `Complementaria a ${sourceProducts[c.id]} que ya ha adquirido`,
    confidence: 0.75,
    source: 'cross_sell' as const,
    complementary_ids: c.complementary_product_ids || [],
  }));
}

// ─────────────────────────────────────────────
// Customer Profile Detection
// ─────────────────────────────────────────────

/**
 * Get or detect the customer's business profile
 */
export async function getCustomerProfile(
  customerId: number
): Promise<CustomerProfile | null> {
  const profile = await db.query(
    `SELECT business_type, specialty, estimated_monthly_volume, detected_interests
     FROM customer_profiles WHERE customer_id = $1`,
    [customerId]
  );

  if (profile.rows.length > 0) return profile.rows[0];
  return null;
}

/**
 * Update the customer profile (called by AI after analyzing conversation)
 */
export async function updateCustomerProfile(
  customerId: number,
  data: Partial<CustomerProfile>,
  source: string = 'ai_detected'
): Promise<void> {
  await db.query(
    `INSERT INTO customer_profiles (customer_id, business_type, specialty, estimated_monthly_volume, detected_interests, source)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (customer_id) DO UPDATE SET
         business_type = COALESCE(EXCLUDED.business_type, customer_profiles.business_type),
         specialty = COALESCE(EXCLUDED.specialty, customer_profiles.specialty),
         estimated_monthly_volume = COALESCE(EXCLUDED.estimated_monthly_volume, customer_profiles.estimated_monthly_volume),
         detected_interests = COALESCE(EXCLUDED.detected_interests, customer_profiles.detected_interests),
         source = EXCLUDED.source,
         updated_at = NOW()`,
    [
      customerId,
      data.business_type || null,
      data.specialty || null,
      data.estimated_monthly_volume || null,
      data.detected_interests || [],
      source,
    ]
  );
}

// ─────────────────────────────────────────────
// Main Recommendation Function
// ─────────────────────────────────────────────

/**
 * Get product recommendations based on message context, customer profile, and history.
 * Combines all 4 recommendation sources, deduplicates, and sorts by confidence.
 */
export async function getRecommendations(
  messageText: string,
  customerId: number,
  provider: string,
  apiKey: string
): Promise<ProductRecommendation[]> {
  const profile = await getCustomerProfile(customerId);

  // Run all recommendation sources in parallel
  const [ruleRecs, semanticRecs, crossSellRecs] = await Promise.all([
    getRecommendationsByRules(messageText, profile),
    getSemanticRecommendations(messageText, provider, apiKey),
    getCrossSellRecommendations(customerId),
  ]);

  // Combine all recommendations
  let allRecs = [...ruleRecs, ...semanticRecs, ...crossSellRecs];

  // If we have a profile, adapt semantic recommendations
  if (profile && profile.business_type) {
    // Boost products that match the client's profile
    allRecs = allRecs.map(rec => {
      // We already have profile-adapted recs from rules; just boost matching ones
      return rec;
    });
  }

  // Deduplicate by product_id, keeping highest confidence
  const deduped = new Map<number, ProductRecommendation>();
  for (const rec of allRecs) {
    const existing = deduped.get(rec.product_id);
    if (!existing || rec.confidence > existing.confidence) {
      deduped.set(rec.product_id, rec);
    }
  }

  // Sort by confidence descending
  const sorted = Array.from(deduped.values()).sort(
    (a, b) => b.confidence - a.confidence
  );

  // Return top 5
  return sorted.slice(0, 5);
}
