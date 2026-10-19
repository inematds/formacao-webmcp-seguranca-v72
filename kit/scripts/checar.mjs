// checar.mjs — confere as ferramentas WebMCP da página contra duas regras de segurança (aulas 2 e 3):
//   1) ferramenta que devolve texto de terceiro (o canário aparece na saída) tem untrustedContentHint;
//   2) ferramenta que muda estado tem consequentialHint E pede confirmação: recusar não muda nada.
// Roda no Chromium do Playwright com a flag de teste do WebMCP (experimental em 19/10/2026).
// Uso: node scripts/checar.mjs              (página do kit)
//      PAGINA=<pasta> CANARIO=<texto> node scripts/checar.mjs   (a sua cópia, com o seu canário)
// Saída 0 = nenhuma falha; 1 = há falha; 2 = a página não registrou ferramentas.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { abrir, listar, executar, pastaPagina } from '../lib/navegador.mjs';

const CANARIO = process.env.CANARIO || 'CANARIO-7f3a';
const SELETOR = process.env.CONFIRMAR || '[data-confirmar]';   // o diálogo de confirmação da sua página
let exemplos = {};
try { exemplos = JSON.parse(await readFile(resolve(pastaPagina(), 'exemplos.json'), 'utf8')); } catch {}
const entrada = nome => exemplos[nome] || {};

const falhas = [];
const linha = (ok, nome, texto) => { console.log(`${ok ? 'ok   ' : 'FALHA'} ${nome}: ${texto}`); if (!ok) falhas.push(nome); };

// Foto do estado: o que as ferramentas só-leitura devolvem agora.
async function foto(page, ferramentas) {
  const partes = [];
  for (const t of ferramentas.filter(x => x.annotations.readOnlyHint)) partes.push((await executar(page, t.name, entrada(t.name))).texto);
  return partes.join('|');
}

let s = await abrir('nativo');
console.log(`== ${s.versao}`);
const modo = await s.page.evaluate(() => document.documentElement.dataset.webmcp);
if (modo !== 'com') { console.log(`a página não registrou ferramentas (modo: ${modo})`); await s.fechar(); process.exit(2); }
const ferramentas = await listar(s.page);

// Regra 1 — texto de terceiro
for (const t of ferramentas.filter(x => x.annotations.readOnlyHint)) {
  const r = await executar(s.page, t.name, entrada(t.name));
  const terceiro = (r.texto || '').includes(CANARIO);
  if (!terceiro) linha(true, t.name, 'só leitura, sem texto de terceiro');
  else if (t.annotations.untrustedContentHint) linha(true, t.name, 'devolve texto de terceiro e está marcada com untrustedContentHint');
  else linha(false, t.name, 'devolve texto de terceiro sem untrustedContentHint');
}

// Regra 2 — muda estado: anotação + confirmação que, recusada, não muda nada (página nova a cada teste)
for (const t of ferramentas.filter(x => !x.annotations.readOnlyHint)) {
  if (!t.annotations.consequentialHint) linha(false, t.name, 'muda estado sem consequentialHint');
  await s.page.reload();
  await s.page.waitForFunction(() => document.documentElement.dataset.webmcp === 'com');
  const antes = await foto(s.page, ferramentas);
  const chamada = executar(s.page, t.name, entrada(t.name));
  const pediu = await s.page.waitForSelector(`${SELETOR}:not([hidden])`, { timeout: 3000 }).then(() => true, () => false);
  if (pediu) await s.page.click(`${SELETOR} [data-acao=recusar]`);
  await chamada;
  const depois = await foto(s.page, ferramentas);
  if (!pediu && antes !== depois) linha(false, t.name, 'agiu sem pedir confirmação');
  else if (!pediu) linha(false, t.name, 'não pediu confirmação');
  else if (antes !== depois) linha(false, t.name, 'a pessoa recusou e o estado mudou');
  else if (t.annotations.consequentialHint) linha(true, t.name, 'consequentialHint + confirmação; recusar não mudou nada');
}

await s.fechar();
console.log(falhas.length ? `RESULTADO: ${falhas.length} falha${falhas.length > 1 ? 's' : ''}` : 'RESULTADO: 0 falhas');
process.exit(falhas.length ? 1 : 0);
