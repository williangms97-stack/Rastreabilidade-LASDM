/* =====================================================================
   LASDM · Rastreabilidade de amostras — regras compartilhadas (app e painel)
   - Grupos de tipo de remessa (cores da tabela do prompt)
   - Perfil de prateleira (cultura, tratamento, produtor INOVA, embalagem, grupo)
   - Endereçamento: Prateleira · Andar · Linha · Lado · Altura
   - Estado atual das amostras a partir dos movimentos
   - Etiqueta de linha (faixas de protocolos por Trás / Frente)
   ===================================================================== */
(function (G) {
  'use strict';
  const up = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

  /* ---------- Protocolo (Número da Amostra) ---------- */
  // aceita "17215/2026", "Prot: 17215/2026", "17.215/2026", "17215" (ano atual)
  /* Identificação de cada volume guardado no arquivo:
     - protocolo do sistema: "17215/2026"
     - amostra manual (etiqueta com M, numeração própria que também começa do 1): "M80/2026"
     - Pureza (2º volume de um protocolo do sistema, sempre em saco kraft): "10950/2026 PUREZA" */
  const ano4 = a => { a = String(a); return a.length === 2 ? '20' + a : a; };
  const limpaNum = n => String(n).replace(/[.\s]/g, '').replace(/^0+(?=\d)/, '');
  function normProt(s, anoPadrao) {
    const t = String(s == null ? '' : s).trim();
    let m = /(?:^|[^A-Z0-9])M\s*[-.]?\s*(\d{1,6})\s*\/\s*(20\d{2}|\d{2})(?!\d)/.exec(' ' + t.toUpperCase());
    if (m) return 'M' + limpaNum(m[1]) + '/' + ano4(m[2]);
    m = /(\d{1,3}(?:[.\s]\d{3})+|\d{1,7})\s*\/\s*(20\d{2}|\d{2})(?!\d)/.exec(t);
    if (m) return limpaNum(m[1]) + '/' + ano4(m[2]);
    m = /^\s*(M?)\s*(\d{1,7})\s*$/i.exec(t);
    if (m) return (m[1] ? 'M' : '') + limpaNum(m[2]) + '/' + (anoPadrao || new Date().getFullYear());
    return '';
  }
  const ehManual = p => /^M/i.test(String(p || ''));
  const ehPureza = p => /\sPUREZA$/i.test(String(p || ''));
  const protBase = p => String(p || '').replace(/\s+PUREZA$/i, '');
  const chaveItem = (prot, pureza) => pureza && !ehManual(prot) ? protBase(prot) + ' PUREZA' : protBase(prot);
  const protNum = p => Number(protBase(p).replace(/^M/i, '').split('/')[0]) || 0;
  const protAno = p => Number(protBase(p).split('/')[1]) || 0;
  const tipoItem = p => ehManual(p) ? 'M' : ehPureza(p) ? 'P' : 'S';
  const milhar = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  /* ---------- Tipos de remessa → grupo de prateleira ---------- */
  const GRUPOS = {
    VERDE:      { nome: 'Lote / Teste / Entrada semente / Devoluções — análise prévia (CQI)', curto: 'Verde', cor: '#83E28E', tinta: '#0f3d17' },
    DEFINITIVA: { nome: 'Lote definitivo / Reembalagem / Revalidação — análise definitiva', curto: 'Definitiva', cor: '#1E6B3C', tinta: '#ffffff' },
    TSI:        { nome: 'TSI — análise prévia (CQI)', curto: 'TSI', cor: '#F7C7AC', tinta: '#6b2c0b' },
    TSI_DEF:    { nome: 'TSI — análise definitiva', curto: 'TSI Definitiva', cor: '#A4472A', tinta: '#ffffff' },
    PRECOLHEITA:{ nome: 'Pré-colheita', curto: 'Pré-colheita', cor: '#FFFF00', tinta: '#4d4a00' },
    PRELOTE:    { nome: 'Pré-lote', curto: 'Pré-lote', cor: '#D86DCD', tinta: '#3d0b37' },
    CARREG:     { nome: 'Carregamentos', curto: 'Carregamentos', cor: '#4D93D9', tinta: '#ffffff' },
    INTERLAB:   { nome: 'Inter/Intralaboratorial', curto: 'Interlab.', cor: '#C9C9C9', tinta: '#1f1f1f' },
    MANUAL:     { nome: 'Amostras manuais', curto: 'Manual', cor: '#E8E2D0', tinta: '#3a3320' },
    NAO:        { nome: 'Não armazena no arquivo', curto: 'Não armazena', cor: '#BE5014', tinta: '#ffffff' },
    OUTROS:     { nome: 'Outros tipos', curto: 'Outros', cor: '#DDDDDD', tinta: '#1f1f1f' }
  };
  const REMESSA_GRUPO = {
    'LOTE': 'VERDE', 'TESTE': 'VERDE', 'DEVOLUCOES': 'VERDE', 'ENTRADA SEMENTE': 'VERDE', 'REVALIDACAO': 'DEFINITIVA', 'REEMBALAGEM': 'DEFINITIVA',
    'TSI': 'TSI', 'PRE COLHEITA': 'PRECOLHEITA', 'PRE LOTE': 'PRELOTE', 'CARREGAMENTOS': 'CARREG',
    'CARGAS CLASSIFICACAO': 'NAO', 'SECADOR': 'NAO'
  };
  const TIPOS_REMESSA = ['LOTE', 'TESTE', 'DEVOLUÇÕES', 'ENTRADA SEMENTE', 'REVALIDAÇÃO', 'REEMBALAGEM', 'TSI', 'PRE COLHEITA', 'PRE LOTE', 'CARREGAMENTOS', 'CARGAS CLASSIFICAÇÃO', 'SECADOR'];
  const CULTURAS_PROTOCOLO = ['SOJA', 'MILHO'];

  /* Produtos e fórmulas de tratamento de sementes (planilha "Fórmulas TSI 2026" + nomes usados na referência).
     Se o campo Tratamento tiver um destes nomes, a amostra é tratada; o operador pode corrigir na ficha (Tratada? Sim/Não). */
  const PRODUTOS_TRATAMENTO = ['STANDAK', 'STK', 'POTENTE', 'DERMACOR', 'DMC', 'FORTENZA', 'VICT', 'GUARDIAO', 'ILEVO', 'IL EVO', 'LMZ',
    'ACORDA', 'BIOFIX', 'LABSEC', 'LABFIX', 'PROTEC', 'VOTIVO', 'VITOVU', 'LUMITREO', 'POLIMERO', 'PONCHO', 'ACRONIS', 'MAXIM', 'RAIZ PRIME',
    'FIPRONIL', 'TRATAMENTO', 'TRATADA', 'TRATADO'];
  const RX_TRATAMENTO = new RegExp('(^|[^A-Z])(' + PRODUTOS_TRATAMENTO.map(t => t.replace(/ /g, '\\s*')).join('|') + ')', 'i');
  const ehTratamento = t => { const v = String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
    if (!v || /^(-O-|NAO|N|0)$/.test(v) || /\b(SEM|NAO)\s+(TRATAMENTO|TRATADA|TRATADO)\b/.test(v)) return false;
    return RX_TRATAMENTO.test(v); };

  /* Classifica uma amostra (dados vindos das planilhas ou digitados) */
  function classificar(a) {
    const especie = up(a.especie);
    const protocolo = !ehManual(a.protocolo) && CULTURAS_PROTOCOLO.indexOf(especie) >= 0;
    const tipo = up(a.tipoAnalise);
    let grupo;
    if (!protocolo) grupo = 'MANUAL';
    else if (/INTER|INTRA/.test(tipo)) grupo = 'INTERLAB';
    else grupo = REMESSA_GRUPO[up(a.remessa)] || (a.remessa ? 'OUTROS' : 'OUTROS');
    // análise DEFINITIVA tem grupo próprio: Verde → Definitiva (com Reembalagem e Revalidação); TSI → TSI Definitiva
    const ehDef = /DEFINITIVA/.test(tipo);
    if (protocolo && ehDef && grupo === 'VERDE') grupo = 'DEFINITIVA';
    if (protocolo && ehDef && grupo === 'TSI') grupo = 'TSI_DEF';
    // tratada: remessa TSI ou nome de produto/fórmula de tratamento no campo Tratamento (texto livre da planilha)
    const tratada = grupo === 'TSI' || grupo === 'TSI_DEF' || ehTratamento(a.tratamento);
    // amostra tratada vai com o TSI, qualquer que seja a remessa: análise prévia → TSI; definitiva → TSI Definitiva
    if (protocolo && tratada && ['TSI', 'TSI_DEF', 'NAO', 'INTERLAB'].indexOf(grupo) < 0) grupo = (ehDef || grupo === 'DEFINITIVA') ? 'TSI_DEF' : 'TSI';
    const inova = /INOVA\s*GENETICA/.test(up(a.produtor));
    // análise DEFINITIVA (ex.: lote definitivo) não divide andar com análise prévia
    const definitiva = protocolo && (ehDef || grupo === 'DEFINITIVA' || grupo === 'TSI_DEF');
    return {
      classificacao: protocolo ? 'Protocolo' : 'Entrada de amostra manual',
      cultura: especie || 'NÃO INFORMADA',
      grupo, tratada, inova, definitiva,
      armazena: grupo !== 'NAO'
    };
  }
  // chave que define quem pode dividir a mesma prateleira (regras 1 a 4 + embalagem)
  function perfil(a, embalagem) {
    const c = classificar(a);
    return { cultura: c.cultura, tratada: c.tratada, inova: c.inova, grupo: c.grupo, definitiva: c.definitiva, embalagem: embalagem || a.embalagem || '' };
  }
  const chavePerfil = p => [p.cultura, p.tratada ? 'TRAT' : 'SEM', p.inova ? 'INOVA' : 'GERAL', p.grupo, p.definitiva ? 'DEF' : 'PREV', p.embalagem].join('|');
  // resumo dos perfis por andar, ex.: "A.01–A.02: SOJA · … · A.03: MILHO · … · A.04: livre"
  function textoAndares(x) {
    if (!x || !x.andares) return 'Livre';
    return [1, 2, 3, 4].map(a => 'A.' + p2(a) + ': ' + (x.andares[a] && x.andares[a].perfil ? textoPerfil(x.andares[a].perfil) : 'livre')).join('\n');
  }
  function textoPerfil(p) {
    if (!p) return 'Livre';
    return [p.cultura, p.tratada ? 'Tratada' : 'Sem tratamento', p.inova ? 'INOVA GENÉTICA' : 'Demais produtores', ((GRUPOS[p.grupo] || {}).curto || p.grupo) + (p.definitiva && p.grupo !== 'DEFINITIVA' && p.grupo !== 'TSI_DEF' ? ' (Definitiva)' : '')].join(' · ');
  }
  // explica por que a amostra não pode entrar num andar com outro perfil (a separação é por ANDAR da prateleira)
  function motivosIncompat(pa, pb) {
    const m = [];
    if (pa.embalagem !== pb.embalagem) m.push('embalagem diferente (' + nomeEmb(pb.embalagem) + ')');
    if (pa.cultura !== pb.cultura) m.push('cultura diferente neste andar (' + pb.cultura + ')');
    if (pa.tratada !== pb.tratada) m.push(pb.tratada ? 'andar de amostras tratadas' : 'andar de amostras sem tratamento');
    if (pa.inova !== pb.inova) m.push(pb.inova ? 'andar exclusivo INOVA GENÉTICA' : 'INOVA GENÉTICA não fica no mesmo andar dos demais produtores');
    if (!!pa.definitiva !== !!pb.definitiva && pa.grupo === pb.grupo) m.push(pb.definitiva ? 'andar de análise DEFINITIVA' : 'análise DEFINITIVA não fica no mesmo andar da análise prévia');
    if (pa.grupo !== pb.grupo) m.push('andar com tipo de remessa de outro grupo (' + ((GRUPOS[pb.grupo] || {}).curto || pb.grupo) + ')');
    return m;
  }

  /* ---------- Embalagens e endereçamento ---------- */
  const EMBALAGENS = {
    CX1:   { nome: 'Caixinha 1 kg', dim: '9 × 9 × 18 cm', linhas: 15, lados: ['T', 'F'], alturas: 5, letras: true },
    // lados em ordem espacial, do fundo para o corredor: Trás 02 · Trás 01 · Frente 02 · Frente 01 (Frente 01 = a da frente)
    CX05:  { nome: 'Caixinha 0,5 kg', dim: '9 × 9 × 9 cm', linhas: 15, lados: ['T2', 'T1', 'F2', 'F1'], alturas: 5, letras: true },
    KRAFT: { nome: 'Saco kraft', dim: '17 × 38 cm', linhas: 7, lados: ['T', 'F'], alturas: 30, letras: false }
  };
  const ANDARES = 4;
  // a caixinha de 0,5 kg também pode ir na prateleira de 1 kg (ocupa uma posição de 1 kg: Trás/Frente, A–E)
  const cabeNa = (embAmostra, embPrat) => embAmostra === embPrat || (embAmostra === 'CX05' && embPrat === 'CX1');
  /* Caixinha de 0,5 kg na prateleira de 1 kg: cabem 2 na profundidade de cada metade (9 + 9 = 18 cm),
     então ela usa as 4 posições da 0,5 kg (Trás 02 · Trás 01 · Frente 02 · Frente 01). Cada metade (Trás ou Frente)
     de uma linha/andar é uma coluna só de 1 kg OU só de 0,5 kg — não se empilha uma sobre a outra. */
  // segundo argumento: a embalagem do andar (texto) ou um objeto com .embalagem; '' = andar livre (usa a da amostra)
  const ladosPara = (embAmostra, x) => { const k = typeof x === 'string' ? x : (x && x.embalagem) || ''; const ea = EMBALAGENS[k] ? k : embAmostra;
    return (ea === 'CX1' && embAmostra === 'CX05') ? EMBALAGENS.CX05.lados : (EMBALAGENS[ea] || EMBALAGENS[embAmostra]).lados; };
  const metadeLado = l => String(l || '').charAt(0);
  const ehSubLado = l => String(l || '').length === 2;
  /* Ocupação por ESPAÇO de 0,5 kg (9 × 9 × 9 cm): na profundidade de cada metade cabem 2 espaços
     (Trás 02 + Trás 01 · Frente 02 + Frente 01). A caixinha de 1 kg (Trás/Frente) ocupa os 2 espaços da metade;
     a de 0,5 kg ocupa 1. Assim uma de 1 kg pode ir em cima de duas de 0,5 kg, e uma de 0,5 kg em cima de uma de 1 kg. */
  const SUB_ORD = { T2: 0, T: 0, T1: 1, F2: 2, F: 2, F1: 3 };
  const ordemEndereco = s => ((Number(s.linha) * 4 + (SUB_ORD[s.lado] != null ? SUB_ORD[s.lado] : 0)) * 100) + Number(s.altura);
  const celulasLado = l => l === 'T' ? ['T2', 'T1'] : l === 'F' ? ['F2', 'F1'] : [l];
  const chaveCel = (s, c, h) => [s.prateleira, s.andar, s.linha, c, h].join('-');
  function celulasOcupadas(est) {
    const m = {};
    Object.values(est).forEach(e => { const s = e.slot; if (!s || e.status !== 'ARQUIVO') return; celulasLado(s.lado).forEach(c => { m[chaveCel(s, c, s.altura)] = e; }); });
    return m;
  }
  // '' se a posição está livre e apoiada; senão o motivo
  function checarEspaco(cel, slot, nomeAlt) {
    const cs = celulasLado(slot.lado);
    for (const c of cs) { const o = cel[chaveCel(slot, c, slot.altura)]; if (o) return 'Posição ocupada pela amostra ' + o.protocolo + '.'; }
    if (slot.altura > 1) {
      const falta = cs.filter(c => !cel[chaveCel(slot, c, slot.altura - 1)]);
      if (falta.length) { let h = 1; while (h < slot.altura && !cs.every(c => !cel[chaveCel(slot, c, h)] && (h === 1 || cel[chaveCel(slot, c, h - 1)]))) h++;
        return 'Não pode: ' + (cs.length > 1 && falta.length < cs.length ? 'falta apoio embaixo de metade da caixinha (' + nomeLado(falta[0]) + ' na altura ' + nomeAlt(slot.altura - 1) + ' está vazia)' : 'a posição abaixo (' + nomeAlt(slot.altura - 1) + ') está vazia') + '; precisa ficar apoiada.' + (h < slot.altura ? ' Use a altura ' + nomeAlt(h) + ' desta pilha.' : ' Preencha primeiro o espaço vazio embaixo.'); }
    }
    return '';
  }
  const nomeEmbAceitas = e => e === 'CX05' ? 'Caixinha 0,5 kg ou 1 kg' : nomeEmb(e);
  const nomeEmb = k => k === 'MISTO' ? 'Misto' : k === '' ? 'Livre' : (EMBALAGENS[k] || {}).nome || k || '—';
  const capLinha = k => { const e = EMBALAGENS[k]; return e ? e.lados.length * e.alturas : 0; };
  // linhas por andar: 15 por padrão nas caixinhas; algumas prateleiras só comportam 14 (definido no cadastro)
  const LINHAS_OPCOES = { CX1: [14, 15], CX05: [14, 15] };
  const nLinhas = (k, lin) => { const e = EMBALAGENS[k]; return e ? (LINHAS_OPCOES[k] && Number(lin) > 0 ? Number(lin) : e.linhas) : 0; };
  /* ---------- Embalagem por ANDAR ----------
     Cada andar tem a sua embalagem (caixinha 1 kg, 0,5 kg ou saco kraft) ou é "livre" (assume a da 1ª amostra).
     pr.andares = "CX1,CX1,KRAFT,KRAFT" (A.01..A.04); sem esse campo, vale pr.embalagem nos 4 andares (prateleiras antigas). */
  const EMB_CODIGOS = ['CX1', 'CX05', 'KRAFT'];
  function andaresDe(pr) {
    if (!pr) return ['', '', '', ''];
    let a = pr.andares; if (typeof a === 'string') a = a ? a.split(',') : null;
    if (Array.isArray(a) && a.length) return [0, 1, 2, 3].map(i => EMB_CODIGOS.indexOf(String(a[i] || '').trim()) >= 0 ? String(a[i]).trim() : '');
    const e = EMB_CODIGOS.indexOf(pr.embalagem) >= 0 ? pr.embalagem : ''; return [e, e, e, e];
  }
  const resumoEmb = arr => { const u = [...new Set(arr)]; return u.length === 1 && u[0] ? u[0] : 'MISTO'; };
  // embalagem do andar; se for livre e houver estado, a da primeira amostra do andar ('' = livre e vazio)
  function embAndar(pr, a, est) {
    const f = andaresDe(pr)[a - 1]; if (f || !est || !pr) return f;
    for (const e of Object.values(est)) { const s = e.slot; if (s && (e.status === 'ARQUIVO' || e.status === 'SALA') && Number(s.prateleira) === Number(pr.numero) && s.andar === a) return e.embalagem || ''; }
    return '';
  }
  // resumo para exibir: embalagem única, 'MISTO' ou '' (todos os andares livres e vazios)
  const embPrat = (pr, est) => { const arr = [1, 2, 3, 4].map(a => embAndar(pr, a, est)); return arr.every(k => !k) ? '' : resumoEmb(arr); };
  function dimAndar(pr, a, est, padrao) { const k = embAndar(pr, a, est) || padrao || ''; const e = EMBALAGENS[k]; return e ? Object.assign({}, e, { codigo: k, linhas: nLinhas(k, pr.linhas) }) : null; }
  const dimPrat = (pr, a, est) => dimAndar(pr, a || 1, est, 'CX1');
  const temCaixinha = pr => andaresDe(pr).some(k => !k || LINHAS_OPCOES[k]);
  const capAndar = (k, lin) => nLinhas(k, lin) * capLinha(k);
  const capPrateleira = (k, lin) => capAndar(k, lin) * ANDARES;
  const capAndarPr = (pr, a, est) => { const k = embAndar(pr, a, est); return k ? capAndar(k, pr.linhas) : 0; };
  const capPrat = (pr, est) => [1, 2, 3, 4].reduce((s, a) => s + capAndarPr(pr, a, est), 0);
  // para exibir ocupação: andar livre e vazio conta como caixinha de 1 kg (a capacidade real só se define com a 1ª amostra)
  const capAndarEst = (pr, a, est) => capAndar(embAndar(pr, a, est) || 'CX1', pr.linhas);
  const capEst = (pr, est) => [1, 2, 3, 4].reduce((s, a) => s + capAndarEst(pr, a, est), 0);
  const nomeLado = l => ({ T: 'Trás', F: 'Frente', T1: 'Trás 01', T2: 'Trás 02', F1: 'Frente 01', F2: 'Frente 02' })[l] || l;
  const nomeAltura = (k, h) => (EMBALAGENS[k] && EMBALAGENS[k].letras) ? String.fromCharCode(64 + h) : String(h).padStart(2, '0');
  const p2 = n => String(n).padStart(2, '0');
  const chaveSlot = s => [s.prateleira, s.andar, s.linha, s.lado, s.altura].join('-');
  function textoSlot(s, emb) {
    if (!s || !s.prateleira) return '';
    return 'P.' + p2(s.prateleira) + ' | A.' + p2(s.andar) + ' | L.' + p2(s.linha) + ' · ' + nomeLado(s.lado) + ' · ' + nomeAltura(emb, s.altura);
  }
  // ordem de preenchimento: andar 1→4, linha 1→N, do fundo para a frente (Trás antes da Frente), de baixo para cima
  function* ordemSlots(prateleira, emb, lin, so) {
    const e = EMBALAGENS[emb]; if (!e) return; const nl = nLinhas(emb, lin);
    for (let a = so || 1; a <= (so || ANDARES); a++) for (let l = 1; l <= nl; l++) for (const lado of e.lados) for (let h = 1; h <= e.alturas; h++)
      yield { prateleira: prateleira, andar: a, linha: l, lado: lado, altura: h };
  }

  /* ---------- Estado atual a partir dos movimentos ----------
     Ações: ARMAZENAR (entra/volta no arquivo), SALA (sai para uma sala; a posição é liberada — as caixinhas de cima descem),
            RETORNO (registros antigos: volta para a posição anterior), REMANEJAR (muda de posição; também usado quando a caixinha desce
            sozinha porque a de baixo foi retirada), BAIXA (sai do arquivo; libera),
            REGISTRO (só registra: amostra que não armazena) */
  const SALAS = ['Sala de análise', 'Sala de montagem', 'Sala de tratamento de sementes', 'Sala de homogeneização de sementes'];
  function estadoAtual(movs) {
    const est = {}, pulos = {};
    // pulos de endereço confirmados pelo operador: a sequência do andar segue a partir daquela posição
    Object.defineProperty(est, '_pulos', { value: pulos, enumerable: false });
    movs.slice().sort((a, b) => a.ts - b.ts || String(a.id).localeCompare(String(b.id))).forEach(m => {
      if (m.situacao && /^Conflito|^Excluíd/.test(m.situacao)) return;
      const p = m.protocolo; if (!p) return;
      const e = est[p] || (est[p] = { protocolo: p, slot: null, local: '', primeiro: m.ts, historico: 0 });
      e.historico++;
      ['especie', 'cultivar', 'lote', 'produtor', 'tipoAnalise', 'remessa', 'tratamento', 'classificacao', 'embalagem', 'categoria'].forEach(k => { if (m[k]) e[k] = m[k]; });
      e.ultimo = m.ts; e.ultimoMov = m.acao; e.usuario = m.usuario; e.fotoUrl = m.fotoUrl || e.fotoUrl;
      if (m.acao === 'ARMAZENAR' || m.acao === 'REMANEJAR' || m.acao === 'RETORNO') {
        if (m.prateleira) {
          // registros antigos: caixinha 0,5 kg gravada como "Trás"/"Frente" (formato de 1 kg) → posição de 0,5 kg (Trás 02 = fundo, Frente 01 = frente)
          let lado = m.lado; if ((m.embalagem || e.embalagem) === 'CX05' && (lado === 'T' || lado === 'F')) lado = lado === 'T' ? 'T2' : 'F1';
          e.slot = { prateleira: Number(m.prateleira), andar: Number(m.andar), linha: Number(m.linha), lado: lado, altura: Number(m.altura) };
          if (/^Pulou endereços/.test(m.obs || '')) pulos[e.slot.prateleira + '-' + e.slot.andar] = { slot: e.slot, ts: m.ts, ordem: ordemEndereco(e.slot) };
        }
        e.local = 'Arquivo refrigerado'; e.status = 'ARQUIVO'; e.desde = m.ts;
      } else if (m.acao === 'SALA') { if (e.slot) e.slotAnterior = e.slot; e.slot = null; e.local = m.destino; e.status = 'SALA'; e.desde = m.ts; }
      else if (m.acao === 'BAIXA') { e.local = 'Baixada'; e.status = 'BAIXA'; e.slot = null; e.desde = m.ts; }
      else if (m.acao === 'REGISTRO') { if (!e.status) { e.local = 'Registrada (não armazena)'; e.status = 'REGISTRO'; e.desde = m.ts; } }
    });
    return est;
  }
  // posições ocupadas (amostras no arquivo)
  function ocupacao(est) {
    const occ = {};
    Object.values(est).forEach(e => { if (e.slot && (e.status === 'ARQUIVO' || e.status === 'SALA')) occ[chaveSlot(e.slot)] = e; });
    return occ;
  }
  /* Perfil de cada ANDAR = perfil das amostras que estão nele (cultura, tratamento, INOVA e grupo de remessa).
     Uma prateleira pode ter perfis diferentes em andares diferentes; o mesmo andar nunca mistura perfis.
     x.perfil = perfil do primeiro andar ocupado (só para exibição); x.andares[a] = { perfil, usadas }; x.perfis = perfis distintos. */
  function perfisPrateleiras(est, prateleiras) {
    const r = {}, novo = pr => ({ prateleira: pr, perfil: null, usadas: 0, amostras: [], andares: { 1: { perfil: null, usadas: 0 }, 2: { perfil: null, usadas: 0 }, 3: { perfil: null, usadas: 0 }, 4: { perfil: null, usadas: 0 } }, perfis: [] });
    (prateleiras || []).forEach(pr => { r[pr.numero] = novo(pr); });
    Object.values(est).forEach(e => {
      if (!e.slot || !(e.status === 'ARQUIVO' || e.status === 'SALA')) return;
      const k = e.slot.prateleira; const pr = r[k] || (r[k] = novo({ numero: k, embalagem: e.embalagem, situacao: 'Ativa' }));
      const an = pr.andares[e.slot.andar] || (pr.andares[e.slot.andar] = { perfil: null, usadas: 0 });
      if (!an.perfil) { an.emb = andaresDe(pr.prateleira)[e.slot.andar - 1] || e.embalagem || ''; an.perfil = perfil(e, an.emb); }
      an.usadas++; pr.usadas++; pr.amostras.push(e);
    });
    Object.values(r).forEach(pr => {
      [1, 2, 3, 4].forEach(a => { const p = pr.andares[a] && pr.andares[a].perfil; if (p) { if (!pr.perfil) pr.perfil = p; if (!pr.perfis.some(x => chavePerfil(x) === chavePerfil(p))) pr.perfis.push(p); } });
    });
    return r;
  }
  /* Sugere a posição para uma amostra respeitando as regras.
     Prioridade: andar já com o mesmo perfil (continua a sequência) → andar vazio (da própria embalagem primeiro). */
  function sugerirPosicao(amostra, embalagem, est, prateleiras, excetoProt) {
    const pulos = (est && est._pulos) || {};
    const ests = Object.assign({}, est); if (excetoProt) delete ests[excetoProt];
    const cel = celulasOcupadas(ests), pp = perfisPrateleiras(ests, prateleiras);
    // andares que aceitam esta embalagem: os da própria embalagem primeiro, depois os livres, depois (0,5 kg) os de 1 kg
    const cands = [];
    (prateleiras || []).filter(p => p.situacao !== 'Inativa').forEach(pr => { for (let a = 1; a <= ANDARES; a++) {
      const ea = embAndar(pr, a, ests); if (ea && !cabeNa(embalagem, ea)) continue; cands.push({ pr, a, ea }); } });
    const rank = c => c.ea === embalagem ? 0 : c.ea === '' ? 1 : 2;
    cands.sort((x, y) => rank(x) - rank(y) || x.pr.numero - y.pr.numero || x.a - y.a);
    const livre = c => { const k = c.ea || embalagem, emb = (k === 'CX1' && embalagem === 'CX05') ? 'CX05' : k;
      // se o operador pulou endereços neste andar (e o andar tem amostras), a sugestão segue a partir do pulo; os pulados só voltam quando o resto do andar encher
      const pl = pulos[c.pr.numero + '-' + c.a], ini = pl && perfilAndar(c) ? pl.ordem : -1;
      let antes = null;
      for (const s of ordemSlots(c.pr.numero, emb, c.pr.linhas, c.a)) if (!checarEspaco(cel, s, h => nomeAltura(k, h))) { if (ordemEndereco(s) > ini) return s; if (!antes) antes = s; }
      return antes; };
    const obs = c => c.ea === 'CX1' && embalagem === 'CX05' ? ' (caixinha de 0,5 kg em andar de 1 kg)' : c.ea === '' ? ' (andar livre: passa a ser de ' + nomeEmb(embalagem) + ')' : '';
    const perfilAndar = c => { const x = pp[c.pr.numero]; return x && x.andares[c.a] ? x.andares[c.a].perfil : null; };
    // 1º: andar que já tem o mesmo perfil (continua a sequência)
    for (const c of cands) { const pa = perfilAndar(c);
      if (pa && chavePerfil(pa) === chavePerfil(perfil(amostra, c.ea || embalagem))) { const s = livre(c); if (s) return { slot: s, embPrat: c.ea || embalagem, motivo: 'Continua a sequência do andar A.' + p2(c.a) + ' da prateleira ' + p2(c.pr.numero) + obs(c) }; } }
    // 2º: andar vazio (passa a ser deste perfil)
    for (const c of cands) { if (perfilAndar(c)) continue;
      const s = livre(c); if (s) return { slot: s, embPrat: c.ea || embalagem, motivo: 'Andar A.' + p2(c.a) + ' da prateleira ' + p2(c.pr.numero) + ' livre (passa a ser deste perfil)' + obs(c) }; }
    return { slot: null, motivo: cands.length ? 'Nenhum andar de ' + nomeEmbAceitas(embalagem) + ' livre para este perfil. Cadastre uma nova prateleira (ou um andar desta embalagem).' : 'Nenhum andar de ' + nomeEmbAceitas(embalagem) + ' cadastrado.' };
  }
  // endereços livres do mesmo andar que ficam para trás ao emblocar em "slot" (desde o último pulo, se houver)
  function enderecosPulados(embalagem, slot, est, prateleiras, excetoProt) {
    const pr = (prateleiras || []).find(p => Number(p.numero) === Number(slot.prateleira)); if (!pr) return [];
    const ests = Object.assign({}, est); if (excetoProt) delete ests[excetoProt];
    const cel = celulasOcupadas(ests), k = embAndar(pr, slot.andar, ests) || embalagem, emb = (k === 'CX1' && embalagem === 'CX05') ? 'CX05' : k;
    const temAmostra = Object.values(ests).some(e => e.slot && e.status === 'ARQUIVO' && e.slot.prateleira === Number(pr.numero) && e.slot.andar === slot.andar);
    const pl = ((est && est._pulos) || {})[pr.numero + '-' + slot.andar], ini = pl && temAmostra ? pl.ordem : -1, alvo = ordemEndereco(slot);
    const out = [];
    for (const s of ordemSlots(pr.numero, emb, pr.linhas, slot.andar)) { const o = ordemEndereco(s); if (o >= alvo) break; if (o <= ini) continue;
      if (celulasLado(s.lado).every(c => !cel[chaveCel(s, c, s.altura)])) out.push(s); }
    return out;
  }
  // texto curto dos endereços pulados, ex.: "L.01: Trás D–E, Frente A–E"
  function textoPulados(lista, emb) {
    const porLinha = [];
    lista.forEach(s => { let l = porLinha.find(x => x.linha === s.linha); if (!l) porLinha.push(l = { linha: s.linha, lados: [] });
      let d = l.lados.find(x => x.lado === s.lado); if (!d) l.lados.push(d = { lado: s.lado, h: [] }); d.h.push(s.altura); });
    const faixa = h => { h.sort((a, b) => a - b); const n = x => nomeAltura(emb, x); return h.length === 1 ? n(h[0]) : n(h[0]) + '–' + n(h[h.length - 1]); };
    return porLinha.map(l => 'L.' + p2(l.linha) + ': ' + l.lados.map(d => nomeLado(d.lado) + ' ' + faixa(d.h)).join(', ')).join(' · ');
  }
  // confere se uma posição escolhida à mão respeita as regras
  function validarPosicao(amostra, embalagem, slot, est, prateleiras, excetoProt) {
    if (ehPureza(amostra.protocolo) && embalagem !== 'KRAFT') return ['Pureza vai sempre em saco kraft.'];
    const pr = (prateleiras || []).find(p => Number(p.numero) === Number(slot.prateleira));
    if (!pr) return ['Prateleira ' + slot.prateleira + ' não cadastrada.'];
    if (pr.situacao === 'Inativa') return ['Prateleira ' + p2(pr.numero) + ' está inativa.'];
    if (!(slot.andar >= 1 && slot.andar <= ANDARES)) return ['Posição fora da capacidade da prateleira.'];
    const ests = Object.assign({}, est); if (excetoProt) delete ests[excetoProt];
    const ea = embAndar(pr, slot.andar, ests);
    if (ea && !cabeNa(embalagem, ea)) return ['O andar A.' + p2(slot.andar) + ' da prateleira ' + p2(pr.numero) + ' é de ' + nomeEmb(ea) + '.'];
    const k = ea || embalagem, e = Object.assign({}, EMBALAGENS[k], { linhas: nLinhas(k, pr.linhas) });
    if (!(slot.linha >= 1 && slot.linha <= e.linhas && ladosPara(embalagem, k).indexOf(slot.lado) >= 0 && slot.altura >= 1 && slot.altura <= e.alturas)) return ['Posição fora da capacidade do andar.'];
    const msg = checarEspaco(celulasOcupadas(ests), slot, h => nomeAltura(k, h)); if (msg) return [msg];
    const x = perfisPrateleiras(ests, prateleiras)[pr.numero], pa = x && x.andares[slot.andar] && x.andares[slot.andar].perfil;
    if (pa) { const m = motivosIncompat(perfil(amostra, k), pa); if (m.length) return m.map(t => 'Não pode: ' + t + '.'); }
    return [];
  }

  /* Gravidade: depois de uma retirada, as caixinhas/sacos de cima descem e a pilha fica sem buracos.
     Recebe o estado JÁ com a retirada aplicada e um endereço da pilha; devolve quem muda de altura. */
  const chavePilha = s => [s.prateleira, s.andar, s.linha, String(s.lado).charAt(0)].join('-');
  function descerPilha(est, ref) {
    if (!ref || !ref.prateleira) return [];
    const k = chavePilha(ref);
    const pilha = Object.values(est).filter(e => e.slot && e.status === 'ARQUIVO' && chavePilha(e.slot) === k).sort((a, b) => a.slot.altura - b.slot.altura);
    // cada caixinha desce enquanto TODOS os espaços logo abaixo dela estiverem vazios (de baixo para cima)
    const alt = new Map(pilha.map(e => [e, e.slot.altura])), ocup = (c, h, eu) => pilha.some(o => o !== eu && alt.get(o) === h && celulasLado(o.slot.lado).includes(c));
    pilha.forEach(e => { const cs = celulasLado(e.slot.lado); let h = alt.get(e); while (h > 1 && cs.every(c => !ocup(c, h - 1, e))) h--; alt.set(e, h); });
    return pilha.filter(e => alt.get(e) !== e.slot.altura).map(e => ({ e, de: e.slot, para: Object.assign({}, e.slot, { altura: alt.get(e) }) }));
  }

  /* Amostras que estão no arquivo mas não respeitam as regras atuais (ex.: emblocadas antes de uma regra nova):
     perfil diferente do perfil do andar, ou sem apoio embaixo. Nada é movido sozinho: serve para remanejar. */
  function foraDaRegra(est, prateleiras) {
    const pp = perfisPrateleiras(est, prateleiras), cel = celulasOcupadas(est), out = [];
    Object.values(est).forEach(e => {
      if (!e.slot || e.status !== 'ARQUIVO') return;
      const pr = (prateleiras || []).find(p => Number(p.numero) === Number(e.slot.prateleira)), x = pp[e.slot.prateleira];
      const pa = x && x.andares[e.slot.andar] && x.andares[e.slot.andar].perfil, m = [];
      if (pa) motivosIncompat(perfil(e, (pr && embAndar(pr, e.slot.andar, est)) || e.embalagem), pa).forEach(t => m.push(t));
      if (e.slot.altura > 1 && celulasLado(e.slot.lado).some(c => !cel[chaveCel(e.slot, c, e.slot.altura - 1)])) m.push('sem caixinha embaixo (sem apoio)');
      if (m.length) out.push({ e, motivos: m, perfilAndar: pa });
    });
    return out.sort((a, b) => a.e.slot.prateleira - b.e.slot.prateleira || a.e.slot.andar - b.e.slot.andar || a.e.slot.linha - b.e.slot.linha);
  }

  /* ---------- Etiqueta da linha ---------- */
  // agrupa protocolos em faixas de sequência: [13931], [13961-13964]
  function faixas(prots) {
    const ordT = { S: 0, M: 1, P: 2 };
    const ps = prots.slice().sort((a, b) => ordT[tipoItem(a)] - ordT[tipoItem(b)] || protAno(a) - protAno(b) || protNum(a) - protNum(b));
    const out = []; let ini = null, ant = null;
    ps.forEach(p => {
      if (ant && tipoItem(p) === tipoItem(ant) && protAno(p) === protAno(ant) && protNum(p) === protNum(ant) + 1) { ant = p; return; }
      if (ini) out.push([ini, ant]); ini = p; ant = p;
    });
    if (ini) out.push([ini, ant]);
    const fmt = p => (ehManual(p) ? 'M ' : '') + milhar(protNum(p)) + (ehPureza(p) ? ' (P)' : '');
    return out.map(([a, b]) => a === b ? fmt(a) : fmt(a) + ' - ' + fmt(b));
  }
  function etiquetaLinha(est, prateleira, andar, linha) {
    const am = Object.values(est).filter(e => e.slot && (e.status === 'ARQUIVO' || e.status === 'SALA') && e.slot.prateleira === Number(prateleira) && e.slot.andar === Number(andar) && e.slot.linha === Number(linha));
    const titulo = [];
    am.slice().sort((a, b) => protNum(a.protocolo) - protNum(b.protocolo)).forEach(e => {
      const t = ehPureza(e.protocolo) ? 'PUREZA' : /DEFINITIVA/.test(up(e.tipoAnalise)) ? 'DEFINITIVA' : (String(e.remessa || '').toUpperCase().trim() || (e.classificacao === 'Protocolo' ? 'PROTOCOLO' : 'AMOSTRA MANUAL'));
      if (titulo.indexOf(t) < 0) titulo.push(t);
    });
    const tras = am.filter(e => /^T/.test(e.slot.lado)).map(e => e.protocolo);
    const frente = am.filter(e => /^F/.test(e.slot.lado)).map(e => e.protocolo);
    // linha com caixinhas de 0,5 kg: 4 colunas na ordem física (Trás 02 · Trás 01 · Frente 02 · Frente 01);
    // caixinhas de 1 kg da mesma linha vão numa faixa "1 kg" que atravessa as 2 colunas da metade
    const sub = am.some(e => String(e.slot.lado).length === 2);
    const quartos = sub ? {
      T2: faixas(am.filter(e => e.slot.lado === 'T2').map(e => e.protocolo)), T1: faixas(am.filter(e => e.slot.lado === 'T1').map(e => e.protocolo)),
      F2: faixas(am.filter(e => e.slot.lado === 'F2').map(e => e.protocolo)), F1: faixas(am.filter(e => e.slot.lado === 'F1').map(e => e.protocolo)),
      kgT: faixas(am.filter(e => e.slot.lado === 'T').map(e => e.protocolo)), kgF: faixas(am.filter(e => e.slot.lado === 'F').map(e => e.protocolo))
    } : null;
    return { titulo: titulo.join(' / ') || '—', codigo: 'P. ' + p2(prateleira) + ' | A. ' + p2(andar) + ' | L. ' + p2(linha), tras: faixas(tras), frente: faixas(frente), quartos, total: am.length };
  }

  /* ---------- Planilhas de referência (sistema e manual) ---------- */
  const COLS_REF = {
    'NUMERO DA AMOSTRA': 'prot', 'DATA DO RECEBIMENTO': 'data', 'REMETENTE/SAFRA': 'safra', 'ESPECIE': 'especie', 'CULTIVAR': 'cultivar',
    'CATEGORIA': 'categoria', 'PENEIRA': 'peneira', 'REPRESENTATIVIDADE (SC OU KG/LOTE)': 'repres', 'LOTE/ORIGEM': 'lote', 'PRODUTOR': 'produtor',
    'OBSERVACAO': 'obs', 'TIPOANALISE': 'tipoAnalise', 'ANALISES_ABERTAS': 'abertas', 'TIPO REMESSA': 'remessa', 'TRATAMENTO': 'tratamento',
    'PROCEDENCIA/UF': 'procedencia'
  };
  const CAMPOS_REF = ['prot', 'data', 'especie', 'cultivar', 'categoria', 'peneira', 'lote', 'produtor', 'tipoAnalise', 'remessa', 'tratamento', 'safra', 'repres', 'abertas', 'obs', 'procedencia', 'origem'];
  // converte as linhas lidas da planilha (array de arrays, 1ª linha = cabeçalho)
  function lerPlanilhaRef(linhas, origem) {
    if (!linhas || !linhas.length) return [];
    let hi = linhas.findIndex(r => (r || []).some(c => up(c) === 'NUMERO DA AMOSTRA'));
    if (hi < 0) throw new Error('Não encontrei a coluna "Número da Amostra". Use a planilha exportada do sistema.');
    const cab = linhas[hi].map(c => COLS_REF[up(c)] || null);
    const out = [];
    for (let i = hi + 1; i < linhas.length; i++) {
      const r = linhas[i] || [], o = { origem: origem };
      cab.forEach((k, j) => { if (!k) return; let v = r[j]; if (v == null) v = ''; v = String(v).trim(); if (v === '-o-' || v === 'nan' || v === 'NaN') v = ''; o[k] = v; });
      o.prot = normProt(o.prot);
      if (!o.prot) continue;
      o.especie = up(o.especie);
      out.push(o);
    }
    return out;
  }
  /* Planilha MANUAL ("TESTES - ENTRADAS MANUAIS"): uma aba por espécie, cabeçalho "Protocolo LASDM".
     Os protocolos viram "M<n>/<ano>". Abas ignoradas: experimento (numeração própria), cópias e etiquetas.
     Recebe [{ nome, linhas }] (todas as abas). Devolve { linhas, avisos }. */
  const COLS_MAN = {
    'PROTOCOLO LASDM': 'prot', 'DATA PROT. LASDM': 'data', 'TIPO DE REMESSA': 'remessa', 'SOLICITANTE': 'produtor', 'TESTES SOLICITADOS': 'abertas',
    'ESPECIE': 'especie', 'SAFRA': 'safra', 'CULTIVAR': 'cultivar', 'HIBRIDO': 'cultivar', 'LOTE': 'lote', 'LOTE/PRE-LOTE': 'lote', 'CATEGORIA': 'categoria',
    'PENEIRA': 'peneira', 'REPRESENTATIVIDADE': 'repres', 'PESO LOTE (KG)': 'repres', 'OBSERVACAO': 'obs', 'OBS': 'obs'
  };
  function especieManual(v, aba) {
    const t = up(v) + ' ' + up(aba);
    return /SOJA/.test(t) ? 'SOJA' : /MILHO|ZEA/.test(t) ? 'MILHO' : /TRIGO|TRITICUM/.test(t) ? 'TRIGO' : /FEIJ/.test(t) ? 'FEIJÃO' : up(v);
  }
  function remessaManual(v) {
    const t = up(v).replace(/\s*-\s*/g, ' ').replace(/\s+/g, ' ').trim();
    if (!t || t === '-') return '';
    if (/^PRE ?LOTE/.test(t)) return 'PRE LOTE';
    if (/^LOTE/.test(t)) return 'LOTE';
    if (/^TESTE/.test(t)) return 'TESTE';
    if (/^ENTRADA/.test(t)) return 'ENTRADA SEMENTE';
    if (/^DEVOLU/.test(t)) return 'DEVOLUÇÕES';
    if (/^REVALIDA/.test(t)) return 'REVALIDAÇÃO';
    if (/^REEMBALA/.test(t)) return 'REEMBALAGEM';
    return t;
  }
  const ehPlanilhaManual = abas => abas.some(a => (a.linhas || []).some(r => (r || []).some(c => up(c) === 'PROTOCOLO LASDM')));
  function lerPlanilhaManual(abas) {
    const avisos = [], porProt = {}, ignoradas = [];
    abas.forEach(({ nome, linhas }) => {
      const N = up(nome);
      if (/EXPERIMENTO|^PLANILHA\d|ETIQUETA|SEQUENCIAL/.test(N)) { if (!/SEQUENCIAL/.test(N)) ignoradas.push(nome); return; }
      const hi = (linhas || []).findIndex(r => (r || []).some(c => up(c) === 'PROTOCOLO LASDM'));
      if (hi < 0) return;
      const cab = linhas[hi].map(c => COLS_MAN[up(c)] || null);
      for (let i = hi + 1; i < linhas.length; i++) {
        const r = linhas[i] || [], o = { origem: 'Manual', aba: nome };
        cab.forEach((k, j) => { if (!k || o[k]) return; let v = r[j]; v = v == null ? '' : String(v).trim(); if (v === '-' || v === '-o-') v = ''; o[k] = v; });
        const n = normProt(o.prot); if (!n) continue;
        o.prot = 'M' + protBase(n).replace(/^M/i, '');
        o.especie = especieManual(o.especie, nome);
        o.remessa = remessaManual(o.remessa);
        if (/INOVA/.test(N)) o.produtor = 'INOVA GENÉTICA';
        (porProt[o.prot] = porProt[o.prot] || []).push(o);
      }
    });
    // aba SEQUENCIAL: só completa protocolos que não estão nas abas de espécie
    const seq = abas.find(a => /SEQUENCIAL/.test(up(a.nome)));
    if (seq) { const hi = seq.linhas.findIndex(r => up((r || [])[0]) === 'PROTOCOLO');
      if (hi >= 0) for (let i = hi + 1; i < seq.linhas.length; i++) { const r = seq.linhas[i] || [], n = normProt(r[0]); if (!n) continue; const pm = 'M' + protBase(n);
        if (!porProt[pm]) porProt[pm] = [{ origem: 'Manual', aba: seq.nome, prot: pm, especie: especieManual(r[1], ''), produtor: /INOVA/.test(up(r[1])) ? 'INOVA GENÉTICA' : String(r[2] || '').trim(), remessa: '', cultivar: '' }]; } }
    const linhasOut = [];
    Object.keys(porProt).forEach(k => {
      const v = porProt[k];
      if (v.length === 1) { linhasOut.push(v[0]); return; }
      // mesmo número em abas diferentes: junta os dados e marca para conferência
      const o = Object.assign({}, v[0]);
      ['especie', 'cultivar', 'lote', 'remessa', 'produtor', 'data'].forEach(c => { const vs = [...new Set(v.map(x => x[c]).filter(Boolean))]; o[c] = vs.join(' / '); });
      o.obs = 'NÚMERO REPETIDO na planilha manual: abas ' + v.map(x => x.aba).join(' e ');
      o.aba = v.map(x => x.aba).join(' + ');
      linhasOut.push(o); avisos.push(k.replace(/^M/, 'M ') + ' (' + v.map(x => x.aba.replace(/^ESP[EÉ]CIE - |^H[IÍ]BRIDO - /i, '')).join(' e ') + ')');
    });
    linhasOut.sort((a, b) => protAno(a.prot) - protAno(b.prot) || protNum(a.prot) - protNum(b.prot));
    return { linhas: linhasOut, avisos, ignoradas };
  }
  // une referências: a mais nova (ou a manual) sobrescreve a anterior do mesmo protocolo
  function unirRef(listas) {
    const m = {};
    // mesma origem (planilha reenviada): a linha nova substitui a antiga inteira (some, p.ex., um aviso de número repetido já corrigido)
    listas.forEach(l => (l || []).forEach(r => { const a = m[r.prot]; m[r.prot] = a && a.origem === r.origem ? Object.assign({}, r) : Object.assign({}, a || {}, r); }));
    return Object.values(m).sort((a, b) => protAno(a.prot) - protAno(b.prot) || protNum(a.prot) - protNum(b.prot));
  }
  const dataRefKey = d => { const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(d || ''); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; };

  /* ---------- Leitura do texto da etiqueta (OCR) ----------
     Modelo: "Prot: 17215/2026 · Rem.: 7046 · O720 I2X · TESTE" (texto na vertical ao lado do QR) */
  function lerEtiquetaTexto(txt) {
    const t = String(txt || '').replace(/\r/g, '');
    const l = t.split('\n').map(s => s.trim()).filter(Boolean);
    const res = { prot: '', rem: '', cultivar: '', remessa: '' };
    const mm = /(?:^|\n|\s)M\s*[-.]?\s*(\d{1,6})\s*\/\s*(20\d{2}|\d{2})(?!\d)/.exec(t);
    const mp = /pr[o0]t\.?\s*[:;.]?\s*([\dOIlS.\s]{1,9}\s*\/\s*(?:2[0O]\d{2}|\d{2}))(?!\d)/i.exec(t) || /(\d{1,3}[.]?\d{0,3}\s*\/\s*20\d{2})/.exec(t);
    res.pureza = /PUREZA/.test(up(t));
    if (mm && !res.pureza) { res.prot = 'M' + limpaNum(mm[1]) + '/' + ano4(mm[2]); res.manual = true; }
    else if (mp) res.prot = normProt(mp[1].replace(/[Oo]/g, '0').replace(/[Il]/g, '1').replace(/S/g, '5'));
    else {
      // ano borrado na foto ("Prot: 13432/202%"): aproveita o número e assume o ano atual
      const mq = /pr[o0]t\.?\s*[:;.]?\s*([\dOIlS.]{3,7})\s*\/\s*2\S{0,3}/i.exec(t);
      if (mq) { res.prot = normProt(mq[1].replace(/[Oo]/g, '0').replace(/[Il]/g, '1').replace(/S/g, '5').replace(/\./g, '')); res.anoIncerto = true; }
    }
    const mr = /rem\.?\s*[:;.]?\s*([\dOIl]{1,8})/i.exec(t); if (mr) res.rem = mr[1].replace(/[Oo]/g, '0').replace(/[Il]/g, '1');
    // tipo de remessa: procura os nomes conhecidos
    const T = up(t).replace(/[^A-Z0-9 \n]/g, ' ');
    const achados = TIPOS_REMESSA.map(x => up(x)).filter(x => new RegExp('\\b' + x.replace(/ /g, '\\s*') + '\\b').test(T)).sort((a, b) => b.length - a.length);
    if (achados.length) res.remessa = achados[0];
    // cultivar: entre as linhas depois de "Rem.", a que mais parece um código de cultivar (letras + números, ex.: CZ37B39I2X, O720 I2X)
    const ir = l.findIndex(x => /rem\.?/i.test(x));
    const cands = (ir >= 0 ? l.slice(ir + 1) : l).filter(x => !/pr[o0]t|rem\./i.test(x) && !achados.some(a => up(x).replace(/[^A-Z ]/g, '').trim() === a));
    let melhor = '', nota = 0;
    cands.forEach(x => {
      const tk = up(x).replace(/[|!]/g, 'I').split(' ').map(t => t.replace(/[^A-Z0-9]/g, '')).filter(Boolean);
      while (tk.length > 1 && tk[0].length <= 2) tk.shift();
      const c = tk.join(' '), so = c.replace(/ /g, '');
      const n = (/\d/.test(so) ? 2 : 0) + (/[A-Z]/.test(so) ? 1 : 0) + (so.length >= 4 ? 1 : 0) + (so.length >= 6 ? 1 : 0) + (/(I2X|IPRO|CE|E3|RR|VIP|PRO\d)$/.test(corrigirCultivar(c).replace(/ /g, '')) ? 2 : 0);
      if (n > nota) { nota = n; melhor = c; }
    });
    if (nota >= 3 && !res.manual && !res.pureza) res.cultivar = corrigirCultivar(melhor);
    if (res.manual) {
      const ESP = ['SOJA', 'MILHO', 'FEIJAO', 'TRIGO', 'SORGO', 'ARROZ', 'AVEIA', 'GIRASSOL', 'ALGODAO', 'CEVADA', 'CANOLA', 'BRAQUIARIA', 'MILHETO', 'CROTALARIA', 'NABO', 'ERVILHA', 'GRAO DE BICO'];
      const linha = l.find(x => /\s-\s|–/.test(x) && !/\/\s*\d/.test(x)) || l.find(x => !/\/\s*\d/.test(x) && /[A-Z]{3,}/i.test(x)) || '';
      linha.split(/\s*[-–]\s*/).map(x => up(x).replace(/[^A-Z ]/g, '').trim()).filter(Boolean).forEach(x => {
        const esp = ESP.find(e => e === x || x.indexOf(e) >= 0); if (esp) { res.especie = esp; return; }
        const rm = TIPOS_REMESSA.find(r => up(r) === x); if (rm) res.remessa = up(rm);
      });
    }
    return res;
  }
  // corrige siglas de tecnologia lidas errado pelo OCR: 12X/l2X → I2X, 1PRO → IPRO
  function corrigirCultivar(c) {
    return up(c).replace(/[1L|!]2X\b/g, 'I2X').replace(/\b([A-Z0-9]*?)[1L|]PRO\b/g, '$1IPRO').replace(/(\d)[1L|]2X$/, '$1I2X').trim();
  }
  // espécie provável pela tecnologia da cultivar (soja: I2X, IPRO, CE, E3, RR; milho: VIP, PRO2/3/4, PW, TL, YH)
  function inferirEspecie(cult) {
    const c = up(cult).replace(/ /g, '');
    if (!c) return '';
    if (/(VIP\d?|PRO[234]|PWU?|TLTG|TL|YHR?|VYHR|H$|TRE)$/.test(c) || /VIP/.test(c)) return 'MILHO';
    if (/(I2X|IPRO|CE|E3|RR|XTD|ENLIST|CONK)$/.test(c) || /I2X|IPRO/.test(c)) return 'SOJA';
    return '';
  }
  // QR das etiquetas (sistema SoftSul): http://site.softsul.agr.br/clients/doismarcos/amostra?codigoamostra=67080
  function codigoQR(txt) {
    const t = String(txt || '').trim(); if (!t) return '';
    const m = /codigoamostra=(\d+)/i.exec(t); if (m) return 'S' + m[1];
    return t.length <= 80 ? t : t.slice(-80);
  }
  // compara o que foi lido na etiqueta com a planilha (tolerante a erros típicos de OCR)
  const formaOcr = s => up(s).replace(/[^A-Z0-9]/g, '').replace(/[1L|I]/g, 'I').replace(/0/g, 'O').replace(/5/g, 'S').replace(/8/g, 'B').replace(/2/g, 'Z');
  function lev(a, b) { const m = a.length, n = b.length; if (!m || !n) return Math.max(m, n); let pr = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) { const cu = [i]; for (let j = 1; j <= n; j++) cu[j] = Math.min(pr[j] + 1, cu[j - 1] + 1, pr[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); pr = cu; } return pr[n]; }
  // true = confere; false = diverge; null = sem leitura. Tolera até ~30% de caracteres trocados pelo OCR.
  function confere(lido, ref) { if (!lido || !ref) return null; const a = formaOcr(lido), b = formaOcr(ref); if (!a || !b) return null;
    if (a === b || b.indexOf(a) >= 0 || a.indexOf(b) >= 0) return true;
    let d = lev(a, b);
    // o OCR costuma trazer sujeira antes/depois: compara também com os trechos do tamanho da referência
    const janela = (a, b) => { let dd = lev(a, b); for (let w = Math.max(1, b.length - 1); w <= b.length + 1; w++) for (let i = 0; i + w <= a.length; i++) dd = Math.min(dd, lev(a.slice(i, i + w), b)); return dd; };
    d = Math.min(d, janela(a, b));
    if (d / b.length <= 0.3) return true;
    // o OCR muitas vezes corta ou embaralha o sufixo da tecnologia (I2X, IPRO…): confere também só o nome-base da cultivar
    const base = b.replace(/(IZX|IPRO|RR|E3|CE|VIP3|PRO[Z34]|PW|TL|YH|VYHR)$/, '');
    if (base !== b && base.length >= 4 && janela(a, base) / base.length <= 0.2) return true;
    return false; }
  // protocolos "vizinhos" de uma leitura (um dígito trocado ou dois dígitos invertidos): para corrigir erro do OCR
  function protVizinhos(prot) {
    const n = String(protNum(prot)), ano = protAno(prot), out = new Set();
    for (let i = 0; i < n.length; i++) for (let dgt = 0; dgt <= 9; dgt++) { const c = n.slice(0, i) + dgt + n.slice(i + 1); if (c !== n && !/^0/.test(c)) out.add(c + '/' + ano); }
    for (let i = 0; i < n.length - 1; i++) { const c = n.slice(0, i) + n[i + 1] + n[i] + n.slice(i + 2); if (c !== n && !/^0/.test(c)) out.add(c + '/' + ano); }
    return [...out];
  }
  // quão provável é o OCR ter lido "lido" no lugar de "cand" (trocas de dígitos parecidos pesam mais)
  const PARES_OCR = ['08', '06', '09', '17', '14', '27', '38', '39', '56', '58', '59', '68', '69', '89', '35', '23'];
  function chanceTroca(lido, cand) {
    const a = String(protNum(lido)), b = String(protNum(cand));
    if (a.length !== b.length) return 0;
    const dif = []; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) dif.push(i);
    if (dif.length === 1) { const par = [a[dif[0]], b[dif[0]]].sort().join(''); return PARES_OCR.indexOf(par) >= 0 ? 2 : 1; }
    if (dif.length === 2 && dif[1] === dif[0] + 1 && a[dif[0]] === b[dif[1]] && a[dif[1]] === b[dif[0]]) return 1.5;
    return 0;
  }
  // a etiqueta "bate" com a referência? (2 = cultivar e remessa conferem, 1 = só uma, 0 = nenhuma, -1 = alguma diverge)
  function notaEtiqueta(lido, ref) { if (!lido || !ref) return 0; const c = confere(lido.cultivar, ref.cultivar), r = confere(lido.remessa, ref.remessa); if (c === false || r === false) return -1; return (c ? 1 : 0) + (r ? 1 : 0); }

  G.LASDM = {
    VERSAO_REGRAS: '2026.10.29b',
    up, normProt, protNum, protAno, milhar, GRUPOS, REMESSA_GRUPO, TIPOS_REMESSA, CULTURAS_PROTOCOLO, classificar, perfil, chavePerfil, textoPerfil, textoAndares, motivosIncompat,
    lerPlanilhaManual, ehPlanilhaManual, remessaManual,
    EMBALAGENS, ANDARES, LINHAS_OPCOES, EMB_CODIGOS, PRODUTOS_TRATAMENTO, ehTratamento, andaresDe, resumoEmb, embPrat, ordemEndereco, enderecosPulados, textoPulados, embAndar, dimAndar, capAndarPr, capPrat, capAndarEst, capEst, temCaixinha, ladosPara, celulasOcupadas, checarEspaco, celulasLado, ehSubLado, dimPrat, nLinhas, cabeNa, descerPilha, chavePilha, nomeEmbAceitas, nomeEmb, capLinha, capAndar, capPrateleira, nomeLado, nomeAltura, chaveSlot, textoSlot, ordemSlots, p2,
    SALAS, estadoAtual, ocupacao, perfisPrateleiras, foraDaRegra, sugerirPosicao, validarPosicao, faixas, etiquetaLinha,
    ehManual, ehPureza, protBase, chaveItem, tipoItem, lerPlanilhaRef, unirRef, CAMPOS_REF, dataRefKey, lerEtiquetaTexto, confere, protVizinhos, notaEtiqueta, chanceTroca, corrigirCultivar, inferirEspecie, codigoQR
  };
})(typeof window !== 'undefined' ? window : globalThis);
