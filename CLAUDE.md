# Amunet CRM - Contexto del Proyecto

## Qué es
CRM multicanal para venta de productos médicos (pruebas rápidas de diagnóstico). Usa RAG + LLM (DeepSeek) para atender clientes por WhatsApp, Facebook e Instagram. El bot vende, califica leads, y escala a agentes humanos cuando es necesario.

## Stack
- **Backend:** Node.js/Express (apps/server/)
- **Frontend:** Next.js (apps/web/)
- **DB:** PostgreSQL con pgvector
- **Colas:** Redis + BullMQ
- **Real-time:** Socket.IO
- **LLM:** DeepSeek (deepseek-chat) via OpenAI-compatible API
- **E-commerce:** WooCommerce (tst.amunet.com.mx)
- **Deploy:** Coolify en 217.76.52.85, dominios: crm.botonmedico.com (frontend), api-crm.botonmedico.com (backend)

## Regla de Oro
**TODA configuración debe ser posible desde la UI de Settings.** Nunca insertar keys, secrets ni config directamente en la base de datos. Si no existe la sección en Settings, hay que crearla.

## Método de Trabajo
1. Comparar siempre lo que está vs lo que se va a cambiar
2. Ir menú por menú
3. Cambios en un área pueden requerir cambios en áreas relacionadas

## Git (IMPORTANTE)
Los comandos git normales se CUELGAN por acumulación de worktrees. Siempre usar:
```powershell
Remove-Item -Recurse -Force "C:\Users\admin\ai\myalice\.claude\worktrees" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "C:\Users\admin\ai\myalice\.git\worktrees" -ErrorAction SilentlyContinue
Start-Process -FilePath "C:\Program Files\Git\bin\git.exe" -ArgumentList "-C C:\Users\admin\ai\myalice add -A" -NoNewWindow -Wait
Start-Process -FilePath "C:\Program Files\Git\bin\git.exe" -ArgumentList "-C C:\Users\admin\ai\myalice commit -m mensaje-sin-espacios" -NoNewWindow -Wait
Start-Process -FilePath "C:\Program Files\Git\bin\git.exe" -ArgumentList "-C C:\Users\admin\ai\myalice push origin main" -NoNewWindow -Wait
```

## Archivos que se corrompen
Al editar archivos desde la VM de Cowork, se insertan null bytes (\x00). Después de cada edición, limpiar:
```python
python3 -c "
with open('ARCHIVO', 'rb') as f: data = f.read()
if b'\x00' in data:
    with open('ARCHIVO', 'wb') as f: f.write(data.replace(b'\x00', b'').rstrip() + b'\n')
"
```

## Deploy
- Coolify dashboard: https://cool.botonmedico.com/
- Auto-deploy ROTO — requiere deploy manual via botón "Redeploy" en Coolify
- Proyecto: "CRM Boton Medico" → production → crm-api-server + crm-web
- DNS Docker fijado a 8.8.8.8 y 8.8.4.4 (Custom Docker Options)

## Archivos Clave
| Archivo | Descripción |
|---------|-------------|
| apps/server/src/index.ts | Entry point, rutas, auto-migrations |
| apps/server/src/routes/webhooks.ts | Webhook WhatsApp/Meta, handleBotResponse, sendOutboundReply |
| apps/server/src/ai.service.ts | getAIResponse, getCatalogForAI, system prompt, historial |
| apps/server/src/services/message-sender.ts | Envío WhatsApp/FB/IG, extractButtons, shortenTitle |
| apps/server/src/services/escalation-engine.ts | Reglas de escalación, handoff atómico |
| apps/server/src/services/campaign-responder.ts | Atribución de campañas, detección plataforma |
| apps/server/src/socket.ts | Socket.IO con auth JWT |
| apps/server/src/routes/conversations.ts | Inbox API con LATERAL joins |
| apps/web/app/settings/page.tsx | Settings UI (~3300 líneas, 12 tabs) |
| apps/web/app/inbox/page.tsx | Inbox con chat, catálogo, herramientas |
| apps/web/app/medical-products/page.tsx | Dashboard productos médicos |
| apps/web/app/simulator/page.tsx | Simulador de cliente |

## Settings UI (12 tabs)
Mi Perfil, Usuarios, Equipos, Canales & Webhooks, Horarios, Configuración IA, Reglas de Asignación, Respuestas Rápidas, Integraciones, Base de Conocimiento, WhatsApp Llamadas, Escalación

## Knowledge Base
- 50 productos médicos en amunet_knowledge_base_medicalv3.md
- 40 productos laboratorio en amunet_knowledge_base_labs.md
- Cada producto tiene: Cross-sells y Up-sells documentados con argumentos clínicos
- 558 entries en tabla knowledge_base (synced via POST /api/knowledge/sync-md)

## WhatsApp
- Número: +1 (346) 861-1165
- Meta Cloud API, webhook en /api/webhooks/whatsapp
- Botones interactivos: extractButtons() detecta opciones numeradas y envía como interactive buttons
- Smart titles: shortenTitle() quita prefijos como "Prueba rápida de" para caber en 20 chars

## Bot Behavior
- Historial de conversación inyectado en system prompt (últimos 10 mensajes)
- Catálogo WC con cache de 30 min y fallback a cache viejo si DNS falla
- Retry automático en errores de red (3 intentos)
- Cross-sell basado en productos del catálogo real (no inventado)
- Reglas: máximo 2 líneas por mensaje, formato numerado, sin negritas

## Usuarios del Sistema
- feruap (Superadmin, email: feruap@gmail.com)
- Admin
- Equipos: médicos, lab humano, lab alimentos, soporte

## Bugs Conocidos
- Auto-deploy Coolify roto (GitHub App keys dummy)
- Embeddings no funcionan (vectores en cero, text fallback)
- Null bytes al editar desde VM
- Scheduled messages worker creado pero imports deshabilitados
