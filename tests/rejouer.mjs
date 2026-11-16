// Replays a recorded CSV through the live calculation (finger + pulse, twice per second), as the page would
// have lived it.   node tests/rejouer.mjs fichier.csv [fichier2.csv ...]
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ici = join(dirname(fileURLToPath(import.meta.url)), '..');
const page = readFileSync(join(ici, 'index.html'), 'utf8');
const code = page.slice(page.indexOf('// <calcul>'), page.indexOf('// </calcul>'));
const { lireCsv, nouveauSuivi, suivre } = new Function(code + '\nreturn { lireCsv, nouveauSuivi, suivre };')();

for (const nom of process.argv.slice(2)) {
  const ech = lireCsv(readFileSync(nom, 'utf8')), etat = nouveauSuivi(), fin = ech[ech.length - 1].t;
  let avec = 0, tours = 0, premier = null, ligne = '';
  for (let t = 0.5; t <= fin; t += 0.5) {
    const direct = ech.filter(e => e.t <= t && e.t > t - 45);
    suivre(etat, direct, t); tours++;
    if (etat.rythme.length) { avec++; if (premier === null) premier = t; }
    if (Math.abs(t % 5) < 0.01) ligne += (etat.rythme.length ? etat.rythme[etat.rythme.length - 1].bpm.toFixed(0) : etat.doigt ? '?' : '-') + ' ';
  }
  console.log(nom.split('/').pop() + ' : ' + fin.toFixed(0) + ' s, pouls affiché ' + (100 * avec / tours).toFixed(0) + ' % du temps, premier à ' +
    (premier === null ? 'jamais' : premier + ' s'));
  console.log('   toutes les 5 s (- pas de doigt, ? doigt sans pouls) : ' + ligne);
  console.log('   dernier diagnostic : ' + etat.diagnostic);
}
