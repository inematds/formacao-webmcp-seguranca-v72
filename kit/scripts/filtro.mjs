// filtro.mjs — um filtro de palavras "anti-injeção", do tipo que muita gente escreve primeiro.
// Serve para provar o ponto da aula 1: filtro pega o ataque conhecido e deixa passar a variação.
// Não chama modelo nenhum: só aplica as regras ao texto.
// Uso: node scripts/filtro.mjs [arquivo]   (padrão: payloads/exemplos.txt; um ataque por bloco, separados por ---)
// Saída 0 = o filtro bloqueou tudo; 1 = algum ataque passou.
import { readFileSync } from 'node:fs';

const REGRAS = [
  /ignore (all )?(previous|prior) instructions/i,
  /ignore as instru[çc][õo]es/i,
  /\bSYSTEM\b/,
  /<important>/i,
  /END USER CONTENT/i
];

const arquivo = process.argv[2] || new URL('../payloads/exemplos.txt', import.meta.url);
const blocos = readFileSync(arquivo, 'utf8')
  .split(/^---\s*$/m)
  .map(b => b.split('\n').filter(l => !l.startsWith('#')).join(' ').trim())
  .filter(Boolean);

let passaram = 0;
blocos.forEach((b, i) => {
  const regra = REGRAS.find(r => r.test(b));
  if (!regra) passaram++;
  console.log(`${regra ? 'bloqueado' : 'PASSOU   '} ${i + 1}: ${b.slice(0, 60)}…`);
});
console.log(`passaram: ${passaram} de ${blocos.length}`);
process.exit(passaram ? 1 : 0);
