# Identidade Grafite — expansão para o site

## Escopo

Base aprovada: `a29e3410b90a6cfd12823623f2a6878f63882362`.
Paleta compartilhada em `app/site-tokens.css`: grafite, superfícies neutras, verde da marca, Geist. Tema claro opcional com contraste próprio. Menu operacional compartilhado por sellers e administradores, com grupos expansíveis e gaveta no celular.

Aplicada às páginas públicas, login/cadastro/recuperação, área de sellers, chamados, relatórios, configurações, CRM (funil, clientes, agenda, conversas, financeiro, relatórios e inteligência), administração, remoções e influencers. Protótipo `/preview/crm` permanece isolado para comparação. O termômetro aprovado é reutilizado no detalhe do seller.

Não modifica APIs, SQL, permissões, cobranças, mensagens nem configurações da Bia. Autenticação e resolução de perfil existentes foram preservadas. Nenhum worker foi iniciado.

## Verificação

- TypeScript sem erros.
- Build completo passou com variáveis fictícias de Supabase; esse teste não valida integrações reais.
- Verificação visual local de CRM e agenda no desktop, tema claro e Grafite.
- Menu móvel, agenda e login em viewport 390 × 844; sem alargamento da página observado.
- Fixture local de inspeção removida antes da publicação.
- Deploy de produção confirmado para `cf79fa0`. Resumo do seller, chamados e relatórios conferidos no site; cards claros remanescentes de chamados corrigidos no acabamento seguinte.
- A sessão de navegador disponível redirecionou `/admin/crm` para `/app` antes e depois da publicação. A conferência de CRM com dados reais depende de uma sessão administrativa válida; teste local não substitui essa conferência.
- Validação funcional de gravações financeiras, mensagens e compromissos não é executada em produção nesta alteração visual.

## Reversão

Reverter o commit da expansão de design, preservando commits posteriores, recupera a apresentação anterior sem alterar o banco de dados. Não usar reset destrutivo nem reverter indiscriminadamente todo o projeto. Revisar conflitos se houver novas mudanças na interface.
