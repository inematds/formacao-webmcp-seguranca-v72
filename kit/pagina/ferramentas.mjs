// ferramentas.mjs — as ferramentas WebMCP da agenda de mentorias.
// API: document.modelContext (rascunho do W3C Community Group de 16/10/2026). Experimental: pode mudar.
// Regra do curso: detecção de recurso + fallback. Sem a API, o site funciona igual pelos botões.
//
// ATENÇÃO: este arquivo tem DOIS FUROS DE PROPÓSITO, que você conserta no curso:
//   aula 2 → ler_avaliacoes devolve texto de visitantes e não diz isso ao agente;
//   aula 3 → cancelar_agendamento muda o estado sem anotação e sem pedir confirmação.
// A versão consertada está em ../solucao/ferramentas.mjs (compare com diff no fim de cada aula).

// Erro de regra volta como dado { erro }: se o execute der throw, o agente recebe só um erro genérico.
const util = fn => async (input, opcoes) => {
  try { return await fn(input, opcoes); }
  catch (e) { if (e.name === 'AbortError') throw e; return { erro: e.message }; }
};

export function catalogo(agenda, ui) {
  return [
    {
      name: 'buscar_mentorias',
      title: 'Buscar mentorias',
      description: 'Lista as mentorias da agenda, opcionalmente por tema. Só lê.',
      inputSchema: {
        type: 'object',
        properties: { tema: { type: 'string', enum: ['webmcp', 'mcp', 'seguranca'], description: 'Tema da mentoria.' } },
        additionalProperties: false
      },
      annotations: { readOnlyHint: true },
      execute: util(async input => ({ mentorias: agenda.buscar(input) }))
    },
    {
      name: 'ler_avaliacoes',
      title: 'Ler avaliações de uma mentoria',
      description: 'Devolve as avaliações de uma mentoria. Só lê.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string', pattern: '^m-[0-9]{3}$', description: 'Id da mentoria, ex.: m-101.' } },
        required: ['id'],
        additionalProperties: false
      },
      annotations: { readOnlyHint: true },                      // FURO da aula 2
      execute: util(async ({ id }) => ({ id, avaliacoes: agenda.avaliacoes(id) }))
    },
    {
      name: 'agendar_mentoria',
      title: 'Agendar mentoria (pede confirmação)',
      description: 'Agenda uma vaga numa mentoria e pede à pessoa que confirme na tela. Só agenda se ela clicar em Confirmar.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: '^m-[0-9]{3}$', description: 'Id da mentoria.' },
          nome: { type: 'string', minLength: 2, maxLength: 80, description: 'Nome de quem vai participar.' }
        },
        required: ['id', 'nome'],
        additionalProperties: false
      },
      annotations: { consequentialHint: true },
      execute: util(async ({ id, nome }, { signal }) => {
        const m = agenda.mentoria(id);
        if (!m) throw new Error(`mentoria não encontrada: ${id}`);
        const ok = await ui.pedirConfirmacao(`Agendar "${m.titulo}" (${m.data}) para ${nome}?`, signal);
        if (!ok) return { agendado: false, motivo: 'a pessoa recusou na tela' };
        const ag = agenda.agendar({ id, nome });
        ui.atualizar();
        return { agendado: true, agendamento: ag };
      })
    },
    {
      name: 'cancelar_agendamento',
      title: 'Cancelar agendamento',
      description: 'Cancela um agendamento pelo código.',
      inputSchema: {
        type: 'object',
        properties: { codigo: { type: 'string', pattern: '^AG-[0-9]+$', description: 'Código, ex.: AG-1.' } },
        required: ['codigo'],
        additionalProperties: false
      },
      // FURO da aula 3: sem anotação e sem confirmação
      execute: util(async ({ codigo }) => {
        const ag = agenda.cancelar(codigo);
        ui.atualizar();
        return { cancelado: true, agendamento: ag };
      })
    },
    {
      name: 'meus_agendamentos',
      title: 'Ver meus agendamentos',
      description: 'Lista os agendamentos desta visita. Só lê.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: util(async () => ({ agendamentos: agenda.agendamentos() }))
    }
  ];
}
