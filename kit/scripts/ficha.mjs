// ficha.mjs — confere a ficha de ameaças de uma ferramenta (modelos/ficha-ameacas.md):
// as 7 categorias da spec WebMCP §6.3 presentes ("## 1." a "## 7."), cada uma com Controle e Teste preenchidos.
// Aceita os rótulos em PT, EN e ES (Controle/Control, Teste/Test/Prueba).
// Uso: node scripts/ficha.mjs <ficha.md>    Saída 0 = 7/7; 1 = falta alguma.
import { readFileSync } from 'node:fs';

const arq = process.argv[2];
if (!arq) { console.error('uso: node scripts/ficha.mjs <ficha.md>'); process.exit(2); }
const texto = readFileSync(arq, 'utf8');
const secoes = texto.split(/^## /m).slice(1);
const campo = (s, re) => (s.match(re)?.[1] || '').replace(/[^\p{L}]/gu, '').length;

const faltas = [];
let ok = 0;
for (let n = 1; n <= 7; n++) {
  const s = secoes.find(x => x.startsWith(`${n}.`));
  if (!s) { faltas.push(`categoria ${n}: ausente`); continue; }
  const titulo = s.split('\n')[0].trim();
  const controle = campo(s, /^(?:controle|control):\s*(.*)$/im);
  const teste = campo(s, /^(?:teste|test|prueba):\s*(.*)$/im);
  if (controle >= 10 && teste >= 5) ok++;
  else faltas.push(`${titulo}: ${controle < 10 ? 'controle vazio' : ''}${controle < 10 && teste < 5 ? ' e ' : ''}${teste < 5 ? 'teste vazio' : ''}`);
}
for (const f of faltas) console.log(`FALTA ${f}`);
console.log(`ficha: ${ok}/7 categorias com controle e teste`);
process.exit(ok === 7 ? 0 : 1);
