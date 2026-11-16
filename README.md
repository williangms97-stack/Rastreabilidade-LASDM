# Rastreabilidade LASDM

Rastreamento das amostras de sementes no arquivo refrigerado do Laboratório de Análise de Sementes LASDM e da movimentação para as salas de análise, montagem, tratamento e homogeneização.

- **Aplicativo (celular):** https://williangms97-stack.github.io/Rastreabilidade-LASDM/
- **Painel:** https://williangms97-stack.github.io/Rastreabilidade-LASDM/painel.html
- **Banco de dados:** Supabase (projeto "Rastreabilidade LASDM", São Paulo) desde 29/10/2026. A Planilha Google usada antes foi desativada.
- **Contexto completo** (regras, decisões, medidas, histórico de problemas): `docs/CONTEXTO-DO-PROJETO.md`. Pendências: `PENDENCIAS.md`.

## Arquivos
- `index.html` — app de bipagem: foto da etiqueta (QR + leitura do texto por OCR) ou digitação do protocolo, conferência com as planilhas, sugestão de posição, salas e etiquetas das linhas.
- `painel.html` — indicadores, ocupação das prateleiras, salas, conciliação (recebidas × registradas), tempo fora por sala, testes pendentes, movimentos e envio das planilhas de referência.
- `regras.js` — regras compartilhadas por app e painel: grupos de tipo de remessa, perfil da prateleira, endereçamento e etiqueta da linha.
- `supabase/*.sql` — estrutura do banco: tabelas e funções `api_*`.
- `apps-script/Codigo.gs` — script da antiga Planilha Google. Só referência — não é mais usado.

## Publicar uma nova versão
1. Troque a versão nos **3 lugares**, todos com o mesmo valor (formato `AAAA.MM.DD` + letra da vez no dia, ex.: `2026.11.12d`):
   `VERSAO_REGRAS` em `regras.js`, e o `V='...'` + `?v=` em `index.html` e em `painel.html`.
   Sem isso o celular pode continuar com as regras antigas guardadas.
2. Envie a alteração (commit) para o branch `main`. O GitHub Pages publica sozinho em 1 a 2 minutos.

## Banco de dados (Supabase)
Rode os scripts no painel do Supabase → projeto "Rastreabilidade LASDM" → *SQL Editor*, nesta ordem:

1. `01_estrutura.sql`
2. `03_filtro_conciliacao.sql`
3. `04_reserva_andar.sql`
4. `05_limites_salas.sql`
5. `06_testes_pendentes.sql`
6. `07_corrige_importacao.sql`

Todos podem ser rodados de novo sem apagar dados. Mudanças novas vão num novo arquivo `supabase/0N_*.sql`.

No primeiro acesso ao app, sem nenhum usuário no banco, o app pede para criar o administrador.
Depois, no painel, aba "Planilhas de referência", envie a planilha do sistema e a manual.
