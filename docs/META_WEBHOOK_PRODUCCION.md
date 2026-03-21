# Guía: Configurar Webhook de WhatsApp en Meta para Producción

## Contexto
El CRM ya tiene el código para recibir webhooks de WhatsApp en:
```
GET  /api/webhooks/whatsapp  → Verificación
POST /api/webhooks/whatsapp  → Mensajes entrantes
```

## Pre-requisitos
- `api-crm.botonmedico.com` (o `api.amunet.com.mx`) apuntando al servidor del CRM
- El servidor Node.js corriendo y aceptando requests
- Un **System User Token** permanente (ver sección abajo)
- El número de teléfono de producción registrado en la WABA

---

## Paso 1: Crear System User Token (permanente)

1. Ir a [Meta Business Manager](https://business.facebook.com/settings/system-users)
2. Configuración del negocio → Usuarios → Usuarios del sistema
3. Crear un System User (o usar uno existente) con rol **Admin**
4. Click en "Generar token" para la app **Amunet CRM** (ID: 1452652589836082)
5. Seleccionar permisos:
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
6. Copiar el token generado — **este no expira**
7. Asignar el WABA (1521810052698130) al System User:
   - Usuarios del sistema → [tu system user] → Agregar activos → WhatsApp Accounts

---

## Paso 2: Registrar el nuevo número de teléfono

1. Ir al [WhatsApp Manager](https://business.facebook.com/wa/manage/phone-numbers/)
2. Click "Agregar número de teléfono"
3. Seguir el flujo de verificación por SMS/llamada
4. Anotar el **Phone Number ID** nuevo (será diferente al de pruebas: 956844914189695)

---

## Paso 3: Cambiar el Webhook URL en Meta

### Opción A: Via Graph API (recomendado)
```bash
curl -X POST "https://graph.facebook.com/v22.0/1452652589836082/subscriptions" \
  -d "object=whatsapp_business_account" \
  -d "callback_url=https://api-crm.botonmedico.com/api/webhooks/whatsapp" \
  -d "verify_token=amunet_crm_webhook_verify_2026" \
  -d "fields=messages" \
  -d "access_token=1452652589836082|f4e61d3b5283430322ed01ffa2828f5e"
```
Respuesta esperada: `{"success":true}`

### Opción B: Via Meta Developer Console
1. Ir a https://developers.facebook.com/apps/1452652589836082/
2. Casos de uso → WhatsApp Business Messaging → Configurar
3. Webhooks → Editar
4. URL: `https://api-crm.botonmedico.com/api/webhooks/whatsapp`
5. Token: `amunet_crm_webhook_verify_2026`
6. Click "Verificar y guardar"
7. Suscribir campo `messages`

---

## Paso 4: Suscribir el WABA al App

```bash
curl -X POST "https://graph.facebook.com/v22.0/1521810052698130/subscribed_apps" \
  -d "access_token=TU_SYSTEM_USER_TOKEN_AQUI"
```
Respuesta esperada: `{"success":true}`

---

## Paso 5: Actualizar credenciales en el CRM

### En la base de datos (tabla `channels`):
```sql
UPDATE channels
SET provider_config = jsonb_set(
    provider_config,
    '{access_token}',
    '"TU_NUEVO_TOKEN"'
)
WHERE provider = 'whatsapp' AND is_active = TRUE;
```

### En el archivo `.env` del servidor:
```
META_VERIFY_TOKEN=amunet_crm_webhook_verify_2026
META_APP_SECRET=f4e61d3b5283430322ed01ffa2828f5e
```

### Si cambias el número de teléfono, también actualizar:
```sql
UPDATE channels
SET provider_config = jsonb_set(
    provider_config,
    '{phone_number_id}',
    '"TU_NUEVO_PHONE_NUMBER_ID"'
)
WHERE provider = 'whatsapp' AND is_active = TRUE;
```

---

## Paso 6: Verificar que funciona

1. Enviar un mensaje de WhatsApp al nuevo número
2. Revisar logs del servidor: `docker logs crm-server` o `pm2 logs`
3. Verificar en el CRM (crm.botonmedico.com) que la conversación aparece
4. Verificar que el bot responde

---

## Nota sobre Cloudflare
Si el dominio está detrás de Cloudflare (modo Proxied), agregar regla WAF:
- **Expresión:** `(http.request.uri.path contains "/api/webhooks/whatsapp" and http.user_agent contains "facebookexternalua")`
- **Acción:** Skip → All managed rules, Bot Fight Mode

---

## Credenciales actuales (pruebas)
| Campo | Valor |
|-------|-------|
| App ID | 1452652589836082 |
| App Secret | f4e61d3b5283430322ed01ffa2828f5e |
| WABA ID | 1521810052698130 |
| Phone Number ID (pruebas) | 956844914189695 |
| Teléfono (pruebas) | +1 346-861-1165 |
| Verify Token | amunet_crm_webhook_verify_2026 |
| Webhook actual (pruebas) | tst.amunet.com.mx/wp-json/amunet/v1/whatsapp-webhook |
| Webhook producción | api-crm.botonmedico.com/api/webhooks/whatsapp |
