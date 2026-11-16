// Checks the calculation part of index.html (between <calcul> and </calcul>) without a browser.
//   node tests/forme.test.mjs
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = join(dirname(fileURLToPath(import.meta.url)), '..');
const page = readFileSync(join(ici, 'index.html'), 'utf8');
const code = page.slice(page.indexOf('// <calcul>'), page.indexOf('// </calcul>'));
const { analyser, lireCsv, ecrireCsv, simuler, ondeModele, changements, horloge, reconstruire, rythmeInstantane } =
  new Function(code + '\nreturn { analyser, lireCsv, ecrireCsv, simuler, ondeModele, changements, horloge, reconstruire, rythmeInstantane };')();

let echecs = 0;
const verifier = (ok, texte) => { console.log((ok ? 'ok    ' : 'ECHEC ') + texte); if (!ok) echecs++; };

// 1. real recordings (not in the public repository: they are personal pulse data; the part is skipped without them)
if (existsSync(join(ici, 'essai2-doigt-sol-gauche.csv')) && existsSync(join(ici, 'essai1-doigt.csv'))) {
const e2 = analyser(lireCsv(readFileSync(join(ici, 'essai2-doigt-sol-gauche.csv'), 'utf8')));
verifier(e2.doigt && e2.doigt.cle === 's0', 'essai 2 : doigt trouvé sur le sol gauche');
const f = e2.forme;
verifier(!f.erreur && Math.abs(f.bpm - 83) < 1.5, 'essai 2 : pouls ' + f.bpm.toFixed(1) + ' /min');
verifier(f.amplitude > 12 && f.amplitude < 19, 'essai 2 : amplitude ' + f.amplitude.toFixed(1) + ', dispersion ' + f.dispersion.toFixed(2) +
  ', montée ' + (1000 * f.montee).toFixed(0) + ' ms, ' + f.battements + ' battements, horloge ' + f.fs.toFixed(3) + ' Hz (concentration ' + f.concentration.toFixed(2) + ')');
console.log('       intervalles', JSON.stringify(f.intervalles));
const lo = Math.min(...f.courbe.map(p => p.v)), hi = Math.max(...f.courbe.map(p => p.v));
for (const p of f.courbe)
  console.log('       ' + String(Math.round(1000 * (p.u - f.debut) * f.periode)).padStart(5) + ' ms ' + p.v.toFixed(1).padStart(6) + ' ' + '#'.repeat(1 + Math.round(40 * (p.v - lo) / (hi - lo))));
const e1 = analyser(lireCsv(readFileSync(join(ici, 'essai1-doigt.csv'), 'utf8')));
verifier(e1.doigt === null, 'essai 1 (doigt sur le capteur de couleur) : aucun doigt sur les capteurs de sol');
} else console.log('       (essai 1 et 2 absents : partie ignorée)');

// 2. simulated beats: is the model shape found again?
const erreurs = [], faux = [];
let trouves = 0;
for (let i = 0; i < 20; i++) {
  const ech = simuler('pouls', 60, 55 + Math.random() * 60), bpm = ech.bpmReel, r = analyser(ech);
  if (!r.doigt || r.doigt.cle !== 's0' || r.forme.erreur) continue;
  trouves++;
  // compare the mean curve with the model, both normalised, best shift
  const c = r.forme.courbe, n = c.length, v = c.map(p => p.v), a = Math.min(...v), b = Math.max(...v);
  let mieux = Infinity;
  for (let d = 0; d < 200; d++) {
    let s = 0;
    for (const p of c) { const m = (ondeModele((p.u + d / 200) % 1) + 0.05) / 1.03; s += ((p.v - a) / (b - a) - m) ** 2; }
    mieux = Math.min(mieux, Math.sqrt(s / n));
  }
  erreurs.push(mieux);
  faux.push(Math.abs(r.forme.bpm - bpm));
}
erreurs.sort((p, q) => p - q);
verifier(trouves === 20, 'simulation 60 s : doigt trouvé ' + trouves + ' fois sur 20');
verifier(erreurs[erreurs.length - 1] < 0.12, 'simulation 60 s : écart entre forme retrouvée et modèle, médiane ' +
  (100 * erreurs[erreurs.length >> 1]).toFixed(1) + ' %, pire ' + (100 * erreurs[erreurs.length - 1]).toFixed(1) + ' % de l\'amplitude');
verifier(Math.max(...faux) < 1, 'simulation : écart de rythme max ' + Math.max(...faux).toFixed(2) + ' /min');

// 3. no finger: nothing must be found
let fantomes = 0;
for (let i = 0; i < 40; i++) if (analyser(simuler('bruit', 30)).doigt) fantomes++;
verifier(fantomes === 0, 'sans doigt : ' + fantomes + ' fausse(s) détection(s) sur 40');


// 4. guided breathing: the pulse swing put in the simulation must be found again
const ecarts = [], sommets = [];
for (let i = 0; i < 10; i++) {
  const ech = simuler('pouls', 90, 60 + Math.random() * 40, 0.04, 0.1), r = analyser(ech).respiration;
  if (!r) { ecarts.push(99); continue; }
  ecarts.push(Math.abs((r.max - r.min) - 0.2 * ech.bpmReel)); sommets.push(r.sMax);
}
verifier(Math.max(...ecarts) < 3, 'respiration simulée (pouls ±10 %) : écart sur l\'ampleur retrouvée, max ' + Math.max(...ecarts).toFixed(1) + ' /min');
verifier(sommets.every(s => s >= 1.5 && s <= 3.5), 'respiration simulée : pouls le plus rapide trouvé à ' + sommets.map(s => s.toFixed(1)).join(' ') + ' s (attendu 2,5 s)');
const sans = [];
for (let i = 0; i < 10; i++) {            // same guide, but a pulse that does not follow the breath
  const ech = simuler('pouls', 90, 60 + Math.random() * 40);
  for (const e of ech) { e.resp = e.t % 10; e.cycle = 10; }
  const r = analyser(ech).respiration;
  sans.push(r ? r.max - r.min : 99);
}
verifier(Math.max(...sans) < 5, 'pouls sans lien avec la respiration : ampleur trouvée, max ' + Math.max(...sans).toFixed(1) + ' /min (bruit de fond de la mesure)');

// 5. CSV: written and read again, guide columns kept
const aller = simuler('pouls', 30, 70, 0.04, 0.1), retour = lireCsv(ecrireCsv(aller));
verifier(retour.length === aller.length && Math.abs(retour[500].resp - aller[500].resp) < 0.01 && retour[500].cycle === 10 && retour[500].s0 === aller[500].s0,
  'CSV : écrit puis relu, ' + retour.length + ' lignes, colonnes du guide conservées');

// 6. real recording of 60 s without guide: pulse at each moment
if (existsSync(join(ici, 'essai3.csv'))) {
  const ech = lireCsv(readFileSync(join(ici, 'essai3.csv'), 'utf8')), x = ech.map(e => e.s0), n = ech.length;
  const { P } = horloge(changements(x)), { serie } = reconstruire(x, P), fs = 1 / (P * (ech[n - 1].t - ech[0].t) / (n - 1));
  const r = rythmeInstantane(serie, fs), v = Array.from(r.bpm).filter(b => !Number.isNaN(b));
  const tri = [...v].sort((a, b) => a - b);
  verifier(v.length > 500 && tri[0] > 60 && tri[tri.length - 1] < 100, 'essai 3 : pouls instantané de ' + tri[0].toFixed(0) + ' à ' + tri[tri.length - 1].toFixed(0) +
    ' /min, moyenne ' + r.moyenne.toFixed(1));
  // is there a regular swing (free breathing) ? strongest period between 3 and 15 s
  const moy = v.reduce((s, b) => s + b, 0) / v.length;
  let mieux = { a: 0 };
  for (let T = 3; T <= 15; T += 0.1) {
    let re = 0, im = 0;
    v.forEach((b, k) => { const a = 2 * Math.PI * k / fs / T; re += (b - moy) * Math.cos(a); im += (b - moy) * Math.sin(a); });
    const a = 2 * Math.hypot(re, im) / v.length;
    if (a > mieux.a) mieux = { a, T };
  }
  console.log('       balancement le plus fort : période ' + mieux.T.toFixed(1) + ' s, ± ' + mieux.a.toFixed(1) + ' /min');
  let ligne = '       pouls toutes les 2 s : ';
  for (let k = 0; k < r.bpm.length; k += Math.round(2 * fs)) if (!Number.isNaN(r.bpm[k])) ligne += r.bpm[k].toFixed(0) + ' ';
  console.log(ligne);
}

console.log(echecs ? echecs + ' ECHEC(S)' : 'tout est bon');
process.exit(echecs ? 1 : 0);
