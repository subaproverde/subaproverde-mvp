# WhatsApp real - Suba Pro Verde

Esta implementação usa a Meta WhatsApp Cloud API.

## Variáveis de ambiente

Adicione no ambiente de produção:

```env
ADMIN_WHATSAPP_TO=554388231544
WHATSAPP_ACCESS_TOKEN=token_da_meta
WHATSAPP_PHONE_NUMBER_ID=id_do_numero_remetente
WHATSAPP_GRAPH_VERSION=v23.0
WHATSAPP_TEMPLATE_NAME=spv_alerta_operacional
WHATSAPP_TEMPLATE_LANGUAGE=pt_BR
ADMIN_NOTIFICATIONS_CRON_SECRET=um_segredo_para_o_cron
WHATSAPP_WEBHOOK_VERIFY_TOKEN=um_token_para_validar_webhook
```

Sem `WHATSAPP_ACCESS_TOKEN` e `WHATSAPP_PHONE_NUMBER_ID`, o endpoint fica em modo mock.

## Template recomendado

Crie e aprove no WhatsApp Manager um template de utilidade:

Nome:

```text
spv_alerta_operacional
```

Idioma:

```text
pt_BR
```

Corpo sugerido:

```text
Alerta Suba Pro Verde:

{{1}}
```

O endpoint envia a mensagem completa como o parâmetro `{{1}}`.

## Endpoints

Checar configuração sem expor segredos:

```http
GET /api/admin/notifications/whatsapp
```

Enviar WhatsApp:

```http
POST /api/admin/notifications/whatsapp
Content-Type: application/json

{
  "phone": "554388231544",
  "message": "Mensagem de teste"
}
```

Enviar resumo diário:

```http
GET /api/admin/notifications/cron/daily-summary?secret=ADMIN_NOTIFICATIONS_CRON_SECRET
```

Webhook de diagnóstico para status de entrega:

```http
GET /api/admin/notifications/whatsapp/webhook
POST /api/admin/notifications/whatsapp/webhook
```

No painel da Meta, configure:

```text
Callback URL:
https://www.subaproverde.com/api/admin/notifications/whatsapp/webhook

Verify token:
o mesmo valor de WHATSAPP_WEBHOOK_VERIFY_TOKEN
```

Assine o campo:

```text
messages
```

Depois de enviar um teste, abra:

```text
https://www.subaproverde.com/api/admin/notifications/whatsapp/webhook
```

Se a Meta entregar eventos, você verá os últimos payloads, incluindo `sent`, `delivered`, `read` ou `failed`.

## Observação importante

Resumo diário e lembretes são mensagens iniciadas pelo sistema. Para envio confiável fora da janela de atendimento do WhatsApp, use template aprovado.
