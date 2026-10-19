// atacar-mcp.mjs — 6 ataques da lista de segurança do MCP (revisão 2026-07-28) contra o servidor do kit.
// Uso: node scripts/atacar-mcp.mjs fraco    (erros comuns: os ataques acertam)
//      node scripts/atacar-mcp.mjs seguro   (como a aula 5 manda)
// Tudo em 127.0.0.1, tokens gerados na hora (nada no repositório), nenhum modelo, nenhum serviço pago.
// Saída 0 = nenhum ataque passou; 1 = algum passou.
import { request } from 'node:http';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { subir } from '../mcp/servidor.mjs';

const modo = process.argv[2];
if (!['fraco', 'seguro'].includes(modo)) { console.error('uso: node scripts/atacar-mcp.mjs fraco|seguro'); process.exit(2); }
const pkg = JSON.parse(readFileSync(new URL('../node_modules/@modelcontextprotocol/server/package.json', import.meta.url)));
console.log(`== @modelcontextprotocol/server ${pkg.version} · MCP 2026-07-28 · servidor: ${modo}`);

const tk = () => randomBytes(16).toString('hex');
const T = { ana_ler: tk(), ana_agendar: tk(), bruno: tk(), outro_recurso: tk(), vencido: tk() };
const tokens = {
  [T.ana_ler]: { usuario: 'ana', escopos: ['mentorias:ler'] },
  [T.ana_agendar]: { usuario: 'ana', escopos: ['mentorias:ler', 'mentorias:agendar'] },
  [T.bruno]: { usuario: 'bruno', escopos: ['mentorias:ler', 'mentorias:agendar'] },
  [T.outro_recurso]: { usuario: 'ana', escopos: ['mentorias:ler', 'mentorias:agendar'], recurso: 'https://outro-servico.exemplo/mcp' },
  [T.vencido]: { usuario: 'ana', escopos: ['mentorias:ler'], expira: Math.floor(Date.now() / 1000) - 60 }
};
const srv = await subir({ seguro: modo === 'seguro', tokens });

// Chama uma ferramenta com o cliente oficial v2 (fala a revisão 2026-07-28).
async function chamar({ token, url = srv.url, ferramenta, args = {} }) {
  const cliente = new Client({ name: 'atacante', version: '1.0.0' }, { versionNegotiation: { pin: '2026-07-28' } });
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  try {
    await cliente.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers } }));
    const r = await cliente.callTool({ name: ferramenta, arguments: args });
    return r.isError ? { recusado: r.content[0].text } : { ok: r.content[0].text };
  } catch (e) {
    const m = String(e.message);
    const d = m.match(/"error":"([^"]+)","error_description":"([^"]+)"/);
    return { recusado: d ? `${d[1]}: ${d[2]}` : m.replace(/\s+/g, ' ').slice(0, 80) };
  } finally { await cliente.close().catch(() => {}); }
}

// Pedido HTTP cru, para mandar um Host que um navegador mandaria depois de um DNS rebinding.
function cru(host) {
  return new Promise(ok => {
    const req = request(srv.url, { method: 'POST', headers: { Host: host, Origin: `http://${host}`, 'Content-Type': 'application/json' } },
      res => { res.resume(); res.on('end', () => ok(res.statusCode)); });
    req.end('{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}');
  });
}

let passaram = 0;
const mostrar = (n, nome, passou, detalhe) => { if (passou) passaram++; console.log(`${passou ? 'PASSOU   ' : 'bloqueado'} ${n} · ${nome} → ${detalhe}`); };

// 1) DNS rebinding: uma página de fora fala com o servidor local usando outro Host (sem token, como o atacante)
const st = await cru('rebind.exemplo.com:80');
mostrar(1, 'Host de fora (DNS rebinding)', st === 200, st === 403 ? 'HTTP 403 (Host recusado antes do token)' : `HTTP ${st}${st === 401 ? ' (o token barrou; servidor sem token cairia)' : ''}`);

// 2) token na URL
const u = new URL(srv.url); u.searchParams.set('access_token', T.ana_ler);
const r2 = await chamar({ url: u, ferramenta: 'ver_mentorias' });
mostrar(2, 'token na query string', !!r2.ok, r2.ok ? 'aceito' : r2.recusado);

// 3) token emitido para OUTRO servidor (audiência errada)
const r3 = await chamar({ token: T.outro_recurso, ferramenta: 'ver_mentorias' });
mostrar(3, 'token de outro recurso', !!r3.ok, r3.ok ? 'aceito' : r3.recusado);

// 4) token só de leitura tenta a ação com consequência
const h4 = await chamar({ token: T.ana_ler, ferramenta: 'criar_rascunho', args: { mentoria: 'm-101' } });
const r4 = await chamar({ token: T.ana_ler, ferramenta: 'confirmar_agendamento', args: { rascunho: h4.ok ?? 'x' } });
mostrar(4, 'escopo de leitura confirma agendamento', !!r4.ok, r4.ok ?? r4.recusado);

// 5) Bruno usa o rascunho da Ana (handle adivinhado ou vazado)
const h5 = await chamar({ token: T.ana_agendar, ferramenta: 'criar_rascunho', args: { mentoria: 'm-102' } });
const palpite = modo === 'fraco' ? 'r2' : h5.ok;          // fraco: sequencial, dá para chutar; seguro: mesmo vazado
const r5 = await chamar({ token: T.bruno, ferramenta: 'confirmar_agendamento', args: { rascunho: palpite } });
mostrar(5, 'handle de outro usuário', !!r5.ok, r5.ok ?? r5.recusado);

// 6) token vencido
const r6 = await chamar({ token: T.vencido, ferramenta: 'ver_mentorias' });
mostrar(6, 'token vencido', !!r6.ok, r6.ok ? 'aceito' : r6.recusado);

await srv.fechar();
console.log(`passaram: ${passaram} de 6`);
process.exit(passaram ? 1 : 0);
