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
    VERDE:      { nome: 'Lote / Teste / Devoluções / Entrada / Revalidação / Reembalagem', curto: 'Verde', cor: '#83E28E', tinta: '#0f3d17' },
    TSI:        { nome: 'TSI (não mistura)', curto: 'TSI', cor: '#F7C7AC', tinta: '#6b2c0b' },
    PRECOLHEITA:{ nome: 'Pré-colheita', curto: 'Pré-colheita', cor: '#FFFF00', tinta: '#4d4a00' },
    PRELOTE:    { nome: 'Pré-lote', curto: 'Pré-lote', cor: '#D86DCD', tinta: '#3d0b37' },
    CARREG:     { nome: 'Carregamentos', curto: 'Carregamentos', cor: '#4D93D9', tinta: '#ffffff' },
    INTERLAB:   { nome: 'Inter/Intralaboratorial', curto: 'Interlab.', cor: '#C9C9C9', tinta: '#1f1f1f' },
    MANUAL:     { nome: 'Amostras manuais', curto: 'Manual', cor: '#E8E2D0', tinta: '#3a3320' },
    NAO:        { nome: 'Não armazena no arquivo', curto: 'Não armazena', cor: '#BE5014', tinta: '#ffffff' },
    OUTROS:     { nome: 'Outros tipos', curto: 'Outros', cor: '#DDDDDD', tinta: '#1f1f1f' }
  };
  const REMESSA_GRUPO = {
    'LOTE': 'VERDE', 'TESTE': 'VERDE', 'DEVOLUCOES': 'VERDE', 'ENTRADA SEMENTE': 'VERDE', 'REVALIDACAO': 'VERDE', 'REEMBALAGEM': 'VERDE',
    'TSI': 'TSI', 'PRE COLHEITA': 'PRECOLHEITA', 'PRE LOTE': 'PRELOTE', 'CARREGAMENTOS': 'CARREG',
    'CARGAS CLASSIFICACAO': 'NAO', 'SECADOR': 'NAO'
  };
  const TIPOS_REMESSA = ['LOTE', 'TESTE', 'DEVOLUÇÕES', 'ENTRADA SEMENTE', 'REVALIDAÇÃO', 'REEMBALAGEM', 'TSI', 'PRE COLHEITA', 'PRE LOTE', 'CARREGAMENTOS', 'CARGAS CLASSIFICAÇÃO', 'SECADOR'];
  const CULTURAS_PROTOCOLO = ['SOJA', 'MILHO'];

  /* Classifica uma amostra (dados vindos das planilhas ou digitados) */
  function classificar(a) {
    const especie = up(a.especie);
    const protocolo = !ehManual(a.protocolo) && CULTURAS_PROTOCOLO.indexOf(especie) >= 0;
    const tipo = up(a.tipoAnalise);
    let grupo;
    if (!protocolo) grupo = 'MANUAL';
    else if (/INTER|INTRA/.test(tipo)) grupo = 'INTERLAB';
    else grupo = REMESSA_GRUPO[up(a.remessa)] || (a.remessa ? 'OUTROS' : 'OUTROS');
    const trat = up(a.tratamento);
    const tratada = grupo === 'TSI' || !!(trat && trat !== '-O-' && trat !== 'SEM TRATAMENTO' && trat !== 'NAO');
    const inova = /INOVA\s*GENETICA/.test(up(a.produtor));
    return {
      classificacao: protocolo ? 'Protocolo' : 'Entrada de amostra manual',
      cultura: especie || 'NÃO INFORMADA',
      grupo, tratada, inova,
      armazena: grupo !== 'NAO'
    };
  }
  // chave que define quem pode dividir a mesma prateleira (regras 1 a 4 + embalagem)
  function perfil(a, embalagem) {
    const c = classificar(a);
    return { cultura: c.cultura, tratada: c.tratada, inova: c.inova, grupo: c.grupo, embalagem: embalagem || a.embalagem || '' };
  }
  const chavePerfil = p => [p.cultura, p.tratada ? 'TRAT' : 'SEM', p.inova ? 'INOVA' : 'GERAL', p.grupo, p.embalagem].join('|');
  function textoPerfil(p) {
    if (!p) return 'Livre';
    return [p.cultura, p.tratada ? 'Tratada' : 'Sem tratamento', p.inova ? 'INOVA GENÉTICA' : 'Demais produtores', (GRUPOS[p.grupo] || {}).curto || p.grupo].join(' · ');
  }
  // explica por que a amostra não pode entrar numa prateleira com outro perfil
  function motivosIncompat(pa, pb) {
    const m = [];
    if (pa.embalagem !== pb.embalagem) m.push('embalagem diferente (' + nomeEmb(pb.embalagem) + ')');
    if (pa.cultura !== pb.cultura) m.push('cultura diferente (' + pb.cultura + ')');
    if (pa.tratada !== pb.tratada) m.push(pb.tratada ? 'prateleira de amostras tratadas' : 'prateleira de amostras sem tratamento');
    if (pa.inova !== pb.inova) m.push(pb.inova ? 'prateleira exclusiva INOVA GENÉTICA' : 'INOVA GENÉTICA não fica com os demais produtores');
    if (pa.grupo !== pb.grupo) m.push('tipo de remessa de outro grupo (' + ((GRUPOS[pb.grupo] || {}).curto || pb.grupo) + ')');
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
  const nomeEmbAceitas = e => e === 'CX05' ? 'Caixinha 0,5 kg ou 1 kg' : nomeEmb(e);
  const nomeEmb = k => (EMBALAGENS[k] || {}).nome || k || '—';
  const capLinha = k => { const e = EMBALAGENS[k]; return e ? e.lados.length * e.alturas : 0; };
  // linhas por andar: 15 por padrão nas caixinhas; algumas prateleiras só comportam 14 (definido no cadastro)
  const LINHAS_OPCOES = { CX1: [15, 14], CX05: [15, 14] };
  const nLinhas = (k, lin) => { const e = EMBALAGENS[k]; return e ? (Number(lin) > 0 ? Number(lin) : e.linhas) : 0; };
  const dimPrat = pr => Object.assign({}, EMBALAGENS[pr.embalagem], { linhas: nLinhas(pr.embalagem, pr.linhas) });
  const capAndar = (k, lin) => nLinhas(k, lin) * capLinha(k);
  const capPrateleira = (k, lin) => capAndar(k, lin) * ANDARES;
  const nomeLado = l => ({ T: 'Trás', F: 'Frente', T1: 'Trás 01', T2: 'Trás 02', F1: 'Frente 01', F2: 'Frente 02' })[l] || l;
  const nomeAltura = (k, h) => (EMBALAGENS[k] && EMBALAGENS[k].letras) ? String.fromCharCode(64 + h) : String(h).padStart(2, '0');
  const p2 = n => String(n).padStart(2, '0');
  const chaveSlot = s => [s.prateleira, s.andar, s.linha, s.lado, s.altura].join('-');
  function textoSlot(s, emb) {
    if (!s || !s.prateleira) return '';
    return 'P.' + p2(s.prateleira) + ' | A.' + p2(s.andar) + ' | L.' + p2(s.linha) + ' · ' + nomeLado(s.lado) + ' · ' + nomeAltura(emb, s.altura);
  }
  // ordem de preenchimento: andar 1→4, linha 1→N, do fundo para a frente (Trás antes da Frente), de baixo para cima
  function* ordemSlots(prateleira, emb, lin) {
    const e = EMBALAGENS[emb]; if (!e) return; const nl = nLinhas(emb, lin);
    for (let a = 1; a <= ANDARES; a++) for (let l = 1; l <= nl; l++) for (const lado of e.lados) for (let h = 1; h <= e.alturas; h++)
      yield { prateleira: prateleira, andar: a, linha: l, lado: lado, altura: h };
  }

  /* ---------- Estado atual a partir dos movimentos ----------
     Ações: ARMAZENAR (entra/volta no arquivo), SALA (sai para uma sala; a posição é liberada — as caixinhas de cima descem),
            RETORNO (registros antigos: volta para a posição anterior), REMANEJAR (muda de posição; também usado quando a caixinha desce
            sozinha porque a de baixo foi retirada), BAIXA (sai do arquivo; libera),
            REGISTRO (só registra: amostra que não armazena) */
  const SALAS = ['Sala de análise', 'Sala de montagem', 'Sala de tratamento de sementes', 'Sala de homogeneização de sementes'];
  function estadoAtual(movs) {
    const est = {};
    movs.slice().sort((a, b) => a.ts - b.ts || String(a.id).localeCompare(String(b.id))).forEach(m => {
      if (m.situacao && /^Conflito|^Excluíd/.test(m.situacao)) return;
      const p = m.protocolo; if (!p) return;
      const e = est[p] || (est[p] = { protocolo: p, slot: null, local: '', primeiro: m.ts, historico: 0 });
      e.historico++;
      ['especie', 'cultivar', 'lote', 'produtor', 'tipoAnalise', 'remessa', 'tratamento', 'classificacao', 'embalagem', 'categoria'].forEach(k => { if (m[k]) e[k] = m[k]; });
      e.ultimo = m.ts; e.ultimoMov = m.acao; e.usuario = m.usuario; e.fotoUrl = m.fotoUrl || e.fotoUrl;
      if (m.acao === 'ARMAZENAR' || m.acao === 'REMANEJAR' || m.acao === 'RETORNO') {
        if (m.prateleira) e.slot = { prateleira: Number(m.prateleira), andar: Number(m.andar), linha: Number(m.linha), lado: m.lado, altura: Number(m.altura) };
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
  // perfil atual de cada prateleira = perfil das amostras que estão nela
  function perfisPrateleiras(est, prateleiras) {
    const r = {};
    (prateleiras || []).forEach(pr => { r[pr.numero] = { prateleira: pr, perfil: null, usadas: 0, amostras: [] }; });
    Object.values(est).forEach(e => {
      if (!e.slot || !(e.status === 'ARQUIVO' || e.status === 'SALA')) return;
      const k = e.slot.prateleira; const pr = r[k] || (r[k] = { prateleira: { numero: k, embalagem: e.embalagem, situacao: 'Ativa' }, perfil: null, usadas: 0, amostras: [] });
      if (!pr.perfil) pr.perfil = perfil(e, pr.prateleira.embalagem || e.embalagem);
      pr.usadas++; pr.amostras.push(e);
    });
    return r;
  }
  /* Sugere a posição para uma amostra respeitando as regras.
     Prioridade: prateleira já com o mesmo perfil (continua a sequência) → prateleira vazia da mesma embalagem. */
  function sugerirPosicao(amostra, embalagem, est, prateleiras, excetoProt) {
    const ests = Object.assign({}, est); if (excetoProt) delete ests[excetoProt];
    const occ = ocupacao(ests), pp = perfisPrateleiras(ests, prateleiras);
    // prateleiras da própria embalagem primeiro; a caixinha de 0,5 kg pode seguir depois para as de 1 kg
    const ativas = (prateleiras || []).filter(p => p.situacao !== 'Inativa' && cabeNa(embalagem, p.embalagem))
      .sort((a, b) => (a.embalagem === embalagem ? 0 : 1) - (b.embalagem === embalagem ? 0 : 1) || a.numero - b.numero);
    const livre = pr => { for (const s of ordemSlots(pr.numero, pr.embalagem, pr.linhas)) if (!occ[chaveSlot(s)]) return s; return null; };
    const obs = pr => pr.embalagem !== embalagem ? ' (caixinha de 0,5 kg na prateleira de 1 kg)' : '';
    for (const pr of ativas) { const x = pp[pr.numero]; if (x && x.perfil && chavePerfil(x.perfil) === chavePerfil(perfil(amostra, pr.embalagem))) { const s = livre(pr); if (s) return { slot: s, embPrat: pr.embalagem, motivo: 'Continua a sequência da prateleira ' + p2(pr.numero) + obs(pr) }; } }
    for (const pr of ativas) { const x = pp[pr.numero]; if (!x || !x.perfil) { const s = livre(pr); if (s) return { slot: s, embPrat: pr.embalagem, motivo: 'Prateleira ' + p2(pr.numero) + ' livre (passa a ser deste perfil)' + obs(pr) }; } }
    return { slot: null, motivo: ativas.length ? 'Nenhuma prateleira de ' + nomeEmbAceitas(embalagem) + ' livre para este perfil. Cadastre uma nova prateleira.' : 'Nenhuma prateleira de ' + nomeEmbAceitas(embalagem) + ' cadastrada.' };
  }
  // confere se uma posição escolhida à mão respeita as regras
  function validarPosicao(amostra, embalagem, slot, est, prateleiras, excetoProt) {
    if (ehPureza(amostra.protocolo) && embalagem !== 'KRAFT') return ['Pureza vai sempre em saco kraft.'];
    const pr = (prateleiras || []).find(p => Number(p.numero) === Number(slot.prateleira));
    if (!pr) return ['Prateleira ' + slot.prateleira + ' não cadastrada.'];
    if (pr.situacao === 'Inativa') return ['Prateleira ' + p2(pr.numero) + ' está inativa.'];
    if (!cabeNa(embalagem, pr.embalagem)) return ['A prateleira ' + p2(pr.numero) + ' é de ' + nomeEmb(pr.embalagem) + '.'];
    const e = dimPrat(pr);
    if (!(slot.andar >= 1 && slot.andar <= ANDARES && slot.linha >= 1 && slot.linha <= e.linhas && e.lados.indexOf(slot.lado) >= 0 && slot.altura >= 1 && slot.altura <= e.alturas)) return ['Posição fora da capacidade da prateleira.'];
    const ests = Object.assign({}, est); if (excetoProt) delete ests[excetoProt];
    const ocup = ocupacao(ests)[chaveSlot(slot)];
    if (ocup) return ['Posição ocupada pela amostra ' + ocup.protocolo + '.'];
    // apoio: da altura B para cima precisa haver caixinha/saco logo abaixo (nada fica "flutuando")
    if (slot.altura > 1) {
      const oc = ocupacao(ests), em = h => oc[chaveSlot(Object.assign({}, slot, { altura: h }))];
      if (!em(slot.altura - 1)) { let h = 1; while (h < slot.altura && em(h)) h++;
        return ['Não pode: a posição abaixo (' + nomeAltura(pr.embalagem, slot.altura - 1) + ') está vazia; a ' + (pr.embalagem === 'KRAFT' ? 'embalagem' : 'caixinha') + ' precisa ficar apoiada. Use a altura ' + nomeAltura(pr.embalagem, h) + ' desta pilha.']; }
    }
    const x = perfisPrateleiras(ests, prateleiras)[pr.numero];
    if (x && x.perfil) { const m = motivosIncompat(perfil(amostra, pr.embalagem), x.perfil); if (m.length) return m.map(t => 'Não pode: ' + t + '.'); }
    return [];
  }

  /* Gravidade: depois de uma retirada, as caixinhas/sacos de cima descem e a pilha fica sem buracos.
     Recebe o estado JÁ com a retirada aplicada e um endereço da pilha; devolve quem muda de altura. */
  const chavePilha = s => [s.prateleira, s.andar, s.linha, s.lado].join('-');
  function descerPilha(est, ref) {
    if (!ref || !ref.prateleira) return [];
    const k = chavePilha(ref);
    const pilha = Object.values(est).filter(e => e.slot && e.status === 'ARQUIVO' && chavePilha(e.slot) === k).sort((a, b) => a.slot.altura - b.slot.altura);
    const out = [];
    pilha.forEach((e, i) => { if (e.slot.altura !== i + 1) out.push({ e, de: e.slot, para: Object.assign({}, e.slot, { altura: i + 1 }) }); });
    return out;
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
    return { titulo: titulo.join(' / ') || '—', codigo: 'P. ' + p2(prateleira) + ' | A. ' + p2(andar) + ' | L. ' + p2(linha), tras: faixas(tras), frente: faixas(frente), total: am.length };
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
    for (let w = Math.max(1, b.length - 1); w <= b.length + 1; w++) for (let i = 0; i + w <= a.length; i++) d = Math.min(d, lev(a.slice(i, i + w), b));
    return d / b.length <= 0.3; }
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
    up, normProt, protNum, protAno, milhar, GRUPOS, REMESSA_GRUPO, TIPOS_REMESSA, CULTURAS_PROTOCOLO, classificar, perfil, chavePerfil, textoPerfil, motivosIncompat,
    lerPlanilhaManual, ehPlanilhaManual, remessaManual,
    EMBALAGENS, ANDARES, LINHAS_OPCOES, dimPrat, nLinhas, cabeNa, descerPilha, chavePilha, nomeEmbAceitas, nomeEmb, capLinha, capAndar, capPrateleira, nomeLado, nomeAltura, chaveSlot, textoSlot, ordemSlots, p2,
    SALAS, estadoAtual, ocupacao, perfisPrateleiras, sugerirPosicao, validarPosicao, faixas, etiquetaLinha,
    ehManual, ehPureza, protBase, chaveItem, tipoItem, lerPlanilhaRef, unirRef, CAMPOS_REF, dataRefKey, lerEtiquetaTexto, confere, protVizinhos, notaEtiqueta, chanceTroca, corrigirCultivar, inferirEspecie, codigoQR
  };
})(typeof window !== 'undefined' ? window : globalThis);
