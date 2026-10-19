cd ~/projetos/formacao-webmcp-seguranca-v72/kit
printf "export const TOKEN = '%s';\n" $(openssl rand -hex 16) > pagina/config-esquecida.mjs
node scripts/auditar.mjs | tail -2; echo "saída: ${PIPESTATUS[0]}"
rm pagina/config-esquecida.mjs
