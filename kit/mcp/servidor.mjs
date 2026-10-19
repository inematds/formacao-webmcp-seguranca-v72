// servidor.mjs — servidor MCP por HTTP (revisão 2026-07-28, SDK oficial v2 2.3.1) em dois jeitos:
//   seguro → como a aula 5 manda;   fraco → erros comuns, para os ataques terem onde acertar.
// Serviço fictício de mentorias, dados em memória. Não chama modelo nem serviço pago.
// Os tokens NÃO ficam aqui: quem chama passa a tabela de tokens (no kit, gerada na hora com crypto.randomBytes).
import { createServer as criarHttp } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { McpServer, createMcpHandler, requireBearerAuth, requireScopes, getOAuthProtectedResourceMetadataUrl, OAuthError, OAuthErrorCode } from '@modelcontextprotocol/server';
import { toNodeHandler, localhostHostValidation, localhostOriginValidation } from '@modelcontextprotocol/node';
import * as z from 'zod/v4';

const MENTORIAS = [
  { id: 'm-101', titulo: 'Revisar as ferramentas da sua página', vagas: 2 },
  { id: 'm-102', titulo: 'Servidor MCP com token', vagas: 1 }
];

export function criarServidorMcp({ seguro }) {
  const rascunhos = new Map();       // handle → { dono, mentoria }
  let seq = 0;
  // seguro: handle aleatório e imprevisível; fraco: sequencial (r1, r2…), fácil de adivinhar
  const novoHandle = () => seguro ? randomBytes(16).toString('hex') : `r${++seq}`;
  const usuario = ctx => ctx.http?.authInfo?.extra?.usuario;       // vem do token verificado, nunca do cliente

  return function criar() {
    const server = new McpServer({ name: 'mentorias', version: '1.0.0' });

    server.registerTool('ver_mentorias', {
      description: 'Lista as mentorias com vaga. Só lê.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true }
    }, async () => ({ content: [{ type: 'text', text: MENTORIAS.map(m => `${m.id} · ${m.titulo} · ${m.vagas} vagas`).join('\n') }] }));

    server.registerTool('criar_rascunho', {
      description: 'Começa um agendamento e devolve o código do rascunho, que vai nas próximas chamadas.',
      inputSchema: z.object({ mentoria: z.string().regex(/^m-[0-9]{3}$/) }),
      annotations: { readOnlyHint: false }
    }, async ({ mentoria }, ctx) => {
      const h = novoHandle();
      rascunhos.set(h, { dono: usuario(ctx), mentoria });
      return { content: [{ type: 'text', text: h }] };
    });

    server.registerTool('ver_rascunho', {
      description: 'Mostra um rascunho de agendamento pelo código.',
      inputSchema: z.object({ rascunho: z.string().max(64) }),
      annotations: { readOnlyHint: true }
    }, async ({ rascunho }, ctx) => {
      const r = rascunhos.get(rascunho);
      // MCP 2026-07-28 não tem sessão: ter o handle NÃO é estar autenticado. Confira o dono.
      if (!r || (seguro && r.dono !== usuario(ctx))) return { content: [{ type: 'text', text: 'rascunho não encontrado' }], isError: true };
      return { content: [{ type: 'text', text: `rascunho de ${r.dono} para ${r.mentoria}` }] };
    });

    server.registerTool('confirmar_agendamento', {
      description: 'Confirma o agendamento de um rascunho. Tem consequência: ocupa uma vaga.',
      inputSchema: z.object({ rascunho: z.string().max(64) }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      // seguro: este escopo só aparece quando a ação é pedida (step-up); fraco: qualquer token serve
      ...(seguro && { scopeChallenge: requireScopes('mentorias:agendar') })
    }, async ({ rascunho }, ctx) => {
      const r = rascunhos.get(rascunho);
      if (!r || (seguro && r.dono !== usuario(ctx))) return { content: [{ type: 'text', text: 'rascunho não encontrado' }], isError: true };
      rascunhos.delete(rascunho);
      return { content: [{ type: 'text', text: `agendado: ${r.mentoria} para ${r.dono}` }] };
    });

    return server;
  };
}

// Sobe o servidor HTTP em 127.0.0.1. tokens = { <token>: { usuario, escopos, recurso?, expira? } }
export async function subir({ seguro, tokens, porta = 0 }) {
  const http = criarHttp();
  await new Promise(ok => http.listen(porta, '127.0.0.1', ok));
  const URL_MCP = new URL(`http://127.0.0.1:${http.address().port}/mcp`);
  const igual = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
  const verifier = {
    async verifyAccessToken(token) {
      const chave = Object.keys(tokens).find(k => igual(k, token));
      if (!chave) throw new OAuthError(OAuthErrorCode.InvalidToken, 'token desconhecido');
      const t = tokens[chave];
      return { token, clientId: t.usuario, scopes: t.escopos, expiresAt: t.expira ?? Math.floor(Date.now() / 1000) + 600,
        resource: new URL(t.recurso ?? URL_MCP), extra: { usuario: t.usuario } };
    }
  };
  const portao = requireBearerAuth({
    verifier,
    requiredScopes: ['mentorias:ler'],                                    // escopo mínimo para entrar
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(URL_MCP),
    ...(seguro && { expectedResource: URL_MCP })                          // seguro: token tem de ser PARA este servidor
  });
  const mcp = createMcpHandler(criarServidorMcp({ seguro }));
  const app = toNodeHandler({
    async fetch(request) {
      if (!seguro) {
        // ERRO COMUM: aceitar o token na URL (fica em log, histórico e Referer). A spec proíbe.
        const t = new URL(request.url).searchParams.get('access_token');
        if (t && !request.headers.get('authorization')) {
          const h = new Headers(request.headers); h.set('authorization', `Bearer ${t}`);
          request = new Request(request, { headers: h });
        }
      }
      const auth = await portao(request);
      if (auth instanceof Response) return auth;                            // 401 / 403 com WWW-Authenticate
      return mcp.fetch(request, { authInfo: auth });
    }
  });
  const hostOk = localhostHostValidation(), origemOk = localhostOriginValidation();
  http.on('request', (req, res) => {
    // seguro: recusa Host/Origin de fora (DNS rebinding) ANTES de qualquer outra coisa
    if (seguro && (!hostOk(req, res) || !origemOk(req, res))) return;
    void app(req, res);
  });
  return { url: URL_MCP, fechar: async () => { await mcp.close?.(); await new Promise(f => http.close(f)); } };
}
