// Roda os testes pelo terminal: node tests/run-tests.js (--log mostra o log da execução 6.5)
const GA = require('../js/ga.js');
const T = require('../js/tests.js');

const results = T.runAll(GA);
let failed = 0;
for (const r of results) {
  console.log(`\n[${r.pass ? 'PASSOU' : 'FALHOU'}] ${r.id}: ${r.title}`);
  r.lines.forEach((l) => console.log('  ' + l));
  if (!r.pass) failed++;
}

const eng = new GA.Engine(T.PROJECTS_61, 7000, T.PARAMS_65);
eng.step();
if (process.argv.includes('--log')) {
  eng.logs.forEach((l) => console.log('\n' + GA.formatGeneration(l, eng.projects)));
  eng.runAll();
  console.log('\nHistórico (geração | melhor | média | melhor acumulado):');
  eng.history.forEach((h) => console.log(`${h.generation} | ${h.best} | ${h.avg} | ${h.bestEver} (${h.bestEverChrom})`));
}

console.log(`\n${results.length - failed}/${results.length} testes passaram.`);
process.exit(failed ? 1 : 0);
