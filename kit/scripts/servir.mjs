// servir.mjs — serve a página do kit (ou PAGINA=<pasta>) em http://127.0.0.1:<PORTA> com os cabeçalhos de cabecalhos.json.
// Uso: node scripts/servir.mjs   (PORTA padrão 8742; Ctrl+C para parar)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const pasta = resolve(process.env.PAGINA || resolve(dirname(fileURLToPath(import.meta.url)), '../pagina')), PORTA = Number(process.env.PORTA || 8742);
const TIPOS = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript', '.json': 'application/json' };
let cab = {}; try { cab = JSON.parse(await readFile(resolve(pasta, 'cabecalhos.json'), 'utf8')); } catch {}
createServer(async (req, res) => {
  const rota = new URL(req.url, 'http://x').pathname;
  const arq = resolve(pasta, '.' + (rota.endsWith('/') ? rota + 'index.html' : rota));
  if (!arq.startsWith(pasta)) return res.writeHead(403).end();
  try {
    const dado = await readFile(arq);
    res.setHeader('Content-Type', TIPOS[extname(arq)] || 'text/plain');
    for (const [k, v] of Object.entries(cab[rota] || {})) res.setHeader(k, v);
    res.end(dado);
  } catch { res.writeHead(404).end(); }
}).listen(PORTA, '127.0.0.1', () => console.log(`página em http://127.0.0.1:${PORTA}/`));
