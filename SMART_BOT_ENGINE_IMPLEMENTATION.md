# Smart Bot Engine Implementation for Botón Médico CRM

## Overview

This document describes the comprehensive smart bot engine implementation that addresses all 4 optimization points for the Botón Médico CRM:

1. **Instant Campaign Response** - Auto-reply to ad clicks within seconds
2. **Automatic Lead Qualification** - Sequential questioning to score leads
3. **Medical Advisory AI** - Clinical guidance with RAG + decision rules
4. **Smart Routing** - Intelligent escalation based on intent classification

## Files Created

### 1. Database Migration
**File**: `/packages/db/migrations/005_smart_bot.sql`

Creates all necessary tables and enums:
- `bot_mode` enum: Tracks conversation state (campaign_response, qualification, medical_advisory, human_handoff, idle)
- `customer_profiles`: Stores business type, specialty, volume, detected interests, lead scores
- `conversation_state`: Tracks current qualification step and step-specific data
- `lead_scores`: Calculates professional_score (+30), volume_score (+20), engagement_score (+10)
- `bot_interactions`: Logs every bot action with type, confidence, and results
- `clinical_decision_rules`: Maps symptoms/conditions to product recommendations
- `medical_knowledge_chunks`: RAG chunks from technical sheets with embeddings
- `campaign_product_mappings`: Links campaigns to products for auto-reply

**Key Columns Added to Existing Tables**:
- `conversations`: bot_mode, qualification_step, referral_data, utm_data, bot_interaction_count, last_bot_interaction_at
- `customer_profiles`: lead_score, qualification_data (NEW TABLE)

### 2. Core Smart Bot Engine Service
**File**: `/apps/server/src/services/smart-bot-engine.ts`

The main orchestration engine with 4 points:

#### Point 1: Instant Campaign Response
```typescript
generateCampaignResponse(referralData, customerId, conversationId)
```
- Detects Meta ad referral data (ad_id)
- Looks up campaign-product mapping
- Sends product info + images within seconds
- Records bot interaction
- Updates conversation to campaign_response mode

#### Point 2: Lead Qualification
```typescript
runQualificationFlow(conversationId, customerId, message, currentStep)
```
- Sequential questioning: professional status → type → volume → location
- Validates answers against expected patterns
- Stores qualification data in conversation_state
- Calculates lead_score (0-100+)
- Routes "hot" leads (score 70+) to sales immediately

#### Point 3: Medical Advisory
```typescript
generateMedicalAdvisory(message, customerId, conversationId, aiProvider, apiKey)
```
- Generates embedding for semantic search
- Searches medical_knowledge_chunks (RAG)
- Gets AI recommendations from recommendation-engine
- Builds medical advisor prompt with context
- Returns clinical guidance with product suggestions
- Always includes medical disclaimers

#### Point 4: Smart Routing
```typescript
classifyIntent(message, conversationHistory)
routeConversation(classification, conversationId, customerId)
```
Intent detection (9 types):
- CAMPAIGN_RESPONSE / QUALIFICATION / MEDICAL_INQUIRY → Bot handles (confidence ≥ 0.6)
- PRICE_REQUEST (simple) → Bot handles; (complex) → Sales agent
- ORDER_STATUS → Support agent (has logistics access)
- COMPLAINT → Senior agent (priority: critical)
- HUMAN_NEEDED → Immediate handoff
- If confidence < 0.6 → Escalate automatically

#### Main Entry Point
```typescript
handleIncomingMessage(params) → BotResponse
```
- Orchestrates all 4 points in sequence
- Returns structured response with confidence, action_type, routing_decision
- Called from webhooks for every inbound message

### 3. Medical Products Seed Data
**File**: `/apps/server/src/data/medical-products-seed.ts`

Defines 12 real diagnostic test products for Amunet brand:

| Product | SKU | Category | Price (20-unit box) |
|---------|-----|----------|-------------------|
| HbA1c | HBAC-001 | metabolica | $1,668 MXN |
| Embarazo (hCG) | EMBA-001 | prenatal | $540 MXN |
| Antidoping Orina | ANTI-U-001 | toxicologia | $820 MXN |
| Antidoping Sangre | ANTI-S-001 | toxicologia | $1,200 MXN |
| Influenza A/B | INFL-001 | respiratoria | $780 MXN |
| COVID-19 Antígeno | COVID-001 | respiratoria | $920 MXN |
| VIH 1&2 (3a Gen) | HIV-001 | infecciosa | $1,560 MXN |
| Sífilis (VDRL/RPR) | SIFI-001 | infecciosa | $1,020 MXN |
| Hepatitis B (HBsAg) | HEPAT-B-001 | infecciosa | $1,140 MXN |
| Vitamina D | VIT-D-001 | metabolica | $1,181 MXN |
| RSV | RSV-001 | respiratoria | $890 MXN |
| Panel Respiratorio | RESP-PANEL-001 | respiratoria | $2,050 MXN |

**Each Product Includes**:
- Multiple presentations (units: 1, 5, 20)
- Clinical info: sensitivity, specificity, sample type, result time, storage, COFEPRIS registration
- Indications: clinical uses (Spanish)
- Procedure steps: how to perform test
- Interpretation: how to read results
- Complementary products: cross-sell SKUs
- Target profiles: laboratorio, farmacia, consultorio, hospital, clinica
- Keywords: Spanish terms customers use to search

### 4. Clinical Decision Rules Seed
**File**: `/apps/server/src/data/clinical-rules-seed.ts`

10 rules that map symptoms/conditions to products:

1. **Screening Prenatal Completo** → Embarazo + VIH + Sífilis + Hepatitis B (priority: 95)
2. **Síntomas Respiratorios** → Panel Respiratorio (priority: 90)
3. **Control Diabetes** → HbA1c (priority: 88)
4. **Antidoping Laboral** → Antidoping Orina (priority: 80)
5. **Antidoping Clínico/Urgencias** → Antidoping Sangre (priority: 85)
6. **Screening ETS** → VIH + Sífilis + Hepatitis B (priority: 85)
7. **Influenza** → Influenza A/B (priority: 75)
8. **Bronquiolitis en Lactantes** → RSV + Panel (priority: 82)
9. **Deficiencia Vitamina D** → Vitamina D (priority: 70)
10. **COVID-19** → COVID Antígeno (priority: 80)

**Each Rule**:
- Trigger keywords (Spanish medical terms)
- Recommended product IDs
- Client profile filter (which business types benefit)
- Complementary products for cross-sell
- Priority (higher = evaluated first)

### 5. Qualification Flow Templates
**File**: `/apps/server/src/data/qualification-flows.ts`

Defines multi-step qualification conversations:

**Campaign Lead Flow** (4 questions):
1. ¿Es profesional de salud? → +30 points
2. ¿Qué tipo de profesión?
3. ¿Volumen mensual aproximado? → +20 points
4. ¿Ubicación ciudad/estado?

**Repeat Customer Flow** (2 questions):
1. ¿Reorden o consulta disponibilidad?
2. ¿Qué producto?

**Medical Inquiry Flow** (2 questions):
1. Contexto clínico?
2. Producto específico?

**Scoring**:
- Professional: +30
- Volume (1000+): +20
- Volume (201-1000): +15
- Engagement (per answer): +5
- **Routing decision**: Score ≥70 = Hot lead → Sales (same day), ≥50 = Warm → Sales (24h), <50 = Nurturing

### 6. Updated Webhooks
**File**: `/apps/server/src/routes/webhooks.ts` (Modified)

**Changes**:
- Imported `handleIncomingMessage` from smart-bot-engine
- Modified `handleBotResponse()` to:
  - Detect if first message (for campaign response)
  - Call smart bot engine instead of separate campaign-responder + basic bot
  - Handle escalation through routing_decision
  - Log bot interactions with type and confidence
- Simplified Meta webhook: removed separate `handleCampaignAutoReply()` call
- Simplified WhatsApp webhook: unified message handling

**Flow**:
```
Inbound Message
  ↓
Resolve/Create Customer
  ↓
Create/Get Conversation
  ↓
Save Inbound Message
  ↓
handleBotResponse()
  ├─ Get AI settings
  ├─ handleIncomingMessage() [SMART BOT ENGINE]
  │  ├─ Campaign Response (if first msg + ad referral)
  │  ├─ Qualification Flow (if in progress)
  │  ├─ Intent Classification
  │  └─ Smart Routing
  ├─ Execute Escalation (if needed)
  └─ Save Outbound Message
```

## Key Features

### 1. Instant Campaign Response
- **Problem solved**: 6h 41m avg first response → seconds
- **Mechanism**: Meta Click-to-DM includes ad_id in referral object
- **Action**: Lookup campaign_product_mapping, send welcome + media
- **Result**: Lead knows product within 30 seconds of clicking ad

### 2. Automatic Lead Qualification
- **Problem solved**: Manual routing by Fernando (246 tickets/week)
- **Mechanism**: Sequential questions capture business type + volume
- **Scoring**:
  - Professional: +30
  - High volume: +20
  - Engagement: +10
- **Routing**:
  - Hot (70+): Sales agent, same day
  - Warm (50-69): Sales agent, 24h
  - Cold (<50): Nurturing sequence

### 3. Medical Advisory AI
- **Problem solved**: Agents copy-paste product info manually
- **Mechanism**: RAG search + clinical rules + AI generation
- **Input**: Medical question in Spanish
- **Output**: Product recommendations with clinical justification
- **Safety**: Includes disclaimers, doesn't diagnose

### 4. Smart Routing
- **Problem solved**: All tickets escalate (no bot confidence)
- **Mechanism**: Intent classification + confidence scoring
- **Logic**:
  - Confidence ≥ 0.8 → Bot handles fully
  - 0.6-0.8 → Bot replies + monitor
  - < 0.6 → Escalate automatically
- **After 3 bot messages without engagement**: Offer human handoff
- **Complaint handling**: Immediate escalation to senior agent

## Integration Steps

### Step 1: Create Database Tables
```bash
psql -U postgres -d myalice_clone -f packages/db/migrations/005_smart_bot.sql
```

### Step 2: Seed Product Catalog
In your Node.js initialization (e.g., `apps/server/src/index.ts`):
```typescript
import { seedMedicalProducts } from './data/medical-products-seed';
import { seedClinicalRules } from './data/clinical-rules-seed';

// After db connection:
await seedMedicalProducts(db);
await seedClinicalRules(db);
```

### Step 3: Verify Webhooks
The webhook handler is already updated. Verify:
- Meta webhook: `/api/webhooks/meta` receives referral data
- WhatsApp webhook: `/api/webhooks/whatsapp` receives message
- Both now use handleIncomingMessage() from smart-bot-engine

### Step 4: Test Campaign Response
1. Create campaign in Meta Ads Manager with Click-to-DM
2. Create campaign_product_mapping in database
3. Click ad and message → Should receive product info within seconds

### Step 5: Test Qualification Flow
1. Send message without campaign referral
2. Should receive first qualification question
3. Answer each question
4. After 4 questions, should be scored and routed

## Performance Expectations

### Response Times
- Campaign response: 0.5-2 seconds
- Qualification question: 0.1-0.5 seconds
- Medical advisory: 1-3 seconds (depends on AI provider)
- Intent classification: 0.05 seconds

### Bot Handling Rates (Target)
- Campaign-related: 95%+ (fully automated)
- Qualification: 98%+ (structured questions)
- Medical advisory: 85%+ (if confident)
- Pricing: 60%+ (simple products only)
- Complaints: 0% (always escalate)

### Lead Quality
- Hot leads (score 70+): Require sales follow-up
- Warm leads (50-69): Schedule 24h contact
- Cold leads (<50): Nurture with educational content

## Monitoring

### Key Metrics
```sql
-- Bot interaction summary
SELECT
    interaction_type,
    COUNT(*) as count,
    AVG(confidence) as avg_confidence,
    DATE(created_at) as date
FROM bot_interactions
GROUP BY interaction_type, DATE(created_at)
ORDER BY date DESC;

-- Lead scores distribution
SELECT
    CASE
        WHEN total_score >= 70 THEN 'hot'
        WHEN total_score >= 50 THEN 'warm'
        ELSE 'cold'
    END as segment,
    COUNT(*) as count,
    AVG(total_score) as avg_score
FROM lead_scores
GROUP BY segment;

-- Escalation reasons
SELECT
    reason,
    COUNT(*) as count,
    target_type
FROM bot_interactions
WHERE action_taken = 'escalate'
GROUP BY reason, target_type
ORDER BY count DESC;
```

### Dashboards
- Real-time bot interactions (type, confidence, action)
- Lead score distribution (hot/warm/cold)
- Escalation reasons (top 10)
- Response times by intent
- Customer profile completeness

## Future Enhancements

1. **Multi-language support**: Extend to English, Portuguese
2. **Sentiment analysis**: Detect frustration, escalate proactively
3. **Order status integration**: Connect to WooCommerce real-time
4. **Bulk pricing engine**: Dynamic quotes based on volume
5. **Agent performance tracking**: Which agents resolve complaints fastest
6. **A/B testing**: Test different qualification questions
7. **Customer segmentation**: Target nurturing by profile

## Troubleshooting

### Issue: Campaign Response Not Triggering
- Verify referral data is present in webhook payload
- Check campaign_product_mapping exists and is_active = TRUE
- Look at bot_interactions table for errors

### Issue: Qualification Not Advancing
- Verify expected_patterns keywords match user answer
- Check conversation_state.step_data for stored answers
- Ensure next_step is pointing to correct step ID

### Issue: Medical Advisory Low Confidence
- Check medical_knowledge_chunks table is populated
- Verify embedding similarity > 0.3
- Review bot_interactions.result for which recommendations were used

### Issue: False Escalations
- Review intent classification confidence threshold (currently 0.6)
- Check keywords_matched in bot_interactions
- Consider tuning per intent type thresholds

## Files Reference

| File | Type | Purpose |
|------|------|---------|
| `packages/db/migrations/005_smart_bot.sql` | SQL | Schema for bot state, qualification, scoring |
| `apps/server/src/services/smart-bot-engine.ts` | TypeScript | Core orchestration engine |
| `apps/server/src/data/medical-products-seed.ts` | TypeScript | 12 products with clinical data |
| `apps/server/src/data/clinical-rules-seed.ts` | TypeScript | 10 clinical decision rules |
| `apps/server/src/data/qualification-flows.ts` | TypeScript | Qualification question flows |
| `apps/server/src/routes/webhooks.ts` | TypeScript (Modified) | Webhook integration |

---

**Implementation Date**: March 20, 2026
**Status**: Production Ready
**Lead Optimization**: 4/4 points implemented
