// ameacas.mjs — linter de ameaças para um catálogo de ferramentas WebMCP (só lê o texto das definições).
// Regras ligadas às categorias da spec WebMCP (rascunho de 16/10/2026, §6.3). Heurística: acha o óbvio;
// não prova que a ferramenta é segura (a spec diz que não há como verificar a intenção, §6.3.2.4).
// Uso: node scripts/ameacas.mjs <catalogo.mjs>
//   o módulo exporta `default` (lista de definições) ou `catalogo(agenda, ui)` (como pagina/ferramentas.mjs)
// Saída 0 = nenhum achado; 1 = há achado.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const arq = process.argv[2];
if (!arq) { console.error('uso: node scripts/ameacas.mjs <catalogo.mjs>'); process.exit(2); }
const mod = await import(pathToFileURL(resolve(arq)));
const defs = Array.isArray(mod.default) ? mod.default : mod.catalogo({}, {});

const LIMITE_DESCRICAO = 300;   // limite DO KIT; a spec só fixa 128 caracteres no nome e estuda o resto (§6.4.2, issue #73)
const INSTRUCAO = /ignore|\bsystem\b|<important>|instru[çc][õo]es anteriores|always include|sempre inclua|critical:/i;
const SENSIVEL = /\b(age|idade|pregnan\w*|gravid\w*|location|localiza\w*|height|altura|skin\w*|renda|income|cpf|sa[úu]de|health|previousPurchases|hist[óo]rico)\b/i;
const VAGO = /^(finaliz|process|gerenci|manage|handle|execut|finalize|do_|run)/i;

const achados = [];
const achar = (t, regra, cat) => achados.push(`ACHADO ${t}: ${regra} (${cat})`);

for (const d of defs) {
  const props = d.inputSchema?.properties || {};
  const textos = [d.description || '', ...Object.values(props).map(p => p.description || '')];
  const a = d.annotations || {};
  if (textos.some(t => INSTRUCAO.test(t))) achar(d.name, 'descrição com cara de instrução para o agente', '§6.3.1.1 envenenamento');
  if ((d.description || '').length > LIMITE_DESCRICAO) achar(d.name, `descrição com mais de ${LIMITE_DESCRICAO} caracteres`, '§6.4.2 limite');
  const sens = Object.entries(props).filter(([k, p]) => SENSIVEL.test(k) || SENSIVEL.test(p.description || '')).map(([k]) => k);
  if (sens.length) achar(d.name, `pede dado pessoal que a tarefa não precisa: ${sens.join(', ')}`, '§6.3.3 excesso de parâmetros');
  if (!a.readOnlyHint && !a.consequentialHint) achar(d.name, `não diz se só lê ou se tem consequência${VAGO.test(d.name) ? '; o nome não diz o efeito' : ''}`, '§6.3.2 intenção');
  if (d.inputSchema && Object.keys(props).length) {
    const livres = Object.entries(props).filter(([, p]) => p.type === 'string' && !p.enum && !p.pattern && !p.maxLength).map(([k]) => k);
    if (d.inputSchema.additionalProperties !== false || livres.length)
      achar(d.name, `entrada aberta${d.inputSchema.additionalProperties !== false ? ' (aceita campo extra)' : ''}${livres.length ? ` (texto sem limite: ${livres.join(', ')})` : ''}`, '§6.3.1.3 a ferramenta como alvo');
  }
}

for (const x of achados) console.log(x);
console.log(`${defs.length} ferramentas · ${achados.length} achado${achados.length === 1 ? '' : 's'}`);
process.exit(achados.length ? 1 : 0);
