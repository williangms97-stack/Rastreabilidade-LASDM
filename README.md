# Rastreabilidade LASDM

Rastreamento das amostras de sementes no arquivo refrigerado do Laboratório de Análise de Sementes LASDM e da movimentação para as salas de análise, montagem, tratamento e homogeneização.

- **Aplicativo (celular):** https://williangms97-stack.github.io/Rastreabilidade-LASDM/
- **Painel:** https://williangms97-stack.github.io/Rastreabilidade-LASDM/painel.html

## Arquivos
- `index.html` — app de bipagem: QR + foto da etiqueta, leitura do texto (OCR), conferência com as planilhas, sugestão de posição, salas e etiquetas das linhas.
- `painel.html` — indicadores, ocupação das prateleiras, salas, conciliação (recebidas × registradas), movimentos e envio das planilhas de referência.
- `regras.js` — regras compartilhadas: grupos de tipo de remessa, perfil da prateleira, endereçamento e etiqueta da linha.
- `apps-script/Codigo.gs` — banco de dados na Planilha Google (Movimentos, Prateleiras, Referência, Usuários).

## Implantação do banco de dados
1. Crie uma planilha Google nova (só para o LASDM).
2. Extensões → Apps Script → cole `apps-script/Codigo.gs` → Salvar.
3. Implantar → Nova implantação → App da Web · Executar como **Eu** · Acesso **Qualquer pessoa**.
4. No primeiro acesso ao app, informe o link `/exec` e crie o administrador.
5. No painel, aba "Planilhas de referência", envie a planilha do sistema e a manual.
