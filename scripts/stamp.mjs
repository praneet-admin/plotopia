// Append a content hash to style.css and dist/app.js references so browsers never serve a stale pair.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const h = f => createHash('md5').update(readFileSync(f)).digest('hex').slice(0, 8);
let html = readFileSync('index.html', 'utf8');
html = html.replace(/href="style\.css(\?v=[^"]*)?"/, `href="style.css?v=${h('style.css')}"`)
           .replace(/src="dist\/app\.js(\?v=[^"]*)?"/, `src="dist/app.js?v=${h('dist/app.js')}"`);
const pv = `hi=${h('assets/people/people-hi.bin')},lo=${h('assets/people/people-lo.bin')}`;
html = /name="plotopia-assets"/.test(html) ? html.replace(/<meta name="plotopia-assets" content="[^"]*">/, `<meta name="plotopia-assets" content="${pv}">`) : html.replace('<link rel="stylesheet"', `<meta name="plotopia-assets" content="${pv}">\n<link rel="stylesheet"`);
writeFileSync('index.html', html);
console.log('stamped', h('style.css'), h('dist/app.js'));
