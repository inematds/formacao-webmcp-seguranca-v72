// auditar.mjs — a auditoria de segurança do curso inteiro numa execução (aula 8).
// 6 verificações, cada uma de uma aula; grava relatorio-seguranca.md com data e resultado.
//   1 página      checar.mjs: texto de terceiro marcado; ação com consequência pede confirmação (aulas 2–3)
//   2 fallback    a página funciona sem WebMCP (o caso da maioria dos visitantes)
//   3 exposição   toda página .html que não é a index manda Permissions-Policy com tools=() (aula 4)
//   4 catálogo    ameacas.mjs sem achados (aula 7)
//   5 servidor    atacar-mcp.mjs seguro: 0 de 6 ataques passam (aula 5)
//   6 segredos    segredos.mjs na pasta do kit: 0 segredos (aula 5)
// Uso: node scripts/auditar.mjs     (PAGINA=<pasta> e CATALOGO=<arquivo> para a sua cópia)
// Saída 0 = 6/6; 1 = alguma falhou.
import { spawnSync } from 'node:child_process';
import { readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { KIT, pastaPagina, servir, abrir } from '../lib/navegador.mjs';

const node = (...args) => spawnSync(process.execPath, args, { cwd: KIT, encoding: 'utf8', timeout: 240000 });
const ultima = r => (r.stdout || r.stderr || '').trim().split('\n').at(-1);
const res = [];
const anotar = (n, nome, ok, det) => { res.push({ n, nome, ok, det }); console.log(`${ok ? 'ok   ' : 'FALHA'} ${n} ${nome}: ${det}`); };

const pasta = pastaPagina();
const s0 = await abrir('sem');
console.log(`== ${s0.versao.replace(' · modo: sem', '')} · ${new Date().toISOString().slice(0, 10)}`);

let r = node('scripts/checar.mjs');
anotar(1, 'página', r.status === 0, ultima(r));

const fb = await s0.page.evaluate(() => ({ modo: document.documentElement.dataset.webmcp, itens: document.querySelectorAll('li').length }));
anotar(2, 'fallback', fb.modo === 'sem' && fb.itens > 0 && !s0.erros.length, `sem WebMCP: ${fb.itens} itens na tela, ${s0.erros.length} erros de JS`);
await s0.fechar();

const srv = await servir(pasta);
const paginas = readdirSync(pasta).filter(f => f.endsWith('.html') && f !== 'index.html');
const sem = [];
for (const p of paginas) {
  const pp = (await fetch(srv.url + p)).headers.get('permissions-policy') || '';
  if (!/\btools=\(\)/.test(pp)) sem.push(p);
}
await srv.fechar();
anotar(3, 'exposição', sem.length === 0, sem.length ? `sem Permissions-Policy tools=(): ${sem.join(', ')}` : `${paginas.length} página(s) sem ferramenta com tools=()`);

r = node('scripts/ameacas.mjs', process.env.CATALOGO || resolve(pasta, 'ferramentas.mjs'));
anotar(4, 'catálogo', r.status === 0, ultima(r));

r = node('scripts/atacar-mcp.mjs', 'seguro');
anotar(5, 'servidor', r.status === 0, ultima(r));

r = node('scripts/segredos.mjs', '.');
anotar(6, 'segredos', r.status === 0, ultima(r));

const okN = res.filter(x => x.ok).length;
const hoje = new Date().toISOString().slice(0, 10);
writeFileSync(resolve(KIT, 'relatorio-seguranca.md'),
  `# Relatório de segurança — ${hoje}\n\nSpec WebMCP: rascunho CG de 16/10/2026 · MCP 2026-07-28\n\n| # | verificação | resultado | detalhe |\n|---|---|---|---|\n` +
  res.map(x => `| ${x.n} | ${x.nome} | ${x.ok ? 'ok' : 'FALHA'} | ${x.det.replace(/\|/g, '/')} |`).join('\n') +
  `\n\nTotal: ${okN}/6. Rode de novo a cada mudança de ferramenta, de dependência ou da spec.\n`);
console.log(`AUDITORIA: ${okN}/6 ok · relatório: relatorio-seguranca.md`);
process.exit(okN === 6 ? 0 : 1);
