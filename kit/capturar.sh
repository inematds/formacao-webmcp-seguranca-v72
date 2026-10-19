#!/usr/bin/env bash
# capturar.sh — roda cada bloco "Terminal" do curso (kit/blocos/*.sh) e grava a saída em kit/saidas/.
# É daqui que saem as abas "Saída capturada" das aulas. Nenhum bloco chama modelo nem API paga.
# Estado da página por aula (os furos de propósito): a1/a2a = original; a2b/a2c = solucao/aula2; a3+ = solucao/aula3.
# O pagina/ferramentas.mjs original volta no fim. TMPDIR curto em /tmp (o Chromium recusa caminho de socket longo).
# Uso: bash capturar.sh            # todos menos a1a-instalar (precisa do repo publicado)
#      bash capturar.sh a4a-exposicao
set -uo pipefail
K=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$K/saidas"
ORIG=$(mktemp /tmp/ferr.XXXX); cp "$K/pagina/ferramentas.mjs" "$ORIG"
trap 'cp "$ORIG" "$K/pagina/ferramentas.mjs"; rm -f "$ORIG"' EXIT
estado() {
  case "$1" in
    a1*|a2a*) cp "$ORIG" "$K/pagina/ferramentas.mjs" ;;
    a2*) cp "$K/solucao/aula2/ferramentas.mjs" "$K/pagina/ferramentas.mjs" ;;
    *) cp "$K/solucao/aula3/ferramentas.mjs" "$K/pagina/ferramentas.mjs" ;;
  esac
}
alvos=("$@"); [ ${#alvos[@]} -eq 0 ] && alvos=($(cd "$K/blocos" && ls *.sh | grep -v 'a1a-instalar' | sed 's/\.sh$//'))
for b in "${alvos[@]}"; do
  estado "$b"
  T=$(mktemp -d /tmp/x.XXXX)
  ( cd /tmp && TMPDIR="$T" timeout 400 bash "$K/blocos/$b.sh" ) 2>&1 | sed -e "s#$T#/tmp#g" -e "s#$HOME#~#g" > "$K/saidas/$b.txt"
  rm -rf "$T"
  echo "$b: $(wc -l < "$K/saidas/$b.txt") linhas · $(tail -1 "$K/saidas/$b.txt")"
done
