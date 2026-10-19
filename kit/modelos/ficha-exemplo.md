# Ficha de ameaças — ferramenta: cancelar_agendamento

Data: 2026-10-19 · Spec de referência: WebMCP, rascunho CG de 16/10/2026, §6.3

## 1. Envenenamento da descrição (§6.3.1.1)
Ameaça: a descrição ser trocada (dependência comprometida) para mandar o agente cancelar tudo.
Controle: descrição curta e fixa no código; Permissions-Policy tools=() nas páginas sem ferramenta.
Teste: node scripts/ameacas.mjs pagina/ferramentas.mjs → 0 achados

## 2. Injeção pela saída (§6.3.1.2)
Ameaça: não se aplica à saída (devolve só código, id e nome); o risco vem de ler_avaliacoes, que pode mandar cancelar.
Controle: ler_avaliacoes marcada com untrustedContentHint; cancelar sempre pede confirmação.
Teste: node scripts/checar.mjs → ler_avaliacoes ok, cancelar_agendamento ok

## 3. A ferramenta como alvo (§6.3.1.3)
Ameaça: caminho do agente pular a regra que o botão aplica.
Controle: a ferramenta e o botão chamam a mesma agenda.cancelar(); entrada com pattern ^AG-[0-9]+$.
Teste: node scripts/ameacas.mjs pagina/ferramentas.mjs → sem "entrada aberta"

## 4. Intenção mal descrita (§6.3.2)
Ameaça: o agente achar que "cancelar" só consulta.
Controle: consequentialHint e descrição com o efeito ("devolve a vaga à agenda").
Teste: node scripts/checar.mjs → "consequentialHint + confirmação"

## 5. Excesso de parâmetros (§6.3.3)
Ameaça: pedir dado pessoal para cancelar.
Controle: só o código do agendamento; nada de nome, e-mail ou motivo.
Teste: node scripts/ameacas.mjs pagina/ferramentas.mjs → sem "dado pessoal"

## 6. Fronteira de origem (§6.3.4, ainda TODO na spec)
Ameaça: um iframe de outra origem ver e chamar a ferramenta.
Controle: sem exposedTo; iframes de terceiros sem allow="tools".
Teste: node scripts/exposicao.mjs → 7/7 casos conferem

## 7. Navegação privada (§6.3.5)
Ameaça: o agente levar o agendamento de uma janela privada para o perfil normal.
Controle: responsabilidade do navegador pela spec; o site não guarda nada além da visita.
Teste: revisão manual a cada mudança de spec (data na ficha)
