# MyAlice CRM — Plan de Trabajo Completo
> **Archivo de referencia para la IA programadora.**
> Marca cada tarea con `[x]` al completarla. Al terminar una fase, deja un comentario con el resumen de cambios.

---

## 📐 Stack y Convenciones

| Capa | Tecnología | Notas |
|---|---|---|
| Backend | Express 5 + TypeScript | `apps/server/src/` |
| Frontend | Next.js 14 App Router + Tailwind CSS | `apps/web/app/` |
| DB | PostgreSQL + pgvector | `packages/db/schema.sql` |
| Realtime | Socket.io | emit desde rutas del server |
| Auth | JWT en header `Authorization: Bearer <token>` | middleware `requireAuth` |
| UI Icons | `lucide-react` (importar como `import * as Lucide from 'lucide-react'`) | |
| Estilos | Tailwind únicamente, sin CSS modules | paleta: slate-900 sidebar, blue-600 activo |
| Rutas API | Registrar en `apps/server/src/index.ts` con `requireAuth` | patrón: `/api/<recurso>` |
| Rutas Web | Carpeta en `apps/web/app/<ruta>/page.tsx` | `"use client"` si tiene estado |

### Patrones de código existentes
- **Rutas backend**: `const router = Router(); router.get(...); export default router;`
- **Queries DB**: `await db.query('SELECT ...', [params])` — usar `db` de `../db`
- **Páginas frontend**: componentes funcionales con `useState`/`useEffect`, fetch a `http://localhost:3001/api/...`
- **Modales**: overlay `fixed inset-0 bg-black/50 z-50` + card `bg-white rounded-2xl p-6`
- **Tabs**: array de tabs + `activeTab` state + `border-b-2 border-blue-600` en activo
- **Tokens auth**: `localStorage.getItem('token')` en frontend, header `Authorization: Bearer`

---

## 🗄️ Estado Actual de la Base de Datos

Tablas existentes (NO recrear, ya existen en producción):
- `agents`, `customers`, `external_identities`, `channels`, `campaigns`
- `conversations`, `messages`, `orders`, `attributions`
- `customer_attributes`, `ai_settings`, `knowledge_base`, `ai_insights`
- `teams`, `team_members`, `bot_flows`, `business_hours`, `business_settings`

---

## ✅ Features Ya Implementados

- [x] Autenticación JWT (login, register, requireAuth middleware)
- [x] Inbox de conversaciones con Socket.io en tiempo real
- [x] Kanban con drag-and-drop de conversaciones entre columnas
- [x] Campaña tracking (atribución FB/TikTok/IG/Google)
- [x] Bot automation flows (builder visual, 8 tipos de steps)
- [x] Base de conocimiento con embeddings (pgvector)
- [x] Settings: Perfil, Equipos, Canales & Webhooks, Horarios, Config IA
- [x] Supervisor dashboard con métricas en tiempo real
- [x] Gamificación (puntos, badges, leaderboard)
- [x] Sidebar con 7 secciones: Inbox, Seguimiento, Campañas, Automatización, Supervisor, Gamificación, Settings

---

## 🚀 FASE 1 — Inbox Pro
> **Objetivo**: Mejorar el inbox con features de productividad que el equipo de ventas usa a diario.
> **Archivos principales a crear/modificar**: `conversations` table (ALTER), nuevas tablas, rutas, página inbox.

### 1.1 — Migración de Base de Datos (correr primero)

```sql
-- Agregar campos a conversations
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS conversation_label TEXT;

-- Quick Replies (Respuestas Rápidas)
CREATE TABLE IF NOT EXISTS quick_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,  -- NULL = global
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,    -- NULL = no es de equipo
    scope TEXT NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal','team','global')),
    shortcut TEXT NOT NULL,          -- la palabra clave sin el /
    title TEXT,                      -- título opcional para identificar
    content TEXT NOT NULL,           -- el mensaje completo
    has_attachment BOOLEAN DEFAULT FALSE,
    attachment_url TEXT,
    use_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quick_replies_agent ON quick_replies(agent_id);
CREATE INDEX IF NOT EXISTS idx_quick_replies_scope ON quick_replies(scope);

-- Scheduled Messages (Programar mensaje)
CREATE TABLE IF NOT EXISTS scheduled_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id),
    channel_id UUID REFERENCES channels(id),
    content TEXT NOT NULL,
    media_url TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','cancelled')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status ON scheduled_messages(status, scheduled_at)
    WHERE status = 'pending';

-- Events / Agenda
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    agent_id UUID REFERENCES agents(id),
    customer_id UUID REFERENCES customers(id),
    conversation_id UUID REFERENCES conversations(id),
    start_at TIMESTAMP WITH TIME ZONE NOT NULL,
    end_at TIMESTAMP WITH TIME ZONE,
    all_day BOOLEAN DEFAULT FALSE,
    event_type TEXT DEFAULT 'meeting' CHECK (event_type IN ('meeting','call','demo','follow_up','other')),
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_agent ON events(agent_id, start_at);
CREATE INDEX IF NOT EXISTS idx_events_customer ON events(customer_id);

-- Event Templates
CREATE TABLE IF NOT EXISTS event_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    duration_minutes INT DEFAULT 60,
    event_type TEXT DEFAULT 'meeting',
    created_by UUID REFERENCES agents(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Tareas de migración:**
- [x] Agregar los `ALTER TABLE` y `CREATE TABLE` anteriores al final de `packages/db/schema.sql` (dentro de la sección MIGRATION comentada, descomentados para correrlos)
- [x] Correr la migración en la base de datos activa

---

### 1.2 — Backend: Rutas Nuevas

#### A. Quick Replies — `apps/server/src/routes/quickReplies.ts`
- [x] `GET /api/quick-replies` — Devuelve las del agente actual (personal + team del agente + global), ordenadas por `use_count DESC`
- [x] `POST /api/quick-replies` — Crea nueva respuesta rápida. Body: `{ shortcut, title, content, scope, team_id? }`
- [x] `PUT /api/quick-replies/:id` — Actualiza. Solo puede editar el dueño o admin.
- [x] `DELETE /api/quick-replies/:id` — Elimina. Solo dueño o admin.
- [x] `POST /api/quick-replies/:id/use` — Incrementa `use_count` (llamado al enviar).

#### B. Scheduled Messages — `apps/server/src/routes/scheduledMessages.ts`
- [x] `GET /api/scheduled-messages` — Lista mensajes programados pendientes del agente actual
- [x] `POST /api/scheduled-messages` — Programa mensaje. Body: `{ conversation_id, content, scheduled_at, media_url? }`
- [x] `DELETE /api/scheduled-messages/:id` — Cancela (cambia status a 'cancelled')
- [x] Cron job en `index.ts` — cada minuto revisar `scheduled_messages WHERE status='pending' AND scheduled_at <= NOW()`, enviar via el canal correspondiente y marcar `sent`

#### C. Conversations: nuevos campos — `apps/server/src/routes/conversations.ts` (modificar existente)
- [x] `PATCH /api/conversations/:id/star` — Toggle `is_starred`
- [x] `PATCH /api/conversations/:id/archive` — Toggle `is_archived`
- [x] `PATCH /api/conversations/:id/label` — Actualiza `conversation_label`. Body: `{ label }`
- [x] `PATCH /api/conversations/:id/tags` — Actualiza `tags[]`. Body: `{ tags: string[] }`
- [x] Modificar `GET /api/conversations` para aceptar query params: `?archived=true`, `?starred=true`, `?label=X`

#### D. Events / Agenda — `apps/server/src/routes/events.ts`
- [x] `GET /api/events` — Lista eventos. Query params: `?agent_id=`, `?start=`, `?end=`, `?customer_id=`
- [x] `POST /api/events` — Crea evento. Body: `{ title, start_at, end_at, customer_id?, conversation_id?, event_type, notes? }`
- [x] `PUT /api/events/:id` — Actualiza evento
- [x] `DELETE /api/events/:id` — Elimina evento
- [x] `GET /api/event-templates` — Lista templates
- [x] `POST /api/event-templates` — Crea template
- [x] `POST /api/events/from-template/:templateId` — Crea evento a partir de template. Body: `{ start_at, customer_id? }`

#### E. Analytics Agentes — `apps/server/src/routes/analytics.ts` (crear o modificar)
- [x] `GET /api/analytics/summary` — Query params: `?from=&to=`. Devuelve: `{ new_conversations, resolved, avg_response_time_minutes, messages_sent, messages_received }`
- [x] `GET /api/analytics/by-agent` — Mismo período, desglose por agente: `[{ agent_id, name, new_conversations, messages_sent, resolved, starred }]`

#### Registrar rutas en `apps/server/src/index.ts`:
- [x] `import quickRepliesRouter from './routes/quickReplies';`
- [x] `import scheduledMsgsRouter from './routes/scheduledMessages';`
- [x] `import eventsRouter from './routes/events';`
- [x] `import analyticsRouter from './routes/analytics';`
- [x] `import aiRouter from './routes/ai';`
- [x] `app.use('/api/quick-replies',      requireAuth, quickRepliesRouter);`
- [x] `app.use('/api/scheduled-messages', requireAuth, scheduledMsgsRouter);`
- [x] `app.use('/api/events',             requireAuth, eventsRouter);`
- [x] `app.use('/api/analytics',          requireAuth, analyticsRouter);`
- [x] `app.use('/api/ai',                 requireAuth, aiRouter);`

---

### 1.3 — Frontend: Mejoras al Inbox

**Archivo**: `apps/web/app/inbox/page.tsx` (reescribir/ampliar sección del inbox)

#### A. Tabs en el panel izquierdo
- [x] Reemplazar filtros actuales por tabs: **Todos | Asignados a mí | No leídos | Archivados | ⭐ Importantes**
- [x] Tab "Archivados" llama a `GET /api/conversations?archived=true`
- [x] Tab "Importantes" llama a `GET /api/conversations?starred=true`

#### B. Header de conversación — nuevos controles
- [x] **Dropdown de etiqueta** — selector de label (`Nuevo Cliente`, `Negociación`, `Seguimiento`, `Cerrado`, `Sin interés` + opción custom). Llama a `PATCH /api/conversations/:id/label`
- [x] **Dropdown de importancia** — `Normal` / `⭐ Importante`. Llama a `PATCH /api/conversations/:id/star`
- [x] **Botón archivar** — icono 📦, llama a `PATCH /api/conversations/:id/archive`. Mueve la conversación fuera del inbox activo.
- [x] **Botón marcar leído** — icono ✉️, ya existe `is_read`, simplemente marcar todos los mensajes como leídos.

#### C. Toolbar inferior — nuevos botones
- [x] **✨ AI Writer** (botón morado) — Abre panel lateral con textarea. Botones: `Profesional` / `Amigable` / `Conciso` / `Reformular`. Llama a `POST /api/ai/suggest` con body `{ conversation_id, draft?, tone }`. Respuesta: `{ suggestion: string }`. Botón "Usar" rellena el textarea de envío.
- [x] **⚡ Respuestas Rápidas** — Abre panel flotante encima del input con:
  - Buscador `/ Buscar` (filtra por shortcut o contenido)
  - Lista de respuestas ordenadas por uso
  - Click en una respuesta → rellena el input del mensaje
  - Botón "+ Nueva respuesta" → abre mini-modal de creación (shortcut, contenido, scope)
  - Llama a `GET /api/quick-replies`
- [x] **📅 Agendar Evento** — Abre modal `AgendarEventoModal` con: título, tipo, fecha/hora inicio, fecha/hora fin, notas. Pre-llena `customer_id` del contacto activo. Llama a `POST /api/events`.
- [x] **🕐 Programar Mensaje** — Abre modal `ProgramarMensajeModal` con: textarea del mensaje, date/time picker para `scheduled_at`. Llama a `POST /api/scheduled-messages`. Muestra badge en la conversación indicando que hay un mensaje programado.

#### D. Panel derecho de conversación — secciones colapsables
- [x] **Atributos del contacto**: Nombre, Teléfono, Email, Valor, Etapa en funnel
- [x] **Notas**: textarea que guarda en `customer_attributes` con key `notes`
- [x] **Mensajes programados**: lista de los scheduled_messages pendientes de esta conversación con botón cancelar
- [x] **Eventos**: lista de events del customer con link rápido a la agenda

---

## 📅 FASE 2 — Directorio y Productividad
> **Objetivo**: Gestión de contactos, auto-asignación, leads estancados.

### 2.1 — Migración de Base de Datos

```sql
-- Auto-asignación por funnel (kanban)
-- En nuestro sistema el "funnel" equivale a un conjunto de conversaciones filtradas
-- Usamos la tabla kanban_columns existente o creamos reglas de asignación
CREATE TABLE IF NOT EXISTS assignment_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    channel_id UUID REFERENCES channels(id),         -- NULL = aplica a todos
    team_id UUID REFERENCES teams(id),               -- Asigna al equipo
    strategy TEXT DEFAULT 'round_robin' CHECK (strategy IN ('round_robin','least_busy','random')),
    is_active BOOLEAN DEFAULT TRUE,
    agent_ids UUID[] DEFAULT '{}',                   -- Agentes participantes en el round-robin
    current_index INT DEFAULT 0,                     -- Puntero para round-robin
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stagnant lead tracking — agregar campo a conversations
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS last_stage_change TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS stagnant_threshold_days INT DEFAULT 3,
  ADD COLUMN IF NOT EXISTS is_stagnant BOOLEAN DEFAULT FALSE;

-- Bulk message campaigns
CREATE TABLE IF NOT EXISTS bulk_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    message_content TEXT NOT NULL,
    media_url TEXT,
    agent_id UUID REFERENCES agents(id),
    channel_id UUID REFERENCES channels(id),
    filter_criteria JSONB,          -- { label: 'Nuevo Cliente', tags: [...], stage: '...' }
    recipient_count INT DEFAULT 0,
    sent_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft','running','completed','cancelled')),
    scheduled_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bulk_campaign_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bulk_campaign_id UUID REFERENCES bulk_campaigns(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id),
    conversation_id UUID REFERENCES conversations(id),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT
);
CREATE INDEX IF NOT EXISTS idx_bulk_recipients_campaign ON bulk_campaign_recipients(bulk_campaign_id, status);
```

**Tareas:**
- [x] Agregar migraciones al `schema.sql`
- [x] Correr migración en DB activa

---

### 2.2 — Backend

#### A. Directorio de Contactos — ampliar `apps/server/src/routes/customers.ts`
- [x] `GET /api/customers` — con paginación (`?page=1&limit=25`), búsqueda (`?search=`), filtros (`?label=`, `?tag=`, `?channel_id=`). Devuelve: `{ data: Customer[], total, page, limit }`
- [x] `GET /api/customers/:id` — detalle completo: customer + external_identities + últimas 5 conversaciones + atributos + órdenes
- [x] `PUT /api/customers/:id` — Actualizar `display_name`, `avatar_url`
- [x] `POST /api/customers/import` — Recibe CSV (multipart/form-data), parsea y crea customers + external_identities. Devuelve `{ created, updated, errors }`
- [ ] `GET /api/customers/export` — Devuelve CSV con todos los leads (nombre, teléfono, email, último mensaje, etiqueta, embudo, etapa)

#### B. Auto-asignación — `apps/server/src/routes/assignmentRules.ts`
- [x] `GET /api/assignment-rules` — Lista reglas activas
- [x] `POST /api/assignment-rules` — Crea regla
- [x] `PUT /api/assignment-rules/:id` — Actualiza (activar/desactivar, cambiar agentes)
- [x] `DELETE /api/assignment-rules/:id`
- [x] Lógica en webhook handler: cuando llega nuevo mensaje y la conversación es nueva, buscar regla activa para ese canal y asignar automáticamente usando la estrategia definida.

#### C. Mensajes Masivos — `apps/server/src/routes/bulkCampaigns.ts`
- [x] `GET /api/bulk-campaigns` — Lista campañas masivas
- [x] `POST /api/bulk-campaigns` — Crea campaña con `filter_criteria`
- [x] `POST /api/bulk-campaigns/:id/preview` — Devuelve el listado de destinatarios según `filter_criteria` sin enviar. Respuesta: `{ recipients: Customer[], count: number }`
- [x] `POST /api/bulk-campaigns/:id/send` (o `/start`) — Inicia el envío. Marca cada recipient como pending y usa BullMQ para procesar en background.
- [x] `GET /api/bulk-campaigns/:id/status` — Devuelve progreso: `{ total, sent, failed, pending }`
- [ ] Worker BullMQ en `apps/server/src/workers/bulkSender.ts` — procesa cada recipient, envía mensaje via WhatsApp API, actualiza status.

#### D. Analytics ampliado
- [ ] Ampliar `GET /api/analytics/summary` para incluir `label_breakdown: { [label]: count }` y `stagnant_count`
- [ ] `GET /api/analytics/by-agent` — Agregar campo `avg_response_time_minutes`

---

### 2.3 — Frontend

#### A. Nueva página: Directorio — `apps/web/app/contacts/page.tsx`
- [x] Tabla con columnas clave
- [x] Buscador en tiempo real
- [x] Filtros por estado, etiqueta, canal
- [x] Botón **Importar Leads** con modal CSV
- [x] Botón **Exportar** a CSV
- [x] Click en fila → drawer lateral con detalle del contacto (conversaciones, atributos, eventos)
- [x] Agregar al Sidebar: `{ href: '/contacts', icon: Users, label: 'Contactos' }` entre Inbox y Seguimiento

#### B. Mejoras al Kanban — `apps/web/app/kanban/page.tsx`
- [x] Badge 🟠 "Estancado" en cards con `is_stagnant = true`
- [x] Botón **📤 Envío masivo** en header del kanban → abre modal `BulkSendModal`
  - Paso 1: Confirmar destinatarios (muestra count por columna seleccionada)
  - Paso 2: Redactar mensaje + adjunto opcional
  - Paso 3: Confirmación → llama a `POST /api/bulk-campaigns`
- [x] Modal de **Auto-asignación** mejorado: selector de estrategia (Round-robin / Menos ocupado), toggle por agente

#### C. Nueva página: Agenda — `apps/web/app/agenda/page.tsx`
- [x] **3 vistas**: Lista | Calendario (grid mensual) | Equipo (por columnas de agente)
- [x] Botón **+ Agregar Evento** → modal con todos los campos
- [x] Botón **Templates** → lista de templates, click → pre-llena el modal
- [x] Vista Lista: tabla con Título, Cliente, Fecha, Tipo, Estado, Agente, acciones (editar/cancelar)
- [x] Vista Calendario: grid de 7 columnas (días de la semana), filas por hora, eventos como cards de colores
- [x] Vista Equipo: columna por agente con sus eventos del día/semana
- [x] Agregar al Sidebar: `{ href: '/agenda', icon: CalendarDays, label: 'Agenda' }` entre Seguimiento y Campañas

---

## 🌐 FASE 3 — Growth & Widget
> **Objetivo**: Herramientas de captación y análisis avanzado.

### 3.1 — Migración de Base de Datos

```sql
-- LeadClick Widget Config
CREATE TABLE IF NOT EXISTS widget_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL DEFAULT 'Mi Widget',
    channels JSONB DEFAULT '[]',           -- [{ provider: 'whatsapp', label: 'Contáctanos' }, ...]
    bg_color TEXT DEFAULT '#5A59D5',
    text_color TEXT DEFAULT '#FFFFFF',
    welcome_text TEXT DEFAULT '¿Cómo podemos ayudarte?',
    position TEXT DEFAULT 'right' CHECK (position IN ('left','right')),
    is_active BOOLEAN DEFAULT TRUE,
    embed_code_version INT DEFAULT 1,      -- Incrementa al guardar para invalidar el código viejo
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Tareas:**
- [x] Agregar campo `embed_code_version` a `widget_configs`
- [x] Correr migraciones

---

### 3.2 — LeadClick Widget Builder
- [x] **Backend**: `GET/PUT /api/widget-config` y `GET /api/widget-config/embed-code`
- [x] **Frontend**: Página `apps/web/app/widget/page.tsx` con live preview
- [x] **Script**: `apps/server/public/widget.js` — script portable que carga el widget en sitios externos (Shadow DOM)

---

### 3.3 — Analytics Dashboard (Supervisor)
- [x] **Backend**: Ampliar `/api/analytics/summary` con labels y estancados
- [x] **Frontend**: Nuevo dashboard en `apps/web/app/supervisor/page.tsx` con cards, tabla de agentes y breakdown de etiquetas.

---

### 3.4 — Reportes y Exportación
- [x] Botón **Exportar** en Analytics Dashboard
- [x] Integración de BullMQ para procesos pesados (Bulk Campaigns)

---

## 🗺️ Orden de Ejecución Recomendado

```
FASE 1:
  1. Correr migraciones SQL de Fase 1
  2. Backend: quickReplies.ts
  3. Backend: conversations.ts (nuevos campos)
  4. Backend: ai.ts (POST /ai/suggest)
  5. Backend: scheduledMessages.ts + cron
  6. Backend: events.ts
  7. Registrar rutas en index.ts
  8. Frontend: inbox/page.tsx (tabs + header controls + toolbar)
  9. Frontend: inbox/page.tsx (panel derecho)

FASE 2:
  10. Correr migraciones SQL de Fase 2
  11. Backend: customers.ts (ampliar)
  12. Backend: assignmentRules.ts + lógica webhook
  13. Backend: bulkCampaigns.ts + worker BullMQ
  14. Frontend: contacts/page.tsx
  15. Frontend: kanban/page.tsx (mejoras)
  16. Frontend: agenda/page.tsx

FASE 3:
  17. Correr migraciones SQL de Fase 3
  18. Backend: widgetConfig.ts
  19. Backend: analytics.ts (ampliar)
  20. Frontend: widget/page.tsx
  21. Frontend: analytics/page.tsx
```

---

## 📝 Notas para la IA Programadora

1. **No borrar ni recrear tablas existentes** — solo usar `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
2. **No cambiar el auth flow** — el middleware `requireAuth` ya funciona, usarlo en todas las rutas nuevas
3. **Seguir el patrón de imports de Lucide**: `import * as Lucide from 'lucide-react'; const { X, Plus, ... } = Lucide as any;`
4. **Para Socket.io**: emitir eventos usando `req.app.get('io').emit('event_name', data)` desde las rutas
5. **Errores TypeScript pre-existentes**: hay algunos warnings de `@types` faltantes (`bcryptjs`, `jsonwebtoken`, etc.) — no son bloqueantes, ignorar
6. **URL del API**: el frontend hace fetch a `http://localhost:3001/api/...` con el token del `localStorage`
7. **Tailwind clases comunes**:
   - Botón primario: `bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium`
   - Botón secundario: `border border-slate-300 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm`
   - Input: `border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`
   - Badge: `px-2 py-0.5 rounded-full text-xs font-medium`
8. **AI Suggest endpoint**: usar el AI provider marcado como `is_default = TRUE` en `ai_settings`. El contexto debe incluir los últimos 10 mensajes de la conversación.
9. **Cron de scheduled_messages**: agregar junto al cron existente de alertas en `index.ts`, frecuencia cada 1 minuto.
10. **BullMQ para bulk send**: el worker puede estar en `apps/server/src/workers/bulkSender.ts`, conectar a Redis (agregar `REDIS_URL` al `.env`).

---

## 🔄 Log de Progreso

> La IA programadora debe actualizar esta sección al completar cada fase.

### Fase 1
- [x] Migraciones SQL aplicadas
- [x] Backend completo
- [x] Frontend inbox actualizado

### Fase 2
- [x] Migraciones SQL aplicadas
- [x] Backend completo (Auto-asignación, Mensajes masivos, Directorio)
- [x] Frontend completo (Contactos import/export, Kanban improvements, Agenda)

### Fase 3
- [x] Migraciones SQL aplicadas
- [x] Widget Builder implementado (Backend + Frontend + Script)
- [x] Analytics Dashboard avanzado implementado
- [x] Integración de BullMQ para tareas de fondo

---

## 🔧 FASE 4 — Correcciones Arquitectónicas
> **Objetivo**: Tres correcciones críticas identificadas en revisión: gestión de usuarios, canales multi-subtype y modelo de atribución dual (e-commerce + agentes SalesKing).
> **Estas tareas son independientes entre sí — pueden implementarse en paralelo.**

---

### 4.1 — Gestión de Usuarios / Agentes en Settings

#### Contexto
Actualmente no existe UI para crear, editar ni desactivar agentes. El único agente inicial es el admin semilla (`admin@myalice.ai`). Los nuevos usuarios deben ser creados por un admin desde Settings.

#### Migración SQL
```sql
-- Sin migraciones nuevas — la tabla agents ya existe con todos los campos necesarios
-- Solo verificar que exista el campo avatar_url (agregar si falta):
ALTER TABLE agents ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;
```

#### Backend — ampliar `apps/server/src/routes/agents.ts`
- [x] `GET /api/agents` — Lista todos los agentes (ya existe, verificar que devuelva `id, name, email, role, is_active, created_at, salesking_agent_code`)
- [x] `POST /api/agents` — Crea agente. Solo rol `admin` puede. Body: `{ name, email, password, role }`. Hashea password con bcryptjs. Devuelve agente sin `password_hash`.
- [x] `PUT /api/agents/:id` — Actualiza `name`, `email`, `role`, `is_active`, `salesking_agent_code`, `avatar_url`. Solo admin o el mismo agente (sin cambiar `role`).
- [x] `DELETE /api/agents/:id` — Soft delete: setea `is_active = FALSE`. Reasigna sus conversaciones abiertas a `NULL`. No borra el registro.
- [x] `POST /api/agents/:id/reset-password` — Admin resetea password. Body: `{ new_password }`.

#### Frontend — nuevo tab en `apps/web/app/settings/page.tsx`
Agregar tab **"Usuarios"** entre "Equipos" y "Canales & Webhooks":

- [x] Tabla de agentes con columnas: Avatar, Nombre, Email, Rol (badge: Admin/Supervisor/Agente), Estado (Activo/Inactivo toggle), Código SalesKing, Acciones (✏️ editar, 🗑️ desactivar)
- [x] Botón **"+ Invitar Usuario"** → modal con: Nombre, Email, Contraseña temporal, Rol (dropdown), Código SalesKing (opcional)
- [x] Modal **Editar Agente**: mismos campos + toggle Activo/Inactivo + "Resetear contraseña"
- [x] Al desactivar: confirmación "¿Desactivar a [nombre]? Sus conversaciones activas quedarán sin asignar."
- [x] Roles con descripción visual:
  - 🔴 **Admin** — Acceso total, puede crear/eliminar usuarios y configurar el sistema
  - 🟡 **Supervisor** — Ve todas las conversaciones, puede reasignar, ve analytics completos
  - 🟢 **Agente** — Solo ve sus conversaciones asignadas y las no asignadas

---

### 4.2 — Canales Multi-Subtype (Facebook Messenger + Feed / Instagram Chat + Comments)

#### Contexto
Meta envía **un solo webhook** por app, pero con **tipos de evento distintos** dentro del payload:
- `entry[].messaging[]` → Mensajes directos (Messenger DM / Instagram DM)
- `entry[].changes[field='feed']` → Comentarios en posts/anuncios de Facebook
- `entry[].changes[field='comments']` → Comentarios en posts de Instagram

Actualmente nuestro sistema tiene UN canal Facebook y UN canal Instagram que no distinguen el tipo. Necesitamos distinguirlos para:
1. Asignar diferentes equipos por tipo (ej: soporte atiende DMs, marketing atiende comentarios de ads)
2. Configurar diferentes flujos de bot por tipo
3. Analytics separados por canal de entrada
4. Identificar qué conversaciones vienen de anuncios específicos (crítico para atribución)

#### Migración SQL
```sql
-- Agregar subtype al canal para distinguir DM vs Feed/Comments
ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS subtype TEXT
    CHECK (subtype IN ('messenger','feed','chat','comments','api'))
    DEFAULT 'api';

-- Índice para lookup rápido en webhook handler
CREATE INDEX IF NOT EXISTS idx_channels_provider_subtype
  ON channels(provider, subtype)
  WHERE is_active = TRUE;

-- Agregar campo a conversations para saber el subtype de origen
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS channel_subtype TEXT;

-- Agregar referencia al post/anuncio en mensajes de tipo feed/comments
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS source_post_id TEXT,      -- ID del post o anuncio donde comentó
  ADD COLUMN IF NOT EXISTS source_comment_id TEXT,   -- ID del comentario original
  ADD COLUMN IF NOT EXISTS parent_comment_id TEXT;   -- Si es respuesta a un comentario
```

#### Backend — Modificar webhook handler
El webhook de Meta llega a un endpoint (ej: `POST /webhook/facebook`). Modificar la lógica de procesamiento:

- [x] Al recibir webhook de Facebook/Meta, detectar el tipo de evento:
  ```
  if payload.entry[].messaging[]      → subtype = 'messenger'  (DM al page)
  if payload.entry[].changes[field='feed']  → subtype = 'feed'  (comentario en post/ad)
  ```
- [x] Buscar el canal activo con `provider='facebook'` y `subtype` correspondiente
- [x] Si existe canal con ese subtype → crear/asignar conversación a ese canal
- [x] Si solo existe canal genérico (subtype=NULL) → backward compatible, asignar al canal genérico
- [x] Para eventos `feed` de anuncios: extraer el `ad_id` del payload y buscar en `campaigns` para crear la atribución automáticamente

- [x] Lo mismo para Instagram:
  ```
  if payload.entry[].messaging[]           → subtype = 'chat'     (DM de Instagram)
  if payload.entry[].changes[field='comments'] → subtype = 'comments' (comentario en post IG)
  ```

#### Frontend — Actualizar modal de canal en Settings → Canales & Webhooks
- [x] Al crear/editar un canal Facebook, mostrar selector de **Subtype**:
  - `Messenger (DMs)` — para mensajes directos a la página
  - `Facebook Feed (comentarios en posts y anuncios)` — para comentarios
- [x] Al crear/editar canal Instagram:
  - `Instagram Chat (DMs)` — mensajes directos
  - `Instagram Comments (comentarios en posts)` — comentarios
- [x] Actualizar el texto de la URL de webhook para que indique que UN solo webhook sirve para todos los subtypes del mismo provider
- [x] En la lista de canales, mostrar el subtype como badge junto al nombre

---

### 4.3 — Modelo de Atribución Dual (WooCommerce + SalesKing)

#### Contexto del negocio
El negocio tiene **dos caminos de venta** que ambos necesitan atribución:

```
Anuncio FB/Google
       ↓
   Landing page (con GCLID/UTM capturado)
       ↓
  WhatsApp o WebChat
       ↙              ↘
Compra en línea      Agente cierra venta
(WooCommerce)        (SalesKing plugin)
       ↓                    ↓
Orden WC              Orden SalesKing
       ↘              ↙
    ATRIBUCIÓN A CAMPAÑA
    → Leads, Revenue, ROAS
```

**SalesKing**: plugin de WooCommerce para gestión de vendedores. Cuando un agente cierra una venta, genera una orden WooCommerce pero con meta datos de agente (`salesking_agentid`). Nuestro campo `agents.salesking_agent_code` ya existe para esta integración.

#### Migración SQL
```sql
-- Agregar deal_value a conversations (para ventas cerradas por agente sin WooCommerce)
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS deal_value DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS deal_currency CHAR(3) DEFAULT 'MXN',
  ADD COLUMN IF NOT EXISTS deal_closed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS deal_closed_by UUID REFERENCES agents(id);

-- Agregar sale_source a attributions para distinguir el origen de la venta
ALTER TABLE attributions
  ADD COLUMN IF NOT EXISTS sale_source TEXT
    CHECK (sale_source IN ('woocommerce','salesking','manual','unknown'))
    DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS sale_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS sale_currency CHAR(3) DEFAULT 'MXN';

-- Agregar ad_spend a campaigns para calcular ROAS
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS daily_budget DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS total_spend DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS spend_currency CHAR(3) DEFAULT 'MXN',
  ADD COLUMN IF NOT EXISTS spend_last_synced_at TIMESTAMP WITH TIME ZONE;
```

#### Backend — Ruta de atribución mejorada `apps/server/src/routes/attributions.ts`
- [x] `GET /api/attributions/summary` — Dashboard de atribución. Query params: `?from=&to=&platform=`. Devuelve por campaña:
  ```json
  {
    "campaigns": [{
      "campaign_id": "...",
      "name": "Dr. Marco FB Ads",
      "platform": "facebook",
      "leads_count": 47,
      "woocommerce_sales": 8,
      "salesking_sales": 4,
      "total_sales": 12,
      "total_revenue": 24000,
      "conversion_rate": 25.5,
      "total_spend": 3200,
      "roas": 7.5
    }]
  }
  ```
- [x] `PATCH /api/conversations/:id/close-deal` — El agente marca la conversación como venta ganada. Body: `{ deal_value, deal_currency? }`. Crea o actualiza la `attribution` con `sale_source='manual'` y `sale_amount=deal_value`. Actualiza `conversation.status = 'resolved'`.
- [x] `POST /api/attributions/woocommerce-sync` — Recibe webhook de WooCommerce cuando se crea/actualiza una orden. Busca si existe una conversación/attribution para ese customer, la vincula y setea `sale_source='woocommerce'`. Registrar como ruta pública (sin `requireAuth`) pero con verificación de `webhook_secret`.
- [x] `POST /api/attributions/salesking-sync` — Igual que WC pero para órdenes de SalesKing. Extrae `salesking_agentid` del metadata de la orden WC para identificar al agente y actualiza `sale_source='salesking'`.

#### Frontend — Rediseño de página Campañas `apps/web/app/campaigns/page.tsx`
- [x] **Eliminar** el botón "Sincronizar WC" del header principal (moverlo a Settings)
- [x] Tabla de campañas con columnas de atribución:
  | Campaña | Plataforma | Leads | Ventas WC | Ventas Agentes | Revenue Total | Conv% | ROAS |
  |---|---|---|---|---|---|---|---|
  | Dr. Marco FB | 🟦 | 47 | 8 | 4 | $24,000 | 25.5% | 7.5x |
- [x] Cada fila expandible → muestra lista de clientes atribuidos con su conversación y venta
- [x] **Filtro de período** (última semana / último mes / rango) en el header
- [x] Badge por plataforma: 🟦 Facebook, 🔴 Google, 🟣 Instagram, ⚫ TikTok
- [x] Botón **"Cerrar Venta"** en el inbox (panel derecho de la conversación activa):
  - Modal: campo de monto + moneda (MXN default) + nota opcional
  - Llama a `PATCH /api/conversations/:id/close-deal`
  - El badge de la conversación cambia a "✅ Ganado - $X,XXX"

#### Frontend — Settings → nueva sección "Integraciones"
- [x] Nuevo tab **"Integraciones"** en Settings (después de "Canales"):
  - **WooCommerce**: campo URL de la tienda + consumer_key + consumer_secret. Webhook URL para recibir nuevas órdenes. Toggle "Auto-sincronizar órdenes nuevas".
  - **SalesKing**: instrucciones para instalar el webhook en WP + campo de `webhook_secret`. Explicación de cómo se mapean los `salesking_agentid` a los agentes del CRM.
  - **Google Ads**: campo de `Customer ID` + instrucciones para configurar conversiones offline.
  - **Facebook Ads**: instrucciones para configurar el parámetro `ref=` en los anuncios Click-to-WhatsApp.

---

### 4.4 — Registro de nuevas rutas en `index.ts`
- [x] `app.use('/api/agents', requireAuth, agentsRouter);` ← verificar si ya existe o agregar
- [x] `app.use('/api/attributions', requireAuth, attributionsRouter);`
- [x] `POST /webhook/woocommerce` sin requireAuth, con validación de secret
- [x] `POST /webhook/salesking` sin requireAuth, con validación de secret

---

### 🔄 Log de Progreso — Fase 4

- [x] 4.1 Gestión de Usuarios: migraciones + backend + UI Settings
- [x] 4.2 Channel Subtypes: migración + webhook handler + UI Settings
- [x] 4.3 Atribución Dual: migraciones + rutas + página Campañas + botón "Cerrar Venta"
- [x] 4.4 Rutas registradas en index.ts

**Resumen Fase 4 — 28/02/2026:**
- `packages/db/schema.sql`: Migraciones SQL para `agents` (avatar_url, last_login_at), `channels` (subtype + index), `conversations` (channel_subtype, deal_value, deal_currency, deal_closed_at, deal_closed_by), `messages` (source_post_id, source_comment_id, parent_comment_id), `attributions` (sale_source, sale_amount, sale_currency), `campaigns` (daily_budget, total_spend, spend_currency, spend_last_synced_at)
- `apps/server/src/routes/agents.ts`: Reescrito con PUT/:id, DELETE/:id (soft delete + reasignación), POST/:id/reset-password
- `apps/server/src/routes/attributions.ts`: Añadidos GET /summary (ROAS por campaña), POST /woocommerce-sync (webhook público), POST /salesking-sync (webhook público)
- `apps/server/src/routes/conversations.ts`: Añadido PATCH /:id/close-deal (venta manual)
- `apps/server/src/routes/webhooks.ts`: Meta webhook reescrito para ruteo por subtype (messenger/feed/chat/comments)
- `apps/server/src/routes/channels.ts`: Soporte para campo `subtype` en GET/POST/PATCH
- `apps/server/src/index.ts`: Middleware condicional para rutas públicas woocommerce-sync y salesking-sync
- `apps/web/app/settings/page.tsx`: Tabs nuevos "Usuarios" (CRUD completo de agentes) e "Integraciones" (WC, SalesKing, Google Ads, Meta Ads). Tab Canales: selector de subtype para FB/IG, badge en lista.
- `apps/web/app/campaigns/page.tsx`: Vista Atribución rediseñada: tabla ROAS con columnas Leads/Ventas WC/Ventas Agentes/Revenue/Conv%/ROAS, filtro de período, filas expandibles con desglose por fuente. Removido botón "Sincronizar WC".
- `apps/web/app/inbox/page.tsx`: Botón "Cerrar Venta" con modal (monto + moneda) que llama a PATCH /close-deal.

---

## 🔍 FASE 5 — Análisis Comparativo y Diferenciadores (Leadsales vs MyAlice Clone)
> **Objetivo**: Implementar las herramientas nativas vistas en Leadsales y MyAlice oficial que aún nos faltan, asegurando paridad competitiva.

### 5.1 — Funcionalidades Faltantes (Backlog)
- [ ] **Soporte de Audios (Voice Notes)**: Interfaz en el inbox para grabar, enviar y reproducir notas de voz de WhatsApp (.ogg/.mp4). Actualmente solo manejamos URLs de media básicas.
- [ ] **Embudos Múltiples (Pipelines)**: El sistema actual tiene un solo tablero Kanban global. Leadsales permite múltiples "Embudos" (ej. "Cardiología", "Leads Nuevos") para segmentar procesos de venta.
- [ ] **SLA y Tracker de "Leads sin atender"**: En Leadsales, el panel principal resalta en rojo sangre las conversaciones no respondidas a tiempo. Falta implementar un cronjob estricto de SLA que dispare alertas visuales globales.
- [ ] **Leadbot Visual (Flow Builder)**: Aunque tenemos configuración de bots, falta un constructor visual (drag-and-drop) tipo árbol de decisiones para automatizar respuestas de primer contacto de forma amigable (como el de Leadsales/MyAlice oficial).
- [ ] **Restricciones de Interfaz (Roles)**: La vista debe mutar drásticamente entre un Seller (solo su canal/embudo) y un Owner (acceso global a exportaciones y facturación). Actualmente todos ven la estructura base, falta pulir el _UI rendering_ basado en `agent.role`.
- [ ] **Avisos de Límite de Plan**: Leadsales alerta a los 4k de 5k conversaciones. Implementar un "Plan Quota Tracker" visual.
- [ ] **Visor de Catálogo de Productos Nativo**: MyAlice oficial brilla en e-commerce permitiendo ver y enviar "Fichas de producto" en el chat. Nos falta la UI para mandar tarjetas/carruseles de productos de WooCommerce al cliente.

---

*Generado el 28/02/2026 — Basado en análisis comparativo directo con el ambiente real de LeadSales (crm.leadsales.services)*
