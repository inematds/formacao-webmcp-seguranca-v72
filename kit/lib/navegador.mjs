// navegador.mjs — servidor local + Chromium do Playwright 1.64.0 em dois modos:
//   sem    → Chromium sem WebMCP (a maioria dos visitantes hoje): o site tem de funcionar igual
//   nativo → Chromium com a flag de teste do WebMCP (--enable-features=WebMCPTesting,
//            o mesmo que chrome://flags/#enable-webmcp-testing). Experimental em 19/10/2026.
// PAGINA=<pasta> troca a pasta servida (padrão: kit/pagina). Use para testar a sua cópia.
// Cabeçalhos extras por arquivo: <pasta>/cabecalhos.json  { "/caminho.html": { "Permissions-Policy": "tools=()" } }
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

export const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
export const MODOS = ['sem', 'nativo'];

export function pastaPagina() {
  return resolve(process.env.PAGINA || resolve(KIT, 'pagina'));
}

export async function servir(pasta = pastaPagina()) {
  let cabecalhos = {};
  try { cabecalhos = JSON.parse(await readFile(resolve(pasta, 'cabecalhos.json'), 'utf8')); } catch {}
  const srv = createServer(async (req, res) => {
    const rota = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let caminho = resolve(pasta, '.' + rota);
    if (caminho.endsWith('/') || caminho === pasta) caminho = resolve(caminho, 'index.html');
    if (!caminho.startsWith(pasta)) return res.writeHead(403).end();
    try {
      const dado = await readFile(caminho);
      res.setHeader('Content-Type', TIPOS[extname(caminho)] || 'text/plain');
      for (const [k, v] of Object.entries(cabecalhos[rota] || {})) res.setHeader(k, v);
      res.end(dado);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok));   // 127.0.0.1 = contexto seguro, como https
  return { url: `http://127.0.0.1:${srv.address().port}/`, fechar: () => new Promise(ok => srv.close(ok)) };
}

export async function lancar(modo) {
  if (!MODOS.includes(modo)) throw new Error(`modo inválido: ${modo} (use ${MODOS.join(' ou ')})`);
  return chromium.launch({ args: modo === 'nativo' ? ['--enable-features=WebMCPTesting'] : [] });
}

export async function abrir(modo, { pagina = '' } = {}) {
  const srv = await servir();
  const browser = await lancar(modo);
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const erros = [];
  page.on('pageerror', e => erros.push(e.message));
  await page.goto(srv.url + pagina);
  await page.waitForFunction(() => document.documentElement.dataset.webmcp, null, { timeout: 15000 }).catch(() => {});
  return {
    browser, page, erros, url: srv.url,
    versao: `Chromium ${browser.version()} (Playwright) · modo: ${modo}`,
    async fechar() { await browser.close(); await srv.fechar(); }
  };
}

// Lista as ferramentas da página (só nome e anotações: cada item traz `window`, que não vira JSON).
export async function listar(page) {
  return page.evaluate(async () => {
    const mc = document.modelContext;
    if (!mc) return null;
    return (await mc.getTools()).map(t => ({ name: t.name, annotations: t.annotations || {}, inputSchema: t.inputSchema }));
  });
}

// Executa uma ferramenta como um agente faria. Objeto entra; texto JSON sai (spec de 16/10/2026, §4.2).
export async function executar(page, nome, entrada) {
  return page.evaluate(async ({ nome, entrada }) => {
    const mc = document.modelContext;
    const t = (await mc.getTools()).find(x => x.name === nome);
    if (!t) return { erro: `ferramenta não registrada: ${nome}` };
    try { return { texto: await mc.executeTool(t, entrada) }; }
    catch (e) { return { erro: e.name }; }
  }, { nome, entrada });
}
