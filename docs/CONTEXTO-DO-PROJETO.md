# Contexto do projeto — Rastreabilidade LASDM

Resumo de passagem de projeto (16/11/2026), montado a partir do código, dos scripts SQL e do
histórico de commits. Onde o motivo de uma regra não está escrito no código ou no commit, o
texto diz "motivo provável".

## Visão geral

- Sistema web (HTML + JavaScript puro, sem build) publicado no **GitHub Pages**, banco no
  **Supabase** (projeto "Rastreabilidade LASDM", região São Paulo) desde 29/10/2026.
- Arquivos principais: `index.html` (app de celular), `painel.html` (painel no computador),
  `regras.js` (regras compartilhadas por app e painel), `supabase/*.sql`, `PENDENCIAS.md`.
- `apps-script/Codigo.gs` é o backend antigo (Planilha Google). Fica só como referência.
- Bibliotecas por CDN: jsQR 1.4.0 (QR), Tesseract.js 5.1.1 (OCR), SheetJS xlsx 0.18.5 (Excel),
  three.js r128 (prateleira 3D no painel).
- **Publicar:** commit no branch principal → GitHub Pages atualiza. A versão fica em **3 lugares**
  que precisam mudar juntos: `regras.js` → `VERSAO_REGRAS`, e o `V='...'` + `?v=` em
  `index.html` e `painel.html`. Formato: `AAAA.MM.DD` + letra da vez no dia (ex.: `2026.11.12d`).

## 1. Objetivo e perfis

Rastreia cada amostra de semente que entra no arquivo refrigerado do Laboratório de Análise de
Sementes (LASDM): onde está guardada (prateleira · andar · linha · lado · altura) e quando sai
para uma sala e volta.

- **App de celular (bipagem):** o operador fotografa a etiqueta (QR + texto por OCR) ou digita o
  protocolo. O app confere com a planilha de referência, sugere a posição e registra o
  movimento: armazenar, enviar para sala, retornar, remanejar ou dar baixa.
- **Painel (computador):** indicadores, mapa da sala do arquivo (28 estantes), ocupação das
  prateleiras em 2D/3D, conciliação (recebidas × registradas), tempo fora do arquivo por sala,
  testes pendentes, cadastros, impressão das etiquetas de endereço e importação das planilhas.
- **Salas de destino:** Sala de análise, Sala de montagem, Sala de tratamento de sementes, Sala de
  homogeneização de sementes.

| Perfil | O que pode fazer |
|---|---|
| Administrador | Tudo do operador + cadastrar usuários, trocar senhas, desativar contas, importar as planilhas de referência, salvar o filtro da conciliação, os limites de tempo por sala, os testes considerados, e liberar reserva de andar de outro operador. |
| Operador | Entrar com usuário e senha, bipar e registrar movimentos, consultar o painel, cadastrar prateleiras. |

No primeiro acesso, sem nenhum usuário no banco, o app pede para criar o administrador.

## 2. Regras de negócio

Quase todas estão em `regras.js` (usado pelo app e pelo painel, para os dois nunca divergirem).

### Identificação e dados

| Regra | Motivo |
|---|---|
| Cada volume tem uma chave: protocolo do sistema `17215/2026`; amostra manual `M80/2026` (numeração própria, começa do 1); Pureza `10950/2026 PUREZA` (2º volume do protocolo, sempre em saco kraft). Um volume por chave. | Manual e sistema têm números que se repetem; Pureza é um segundo físico do mesmo protocolo. |
| O app funciona sem as planilhas: registra com os dados da etiqueta + o que o operador confirma. As planilhas servem para conferência e auditoria. | Pedido do usuário: a amostra chega antes de a planilha ser importada e o trabalho não pode parar. |
| Dados da planilha prevalecem sobre o registro: produtor e remessa vêm da referência (se o registro ficou vazio, painel e etiquetas usam a planilha). Pureza herda o produtor do protocolo principal. | Um registro errado ou incompleto não pode "passar adiante". |
| Protocolo digitado começando com M vira amostra manual. | Antes o M era descartado e a amostra caía como protocolo do sistema. |
| O QR só fica vinculado ao protocolo quando a amostra é registrada. | Uma leitura errada não pode "prender" o QR a outro protocolo. |
| OCR: tolera ~30% de caracteres trocados; confere a cultivar também pelo nome-base (sem I2X/IPRO); testa protocolos vizinhos (1 dígito trocado ou 2 invertidos); ano borrado assume o ano atual. | Fotos de etiqueta no arquivo frio saem ruins; a planilha corrige a leitura. |

### Grupos de remessa (classificação)

| Grupo (nome na legenda) | Tipos de remessa / condição |
|---|---|
| Prévia (CQI) — antigo "Verde" | Lote, Teste, Entrada semente, Devoluções — análise prévia |
| Definitiva | Lote definitivo, Reembalagem, Revalidação — análise definitiva |
| TSI | Remessa TSI ou amostra tratada — análise prévia |
| TSI Definitiva | TSI ou tratada — análise definitiva |
| Pré-colheita, Pré-lote, Carregamentos | Remessas com esses nomes |
| Secador | Só milho (desde 09/11/2026). Soja de secador só registra, não armazena. |
| Interlab. | Tipo de análise Inter/Intralaboratorial |
| Manual | Protocolo M, ou espécie diferente de soja/milho |
| Não armazena | Cargas classificação e Secador de soja |

- **Tratada:** remessa TSI ou nome de produto/fórmula de tratamento no campo Tratamento (lista em
  `PRODUTOS_TRATAMENTO`, baseada na planilha "Fórmulas TSI 2026" + Poncho, Acronis, Maxim, Raiz
  Prime, Fipronil, Polímero). CONV-R-T, -O- e "sem tratamento" não contam. O operador corrige em
  "Tratada? Sim/Não". Amostra tratada vai com o TSI qualquer que seja a remessa.
- **INOVA GENÉTICA:** só identificação visual (contorno laranja, filtro no painel). Deixou de
  separar andar em 06/11/2026.

### Armazenamento na prateleira

| Regra | Motivo |
|---|---|
| Separação por **ANDAR** (não por prateleira): no mesmo andar só ficam amostras com a mesma cultura, mesmo tratamento (tratada × sem), mesmo grupo de remessa, mesmo tipo de análise (definitiva não divide com prévia) e embalagem compatível. | Organização física do arquivo; prateleira pode ter perfis diferentes por andar para não desperdiçar espaço. |
| Exceção milho: Pré-lote (06/11) e Secador (09/11) ficam no mesmo andar da Prévia (CQI). A amostra mantém o próprio grupo para cor, filtro e conciliação. | Volume pequeno desses grupos no milho; pedido do usuário. |
| Cada andar tem embalagem: caixinha 1 kg, caixinha 0,5 kg, saco kraft ou livre (assume a das amostras). Caixinhas 1 kg e 0,5 kg dividem andar; saco kraft fica separado. Andar vazio pode mudar de embalagem. | Tamanhos diferentes ocupam grades diferentes. |
| Ordem de preenchimento sugerida: andar 1→4, linha 1→N, do fundo para a frente (Trás antes de Frente), de baixo para cima. Prioridade: andar reservado pelo operador → andar com mesmo perfil → andar vazio. | Sequência previsível facilita achar a amostra. |
| Apoio: nada flutua a partir da altura B; caixinha 1 kg precisa das duas posições de 0,5 kg apoiadas embaixo. | Realidade física da pilha. |
| Gravidade: ao retirar uma amostra, as de cima descem e o app registra remanejamento automático. No retorno à mesma posição de origem, as que desceram sobem uma posição. | Mantém o registro igual à pilha real. |
| Retorno da sala: sugere o topo da pilha de origem; se cheia, usa a regra geral. Seleção múltipla só da mesma prateleira/andar/linha. | Devolver perto de onde estava. |
| Pular endereços: se o operador deixa posições utilizáveis para trás, o app pergunta uma vez; confirmado, a sugestão segue do novo ponto, os pulados ficam livres e o pulo vai na observação. | Operador às vezes precisa pular espaço físico; sem isso o app insistia na posição pulada. |
| Aviso de protocolo fora de sequência (menor que o anterior ou pulou números): pergunta Sim/Não. | Pegar erro de digitação/leitura. |
| Aviso "fora da regra" para amostras guardadas antes de uma regra nova; remanejamento já abre na posição sugerida. **Nada é movido sozinho.** | Regras mudaram várias vezes com o arquivo já ocupado. |
| Reserva de andar: um andar por operador; andar reservado por outro nunca é sugerido nem aceito. Libera ao sair, pelo botão ou após 30 min sem bipar; administrador libera no painel. | Dois operadores emblocando no mesmo andar ao mesmo tempo bagunçavam a sequência. |

### Painel

- **Conciliação** (recebidas na planilha × registradas no app): ano todo, contando também as
  manuais. Carregamentos, Pré-lote, Pré-colheita (inclusive tratados), Cargas classificação e
  Secador ficam fora da conta "para emblocar" — essas amostras não vão para o arquivo em 2026; o
  usuário pediu para tirar só da contagem, **sem mudar o app**. O administrador pode ajustar o
  filtro (tipo de análise, tipo de remessa, exceções por protocolo), que fica salvo e
  "congelado" no banco, com histórico.
- **Tempo fora do arquivo:** limites de atenção/crítico por sala, editáveis pelo administrador.
  Padrão: análise 24/48 h; montagem 12/24 h; tratamento 4/8 h; homogeneização 48/72 h.
- **Testes pendentes:** testes pedidos, realizados e em aberto por protocolo (colunas da planilha
  do sistema). O teste "UM" fica fora da conta por padrão; só administrador muda.

## 3. Decisões tomadas

| Tema | Escolhido | Descartado / como era | Por quê |
|---|---|---|---|
| Banco de dados | Supabase, trocado em 29/10/2026. | Planilha Google como banco + Apps Script como API. | Motivo provável: lentidão e limites da planilha com vários aparelhos e volume crescente. |
| Forma da migração | Uma camada no topo do HTML intercepta o `fetch` para o antigo endereço da planilha e chama `api_get`/`api_post` do Supabase. O resto do código ficou igual. | Reescrever o app para o cliente do Supabase. | Menos risco; layout e mensagens idênticos para a equipe. Aparelhos com o endereço antigo mudaram sozinhos, levando a fila pendente. |
| Planilhas antigas | Cópia em Excel + script guardados; planilha excluída. | Manter a planilha recebendo dados em paralelo. | Banco único. |
| Hospedagem | GitHub Pages. | Netlify (projeto excluído). | Motivo provável: publicar direto do repositório. |
| Segurança do banco | Tabelas fechadas (RLS ligado, sem políticas); a chave pública só executa as funções `api_*`. Senhas como hash SHA-256 com sal. Fotos num bucket público "fotos" em que o app só envia (não lista nem apaga). | Acesso direto às tabelas pela chave pública. | A chave fica visível no HTML publicado. |
| Tela Bipar | Foto da etiqueta + Digitar protocolo. QR ao vivo desligado (`CAMERA_AO_VIVO = false`), código mantido. OCR com modelo leve. | QR ao vivo como entrada principal. | A foto pega QR + texto de uma vez; a câmera ao vivo falhava em alguns celulares. |
| INOVA GENÉTICA | Só contorno laranja. | Separar andar (removido em 06/11). | Motivo provável: separar desperdiçava andar. |
| Milho Pré-lote e Secador | Mesmo andar da Prévia (CQI). Secador de milho passa a ser armazenado. | Andar próprio / Secador não armazenado. | Pedido do usuário (06/11 e 09/11). |
| Caixinha 1 kg × 0,5 kg | Ocupação por "espaço" de 0,5 kg (9×9×9 cm): todo andar de caixinha aceita os dois tamanhos; 1 kg ocupa os 2 espaços da metade e pode ir sobre duas de 0,5 kg. | 26/10: não se misturavam na mesma metade da linha; o andar "livre" virava 0,5 kg conforme a ordem das amostras. | Refletir o que cabe fisicamente e não recusar caixinha de 1 kg. |
| Linhas por andar (caixinha) | 15 padrão; 14 ou 16 conforme a prateleira (cadastro). | Só 15. | Prateleiras físicas diferentes. |
| Nome do grupo Verde | "Prévia (CQI)" nas legendas (cor e regras iguais). | "Verde". | Motivo provável: nome usado pelo laboratório. |
| Etiqueta da linha | Impressora Zebra, papel 90 × 40 mm, uma etiqueta por página, letra que se ajusta. | 104 × 50,8 mm (primeira versão de 12/11). | O papel real é 90 × 40 mm. |
| Desempenho | Etapa 1 (09/11): ficha não espera a internet além de 4 s; painel guarda a referência no navegador (IndexedDB). Índice de embalagem por andar (10/11). | Índice SQL em movimentos (protocolo, ts desc, n desc) — ganho pequeno (89 → 70 ms), não criado. Etapa 2 adiada. | O gargalo é montar e transferir o JSON, não a consulta. |
| Conciliação | Tirar Carregamentos, Pré-lote, Pré-colheita, Cargas classificação e Secador só da contagem do painel. | Mudar o app para não registrá-las. | Pedido do usuário: o app continua igual. |

## 4. Medidas, formatos e padrões fixos

### Embalagens e grade

| Embalagem (código) | Medida | Lados (do fundo para o corredor) | Alturas | Linhas por andar |
|---|---|---|---|---|
| Caixinha 1 kg (`CX1`) | 9 × 9 × 18 cm | Trás · Frente | 5, letras A–E (A = embaixo) | 15 padrão; 14 ou 16 no cadastro |
| Caixinha 0,5 kg (`CX05`) | 9 × 9 × 9 cm | Trás 02 · Trás 01 · Frente 02 · Frente 01 (Frente 01 = a da frente) | 5, letras A–E | 15 padrão; 14 ou 16 |
| Saco kraft (`KRAFT`) | 17 × 38 cm | Trás · Frente | 30, números 01–30 | 7 |

- Toda prateleira tem 4 andares. O cadastro guarda a embalagem de cada andar como texto, ex.:
  `CX1,CX1,KRAFT,KRAFT` (A.01…A.04); vazio = livre.
- Na profundidade de cada metade (18 cm) cabem 2 espaços de 0,5 kg; por isso a caixinha de 0,5 kg
  usa 4 lados e a de 1 kg ocupa os 2 espaços da metade.
- Andar livre e vazio conta como caixinha de 1 kg para mostrar capacidade.
- Sala do arquivo: mapa com 28 estantes no painel; cada vaga mostra o número da prateleira.

### Códigos e textos

| Item | Formato | Exemplo |
|---|---|---|
| Endereço completo | `P.<prat> \| A.<andar> \| L.<linha> · <lado> · <altura>` (2 dígitos) | `P.03 \| A.02 \| L.11 · Trás 01 · C` |
| Código na etiqueta da linha | `P. <prat> \| A. <andar> \| L. <linha>` | `P. 03 \| A. 02 \| L. 11` |
| Protocolo do sistema | `<número>/<ano>`; aceita "Prot: 17.215/2026" e número sem ano (assume o ano atual) | `17215/2026` |
| Amostra manual | `M<número>/<ano>` | `M80/2026` |
| Pureza | `<protocolo> PUREZA` | `10950/2026 PUREZA` |
| QR da etiqueta da amostra (sistema SoftSul) | `http://site.softsul.agr.br/clients/doismarcos/amostra?codigoamostra=<código>` | `codigoamostra=67080` |
| Versão do app | `AAAA.MM.DD` + letra da vez no dia | `2026.11.12d` |
| Siglas de tecnologia (OCR) | Soja: I2X, IPRO, CE, E3, RR. Milho: VIP, PRO2/3/4, PW, TL, YH. Correções: 12X/l2X → I2X, 1PRO → IPRO | `CZ37B39I2X` |

### Etiqueta da linha (impressora Zebra)

- Papel 90 × 40 mm, margem 0, uma etiqueta por página, sem cabeçalho do navegador (`@page`
  definido em `regras.js` → `ETQ` e `imprimirEtiquetasZebra`).
- Conteúdo: título (grupo/cultura), código do endereço e colunas TRÁS | FRENTE com os protocolos
  agrupados em faixas de sequência (ex.: 13931, 13961–13964), lado a lado.
- Linha com caixinhas de 0,5 kg: 4 colunas na ordem física (Trás 02 · Trás 01 · Frente 02 ·
  Frente 01) e uma faixa "1 kg" quando a linha também tem caixinhas de 1 kg.
- Letra dos protocolos: máximo 14 pt, mínimo 6,5 pt; diminui só o necessário. Se não couber nem no
  mínimo, avisa. Lista cheia usa cabeçalho compacto.
- Etiqueta só de Pureza: os números saem sem o "(P)", porque o título já diz PUREZA.
- Impressão: linha selecionada, linhas do andar, prateleira inteira ou direto da busca (painel e
  app). Outras impressões (relatórios) usam margem de 10 mm.

### Cores dos grupos (legendas, mapa 2D/3D)

| Grupo | Cor |
|---|---|
| Prévia (CQI) | `#83E28E` |
| Definitiva | `#1E6B3C` |
| TSI | `#F7C7AC` |
| TSI Definitiva | `#A4472A` |
| Pré-colheita | `#FFFF00` |
| Pré-lote | `#D86DCD` |
| Secador | `#C8A27A` |
| Carregamentos | `#4D93D9` |
| Interlab. | `#C9C9C9` |
| Manual | `#E8E2D0` |
| Não armazena | `#BE5014` |
| INOVA GENÉTICA | contorno laranja |

### Padrões comuns

- Datas `DD/MM/AAAA`, hora de Brasília (America/Sao_Paulo).
- Usuário: minúsculas, números, ponto, hífen ou sublinhado, 2 a 30 caracteres, sem espaço. Senha
  com pelo menos 4 caracteres.
- Textos e mensagens do app em português, sem jargão técnico.

## 5. Banco de dados e entrada dos dados

Projeto Supabase próprio (Postgres, região São Paulo), estrutura versão 8. O app e o painel só
chamam funções RPC (`api_*`, security definer); as tabelas têm RLS ligado e nenhuma política,
então não são acessíveis direto pela chave pública. Os scripts SQL podem ser rodados de novo sem
apagar dados. As chaves ficam no topo do `index.html` e do `painel.html`.

| Tabela | Conteúdo | Observações |
|---|---|---|
| `movimentos` | Uma linha por ação: REGISTRO, ARMAZENAR, SALA, RETORNO, REMANEJAR, BAIXA. Endereço (prateleira, andar, linha, lado, altura), dados da amostra, usuário, aparelho, link da foto, `ts`, situação. | O estado atual de cada amostra é calculado no navegador (`regras.js`) a partir dos movimentos. Situação "Conflito: …" quando a posição já está ocupada ou o protocolo já está emblocado. |
| `prateleiras` | Número, embalagem, andares (embalagem por andar), linhas, mapa (vaga no mapa da sala), situação. | |
| `referencia` | Planilhas importadas (sistema + manual): protocolo, data, espécie, cultivar, categoria, peneira, lote, produtor, tipo de análise, remessa, tratamento, safra, testes abertos/pedidos/finalizados, origem. | Gravada por posição (`pos`); cada importação substitui tudo. |
| `usuarios`, `log_usuarios` | Login (hash + sal) e histórico de cadastros, senhas e logins. | |
| `reservas` | Reserva de andar por operador. | Criada por `04_reserva_andar.sql`. |
| `config` | Chave/valor: `FILTRO_CONC`, `FILTRO_CONC_HIST`, `LIMITES_SALAS`, `TESTES_CONSIDERADOS`, `REF_EM` (data da última importação), `RESET_TS`, `RESET_PRAT`. | |
| Storage `fotos` | Foto da etiqueta, nome = id do movimento `.jpg`. | Bucket público; app só envia. |

**Funções:** `api_get` (`acao=dados` devolve os movimentos a partir de `desde` + o último de cada
protocolo + prateleiras; `acao=ref` devolve a referência por `desde`, `prot` ou `prots`),
`api_post` (movimentos, prateleiras, usuários, importação da referência), `api_filtro`,
`api_reserva`, `api_limites`, `api_testes`.

**Ordem dos scripts:** `01_estrutura` → `03_filtro_conciliacao` → `04_reserva_andar` →
`05_limites_salas` → `06_testes_pendentes` → `07_corrige_importacao`. Não existe `02_` no
repositório. Cada função nova tem fallback no app: sem o script, vale o comportamento padrão e o
painel mostra um aviso. O `07` aumentou o tempo máximo das consultas de 3 s para 30 s
(`statement_timeout` dos papéis anon e authenticated).

### Como os dados entram

1. **Celular (operador):** foto/digitação → registro do movimento no aparelho (fila local) →
   `api_post`. A foto sobe para o Storage e o movimento guarda só o link. App e painel sincronizam
   a cada 1 minuto.
2. **Planilha do sistema** (administrador, no painel, aba "Planilhas de referência"): Excel
   exportado do sistema do laboratório. O cabeçalho é localizado pela coluna "Número da Amostra".
   Colunas lidas: Data do recebimento, Remetente/Safra, Espécie, Cultivar, Categoria, Peneira,
   Representatividade, Lote/Origem, Produtor, Observação, TipoAnalise, ANALISES_ABERTAS,
   PROTOCOLO_ANALISES, ANALISES_FINALIZADAS, Tipo Remessa, Tratamento, Procedência/UF.
3. **Planilha manual** ("TESTES - ENTRADAS MANUAIS"): uma aba por espécie, cabeçalho "Protocolo
   LASDM". Os números viram `M<n>/<ano>`. Abas de experimento, cópias ("PlanilhaN") e etiquetas
   são ignoradas; a aba SEQUENCIAL só completa protocolos que não estão nas abas de espécie. Abas
   com "INOVA" marcam o produtor INOVA GENÉTICA. Número repetido em abas diferentes é juntado e
   marcado para conferência.
4. **Gravação:** o painel lê o Excel no navegador (SheetJS), junta as duas planilhas (a mais nova
   ou a manual sobrescreve o mesmo protocolo; reenvio da mesma origem substitui a linha inteira) e
   envia em partes com posição fixa (`inicio` → `parte` → `fim`), com nova tentativa e sem
   duplicar.
5. **Cache:** o painel guarda a referência no navegador (IndexedDB) e só baixa de novo quando a
   data/nº de linhas da referência muda.

## 6. Problemas que já aconteceram

Recorrentes: cache de versão antiga no celular, lentidão por volume de dados e regras que mudaram
com o arquivo já ocupado. Do mais recente para o mais antigo:

| Data | Problema | Como foi resolvido |
|---|---|---|
| 12/11/2026 | Amostra emblocada antes de a planilha chegar ficava com remessa vazia no painel e na etiqueta. | Painel e etiquetas completam a remessa/análise pela planilha (2026.11.12d). |
| 12/11/2026 | Etiqueta da linha saiu no tamanho errado (feita para 104 × 50,8 mm); depois, margem de baixo cortando. | Ajustada ao papel real 90 × 40 mm, margem 0, letra que se ajusta e cabeçalho compacto (2026.11.12c). |
| 10/11/2026 | Produtor errado de um registro anterior passava para os próximos; protocolo digitado com M perdia o M; Pureza não herdava INOVA. | Produtor sempre da planilha; M abre amostra manual; Pureza busca o produtor do protocolo principal. |
| 10/11/2026 | Sugestão e validação lentas: cada andar varria todas as amostras. | Índice de embalagem por andar, montado uma vez por estado. Conferido com 3.646 comparações em dados reais (mesmos resultados). |
| 09/11/2026 | Lentidão com internet ruim: a ficha esperava o banco; cada sincronização traz ~1,6 MB com 3.000 amostras (~14,5 MB com ~20.000 protocolos). | Etapa 1: consulta com limite de 4 s (a ficha abre com aviso e completa depois) e referência guardada no navegador. Etapa 2 pendente. |
| 05/11/2026 | Importação das planilhas falhava no Supabase: a proteção `pg_safeupdate` bloqueia `delete` sem `where`, e o tempo limite de 3 s era curto para a referência do ano. | `07_corrige_importacao.sql`: `delete ... where true` e tempo limite de 30 s. |
| 30/10/2026 | Andar livre com uma caixinha de 0,5 kg registrada antes era lido como andar de 0,5 kg: recusava a de 1 kg e o 3D não desenhava. Prateleira com andares livres aparecia como "Misto". | Embalagem do andar calculada pelo conjunto das amostras, sem depender da ordem; todo andar de caixinha aceita 1 kg e 0,5 kg. |
| 27/10/2026 | Leitura errada do QR "prendia" o QR a outro protocolo. | Vínculo só ao registrar a amostra; vínculos antigos do aparelho limpos. |
| 27/10/2026 | Câmera não abria em alguns celulares. | Tenta configurações mais simples e explica a causa (permissão negada, câmera ocupada, sem câmera). QR ao vivo desligado no layout. |
| 27/10/2026 | OCR cortava o sufixo da cultivar (I2X/IPRO) e não achava o protocolo. | Conferência também pelo nome-base; cultivar preenchida com a grafia da planilha. |
| 26/10/2026 | Celular usava `regras.js` antigo em cache, com regras diferentes do app. | Versão na URL (`regras.js?v=`) e recarga automática se a versão não bate. Toda publicação precisa trocar a versão nos 3 lugares. |
| 26/10/2026 | Caixinhas de 0,5 kg gravadas no formato antigo (Trás/Frente) ou na ordem antiga das posições. | Conversão na leitura (Trás → Trás 02, Frente → Frente 01) e migração única no script v5 (Frente 01 = a da frente). |
| 24/10/2026 | Envio das planilhas de referência falhava ou duplicava (arquivo grande). | Envio em partes menores, com nova tentativa e sem duplicar. |
| 24/10/2026 | Leitura da foto (OCR) lenta. | Modelo OCR leve, menos passadas, QR procurado no miolo da foto, botão para digitar durante a leitura. |

## 7. Pendências e planos futuros

### Planejado: desempenho etapa 2 (sincronização incremental)

Fazer só se a lentidão continuar ou o arquivo crescer. Detalhe completo em `PENDENCIAS.md`. Hoje
app e painel chamam `api_get {acao:'dados'}` a cada minuto e recebem todos os movimentos dos
últimos 60 dias + o último de cada protocolo.

- Banco (SQL novo): marcar quando um movimento foi criado ou alterado (ex.: `recebido_em = now()`
  também em UPDATE, para pegar Conflito/Excluído); `api_get` aceita `apos=<hora do servidor>` e
  devolve só o que mudou + a hora atual do servidor.
- App (`sincronizar` / `baixar` em `index.html`) e painel (`carregar` em `painel.html`): guardar
  a hora do servidor da última chamada e mesclar por `id`; conferência completa a cada 30 min e no
  botão Atualizar.
- Refazer os testes de volume (19.693 protocolos + 3.000 movimentos). Os scripts usados antes
  (`perf.mjs`, `s2_*.mjs`) não estão no repositório: precisam ser recriados.
- Contrapontos já explicados ao usuário: mudança feita direto por SQL só aparece na conferência
  completa (até 30 min); mais complexidade; o primeiro acesso continua baixando tudo uma vez.

### Pontas soltas

- `README.md` desatualizado: ainda tem o passo a passo de implantação pela planilha. Trocar pelo
  fluxo atual (GitHub Pages + scripts SQL no Supabase).
- Numeração dos scripts SQL pula o `02_`. Confirmar se houve um script 02 aplicado direto no
  Supabase sem ir para o repositório.
- A chave pública do Supabase fica visível no HTML publicado. A segurança depende de as tabelas
  continuarem fechadas e de toda operação de administrador conferir usuário e senha dentro da
  função. Manter esse padrão em qualquer função nova.
