cd ~/projetos/formacao-webmcp-seguranca-v72/kit
node scripts/segredos.mjs .; echo "saída: $?"
E=${TMPDIR:-/tmp}/ensaio-seguranca/vazou; mkdir -p $E
printf "export const API_KEY = '%s';\n" $(openssl rand -hex 16) > $E/config.mjs
node scripts/segredos.mjs $E; echo "saída: $?"
