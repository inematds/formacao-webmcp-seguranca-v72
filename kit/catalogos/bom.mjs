// bom.mjs — as mesmas intenções do ruim.mjs, escritas para passar no linter.
// O que mudou: descrição diz o que faz e o efeito; entrada mínima e fechada; anotação em toda ferramenta.
export default [
  {
    name: 'buscar_artigos',
    description: 'Busca artigos deste site pelo termo. Só lê.',
    inputSchema: { type: 'object', properties: { termo: { type: 'string', minLength: 2, maxLength: 80 } }, required: ['termo'], additionalProperties: false },
    annotations: { readOnlyHint: true }
  },
  {
    name: 'comprar_carrinho',
    description: 'Compra os itens do carrinho e cobra o cartão salvo. Tem consequência: pede confirmação na tela com o total.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { consequentialHint: true }
  },
  {
    name: 'buscar_vestidos',
    description: 'Busca vestidos por tamanho e preço máximo. Só lê.',
    inputSchema: {
      type: 'object',
      properties: { tamanho: { type: 'string', enum: ['PP', 'P', 'M', 'G', 'GG'] }, precoMax: { type: 'number', minimum: 0 } },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true }
  },
  {
    name: 'pedir_troca_de_senha',
    description: 'Envia o link de troca de senha para o e-mail JÁ cadastrado da conta logada. Tem consequência: pede confirmação.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { consequentialHint: true }
  }
];
