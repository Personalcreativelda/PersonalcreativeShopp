import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

function makeSlug(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function uniqueSlug(client, name) {
  const base = makeSlug(name);
  let slug = base;
  let attempt = 0;
  while (true) {
    const { rows } = await client.query('SELECT id FROM products WHERE slug = $1', [slug]);
    if (!rows.length) return slug;
    attempt++;
    slug = `${base}-${attempt}`;
  }
}

function toFloat(val) {
  if (val === undefined || val === null || val === '') return 0;
  return parseFloat(String(val).replace(',', '.')) || 0;
}

function toBool(val, defaultVal = true) {
  if (val === undefined || val === null || val === '') return defaultVal;
  return ['sim', 's', 'yes', 'true', '1'].includes(String(val).toLowerCase().trim());
}

// POST /api/import/products
router.post('/products', authMiddleware, async (req, res) => {
  const { rows } = req.body;

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'Nenhuma linha de dados recebida' });
  }

  // Agrupar linhas por nome do produto
  const groups = new Map();
  for (const row of rows) {
    const nome = String(row.nome || '').trim();
    if (!nome) continue;
    if (!groups.has(nome)) groups.set(nome, []);
    groups.get(nome).push(row);
  }

  if (groups.size === 0) {
    return res.status(400).json({ error: 'Nenhum produto válido encontrado (coluna "nome" obrigatória)' });
  }

  const result = { imported: 0, skipped: 0, errors: [] };
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const [nome, productRows] of groups) {
      try {
        // Verificar duplicado por nome
        const { rows: existing } = await client.query(
          'SELECT id FROM products WHERE LOWER(TRIM(name)) = LOWER($1)',
          [nome.trim()]
        );
        if (existing.length > 0) {
          result.skipped++;
          result.errors.push({ nome, reason: 'Produto já existe — ignorado' });
          continue;
        }

        const first = productRows[0];
        const hasVariants = productRows.some(r => String(r.variante_nome || '').trim() !== '');

        const slug = await uniqueSlug(client, nome);

        // Produto com variantes: preço/stock ficam no variante (não no produto principal)
        const productPrice = hasVariants ? 0 : toFloat(first.preco_venda);
        const productCost  = hasVariants ? 0 : toFloat(first.preco_custo);
        const productStock = hasVariants ? 0 : toFloat(first.stock);

        const barcode = String(first.barcode || '').trim() || null;
        const image   = String(first.image   || '').trim() || null;
        const image2  = String(first.image2  || '').trim() || null;
        const image3  = String(first.image3  || '').trim() || null;
        const image4  = String(first.image4  || '').trim() || null;

        // If barcode provided, check it's not already in use
        if (barcode) {
          const { rows: bcCheck } = await client.query(
            'SELECT id FROM products WHERE barcode = $1 LIMIT 1',
            [barcode]
          );
          if (bcCheck.length > 0) {
            result.errors.push({ nome, reason: `Código de barras "${barcode}" já está em uso por outro produto` });
            result.skipped++;
            continue;
          }
        }

        const { rows: inserted } = await client.query(
          `INSERT INTO products
            (name, slug, price, cost_price, type, category, stock, min_stock, unit,
             show_in_shop, description, description_long, benefits, how_to_use, ingredients,
             barcode, image, image_url2, image_url3, image_url4)
           VALUES ($1,$2,$3,$4,'GERAL',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
           RETURNING id`,
          [
            nome,
            slug,
            productPrice,
            productCost,
            String(first.categoria || '').trim() || null,
            productStock,
            toFloat(first.stock_minimo),
            String(first.unidade || 'un').trim(),
            toBool(first.mostrar_na_loja, true),
            String(first.descricao || '').trim() || null,
            String(first.descricao_longa || '').trim() || null,
            String(first.beneficios || '').trim() || null,
            String(first.como_usar || '').trim() || null,
            String(first.ingredientes || '').trim() || null,
            barcode,
            image,
            image2,
            image3,
            image4,
          ]
        );

        const productId = inserted[0].id;

        if (hasVariants) {
          let defaultSet = false;
          const variantRows = productRows.filter(r => String(r.variante_nome || '').trim() !== '');

          for (let i = 0; i < variantRows.length; i++) {
            const vRow = variantRows[i];
            const vNome  = String(vRow.variante_nome).trim();
            const vPrice = toFloat(vRow.variante_preco_venda || vRow.preco_venda);
            const vCost  = toFloat(vRow.variante_preco_custo  || vRow.preco_custo);
            const vStock = toFloat(vRow.variante_stock || vRow.stock);
            const vMinSt = toFloat(vRow.variante_stock_minimo || vRow.stock_minimo);
            const vUnit  = String(vRow.unidade || first.unidade || 'un').trim();

            // Padrão: marcado explicitamente como "Sim" ou o primeiro variante
            const markedDefault = toBool(vRow.variante_padrao, false);
            const isDefault = markedDefault || (!defaultSet && i === 0);
            if (isDefault) defaultSet = true;

            await client.query(
              `INSERT INTO product_variants
                (product_id, name, price, cost_price, stock, min_stock, unit, is_default, display_order)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
              [productId, vNome, vPrice, vCost, vStock, vMinSt, vUnit, isDefault, i]
            );
          }
        }

        result.imported++;
      } catch (rowErr) {
        result.errors.push({ nome, reason: rowErr.message });
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Import] Erro geral:', err.message);
    return res.status(500).json({ error: 'Erro durante a importação: ' + err.message });
  } finally {
    client.release();
  }

  console.log(`[Import] Concluído: ${result.imported} importados, ${result.skipped} ignorados, ${result.errors.length} erros`);
  res.json(result);
});

export default router;
