// Algoritmo genético para escolher projetos dentro de um orçamento.
// Roda no navegador (window.GA) e no Node (module.exports), para poder testar pelo terminal.
// Dinheiro fica em centavos e benefício em centésimos, sempre inteiros, para não ter erro de ponto flutuante.
// Cromossomo: array de 0/1, a posição i é o projeto i.
(function (root, factory) {
  const GA = factory();
  if (typeof module === 'object' && module.exports) module.exports = GA;
  else root.GA = GA;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Gerador pseudoaleatório com semente (Mulberry32)
  function createRng(seed) {
    let a = (Number(seed) | 0) >>> 0;
    const rng = function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return rng;
  }

  // inteiro sorteado entre min e max, incluindo os dois
  function randInt(rng, min, max) {
    return min + Math.floor(rng() * (max - min + 1));
  }

  // Utilidades
  const toStr = (c) => c.join('');
  const fromStr = (s) => s.split('').map(Number);
  const geneLabel = (i) => String.fromCharCode(65 + i);
  const cents = (reais) => Math.round(Number(reais) * 100);
  const units = (benefit) => Math.round(Number(benefit) * 100);

  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const num = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
  const fmtMoney = (reais) => brl.format(reais);
  const fmtNum = (x) => num.format(x);

  // acrescenta custo e benefício em inteiros a cada projeto
  function normalizeProjects(projects) {
    return projects.map((p) => ({
      name: String(p.name),
      cost: Number(p.cost),
      benefit: Number(p.benefit),
      costCents: cents(p.cost),
      benefitUnits: units(p.benefit),
    }));
  }

  // Avaliação
  // calcula custo, benefício, saldo e se cabe no orçamento
  function evaluate(chrom, projects, budgetCents) {
    let costCents = 0;
    let benefitUnits = 0;
    const selected = [];
    for (let i = 0; i < chrom.length; i++) {
      if (chrom[i] === 1) {
        costCents += projects[i].costCents;
        benefitUnits += projects[i].benefitUnits;
        selected.push(i);
      }
    }
    return {
      selected,
      costCents,
      cost: costCents / 100,
      benefit: benefitUnits / 100,
      balance: (budgetCents - costCents) / 100,
      feasible: costCents <= budgetCents,
    };
  }

  // Reparação
  // Enquanto passar do orçamento, tira o projeto de menor benefício/custo (empate: menor índice).
  // A razão é comparada por multiplicação cruzada com BigInt, sem divisão.
  // Devolve o cromossomo reparado, a avaliação e os passos feitos.
  function repair(chrom, projects, budgetCents) {
    const c = chrom.slice();
    const steps = [];
    let ev = evaluate(c, projects, budgetCents);
    while (!ev.feasible) {
      let worst = -1;
      for (const i of ev.selected) {
        if (worst === -1) { worst = i; continue; }
        const lhs = BigInt(projects[i].benefitUnits) * BigInt(projects[worst].costCents);
        const rhs = BigInt(projects[worst].benefitUnits) * BigInt(projects[i].costCents);
        if (lhs < rhs) worst = i; // só troca se for menor, então no empate fica o menor índice
      }
      const before = toStr(c);
      const prev = ev;
      c[worst] = 0;
      ev = evaluate(c, projects, budgetCents);
      steps.push({
        removed: worst,
        before,
        after: toStr(c),
        costBefore: prev.cost,
        benefitBefore: prev.benefit,
        costAfter: ev.cost,
        benefitAfter: ev.benefit,
        ratio: projects[worst].benefit / projects[worst].cost,
      });
    }
    return { chrom: c, steps, eval: ev };
  }

  // Operadores
  // sorteia k índices diferentes entre 0 e n-1
  function sampleDistinct(rng, n, k) {
    const idx = Array.from({ length: n }, (_, i) => i);
    for (let i = 0; i < k; i++) {
      const j = randInt(rng, i, n - 1);
      const t = idx[i]; idx[i] = idx[j]; idx[j] = t;
    }
    return idx.slice(0, k);
  }

  // vence a maior aptidão; no empate, o menor índice
  function tournamentWinner(candidates, fitness) {
    let best = candidates[0];
    for (const c of candidates) {
      if (fitness[c] > fitness[best] || (fitness[c] === fitness[best] && c < best)) best = c;
    }
    return best;
  }

  // sorteia os candidatos e escolhe o vencedor
  function tournament(fitness, k, rng) {
    const candidates = sampleDistinct(rng, fitness.length, k);
    return { candidates, winner: tournamentWinner(candidates, fitness) };
  }

  // cruzamento de um ponto, cortando depois do gene `cut`
  function crossover(p1, p2, cut) {
    return [
      p1.slice(0, cut).concat(p2.slice(cut)),
      p2.slice(0, cut).concat(p1.slice(cut)),
    ];
  }

  // inverte os genes marcados na máscara
  function mutateWithMask(chrom, mask) {
    const out = chrom.slice();
    const flipped = [];
    for (let i = 0; i < out.length; i++) {
      if (mask[i]) { out[i] = 1 - out[i]; flipped.push(i); }
    }
    return { chrom: out, flipped };
  }

  // cada gene é invertido com probabilidade `rate`
  function mutate(chrom, rate, rng) {
    const mask = chrom.map(() => rng() < rate);
    return mutateWithMask(chrom, mask);
  }

  // Motor do AG
  // params: popSize, generations, crossoverRate e mutationRate (0 a 1), tournamentSize, eliteCount, seed
  // projects: [{ name, cost, benefit }] e budget em reais
  class Engine {
    constructor(projects, budget, params) {
      this.projects = normalizeProjects(projects);
      this.budget = Number(budget);
      this.budgetCents = cents(budget);
      this.params = Object.assign({}, params);
      this.reset();
    }

    get nGenes() { return this.projects.length; }
    get finished() { return this.generation >= this.params.generations; }

    // volta à semente, apaga o histórico e cria a geração 0
    reset() {
      this.rng = createRng(this.params.seed);
      this.generation = 0;
      this.history = [];
      this.logs = [];
      this.bestEver = null;

      const init = [];
      this.population = [];
      for (let k = 0; k < this.params.popSize; k++) {
        const raw = [];
        for (let g = 0; g < this.nGenes; g++) raw.push(this.rng() < 0.5 ? 1 : 0);
        const rep = repair(raw, this.projects, this.budgetCents);
        const ind = this._individual(rep, { type: 'init' });
        this.population.push(ind);
        init.push({ index: k, raw: toStr(raw), repair: rep.steps, chrom: toStr(rep.chrom), fitness: ind.fitness, cost: ind.cost });
      }
      const log = { generation: 0, init, elites: [], pairs: [] };
      this._record(log);
      return log;
    }

    _individual(rep, origin) {
      return {
        chrom: rep.chrom,
        fitness: rep.eval.benefit,
        cost: rep.eval.cost,
        origin,
      };
    }

    _record(log) {
      const pop = this.population;
      let bestIdx = 0, sum = 0;
      for (let i = 0; i < pop.length; i++) {
        sum += pop[i].fitness;
        if (pop[i].fitness > pop[bestIdx].fitness) bestIdx = i;
      }
      const best = pop[bestIdx];
      if (!this.bestEver || best.fitness > this.bestEver.fitness) {
        const ev = evaluate(best.chrom, this.projects, this.budgetCents);
        this.bestEver = {
          chrom: best.chrom.slice(),
          fitness: best.fitness,
          generation: this.generation,
          index: bestIdx,
          eval: ev,
        };
      }
      const rec = {
        generation: this.generation,
        best: best.fitness,
        bestIndex: bestIdx,
        bestChrom: toStr(best.chrom),
        avg: Math.round((sum / pop.length) * 10000) / 10000,
        bestEver: this.bestEver.fitness,
        bestEverChrom: toStr(this.bestEver.chrom),
      };
      log.stats = rec;
      this.history.push(rec);
      this.logs.push(log);
      return rec;
    }

    // faz uma geração e devolve o log dela (null se já terminou)
    step() {
      if (this.finished) return null;
      const P = this.params;
      const N = P.popSize;
      const n = this.nGenes;
      const old = this.population;
      const fit = old.map((x) => x.fitness);
      const next = [];
      const elites = [];

      // elitismo: copia os melhores sem mexer (empate: menor índice)
      const order = old.map((_, i) => i).sort((a, b) => fit[b] - fit[a] || a - b);
      for (let e = 0; e < P.eliteCount; e++) {
        const i = order[e];
        next.push({ chrom: old[i].chrom.slice(), fitness: old[i].fitness, cost: old[i].cost, origin: { type: 'elite', from: i } });
        elites.push({ from: i, newIndex: e, chrom: toStr(old[i].chrom), fitness: old[i].fitness });
      }

      // o resto das vagas é de filhos, com pais sempre da população anterior
      const pairs = [];
      while (next.length < N) {
        const pairNo = pairs.length + 1;
        const t1 = tournament(fit, P.tournamentSize, this.rng);
        const t2 = tournament(fit, P.tournamentSize, this.rng);
        const p1 = old[t1.winner].chrom;
        const p2 = old[t2.winner].chrom;

        const crossed = this.rng() < P.crossoverRate;
        let cut = null, c1, c2;
        if (crossed) {
          cut = randInt(this.rng, 1, n - 1); // corte entre o 1º e o penúltimo gene
          [c1, c2] = crossover(p1, p2, cut);
        } else {
          c1 = p1.slice(); c2 = p2.slice();
        }

        const m1 = mutate(c1, P.mutationRate, this.rng);
        const m2 = mutate(c2, P.mutationRate, this.rng);
        const r1 = repair(m1.chrom, this.projects, this.budgetCents);
        const r2 = repair(m2.chrom, this.projects, this.budgetCents);

        const keep2 = next.length + 2 <= N;
        next.push(this._individual(r1, { type: 'child', pair: pairNo, child: 1 }));
        const idx1 = next.length - 1;
        let idx2 = null;
        if (keep2) {
          next.push(this._individual(r2, { type: 'child', pair: pairNo, child: 2 }));
          idx2 = next.length - 1;
        }

        const ccy = (t) => t.candidates.map((i) => ({ index: i, chrom: toStr(old[i].chrom), fitness: fit[i] }));
        pairs.push({
          pair: pairNo,
          t1: { candidates: ccy(t1), winner: t1.winner },
          t2: { candidates: ccy(t2), winner: t2.winner },
          parents: [toStr(p1), toStr(p2)],
          parentIdx: [t1.winner, t2.winner],
          crossed,
          cut,
          afterCrossover: [toStr(c1), toStr(c2)],
          mutation: [
            { before: toStr(c1), flipped: m1.flipped, after: toStr(m1.chrom) },
            { before: toStr(c2), flipped: m2.flipped, after: toStr(m2.chrom) },
          ],
          repair: [r1.steps, r2.steps],
          final: [
            { chrom: toStr(r1.chrom), cost: r1.eval.cost, fitness: r1.eval.benefit, newIndex: idx1, kept: true },
            { chrom: toStr(r2.chrom), cost: r2.eval.cost, fitness: r2.eval.benefit, newIndex: idx2, kept: keep2 },
          ],
        });
      }

      this.population = next;
      this.generation++;
      const log = { generation: this.generation, elites, pairs };
      this._record(log);
      return log;
    }

    // roda até o fim
    runAll() {
      while (!this.finished) this.step();
      return this.bestEver;
    }
  }

  // Formatação textual dos logs
  function ordinal(k) { return k + 'º'; }
  function joinPt(list) {
    if (list.length <= 1) return list.join('');
    return list.slice(0, -1).join(', ') + ' e ' + list[list.length - 1];
  }

  function formatRepair(steps, projects) {
    const chain = [steps[0].before].concat(steps.map((s) => s.after)).join(' → ');
    const names = steps.map((s) => geneLabel(s.removed));
    return chain + ' (remove ' + joinPt(names) + ')';
  }

  function formatPair(p, projects) {
    const tour = (t) => '[' + t.candidates.map((c) => '#' + c.index + ' ' + c.chrom + ' (' + fmtNum(c.fitness) + ')').join(', ') + '] → #' + t.winner;
    const parts = [];
    parts.push('Par ' + p.pair + ': torneio 1 ' + tour(p.t1) + '; torneio 2 ' + tour(p.t2) + '.');
    parts.push('Pais: ' + p.parents[0] + ' e ' + p.parents[1] + ';');
    if (p.crossed) {
      parts.push('corte após o ' + ordinal(p.cut) + ' gene (' + p.parents[0].slice(0, p.cut) + '|' + p.parents[0].slice(p.cut) +
        ' + ' + p.parents[1].slice(0, p.cut) + '|' + p.parents[1].slice(p.cut) + '); filhos: ' + p.afterCrossover[0] + ' e ' + p.afterCrossover[1] + ';');
    } else {
      parts.push('sem cruzamento (filhos copiam os pais): ' + p.afterCrossover[0] + ' e ' + p.afterCrossover[1] + ';');
    }
    const muts = [];
    p.mutation.forEach((m, k) => {
      if (m.flipped.length) {
        muts.push('mutação no' + (m.flipped.length > 1 ? 's genes ' : ' gene ') + joinPt(m.flipped.map((g) => String(g + 1))) +
          ' do filho ' + (k + 1) + ': ' + m.before + ' → ' + m.after);
      }
    });
    parts.push(muts.length ? muts.join('; ') + ';' : 'sem mutação;');
    const reps = [];
    p.repair.forEach((steps, k) => {
      if (steps.length) reps.push('reparação do filho ' + (k + 1) + ': ' + formatRepair(steps, projects));
    });
    parts.push(reps.length ? reps.join('; ') + ';' : 'sem reparação;');
    const fin = p.final.map((f, k) =>
      'filho ' + (k + 1) + ' = ' + f.chrom + ' (custo ' + fmtMoney(f.cost) + ', aptidão ' + fmtNum(f.fitness) + ')' +
      (f.kept ? ' → indivíduo #' + f.newIndex : ' → descartado (resta apenas uma vaga)'));
    parts.push('resultado: ' + fin.join('; ') + '.');
    return parts.join(' ');
  }

  function formatGeneration(log, projects) {
    const lines = [];
    lines.push('=== Geração ' + log.generation + ' ===');
    if (log.init) {
      lines.push('População inicial (genes sorteados com P(1) = 0,5):');
      log.init.forEach((x) => {
        lines.push('  #' + x.index + ': ' + x.raw +
          (x.repair.length ? ' → reparação: ' + formatRepair(x.repair, projects) : ' (viável)') +
          ' → aptidão ' + fmtNum(x.fitness) + ', custo ' + fmtMoney(x.cost));
      });
    }
    if (log.elites && log.elites.length) {
      lines.push('Elitismo: ' + log.elites.map((e) => '#' + e.from + ' ' + e.chrom + ' (aptidão ' + fmtNum(e.fitness) + ') → #' + e.newIndex).join('; ') + '. Copiados sem modificação.');
    } else if (log.generation > 0) {
      lines.push('Elitismo: nenhum indivíduo preservado (quantidade 0).');
    }
    (log.pairs || []).forEach((p) => lines.push(formatPair(p, projects)));
    const s = log.stats;
    if (s) {
      lines.push('Estatísticas: melhor aptidão ' + fmtNum(s.best) + ' (#' + s.bestIndex + ' ' + s.bestChrom + '), média ' +
        fmtNum(s.avg) + ', melhor acumulado ' + fmtNum(s.bestEver) + ' (' + s.bestEverChrom + ').');
    }
    return lines.join('\n');
  }

  return {
    createRng, randInt, toStr, fromStr, geneLabel, fmtMoney, fmtNum, cents,
    normalizeProjects, evaluate, repair,
    sampleDistinct, tournamentWinner, tournament, crossover, mutateWithMask, mutate,
    Engine, formatPair, formatGeneration, formatRepair,
  };
});
