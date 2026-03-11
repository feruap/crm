# MyAlice Clone: CRM Omnicanal con IA

CRM de atención al cliente omnicanal con aprendizaje automático, atribución de campañas y bot de respuestas automáticas.

---

## Arquitectura General

```
Canales (FB / IG / WhatsApp)
        │
        ▼
Webhook Handler (validación HMAC)
        │
        ▼
Resolución de Cliente (UCP)
        │
   ┌────┴────┐
   ▼         ▼
Guarda    Bot busca en knowledge_base
mensaje     │
          confianza > 0.82 → responde solo
          confianza < 0.82 → escala a humano
              │
              ▼
        Conversación resuelta
              │
              ▼
        Aprende: extrae Q&A → knowledge_base
```

---

## Stack

| Capa       | Tecnología                          |
|------------|-------------------------------------|
| Frontend   | Next.js 14 + React 19 + Tailwind 4  |
| Backend    | Node.js + Express 5 + TypeScript    |
| Base datos | PostgreSQL + pgvector               |
| Cola       | Redis + BullMQ (pendiente)          |
| Realtime   | Socket.io (pendiente)               |
| IA         | DeepSeek / Claude / Gemini / Z.ai   |

---

## Estructura del Proyecto

```
apps/
  server/
    src/
      index.ts              → Entry point, rutas principales
      db.ts                 → Pool de conexión PostgreSQL
      ai.service.ts         → Búsqueda semántica, aprendizaje, respuestas IA
      routes/
        conversations.ts    → CRUD conversaciones + envío de mensajes
        campaigns.ts        → CRUD campañas con métricas
        attributions.ts     → Atribución + sync a WooCommerce
        webhooks.ts         → Meta (FB/IG) y WhatsApp Cloud API
  web/
    components/
      Sidebar.tsx           → Navegación lateral (Inbox, Seguimiento, Campañas, IA, Supervisor, Settings)
      CustomerPanel.tsx     → Panel derecho del inbox: perfil, compras, historial, sugerencias IA, order builder
    app/
      page.tsx                → Redirect a /inbox
      inbox/page.tsx          → Bandeja omnicanal 3 columnas (lista + chat + panel cliente)
      kanban/page.tsx         → Tablero de seguimiento drag & drop por agente
      campaigns/page.tsx      → Atribución de campañas + sync WooCommerce
      supervisor/page.tsx     → Dashboard supervisor: métricas por agente, alertas, kanban por agente
      settings/page.tsx       → Config IA y vinculaciones sociales

packages/
  db/
    schema.sql              → Schema PostgreSQL completo
  types/                    → (pendiente) Tipos compartidos

workers/
  webhooks/                 → (pendiente) Consumidores BullMQ
```

---

## Schema de Base de Datos

### Tablas

| Tabla                 | Propósito                                                    |
|-----------------------|--------------------------------------------------------------|
| `agents`              | Operadores humanos con roles (admin, supervisor, agent)      |
| `customers`           | Perfil universal del cliente                                 |
| `external_identities` | Mapea WhatsApp/FB/IG/WC al mismo cliente                     |
| `channels`            | Canales conectados (configuración y webhook secret)          |
| `campaigns`           | Campañas de FB, IG, TikTok y Google Ads                     |
| `conversations`       | Hilo de mensajes, estado y agente asignado                   |
| `attributions`        | Liga cliente → campaña → conversación → orden → WooCommerce  |
| `messages`            | Mensajes con flag bot/humano y nivel de confianza            |
| `orders`              | Pedidos de WooCommerce sincronizados                         |
| `ai_settings`         | Config de proveedor IA, API key, system prompt               |
| `knowledge_base`      | Q&A aprendidos de conversaciones (con embedding pgvector)    |
| `ai_insights`         | Sentimiento y siguiente acción sugerida por conversación     |

---

## Flujo de Webhooks

```
Meta / WhatsApp POST → /api/webhooks/meta (o /whatsapp)
  └─ Valida firma HMAC
  └─ Resuelve o crea Customer
  └─ Resuelve o crea Conversation
  └─ Guarda mensaje inbound
  └─ Bot busca en knowledge_base por similitud semántica
       ├─ confianza > 0.82 → responde automáticamente
       └─ confianza < 0.82 → responde con IA generativa (fallback)
```

## Flujo de Aprendizaje del Bot

```
Conversación marcada como 'resolved'
  └─ learnFromConversation() extrae pares inbound/outbound
  └─ Genera embedding del texto de la pregunta
  └─ Inserta en knowledge_base con source_conversation_id
  └─ Bot reutiliza esa entrada en conversaciones similares
  └─ use_count se incrementa cada vez que se usa
```

## Flujo de Atribución → WooCommerce

```
Cliente viene de anuncio (FB/IG/TikTok/Google)
  └─ Se crea attribution (customer_id + campaign_id)
  └─ Cliente compra → attribution.order_id se llena
  └─ POST /api/attributions/sync-woocommerce
       └─ Para cada attribution con woocommerce_synced = FALSE:
            PUT WC /orders/:id con meta_data de campaña
            └─ Marca woocommerce_synced = TRUE
```

---

## Variables de Entorno

```env
# Base de datos
DB_HOST=localhost
DB_PORT=5432
DB_NAME=myalice_clone
DB_USER=postgres
DB_PASSWORD=

# Meta (Facebook / Instagram)
META_VERIFY_TOKEN=

# WooCommerce
WC_URL=https://tu-tienda.com
WC_KEY=ck_...
WC_SECRET=cs_...

# Servidor
PORT=3001
```

---

## Setup

```bash
# 1. Instalar dependencias
npm install

# 2. Aplicar schema (requiere pgvector instalado en PostgreSQL)
psql -d myalice_clone -f packages/db/schema.sql

# 3. Configurar .env en apps/server/

# 4. Correr en desarrollo
npm run dev
```

---

## Pendiente

- [ ] Workers BullMQ para procesar webhooks de forma asíncrona
- [ ] Socket.io para actualizaciones en tiempo real al inbox
- [ ] Integración real de APIs de IA (reemplazar stubs en ai.service.ts)
- [ ] Página `/bot` — gestión visual de la knowledge base
- [ ] `packages/types/` — tipos compartidos entre server y web
- [ ] JWT middleware para autenticación de agentes
- [ ] Webhook TikTok
- [ ] Webhook Google Ads (conversions API)
