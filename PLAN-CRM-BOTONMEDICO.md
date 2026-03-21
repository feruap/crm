# Plan Maestro: CRM Botón Médico
## De sistema fragmentado a plataforma unificada implementable

---

## 1. Estado Actual — Lo que ya existe

### 1.1 MyAlice CRM (Node.js/Next.js + PostgreSQL)
| Módulo | Estado | Notas |
|--------|--------|-------|
| Mensajería omnicanal (WhatsApp, FB, IG, Web) | ✅ Funcional | Webhooks Meta + WhatsApp Cloud API |
| Perfil universal de cliente (UCP) | ✅ Funcional | `external_identities` unifica canales |
| Bot con IA + RAG (Knowledge Base con pgvector) | ✅ Funcional | DeepSeek, Claude, Gemini, Z.ai |
| Atribución de campañas | ✅ Parcial | Click-to-DM detecta `ad_id`, falta multi-touch |
| Quick Replies (respuestas rápidas) | ✅ Funcional | Scope personal/equipo/global |
| Flows de bot (visual + simple) | ✅ Parcial | Triggers: keyword, first_message, campaign, after_hours |
| Pipelines / Kanban | ✅ Básico | Stages por pipeline, drag-and-drop |
| Asignación automática de agentes | ✅ Funcional | Round-robin, random, least-busy |
| Panel de supervisor | ✅ Básico | Métricas por agente |
| Horario de atención | ✅ Funcional | Timezone-aware |
| Agenda / Eventos | ✅ Funcional | Meetings, calls, demos, follow-ups |
| Simulador de conversaciones | ✅ Funcional | Entrenamiento de agentes |

### 1.2 WooCommerce + Plugins
| Plugin | Estado | Notas |
|--------|--------|-------|
| SalesKing 1.8.10 | ✅ Maduro | Comisiones, jerarquía de agentes, grupos, earnings |
| SalesKing Custom Discounts 2.0 | ✅ Maduro | Aprobación jerárquica, routing por cadena de mando |
| Kanban for WooCommerce 5.0 | ✅ Maduro | Permisos por rol, filtros por jerarquía SK |
| AlmacenPT 2.1 | ✅ Funcional | Inventario con lotes y caducidades |
| Facebook for WooCommerce | ✅ Instalado | Pixel + CAPI |
| Google Listings & Ads | ✅ Instalado | Feed + tracking |
| B2BKing | ✅ Instalado | Precios mayoreo |

### 1.3 Integraciones existentes entre sistemas
- WooCommerce → CRM: Webhook de órdenes (`/api/attributions/woocommerce-sync`)
- SalesKing → CRM: Webhook de órdenes B2B (`/api/attributions/salesking-sync`)
- CRM → WooCommerce: Sync de productos al knowledge base del bot
- Kanban WC lee jerarquía de SalesKing (`salesking_parent_agent`)

---

## 2. Gaps Identificados — Lo que falta

### GAP 1: Atribución precisa de campañas
**Problema:** Sabes que un lead llegó de Facebook, pero no de cuál campaña/anuncio exacto en todos los casos.

**Estado actual:**
- Click-to-DM: ✅ Captura `ad_id` del referral de Meta
- UTM en WooCommerce: ✅ Se guardan en order meta
- Google Ads GCLID: ⚠️ Campo existe en schema pero no hay push a Conversion API
- Facebook CAPI server-side: ⚠️ Plugin instalado pero no conectado al CRM
- Multi-touch attribution: ❌ Solo first-touch (primera interacción)

**Lo que falta construir:**
1. **Captura UTM en chat widgets** — Cuando alguien llega al webchat desde una landing con UTMs, esos parámetros no se pasan al CRM
2. **Google Ads Conversion API** — Enviar conversiones de vuelta a Google cuando se cierra una venta
3. **Facebook CAPI desde el CRM** — Enviar eventos de conversión server-side cuando el bot o agente genera una venta
4. **Modelo multi-touch** — Hoy solo se registra el primer contacto. Si un cliente vio un anuncio en FB, luego buscó en Google, luego mandó WhatsApp... solo se atribuye al último canal
5. **Dashboard de atribución por anuncio** — Ver exactamente qué anuncio genera qué ventas y su ROAS real

---

### GAP 2: Bot médico especializado (cross-sell / upsell inteligente)
**Problema:** Tus agentes no son médicos. Los clientes son profesionales de salud que preguntan qué prueba usar para cierto caso clínico. Un bot con conocimiento médico podría asesorar mejor y generar ventas cruzadas.

**Estado actual:**
- Bot con RAG + knowledge base: ✅ Existe
- Catálogo de productos inyectado al system prompt: ✅ Existe
- Aprendizaje automático de conversaciones resueltas: ✅ Existe
- Conocimiento médico de diagnóstico: ❌ No existe
- Lógica de recomendación por tipo de paciente: ❌ No existe
- Cross-sell/upsell basado en perfil del profesional: ❌ No existe

**Lo que falta construir:**
1. **Knowledge base médica estructurada** — Base de datos de cada prueba rápida con: indicaciones clínicas, sensibilidad/especificidad, tipo de muestra, tiempo de resultado, pruebas complementarias recomendadas, normativa aplicable (COFEPRIS si aplica)
2. **Motor de recomendación por perfil** — Si el cliente es laboratorio clínico → recomendar panel completo. Si es consultorio → pruebas point-of-care. Si es farmacia → pruebas OTC
3. **Prompt médico especializado** — System prompt que hable como asesor técnico médico, no como vendedor. Que entienda terminología: PCR, inmunocromatografía, sensibilidad analítica, etc.
4. **Árbol de decisión por caso clínico** — "Paciente con síntomas respiratorios" → Influenza A/B + COVID + RSV. "Screening prenatal" → Embarazo + VIH + Sífilis + Hepatitis B
5. **Fichas técnicas como contexto** — PDF/documentos técnicos de cada producto indexados con embeddings para que el bot cite especificaciones reales

---

### GAP 3: Respuestas automáticas por campaña
**Problema:** Hoy los agentes activan canned responses manualmente. Si sabes de qué campaña viene el lead, podrías enviar automáticamente información específica del producto anunciado.

**Estado actual:**
- Campaign-based flow triggers: ✅ Existe en schema de `bot_flows`
- Quick replies manuales: ✅ Existe
- Auto-selección de respuesta por campaña: ❌ No implementado
- Mapeo campaña → producto → contenido: ❌ No existe

**Lo que falta construir:**
1. **Mapeo Campaña → Producto → Contenido** — UI para asociar: Campaña FB "Pruebas Antidoping" → Producto "Kit Antidoping 5 paneles" → Mensaje de bienvenida + ficha técnica + precios
2. **Auto-trigger por origen** — Cuando el webhook de Meta trae `ad_id`, el bot automáticamente envía el contenido mapeado antes de que el agente intervenga
3. **Templates multimedia** — No solo texto: enviar imágenes del producto, PDF de ficha técnica, video demostrativo vía WhatsApp/Messenger
4. **A/B testing de respuestas** — Medir qué mensaje inicial genera más conversiones por campaña

---

### GAP 4: Handoff inteligente bot → humano
**Problema:** El bot necesita saber cuándo transferir a un humano, no solo por baja confianza sino por contexto.

**Estado actual:**
- Threshold de confianza (0.82): ✅ Existe
- Nodo `human_handoff` en flows visuales: ✅ Existe
- Escalación por contexto: ❌ No existe
- Preservación de contexto en handoff: ⚠️ Parcial

**Lo que falta construir:**
1. **Reglas de escalación contextual:**
   - Cliente pide precio especial/descuento → transferir a agente con permisos de descuento
   - Cliente menciona queja/problema con pedido anterior → transferir a soporte
   - Cliente listo para comprar (señales de cierre) → transferir a agente de ventas
   - Pregunta técnica fuera del knowledge base → transferir a especialista
   - Cliente VIP (historial de compras alto) → transferir a agente senior
2. **Resumen de contexto para el agente** — Cuando el bot transfiere, generar un resumen: "Cliente: Dr. López, Laboratorio XYZ. Preguntó por pruebas de influenza para 500 pacientes/mes. Bot le recomendó Kit A y Kit B. Parece interesado en cotización por volumen."
3. **Routing inteligente** — No solo round-robin: asignar al agente que mejor maneja ese tipo de producto/cliente basado en historial de conversiones

---

### GAP 5: Flows basados en historial de compras
**Problema:** Si un cliente ya compró antes, el flujo de atención debería ser diferente. Reorden, seguimiento, complementarios.

**Estado actual:**
- Órdenes WC en panel del cliente: ✅ Se muestran (últimas 10)
- Lifetime spending calculado: ✅ Existe
- Flows activados por historial: ❌ No existe
- Segmentación por comportamiento de compra: ❌ No existe

**Lo que falta construir:**
1. **Triggers por historial:**
   - Cliente con pedido pendiente → "Hola, veo que tu pedido #1234 está en camino. ¿Necesitas algo más?"
   - Cliente recurrente que no compra hace 30+ días → "¿Te gustaría reordenar tu último pedido de Pruebas COVID?"
   - Cliente que compró Producto A pero nunca B (complementario) → Sugerir B
2. **Segmentación automática:**
   - Por frecuencia de compra (mensual, trimestral, ocasional)
   - Por categoría de productos (antidoping, embarazo, infecciosas, etc.)
   - Por volumen (menudeo vs mayoreo)
   - Por tipo de negocio (farmacia, laboratorio, consultorio, hospital)
3. **Pipeline de reorden** — Etapa especial en Kanban para seguimiento de clientes que deberían reordenar

---

### GAP 6: Sincronización profunda WooCommerce ↔ CRM
**Problema:** La sincronización actual es básica (webhook de órdenes). Falta bidireccionalidad y datos de comisiones/descuentos.

**Estado actual:**
- WC → CRM órdenes: ✅ Webhook básico
- CRM → WC metadata: ⚠️ Flag existe pero sync incompleto
- Comisiones SalesKing en CRM: ❌ No se sincronizan
- Estado Kanban WC ↔ CRM Pipeline: ❌ Independientes
- Descuentos pendientes en CRM: ❌ No visibles

**Lo que falta construir:**
1. **Sync bidireccional de estado de orden** — Cuando el agente mueve un pedido en el CRM, que se refleje en WC Kanban y viceversa
2. **Comisiones en el CRM** — Que el agente vea sus earnings, balance pendiente, y payouts desde el CRM sin ir a WordPress
3. **Solicitudes de descuento desde el CRM** — Que el agente pueda solicitar un descuento desde la conversación, sin cambiar de sistema
4. **Webhook de WC → CRM para cambios de estado** — Hoy solo se sincroniza al crear orden; falta sincronizar cuando cambia de estado (processing, completed, refunded)
5. **Inventario visible en CRM** — Que el bot/agente sepa si hay stock disponible antes de prometer entrega

---

## 3. Plan de Implementación — Fases

### FASE 1: Fundamentos (2-3 semanas)
> Objetivo: Cerrar los gaps que bloquean la operación diaria

| # | Módulo | Descripción | Prioridad |
|---|--------|-------------|-----------|
| 1.1 | Sync WC bidireccional | Webhooks para status changes WC→CRM y API calls CRM→WC | 🔴 Crítica |
| 1.2 | Captura UTM en webchat | Pasar UTMs del navegador al widget de chat | 🔴 Crítica |
| 1.3 | Mapeo campaña→producto | CRUD para asociar campaña, producto, y contenido de respuesta | 🔴 Crítica |
| 1.4 | Auto-respuesta por campaña | Trigger automático del contenido mapeado cuando llega lead de campaña conocida | 🔴 Crítica |

**Entregables:**
- Endpoint `POST /api/webhooks/woocommerce-status` para recibir cambios de estado
- Endpoint `PUT /api/orders/:id/status` para cambiar estado desde CRM → WC REST API
- Widget JS que lee `utm_*` de `document.referrer` o `URL.searchParams` y los envía como metadata del primer mensaje
- Tabla `campaign_product_mappings` (campaign_id, product_id, welcome_message, media_urls, auto_send: boolean)
- Lógica en webhook handler: si `ad_id` → buscar mapping → enviar contenido automático

---

### FASE 2: Bot Médico Inteligente (3-4 semanas)
> Objetivo: Bot que habla como asesor técnico médico y genera cross-sell

| # | Módulo | Descripción | Prioridad |
|---|--------|-------------|-----------|
| 2.1 | Knowledge base médica | Estructura para fichas técnicas de pruebas de diagnóstico | 🔴 Crítica |
| 2.2 | Indexación de fichas PDF | Pipeline para extraer, chunkar e indexar PDFs técnicos con embeddings | 🟡 Alta |
| 2.3 | System prompt médico | Prompt especializado en diagnóstico clínico y venta consultiva | 🔴 Crítica |
| 2.4 | Motor de recomendación | Lógica: síntomas/caso → pruebas recomendadas + complementarias | 🟡 Alta |
| 2.5 | Perfilamiento de cliente | Detectar tipo de negocio (lab, farmacia, consultorio) y adaptar recomendaciones | 🟡 Alta |

**Entregables:**
- Tabla `medical_products` con campos: nombre, categoría_diagnóstica, indicaciones[], tipo_muestra, sensibilidad, especificidad, tiempo_resultado, pruebas_complementarias[], perfil_recomendado[]
- Script de ingesta de PDFs → chunks → embeddings → `knowledge_base`
- System prompt con: terminología médica, reglas de recomendación, tono de asesor técnico, instrucciones de cross-sell natural
- Función `getRecommendations(symptoms[], clientProfile)` → productos[] con razón de recomendación
- Metadata en `customers`: tipo_negocio, especialidad, volumen_mensual_estimado

---

### FASE 3: Inteligencia de Handoff y Flujos (2-3 semanas)
> Objetivo: El bot sabe cuándo y a quién transferir, y personaliza por historial

| # | Módulo | Descripción | Prioridad |
|---|--------|-------------|-----------|
| 3.1 | Reglas de escalación | Condiciones contextuales para transferir a humano | 🔴 Crítica |
| 3.2 | Resumen de contexto | AI genera briefing para el agente al recibir transferencia | 🟡 Alta |
| 3.3 | Routing por especialidad | Asignar al agente más adecuado según tipo de consulta | 🟡 Alta |
| 3.4 | Triggers por historial | Flows automáticos basados en compras pasadas | 🟡 Alta |
| 3.5 | Segmentación automática | Clasificar clientes por comportamiento de compra | 🟢 Media |

**Entregables:**
- Tabla `escalation_rules` (condition_type, condition_value, target_agent_group, priority)
- Condition types: `keyword_match`, `sentiment_negative`, `purchase_intent`, `discount_request`, `vip_customer`, `technical_question`, `complaint`
- Función `generateHandoffSummary(conversationId)` → texto resumen con AI
- Extensión de `assignment_rules` para incluir `skill_based` routing
- Tabla `customer_segments` con reglas automáticas (RFM: recency, frequency, monetary)
- Cron job para detectar clientes que deben reordenar y crear conversaciones proactivas

---

### FASE 4: Atribución Avanzada (2-3 semanas)
> Objetivo: Saber exactamente qué campaña/anuncio genera cada peso de venta

| # | Módulo | Descripción | Prioridad |
|---|--------|-------------|-----------|
| 4.1 | Facebook CAPI desde CRM | Enviar eventos de compra server-side a Meta | 🟡 Alta |
| 4.2 | Google Ads Conversion API | Push de conversiones con GCLID | 🟡 Alta |
| 4.3 | Multi-touch attribution | Registrar todos los touchpoints, no solo el primero | 🟢 Media |
| 4.4 | Dashboard de atribución | Visualización: campaña → leads → conversaciones → ventas → ROAS | 🟡 Alta |

**Entregables:**
- Servicio `MetaConversionAPI` que envía eventos `Purchase` con `event_id`, `value`, `currency` via Meta Marketing API
- Servicio `GoogleAdsConversionAPI` que envía conversiones offline con GCLID
- Tabla `attribution_touchpoints` (customer_id, campaign_id, channel, timestamp, touchpoint_type)
- Modelo de atribución configurable: first-touch, last-touch, linear, time-decay
- React dashboard con: funnel por campaña, ROAS por anuncio, costo por lead, costo por venta

---

### FASE 5: Integración Profunda WC (2 semanas)
> Objetivo: Agentes operan 100% desde el CRM sin ir a WordPress

| # | Módulo | Descripción | Prioridad |
|---|--------|-------------|-----------|
| 5.1 | Panel de comisiones | Earnings, balance, payouts del agente en el CRM | 🟢 Media |
| 5.2 | Solicitud de descuento | Workflow de descuento desde la conversación | 🟡 Alta |
| 5.3 | Stock en tiempo real | Bot/agente consulta inventario antes de prometer | 🟡 Alta |
| 5.4 | Creación de orden desde CRM | Generar pedido WC directamente desde la conversación | 🟡 Alta |

**Entregables:**
- Endpoint que consulta `salesking_outstanding_earnings` y `salesking_user_balance_history` via WC REST API
- Panel React en sidebar del agente mostrando comisiones del mes
- Botón "Solicitar descuento" en conversación → crea `sk_discount_req` via WC API → notifica aprobador
- Endpoint `GET /api/inventory/:product_id` que consulta AlmacenPT REST API (`apt/v1/inventory`)
- Indicador de stock en catálogo de productos del CRM
- Botón "Crear pedido" → WC REST API `POST /wp-json/wc/v3/orders` con productos seleccionados

---

## 4. Arquitectura Propuesta

```
┌─────────────────────────────────────────────────────────┐
│                    CANALES DE ENTRADA                     │
│  WhatsApp  │  Facebook  │  Instagram  │  Web Chat  │ TikTok │
└──────┬─────┴─────┬──────┴─────┬───────┴─────┬──────┴───┘
       │           │            │             │
       ▼           ▼            ▼             ▼
┌─────────────────────────────────────────────────────────┐
│              WEBHOOK GATEWAY (Express)                    │
│  • Validación de firma                                   │
│  • Resolución de cliente (UCP)                           │
│  • Detección de campaña (ad_id, UTM, referral)           │
│  • Captura de touchpoint de atribución                   │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              MOTOR DE DECISIÓN                           │
│                                                          │
│  1. ¿Tiene flow de bot activo?          → Ejecutar flow  │
│  2. ¿Viene de campaña mapeada?          → Auto-respuesta │
│  3. ¿Cliente con pedido pendiente?      → Flow de estado │
│  4. ¿Cliente recurrente inactivo?       → Flow de reorden│
│  5. ¿Pregunta técnica/médica?           → Bot médico RAG │
│  6. ¿Necesita humano? (reglas escal.)   → Handoff + brief│
│  7. Default                             → Bot general    │
└──────────────────────┬──────────────────────────────────┘
                       │
              ┌────────┴────────┐
              ▼                 ▼
┌──────────────────┐  ┌──────────────────────┐
│    BOT (IA)      │  │   AGENTE HUMANO      │
│ • RAG médico     │  │ • Inbox omnicanal    │
│ • Catálogo       │  │ • Panel de cliente   │
│ • Recomendación  │  │ • Comisiones         │
│ • Cross-sell     │  │ • Descuentos         │
│ • Seguimiento    │  │ • Crear pedido       │
└────────┬─────────┘  └──────────┬───────────┘
         │                       │
         └───────────┬───────────┘
                     ▼
┌─────────────────────────────────────────────────────────┐
│              WOOCOMMERCE (Backend de Ventas)              │
│  • SalesKing (comisiones, jerarquía)                     │
│  • Custom Discounts (aprobaciones)                       │
│  • Kanban (estados de orden)                             │
│  • AlmacenPT (inventario con lotes)                      │
│  • B2BKing (precios mayoreo)                             │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              ATRIBUCIÓN Y ANALYTICS                      │
│  • Touchpoints multi-canal                               │
│  • Facebook CAPI (server-side events)                    │
│  • Google Ads Conversion API                             │
│  • ROAS por campaña/anuncio                              │
│  • Dashboard de métricas                                 │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Modelo de Datos — Tablas nuevas necesarias

### 5.1 `campaign_product_mappings`
```sql
CREATE TABLE campaign_product_mappings (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES campaigns(id),
    product_id INTEGER,                    -- WC product ID
    product_name TEXT,
    welcome_message TEXT,                  -- Mensaje inicial automático
    media_urls JSONB DEFAULT '[]',         -- Imágenes, PDFs, videos
    auto_send BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.2 `medical_products`
```sql
CREATE TABLE medical_products (
    id SERIAL PRIMARY KEY,
    wc_product_id INTEGER,
    name TEXT NOT NULL,
    diagnostic_category TEXT,              -- 'infecciosas', 'embarazo', 'drogas', etc.
    clinical_indications TEXT[],           -- Indicaciones clínicas
    sample_type TEXT,                      -- 'sangre', 'orina', 'hisopo nasal'
    sensitivity DECIMAL,
    specificity DECIMAL,
    result_time TEXT,                      -- '15 minutos', '5 minutos'
    complementary_tests INTEGER[],         -- IDs de pruebas complementarias
    recommended_profiles TEXT[],           -- 'laboratorio', 'farmacia', 'consultorio'
    technical_sheet_url TEXT,
    embedding VECTOR(1536),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.3 `escalation_rules`
```sql
CREATE TABLE escalation_rules (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    condition_type TEXT NOT NULL,           -- 'keyword', 'sentiment', 'purchase_intent', 'vip', 'complaint'
    condition_config JSONB,                -- Configuración específica por tipo
    target_type TEXT DEFAULT 'agent_group', -- 'agent_group', 'specific_agent', 'supervisor'
    target_id INTEGER,
    priority INTEGER DEFAULT 0,
    generate_summary BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.4 `attribution_touchpoints`
```sql
CREATE TABLE attribution_touchpoints (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    campaign_id INTEGER REFERENCES campaigns(id),
    channel TEXT,                           -- 'whatsapp', 'facebook', 'instagram', 'web', 'google'
    touchpoint_type TEXT,                   -- 'ad_click', 'organic', 'direct', 'referral'
    ad_id TEXT,
    ad_set_id TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_content TEXT,
    gclid TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.5 `customer_segments`
```sql
CREATE TABLE customer_segments (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    segment_type TEXT,                     -- 'purchase_frequency', 'business_type', 'product_category', 'value_tier'
    segment_value TEXT,                    -- 'monthly', 'quarterly', 'laboratorio', 'high_value'
    last_calculated TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);
```

---

## 6. Priorización — ¿Qué programar primero?

### Impacto inmediato en ventas (hacer PRIMERO):
1. **Auto-respuesta por campaña** (Fase 1.3 + 1.4) — Los leads de FB/IG reciben info relevante en segundos, no minutos
2. **Bot médico + system prompt** (Fase 2.1 + 2.3) — Conversaciones más efectivas = más conversiones
3. **Creación de orden desde CRM** (Fase 5.4) — Agentes no cambian de sistema = menos fricción

### Impacto en eficiencia operativa (hacer SEGUNDO):
4. **Handoff inteligente** (Fase 3.1 + 3.2) — Bot escala correctamente, agentes reciben contexto
5. **Sync bidireccional WC** (Fase 1.1) — Una sola fuente de verdad para estados de orden
6. **Stock en tiempo real** (Fase 5.3) — No prometer lo que no hay

### Impacto en decisiones estratégicas (hacer TERCERO):
7. **Atribución completa** (Fase 4) — Saber dónde invertir en publicidad
8. **Segmentación + reorden** (Fase 3.4 + 3.5) — Ventas recurrentes automatizadas
9. **Comisiones en CRM** (Fase 5.1) — Motivación del equipo

---

## 7. Stack Técnico para lo nuevo

| Componente | Tecnología | Razón |
|-----------|-----------|-------|
| API | Express 5 (existente) | Consistencia con lo actual |
| DB | PostgreSQL + pgvector (existente) | Ya funciona, agregar tablas |
| Queue | BullMQ + Redis (existente) | Para CAPI, sync, crons |
| AI | Mismo multi-provider (existente) | Agregar medical prompts |
| PDF parsing | `pdf-parse` o `pdfjs-dist` | Indexar fichas técnicas |
| Meta CAPI | `facebook-nodejs-business-sdk` | Conversiones server-side |
| Google Ads | `google-ads-api` | Conversiones offline |
| WC API | `@woocommerce/woocommerce-rest-api` | Ya usado parcialmente |

---

## 8. Riesgos y Consideraciones

1. **Regulatorio médico** — El bot NO debe diagnosticar. Debe recomendar pruebas como herramienta para el profesional, no como sustituto de criterio médico. Incluir disclaimer.
2. **Privacidad de datos** — Datos de pacientes nunca deben pasar por el sistema. Solo datos del profesional/negocio comprador.
3. **Rate limits de Meta** — WhatsApp Business API tiene límites de mensajes por tier. Las auto-respuestas masivas pueden alcanzar límites.
4. **Complejidad de sync bidireccional** — Los conflictos de estado (alguien mueve en WC y en CRM al mismo tiempo) necesitan estrategia de resolución (last-write-wins o locking).
5. **Costo de AI** — Más llamadas al LLM = más costo. Optimizar con RAG para minimizar llamadas generativas.

---

## 9. Métricas de Éxito

| Métrica | Antes | Objetivo |
|---------|-------|----------|
| Tiempo de primera respuesta | ~3-5 min (manual) | <30 seg (bot) |
| % de leads con atribución completa | ~30% (solo Click-to-DM) | >85% |
| Tasa de conversión lead→venta | Desconocida | Medible por campaña |
| Cross-sell rate | 0% (no hay recomendaciones) | >15% por conversación |
| Tiempo agente por conversación | Alto (busca info en otro sistema) | -40% (todo en CRM) |
| ROAS medible por anuncio | Solo estimado | Exacto server-side |

---

*Documento generado para discusión. Cada fase puede ajustarse según prioridades del negocio.*
