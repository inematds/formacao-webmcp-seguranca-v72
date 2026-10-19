cd ~/projetos/formacao-webmcp-seguranca-v72/kit
E=${TMPDIR:-/tmp}/ensaio-seguranca; mkdir -p $E
cp modelos/ficha-ameacas.md $E/minha-ficha.md
node scripts/ficha.mjs $E/minha-ficha.md | tail -1; echo "saída: ${PIPESTATUS[0]}"
node scripts/ficha.mjs modelos/ficha-exemplo.md; echo "saída: $?"
