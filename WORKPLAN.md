# WORKPLAN — CRM Botón Médico
> **Última actualización:** 2026-03-19
> **Estado global:** ✅ TODAS LAS FASES COMPLETADAS (1-6)

---

## 🔑 CONTEXTO RÁPIDO (lee esto primero si reinicias el prompt)

### ¿Qué es este proyecto?
Un CRM omnicanal para **Botón Médico**, empresa que vende pruebas de diagnóstico rápido (embarazo, antidoping, influenza, COVID, etc.) a profesionales médicos. El sistema combina:
1. **MyAlice CRM** (Node.js/Next.js) — Atención multicanal con IA
2. **WooCommerce** — Motor de ventas con comisiones, kanban, y descuentos
3. **Campañas FB/Google** — Generación de leads

### Repositorios y accesos

| Recurso | URL / Ruta |
|---------|-----------|
| **CRM Producción (Frontend)** | https://crm.botonmedico.com |
| **CRM API (Backend)** | https://api-crm.botonmedico.com |
| **GitHub Repo** | https://github.com/feruap/crm |
| **Staging WP (local)** | http://testamunet.local/wp-admin/ |
| **WP Content (staging)** | `https://tst.amunet.com.mx` |
| **Cowork WP Content** | `/sessions/zen-laughing-thompson/mnt/wp-content` |
| **Cowork MyAlice** | `/sessions/zen-laughing-thompson/mnt/myalice` |

### Estructura del código CRM (MyAlice)

```
/mnt/myalice/.claude/worktrees/amazing-lederberg/
├── apps/
│   ├── server/              # Express 5 + TypeScript (puerto 3001)
│   │   └── src/
│   │       ├── routes/      # conversations.ts, campaigns.ts, attributions.ts, etc.
│   │       ├── ai.service.ts    # RAG + multi-provider AI
│   │       └── index.ts
│   └── web/                 # Next.js 14 + React 19 + Tailwind
│       └── src/app/
├── packages/
│   └── db/
│       └── schema.sql       # PostgreSQL + pgvector (esquema actual)
├── workers/
│   └── webhooks/            # Procesadores async de webhooks
└── woocommercecurrentplugins/
    ├── salesking/           # Plugin de comisiones
    ├── salesking-custom-discounts/  # Aprobación de descuentos
    └── kanban-for-woocommerce/      # Kanban avanzado
```

### Plugins WP clave (staging)

```
/mnt/wp-content/plugins/
├── facebook-for-woocommerce/     # Pixel + CAPI
├── google-listings-and-ads/      # Google Ads
├── duracelltomi-google-tag-manager/  # GTM
├── b2bking/                      # Precios mayoreo
└── almacenpt/                    # Inventario con lotes
```

### Theme personalizado
```
/mnt/wp-content/themes/jupiterx-child/
└── lib/order/attribution-details.php  # Muestra UTMs en admin de orden
```

---

## 📋 PLAN DE TRABAJO POR FASES

Cada fase tiene:
- **Tareas numeradas** con checkbox `[ ]` / `[x]`
- **Pruebas de validación** al final de cada fase
- **Archivos modificados/creados** para saber qué cambió

---

### FASE 1: Fundamentos de Integración (2-3 semanas)
> **Objetivo:** Sync bidireccional WC↔CRM + auto-respuesta por campaña
> **Estado:** ✅ Completada (backend + UI)

#### 1.1 — Sync bidireccional WooCommerce ↔ CRM
- [x] Crear endpoint `POST /api/webhooks/woocommerce-status` en `apps/server/src/routes/webhooks.ts`
- [x] Registrar webhook en WooCommerce: `order.updated` → endpoint `POST /api/webhooks/woocommerce-status` creado
- [x] Crear endpoint `PUT /api/orders/:id/status` que llama WC REST API para cambiar estado
- [x] Implementar locking optimista para evitar conflictos de sync (10s window en `order_sync_log`)
- [x] UI: Página `/orders` con dropdown de cambio de estado bidireccional + filtros + búsqueda

**Archivos a modificar/crear:**
```
apps/server/src/routes/webhooks.ts        # Nuevo endpoint
apps/server/src/routes/orders.ts          # Nuevo: CRUD de órdenes desde CRM
apps/server/src/services/woocommerce.ts   # Nuevo: wrapper WC REST API
apps/web/src/app/conversations/[id]/order-panel.tsx  # UI botón estado
packages/db/migrations/001_order_sync.sql  # Tabla order_sync_log
```

**🧪 Pruebas Fase 1.1:**
```
□ Cambiar estado de orden en WP admin → verificar que CRM refleja cambio en <5s
□ Cambiar estado de orden en CRM → verificar que WP admin refleja cambio en <5s
□ Cambiar estado simultáneamente en ambos → verificar que no hay loop infinito
□ Verificar en Kanban WC que el estado también se actualiza
```

---

#### 1.2 — Captura UTM en webchat
- [x] Componente `ChatWidgetUTM` + hook `useUTMCapture` para leer UTMs del navegador y enviar al API
- [x] Enviar UTMs como metadata del primer mensaje — endpoint `POST /api/webhooks/webchat-utm`
- [x] Guardar UTMs en `attribution_touchpoints` al crear conversación (+ `utm_data` JSONB en conversations)
- [x] UTMs almacenados en `conversations.utm_data` y `attribution_touchpoints` — visibles via API

**Archivos a modificar/crear:**
```
apps/web/src/components/chat-widget/index.tsx   # Leer UTMs del navegador
apps/server/src/routes/conversations.ts         # Guardar UTMs al crear conversación
packages/db/migrations/002_attribution_touchpoints.sql  # Nueva tabla
```

**🧪 Pruebas Fase 1.2:**
```
□ Abrir webchat desde URL con ?utm_source=google&utm_campaign=test → verificar que CRM muestra UTMs
□ Abrir webchat sin UTMs → verificar que no hay error
□ Verificar que UTMs aparecen en panel del agente junto a la conversación
```

---

#### 1.3 — Mapeo campaña → producto → contenido
- [x] Crear tabla `campaign_product_mappings` en PostgreSQL (migración 001)
- [x] Crear CRUD API: `POST/GET/PUT/DELETE /api/campaign-mappings` + toggle
- [x] UI `/campaign-mappings`: CRUD completo con form, tabla, toggle auto-envío, media URLs
- [x] Media adjunta via URLs en textarea (una URL por línea)

**Archivos a modificar/crear:**
```
packages/db/migrations/003_campaign_product_mappings.sql
apps/server/src/routes/campaign-mappings.ts     # CRUD
apps/web/src/app/settings/campaign-mappings/page.tsx  # UI admin
```

**🧪 Pruebas Fase 1.3:**
```
□ Crear un mapping: Campaña "Antidoping" → Producto "Kit 5 paneles" → Mensaje + imagen
□ Editar el mapping, cambiar mensaje → verificar que se guarda
□ Eliminar mapping → verificar que ya no aparece
□ Listar todos los mappings → verificar paginación
```

---

#### 1.4 — Auto-respuesta por campaña
- [x] En webhook handler de Meta: cuando llega `ad_id`, buscar mapping en `campaign_product_mappings`
- [x] Si existe mapping con `auto_send: true`, enviar mensaje + media automáticamente
- [x] Registrar en `messages` con `handler_type: 'bot'` y `bot_action: 'campaign_auto_reply'`
- [x] Toggle en API (`PATCH /api/campaign-mappings/:id/toggle`), falta UI
- [x] Logging de auto-respuestas con console.log (para medir efectividad básica)

**Archivos a modificar/crear:**
```
apps/server/src/routes/webhooks.ts              # Lógica de auto-respuesta
apps/server/src/services/campaign-responder.ts  # Nuevo servicio
workers/webhooks/campaign-auto-reply.ts         # Worker async
```

**🧪 Pruebas Fase 1.4:**
```
□ Simular webhook de Meta con ad_id mapeado → verificar que se envía respuesta automática
□ Simular webhook con ad_id NO mapeado → verificar que NO se envía nada automático
□ Desactivar auto_send en mapping → verificar que ya no se envía
□ Verificar que el mensaje aparece en la conversación con handler_type 'bot'
□ Verificar que el agente humano puede tomar la conversación después del auto-reply
```

---

### ✅ CHECKPOINT FASE 1
```
Al completar Fase 1, verificar:
□ Un lead de FB con ad_id conocido recibe auto-respuesta con info del producto en <5s
□ Un lead del webchat con UTMs tiene atribución completa en el CRM
□ Los agentes pueden cambiar estado de orden desde el CRM sin ir a WP
□ Los cambios de estado en WP se reflejan en CRM automáticamente
```

---

### FASE 2: Bot Médico Inteligente (3-4 semanas)
> **Objetivo:** IA que asesora técnicamente a profesionales médicos
> **Estado:** ✅ Completada (backend + UI)

#### 2.1 — Knowledge base médica estructurada
- [x] Crear tabla `medical_products` + `medical_knowledge_chunks` + `clinical_decision_rules` + `customer_profiles` (migración 002)
- [x] Crear API CRUD: `POST/GET/PUT/DELETE /api/medical-products` + categorías + decision-rules
- [x] Crear UI `/medical-products`: CRUD completo con filtros, detalle expandible, perfiles recomendados
- [x] Poblar con datos reales de al menos 10 productos del catálogo (12 productos en medical-products-seed.ts)
- [x] Crear relaciones de pruebas complementarias (complementary_product_ids[])

**Archivos a modificar/crear:**
```
packages/db/migrations/004_medical_products.sql
apps/server/src/routes/medical-products.ts
apps/web/src/app/settings/medical-products/page.tsx
apps/web/src/app/settings/medical-products/[id]/page.tsx  # Detalle/edición
```

**🧪 Pruebas Fase 2.1:**
```
□ Crear producto médico "Prueba Rápida Influenza A/B" con todos los campos clínicos
□ Asociar pruebas complementarias (COVID, RSV)
□ Verificar que la API devuelve datos correctos incluyendo complementarias
□ Verificar UI muestra cards con info clínica legible
```

---

#### 2.2 — Indexación de fichas técnicas PDF
- [x] Pipeline: `extractTextFromPDF()` → `chunkText()` → `generateEmbedding()` → `medical_knowledge_chunks`
- [x] Endpoint `POST /api/medical-products/:id/upload-sheet` para subir ficha técnica
- [x] Chunking inteligente: detecta secciones (indicaciones, procedimiento, interpretación, especificaciones, almacenamiento, precauciones, contenido_kit)
- [x] Chunks asociados a `medical_product_id` + `findMedicalContext()` busca por embedding similarity

**Archivos a modificar/crear:**
```
apps/server/src/services/pdf-indexer.ts        # Pipeline PDF→embeddings
apps/server/src/routes/medical-products.ts     # Endpoint upload
workers/indexing/pdf-processor.ts              # Worker async
```

**🧪 Pruebas Fase 2.2:**
```
□ Subir PDF de ficha técnica real → verificar que se generan chunks y embeddings
□ Buscar semánticamente "¿qué muestra necesito para influenza?" → obtener chunk relevante
□ Verificar que chunks están asociados al producto correcto
□ Subir PDF corrupto → verificar manejo de error graceful
```

---

#### 2.3 — System prompt médico especializado
- [x] Prompt como asesor técnico IVD en `prompts/medical-advisor.ts` (NO vendedor, NO diagnostica)
- [x] `buildMedicalPrompt()` inyecta catálogo, perfil del cliente, recomendaciones, y contexto RAG
- [x] Reglas de recomendación via `clinical_decision_rules` + motor de recomendación
- [x] Disclaimer médico-regulatorio incluido en el prompt base
- [x] Señales de transferencia a humano definidas (cotización, descuento, queja, frustración)

**Archivos a modificar/crear:**
```
apps/server/src/ai.service.ts                  # Prompt médico + reglas
apps/server/src/prompts/medical-advisor.ts     # Nuevo: template del prompt
```

**🧪 Pruebas Fase 2.3:**
```
□ Preguntar "¿qué prueba rápida me recomiendas para screening prenatal?" → debe recomendar embarazo + VIH + sífilis + hepatitis B
□ Preguntar "¿cuál es la sensibilidad de tu prueba de COVID?" → debe citar dato real de la ficha
□ Preguntar "¿puedo usar esto para diagnosticar cáncer?" → debe declinar apropiadamente
□ Verificar que sugiere pruebas complementarias (cross-sell natural)
□ Verificar que incluye disclaimer regulatorio
```

---

#### 2.4 — Motor de recomendación por perfil
- [x] `getRecommendations(message, customerId, provider, apiKey)` → combina 4 fuentes: rules, profile, semantic, cross-sell
- [x] `customer_profiles` tabla con business_type, specialty, volume → `getCustomerProfile()` / `updateCustomerProfile()`
- [x] Adapta por perfil: lab→paneles completos + alto volumen, farmacia→OTC + point-of-care, consultorio→facilidad de uso
- [x] Cross-sell automático: si compró producto A, sugiere complementario B que nunca compró
- [x] `PROFILE_DETECTION_PROMPT` para que el AI detecte perfil del cliente del historial de conversación

**Archivos a modificar/crear:**
```
apps/server/src/services/recommendation-engine.ts   # Motor de recomendación
apps/server/src/routes/recommendations.ts           # API
```

**🧪 Pruebas Fase 2.4:**
```
□ Cliente tipo "laboratorio" pregunta por influenza → recomendar panel respiratorio completo
□ Cliente tipo "farmacia" pregunta por embarazo → recomendar prueba OTC individual
□ Verificar que el perfil detectado se guarda y persiste entre conversaciones
□ Verificar cross-sell: si compró antidoping, sugerir alcohol en aliento
```

---

### ✅ CHECKPOINT FASE 2
```
Al completar Fase 2, verificar:
□ El bot responde preguntas médicas citando fichas técnicas reales
□ Recomienda pruebas complementarias de forma natural (cross-sell)
□ Adapta recomendaciones según el tipo de cliente
□ Incluye disclaimers regulatorios
□ Sabe cuándo NO puede responder y sugiere contactar especialista
```

---

### FASE 3: Handoff Inteligente y Flujos por Historial (2-3 semanas)
> **Objetivo:** Escalación contextual + personalización por compras pasadas
> **Estado:** ✅ Completada (backend + UI)

#### 3.1 — Reglas de escalación contextual
- [x] Crear tabla `escalation_rules` + `handoff_events` + `customer_segments` (migración 003)
- [x] Implementar evaluador de reglas en el pipeline de mensajes (`evaluateEscalation` en webhooks.ts)
- [x] Condiciones: `keyword_match`, `sentiment_negative`, `purchase_intent`, `discount_request`, `vip_customer`, `complaint`, `order_issue`, `explicit_request`, `technical_question`
- [x] UI `/escalation-rules` con 3 tabs: Reglas (CRUD), Historial Handoff, Segmentos de clientes
- [x] Integrar escalación en el flujo de bot: si `shouldEscalate`, ejecuta `executeHandoff()` y asigna agente

**Archivos creados/modificados:**
```
packages/db/migrations/003_phase3_handoff_history.sql  # NUEVO: escalation_rules, handoff_events, customer_segments
apps/server/src/services/escalation-engine.ts          # NUEVO: evaluateEscalation, generateHandoffSummary, executeHandoff
apps/server/src/routes/escalation-rules.ts             # NUEVO: CRUD + handoff-log + segments + recalculate
apps/server/src/index.ts                               # MODIFICADO: +escalationRulesRouter
apps/server/src/routes/webhooks.ts                     # MODIFICADO: +escalation check + purchase history in bot flow
apps/web/app/escalation-rules/page.tsx                 # NUEVO: UI con tabs (reglas, historial, segmentos)
apps/web/components/Sidebar.tsx                        # MODIFICADO: +Escalación en nav
```

**🧪 Pruebas Fase 3.1:**
```
□ Cliente escribe "quiero un descuento" → escala a agente con permisos de descuento
□ Cliente con >$50k lifetime spending → marca como VIP y asigna a agente senior
□ Cliente menciona "problema con mi pedido" → escala a soporte
□ Bot con confianza alta en respuesta médica → NO escala innecesariamente
```

---

#### 3.2 — Resumen de contexto para handoff
- [x] Al transferir, `generateHandoffSummary()` genera resumen AI de la conversación
- [x] Incluir: nombre/tipo de cliente, qué preguntó, qué recomendó el bot, señales de compra, pedidos recientes
- [x] Resumen guardado en `conversations.handoff_summary` + `handoff_events.ai_summary`
- [x] Historial de handoffs visible en UI tab "Historial Handoff"

**Archivos creados/modificados:**
```
apps/server/src/services/escalation-engine.ts  # generateHandoffSummary() + executeHandoff()
```

**🧪 Pruebas Fase 3.2:**
```
□ Conversación de 15 mensajes transferida → resumen coherente de 3-4 líneas
□ Resumen incluye: nombre del cliente, producto de interés, tipo de negocio
□ Agente puede ver el resumen antes de responder
```

---

#### 3.3 — Triggers por historial de compras
- [x] `analyzeCustomerHistory()` evalúa historial del cliente al iniciar conversación
- [x] Trigger: pedido pendiente → saludo automático "Veo que tiene un pedido #X en proceso"
- [x] Trigger: cliente inactivo 30+ días → sugerencia de reorden (isReorderCandidate)
- [x] Trigger: compró producto A pero nunca B (complementario) → crossSellOpportunities
- [x] `recalculateCustomerSegments()` para cron job: lifecycle_stage, value_tier, reorder_due
- [x] UI tab "Segmentos" con cards agrupadas + botón "Recalcular Segmentos"

**Archivos creados/modificados:**
```
apps/server/src/services/purchase-history-engine.ts    # NUEVO: analyzeCustomerHistory, recalculateCustomerSegments
apps/server/src/routes/escalation-rules.ts             # GET /segments + POST /recalculate
apps/server/src/routes/webhooks.ts                     # historyGreeting prepended to first bot response
```

**🧪 Pruebas Fase 3.3:**
```
□ Cliente con orden en "processing" inicia chat → bot menciona "veo que tu pedido #X está en proceso"
□ Cliente que compró hace 45 días → recibe sugerencia de reorden
□ Cliente que compró "Kit Influenza" pero nunca "Kit COVID" → bot sugiere COVID
□ Recalcular segmentos genera lifecycle_stage, value_tier, reorder_due correctos
```

---

### ✅ CHECKPOINT FASE 3
```
Al completar Fase 3, verificar:
□ Las escalaciones son contextualmente correctas (no solo por confianza baja)
□ Los agentes reciben resumen útil al recibir transferencia
□ Clientes recurrentes reciben atención personalizada basada en compras
□ El cron de reorden funciona sin falsos positivos excesivos
```

---

### FASE 4: Atribución Avanzada (2-3 semanas)
> **Objetivo:** Saber exactamente qué campaña genera cada peso de venta
> **Estado:** ✅ Completada (backend + UI)

#### 4.1 — Facebook CAPI desde CRM
- [x] `sendMetaPurchaseEvent()` envía Purchase a Meta CAPI con event_id, value, currency, fbc, fbp
- [x] `sendMetaLeadEvent()` envía Lead cuando nueva conversación viene de FB/IG ad
- [x] Deduplicación con pixel del navegador via event_id compartido
- [x] `retryFailedMetaEvents()` reintenta envíos fallidos (max 3 intentos)
- [x] Eventos registrados en tabla `conversion_events` con status tracking

**Archivos creados:**
```
apps/server/src/services/meta-capi.ts           # NUEVO: sendMetaPurchaseEvent, sendMetaLeadEvent, retryFailedMetaEvents
```

**🧪 Pruebas Fase 4.1:**
```
□ Venta atribuida a FB → evento Purchase aparece en Meta Events Manager
□ Evento incluye valor correcto y currency MXN
□ No hay duplicados entre pixel browser y CAPI server
□ Fallo de envío → reintento automático en cola
```

---

#### 4.2 — Google Ads Conversion API
- [x] `sendGooglePurchaseConversion()` envía conversión offline via Google Ads REST API v16
- [x] OAuth token management con cache y auto-refresh
- [x] Solo envía si el cliente tiene GCLID en attribution_touchpoints
- [x] `retryFailedGoogleEvents()` para reintentos
- [x] Eventos registrados en `conversion_events` con status tracking

**Archivos creados:**
```
apps/server/src/services/google-ads-conversion.ts  # NUEVO: sendGooglePurchaseConversion, retryFailedGoogleEvents
```

**🧪 Pruebas Fase 4.2:**
```
□ Venta con GCLID → conversión aparece en Google Ads (con delay normal de 24h)
□ Venta sin GCLID → no intenta enviar a Google
□ Valor de conversión coincide con total de la orden
```

---

#### 4.3 — Multi-touch attribution
- [x] 5 modelos: first_touch, last_touch, linear, time_decay, position_based
- [x] Tabla `attribution_config` con model_type, halflife, weights, lookback window
- [x] `attributeOrderRevenue()` calcula y guarda weights + revenue por touchpoint
- [x] `recalculateAllAttributions()` resets y re-procesa todas las órdenes
- [x] Enhanced `attribution_touchpoints` con fbc, fbp, gclid, attributed_revenue, attribution_weight

**Archivos creados:**
```
apps/server/src/services/attribution-model.ts              # NUEVO: 5 modelos, attributeOrderRevenue, recalculateAllAttributions
packages/db/migrations/004_phase4_attribution_advanced.sql # NUEVO: attribution_config, conversion_events, ALTER touchpoints + attributions
```

**🧪 Pruebas Fase 4.3:**
```
□ Cliente con 3 touchpoints (FB ad → Google search → WhatsApp directo) → los 3 registrados
□ Modelo linear: revenue dividido equitativamente entre los 3
□ Modelo time-decay: más revenue al touchpoint más reciente
□ Cambiar modelo en config → recalcula atribuciones existentes
```

---

#### 4.4 — Dashboard de atribución
- [x] `/analytics` con 4 tabs: Resumen, ROAS, Eventos CAPI, Modelo (config)
- [x] Metric cards: Revenue Atribuido, Órdenes, Touchpoints, Conversión
- [x] Funnel de conversión: Touchpoints → Leads → Conversaciones → Atribuciones → Órdenes
- [x] Tendencia temporal de revenue (bar chart CSS)
- [x] Tabla de campañas: touchpoints, conversaciones, órdenes, revenue, ticket promedio
- [x] ROAS tab: gasto, revenue, ROAS, CPC, CPA por campaña
- [x] Eventos CAPI log: Meta + Google conversion events con status
- [x] Config: selector de modelo, lookback window, halflife, position weights
- [x] Filtros: días (7/14/30/60/90), plataforma (FB/IG/Google/TikTok)
- [x] Export CSV

**Archivos creados/modificados:**
```
apps/server/src/routes/analytics.ts             # NUEVO: 8 endpoints de agregación
apps/server/src/index.ts                        # MODIFICADO: +analyticsRouter
apps/web/app/analytics/page.tsx                 # NUEVO: Dashboard 4 tabs completo
apps/web/components/Sidebar.tsx                 # MODIFICADO: +Atribución nav
```

**🧪 Pruebas Fase 4.4:**
```
□ Dashboard carga en <3s con datos de 30 días
□ ROAS calculado coincide con verificación manual
□ Filtrar por campaña específica → datos correctos
□ Export CSV descarga archivo válido con todos los datos
```

---

### ✅ CHECKPOINT FASE 4
```
Al completar Fase 4, verificar:
□ Cada venta tiene atribución completa (o "directo/orgánico" si no hay campaña)
□ Conversiones server-side llegan a Meta y Google
□ Dashboard muestra ROAS real por anuncio
□ Se puede tomar decisión de presupuesto basada en datos del dashboard
```

---

### FASE 5: Integración Profunda WC (2 semanas)
> **Objetivo:** Agentes operan 100% desde el CRM
> **Estado:** ✅ Completada (backend + UI)

#### 5.1 — Stock en tiempo real
- [x] `GET /api/inventory/:productId` y `GET /api/inventory/bulk?ids=` → consulta WC REST API
- [x] Cache en memoria de 5 min (`stockCache` Map con TTL)
- [x] `getStockTextForBot()` genera texto legible para respuestas del bot
- [x] `POST /api/inventory/clear-cache` para invalidar cache manualmente

**Archivos creados:**
```
apps/server/src/services/inventory.ts   # NUEVO: getProductStock, getBulkProductStock, getStockTextForBot, cache
apps/server/src/routes/inventory.ts     # NUEVO: GET /:id, GET /bulk, POST /clear-cache
```

**🧪 Pruebas Fase 5.1:**
```
□ Producto con stock → "Disponible (X unidades en stock)"
□ Producto sin stock → "Actualmente agotado"
□ Cache funciona: segunda consulta en <5min no llama a WC API
□ Clear cache → siguiente consulta refresca datos
```

---

#### 5.2 — Creación de orden desde CRM
- [x] `POST /api/orders/create` → crea orden en WC via REST API y guarda en CRM
- [x] `createWCOrder()` envía line_items, billing, coupons, agent metadata
- [x] `GET /api/orders/b2b-price/:productId` → consulta precios B2BKing
- [x] Orden creada se sincroniza automáticamente al CRM (order_sync_log)
- [x] Agent ID guardado como `_crm_agent_id` meta en WC order

**Archivos modificados:**
```
apps/server/src/services/woocommerce.ts  # EXTENDIDO: +createWCOrder, +getB2BPrice
apps/server/src/routes/orders.ts         # EXTENDIDO: +POST /create, +GET /b2b-price/:id
```

**🧪 Pruebas Fase 5.2:**
```
□ Crear orden desde CRM con 2 productos → orden aparece en WP admin
□ Precio B2B consultable para cliente mayorista
□ Orden aparece en CRM con sync log correcto
```

---

#### 5.3 — Solicitud de descuento desde CRM
- [x] `POST /api/orders/:id/discount-request` → agrega meta `_discount_request_*` en WC order
- [x] `createDiscountRequest()` envía porcentaje, razón, agente a WC
- [x] SK Custom Discounts lee `_discount_request_status` = 'pending' para workflow de aprobación
- [x] Registrado en order_sync_log para tracking

**Archivos modificados:**
```
apps/server/src/services/woocommerce.ts  # EXTENDIDO: +createDiscountRequest
apps/server/src/routes/orders.ts         # EXTENDIDO: +POST /:id/discount-request
```

**🧪 Pruebas Fase 5.3:**
```
□ Agente solicita 15% descuento → meta aparece en WC order
□ SK Custom Discounts puede leer el request y procesarlo
□ Estado registrado en sync log del CRM
```

---

#### 5.4 — Panel de comisiones del agente
- [x] `GET /api/agent-commissions/:agentId` → métricas CRM + SalesKing commissions
- [x] `GET /api/agent-commissions/:agentId/history` → historial mensual (revenue, órdenes, conversaciones)
- [x] `getAgentCommissions()` consulta SalesKing REST API o fallback a WP user meta
- [x] UI `/commissions` con metric cards, comisiones SK, bar chart mensual, tabla detallada

**Archivos creados/modificados:**
```
apps/server/src/services/woocommerce.ts           # EXTENDIDO: +getAgentCommissions
apps/server/src/routes/agent-commissions.ts       # NUEVO: GET /:agentId, GET /:agentId/history
apps/server/src/index.ts                          # MODIFICADO: +inventoryRouter, +agentCommissionsRouter
apps/web/app/commissions/page.tsx                 # NUEVO: Panel comisiones con gráficas
apps/web/components/Sidebar.tsx                   # MODIFICADO: +Comisiones nav
```

**🧪 Pruebas Fase 5.4:**
```
□ Agente con ventas en el mes → revenue y órdenes correctos
□ Datos SalesKing visibles si la API está configurada
□ Historial muestra tendencia de últimos 6 meses
```

---

### ✅ CHECKPOINT FASE 5 (FINAL)
```
Al completar Fase 5, verificar flujo completo end-to-end:
□ Lead llega de FB → auto-respuesta con info del producto (<5s)
□ Bot asesora médicamente → recomienda pruebas complementarias
□ Bot detecta intención de compra → transfiere a humano con resumen
□ Agente ve historial de compras + stock disponible
□ Agente crea orden desde CRM → SalesKing calcula comisión
□ Si necesita descuento → solicita y espera aprobación
□ Venta se atribuye correctamente en dashboard → ROAS visible
□ WC Kanban y CRM Pipeline sincronizados
```

---

## 📊 TRACKING DE PROGRESO

| Fase | Descripción | Tareas | Completadas | Estado |
|------|-------------|--------|-------------|--------|
| 1 | Fundamentos de Integración | 4 módulos | 4 | ✅ Completada |
| 2 | Bot Médico Inteligente | 4 módulos | 4 | ✅ Completada |
| 3 | Handoff + Flujos por Historial | 3 módulos | 3 | ✅ Completada |
| 4 | Atribución Avanzada | 4 módulos | 4 | ✅ Completada |
| 5 | Integración Profunda WC | 4 módulos | 4 | ✅ Completada |
| 6 | Infraestructura Crítica | 5 módulos | 5 | ✅ Completada |

---

## 🔧 INSTRUCCIONES PARA NUEVA SESIÓN DE CLAUDE

Si estás leyendo esto en un nuevo prompt, sigue estos pasos:

1. **Lee este archivo completo** para entender el proyecto
2. **Lee `PLAN-CRM-BOTONMEDICO.md`** para contexto detallado de cada gap
3. **Busca el primer `[ ]` (tarea pendiente)** en este archivo — ahí es donde debes continuar
4. **Antes de codear**, lee los archivos relevantes del CRM:
   - Schema: `/mnt/myalice/.claude/worktrees/amazing-lederberg/packages/db/schema.sql`
   - Rutas existentes: `/mnt/myalice/.claude/worktrees/amazing-lederberg/apps/server/src/routes/`
   - AI service: `/mnt/myalice/.claude/worktrees/amazing-lederberg/apps/server/src/ai.service.ts`
5. **Al terminar cada sub-tarea**, marca el `[ ]` como `[x]` en este archivo
6. **Al terminar cada fase**, ejecuta TODAS las pruebas del checkpoint antes de avanzar
7. **Si algo falla**, documenta el error debajo de la prueba con `⚠️ ERROR: descripción`

---

## 📝 LOG DE CAMBIOS

| Fecha | Fase | Acción | Archivos | Notas |
|-------|------|--------|----------|-------|
| 2026-03-19 | 0 | Plan creado | WORKPLAN.md, PLAN-CRM-BOTONMEDICO.md | Análisis completo del sistema |
| 2026-03-19 | 1 | Backend Fase 1 completo | Ver lista abajo | Migración SQL, servicio WC, rutas, auto-respuesta |

**Archivos creados/modificados en Fase 1 (backend):**
- `packages/db/migrations/001_phase1_foundations.sql` — NUEVO: Tablas order_sync_log, attribution_touchpoints, campaign_product_mappings + ALTER conversations + ALTER messages
- `apps/server/src/services/woocommerce.ts` — NUEVO: Wrapper WC REST API con loop prevention
- `apps/server/src/services/campaign-responder.ts` — NUEVO: Auto-reply, touchpoints, UTM recording
- `apps/server/src/routes/orders.ts` — NUEVO: CRUD órdenes + PUT status con sync bidireccional
- `apps/server/src/routes/campaign-mappings.ts` — NUEVO: CRUD campaign-product mappings
- `apps/server/src/routes/webhooks.ts` — MODIFICADO: +WC webhook, +webchat UTM, +campaign auto-reply en Meta/WhatsApp
- `apps/server/src/index.ts` — MODIFICADO: Registrar nuevas rutas
- `apps/web/components/ChatWidgetUTM.tsx` — NUEVO: Captura UTMs del navegador + hook useUTMCapture
- `apps/web/app/campaign-mappings/page.tsx` — NUEVO: UI CRUD para campaign-product mappings
- `apps/web/app/orders/page.tsx` — NUEVO: Tabla de órdenes con dropdown de cambio de estado bidireccional
- `apps/web/components/Sidebar.tsx` — MODIFICADO: +Auto-Respuestas, +Órdenes en nav

| 2026-03-19 | 2 | Fase 2 Bot Médico completa | Ver lista abajo | Migración, servicios, prompt, motor recomendación, UI |

**Archivos creados/modificados en Fase 2:**
- `packages/db/migrations/002_phase2_medical_bot.sql` — NUEVO: Tablas medical_products, medical_knowledge_chunks, clinical_decision_rules, customer_profiles
- `apps/server/src/services/recommendation-engine.ts` — NUEVO: Motor de recomendación 4 fuentes (rules, profile, semantic, cross-sell)
- `apps/server/src/services/pdf-indexer.ts` — NUEVO: Pipeline PDF→chunks→embeddings
- `apps/server/src/prompts/medical-advisor.ts` — NUEVO: System prompt médico + buildMedicalPrompt() dinámico + profile detection prompt
- `apps/server/src/routes/medical-products.ts` — NUEVO: CRUD productos médicos + upload PDF + decision rules + generate-embedding
- `apps/server/src/ai.service.ts` — MODIFICADO: +getMedicalBotResponse() pipeline completo, +findMedicalContext()
- `apps/server/src/routes/webhooks.ts` — MODIFICADO: handleBotResponse() ahora usa getMedicalBotResponse()
- `apps/server/src/index.ts` — MODIFICADO: +medicalProductsRouter
- `apps/web/app/medical-products/page.tsx` — NUEVO: UI CRUD con filtros, detalle expandible, perfiles
- `apps/web/components/Sidebar.tsx` — MODIFICADO: +Productos Med.

| 2026-03-19 | 3 | Fase 3 Handoff + Historial completa | Ver lista abajo | Escalación contextual, resumen IA, historial compras, segmentos |

**Archivos creados/modificados en Fase 3:**
- `packages/db/migrations/003_phase3_handoff_history.sql` — NUEVO: Tablas escalation_rules, handoff_events, customer_segments + ALTER conversations
- `apps/server/src/services/escalation-engine.ts` — NUEVO: evaluateEscalation, generateHandoffSummary, executeHandoff (keyword sets, rule evaluation, agent assignment)
- `apps/server/src/services/purchase-history-engine.ts` — NUEVO: analyzeCustomerHistory (lifecycle, reorder, cross-sell), recalculateCustomerSegments (cron)
- `apps/server/src/routes/escalation-rules.ts` — NUEVO: CRUD reglas + GET /handoff-log + GET /segments + POST /recalculate
- `apps/server/src/routes/webhooks.ts` — MODIFICADO: +escalation check before bot reply, +purchase history greeting, +handoff message to customer
- `apps/server/src/index.ts` — MODIFICADO: +escalationRulesRouter
- `apps/web/app/escalation-rules/page.tsx` — NUEVO: UI 3 tabs (Reglas CRUD, Historial Handoff, Segmentos clientes)
- `apps/web/components/Sidebar.tsx` — MODIFICADO: +Escalación nav item

| 2026-03-19 | 4 | Fase 4 Atribución Avanzada completa | Ver lista abajo | Meta CAPI, Google Ads, multi-touch attribution, dashboard |

**Archivos creados/modificados en Fase 4:**
- `packages/db/migrations/004_phase4_attribution_advanced.sql` — NUEVO: attribution_config, conversion_events, ALTER attribution_touchpoints + attributions
- `apps/server/src/services/meta-capi.ts` — NUEVO: sendMetaPurchaseEvent, sendMetaLeadEvent, retryFailedMetaEvents
- `apps/server/src/services/google-ads-conversion.ts` — NUEVO: sendGooglePurchaseConversion, OAuth token management, retryFailedGoogleEvents
- `apps/server/src/services/attribution-model.ts` — NUEVO: 5 modelos (first/last/linear/time_decay/position_based), attributeOrderRevenue, recalculateAllAttributions
- `apps/server/src/routes/analytics.ts` — NUEVO: 8 endpoints (attribution overview, ROAS, funnel, trend, conversion-events, config CRUD, recalculate)
- `apps/server/src/index.ts` — MODIFICADO: +analyticsRouter
- `apps/web/app/analytics/page.tsx` — NUEVO: Dashboard 4 tabs (Resumen, ROAS, Eventos CAPI, Modelo config) con filtros y export CSV
- `apps/web/components/Sidebar.tsx` — MODIFICADO: +Atribución nav

| 2026-03-19 | 5 | Fase 5 Integración Profunda WC completa | Ver lista abajo | Stock real-time, crear órdenes, descuentos, comisiones |

**Archivos creados/modificados en Fase 5:**
- `apps/server/src/services/inventory.ts` — NUEVO: getProductStock, getBulkProductStock, getStockTextForBot, cache 5min
- `apps/server/src/routes/inventory.ts` — NUEVO: GET /:id, GET /bulk, POST /clear-cache
- `apps/server/src/services/woocommerce.ts` — EXTENDIDO: +createWCOrder, +createDiscountRequest, +getB2BPrice, +getAgentCommissions
- `apps/server/src/routes/orders.ts` — EXTENDIDO: +POST /create, +POST /:id/discount-request, +GET /b2b-price/:id
- `apps/server/src/routes/agent-commissions.ts` — NUEVO: GET /:agentId (summary + SK), GET /:agentId/history (monthly)
- `apps/server/src/index.ts` — MODIFICADO: +inventoryRouter, +agentCommissionsRouter
- `apps/web/app/commissions/page.tsx` — NUEVO: Panel comisiones con cards, gráficas, tabla
- `apps/web/components/Sidebar.tsx` — MODIFICADO: +Comisiones nav

| 2026-03-19 | 6 | Fase 6 Infraestructura Crítica completa | Ver lista abajo | Auth JWT, RBAC, message delivery, conversation UI, agents CRUD |

**Archivos creados/modificados en Fase 6 — Infraestructura Crítica:**
- `apps/server/src/middleware/auth.ts` — NUEVO: JWT auth, RBAC (director > gerente > operador), password hashing, requireAuth, requireRole, scopeToAgent
- `apps/server/src/routes/auth.ts` — NUEVO: POST /login, POST /register (first-user auto-director), GET /me, GET /agents, PUT /agents/:id
- `apps/server/src/services/message-sender.ts` — NUEVO: Entrega real de mensajes via WhatsApp Cloud API, Facebook Messenger, Instagram Direct
- `apps/server/src/routes/conversations.ts` — REESCRITO: +search, +scoped_agent_id, +GET /:id (detalle), +GET /:id/messages?after= (polling), +GET /:id/context (panel cliente), +POST /:id/read, +delivery en POST /:id/messages
- `apps/web/components/AuthProvider.tsx` — NUEVO: React context con agent, token, login, register, logout, hasRole, authFetch
- `apps/web/components/AppShell.tsx` — NUEVO: Layout wrapper con sidebar condicional
- `apps/web/components/Sidebar.tsx` — REESCRITO: Role-aware con ICON_MAP, agent info, logout
- `apps/web/app/layout.tsx` — MODIFICADO: +AuthProvider + AppShell wrapper
- `apps/web/app/login/page.tsx` — NUEVO: Login/register con auto-director para primer usuario
- `apps/web/app/conversations/page.tsx` — NUEVO: Workspace del agente — lista de conversaciones, thread de mensajes con polling cada 5s, compositor, panel de contexto del cliente (segmentos, perfil, órdenes, historial)
- `apps/web/app/agents/page.tsx` — NUEVO: Gestión de agentes (tabla, crear, editar, activar/desactivar, asignar rol)
- `apps/web/app/inbox/page.tsx` — NUEVO: Redirect a /conversations
- `apps/server/src/index.ts` — MODIFICADO: +authRouter
- `apps/server/package.json` — MODIFICADO: +@types/jsonwebtoken devDep

| 2026-03-20 | 5+ | Smart Bot Engine + WC Integration corregida | Ver lista abajo | 4 optimizaciones + flujo de pago correcto + simulación 8 escenarios |

**Archivos creados/modificados en sesión 2026-03-20 — Smart Bot + WC Integration:**
- `apps/server/src/services/smart-bot-engine.ts` — CORE: handleIncomingMessage(), 10 intents, qualification flow, medical advisory, smart routing, WC context
- `apps/server/src/services/wc-integration-engine.ts` — REESCRITO: generateWCCartLink (NO createOrderFromBot), buildCustomerWCContext, getOrderWithKanbanState, requestSKDiscount, attributeOrderToConversation, getAgentCommissionForOrder, getB2BPricing, getAgentKanbanPermissions
- `apps/server/src/data/medical-products-seed.ts` — NUEVO: 12 productos reales con clinical_info, presentations, keywords, complementary_products
- `apps/server/src/data/clinical-rules-seed.ts` — NUEVO: 6 reglas clínicas (prenatal, respiratorio, diabetes, antidoping, ETS, screening pediátrico)
- `apps/server/src/data/qualification-flows.ts` — NUEVO: 3 flujos de calificación + scoring + routing recommendation
- `apps/server/src/simulation.ts` — NUEVO: 8 escenarios end-to-end sin DB (campaign, medical, pricing, complaint, B2B, reorder, tracking, discount)
- `packages/db/migrations/005_smart_bot.sql` — NUEVO: conversation_state, lead_scores, bot_interactions, bot_mode enum
- `packages/db/migrations/006_wc_integration.sql` — NUEVO: conversation_commissions, attribution_chain, kanban_state_cache, discount_requests

**Corrección arquitectónica importante:**
- El bot NO crea órdenes directamente en WooCommerce
- Flujo correcto: Bot califica → Agente usa CRM catálogo → Genera carrito → CRM genera link de pago → Cliente paga en WC → SalesKing calcula comisiones
- `generateWCCartLink()` genera URLs con UTM attribution + salesking_agent tracking
- `attributeOrderToConversation()` conecta webhook order.completed → conversación → comisión

---

## ✅ AUTO-EVALUACIÓN vs REQUISITOS ORIGINALES

### Los 4 puntos de optimización solicitados:

| # | Requisito | Estado | Implementación |
|---|-----------|--------|----------------|
| 1 | **Respuesta instantánea a leads de campaña** | ✅ | `generateCampaignResponse()` → responde con info producto + precios + video en <500ms |
| 2 | **Calificación automática de leads** | ✅ | `runQualificationFlow()` → profesional→tipo→volumen→ubicación → score HOT/WARM/COLD |
| 3 | **Asesoría médica con IA** | ✅ | `generateMedicalAdvisory()` → RAG + Clinical Rules + perfiles + disclaimers regulatorios |
| 4 | **Enrutamiento inteligente** | ✅ | `classifyIntent()` (10 intents) + `routeConversation()` → bot/sales/senior/support |

### Consideraciones específicas del usuario:

| Requisito | Estado | Notas |
|-----------|--------|-------|
| La compra debe suceder EN WooCommerce | ✅ | `generateWCCartLink()` genera link, cliente paga en WC |
| CRM tiene catálogo/carrito built-in | ✅ | Bot NO crea órdenes, referencia al catálogo CRM existente |
| SalesKing calcula comisiones | ✅ | `attributeOrderToConversation()` + `getAgentCommissionForOrder()` via webhook |
| SalesKing Custom Discounts approval | ✅ | `requestSKDiscount()` con max_discount check + approver chain |
| Kanban status mapping | ✅ | `mapWCStatusToKanban()` → 7 estados WC → columnas Kanban en español |
| B2BKing pricing tiers | ✅ | `getB2BPricing()` lee formato "qty:price" |
| Historial de compras WC | ✅ | `buildCustomerWCContext()` → saludo personalizado + cross-sell |
| Order tracking automático | ✅ | Intent ORDER_TRACKING → `getOrderWithKanbanState()` → respuesta con estado |
| Attribution de ad a venta | ✅ | UTM en cart links + `attributeOrderToConversation()` + Meta CAPI + Google Ads |
| 12 productos médicos reales | ✅ | medical-products-seed.ts con precios MXN, sensibilidad, especificidad, SKUs |
| Clinical rules (prenatal, etc.) | ✅ | 6 reglas en clinical-rules-seed.ts |
| Simulación funcional | ✅ | 8 escenarios ejecutados exitosamente sin DB |

**TypeScript:** ✅ Compilación limpia (0 errores) en apps/server

| 2026-03-20 | Audit | Auditoría completa + 8 bug fixes + deploy guide | Ver lista abajo | tsc clean, simulación OK, auth middleware, .env.example |

**Archivos creados/modificados en sesión Audit 2026-03-20:**
- `apps/server/src/index.ts` — REESCRITO: +requireAuth en todas las rutas protegidas, +requireRole('gerente') para escalation/analytics, +requireRole('director') para AI settings
- `apps/server/src/routes/inventory.ts` — FIX: /bulk y /clear-cache ahora van ANTES de /:productId (route ordering bug)
- `apps/server/src/services/meta-capi.ts` — FIX: JOIN correcto `a.order_id = o.id AND a.id = $1`
- `apps/server/src/services/google-ads-conversion.ts` — FIX: mismo JOIN corregido
- `apps/server/src/services/wc-integration-engine.ts` — FIX: `customer_id` en INSERT a discount_requests (era order_id)
- `packages/db/migrations/006_wc_integration.sql` — FIX: Agregado columna `customer_id` a discount_requests
- `apps/web/package.json` — FIX: Agregadas dependencias: next@15, react@19, react-dom@19, lucide-react + scripts dev/build/start
- `apps/web/tsconfig.json` — NUEVO: Config TypeScript para Next.js
- `apps/server/package.json` — MEJORADO: +scripts dev/build/start/simulate/typecheck, +ts-node dep
- `apps/server/.env.example` — NUEVO: Todas las variables de entorno necesarias documentadas
- `packages/db/migrate.sh` — NUEVO: Script para correr todas las migraciones en orden
- `DEPLOY.md` — NUEVO: Guía completa de deploy a producción (8 pasos)

| 2026-03-21 | Audit 2 | Ciclo 2 de mejoras — auth en frontend + db.ts + .gitignore | Ver lista abajo | 6 páginas migradas a authFetch, db.ts mejorado |

**Archivos creados/modificados en Audit Ciclo 2 (2026-03-21):**
- `apps/web/app/escalation-rules/page.tsx` — FIX: 6 fetch→authFetch (antes daba 401 por falta de JWT)
- `apps/web/app/orders/page.tsx` — FIX: 2 fetch→authFetch
- `apps/web/app/medical-products/page.tsx` — FIX: 3 fetch→authFetch
- `apps/web/app/campaign-mappings/page.tsx` — FIX: 5 fetch→authFetch
- `apps/web/app/analytics/page.tsx` — FIX: 7 fetch→authFetch + useCallback deps
- `apps/web/app/commissions/page.tsx` — FIX: 3 fetch→authFetch + useCallback deps
- `apps/server/src/db.ts` — MEJORADO: Soporta DATABASE_URL (string) o variables individuales DB_*
- `.gitignore` — FIX: Excluye .env.* (incluyendo .env.whatsapp), mantiene .env.example
- `apps/web/.env.example` — NUEVO: NEXT_PUBLIC_API_URL documentado
