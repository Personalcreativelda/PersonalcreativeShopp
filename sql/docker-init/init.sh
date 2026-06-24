#!/bin/bash
set -e

echo "=================================================="
echo " NaturErva ERP — Inicializando banco de dados..."
echo "=================================================="

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -f /docker-init-sql/PARTE_1_TABELAS_BASE.sql
echo "✓ Tabelas base criadas (profiles, produtos, clientes...)"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -f /docker-init-sql/PARTE_2_TABELAS_TRANSACOES.sql
echo "✓ Tabelas de transações criadas (pedidos, vendas, stock...)"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -f /docker-init-sql/PARTE_3_INDICES_DADOS.sql
echo "✓ Índices e triggers criados"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -f /docker-init-sql/fixes/ADD_PRODUCT_CONTENT_FIELDS.sql
echo "✓ Campos extra de produto adicionados"

echo "=================================================="
echo " Banco de dados inicializado com sucesso!"
echo "=================================================="
