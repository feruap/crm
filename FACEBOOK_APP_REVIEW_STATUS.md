# Facebook App Review - Estado y Próximos Pasos

## Fecha: 2026-04-04

## Resumen
Se está tramitando el App Review de **Amunet CRM** (App ID: 1452652589836082) para obtener Advanced Access en `pages_utility_messaging` y otros permisos.

## Estado Actual

### Completado
- Annual Data Use Checkup de Amunet Laboratorios (App 495034498372042) - ENVIADO
- App Review secciones completadas:
  - Verificación ✅
  - Configuración de apps ✅
  - Tratamiento de datos ✅
  - Instrucciones para revisores ✅
  - Uso permitido: pages_show_list, pages_manage_metadata, pages_messaging, business_management, pages_read_engagement ✅

### Pendiente
- **`pages_utility_messaging`** en la sección "Uso permitido" - BLOQUEADO por test call
  - La descripción, video, y confirmación ya están completados
  - Solo falta que Meta registre la llamada de prueba a la API (muestra "0 de 1")
  - Se hicieron múltiples POST exitosos a `/me/messages` via Graph API Explorer con token de Botón Médico (Page ID: 175621939146343)
  - Meta dice que puede tardar hasta 24 horas en registrar

## Tarea Programada
- Nombre: `check-fb-test-call`
- Ubicación: `C:\Users\admin\Documents\Claude\Scheduled\check-fb-test-call\SKILL.md`
- Frecuencia: Cada 2 horas
- Acción: Revisa si el test call se registró y envía el App Review automáticamente

## URLs Importantes
- Testing page: https://developers.facebook.com/apps/1452652589836082/test/?business_id=127569324913739
- App Review: https://developers.facebook.com/apps/1452652589836082/app-review/submissions/?submission_id=1478019937299347&business_id=127569324913739
- Graph API Explorer: https://developers.facebook.com/tools/explorer/1452652589836082/

## Qué hacer si la tarea programada no funcionó
1. Ir a la Testing page (URL arriba)
2. Expandir "Interactuar con los clientes en Messenger from Meta"
3. Si `pages_utility_messaging` muestra "Completado":
   - Ir al App Review (URL arriba)
   - Expandir "Uso permitido" → click "Ir a Uso permitido"
   - Verificar que todo esté verde
   - Click "Volver a la solicitud"
   - Click "Enviar para revisión"
4. Si sigue en "0 de 1":
   - Abrir Graph API Explorer → seleccionar Amunet CRM → Botón Médico como página
   - POST a `me/messages` con body: {"messaging_type":"RESPONSE","recipient":{"id":"26533789602976069"},"message":{"text":"Test utility message"}}
   - Esperar unas horas y revisar de nuevo

## Después de la Aprobación del App Review

Una vez que Meta apruebe el review (puede tardar días/semanas), hay que verificar que el CRM tenga acceso real:

### 1. Verificar permisos en el token
- Ir a https://developers.facebook.com/tools/debug/accesstoken/
- Pegar el token de acceso que usa el CRM (está en Settings > Canales & Webhooks del CRM)
- Confirmar que `pages_utility_messaging` aparece en la lista de permisos del token
- Si NO aparece: hay que regenerar el token de la página Botón Médico con el nuevo permiso incluido

### 2. Actualizar token en el CRM si es necesario
- Ir a https://crm.botonmedico.com/login → Settings → Canales & Webhooks
- Si se regeneró el token, actualizar el Page Access Token del canal de Facebook/Messenger
- El CRM usa este token en apps/server/src/routes/webhooks.ts y apps/server/src/services/message-sender.ts

### 3. Probar utility messaging desde el CRM
- Abrir el Inbox del CRM: https://crm.botonmedico.com/inbox
- Encontrar una conversación de Messenger que tenga más de 24 horas sin actividad
- Intentar enviar un mensaje desde el CRM a ese contacto
- Si el mensaje llega → utility messaging funciona correctamente
- Si da error "(#10) This message is sent outside of allowed window" → el token no tiene el permiso o no se actualizó

### 4. Probar con el bot
- Enviar un mensaje a la página Botón Médico desde Facebook Messenger
- Esperar la respuesta del bot (debería responder via el webhook en /api/webhooks/whatsapp)
- Verificar que el bot pueda enviar mensajes de seguimiento (confirmaciones, actualizaciones)

### 5. Verificar en el simulador
- Ir a https://crm.botonmedico.com/simulator
- Simular una conversación de Messenger
- Confirmar que el flujo completo funciona

## Datos de Referencia
- Business ID: 127569324913739 (Fernando Ruiz's Business)
- Page: Botón Médico (ID: 175621939146343)
- PSID de Fernando Ruiz para tests: 26533789602976069
- App: Amunet CRM (ID: 1452652589836082)
