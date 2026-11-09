# Pendências do LASDM

## Desempenho — etapa 2 (pendente, fazer quando necessário)

Combinado em 09/11/2026: a etapa 1 foi aplicada (versão 2026.11.09c). A etapa 2 fica para quando a lentidão continuar ou o arquivo crescer.

**Problema medido:** o app e o painel chamam `api_get {acao:'dados'}` a cada 1 minuto e recebem **todos** os movimentos dos últimos 60 dias **mais o último movimento de cada protocolo já registrado**. Com 3.000 amostras ≈ 1,6 MB por chamada; com ~20.000 protocolos ≈ 14,5 MB por chamada (medido em teste local). O tempo vai quase todo em montar o JSON (`jsonb_agg`) e transferir; um índice em `movimentos (protocolo, ts desc, n desc)` mudou pouco (89 → 70 ms) e por isso não foi criado.

**Proposta da etapa 2 (sincronização incremental):**
- Banco (SQL novo): coluna/gatilho que marque quando um movimento foi criado **ou alterado** (ex.: `recebido_em = now()` também em UPDATE, para pegar Conflito/Excluído); `api_get` aceita `apos=<hora do servidor>` e devolve só o que mudou + a hora atual do servidor.
- App (`index.html`, `sincronizar`/`baixar`) e painel (`painel.html`, `carregar`): guardam a hora do servidor da última chamada e mesclam por `id`; conferência completa a cada 30 min e no botão Atualizar.
- Contrapontos já explicados ao usuário: mudança feita direto por SQL só aparece na conferência completa (até 30 min); mais complexidade; o primeiro acesso continua baixando tudo uma vez.

**Testes para refazer:** `/tmp/claude-0/lasdm/perf.mjs` (volume real: 19.693 protocolos da planilha de 23/10 + 3.000 movimentos), `s2_lento.mjs`, `s2_cache.mjs` e a bateria `s2_*.mjs`.
