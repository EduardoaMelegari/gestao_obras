# Dashboard de Obras (Mato Grosso)

Sistema de dashboard para acompanhamento de obras, com sincronização automática via Google Sheets.

## Funcionalidades
- **Multi-Cidades**: Suporte para filtros por cidade (Sorriso, Lucas do Rio Verde, Sinop, etc.).
- **Sincronização Automática**: Lê dados diretamente de planilhas CSV publicadas.
- **Banco de Dados Local**: SQLite para persistência e performance.
- **Dockerizado**: Fácil deploy com Docker Compose.

## Portas (Docker)
- **Frontend (Dashboard)**: [http://localhost:5932](http://localhost:5932)
- **Backend (API)**: [http://localhost:36006](http://localhost:36006)

## Como Rodar (Docker)

1.  Certifique-se de ter o Docker instalado.
2.  Na raiz do projeto, execute:
    ```bash
    docker-compose up --build -d
    ```
3.  Acesse o painel em `http://localhost:5932`.

## Configuração
Para adicionar novas cidades ou editar as planilhas de origem, edite o arquivo:
`server/sync-sheets.js`

O sistema recarregará as configurações automaticamente no próximo reinício.
