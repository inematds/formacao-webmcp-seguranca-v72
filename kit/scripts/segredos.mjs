// segredos.mjs — procura segredo escrito em arquivo (chave privada, token, senha) numa pasta.
// Não substitui um scanner de verdade (gitleaks, o secret scanning do GitHub): é o mínimo que roda em 1 s.
// Uso: node scripts/segredos.mjs <pasta>    Saída 0 = nenhum segredo; 1 = achou.
// Pula node_modules, .git e package-lock.json. Mostra arquivo:linha com o valor mascarado.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const REGRAS = [
  ['chave privada PEM', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['token do GitHub', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ['chave da AWS', /\bAKIA[0-9A-Z]{16}\b/],
  ['chave sk-…', /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ['segredo atribuído no código', /\b(api[_-]?key|secret|token|senha|password)\b["']?\s*[:=]\s*["'][A-Za-z0-9_\-\/+=]{16,}["']/i]
];
const PULAR = new Set(['node_modules', '.git', 'package-lock.json']);

const raiz = process.argv[2];
if (!raiz) { console.error('uso: node scripts/segredos.mjs <pasta>'); process.exit(2); }

const achados = [];
let arquivos = 0;
(function andar(dir) {
  for (const nome of readdirSync(dir)) {
    if (PULAR.has(nome)) continue;
    const p = join(dir, nome);
    const st = statSync(p);
    if (st.isDirectory()) { andar(p); continue; }
    if (st.size > 1_000_000) continue;
    arquivos++;
    if (/^\.env(\..*)?$/.test(nome) && nome !== '.env.exemplo') achados.push(`${relative(raiz, p)}: arquivo .env dentro da pasta`);
    readFileSync(p, 'utf8').split('\n').forEach((l, i) => {
      for (const [rot, re] of REGRAS) {
        const m = l.match(re);
        if (m) achados.push(`${relative(raiz, p)}:${i + 1}: ${rot} (${m[0].slice(0, 12)}…)`);
      }
    });
  }
})(raiz);

for (const a of achados) console.log(`SEGREDO ${a}`);
console.log(`${arquivos} arquivo${arquivos === 1 ? '' : 's'} lido${arquivos === 1 ? '' : 's'} · ${achados.length} segredo${achados.length === 1 ? '' : 's'}`);
process.exit(achados.length ? 1 : 0);
