// Copia frontend/dist -> backend/frontend-dist preservando la estructura
// (index.html en la raiz, assets/ como subcarpeta). Uso: npm run embed
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'dist');
const dest = path.join(__dirname, '..', '..', 'backend', 'frontend-dist');

if (!fs.existsSync(path.join(src, 'index.html'))) {
  console.error('ERROR: frontend/dist/index.html no existe. Corré primero "npm run build".');
  process.exit(1);
}
if (!fs.existsSync(path.join(src, 'assets'))) {
  console.error('ERROR: frontend/dist/assets no existe. La build está mal formada.');
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
fs.cpSync(src, dest, { recursive: true });

// Verificación: index.html referencia /assets/... y esos archivos deben existir
const html = fs.readFileSync(path.join(dest, 'index.html'), 'utf8');
const refs = [...html.matchAll(/assets\/[\w./-]+\.(?:js|css)/g)].map((m) => m[0]);
const missing = refs.filter((rel) => !fs.existsSync(path.join(dest, rel)));

if (missing.length > 0) {
  console.error(`ERROR: faltan archivos referenciados: ${missing.join(', ')}`);
  process.exit(1);
}

console.log(`OK: frontend embebido en backend/frontend-dist (${refs.length} assets verificados)`);
