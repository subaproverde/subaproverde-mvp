# Radar SPV para iPhone

Aplicativo complementar ao CRM com widget iOS em tamanhos pequeno, médio, grande e tela bloqueada. Não altera a Bia nem chama modelos de IA.

## Comportamento

- Login com a conta do CRM; API permite apenas administradores.
- Compromissos de hoje, atrasados, leads ativos e conversas que precisam de atenção. Contagens são exatas no banco, não limitadas pelo número de cartões exibidos.
- Lista até quatro próximos compromissos e quatro atrasados. Tocar no cartão abre o compromisso na agenda web, inclusive depois do login.
- Widget abre o aplicativo; dados carregados ao abrir, ao puxar para atualizar e a cada minuto enquanto a tela está ativa.
- Atualização em segundo plano solicitada com intervalo mínimo de 30 minutos. iOS controla a execução; não é uma garantia de atualização a cada 30 minutos.
- Após uma hora sem sincronização, widget mostra aviso de dados antigos. Após 24 horas, esconde o conteúdo. Sair limpa os dados do widget e desregistra a tarefa.
- Sessão fica no Keychain via SecureStore. O widget recebe apenas dados de exibição, nunca tokens ou credenciais do Supabase.
- Os dados mostrados no widget são marcados como sensíveis para respeitar o modo de privacidade do iOS.

## Desenvolvimento

Dentro de `mobile`, execute `npm ci` e `npm run typecheck`. Use `npx expo export --platform ios` para validar o bundle. Expo Go não executa a extensão do widget: é necessária uma compilação nativa.

O app busca URL e chave pública do Supabase em `https://www.subaproverde.com/api/mobile/config`. O endpoint protegido `/api/mobile/widget` exige Bearer da sessão administrativa. Nenhuma chave service-role deve entrar no aplicativo.

## Distribuição

Projeto Expo: https://expo.dev/accounts/brunoos/projects/radar-spv

1. Publicar os endpoints e manifest do CRM junto desta alteração.
2. Compilação sem credenciais Apple: `npx eas-cli build --platform ios --profile simulator`. Esse artefato só roda em simulador de um Mac, não instala no iPhone.
3. Para iPhone/TestFlight: conta Apple Developer ativa, `npx eas-cli build --platform ios --profile production` e autenticação Apple no fluxo oficial. Depois `npx eas-cli submit --platform ios --profile production`.
4. Instalar via TestFlight, fazer login no Radar SPV, sincronizar, adicionar widget pela tela inicial.

## Conferência em dispositivo antes de liberar

Validar login administrativo, logout limpando todos os tamanhos, atualização da agenda, mudança de dia em São Paulo, retorno ao compromisso após login web, legibilidade em modo claro/escuro, modo de privacidade e sincronização com o app em segundo plano. Exportação JavaScript e checagem de tipos não substituem esse teste no iPhone.

## Reversão

Código móvel independente em `mobile/`, excluído do TypeScript/ESLint do Next. Reverter o commit da funcionalidade restaura manifest, API e links anteriores. Não há migrações ou alterações de dados para reverter. O usuário pode remover o widget/app sem afetar o CRM ou o WhatsApp.
