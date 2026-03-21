# CLAUDE.md — Onboarding Rápido para Agentes AI

> **Proyecto:** CRM Botón Médico
> **Qué hace:** CRM omnicanal con IA para venta de pruebas de diagnóstico rápido
> **Stack:** Node.js/Express + Next.js 14 + PostgreSQL/pgvector + WooCommerce

## Primer paso: Lee WORKPLAN.md

El archivo `WORKPLAN.md` en esta misma carpeta contiene:
- Contexto completo del proyecto
- Todas las URLs, rutas, y accesos
- Plan de trabajo con 5 fases y checkboxes de progreso
- Pruebas de validación para cada módulo
- Log de cambios

**Busca el primer `[ ]` en WORKPLAN.md** — ahí es donde debes continuar trabajando.

## Archivos clave a revisar

```
# Schema de la base de datos (lee PRIMERO)
/mnt/myalice/.claude/worktrees/amazing-lederberg/packages/db/schema.sql

# Rutas del API
/mnt/myalice/.claude/worktrees/amazing-lederberg/apps/server/src/routes/

# Servicio de IA (RAG + multi-provider)
/mnt/myalice/.claude/worktrees/amazing-lederberg/apps/server/src/ai.service.ts

# Plugins WooCommerce (referencia)
/mnt/myalice/.claude/worktrees/amazing-lederberg/woocommercecurrentplugins/

# WP staging (plugins activos)
/mnt/wp-content/plugins/
/mnt/wp-content/themes/jupiterx-child/
```

## Comandos útiles

```bash
# Ver estado del repo
cd /mnt/myalice/.claude/worktrees/amazing-lederberg && git status

# Instalar dependencias del server
cd apps/server && npm install

# Instalar dependencias del web
cd apps/web && npm install

# Correr server en dev
cd apps/server && npm run dev

# Correr web en dev
cd apps/web && npm run dev
```

## Convenciones del proyecto

- **TypeScript** estricto en server y web
- **Rutas API** en `apps/server/src/routes/` — cada archivo exporta un router Express
- **Migraciones SQL** numeradas: `packages/db/migrations/001_nombre.sql`
- **Workers async** en `workers/` — procesan tareas pesadas via BullMQ
- **AI providers:** DeepSeek, Claude, Gemini, Z.ai — configurables por tenant

## Reglas al codear

1. **Siempre lee el schema.sql actual** antes de crear tablas nuevas
2. **Siempre lee la ruta existente** antes de extenderla
3. **Marca `[x]` en WORKPLAN.md** cada tarea que completes
4. **Ejecuta las pruebas del checkpoint** al terminar cada fase
5. **Documenta errores** en WORKPLAN.md si algo falla
6. **Actualiza el LOG DE CAMBIOS** al final de WORKPLAN.md
