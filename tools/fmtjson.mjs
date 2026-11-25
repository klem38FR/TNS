/* Mise en forme des fichiers millésimes (lisible, stable pour les revues de code) */
// Mise en forme lisible : tableaux de valeurs simples (et tableaux de tels tableaux courts) sur une ligne
export function fmtJson(v, ind = '') {
  const nx = ind + '  ';
  const prim = x => x === null || typeof x !== 'object';
  if (prim(v)) return JSON.stringify(v);
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    if (v.every(prim)) { const s = '[' + v.map(x => JSON.stringify(x)).join(', ') + ']'; if (s.length < 110 || v.every(x => typeof x === 'number')) return s; }
    if (v.every(x => Array.isArray(x) && x.every(prim))) return '[\n' + v.map(x => nx + '[' + x.map(y => JSON.stringify(y)).join(', ') + ']').join(',\n') + '\n' + ind + ']';
    return '[\n' + v.map(x => nx + fmtJson(x, nx)).join(',\n') + '\n' + ind + ']';
  }
  const ks = Object.keys(v);
  if (!ks.length) return '{}';
  if (ks.every(k => prim(v[k]))) { const s = '{ ' + ks.map(k => JSON.stringify(k) + ': ' + JSON.stringify(v[k])).join(', ') + ' }'; if (s.length + ind.length < 120) return s; }
  return '{\n' + ks.map(k => nx + JSON.stringify(k) + ': ' + fmtJson(v[k], nx)).join(',\n') + '\n' + ind + '}';
}
