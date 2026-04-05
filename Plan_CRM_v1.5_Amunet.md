# Plan de Implementacion - CRM Amunet v1.5

**Fecha:** 4 de abril de 2026
**Ambiente objetivo:** Pruebas (tst.amunet.com.mx) -> Produccion (crm.botonmedico.com)
**Prioridad:** Inbox + Panel del cliente como core funcional

---

## Estado actual del codigo (Diagnostico)

El repositorio en GitHub (feruap/crm) contiene un CRM bastante completo con 28 rutas API, 20+ tablas en PostgreSQL con pgvector, frontend Next.js con 16 paginas, y servicios para WooCommerce, IA multi-proveedor, escalacion, y campanias.

### Lo que ya esta codificado y funcional

- Inbox omnicanal (WhatsApp, Facebook, Instagram, TikTok, Webchat)
- Panel del cliente con identidades, historial de compras WC, sugerencias IA
- Creacion de pedidos desde la conversacion con envio a WooCommerce
- Integracion SalesKing (mapeo de agentes, comisiones, metadata en ordenes)
- Kanban con estados sincronizados a WooCommerce
- Knowledge base con busqueda semantica (pgvector)
- Bot con threshold de confianza (0.82) y 4 tipos de triggers
- Modelo de atribucion (UTM, campanias, ROAS)
- Quick replies, horarios de negocio, reglas de escalacion
- Settings UI con 12 tabs configurables desde la interfaz
- Modulo medico con flujos de calificacion y reglas clinicas
- Motor de recomendaciones (cross-sell, recompra, next-best-action)

### Lo que esta incompleto o requiere verificacion

| Area | Estado | Problema |
|------|--------|----------|
| Envio real de mensajes a canales | ~30% | Mensajes se guardan en DB pero la integracion con APIs de WhatsApp/Meta/IG necesita verificarse |
| Motor de ejecucion del bot | ~40% | Trigger de aprendizaje existe; engine de ejecucion de flows no verificado |
| Socket.io tiempo real | ~60% | Inicializado, pero handlers de eventos no completamente revisados |
| Integracion B2BKing | Stub | Retorna datos hardcodeados |
| SalesKing API real | Parcial | Usa fallback a DB local, no llama al plugin directamente |
| TikTok | Stub | Tipo de canal definido pero sin implementacion de API |
| Estado de produccion | Desconocido | Hay que verificar si crm.botonmedico.com esta funcional |

---

## FASE 0 - Diagnostico de produccion (Dia 1)

**Objetivo:** Saber exactamente que esta corriendo y que no.

### Tareas

1. **Verificar CRM en produccion**
   - Acceder a crm.botonmedico.com y verificar si carga
   - Acceder a api-crm.botonmedico.com/api/health para verificar backend
   - Revisar logs en Coolify (cool.botonmedico.com) para ambos servicios

2. **Comparar codigo desplegado vs GitHub**
   - Conectar por SSH al servidor desde Coolify terminal
   - Comparar version del codigo desplegado contra el repo
   - Verificar variables de entorno configuradas en Coolify

3. **Verificar base de datos**
   - Conectar a PostgreSQL y listar tablas existentes
   - Verificar si las migraciones Fase 7 ya corrieron
   - Verificar si hay datos de prueba o produccion

4. **Verificar Redis**
   - Confirmar que Redis esta corriendo para BullMQ
   - Verificar que las colas (aiResponse, scheduledMessages, bulk) esten activas

### Entregable
Documento de estado: que funciona, que no, que falta configurar.

---

## FASE 1 - Instalar plugins WooCommerce en tst.amunet.com.mx (Dia 1-2)

**Objetivo:** Los plugins myalice-crm-bridge y amunet-visitor-tracker funcionando en el sitio de pruebas.

### Plugin 1: myalice-crm-bridge

**Que hace:** Expone via REST API la configuracion de SalesKing (reglas de pricing por agente, descuentos maximos, jerarquia de equipos, permisos, reglas de comision).

**Pasos:**
1. Empaquetar el plugin como ZIP desde woocommercecurrentplugins/myalice-crm-bridge/
2. Subir a tst.amunet.com.mx -> WordPress Admin -> Plugins -> Aniadir nuevo -> Subir plugin
3. Activar el plugin
4. Verificar endpoints:
   - GET /wp-json/myalice-crm/v1/salesking-groups
   - GET /wp-json/myalice-crm/v1/salesking-settings
   - GET /wp-json/myalice-crm/v1/salesking-agent/{agent_id}
5. Autenticacion: usa WooCommerce API keys (Basic Auth con consumer_key/consumer_secret)

**Prerequisito:** SalesKing debe estar instalado y configurado en tst.amunet.com.mx con al menos un agente de prueba.

### Plugin 2: amunet-visitor-tracker

**Que hace:** Trackea navegacion del visitante en el sitio WC (paginas visitadas, productos vistos, UTMs), intercepta clicks de WhatsApp para enriquecer el mensaje con contexto de productos.

**Pasos:**
1. Empaquetar como ZIP desde woocommercecurrentplugins/amunet-visitor-tracker/
2. Subir e instalar en tst.amunet.com.mx
3. Activar el plugin (crea tabla wp_amunet_visitors automaticamente)
4. Verificar:
   - El script tracker.js se carga en el frontend del sitio
   - Navegar el sitio y verificar que se guardan visitas en wp_amunet_visitors
   - GET /wp-json/amunet-tracker/v1/visitor/{phone} retorna datos
5. NOTA DE SEGURIDAD: Los endpoints son publicos (sin auth). Para produccion, considerar agregar una API key.

### Entregable
Ambos plugins activos en tst.amunet.com.mx, endpoints verificados.

---

## FASE 2 - Inbox + Panel del cliente (Dias 2-5) PRIORIDAD

**Objetivo:** El agente abre una conversacion y ve en el lado derecho: info del cliente, compras pasadas, sugerencias de respuesta, y herramientas de venta.

### 2.1 Verificar/configurar conexion WooCommerce

**En Settings del CRM:**
- Ir a Settings -> WooCommerce
- Configurar: URL de tst.amunet.com.mx, WC API Key, WC API Secret
- Verificar que el CRM pueda leer productos y ordenes de WC

**En el backend:**
- Verificar que GET /api/conversations/:id/customer retorne:
  - Identidades del cliente (WhatsApp, FB, IG, WC)
  - Historial de compras desde WooCommerce
  - Total gastado
  - Datos de envio
  - Atribucion de campania
  - Insights de IA

### 2.2 Verificar/completar el panel derecho del Inbox

El codigo ya incluye estos componentes, verificar que funcionen:

- **CustomerPanel** - Perfil unificado, identidades, ordenes, historial
- **AIWriterPanel** - Sugerencias de respuesta basadas en KB y contexto
- **CatalogPanel** - Seleccion rapida de productos del catalogo WC
- **QuickRepliesPanel** - Respuestas rapidas precargadas
- **ScheduleMessageModal** - Programar mensajes futuros
- **EventModal** - Crear eventos (llamadas, seguimientos, demos)

### 2.3 Verificar envio real de mensajes

El punto mas critico: confirmar que cuando el agente envia un mensaje desde el Inbox, este llega al cliente por el canal correcto (WhatsApp, FB, IG).

- Revisar message-sender.ts para verificar las llamadas a APIs de Meta/WhatsApp
- Configurar tokens de Meta en Settings -> Canales
- Probar envio de mensaje de prueba por WhatsApp

### 2.4 Verificar datos de SalesKing en panel del agente

- El CRM debe mostrar al agente sus reglas de pricing, descuentos permitidos, y comisiones
- Verificar que el endpoint del plugin myalice-crm-bridge responda y el CRM lo consuma
- Mostrar en el panel: maximo descuento permitido, comisiones acumuladas

### Entregable
Un agente puede abrir una conversacion, ver toda la info del cliente, y enviar mensajes que lleguen al cliente real.

---

## FASE 3 - Knowledge Base (Dias 3-5)

**Objetivo:** El bot y los agentes tienen acceso a informacion completa de productos para responder preguntas tecnicas.

### 3.1 Sincronizar archivos de Knowledge Base

Los archivos ya existen en el repositorio:
- amunet_knowledge_base_medicalv3.md - 60+ productos medicos, 2,727 lineas
- amunet_knowledge_base_labs.md - 38 productos de laboratorio, 1,346 lineas

**Pasos:**
1. Usar POST /api/knowledge/sync-md para cargar cada archivo al CRM
2. Verificar que se generen embeddings (pgvector) para busqueda semantica
3. Validar con busquedas de prueba:
   - "prueba rapida de troponina" -> debe encontrar Cardiac Combo
   - "prueba de embarazo en sangre" -> debe encontrar hCG
   - "antidoping en saliva" -> debe encontrar Drug Screening

### 3.2 Sincronizar catalogo WooCommerce

- Usar POST /api/bot/knowledge/sync-wc para importar productos de WC al knowledge base
- Esto agrega precios actualizados, disponibilidad, y URLs de compra

### 3.3 Verificar busqueda semantica

- Probar GET /api/bot/knowledge?q=texto con varias consultas
- Verificar que el threshold de confianza (0.82) funcione correctamente
- Ajustar si es necesario

### Entregable
558+ entries en knowledge_base con embeddings, busqueda semantica funcional.

---

## FASE 4 - Bot + Respuestas automaticas (Dias 5-7)

**Objetivo:** El bot responde preguntas frecuentes, da info de envios/rastreo, y escala a humano cuando no sabe.

### 4.1 Configurar flujos del bot

**Triggers a configurar:**
- first_message - Bienvenida cuando un cliente nuevo escribe
- campaign - Respuesta automatica cuando llega de una campania especifica
- after_hours - Mensaje fuera de horario con promesa de respuesta
- keyword - Respuestas a palabras clave comunes (precio, envio, rastreo, etc.)

### 4.2 Configurar respuestas de envio/rastreo

El bot debe poder:
1. Recibir pregunta sobre estado de envio
2. Buscar el pedido del cliente en WooCommerce (por telefono/email)
3. Consultar numero de guia (campo de tracking numbers plugin en WC)
4. Responder con: estado del pedido, paqueteria, numero de rastreo

Verificar: Que la integracion WC incluya datos de tracking del plugin de Tracking Numbers.

### 4.3 Configurar escalacion

**En Settings -> Escalacion:**
- Baja confianza del bot (<0.82) -> escalar a humano
- Cliente pide hablar con humano -> escalar inmediato
- Preguntas de envio complejas -> escalar
- Deteccion de frustracion -> escalar
- Maximo N mensajes de bot antes de escalar

### 4.4 Configurar aprendizaje automatico

Cuando un agente resuelve una conversacion:
1. El sistema extrae el par pregunta/respuesta
2. Genera embedding
3. Lo inserta en knowledge_base
4. Futuras preguntas similares -> el bot responde solo

Verificar: Que learnFromConversation() funcione al cambiar status a "resolved".

### Entregable
Bot respondiendo preguntas frecuentes, dando info de envios, y escalando correctamente.

---

## FASE 5 - Crear pedidos desde el CRM (Dias 6-8)

**Objetivo:** El agente puede hacer un pedido para el cliente sin salir de la ventana del CRM, y el pedido se refleja en WooCommerce con SalesKing.

### 5.1 Verificar generacion de cart-link

El endpoint POST /api/conversations/:id/cart-link ya existe y:
- Crea una orden pendiente en WooCommerce
- Adjunta metadata de SalesKing (placed_by_agent, comisiones)
- Adjunta metadata de atribucion (campaign, conversation)
- Genera URL de pago personalizada
- Guarda la orden localmente

**Verificar:**
1. Seleccionar productos desde CatalogPanel
2. Aplicar descuento (respetando limites de SalesKing)
3. Generar el cart-link
4. Verificar que la orden aparezca en WooCommerce con los campos correctos:
   - salesking_order_placed_by
   - salesking_order_placed_type: placed_by_agent
   - _myalice_conversation_id
   - _myalice_campaign_id
5. Verificar que el link de pago llegue al cliente por WhatsApp

### 5.2 Crear/vincular cliente en WooCommerce

- Si el cliente no existe en WC, el CRM debe crearlo con los datos de la conversacion
- Si ya existe, vincular via external_identities (provider: woocommerce)
- Guardar datos de envio del cliente para futuros pedidos

### 5.3 Verificar flujo de comisiones

1. Agente hace pedido -> orden en WC con metadata de SalesKing
2. SalesKing calcula comision basada en reglas
3. CRM muestra comision al agente en su dashboard
4. Verificar con myalice-crm-bridge que las reglas del agente se lean correctamente

### Entregable
Agente crea pedido -> llega a WC con SalesKing -> cliente recibe link de pago -> comision calculada.

---

## FASE 6 - Atribucion de campanias (Dias 7-9)

**Objetivo:** Saber de que campania/red social viene cada cliente y conectar con la venta.

### 6.1 Configurar sincronizacion de campanias

**En Settings -> Canales:**
1. Configurar Meta Access Token con permisos de ads
2. El CRM sincroniza campanias de Facebook/Instagram automaticamente
3. Verificar que aparezcan en la pagina de Campaigns

### 6.2 Configurar amunet-visitor-tracker

Con el plugin ya instalado en tst.amunet.com.mx:
1. Verificar que capture UTMs de las landing pages
2. Verificar que enriquezca los mensajes de WhatsApp con productos visitados
3. Configurar el CRM para consultar /wp-json/amunet-tracker/v1/visitor/{phone} y mostrar en el panel del cliente

### 6.3 Verificar flujo completo de atribucion

Paso 1: Cliente hace click en anuncio de Facebook -> llega a tst.amunet.com.mx con UTMs
Paso 2: amunet-visitor-tracker captura: utm_source, utm_medium, utm_campaign, productos vistos
Paso 3: Cliente hace click en WhatsApp -> mensaje enriquecido con productos
Paso 4: CRM recibe mensaje -> identifica campania -> crea atribucion
Paso 5: Agente atiende -> hace pedido -> orden en WC con metadata de campania
Paso 6: Dashboard muestra: esta venta vino de campania X, ROAS = Y

### 6.4 Verificar ROAS y analytics

- GET /api/attributions/summary debe mostrar ROAS por campania
- Dashboard de Campaigns muestra metricas de conversion
- Supervisores pueden ver que campanias generan mas ventas

### Entregable
Flujo completo de atribucion funcionando: click en anuncio -> conversacion -> venta -> ROAS.

---

## FASE 7 - Pruebas end-to-end y paso a produccion (Dias 9-12)

### 7.1 Pruebas en tst.amunet.com.mx

**Escenario 1: Cliente nuevo por WhatsApp**
1. Enviar mensaje al numero de WhatsApp de prueba
2. Bot responde con bienvenida
3. Cliente pregunta por un producto -> bot responde con info del KB
4. Cliente pide hablar con humano -> escalacion
5. Agente ve la conversacion con panel del cliente completo
6. Agente hace pedido -> orden en WC -> link de pago al cliente

**Escenario 2: Cliente recurrente**
1. Cliente que ya compro antes escribe
2. Panel muestra: compras anteriores, total gastado, productos sugeridos
3. Bot sugiere recompra o cross-sell basado en historial
4. Agente completa la venta

**Escenario 3: Campania -> Venta**
1. Crear campania de prueba en Facebook
2. Click -> landing page con UTMs -> WhatsApp
3. CRM identifica la campania
4. Venta se completa con atribucion correcta

**Escenario 4: Informacion de envio**
1. Cliente pregunta por su pedido
2. Bot/agente consulta WC -> encuentra orden con tracking number
3. Responde con paqueteria y numero de rastreo

### 7.2 Checklist antes de produccion

- [ ] Todos los escenarios de prueba pasan
- [ ] Variables de entorno configuradas en Coolify para produccion
- [ ] Plugins instalados en sitio de produccion (amunet.com.mx)
- [ ] Knowledge base cargada y embeddings generados
- [ ] Meta tokens de produccion configurados
- [ ] WooCommerce keys de produccion configuradas
- [ ] SSL/HTTPS verificado en todos los endpoints
- [ ] Webhooks de WhatsApp apuntando al CRM de produccion
- [ ] Redis y PostgreSQL con backups configurados
- [ ] Monitoreo de logs activo en Coolify

### 7.3 Deploy a produccion

1. Push al repo de GitHub (branch main)
2. En Coolify: trigger manual deploy (auto-deploy esta roto, ver CLAUDE.md para fix)
3. Verificar que ambos servicios arranquen: crm-api-server y crm-web
4. Correr migraciones automaticas (se ejecutan al iniciar)
5. Verificar health check: api-crm.botonmedico.com/api/health
6. Verificar frontend: crm.botonmedico.com

---

## Resumen de timeline

| Fase | Dias | Descripcion |
|------|------|-------------|
| 0 | 1 | Diagnostico de produccion |
| 1 | 1-2 | Instalar plugins WC en tst.amunet.com.mx |
| 2 | 2-5 | Inbox + Panel del cliente (PRIORIDAD) |
| 3 | 3-5 | Knowledge Base cargada y funcional |
| 4 | 5-7 | Bot con respuestas automaticas y escalacion |
| 5 | 6-8 | Crear pedidos desde CRM a WooCommerce |
| 6 | 7-9 | Atribucion de campanias |
| 7 | 9-12 | Pruebas E2E y deploy a produccion |

**Estimacion total: 10-12 dias de trabajo**

Las fases 2-6 se solapan porque mucho ya esta codificado. El trabajo principal es: verificar que funcione, configurar las conexiones, y completar lo que este incompleto.

---

## Riesgos identificados

1. **Estado desconocido de produccion** - Si esta caido, la Fase 0 puede extenderse
2. **Auto-deploy roto en Coolify** - Deploys manuales hasta arreglar GitHub App keys
3. **Null bytes al editar desde VM** - Mitigado con pre-commit hook (.githooks/pre-commit)
4. **Endpoints publicos del visitor-tracker** - Riesgo de seguridad menor, agregar API key
5. **SalesKing en ambiente de pruebas** - Debe estar configurado con agentes y reglas de ejemplo
6. **Tokens de Meta** - Pueden expirar; configurar refresh automatico

---

## Dependencias externas

- Acceso admin a tst.amunet.com.mx (WordPress)
- Acceso a Coolify (cool.botonmedico.com)
- Meta Business Account con tokens validos
- Numero de WhatsApp de prueba configurado con Meta Cloud API
- SalesKing configurado en tst.amunet.com.mx con al menos 1 agente y reglas
- Plugin de Tracking Numbers instalado en WooCommerce
