// Testes da seção 6 do enunciado. Rodam no botão da página e com node tests/run-tests.js.
(function (root, factory) {
  const T = factory();
  if (typeof module === 'object' && module.exports) module.exports = T;
  else root.GATests = T;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PROJECTS_61 = [
    { name: 'Melhoria da iluminação', cost: 4000, benefit: 7 },
    { name: 'Instalação de bicicletários', cost: 3000, benefit: 5 },
    { name: 'Aquisição de bancos', cost: 2000, benefit: 3 },
    { name: 'Reforma de espaço de convivência', cost: 5000, benefit: 8 },
  ];
  const PARAMS_65 = { popSize: 20, generations: 50, crossoverRate: 0.8, mutationRate: 0.05, tournamentSize: 2, eliteCount: 1, seed: 42 };

  function runAll(GA) {
    const results = [];
    const P = GA.normalizeProjects(PROJECTS_61);
    const B7 = GA.cents(7000);
    const S = GA.toStr, F = GA.fromStr, M = GA.fmtMoney, N = GA.fmtNum;

    function test(id, title, fn) {
      const lines = [];
      let pass = true;
      const check = (cond, msg) => { lines.push((cond ? 'ok   ' : 'ERRO ') + msg); if (!cond) pass = false; };
      const info = (msg) => lines.push('  ' + msg);
      try { fn(check, info); } catch (e) { pass = false; lines.push('ERRO Exceção: ' + e.message); }
      results.push({ id, title, pass, lines });
    }

    // 6.2
    test('6.2', 'Avaliação de uma solução (1100, orçamento R$ 7.000)', (check, info) => {
      const ev = GA.evaluate(F('1100'), P, B7);
      const names = ev.selected.map(GA.geneLabel).join(' e ');
      info('Saída: projetos ' + names + '; custo ' + M(ev.cost) + '; benefício ' + N(ev.benefit) + '; saldo ' + M(ev.balance) + '; viável: ' + (ev.feasible ? 'sim' : 'não') + '; aptidão ' + N(GA.repair(F('1100'), P, B7).eval.benefit));
      check(names === 'A e B', 'projetos A e B');
      check(ev.cost === 7000 && ev.benefit === 12 && ev.balance === 0 && ev.feasible, 'custo R$ 7.000, benefício 12, saldo R$ 0, viável');
      const expected = { '0000': [0, 0], '1000': [4000, 7], '0100': [3000, 5], '0010': [2000, 3], '0001': [5000, 8], '1100': [7000, 12], '1010': [6000, 10], '0110': [5000, 8], '0011': [7000, 11] };
      const feasible = [];
      for (let m = 0; m < 16; m++) {
        const s = m.toString(2).padStart(4, '0');
        const e = GA.evaluate(F(s), P, B7);
        if (e.feasible) feasible.push(s);
      }
      check(feasible.length === 9 && feasible.every((s) => expected[s]), 'exatamente as 9 soluções viáveis listadas no enunciado: ' + feasible.join(', '));
      let ok = true;
      for (const s in expected) {
        const e = GA.evaluate(F(s), P, B7);
        if (e.cost !== expected[s][0] || e.benefit !== expected[s][1]) ok = false;
      }
      check(ok, 'custo e benefício conferem para todas as soluções viáveis');
    });

    // 6.3
    test('6.3', 'Reparação de uma solução inviável (1111)', (check, info) => {
      const ev0 = GA.evaluate(F('1111'), P, B7);
      const r = GA.repair(F('1111'), P, B7);
      info('1111 → custo ' + M(ev0.cost) + '; benefício ' + N(ev0.benefit));
      r.steps.forEach((s) => info('remove ' + GA.geneLabel(s.removed) + ' (razão ' + N(s.ratio * 1000) + ' pts/mil R$) → ' + s.after + ' → custo ' + M(s.costAfter) + '; benefício ' + N(s.benefitAfter)));
      check(ev0.cost === 14000 && ev0.benefit === 23, '1111: custo R$ 14.000 e benefício 23');
      check(r.steps.length === 2 && r.steps[0].removed === 2 && r.steps[0].after === '1101' && r.steps[0].costAfter === 12000 && r.steps[0].benefitAfter === 20, 'passo 1: remove C → 1101 (R$ 12.000; 20)');
      check(r.steps[1] && r.steps[1].removed === 3 && r.steps[1].after === '1100' && r.steps[1].costAfter === 7000 && r.steps[1].benefitAfter === 12, 'passo 2: remove D → 1100 (R$ 7.000; 12)');
      check(r.eval.feasible, 'solução final viável');
    });

    // 6.4
    test('6.4a', 'Cruzamento e mutação com escolhas controladas', (check, info) => {
      const [c1, c2] = GA.crossover(F('1100'), F('0011'), 2);
      info('Cruzamento: 11|00 + 00|11 → filho 1 = ' + S(c1) + '; filho 2 = ' + S(c2));
      check(S(c1) === '1111' && S(c2) === '0000', 'cruzamento produz 1111 e 0000');
      const m1 = GA.mutateWithMask(c1, [true, false, false, false]);
      const m2 = GA.mutateWithMask(c2, [false, false, false, false]);
      info('Mutação: filho 1 = ' + S(m1.chrom) + '; filho 2 = ' + S(m2.chrom));
      check(S(m1.chrom) === '0111' && S(m2.chrom) === '0000', 'mutação produz 0111 e 0000');
      const r1 = GA.repair(m1.chrom, P, B7);
      const r2 = GA.repair(m2.chrom, P, B7);
      info('Reparação do filho 1: ' + GA.formatRepair(r1.steps, P));
      info('Reparação do filho 2: ' + (r2.steps.length ? GA.formatRepair(r2.steps, P) : 'permanece ' + S(r2.chrom)));
      check(r1.steps.map((s) => s.after).join(',') === '0101,0100' && r1.steps[0].removed === 2 && r1.steps[1].removed === 3, 'filho 1: 0111 → 0101 → 0100 (remove C e depois D)');
      check(r2.steps.length === 0 && S(r2.chrom) === '0000', 'filho 2 permanece 0000');
      info('Avaliação final: filho 1 = ' + S(r1.chrom) + ', custo ' + M(r1.eval.cost) + ', aptidão ' + N(r1.eval.benefit) + '; filho 2 = ' + S(r2.chrom) + ', custo ' + M(r2.eval.cost) + ', aptidão ' + N(r2.eval.benefit));
      check(r1.eval.cost === 3000 && r1.eval.benefit === 5 && r2.eval.cost === 0 && r2.eval.benefit === 0, 'filho 1: R$ 3.000 / 5; filho 2: R$ 0 / 0');
    });

    test('6.4b', 'Limites das taxas de mutação e cruzamento', (check, info) => {
      const rng = GA.createRng(123);
      let ok0 = true, ok100 = true;
      for (let k = 0; k < 500; k++) {
        const c = Array.from({ length: 4 }, () => (rng() < 0.5 ? 1 : 0));
        const a = GA.mutate(c, 0, rng); if (a.flipped.length !== 0 || S(a.chrom) !== S(c)) ok0 = false;
        const b = GA.mutate(c, 1, rng); if (b.flipped.length !== 4 || !b.chrom.every((g, i) => g === 1 - c[i])) ok100 = false;
      }
      check(ok0, 'mutação 0%: nenhum gene invertido (500 cromossomos)');
      check(ok100, 'mutação 100%: todos os genes invertidos antes da reparação (500 cromossomos)');
      // com cruzamento 0% e mutação 0% os filhos são cópias dos pais
      const eng = new GA.Engine(PROJECTS_61, 7000, Object.assign({}, PARAMS_65, { crossoverRate: 0, mutationRate: 0, generations: 5 }));
      let copies = true, any = false;
      while (!eng.finished) {
        const log = eng.step();
        log.pairs.forEach((p) => { any = true; if (p.crossed || p.afterCrossover[0] !== p.parents[0] || p.afterCrossover[1] !== p.parents[1]) copies = false; });
      }
      check(any && copies, 'cruzamento 0%: filhos copiam os pais antes da mutação (5 gerações)');
      const eng2 = new GA.Engine(PROJECTS_61, 7000, Object.assign({}, PARAMS_65, { crossoverRate: 1, generations: 5 }));
      let allCrossed = true, cutsOk = true;
      while (!eng2.finished) eng2.step().pairs.forEach((p) => { if (!p.crossed) allCrossed = false; if (!(p.cut >= 1 && p.cut <= 3)) cutsOk = false; });
      check(allCrossed, 'cruzamento 100%: todo par é cruzado');
      check(cutsOk, 'corte sempre entre o 1º e o penúltimo gene (após o gene 1, 2 ou 3)');
      const eng3 = new GA.Engine(PROJECTS_61, 7000, Object.assign({}, PARAMS_65, { mutationRate: 1, generations: 3 }));
      let mutAll = true;
      while (!eng3.finished) eng3.step().pairs.forEach((p) => p.mutation.forEach((m) => { if (m.flipped.length !== 4) mutAll = false; }));
      check(mutAll, 'mutação 100% no motor: os 4 genes de cada descendente são invertidos');
    });

    test('6.4c', 'Seleção por torneio isolada', (check, info) => {
      const fitness = [7, 11, 12]; // 1000, 0011, 1100
      const w = GA.tournamentWinner([0, 1, 2], fitness);
      info('Candidatos: #0 1000 (7), #1 0011 (11), #2 1100 (12) → vencedor #' + w);
      check(w === 2, 'vencedor é 1100 (aptidão 12)');
      const tie = [5, 8, 8, 3, 8];
      const wt = GA.tournamentWinner([4, 2, 1], tie);
      info('Empate: candidatos #4, #2, #1 com aptidão 8 → vencedor #' + wt);
      check(wt === 1, 'empate resolvido pelo menor índice na população (#1)');
      const rng = GA.createRng(7);
      let distinct = true;
      for (let k = 0; k < 1000; k++) { const c = GA.sampleDistinct(rng, 20, 5); if (new Set(c).size !== 5) distinct = false; }
      check(distinct, 'candidatos de cada torneio são distintos (1000 sorteios de 5 entre 20)');
      const t = GA.tournament([3, 3], 2, GA.createRng(1));
      check(t.winner === 0, 'torneio com tamanho = população e empate total → índice 0');
    });

    // 6.5
    test('6.5a', 'Execução completa (pop. 20, 50 ger., cx 80%, mut 5%, torneio 2, elite 1, semente 42)', (check, info) => {
      const eng = new GA.Engine(PROJECTS_61, 7000, PARAMS_65);
      const best = eng.runAll();
      const ev = GA.evaluate(best.chrom, P, B7);
      const h = eng.history;
      info('Melhor solução: ' + S(best.chrom) + ' (projetos ' + (ev.selected.map(GA.geneLabel).join(', ') || 'nenhum') + '); custo ' + M(ev.cost) + '; benefício ' + N(ev.benefit) + '; saldo ' + M(ev.balance) + '; encontrada na geração ' + best.generation);
      info('Ger. 0: melhor ' + N(h[0].best) + ', média ' + N(h[0].avg) + ' | Ger. 50: melhor ' + N(h[50].best) + ', média ' + N(h[50].avg));
      check(h.length === 51, 'histórico com 51 registros (gerações 0 a 50)');
      check(h.every((r, i) => i === 0 || r.bestEver >= h[i - 1].bestEver), 'melhor benefício acumulado nunca diminui');
      check(h.every((r, i) => i === 0 || r.best >= h[i - 1].best), 'com 1 elite, a melhor aptidão da população nunca diminui');
      check(ev.feasible && ev.cost <= 7000 && ev.benefit <= 12 && ev.benefit === best.fitness, 'solução final viável e totais compatíveis com o cromossomo');
      check(eng.population.length === 20, 'tamanho da população constante');
      const eng2 = new GA.Engine(PROJECTS_61, 7000, PARAMS_65); eng2.runAll();
      check(JSON.stringify(eng2.history) === JSON.stringify(h), 'mesma semente e parâmetros reproduzem exatamente a execução');
    });

    test('6.5b', 'Efeito da taxa de mutação: 1% × 20% (sementes 1 a 5)', (check, info) => {
      const table = {};
      [0.01, 0.2].forEach((rate) => {
        const rows = [];
        for (let seed = 1; seed <= 5; seed++) {
          const eng = new GA.Engine(PROJECTS_61, 7000, Object.assign({}, PARAMS_65, { mutationRate: rate, seed }));
          const b = eng.runAll();
          rows.push({ seed, best: b.fitness, chrom: S(b.chrom), gen: b.generation, finalAvg: eng.history[50].avg });
        }
        table[rate] = rows;
        const mean = rows.reduce((s, r) => s + r.best, 0) / rows.length;
        const hits = rows.filter((r) => r.best === 12).length;
        const avgFinal = rows.reduce((s, r) => s + r.finalAvg, 0) / rows.length;
        info('Mutação ' + rate * 100 + '%: ' + rows.map((r) => 's' + r.seed + '=' + N(r.best) + ' (' + r.chrom + ', ger. ' + r.gen + ')').join('; '));
        info('  → média do melhor benefício final ' + N(mean) + '; execuções com 12: ' + hits + '/5; média da aptidão média da ger. 50: ' + N(avgFinal));
        check(rows.every((r) => r.best <= 12), 'mutação ' + rate * 100 + '%: nenhum resultado acima do ótimo');
      });
      results.mutationTable = table;
    });

    // 6.6
    test('6.6', 'Limites de orçamento (R$ 0 e R$ 14.000)', (check, info) => {
      const eng = new GA.Engine(PROJECTS_61, 0, PARAMS_65);
      let all0 = eng.population.every((x) => S(x.chrom) === '0000' && x.fitness === 0 && x.cost === 0);
      check(all0, 'orçamento R$ 0: população inicial reparada é toda 0000 (custo, benefício e aptidão 0)');
      eng.runAll();
      check(eng.history.every((r) => r.best === 0 && r.avg === 0) && eng.population.every((x) => S(x.chrom) === '0000'), 'orçamento R$ 0: todas as 51 gerações contêm apenas 0000');
      const B14 = GA.cents(14000);
      const ev = GA.evaluate(F('1111'), P, B14);
      info('Orçamento R$ 14.000, 1111: custo ' + M(ev.cost) + '; benefício ' + N(ev.benefit) + '; saldo ' + M(ev.balance) + '; viável: ' + (ev.feasible ? 'sim' : 'não'));
      check(ev.feasible && ev.cost === 14000 && ev.benefit === 23 && ev.balance === 0, '1111 viável: custo R$ 14.000, benefício 23, saldo R$ 0');
      check(GA.repair(F('1111'), P, B14).steps.length === 0, '1111 não sofre reparação');
      const e2 = new GA.Engine(PROJECTS_61, 14000, PARAMS_65); const b = e2.runAll();
      info('Execução completa com R$ 14.000 (semente 42): melhor ' + S(b.chrom) + ', benefício ' + N(b.fitness));
    });

    // Extras
    test('extra', 'Elitismo 0 e população ímpar (última vaga)', (check, info) => {
      const eng = new GA.Engine(PROJECTS_61, 7000, Object.assign({}, PARAMS_65, { popSize: 5, eliteCount: 0, generations: 3 }));
      const log = eng.step();
      check(log.elites.length === 0 && log.pairs.length === 3, 'elite 0: 5 vagas preenchidas por 3 pares, sem preservação');
      check(log.pairs[2].final[0].kept && !log.pairs[2].final[1].kept, 'última vaga: retém apenas o 1º filho do último par');
      check(eng.population.length === 5, 'tamanho da população permanece 5');
      const e2 = new GA.Engine(PROJECTS_61, 7000, Object.assign({}, PARAMS_65, { eliteCount: 3, generations: 1 }));
      const pop0 = e2.population.map((x) => x.fitness);
      const l2 = e2.step();
      const order = pop0.map((_, i) => i).sort((a, b) => pop0[b] - pop0[a] || a - b).slice(0, 3);
      check(JSON.stringify(l2.elites.map((e) => e.from)) === JSON.stringify(order) && l2.elites.every((e, k) => e2.population[k].chrom.join('') === e.chrom), 'elite 3: os 3 melhores (empate → menor índice) copiados sem modificação');
    });

    return results;
  }

  return { runAll, PROJECTS_61, PARAMS_65 };
});
