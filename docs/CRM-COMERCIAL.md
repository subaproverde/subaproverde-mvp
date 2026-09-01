# CRM comercial da Suba Pro Verde

## Objetivo

O CRM administrativo em `/admin/crm` é a fonte operacional para a jornada do contato, do primeiro atendimento à venda, execução e recebimento. A inteligência artificial é um observador auxiliar e não a interface principal do produto.

## Áreas canônicas

- `/admin/crm`: visão geral comercial, prioridades, agenda resumida e funil.
- `/admin/crm/clientes`: cartões de clientes e leads, qualificação, valor potencial e próxima ação.
- `/admin/crm/funil`: quadro de oportunidades com movimentação entre etapas.
- `/admin/crm/agenda`: compromissos, atendimentos e follow-ups vinculados ao contato.
- `/admin/crm/conversas`: conversas integradas do WhatsApp.
- `/admin/crm/inteligencia`: memórias, evidências e sugestões da IA para revisão.

## Fonte dos dados

- Contatos: `crm_contacts`.
- Oportunidades e qualificação: `crm_leads`.
- Agenda e follow-ups: `crm_tasks`.
- Conversas: `crm_conversations` e `crm_messages`.
- Pedidos e financeiro: tabelas `crm_orders`, `crm_receivables`, `crm_payment_receipts` e relacionadas.
- Auditoria da IA: `crm_ai_runs` e `crm_ai_suggestions`.

## Regras preservadas

- Mudança de etapa registra uma atividade de auditoria.
- Comprovante não confirma pagamento sem conciliação.
- O CRM não assume o envio do WhatsApp; o bridge continua dono do canal.
- Sugestões da IA não substituem os registros oficiais sem o fluxo de revisão definido.

## Próxima revisão obrigatória

Depois de validar o núcleo comercial em produção, retomar a otimização de custo e roteamento das inteligências: filtros determinísticos, Sonnet como padrão, Opus para casos complexos, cache de uma hora e processamento em lote para análises sem urgência.
