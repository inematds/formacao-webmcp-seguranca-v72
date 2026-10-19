// exposicao.mjs — quem enxerga a ferramenta? Sete casos com duas origens locais:
//   topo   = http://127.0.0.1:<porta A>   (página principal, registra ferramenta_topo)
//   iframe = http://127.0.0.1:<porta B>   (outra origem: mesma máquina, outra porta)
// Cada caso compara o que o Chromium fez com o que a spec WebMCP (rascunho de 16/10/2026) manda.
// Experimental: Chromium do Playwright com a flag de teste do WebMCP.
// Uso: node scripts/exposicao.mjs     Saída 0 = os 7 casos conferem com a spec.
import { resolve } from 'node:path';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { servir, lancar, KIT } from '../lib/navegador.mjs';

const pasta = resolve(KIT, 'exposicao');
const A = await servir(pasta);                 // topo
const B = await servir(pasta);                 // iframe de outra origem
const oA = A.url.slice(0, -1), oB = B.url.slice(0, -1);
// O cabeçalho Permissions-Policy vem do servidor; aqui, um terceiro servidor que sempre manda tools=().
const C = await new Promise(ok => {
  const s = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Permissions-Policy', 'tools=()');
    res.end(await readFile(resolve(pasta, 'topo.html')));
  });
  s.listen(0, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${s.address().port}/`, fechar: () => new Promise(f => s.close(f)) }));
});

const casos = [
  { id: '0', rot: 'iframe da MESMA origem, sem nada', base: A, filho: `${A.url}filho.html`,
    espera: r => r.iframe === 'registrou' && r.ve.includes(`ferramenta_iframe@${oA}`), diz: 'vê: mesma origem é o padrão' },
  { id: 'A', rot: 'iframe de outra origem, sem allow="tools"', base: A, filho: `${B.url}filho.html`,
    espera: r => r.iframe === 'recusou: NotAllowedError', diz: 'iframe recusado (NotAllowedError)' },
  { id: 'B', rot: 'allow="tools", sem exposedTo', base: A, filho: `${B.url}filho.html`, allow: 'tools', from: oB,
    espera: r => r.iframe === 'registrou' && !r.ve.some(x => x.startsWith('ferramenta_iframe')), diz: 'topo não vê' },
  { id: 'C', rot: 'allow + exposedTo:[topo], topo sem fromOrigins', base: A, filho: `${B.url}filho.html?exposto=${oA}`, allow: 'tools',
    espera: r => r.iframe === 'registrou' && !r.ve.some(x => x.startsWith('ferramenta_iframe')), diz: 'topo não vê' },
  { id: 'D', rot: 'allow + exposedTo:[topo] + fromOrigins:[iframe]', base: A, filho: `${B.url}filho.html?exposto=${oA}`, allow: 'tools', from: oB,
    espera: r => r.ve.includes(`ferramenta_iframe@${oB}`), diz: 'topo VÊ a ferramenta do iframe' },
  { id: 'E', rot: 'topo com Permissions-Policy: tools=()', base: C, filho: `${B.url}filho.html?exposto=${C.url.slice(0, -1)}`, allow: 'tools', from: oB,
    espera: r => r.topo === 'recusou: NotAllowedError' && r.iframe === 'recusou: NotAllowedError', diz: 'topo e iframe recusados' },
  { id: 'F', rot: 'exposedTo com origem http:// pública', base: A, filho: `${B.url}filho.html?exposto=http://exemplo.com`, allow: 'tools', from: oB,
    espera: r => r.iframe === 'recusou: SecurityError', diz: 'iframe recusado (SecurityError)' }
];

const browser = await lancar('nativo');
console.log(`== Chromium ${browser.version()} (Playwright) · modo: nativo`);
let conferem = 0;
for (const c of casos) {
  const q = new URLSearchParams({ filho: c.filho, ...(c.allow && { allow: c.allow }), ...(c.from && { from: c.from }) });
  const page = await browser.newPage();
  await page.goto(`${c.base.url}topo.html?${q}`);
  await page.waitForFunction(() => window.R && window.R.fim, null, { timeout: 15000 }).catch(() => {});
  const r = await page.evaluate(() => window.R);
  await page.close();
  r.ve = Array.isArray(r.ve) ? r.ve : [];
  const ok = c.espera(r);
  if (ok) conferem++;
  console.log(`${ok ? 'confere' : 'DIVERGE'} ${c.id} · ${c.rot} → ${ok ? c.diz : JSON.stringify(r)}`);
}
await browser.close(); await A.fechar(); await B.fechar(); await C.fechar();
console.log(`${conferem}/${casos.length} casos conferem com a spec`);
process.exit(conferem === casos.length ? 0 : 1);
