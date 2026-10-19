cd ~/projetos/formacao-webmcp-seguranca-v72/kit
node scripts/servir.mjs & P=$!
until curl -s -o /dev/null http://127.0.0.1:8742/; do sleep 0.3; done
curl -sI http://127.0.0.1:8742/privacidade.html | grep -i '^permissions-policy'
curl -sI http://127.0.0.1:8742/ | grep -ci '^permissions-policy'
kill $P; echo "saída: $?"
