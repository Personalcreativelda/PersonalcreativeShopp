/**
 * EXEMPLO: Cliente PostgreSQL
 * 
 * Este arquivo mostra como conectar ao PostgreSQL independente
 * substituindo o Supabase.
 * 
 * NÃO USE ESTE ARQUIVO DIRETAMENTE - É APENAS UM EXEMPLO!
 */

import postgres from 'postgres';

// ============================================
// CONFIGURAÇÃO
// ============================================

const sql = postgres({
  host: import.meta.env.VITE_PG_HOST || 'localhost',
  port: parseInt(import.meta.env.VITE_PG_PORT || '5432'),
  database: import.meta.env.VITE_PG_DATABASE || 'naturerva_erp',
  username: import.meta.env.VITE_PG_USER || 'postgres',
  password: import.meta.env.VITE_PG_PASSWORD,
  max: parseInt(import.meta.env.VITE_PG_MAX_CONNECTIONS || '20'),
  idle_timeout: parseInt(import.meta.env.VITE_PG_IDLE_TIMEOUT || '30000'),
  // SSL pode ser necessário em produção
  // ssl: import.meta.env.VITE_PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

export default sql;

// ============================================
// EXEMPLOS DE USO
// ============================================

/**
 * EXEMPLO 1: Buscar produtos
 */
export async function getProducts() {
  try {
    const products = await sql`
      SELECT * FROM products 
      WHERE show_in_shop = true 
      ORDER BY name ASC
    `;
    return products;
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    throw error;
  }
}

/**
 * EXEMPLO 2: Buscar produto por ID
 */
export async function getProductById(id: string) {
  try {
    const [product] = await sql`
      SELECT * FROM products 
      WHERE id = ${id}
    `;
    return product || null;
  } catch (error) {
    console.error('Erro ao buscar produto:', error);
    throw error;
  }
}

/**
 * EXEMPLO 3: Criar produto
 */
export async function createProduct(productData: {
  name: string;
  slug: string;
  category: string;
  price: number;
  stock: number;
  unit: string;
}) {
  try {
    const [product] = await sql`
      INSERT INTO products (
        name, slug, category, price, stock, unit
      ) VALUES (
        ${productData.name},
        ${productData.slug},
        ${productData.category},
        ${productData.price},
        ${productData.stock},
        ${productData.unit}
      )
      RETURNING *
    `;
    return product;
  } catch (error) {
    console.error('Erro ao criar produto:', error);
    throw error;
  }
}

/**
 * EXEMPLO 4: Atualizar produto
 */
export async function updateProduct(id: string, updates: {
  name?: string;
  price?: number;
  stock?: number;
  [key: string]: any;
}) {
  try {
    const [product] = await sql`
      UPDATE products 
      SET 
        name = COALESCE(${updates.name}, name),
        price = COALESCE(${updates.price}, price),
        stock = COALESCE(${updates.stock}, stock),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    return product;
  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    throw error;
  }
}

/**
 * EXEMPLO 5: Deletar produto
 */
export async function deleteProduct(id: string) {
  try {
    await sql`
      DELETE FROM products 
      WHERE id = ${id}
    `;
    return true;
  } catch (error) {
    console.error('Erro ao deletar produto:', error);
    throw error;
  }
}

/**
 * EXEMPLO 6: Buscar com JOIN
 */
export async function getProductsWithVariants() {
  try {
    const products = await sql`
      SELECT 
        p.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', v.id,
              'name', v.name,
              'price', v.price,
              'stock', v.stock
            )
          ) FILTER (WHERE v.id IS NOT NULL),
          '[]'
        ) as variants
      FROM products p
      LEFT JOIN product_variants v ON v.product_id = p.id
      WHERE p.show_in_shop = true
      GROUP BY p.id
      ORDER BY p.name ASC
    `;
    return products;
  } catch (error) {
    console.error('Erro ao buscar produtos com variantes:', error);
    throw error;
  }
}

/**
 * EXEMPLO 7: Transação
 */
export async function createOrder(orderData: any) {
  try {
    // Iniciar transação
    const result = await sql.begin(async sql => {
      // 1. Criar pedido
      const [order] = await sql`
        INSERT INTO orders (
          customer_name, customer_phone, items, total_amount, status
        ) VALUES (
          ${orderData.customerName},
          ${orderData.customerPhone},
          ${JSON.stringify(orderData.items)},
          ${orderData.totalAmount},
          'pending'
        )
        RETURNING *
      `;

      // 2. Atualizar stock dos produtos
      for (const item of orderData.items) {
        await sql`
          UPDATE products 
          SET stock = stock - ${item.quantity}
          WHERE id = ${item.productId}
        `;
      }

      // 3. Registrar movimento de stock
      await sql`
        INSERT INTO stock_transactions (
          product_id, quantity, type, source_type, source_id
        )
        SELECT 
          ${item.productId},
          ${item.quantity},
          'out',
          'order',
          ${order.id}
        FROM json_array_elements(${JSON.stringify(orderData.items)}) AS item
      `;

      return order;
    });

    return result;
  } catch (error) {
    console.error('Erro ao criar pedido:', error);
    throw error;
  }
}

/**
 * EXEMPLO 8: Buscar com paginação
 */
export async function getProductsPaginated(page: number = 1, perPage: number = 20) {
  try {
    const offset = (page - 1) * perPage;

    const products = await sql`
      SELECT * FROM products 
      ORDER BY created_at DESC
      LIMIT ${perPage}
      OFFSET ${offset}
    `;

    const [{ count }] = await sql`
      SELECT COUNT(*) FROM products
    `;

    return {
      data: products,
      pagination: {
        page,
        perPage,
        total: parseInt(count),
        totalPages: Math.ceil(parseInt(count) / perPage)
      }
    };
  } catch (error) {
    console.error('Erro ao buscar produtos paginados:', error);
    throw error;
  }
}

/**
 * EXEMPLO 9: Buscar com filtros dinâmicos
 */
export async function searchProducts(filters: {
  category?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
}) {
  try {
    let query = sql`SELECT * FROM products WHERE 1=1`;

    if (filters.category) {
      query = sql`${query} AND category = ${filters.category}`;
    }

    if (filters.search) {
      query = sql`${query} AND name ILIKE ${'%' + filters.search + '%'}`;
    }

    if (filters.minPrice !== undefined) {
      query = sql`${query} AND price >= ${filters.minPrice}`;
    }

    if (filters.maxPrice !== undefined) {
      query = sql`${query} AND price <= ${filters.maxPrice}`;
    }

    query = sql`${query} ORDER BY name ASC`;

    const products = await query;
    return products;
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    throw error;
  }
}

/**
 * EXEMPLO 10: Testar conexão
 */
export async function testConnection() {
  try {
    const [result] = await sql`SELECT NOW() as timestamp`;
    console.log('✅ Conexão PostgreSQL OK!', result.timestamp);
    return true;
  } catch (error) {
    console.error('❌ Erro na conexão PostgreSQL:', error);
    return false;
  }
}

// ============================================
// HELPERS
// ============================================

/**
 * Encerrar conexões (útil para testes)
 */
export async function closeConnection() {
  await sql.end();
}

/**
 * Health check
 */
export async function healthCheck() {
  try {
    const [result] = await sql`
      SELECT 
        current_database() as database,
        current_user as user,
        version() as version,
        NOW() as timestamp
    `;
    return {
      status: 'healthy',
      ...result
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============================================
// NOTAS IMPORTANTES
// ============================================

/*
1. SEGURANÇA:
   - NUNCA exponha credenciais do banco no frontend
   - Use variáveis de ambiente (.env)
   - Em produção, use conexão SSL

2. PERFORMANCE:
   - Use índices para campos pesquisados frequentemente
   - Limite resultados com LIMIT
   - Use paginação para grandes datasets
   - Cache queries frequentes

3. BOAS PRÁTICAS:
   - Use prepared statements (automático com postgres.js)
   - Trate erros apropriadamente
   - Use transações para operações múltiplas
   - Valide dados antes de inserir

4. MIGRAÇÃO DO SUPABASE:
   - Substitua supabase.from('table') por sql`SELECT * FROM table`
   - Substitua .select() por SELECT
   - Substitua .insert() por INSERT INTO
   - Substitua .update() por UPDATE
   - Substitua .delete() por DELETE
   - Substitua .eq() por WHERE
   - Substitua .order() por ORDER BY

5. DIFERENÇAS:
   - Supabase: supabase.from('products').select('*')
   - Postgres: await sql`SELECT * FROM products`
   
   - Supabase: supabase.from('products').insert({ name: 'Test' })
   - Postgres: await sql`INSERT INTO products (name) VALUES (${'Test'})`
   
   - Supabase: supabase.from('products').update({ name: 'New' }).eq('id', '123')
   - Postgres: await sql`UPDATE products SET name = ${'New'} WHERE id = ${'123'}`
*/
