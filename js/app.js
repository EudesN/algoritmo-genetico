// Interface: validação, controles, gráfico, log e animação.
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const { fmtMoney, fmtNum, geneLabel } = GA;

  const MIN_PROJ = 4, MAX_PROJ = 15;
  const MAX_POP = 100000, MAX_GEN = 100000; // limites para o navegador não travar
  const MAX_ROWS = 200; // máximo de linhas mostradas (população, pares e log)
  // quantas gerações guardam o log completo (menos se a população for grande)
  const keepLogs = () => Math.max(1, Math.min(300, Math.floor(20000 / state.engine.params.popSize)));

  const exampleProjects = () => GATests.PROJECTS_61.map((p) => ({ name: p.name, cost: String(p.cost), benefit: String(p.benefit) }));
  const exampleParams = () => ({ budget: '7000', popSize: '20', generations: '50', crossoverRate: '80', mutationRate: '5', tournamentSize: '2', eliteCount: '1', seed: '42' });
  const PARAM_IDS = Object.keys(exampleParams());

  const state = {
    projects: exampleProjects(),
    params: exampleParams(),
    engine: null,
    config: null,   // configuração já validada
    valid: true,
    dirty: false,
    running: false,
  };

  // Validação
  const RE_MONEY = /^\d+([.,]\d{1,2})?$/;
  const RE_DEC = /^\d+([.,]\d+)?$/;
  const RE_INT = /^\d+$/;
  const RE_SINT = /^-?\d+$/;
  const toNum = (s) => Number(String(s).trim().replace(',', '.'));

  function validate() {
    const errors = {};
    const projErrors = state.projects.map(() => ({}));
    const projects = [];

    state.projects.forEach((p, i) => {
      const e = projErrors[i];
      if (!p.name.trim()) e.name = 'Nome obrigatório';
      const c = p.cost.trim();
      if (!c) e.cost = 'Obrigatório';
      else if (!RE_MONEY.test(c)) e.cost = 'Até 2 casas decimais';
      else if (toNum(c) <= 0) e.cost = 'Deve ser positivo';
      else if (toNum(c) > 1e12) e.cost = 'Valor muito alto';
      const b = p.benefit.trim();
      if (!b) e.benefit = 'Obrigatório';
      else if (!RE_MONEY.test(b)) e.benefit = 'Número maior ou igual a 0, até 2 casas';
      else if (toNum(b) > 1e9) e.benefit = 'Valor muito alto';
      projects.push({ name: p.name.trim(), cost: toNum(c), benefit: toNum(b) });
    });
    if (state.projects.length < MIN_PROJ || state.projects.length > MAX_PROJ) errors.projects = 'Mantenha entre 4 e 15 projetos';

    const v = {};
    const s = (k) => String(state.params[k]).trim();

    const bud = s('budget');
    if (!bud) errors.budget = 'Obrigatório';
    else if (!RE_MONEY.test(bud)) errors.budget = 'Valor maior ou igual a 0, até 2 casas decimais';
    else if (toNum(bud) > 1e13) errors.budget = 'Valor muito alto';
    else v.budget = toNum(bud);

    const intField = (k, min, max, label) => {
      const x = s(k);
      if (!x) { errors[k] = 'Obrigatório'; return; }
      if (!RE_INT.test(x)) { errors[k] = 'Informe um inteiro'; return; }
      const n = Number(x);
      if (n < min || n > max) { errors[k] = label; return; }
      v[k] = n;
    };
    intField('popSize', 2, MAX_POP, 'Inteiro entre 2 e ' + MAX_POP);
    intField('generations', 1, MAX_GEN, 'Inteiro entre 1 e ' + MAX_GEN);

    ['crossoverRate', 'mutationRate'].forEach((k) => {
      const x = s(k);
      if (!x) errors[k] = 'Obrigatório';
      else if (!RE_DEC.test(x)) errors[k] = 'Número entre 0 e 100';
      else if (toNum(x) > 100) errors[k] = 'Máximo 100%';
      else v[k] = toNum(x);
    });

    const pop = v.popSize;
    intField('tournamentSize', 2, pop || Infinity, pop ? 'Inteiro entre 2 e ' + pop + ' (população)' : 'Inteiro a partir de 2');
    intField('eliteCount', 0, pop ? pop - 1 : Infinity, pop ? 'Inteiro entre 0 e ' + (pop - 1) : 'Inteiro a partir de 0');
    if (!pop) { if (v.tournamentSize !== undefined) delete v.tournamentSize; if (v.eliteCount !== undefined) delete v.eliteCount; }

    const sd = s('seed');
    if (!sd) errors.seed = 'Obrigatório';
    else if (!RE_SINT.test(sd)) errors.seed = 'Informe um inteiro';
    else if (!Number.isSafeInteger(Number(sd))) errors.seed = 'Inteiro grande demais';
    else v.seed = Number(sd);

    const ok = Object.keys(errors).length === 0 && projErrors.every((e) => Object.keys(e).length === 0) &&
      PARAM_IDS.every((k) => v[k] !== undefined);
    return {
      ok, errors, projErrors,
      config: ok ? {
        projects, budget: v.budget,
        params: {
          popSize: v.popSize, generations: v.generations,
          crossoverRate: v.crossoverRate / 100, mutationRate: v.mutationRate / 100,
          tournamentSize: v.tournamentSize, eliteCount: v.eliteCount, seed: v.seed,
        },
      } : null,
    };
  }

  function showValidation() {
    const r = validate();
    state.valid = r.ok;
    PARAM_IDS.forEach((k) => {
      const input = $(k);
      const msg = r.errors[k] || '';
      input.classList.toggle('invalid', !!msg);
      input.parentElement.querySelector('.err').textContent = msg;
    });
    document.querySelectorAll('#projectsBody tr').forEach((tr, i) => {
      ['name', 'cost', 'benefit'].forEach((k) => {
        const msg = (r.projErrors[i] || {})[k] || '';
        const inp = tr.querySelector(`[data-k="${k}"]`);
        inp.classList.toggle('invalid', !!msg);
        tr.querySelector(`.err[data-k="${k}"]`).textContent = msg;
      });
    });
    $('projCount').textContent = '(' + state.projects.length + '/' + MAX_PROJ + ')';
    $('addProject').disabled = state.projects.length >= MAX_PROJ;
    document.querySelectorAll('.btn-del').forEach((b) => { b.disabled = state.projects.length <= MIN_PROJ; });
    return r;
  }

  // Formulário
  function renderProjects() {
    $('projectsBody').innerHTML = state.projects.map((p, i) => `
      <tr>
        <td>${geneLabel(i)}</td>
        <td><input data-i="${i}" data-k="name" value="${esc(p.name)}" aria-label="Nome do projeto ${geneLabel(i)}"><small class="err" data-k="name"></small></td>
        <td><input data-i="${i}" data-k="cost" value="${esc(p.cost)}" inputmode="decimal" aria-label="Custo do projeto ${geneLabel(i)}"><small class="err" data-k="cost"></small></td>
        <td><input data-i="${i}" data-k="benefit" value="${esc(p.benefit)}" inputmode="decimal" aria-label="Benefício do projeto ${geneLabel(i)}"><small class="err" data-k="benefit"></small></td>
        <td><button type="button" class="btn icon btn-del" data-i="${i}" title="Remover projeto ${geneLabel(i)}">✕</button></td>
      </tr>`).join('');
  }

  function fillParams() {
    PARAM_IDS.forEach((k) => { $(k).value = state.params[k]; });
  }

  function onConfigChange() {
    showValidation();
    if (state.engine && !state.dirty) {
      state.dirty = true;
      if (state.running) pause();
    }
    updateButtons();
  }

  $('projectsBody').addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.k === undefined) return;
    state.projects[+t.dataset.i][t.dataset.k] = t.value;
    onConfigChange();
  });
  $('projectsBody').addEventListener('click', (e) => {
    const b = e.target.closest('.btn-del');
    if (!b || state.projects.length <= MIN_PROJ) return;
    state.projects.splice(+b.dataset.i, 1);
    renderProjects();
    onConfigChange();
  });
  $('addProject').addEventListener('click', () => {
    if (state.projects.length >= MAX_PROJ) return;
    state.projects.push({ name: 'Projeto ' + geneLabel(state.projects.length), cost: '1000', benefit: '1' });
    renderProjects();
    onConfigChange();
    const inputs = $('projectsBody').querySelectorAll('input[data-k="name"]');
    inputs[inputs.length - 1].focus();
  });
  PARAM_IDS.forEach((k) => $(k).addEventListener('input', (e) => { state.params[k] = e.target.value; onConfigChange(); }));
  $('loadExample').addEventListener('click', () => {
    state.projects = exampleProjects();
    state.params = exampleParams();
    renderProjects(); fillParams(); onConfigChange();
  });

  // Controles
  function updateButtons() {
    const e = state.engine;
    const finished = !!(e && e.finished);
    const canAdvance = state.valid && !state.dirty && !state.running && e && !finished;
    $('btnRun').disabled = !canAdvance;
    $('btnStep').disabled = !canAdvance;
    $('btnPause').disabled = !state.running;
    $('btnReset').disabled = !state.valid;
    $('btnReplay').disabled = state.running || !e;

    const st = $('status');
    st.className = 'status';
    if (!state.valid) { st.textContent = 'Corrija os campos destacados: a execução está bloqueada.'; st.classList.add('warn'); }
    else if (state.dirty) { st.textContent = 'Dados ou parâmetros alterados: clique em Reiniciar para aplicá-los.'; st.classList.add('warn'); }
    else if (!e) st.textContent = '';
    else if (finished) { st.textContent = 'Execução encerrada: limite de ' + e.params.generations + ' gerações atingido.'; st.classList.add('ok'); }
    else if (state.running) st.textContent = 'Executando (geração ' + e.generation + ' de ' + e.params.generations + ')';
    else st.textContent = e.generation === 0 ? 'Pronto: geração 0 criada. Use Executar ou Avançar.' : 'Pausado na geração ' + e.generation + '.';
  }

  function reset() {
    const r = showValidation();
    if (!r.ok) { updateButtons(); return; }
    cancelAnim();
    state.running = false;
    state.config = r.config;
    state.engine = new GA.Engine(r.config.projects, r.config.budget, r.config.params);
    state.dirty = false;
    renderAll();
    showInitStage();
    updateButtons();
  }

  function doStep() {
    const e = state.engine;
    const log = e.step();
    if (!log) return null;
    // descarta logs antigos para não gastar memória
    const old = e.logs.length - 1 - keepLogs();
    if (old > 0 && e.logs[old] && e.logs[old].pairs) { e.logs[old].pairs = null; e.logs[old].init = null; e.logs[old].trimmed = true; }
    renderAfterStep(log);
    return log;
  }

  async function run() {
    if ($('btnRun').disabled) return;
    state.running = true;
    updateButtons();
    while (state.running && !state.engine.finished) {
      const log = doStep();
      updateButtons();
      const tok = newToken();
      try {
        if ($('animEnabled').checked) await animateGeneration(log, $('animScope').value, tok);
        else await wait(350, tok);
      } catch (err) {
        if (err !== CANCEL) throw err;
      }
    }
    state.running = false;
    updateButtons();
  }

  function pause() {
    state.running = false;
    cancelAnim();
    updateButtons();
  }

  function stepOnce() {
    if ($('btnStep').disabled) return;
    cancelAnim();
    const log = doStep();
    updateButtons();
    if (log && $('animEnabled').checked) playSafe(log, $('animScope').value);
    else if (log) showSummary(log);
  }

  $('btnRun').addEventListener('click', run);
  $('btnPause').addEventListener('click', pause);
  $('btnStep').addEventListener('click', stepOnce);
  $('btnReset').addEventListener('click', reset);

  // Resultados
  function chromHTML(str, o = {}) {
    const bits = str.split('');
    const parts = bits.map((b, i) => {
      const cls = ['bit', 'b' + b];
      if (o.origins && o.origins[i]) cls.push(o.origins[i]);
      if (o.cls && o.cls[i]) cls.push(o.cls[i]);
      const bit = `<span class="${cls.join(' ')}" data-g="${i}">${b}</span>`;
      const g = o.labels ? `<span class="gene"><span class="lbl">${geneLabel(i)}</span>${bit}</span>` : bit;
      return (o.cut != null && i === o.cut ? '<span class="cutline"></span>' : '') + g;
    });
    return `<span class="chrom${o.small ? ' sm' : ''}${o.split ? ' split' : ''}">${parts.join('')}</span>`;
  }

  function renderStats() {
    const e = state.engine;
    const h = e.history[e.history.length - 1];
    $('stGen').textContent = e.generation + ' / ' + e.params.generations;
    $('stBest').textContent = fmtNum(h.best);
    $('stAvg').textContent = fmtNum(h.avg);
    $('stBestEver').textContent = fmtNum(h.bestEver);
  }

  function renderBest() {
    const e = state.engine;
    const b = e.bestEver;
    const ev = b.eval;
    $('bestTitle').textContent = e.finished ? 'Resultado final: melhor solução de toda a execução' : 'Melhor solução encontrada até agora';
    const names = ev.selected.map((i) => `<span class="chip"><b>${geneLabel(i)}</b> ${esc(e.projects[i].name)}</span>`).join('') || '<span class="muted">nenhum (seleção vazia)</span>';
    $('bestSolution').innerHTML = `
      <dl class="solution">
        <dt>Cromossomo</dt><dd>${chromHTML(GA.toStr(b.chrom), { labels: true })} <span class="muted">${GA.toStr(b.chrom)}</span></dd>
        <dt>Projetos escolhidos</dt><dd class="chips">${names}</dd>
        <dt>Custo total</dt><dd>${fmtMoney(ev.cost)}</dd>
        <dt>Benefício total</dt><dd>${fmtNum(ev.benefit)} pontos (aptidão ${fmtNum(b.fitness)})</dd>
        <dt>Saldo do orçamento</dt><dd>${fmtMoney(ev.balance)} <span class="muted">de ${fmtMoney(e.budget)}</span></dd>
        <dt>Encontrada em</dt><dd>geração ${b.generation} (indivíduo #${b.index})</dd>
      </dl>`;
  }

  function histRow(h) {
    return `<tr><td>${h.generation}</td><td>${fmtNum(h.best)}</td><td>${fmtNum(h.avg)}</td><td>${fmtNum(h.bestEver)}</td><td>${chromHTML(h.bestEverChrom, { small: true })}</td></tr>`;
  }

  function renderPopulation() {
    const e = state.engine;
    const bestIdx = e.history[e.history.length - 1].bestIndex;
    $('popBody').innerHTML = e.population.slice(0, MAX_ROWS).map((ind, i) => {
      const o = ind.origin;
      const origin = o.type === 'init' ? 'inicial' : o.type === 'elite' ? 'elite (era #' + o.from + ')' : 'par ' + o.pair + ', filho ' + o.child;
      const cls = o.type === 'elite' ? 'elite' : i === bestIdx ? 'hl' : '';
      return `<tr class="${cls}"><td>${i}</td><td>${chromHTML(GA.toStr(ind.chrom), { small: true })}</td><td>${fmtMoney(ind.cost)}</td><td>${fmtNum(ind.fitness)}</td><td>${origin}</td></tr>`;
    }).join('') + (e.population.length > MAX_ROWS ? `<tr><td colspan="5" class="muted">mais ${e.population.length - MAX_ROWS} indivíduos não exibidos</td></tr>` : '');
  }

  function renderLogSelect(selectLatest) {
    const e = state.engine;
    const sel = $('logSelect');
    const wasLatest = selectLatest || sel.selectedIndex <= 0;
    const prev = sel.value;
    sel.innerHTML = e.logs.map((l) => `<option value="${l.generation}">Geração ${l.generation}</option>`).reverse().join('');
    if (wasLatest) sel.selectedIndex = 0;
    else sel.value = prev;
    renderLog();
  }
  function logText(log, projects) {
    if (!log.pairs || log.pairs.length <= MAX_ROWS) return GA.formatGeneration(log, projects);
    const cut = Object.assign({}, log, { pairs: log.pairs.slice(0, MAX_ROWS), init: log.init && log.init.slice(0, MAX_ROWS) });
    return GA.formatGeneration(cut, projects) + '\n(... mostrados só os primeiros ' + MAX_ROWS + ' de ' + log.pairs.length + ' pares)';
  }
  function renderLog() {
    const e = state.engine;
    const g = +$('logSelect').value;
    const log = e.logs[g];
    if (!log) { $('logView').textContent = ''; return; }
    $('logView').textContent = log.trimmed
      ? '=== Geração ' + g + ' ===\n(Log detalhado descartado da memória. São mantidas as últimas ' + keepLogs() + ' gerações.)\n' + GA.formatGeneration({ generation: g, stats: log.stats, elites: [], pairs: [] }, e.projects)
      : logText(log, e.projects);
  }
  $('logSelect').addEventListener('change', renderLog);

  $('btnDownloadLog').addEventListener('click', () => {
    const e = state.engine;
    if (!e) return;
    const head = [
      'Simulador de Algoritmo Genético',
      'Projetos: ' + e.projects.map((p, i) => geneLabel(i) + ' = ' + p.name + ' (' + fmtMoney(p.cost) + '; ' + fmtNum(p.benefit) + ')').join(' | '),
      'Orçamento: ' + fmtMoney(e.budget),
      'Parâmetros: ' + JSON.stringify(e.params),
      '',
    ].join('\n');
    const body = e.logs.map((l) => l.trimmed ? '=== Geração ' + l.generation + ' === (log detalhado descartado)' : logText(l, e.projects)).join('\n\n');
    const blob = new Blob([head + body + '\n'], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'log-ag-semente-' + e.params.seed + '.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  function renderPairSelect() {
    const e = state.engine;
    const log = e.logs[e.logs.length - 1];
    const sel = $('pairSelect');
    if (log.generation === 0) {
      sel.innerHTML = '<option value="init">Geração 0, população inicial</option>';
      return;
    }
    let html = `<option value="all">Geração ${log.generation}, completa</option><option value="elite">Elitismo</option>`;
    (log.pairs || []).slice(0, MAX_ROWS).forEach((p) => { html += `<option value="${p.pair}">Par ${p.pair}</option>`; });
    sel.innerHTML = html;
  }

  function renderAll() {
    renderStats();
    renderBest();
    $('histBody').innerHTML = state.engine.history.map(histRow).join('');
    renderPopulation();
    renderLogSelect(true);
    renderPairSelect();
    drawChart();
  }

  function renderAfterStep() {
    const e = state.engine;
    renderStats();
    renderBest();
    $('histBody').insertAdjacentHTML('beforeend', histRow(e.history[e.history.length - 1]));
    const wrap = $('histBody').closest('.table-wrap');
    wrap.scrollTop = wrap.scrollHeight;
    renderPopulation();
    renderLogSelect(false);
    renderPairSelect();
    drawChart();
  }

  // Gráfico
  function drawChart() {
    const cv = $('chart');
    const e = state.engine;
    if (!e) return;
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth, H = 240;
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = getComputedStyle(document.documentElement);
    const col = (v) => css.getPropertyValue(v).trim();
    ctx.clearRect(0, 0, W, H);

    const pad = { l: 42, r: 12, t: 10, b: 28 };
    const h = e.history;
    const maxX = Math.max(1, e.params.generations);
    let maxY = 0;
    h.forEach((r) => { maxY = Math.max(maxY, r.bestEver, r.best); });
    maxY = maxY <= 0 ? 1 : maxY * 1.1;
    const X = (g) => pad.l + (g / maxX) * (W - pad.l - pad.r);
    const Y = (v) => H - pad.b - (v / maxY) * (H - pad.t - pad.b);

    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = col('--muted');
    ctx.strokeStyle = col('--border');
    ctx.lineWidth = 1;
    for (let k = 0; k <= 4; k++) {
      const v = (maxY / 4) * k;
      const y = Y(v);
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(fmtNum(Math.round(v * 10) / 10), pad.l - 6, y);
    }
    const xt = Math.min(10, maxX);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let k = 0; k <= xt; k++) {
      const g = Math.round((maxX / xt) * k);
      ctx.fillText(String(g), X(g), H - pad.b + 6);
    }

    const line = (key, color, dash, width) => {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash);
      ctx.beginPath();
      h.forEach((r, i) => { const x = X(r.generation), y = Y(r[key]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke(); ctx.setLineDash([]);
      if (h.length === 1) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(X(0), Y(h[0][key]), 3, 0, 7); ctx.fill(); }
    };
    line('avg', col('--p2'), [], 2);
    line('best', col('--accent'), [], 2);
    line('bestEver', col('--ok'), [6, 4], 2);
  }
  window.addEventListener('resize', drawChart);
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', drawChart);

  // Animação (usa os eventos registrados pelo motor)
  const CANCEL = { cancelled: true };
  let animToken = null;
  const SPEEDS = [0.25, 0.5, 0.75, 1, 1.5, 2, 4, 8];
  const speed = () => SPEEDS[+$('speed').value];
  $('speed').addEventListener('input', () => { $('speedLabel').textContent = fmtNum(speed()) + '×'; });

  function newToken() { cancelAnim(); animToken = { cancelled: false, pending: new Set() }; return animToken; }
  function cancelAnim() {
    if (!animToken) return;
    animToken.cancelled = true;
    animToken.pending.forEach((f) => f());
    animToken.pending.clear();
  }
  function wait(ms, tok) {
    return new Promise((resolve, reject) => {
      if (tok.cancelled) { reject(CANCEL); return; }
      const f = () => { clearTimeout(id); reject(CANCEL); };
      const id = setTimeout(() => { tok.pending.delete(f); resolve(); }, ms / speed());
      tok.pending.add(f);
    });
  }

  const PHASES = ['Seleção', 'Cruzamento', 'Mutação', 'Reparação', 'Avaliação'];
  const body = $('stageBody');
  function setPhase(title, desc, phase) {
    $('stageTitle').innerHTML = (phase != null ? '<div class="phase-steps">' + PHASES.map((p, i) => `<span class="${i === phase ? 'on' : ''}">${p}</span>`).join('') + '</div>' : '') + esc(title);
    let d = $('stage').querySelector('.stage-desc');
    if (!d) { d = document.createElement('div'); d.className = 'stage-desc'; body.before(d); }
    d.textContent = desc || '';
  }
  const note = (html, cls = '') => `<p class="note ${cls}">${html}</p>`;
  const projName = (i) => `<b>${geneLabel(i)}</b> (${esc(state.engine.projects[i].name)})`;

  async function playSafe(log, scope) {
    const tok = newToken();
    try { await animateGeneration(log, scope, tok); } catch (err) { if (err !== CANCEL) throw err; }
  }

  async function animateGeneration(log, scope, tok) {
    try {
      if (log.generation === 0) { showInitStage(); return; }
      if (scope === 'elite' || scope === 'all' || scope === 'first') await animateElites(log, tok);
      if (scope === 'elite') { return; }
      const pairs = scope === 'all' ? log.pairs : scope === 'first' ? log.pairs.slice(0, 1) : log.pairs.filter((p) => String(p.pair) === String(scope));
      for (const p of pairs) await animatePair(log, p, tok);
      await wait(400, tok);
      showSummary(log);
    } catch (err) {
      if (err === CANCEL) showSummary(log);
      throw err;
    }
  }

  async function animateElites(log, tok) {
    const e = state.engine;
    setPhase('Geração ' + log.generation + ', elitismo', 'Os melhores da geração anterior são copiados sem mudança (empate: menor índice).', null);
    if (!log.elites.length) {
      body.innerHTML = note('Quantidade de elite = 0: nenhum indivíduo é preservado; todas as ' + e.params.popSize + ' vagas serão ocupadas por descendentes.', 'gold');
      await wait(1000, tok);
      return;
    }
    body.innerHTML = log.elites.map((el) => `
      <div class="row elite"><span class="tag">#${el.from} → #${el.newIndex}</span>${chromHTML(el.chrom, { labels: true, cls: el.chrom.split('').map(() => 'gold') })}
      <span class="meta">aptidão ${fmtNum(el.fitness)}</span></div>`).join('') +
      note(log.elites.length + ' indivíduo(s) de elite copiado(s) para as primeiras posições; as demais ' + (e.params.popSize - log.elites.length) + ' vagas serão preenchidas por descendentes.', 'gold');
    await wait(1500, tok);
  }

  async function animatePair(log, p, tok) {
    const e = state.engine;
    const head = 'Geração ' + log.generation + ', par ' + p.pair + ' de ' + log.pairs.length;

    // 1. torneio
    for (const [k, t] of [[1, p.t1], [2, p.t2]]) {
      setPhase(head + ': torneio do pai ' + k, 'Sorteados ' + t.candidates.length + ' candidatos da população anterior. Vence a maior aptidão (empate: menor índice).', 0);
      body.innerHTML = t.candidates.map((c) => `
        <div class="row" data-idx="${c.index}"><span class="tag">#${c.index}</span>${chromHTML(c.chrom, { labels: true })}
        <span class="meta">aptidão ${fmtNum(c.fitness)}</span></div>`).join('');
      await wait(1000, tok);
      body.querySelectorAll('.row').forEach((r) => {
        const win = +r.dataset.idx === t.winner;
        r.classList.add(win ? 'winner' : 'loser');
        if (win) r.querySelector('.tag').textContent = 'Pai ' + k + ': #' + t.winner;
      });
      const wc = t.candidates.find((c) => c.index === t.winner);
      const tie = t.candidates.filter((c) => c.fitness === wc.fitness).length > 1;
      body.insertAdjacentHTML('beforeend', note('Vencedor: <b>#' + t.winner + '</b> (' + wc.chrom + ', aptidão ' + fmtNum(wc.fitness) + ')' + (tie ? '. Empate resolvido pelo menor índice.' : '.'), 'ok'));
      await wait(1200, tok);
    }

    // 2. cruzamento
    const n = e.nGenes;
    const o1 = Array(n).fill('o1'), o2 = Array(n).fill('o2');
    const parentRows = (split) => `
      <div class="row"><span class="tag p1">Pai 1: #${p.parentIdx[0]}</span>${chromHTML(p.parents[0], { labels: true, origins: o1, cut: p.cut, split })}</div>
      <div class="row"><span class="tag p2">Pai 2: #${p.parentIdx[1]}</span>${chromHTML(p.parents[1], { labels: true, origins: o2, cut: p.cut, split })}</div>`;
    const childOrigins = (k) => Array.from({ length: n }, (_, i) => (p.crossed && i >= p.cut) ? (k === 1 ? 'o2' : 'o1') : (k === 1 ? 'o1' : 'o2'));
    setPhase(head + ': cruzamento de um ponto', 'Taxa de cruzamento ' + fmtNum(e.params.crossoverRate * 100) + '% aplicada ao par.', 1);
    body.innerHTML = parentRows(false);
    await wait(900, tok);
    if (p.crossed) {
      body.innerHTML = parentRows(true) + note('Corte sorteado <b>após o ' + p.cut + 'º gene</b>: os segmentos à direita do corte serão trocados.');
      await wait(1200, tok);
      const anim = (k) => Array.from({ length: n }, (_, i) => (i >= p.cut ? 'slide-down' : ''));
      const cls = (k) => anim(k);
      body.innerHTML = parentRows(true) +
        `<div class="row"><span class="tag">Filho 1</span>${chromHTML(p.afterCrossover[0], { labels: true, origins: childOrigins(1), cut: p.cut, split: true, cls: cls(1) })}</div>
         <div class="row"><span class="tag">Filho 2</span>${chromHTML(p.afterCrossover[1], { labels: true, origins: childOrigins(2), cut: p.cut, split: true, cls: cls(2) })}</div>` +
        note(p.parents[0].slice(0, p.cut) + '|' + p.parents[0].slice(p.cut) + ' + ' + p.parents[1].slice(0, p.cut) + '|' + p.parents[1].slice(p.cut) +
          ' → filho 1 = <b>' + p.afterCrossover[0] + '</b>; filho 2 = <b>' + p.afterCrossover[1] + '</b>');
    } else {
      body.innerHTML = parentRows(false) +
        `<div class="row"><span class="tag">Filho 1</span>${chromHTML(p.afterCrossover[0], { labels: true, origins: childOrigins(1) })}</div>
         <div class="row"><span class="tag">Filho 2</span>${chromHTML(p.afterCrossover[1], { labels: true, origins: childOrigins(2) })}</div>` +
        note('Sorteio acima da taxa: <b>sem cruzamento</b>: os filhos são cópias dos pais.', 'bad');
    }
    await wait(1600, tok);

    // 3. mutação
    setPhase(head + ': mutação por inversão de bits', 'Cada gene dos filhos é invertido com probabilidade ' + fmtNum(e.params.mutationRate * 100) + '%.', 2);
    const mutRow = (k, after) => {
      const m = p.mutation[k - 1];
      const str = after ? m.after : m.before;
      const cls = Array(n).fill('');
      if (after) m.flipped.forEach((g) => { cls[g] = 'flip'; });
      return `<div class="row"><span class="tag">Filho ${k}</span>${chromHTML(str, { labels: true, origins: childOrigins(k), cls })}</div>`;
    };
    body.innerHTML = mutRow(1, false) + mutRow(2, false);
    await wait(800, tok);
    const mtxt = p.mutation.map((m, k) => m.flipped.length
      ? 'Filho ' + (k + 1) + ': gene(s) ' + m.flipped.map((g) => geneLabel(g)).join(', ') + ' invertido(s): ' + m.before + ' → <b>' + m.after + '</b>'
      : 'Filho ' + (k + 1) + ': nenhum gene sorteado (' + m.after + ')').join('<br>');
    body.innerHTML = mutRow(1, true) + mutRow(2, true) + note(mtxt, p.mutation.some((m) => m.flipped.length) ? 'bad' : '');
    await wait(1500, tok);

    // 4. reparação
    setPhase(head + ': reparação', 'Enquanto o custo exceder o orçamento de ' + fmtMoney(e.budget) + ', tira-se o projeto selecionado de menor razão benefício/custo (empate: menor índice).', 3);
    body.innerHTML = '';
    for (let k = 1; k <= 2; k++) {
      const steps = p.repair[k - 1];
      const start = p.mutation[k - 1].after;
      const box = document.createElement('div');
      body.appendChild(box);
      const draw = (str, removing, gone, cost, msg, cls) => {
        const c = Array(n).fill('');
        if (removing != null) c[removing] = 'removing';
        const sel = start.split('').map((b, i) => (b === '1' ? i : -1)).filter((i) => i >= 0);
        box.innerHTML = `<div class="row"><span class="tag">Filho ${k}</span>${chromHTML(str, { labels: true, cls: c })}<span class="meta">custo ${fmtMoney(cost)}</span></div>
          <div class="row"><span class="tag"></span><span class="names">${sel.map((i) => `<span class="${gone.includes(i) || i === removing ? 'gone' : ''}">${geneLabel(i)}: ${esc(e.projects[i].name)}</span>`).join('') || '<span>nenhum projeto</span>'}</span></div>` +
          (msg ? note(msg, cls) : '');
      };
      const ev0 = GA.evaluate(GA.fromStr(start), e.projects, e.budgetCents);
      if (!steps.length) {
        draw(start, null, [], ev0.cost, 'Custo ' + fmtMoney(ev0.cost) + ' dentro do orçamento: viável, sem reparação.', 'ok');
        await wait(1000, tok);
        continue;
      }
      const gone = [];
      draw(start, null, gone, ev0.cost, '');
      await wait(700, tok);
      for (const s of steps) {
        const pr = e.projects[s.removed];
        draw(s.before, s.removed, gone, s.costBefore,
          'Custo ' + fmtMoney(s.costBefore) + ' &gt; ' + fmtMoney(e.budget) + ': remove ' + projName(s.removed) +
          ', que tem a menor razão benefício/custo: ' + fmtNum(pr.benefit) + ' / ' + fmtMoney(pr.cost) + ' = ' + fmtNum(s.ratio * 1000) + ' pts por R$ 1.000.', 'bad');
        await wait(1500, tok);
        gone.push(s.removed);
        draw(s.after, null, gone, s.costAfter, s.before + ' → <b>' + s.after + '</b> (custo ' + fmtMoney(s.costAfter) + ', benefício ' + fmtNum(s.benefitAfter) + ')' +
          (s.costAfter <= e.budgetCents / 100 ? '. Agora viável.' : ''), s.costAfter <= e.budgetCents / 100 ? 'ok' : '');
        await wait(900, tok);
      }
    }
    await wait(500, tok);

    // 5. avaliação
    setPhase(head + ': avaliação e inserção', 'Aptidão = benefício total da solução reparada.', 4);
    body.innerHTML = p.final.map((f, k) => `
      <div class="row ${f.kept ? '' : 'discarded'}"><span class="tag">Filho ${k + 1}</span>${chromHTML(f.chrom, { labels: true })}
      <span class="meta">custo ${fmtMoney(f.cost)}, aptidão <b>${fmtNum(f.fitness)}</b>, ${f.kept ? 'inserido como indivíduo #' + f.newIndex : 'descartado (resta apenas uma vaga)'}</span></div>`).join('');
    await wait(1600, tok);
  }

  function showSummary(log) {
    const e = state.engine;
    if (!log || log.generation === 0) { showInitStage(); return; }
    const s = log.stats;
    const pairs = log.pairs || [];
    setPhase('Geração ' + log.generation + ' concluída', 'Resumo da geração. Veja o log para os detalhes ou reproduza um par.', null);
    const crossed = pairs.filter((p) => p.crossed).length;
    const flips = pairs.reduce((a, p) => a + p.mutation.reduce((b, m) => b + m.flipped.length, 0), 0);
    const reps = pairs.reduce((a, p) => a + p.repair.filter((r) => r.length).length, 0);
    body.innerHTML = `
      <div class="row elite"><span class="tag">Elite</span><span class="meta">${log.elites.length ? log.elites.map((el) => '#' + el.from + ' ' + el.chrom + ' (' + fmtNum(el.fitness) + ')').join(', ') : 'nenhum'}</span></div>
      <div class="row"><span class="tag">Pares</span><span class="meta">${pairs.length} pares, ${crossed} cruzados, ${flips} bit(s) mutado(s), ${reps} filho(s) reparado(s)</span></div>
      <div class="row winner"><span class="tag">Melhor</span>${chromHTML(s.bestChrom, { labels: true })}<span class="meta">#${s.bestIndex}, aptidão ${fmtNum(s.best)}, média ${fmtNum(s.avg)}</span></div>
      ${e.finished && log.generation === e.params.generations ? note('Limite de gerações atingido. Melhor solução de toda a execução: <b>' + s.bestEverChrom + '</b> (aptidão ' + fmtNum(s.bestEver) + ').', 'ok') : ''}`;
  }

  function showInitStage() {
    const e = state.engine;
    const log = e.logs[0];
    setPhase('Geração 0: população inicial aleatória', 'Cada gene é sorteado com 50% de chance de ser 0 ou 1. O que passar do orçamento é reparado antes de avaliar.', null);
    if (!log || !log.init) { body.innerHTML = ''; return; }
    const show = log.init.slice(0, 30);
    body.innerHTML = show.map((x) => `
      <div class="row"><span class="tag">#${x.index}</span>${chromHTML(x.raw, { small: true })}
      ${x.repair.length ? '<span class="meta">→ reparado (remove ' + x.repair.map((s) => geneLabel(s.removed)).join(', ') + ') →</span>' + chromHTML(x.chrom, { small: true }) : '<span class="meta">viável</span>'}
      <span class="meta">aptidão ${fmtNum(x.fitness)}</span></div>`).join('') +
      (log.init.length > show.length ? note('Mais ' + (log.init.length - show.length) + ' indivíduos (veja a tabela da população).') : '');
  }

  $('btnReplay').addEventListener('click', () => {
    const e = state.engine;
    if (!e || state.running) return;
    const log = e.logs[e.logs.length - 1];
    const v = $('pairSelect').value;
    if (v === 'init') { showInitStage(); return; }
    playSafe(log, v);
  });
  $('btnSkip').addEventListener('click', () => cancelAnim());

  // Testes de validação
  $('btnTests').addEventListener('click', () => {
    const res = GATests.runAll(GA);
    const passed = res.filter((r) => r.pass).length;
    $('testsOut').innerHTML = `<p><b>${passed}/${res.length}</b> testes passaram.</p>` + res.map((r) => `
      <details${r.pass ? '' : ' open'}><summary class="${r.pass ? 'pass' : 'fail'}">${esc(r.id)}: ${esc(r.title)}</summary>
      <pre>${esc(r.lines.join('\n'))}</pre></details>`).join('');
  });

  // Inicialização
  renderProjects();
  fillParams();
  $('speedLabel').textContent = fmtNum(speed()) + '×';
  reset();
})();
