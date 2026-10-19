// wba.mjs — Web Bot Auth (draft-ietf-webbotauth-httpsig-protocol-00, 01/09/2026; rascunho do IETF, não RFC)
// em cima de HTTP Message Signatures (RFC 9421). Só node:crypto, nenhum pacote extra, nenhuma rede externa.
//   node scripts/wba.mjs vetor  → refaz o vetor de teste E.2.1 do draft (Ed25519) e confere byte a byte
//   node scripts/wba.mjs demo   → um "agente" assina pedidos e um servidor local (a origem) confere 7 casos
import { createServer } from 'node:http';
import { createPrivateKey, createPublicKey, generateKeyPairSync, createHash, sign, verify, randomBytes } from 'node:crypto';

const DRAFT = 'draft-ietf-webbotauth-httpsig-protocol-00 (01/09/2026)';
const thumbprint = pub => { const j = pub.export({ format: 'jwk' }); return createHash('sha256').update(JSON.stringify({ crv: j.crv, kty: j.kty, x: j.x })).digest('base64url'); };

// A "base de assinatura" do RFC 9421: uma linha por componente coberto + a linha @signature-params.
function base(componentes, valores, params) {
  const lista = `(${componentes.map(c => c.rotulo).join(' ')})${params}`;
  return [...componentes.map(c => `${c.rotulo}: ${valores[c.nome]}`), `"@signature-params": ${lista}`].join('\n');
}

const modo = process.argv[2];
if (modo === 'vetor') {
  // Chave de teste PÚBLICA do RFC 9421 (apêndice B.1.4, test-key-ed25519). Nunca use chave de teste em produção (draft C.12).
  const priv = createPrivateKey({ format: 'jwk', key: { kty: 'OKP', crv: 'Ed25519', d: 'n4Ni-HpISpVObnQMW0wOhCKROaIKqKtW_2ZYb2p9KcU', x: 'JrQLj5P_89iXES9-vFgrIy29clF9CC_oPPsw3c5D0bs' } });
  const keyid = thumbprint(createPublicKey(priv));
  const comps = [{ nome: 'a', rotulo: '"@authority"' }, { nome: 'sa', rotulo: '"signature-agent";key="agent2"' }];
  const params = `;created=1735689600;keyid="${keyid}";alg="ed25519";expires=4889289600;nonce="n9p433xm+NJ3ph3upfBIGmsuwHw387YV7Q/F+6BSpGCVjYCqQw6rznNA8PVVLySrAWsv0hQtFioQb6E1YsauiA==";tag="web-bot-auth"`;
  const b = base(comps, { a: 'example.com', sa: '"https://signature-agent.test"' }, params);
  const assinatura = sign(null, Buffer.from(b), priv).toString('base64');
  const ESPERADO = { keyid: 'poqkLGiymh_W0uP6PZFw-dvez3QJT5SolqXBCW38r0U', sig: 'RdNFx5Bj6au3YgAMQL/RzmUlZE8QZLIaXGRpw985hWnwPfMxT228NMk6ehRS1PSl4e8PhbNZACSanGdhEwYCCg==' };
  console.log(`== node ${process.version} · ${DRAFT}`);
  console.log(`keyid calculado: ${keyid} · ${keyid === ESPERADO.keyid ? 'confere' : 'DIVERGE'}`);
  console.log(`assinatura: ${assinatura.slice(0, 24)}… · ${assinatura === ESPERADO.sig ? 'confere' : 'DIVERGE'}`);
  const ok = keyid === ESPERADO.keyid && assinatura === ESPERADO.sig;
  console.log(`vetor E.2.1: ${ok ? 'confere' : 'DIVERGE'}`);
  process.exit(ok ? 0 : 1);
}

if (modo !== 'demo') { console.error('uso: node scripts/wba.mjs vetor|demo'); process.exit(2); }

// ---- demo: agente assina, origem confere ----
const AGENTE = 'https://agente.exemplo';                         // a URL que identifica o agente (Signature-Agent)
const chave = generateKeyPairSync('ed25519');                     // chave nova a cada execução
const intrusa = generateKeyPairSync('ed25519');                   // chave que a origem não conhece
// A origem já resolveu o diretório do agente (/.well-known/http-message-signatures-directory) antes.
// Na demo ele vem pronto: o draft (§4.4) aceita que o verificador já tenha as chaves.
const DIRETORIO = { [AGENTE]: [chave.publicKey] };

// Componentes cobertos. O draft exige @authority (ou @target-uri); @method e @path estreitam a assinatura (§5.2).
const COMPS = [{ nome: 'm', rotulo: '"@method"' }, { nome: 'a', rotulo: '"@authority"' }, { nome: 'p', rotulo: '"@path"' }, { nome: 'sa', rotulo: '"signature-agent";key="agente"' }];
const MINIMO = [{ nome: 'a', rotulo: '"@authority"' }, { nome: 'sa', rotulo: '"signature-agent";key="agente"' }];

function assinar({ metodo, autoridade, caminho, privada = chave.privateKey, validade = 60, comps = COMPS }) {
  const agora = Math.floor(Date.now() / 1000);
  const keyid = thumbprint(createPublicKey(privada));
  const params = `;created=${agora};expires=${agora + validade};keyid="${keyid}";alg="ed25519";nonce="${randomBytes(16).toString('base64')}";tag="web-bot-auth"`;
  const b = base(comps, { m: metodo, a: autoridade, p: caminho, sa: `"${AGENTE}"` }, params);
  return {
    'Signature-Agent': `agente="${AGENTE}"`,
    'Signature-Input': `sig1=(${comps.map(c => c.rotulo).join(' ')})${params}`,
    'Signature': `sig1=:${sign(null, Buffer.from(b), privada).toString('base64')}:`
  };
}

// O que a origem faz: confere e devolve um rótulo. Identificar NÃO é autorizar: a política é do site.
function conferir(req) {
  const sa = req.headers['signature-agent'], si = req.headers['signature-input'], sg = req.headers['signature'];
  if (!sa || !si || !sg) return 'anônimo: sem assinatura (a política do site decide)';
  const url = sa.match(/^agente="([^"]+)"$/)?.[1];
  const m = si.match(/^sig1=(\([^)]*\))(.*)$/);
  const p = Object.fromEntries([...(m?.[2] ?? '').matchAll(/;(\w+)=("([^"]*)"|\d+)/g)].map(x => [x[1], x[3] ?? Number(x[2])]));
  if (!url || !m || p.tag !== 'web-bot-auth') return 'recusado: cabeçalhos fora do formato';
  if (p.expires < Date.now() / 1000) return 'recusado: assinatura vencida';
  const pub = (DIRETORIO[url] || []).find(k => thumbprint(k) === p.keyid);
  if (!pub) return `recusado: chave desconhecida para ${url}`;
  // a origem refaz a base com os componentes que o PRÓPRIO pedido declara no Signature-Input
  const todos = [...COMPS];
  const cobertos = [...m[1].matchAll(/"[^"]+"(;key="[^"]+")?/g)].map(x => todos.find(c => c.rotulo === x[0])).filter(Boolean);
  const b = base(cobertos, { m: req.method, a: req.headers.host, p: new URL(req.url, 'http://x').pathname, sa: `"${url}"` }, m[2]);
  const ok = verify(null, Buffer.from(b), pub, Buffer.from(sg.match(/^sig1=:([^:]+):$/)?.[1] ?? '', 'base64'));
  return ok ? `identificado: ${url} (chave ${p.keyid.slice(0, 8)}…)` : 'recusado: assinatura não confere';
}

const srv = createServer((req, res) => res.end(conferir(req)));
await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
const autoridade = `127.0.0.1:${srv.address().port}`;
const pedir = (caminho, headers = {}) => fetch(`http://${autoridade}${caminho}`, { headers }).then(r => r.text());

console.log(`== node ${process.version} · ${DRAFT} · origem http://${autoridade}`);
const assinado = assinar({ metodo: 'GET', autoridade, caminho: '/agenda' });
const casos = [
  ['sem assinatura', await pedir('/agenda'), /^anônimo/],
  ['assinado, válido', await pedir('/agenda', assinado), /^identificado/],
  ['mesma assinatura em outro caminho', await pedir('/admin', assinado), /não confere/],
  ['assinatura vencida', await pedir('/agenda', assinar({ metodo: 'GET', autoridade, caminho: '/agenda', validade: -1 })), /vencida/],
  ['chave que a origem não conhece', await pedir('/agenda', assinar({ metodo: 'GET', autoridade, caminho: '/agenda', privada: intrusa.privateKey })), /desconhecida/],
  ['replay dentro da validade', await pedir('/agenda', assinado), /^identificado/],
  ['assinatura mínima (só @authority) usada em /admin', await pedir('/admin', assinar({ metodo: 'GET', autoridade, caminho: '/agenda', comps: MINIMO })), /^identificado/]
];
srv.close();
let ok = 0;
casos.forEach(([nome, resposta, espera], i) => { const bate = espera.test(resposta); if (bate) ok++; console.log(`${i + 1} · ${nome} → ${resposta}${bate ? '' : '  (INESPERADO)'}`); });
console.log(`${ok}/${casos.length} casos como esperado · replay dentro da validade: ${/^identificado/.test(casos[5][1]) ? 'aceito' : 'recusado'}`);
process.exit(ok === casos.length ? 0 : 1);
