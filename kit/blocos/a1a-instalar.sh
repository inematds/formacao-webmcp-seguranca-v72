git clone https://github.com/inematds/formacao-webmcp-seguranca-v72 ~/projetos/formacao-webmcp-seguranca-v72
cd ~/projetos/formacao-webmcp-seguranca-v72/kit
npm ci && npx playwright@1.64.0 install chromium
echo "saída: $?"
