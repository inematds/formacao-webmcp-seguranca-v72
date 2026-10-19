// app.mjs — a interface da agenda (o que a pessoa vê) + o registro das ferramentas WebMCP.
// A mesma regra (dados.mjs) atende o clique da pessoa e a chamada do agente.
import { criarAgenda } from './dados.mjs';
import { catalogo } from './ferramentas.mjs';

const agenda = criarAgenda();
const $ = s => document.querySelector(s);

const ui = {
  atualizar() {
    $('#lista').innerHTML = '';
    for (const m of agenda.buscar()) {
      const li = document.createElement('li');
      li.textContent = `${m.id} · ${m.titulo} · ${m.data} · vagas: ${m.vagas} `;
      const b = document.createElement('button');
      b.textContent = 'Agendar'; b.disabled = m.vagas < 1;
      b.onclick = async () => {
        if (await ui.pedirConfirmacao(`Agendar "${m.titulo}" (${m.data}) para você?`)) { agenda.agendar({ id: m.id, nome: 'você' }); ui.atualizar(); }
      };
      li.append(b); $('#lista').append(li);
    }
    $('#agendamentos').innerHTML = '';
    for (const a of agenda.agendamentos()) {
      const li = document.createElement('li');
      li.textContent = `${a.codigo} · ${a.id} · ${a.nome} `;
      const b = document.createElement('button');
      b.textContent = 'Cancelar';
      b.onclick = async () => {
        if (await ui.pedirConfirmacao(`Cancelar o agendamento ${a.codigo} (${a.id}, ${a.nome})? A vaga volta para a agenda.`)) { agenda.cancelar(a.codigo); ui.atualizar(); }
      };
      li.append(b); $('#agendamentos').append(li);
    }
  },
  // Mostra alvo e efeito e espera a pessoa. Cancelar a execução (signal) fecha o diálogo como "não".
  pedirConfirmacao(texto, signal) {
    const caixa = $('#confirmar');
    $('#pergunta').textContent = texto;
    caixa.hidden = false;
    return new Promise(ok => {
      const fim = v => { caixa.hidden = true; caixa.onclick = null; ok(v); };
      caixa.onclick = e => { const a = e.target.dataset.acao; if (a) fim(a === 'confirmar'); };
      signal?.addEventListener('abort', () => fim(false), { once: true });
    });
  }
};
ui.atualizar();

// Detecção de recurso + fallback: sem document.modelContext, nada quebra.
async function iniciarWebMCP() {
  const mc = document.modelContext;            // nome atual (16/10/2026); navigator.modelContext é o nome antigo
  if (!mc || typeof mc.registerTool !== 'function') return 'sem';
  const lote = new AbortController();
  addEventListener('pagehide', () => lote.abort(), { once: true });
  try {
    for (const def of catalogo(agenda, ui)) await mc.registerTool(def, { signal: lote.signal });
    return 'com';
  } catch (e) {
    lote.abort();                               // registra todas ou nenhuma
    return 'falhou:' + e.name;
  }
}

const modo = await iniciarWebMCP();
$('#aviso').textContent = modo === 'com' ? 'Ferramentas WebMCP registradas (experimental).' : 'Este navegador não expõe WebMCP. Tudo funciona pelos botões.';
document.documentElement.dataset.webmcp = modo;
