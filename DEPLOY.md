# Guia de Deploy — CRM Boton Medico

## Pre-requisitos

- Node.js 18+ en el servidor
- PostgreSQL 15+ con extension pgvector
- Redis (para BullMQ workers, opcional en primera fase)
- Dominio configurado: `crm.botonmedico.com` (frontend) + `api-crm.botonmedico.com` (backend)

---

## Paso 1: Commit y Push

Desde tu maquina Windows, en el worktree:

```bash
cd C:\Users\admin\ai\myalice\.claude\worktrees\amazing-lederberg
git add -A
git commit -m "CRM Boton Medico: Fases 1-6 + Smart Bot + WhatsApp + fixes audit"
git push origin main
```

---

## Paso 2: Instalar dependencias

En el servidor de produccion:

```bash
cd apps/server && npm install
cd ../web && npm install
```

---

## Paso 3: Variables de entorno

Copiar y configurar:

```bash
cp apps/server/.env.example apps/server/.env
# Editar .env con valores reales de produccion
```

Variables criticas que DEBES configurar:

| Variable | Donde obtenerla |
|----------|----------------|
| `DATABASE_URL` | Tu PostgreSQL de produccion |
| `JWT_SECRET` | Generar con: `openssl rand -hex 32` |
| `WC_STORE_URL` | URL de tu WooCommerce (ej: `https://tst.amunet.com.mx`) |
| `WC_CONSUMER_KEY` | WooCommerce > Settings > REST API |
| `WC_CONSUMER_SECRET` | WooCommerce > Settings > REST API |
| `WHATSAPP_ACCESS_TOKEN` | Meta Business Manager > System User Token permanente |

---

## Paso 4: Correr migraciones SQL

```bash
# Opcion A: Script automatico
cd packages/db
chmod +x migrate.sh
DATABASE_URL=postgres://user:pass@host:5432/crm ./migrate.sh

# Opcion B: Manual
psql $DATABASE_URL -f packages/db/schema.sql
psql $DATABASE_URL -f packages/db/migrations/001_phase1_foundations.sql
psql $DATABASE_URL -f packages/db/migrations/002_phase2_medical_bot.sql
psql $DATABASE_URL -f packages/db/migrations/003_phase3_handoff_history.sql
psql $DATABASE_URL -f packages/db/migrations/004_phase4_attribution_advanced.sql
psql $DATABASE_URL -f packages/db/migrations/005_smart_bot.sql
psql $DATABASE_URL -f packages/db/migrations/006_wc_integration.sql
psql $DATABASE_URL -f packages/db/migrations/007_whatsapp_channel.sql
```

---

## Paso 5: Build y arranque

```bash
# Backend
cd apps/server
npm run build         # Compila TypeScript a dist/
npm run start         # Arranca en puerto 3001

# Frontend
cd apps/web
npm run build         # Build de Next.js
npm run start         # Arranca en puerto 3000
```

Para desarrollo local:
```bash
cd apps/server && npm run dev   # Hot-reload en :3001
cd apps/web && npm run dev      # Hot-reload en :3000
```

---

## Paso 6: Webhook de WhatsApp

Sigue la guia completa en `docs/META_WEBHOOK_PRODUCCION.md`. Resumen rapido:

1. Genera System User Token permanente en Meta Business Manager
2. Pon el token en `apps/server/.env.whatsapp`
3. Configura webhook URL en Meta: `https://api-crm.botonmedico.com/api/webhooks/whatsapp`
4. Verify token: `amunet_crm_webhook_verify_2026`
5. Suscribir a: `messages`

---

## Paso 7: Webhook de WooCommerce

En WP Admin > WooCommerce > Settings > Advanced > Webhooks:

1. Crear webhook: `Order Updated`
   - URL: `https://api-crm.botonmedico.com/api/webhooks/woocommerce-status`
   - Status: Active
   - API Version: v3

---

## Paso 8: Verificacion

```bash
# Health check
curl https://api-crm.botonmedico.com/health

# Registrar primer usuario (auto-director)
curl -X POST https://api-crm.botonmedico.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@botonmedico.com","password":"tu-password-seguro"}'

# Login
curl -X POST https://api-crm.botonmedico.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@botonmedico.com","password":"tu-password-seguro"}'
```

El primer usuario registrado automaticamente recibe rol `director`.

---

## Arquitectura de produccion recomendada

```
Cloudflare (DNS + SSL + WAF)
    |
    +-- crm.botonmedico.com -----> Next.js :3000 (PM2 o Docker)
    |
    +-- api-crm.botonmedico.com -> Express :3001 (PM2 o Docker)
    |
    +-- PostgreSQL :5432 (con pgvector)
    |
    +-- Redis :6379 (para BullMQ, opcional)
```

Recomendado: usar PM2 para mantener los procesos vivos:

```bash
npm install -g pm2
cd apps/server && pm2 start dist/index.js --name crm-api
cd apps/web && pm2 start npm --name crm-web -- start
pm2 save
pm2 startup
```

---

## Bugs corregidos en esta sesion

| Bug | Archivo | Fix |
|-----|---------|-----|
| Ruta `/bulk` inalcanzable | routes/inventory.ts | Reordenado: /bulk antes de /:productId |
| JOIN incorrecto en query | services/meta-capi.ts | `a.order_id = o.id AND a.id = $1` |
| JOIN incorrecto en query | services/google-ads-conversion.ts | `a.order_id = o.id AND a.id = $1` |
| Columna incorrecta | services/wc-integration-engine.ts | `customer_id` en vez de `order_id` |
| Columna faltante en migracion | migrations/006_wc_integration.sql | Agregado `customer_id` a discount_requests |
| Sin autenticacion en rutas | index.ts | `requireAuth` + `requireRole` en todas las rutas |
| Sin dependencies en frontend | apps/web/package.json | Agregado next, react, react-dom, lucide-react |
| Sin tsconfig en frontend | apps/web/tsconfig.json | Creado con config Next.js estandar |
| Sin scripts npm | apps/server/package.json | Agregado dev, build, start, simulate, typecheck |
