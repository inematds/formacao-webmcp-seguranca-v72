# PLANO — Curso 4 · Segurança e confiança entre site e agente (Formação WebMCP v7.2)

Repo `inematds/formacao-webmcp-seguranca-v72`. Público: quem já fez os cursos 1–3 (servidor MCP, WebMCP na página, agentes de navegador). Sai com a auditoria de segurança do próprio site + servidor. Escrito em 19/10/2026, antes do conteúdo. Fontes: `../wifi/longrun/2026-10-19-formacao-webmcp-v72/{CURRICULO,AUDITORIA-LOCAL,PESQUISA-ESTADO-DA-ARTE,BRIEF-CURSO,decisions}.md`.

Fonte de verdade: **WebMCP, Draft Community Group Report de 16/10/2026** (https://webmachinelearning.github.io/webmcp/, baixado e lido em 19/10/2026), em especial §4.2 (anotações, `exposedTo`, `fromOrigins`), §4.4 (permissions policy `tools`) e §6 (Security and Privacy Considerations, não normativa). MCP **revisão 2026-07-28** (`security_best_practices`, `authorization`, changelog). Comportamento medido no **Chromium 156.0.8078.4 do Playwright 1.64.0** com `--enable-features=WebMCPTesting` e no **SDK oficial v2 `@modelcontextprotocol/server` 2.3.1** (`MODERN_PROTOCOL_VERSION = "2026-07-28"` no `dist/`). Web Bot Auth: `draft-ietf-webbotauth-httpsig-protocol-00` (publicado em 01/09/2026, expira em 05/03/2027) + RFC 9421.

## Medições feitas antes de escrever (19/10/2026)

**Exposição (aula 4)** — probe com duas origens locais (`127.0.0.1:A` página, `127.0.0.1:B` iframe), Chromium 156.0.8078.4 nativo:
| caso | resultado medido |
|---|---|
| iframe de outra origem sem `allow="tools"` | `registerTool` no iframe → `NotAllowedError` ("disallowed by permissions policy") |
| `allow="tools"`, sem `exposedTo`, topo com `fromOrigins` | iframe registra; topo **não** vê a ferramenta |
| `allow="tools"`, `exposedTo:[topo]`, topo sem `fromOrigins` | topo **não** vê |
| `allow="tools"`, `exposedTo:[topo]`, topo com `fromOrigins:[iframe]` | topo vê `ferramenta_iframe@http://127.0.0.1:B` |
| cabeçalho `Permissions-Policy: tools=()` no topo | `registerTool` e `getTools` do topo → `NotAllowedError`; iframe também |
| `exposedTo:['http://exemplo.com']` (origem não confiável) | `SecurityError` "Only secure origins are allowed in the exposedTo list" |
Conclusão: o Chromium 156 segue a spec nos três controles (permissions policy, `exposedTo`, `fromOrigins`). A §6.3.4 da spec ("Violation of Same-Origin Boundaries") está literalmente `TODO` em 16/10/2026 — fato ensinável.

**SDK MCP (aula 5)** — `dist/mcp-*.mjs` do `@modelcontextprotocol/server` 2.3.1:
- `verifyBearerToken` só lê o cabeçalho `Authorization` (token na query string é ignorado → 401) — **o SDK faz**.
- Audiência: compara `authInfo.resource` com `expectedResource` **só se você passar `expectedResource`** e o seu verificador devolver `resource` — sem isso, token de outro recurso passa. **Você faz.**
- Recusa token sem expiração ou expirado — **o SDK faz** (se o verificador devolver `expiresAt`).
- Escopo por ferramenta: `scopeChallenge: requireScopes(...)` → 403 `insufficient_scope` com `scope="..."` (step-up) — **o SDK faz, se você declarar**.
- Host/Origin (DNS rebinding): `localhostHostValidation`/`localhostOriginValidation` do `@modelcontextprotocol/node` 2.1.1 — **você liga**.
- Handle de estado (carrinho, fluxo): a revisão 2026-07-28 é sem sessão; prender o handle ao usuário do token é **você** (`security_best_practices`, "State Handle Hijacking").

**Web Bot Auth (aula 6)** — o vetor E.2.1 do draft (Ed25519, chave de teste do RFC 9421 B.1.4) reproduzido com `node:crypto` puro: `keyid` = `poqkLGiymh_W0uP6PZFw-dvez3QJT5SolqXBCW38r0U` e assinatura idêntica à do draft. Nenhum pacote extra.

## Conferência das fontes (passo 0 do BRIEF)

Legenda: **confere** (com a PESQUISA, com a spec de 16/10 ou com o que rodou aqui) · **velho** (substituído pelo atual, nunca copiado) · **sem confirmação** (fica fora ou entra como "relatado por").

### webmcp-5-expert `curso/expert/modulo-4-1.html` (Segurança de agentes e tools) — commit c1ee007, 05/10/2026
| Afirmação antiga | Marca | O que o curso ensina |
|---|---|---|
| Rodapé "Snapshot oficial: 26/08/2026 · commit 41d12f0" | **velho** | Draft CG de **16/10/2026** |
| "Texto da página e resultados de tools são dados não confiáveis" | confere | aula 2 (spec §6.3.1.2, §6.4.4) |
| `registerTool({... annotations: { readOnlyHint: true, untrustedContentHint: true }})` | confere | aula 2; anotações com selo "podem mudar" |
| Tool poisoning e output injection como categorias | confere | aulas 1 e 7, agora com os 3 vetores da spec §6.3.1 (metadados, saída, a ferramenta como alvo) |
| `token = mint({ scope, resource, ttl: 60 })` | **pseudocódigo** (API inexistente); princípio confere | aula 5 com código real do SDK v2: escopo por ferramenta, `expectedResource`, `expiresAt` |
| `approval = sign({ tool, argsHash, stateVersion, expiresAt })` | **pseudocódigo**; princípio confere | aula 3: confirmação mostra alvo e efeito; o kit não assina aprovação (não há API para isso) |
| Prompt injection sem as posições oficiais | **velho** (ausência) | aula 1: Anthropic 24/11/2025 [FATO]; OpenAI 22/12/2025 [2ª, "relatado"] |
| Threat modeling só listado (STRIDE, abuse case) | **velho** (raso) | aula 7: categorias da spec §6.3 + linter do kit + ficha conferida por script |
| Lado MCP sem stateless, `server/discover`, MRTR, `iss` | **velho** | aula 5 na 2026-07-28 (sem sessão; handle de estado preso ao usuário) |
| `for (const attack of adversarialDataset) assert(...)` | **pseudocódigo** | aula 8: bateria de verdade (`auditar.mjs`); evals a fundo → LOOP-R |

### webmcp-4-agent-developer `curso/agent/modulo-3-3.html` (Cross-origin e permissões) — commit f4d8c69, 05/10/2026
| Afirmação antiga | Marca | O que o curso ensina |
|---|---|---|
| Rodapé "Snapshot 26/08/2026" | **velho** | 16/10/2026 |
| `registerTool(tool, { exposedTo: [...], signal })`, "same-origin é o padrão" | confere | aula 4, medido |
| `getTools({ fromOrigins: [...] })`, `RegisteredTool` com `origin` e `window` | confere | aula 4, medido (`ferramenta_iframe@http://127.0.0.1:B`) |
| "Três controles: exposedTo, Permissions Policy tools, backend" | confere | aula 4; faltava dizer que `exposedTo` **sozinho não basta** (precisa `allow="tools"` + `fromOrigins`, medido) |
| "Não transforme CORS em autorização" | confere (princípio web) | aula 4, uma frase |
| `confirm({ action, target, reversible })` | **pseudocódigo** | aula 3 com o diálogo real do kit |

### Outras fontes
| Fonte | Afirmação | Marca | Uso |
|---|---|---|---|
| PESQUISA §3.1 / post Anthropic (lido 19/10) | 24/11/2025; ~1% de ataques bem-sucedidos "still represents meaningful risk. No browser agent is immune" | confere [FATO] | aula 1, sem nome de modelo |
| PESQUISA §3.2 | OpenAI "Hardening Atlas…" 22/12/2025, "unlikely to ever be fully solved" | **sem confirmação** (página deu 403 de novo em 19/10) | aula 1 como "relatado pela cobertura (techloy), não confirmado na fonte" |
| PESQUISA §3.2 | Brave: injeção indireta no Comet (ago/2025) | **sem confirmação** [2ª] | fora |
| PESQUISA §3.1 | GA do Claude for Chrome em ago/2026 | **sem confirmação** | fora |
| Spec §6.4.4 + paper Spotlighting (arXiv 2403.14720, 20/03/2024) | delimiting, datamarking, encoding; ASR ">50% → <2%" nos experimentos deles | confere (seções III-B/C/D e abstract lidos) | aula 2; o número sempre "nos experimentos do artigo, com modelos da época" |
| Spec §6.4.2 | limite de 128 caracteres só no nome; outros limites em estudo (issue #73) | confere | aulas 1 e 7; o limite de descrição do kit (300) é **do kit**, não da spec |
| `security_best_practices` 2026-07-28 | token passthrough proibido; "MUST NOT accept any tokens that were not explicitly issued for the MCP server"; state handle não é autenticação; servidor local: stdio ou HTTP com token; escopo mínimo + step-up | confere [FATO] | aula 5 |
| `authorization` 2026-07-28 | token nunca na query string; servidor valida audiência (RFC 8707); cliente valida `iss` (RFC 9207) | confere | aula 5 (o `iss` é do cliente: só uma frase + link para o curso 1) |
| changelog 2026-07-28 | credenciais do cliente presas ao servidor de autorização que as emitiu (SEP-2352) | confere | aula 5 |
| `inema-agent-runtime/runtime/POLITICA.md` (5cb431b) | níveis N0–N4; "nunca passe credencial de uma ferramenta para outra" | confere (ideia) | aulas 3 e 5 (teto por ação; nada de passthrough) |
| draft Web Bot Auth -00 | `Signature-Agent` (dicionário, https), JWKS em `/.well-known/http-message-signatures-directory`, `tag="web-bot-auth"`, `created`/`expires` (≤ 24 h recomendado), `keyid` = thumbprint JWK; replay possível dentro da validade; não autentica pessoa nem autoriza (§4.1, §4.6) | confere | aula 6 |
| Cloudflare "Verified bots" (atualizada 08/10/2026) | desde 01/07/2026 signed agents contam como Verified; campo Direct × Intermediary | confere | aula 6 |
| PESQUISA §4.6 | "Cloudflare + Google" no draft | confere (autores Meunier/Cloudflare e Major/Google) | aula 6 |

### Itens [incerto]/[2ª] que NÃO entram como fato
Data da posição do WebKit; versão em que o Chrome tirou `navigator.modelContext`; GA do Claude for Chrome; Atlas (só "relatado"); auto browse no Android; números do OSWorld; Brave/Comet.

### Chamadas de modelo
Nenhuma. Nenhuma prática depende de modelo, chave de API ou extensão com chave. Ataque de prompt injection aparece como **texto** (filtro, canário, linter), nunca rodado contra um modelo (isso é a LOOP-R, aula `injecao`).

Baseline dos repos de fonte (não alterados), 19/10/2026: webmcp-1-formacao eb037fb · webmcp-2-builder 676c46e · webmcp-3-integrator 1c81fe8 · webmcp-4-agent-developer f4d8c69 · webmcp-5-expert c1ee007 · webmcp-readiness 9ae7d73 · aiv2026 097d98f · astra-computer-use 30ad91a · agi-pratica 03577c0 · MCP 2124c29 · inema-agent-runtime 5cb431b.

## Kit (`kit/`)
`package.json` com versões fixas (playwright 1.64.0; `@modelcontextprotocol/server`/`client` 2.3.1, `node` 2.1.1; zod 4.6.7). Página de exemplo `pagina/` (agenda de mentorias) com **dois furos de propósito** (`ler_avaliacoes` sem `untrustedContentHint`; `cancelar_agendamento` sem anotação e sem confirmação) que o aluno conserta nas aulas 2 e 3 (`solucao/` tem a versão consertada). `lib/navegador.mjs` (servidor local + Chromium nos modos `sem` e `nativo`). Scripts: `filtro.mjs` (a1), `checar.mjs` (a2/a3), `exposicao.mjs` (a4), `mcp/servidor.mjs` + `atacar-mcp.mjs` + `segredos.mjs` (a5), `wba.mjs` (a6), `ameacas.mjs` + `ficha.mjs` (a7), `auditar.mjs` (a8). Blocos `blocos/aN[x]-*.sh` → `saidas/*.txt` por `capturar.sh` (TMPDIR curto em /tmp, timeout 300 s, `echo "saída: $?"` em todo bloco, versão na 1ª linha).

## Aulas

| # | slug | título | objetivo (≤160) | diagrama | prática → pronto quando |
|---|---|---|---|---|---|
| 1 | sem-solucao | Prompt injection não tem solução: o que Anthropic e OpenAI dizem | ler o que os fornecedores admitem sobre prompt injection, com data, e provar que um filtro de palavras deixa passar ataque. | 3 vetores da spec §6.3.1: descrição → saída → a ferramenta como alvo | `node scripts/filtro.mjs` → `passaram: 2 de 5 · saída: 1`; com um payload seu → `passaram: ≥1` |
| 2 | dado-nao-e-instrucao | Dado da página nunca é instrução: untrustedContentHint e spotlighting | achar com um canário toda ferramenta que devolve texto de terceiro e marcá-la com untrustedContentHint, sabendo o que o cliente faz com isso. | visitante escreve → ferramenta devolve → anotação → cliente marca (delimitar/datamarking/codificar) | `node scripts/checar.mjs` → `FALHA ler_avaliacoes: devolve texto de terceiro sem untrustedContentHint` (saída 1) → depois do conserto, só a falha da aula 3 |
| 3 | consequencia | Ação com consequência pede humano: confirmação e consequentialHint | pôr consequentialHint e uma confirmação que mostra alvo e efeito em toda ferramenta que muda algo, e provar que recusar não muda nada. | pedido → anotação → diálogo com alvo/efeito → pessoa decide → efeito ou nada | `node scripts/checar.mjs` → `FALHA cancelar_agendamento: agiu sem pedir confirmação` → depois `0 falhas · saída: 0` |
| 4 | quem-ve | Quem vê a ferramenta: mesma origem, exposedTo, iframes e Permissions-Policy | medir quem enxerga cada ferramenta (mesma origem, iframe, exposedTo, fromOrigins) e desligar o WebMCP onde ele não deve existir. | topo ↔ iframe: allow="tools" → exposedTo → fromOrigins; Permissions-Policy: tools=() corta tudo | `node scripts/exposicao.mjs` → 6 casos, `topo vê a ferramenta do iframe só no caso D` · `saída: 0` |
| 5 | servidor-seguro | Servidor MCP seguro: audiência, escopo mínimo, handle preso ao usuário e segredo fora do repo | rodar 6 ataques contra um servidor MCP fraco e um seguro e saber quais o SDK barra sozinho e quais dependem de você. | cliente → Host/Origin → token (audiência, validade) → escopo da ferramenta → handle do usuário | `node scripts/atacar-mcp.mjs fraco` → `passaram: 4 de 6 · saída: 1`; `seguro` → `passaram: 0 de 6 · saída: 0`; `node scripts/segredos.mjs .` → `0 segredos` |
| 6 | quem-chega | Identificar quem chega: Web Bot Auth e signed agents (rascunho IETF) | conferir uma assinatura Web Bot Auth com o vetor do draft e verificar pedidos assinados num servidor local, sabendo o que ela não prova. | agente assina (@method @authority @path) → Signature-Agent → origem confere chave → política do site | `node scripts/wba.mjs vetor` → `vetor E.2.1: confere`; `node scripts/wba.mjs demo` → 6 casos, `replay dentro da validade: aceito` |
| 7 | ameacas | Modelagem de ameaças de uma ferramenta | modelar as ameaças de cada ferramenta com as categorias da spec e passar o catálogo num linter que acha envenenamento, excesso de parâmetros e efeito escondido. | ferramenta → 7 categorias (§6.3) → controle → teste | `node scripts/ameacas.mjs catalogos/ruim.mjs` → `6 achados · saída: 1`; o seu → `0 achados`; `node scripts/ficha.mjs <sua-ficha>` → `7/7 categorias com controle` |
| 8 | auditoria | Auditoria de segurança do seu site e servidor | rodar a auditoria completa (página, exposição, servidor, segredos, catálogo), ver uma quebra ser pega e sair com o plano datado de revisão. | mapa 4 degraus + gerador | `node scripts/auditar.mjs` → `AUDITORIA: 6/6 ok · saída: 0`; com um segredo plantado → `5/6` e saída 1 |

Quiz: 3–5 perguntas por aula; certa variando entre A/B/C/D e **nunca** a opção mais longa. Links da aula 8: curso seguinte `https://inematds.github.io/formacao-webmcp-expert-v72/` (ainda não publicado em 19/10/2026); tríade letal → `https://inematds.github.io/loop-r-eng-seguranca-v72/aulas/triade/`; injeção reproduzida com agente falso → `…/aulas/injecao/`; evals → `loop-r-eng-verificacao-v72`.

## Desvios do CURRICULO (com motivo)
- Títulos levemente encurtados para caber no menu (mesma ordem e mesmo tema das 8 aulas).
- Aula 1: a posição da OpenAI entra como **relatada** (fonte primária com 403 em 19/10), não como fato.
- Aula 5: OAuth em si (401 + RFC 9728, `iss`) é do curso 1 (`aulas/autorizacao/`); aqui só o lado do ataque.
- Slug da aula 5 escolhido livre (`servidor-seguro`): os cursos 0, 1 e 2 linkam a **raiz** deste curso, não uma aula.

## Fora deste curso (dono por link)
Registrar ferramenta/anotações como API → curso 2. Agente consumidor e `fromOrigins` do lado do agente → curso 3. OAuth completo → curso 1. Tríade letal, injeção contra agente falso, sandbox, hooks → LOOP-R `loop-r-eng-seguranca-v72`. Evals → `loop-r-eng-verificacao-v72`. robots/GEO → inemaSEO.
