# QA Report — CRM Amunet (crm.botonmedico.com)
**Fecha:** 30 de Marzo, 2026
**Tester:** Automated QA
**Entorno:** Producción (crm.botonmedico.com / api-crm.botonmedico.com)

---

## Resumen Ejecutivo

Se auditaron 13 páginas/módulos del CRM. **10 de 13 funcionan correctamente**, 2 tienen issues menores, y 1 tiene un bug de carga.

| Estado | Módulo | Notas |
|--------|--------|-------|
| ✅ | Login | Funcional, credenciales persistentes |
| ✅ | Inbox | Chat, filtros, panel cliente, herramientas, WC integration |
| ✅ | Contactos | 18 registrados, búsqueda, etiquetas, exportar/importar CSV |
| ✅ | Campañas | Inbound (Atribución) + Outbound, métricas ROAS, Meta/Google |
| ✅ | Agenda | Lista/Calendario, métricas, + Nueva Actividad |
| ✅ | Gamificación | Leaderboard, Badges, Desafíos, sistema de puntos |
| ✅ | Supervisor | Live Control Room, rendimiento por agente, IA Insights |
| ✅ | Automatización | Flujos Visuales (n8n), Reglas Simples, RAG, Enrutamiento |
| ✅ | Productos Med. | 151 productos, semáforo, Knowledge Gaps, sync WC/KB |
| ✅ | Simulador | Canal, campaña, mensajes rápidos, respuesta del bot |
| ✅ | Settings | 12 tabs funcionales incluyendo Escalación (nuevo) |
| ⚠️ | Widget | No verificado (requiere frontend externo) |
| ❌ | Kanban/Seguimiento | Se queda en "Cargando embudo..." — no renderiza columnas |

---

## Hallazgos por Módulo

### 1. Login
- **Estado:** ✅ Funcional
- **Issue de branding:** Dice "MyAlice" en el logo y título en vez de "Amunet"
- **Positivo:** "¿Olvidaste tu contraseña?" funcional

### 2. Inbox (/inbox)
- **Estado:** ✅ Funcional
- **Positivo:**
  - Lista de conversaciones con avatar, nombre, último mensaje, timestamp, badge no leídos
  - Panel derecho con: Perfil, Agenda, Notas, Compras, Historial
  - Datos WC: nombre, teléfono, email, dirección, ciudad, estado, CP, país
  - "WC Customer #order_131600" visible
  - SalesKing vinculado (WP User #1, afiliado:1)
  - Buscar producto WooCommerce + "Enviar link de compra"
  - "Repetir pedido anterior" con historial
  - Barra inferior: ✨ AI Writer, ⚡ Respuestas Rápidas, 📅 Agenda, 📋 Catálogo, ⏰ Programar mensaje
  - Botón "Tomar control" visible (morado, ícono UserCheck)
  - Botón verde "Resolver"
  - Filtros: Todos/Míos/No leídos/Archivados + por canal + por agente
- **Issues menores:**
  - Branding "MyAlice" en sidebar y título del navegador
  - Bot responde con mensajes repetitivos de fallback ("Voy a conectarte con un asesor") cuando hay error
  - Tiempo de respuesta en Supervisor muestra 1266.3m (21 horas) — puede asustar al admin

### 3. Simulador (/simulator)
- **Estado:** ✅ Funcional
- **Positivo:**
  - Selector de canal (WhatsApp Amunet)
  - Selector de campaña de atribución
  - Nombre y teléfono del cliente configurable
  - "Nueva conversación (nuevo cliente)"
  - Mensajes rápidos predefinidos (10+ escenarios comunes)
  - Indicador "Conectado" con WebSocket
  - "Ver en Inbox" link
  - Bot responde en el chat del simulador

### 4. Contactos (/contacts)
- **Estado:** ✅ Funcional
- **Positivo:**
  - 18 contactos, paginación (1-10 de 18)
  - Búsqueda por nombre/teléfono/ID
  - Filtro por etiquetas
  - Exportar / Importar CSV
  - Columnas: Contacto, Etiqueta, Conversaciones, Registrado, Acciones

### 5. Campañas (/campaigns)
- **Estado:** ✅ Funcional
- **Positivo:**
  - Tabs: Inbound (Atribución) / Outbound (Campañas Masivas)
  - Métricas: Leads totales, Ventas WC, Ventas Agentes, Revenue total, Gasto estimado, ROAS global
  - Filtros temporales: 7d, 30d, 90d, Todo
  - Integración Meta (Facebook) y Google
  - Registro manual
  - Tabla con: Campaña, Plataforma, Leads, Ventas WC, Ventas Agentes, Revenue, Conv%, ROAS
  - Múltiples campañas de Facebook importadas (Hot Sale, Alimentos, Respiratorio, HbA1c, etc.)
- **Issue:** Todos los datos en 0 — puede ser falta de atribución o que los webhooks de WC no están enviando datos

### 6. Kanban/Seguimiento (/kanban)
- **Estado:** ❌ Bug
- **Issue:** Se queda en "Cargando embudo..." indefinidamente
- **Causa probable:** No hay pipeline configurado o la API de pipelines retorna vacío
- **Tiene:** Botón "Sincronizar WC" y "Envío Masivo"

### 7. Agenda (/agenda)
- **Estado:** ✅ Funcional
- **Positivo:**
  - Vistas Lista y Calendario
  - KPIs: Próximos Eventos, Llamadas Hoy, Reuniones Esta Semana, Tareas Pendientes
  - Búsqueda de actividad
  - Filtros y refresh
  - "+ Nueva Actividad" botón
  - Tabla: Actividad, Fecha & Hora, Cliente/Agente, Estado, Acciones
- **Vacía:** 0 actividades programadas (normal si no se han creado)

### 8. Gamificación (/gamification)
- **Estado:** ✅ Funcional
- **Positivo:**
  - Leaderboard con ranking de agentes
  - Tabs: Leaderboard, Badges, Desafíos
  - "Líder del día" badge
  - Sistema de puntos explicado: ×10 por conv resuelta, +100/$100 pipeline, +30 resp avg <3min, +20 bot rate ≥70%
  - 2 agentes visibles (feruap #1, Admin #2)
  - Métricas: resoluciones, ratio, revenue
- **Note:** Calcula puntos en frontend basándose en datos de la API, no backend dedicado

### 9. Supervisor (/supervisor)
- **Estado:** ✅ Funcional
- **Positivo:**
  - "Live Control Room"
  - KPIs: 20 Conversaciones (+12%), 0 Resueltas (+5%), 1266.3m Tiempo Resp (-2m), 19 Estancados (stable)
  - Rendimiento por Agente: Nuevos, Resueltos, Ratio, Progreso
  - "Exportar Reporte"
  - "Motivo de Contacto" panel
  - IA Insight card: "Tu tasa de resolución ha subido un 12%"
  - "Configurar Alertas" botón
  - Filtros temporales: 24h, 7d, 30d, Año

### 10. Automatización (/automations)
- **Estado:** ✅ Funcional (estructura)
- **Positivo:**
  - 3 tabs: Reglas de Flujo Automático, Base de Conocimiento (RAG), Enrutamiento de Agentes
  - Flujos Visuales (n8n) con "Crear Flujo Visual"
  - Reglas Simples con "+ Nueva Regla Simple"
- **Vacío:** No hay flujos configurados aún

### 11. Productos Médicos (/medical-products)
- **Estado:** ✅ Funcional
- **Positivo:**
  - 151 productos sincronizados de WooCommerce
  - Tabs: "Productos (151)" y "Preguntas sin Respuesta" (← Knowledge Gaps!)
  - Semáforo de completitud por producto (Score con barra de colores)
  - Filtros: categoría, Todos/Listos/Faltan, Ambos/Médicos/Labs
  - Columnas: Producto, Cat, Precio, Uds/caja, Muestra, Sens., Tiempo, KB, Médicos, Labs, Score
  - Dots verdes/rojos indican qué campos están llenos o faltan
  - Botones: "Sync Documentación → KB", "Sync Productos WC", "Sync Precios"
- **Issue:** 146 de 151 "sin preparar" — necesitan campos técnicos llenados

### 12. Settings (/settings)
- **Estado:** ✅ 12 tabs funcionales
- **Tabs verificados:**
  - Mi Perfil: nombre, email, rol, SalesKing WordPress ID, código afiliado
  - Usuarios: CRUD de agentes
  - Equipos: CRUD de equipos
  - Canales & Webhooks: WhatsApp, Facebook, Instagram, webchat
  - Horarios: horarios por equipo
  - Configuración IA: proveedor DeepSeek, API key, modelo, categorías excluidas, prompt
  - Reglas de Asignación: round-robin, por canal
  - Respuestas Rápidas: templates
  - Integraciones: WooCommerce (URL, keys), SMTP
  - Base de Conocimiento: sync MD files
  - WhatsApp Llamadas: toggle + mensaje
  - Escalación: toggles, keywords, confianza (NUEVO - implementado esta sesión)

### 13. Widget (/widget)
- **Estado:** ⚠️ No verificado
- **Nota:** Requiere integración en sitio externo, no se puede probar desde el CRM directamente

---

## Issues de Branding (Global)

| Ubicación | Actual | Debería ser |
|-----------|--------|-------------|
| Logo sidebar | "MyAlice" | "Amunet" |
| Título del navegador | "MyAlice Clone" | "Amunet CRM" |
| Login title | "MyAlice CRM Omnicanal con IA" | "Amunet CRM Omnicanal con IA" |
| Sidebar header | "A MyAlice" | "A Amunet" |

---

## Gap Analysis — Features del Código vs UI

| Feature | Backend | Frontend | Estado |
|---------|---------|----------|--------|
| Knowledge Gaps | ✅ API existe | ✅ Tab "Preguntas sin Respuesta" | **Funcional** |
| Escalación rules | ✅ API existe | ✅ Tab en Settings | **Funcional** (nuevo) |
| WhatsApp Buttons | ✅ extractButtons | ✅ Se envían | **Funcional** (nuevo, con smart titles) |
| Scheduled Messages | ✅ CRUD existe | ✅ Modal en Inbox | ⚠️ Worker deshabilitado |
| Pipelines/Kanban | ✅ API existe | ❌ Carga infinita | **Bug** |
| Gamificación backend | ❌ No hay API | ✅ Frontend calcula | ⚠️ Solo frontend |
| Attribution funnel | ✅ Básico | ✅ Campañas page | ⚠️ Datos en 0 |
| AI Response Queue | ✅ Archivos creados | ❌ Deshabilitado | Pendiente |
| Credential Encryption | ❌ No implementado | N/A | Pendiente |

---

## Recomendaciones Priorizadas

### Esta semana (P0):
1. **Fix Kanban** — revisar por qué "Cargando embudo..." se queda infinito
2. **Fix branding** — cambiar "MyAlice" por "Amunet" en 4 ubicaciones del frontend
3. **Verificar atribución** — por qué todas las campañas muestran 0 leads/revenue

### Próxima semana (P1):
4. **Habilitar scheduled messages worker** — los agentes pueden programar pero nunca se envían
5. **Configurar pipeline** — crear pipeline default con etapas para que Kanban funcione
6. **Llenar datos de productos** — 146 de 151 incompletos, afecta calidad del bot

### Backlog (P2):
7. **Gamificación backend** — persistir puntos en DB para que sobrevivan recargas
8. **AI Response Queue** — re-implementar procesamiento async cuando sea seguro
9. **Credential encryption** — cifrar tokens en DB
10. **Instrucción de botones por canal** — mover de hardcoded a configurable por canal en Settings
