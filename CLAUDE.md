# Rastreabilidade LASDM

App de celular (`index.html`) + painel (`painel.html`) para rastrear amostras no arquivo refrigerado
do LASDM. HTML + JavaScript puro, sem build. Publicado no GitHub Pages; banco no Supabase.

**Leia `docs/CONTEXTO-DO-PROJETO.md` antes de mudar regras** — tem as regras de negócio, os
motivos, as decisões já tomadas, medidas fixas, banco de dados e o histórico de problemas.
Pendências em `PENDENCIAS.md`.

## Regras de trabalho

- Regras de negócio ficam em `regras.js`, compartilhado por app e painel. Não duplique regra nos HTML.
- **Ao publicar, troque a versão nos 3 lugares juntos:** `regras.js` → `VERSAO_REGRAS`, e o
  `V='...'` + `?v=` em `index.html` e `painel.html`. Formato `AAAA.MM.DD` + letra da vez no dia
  (ex.: `2026.11.12d`). Sem isso o celular fica com regras antigas em cache.
- Mudança de banco = novo arquivo `supabase/0N_*.sql` que possa ser rodado de novo sem apagar dados,
  com fallback no app se ainda não tiver sido aplicado. O usuário roda o SQL no painel do Supabase.
- Tabelas ficam fechadas (RLS sem políticas); tudo passa por funções `api_*` (security definer).
  Toda operação de administrador confere usuário e senha dentro da função.
- Regras novas de armazenamento **não movem amostras sozinhas**: aparecem como "fora da regra" e o
  operador remaneja.
- Textos do app em português, sem jargão técnico. Datas `DD/MM/AAAA`, fuso America/Sao_Paulo.
- `apps-script/Codigo.gs` é o backend antigo (Planilha Google): só referência, não usar.
- Depois de cada alteração: commit (mensagem em português, no estilo dos commits existentes, com a
  versão entre parênteses) e push para o GitHub.
- O repositório é **público**: nunca commitar planilhas com dados, senhas ou chaves de serviço.
