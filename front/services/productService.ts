/**
 * Serviço de Produtos - Adaptador Supabase/PostgreSQL
 * 
 * Este serviço funciona com ambos os bancos de dados
 */

import { supabase } from '../modules/core/services/supabaseClient';
import { sql, usePostgres, type Product, type ProductVariant } from './db';

// ============================================
// PRODUTOS
// ============================================

export async function getProducts() {
  if (usePostgres && sql) {
    // PostgreSQL
    const products = await sql<Product[]>`
      SELECT * FROM products 
      WHERE show_in_shop = true 
      ORDER BY name ASC
    `;
    return { data: products, error: null };
  } else {
    // Supabase
    return await supabase
      .from('products')
      .select('*')
      .eq('show_in_shop', true)
      .order('name', { ascending: true });
  }
}

export async function getProductById(id: string) {
  if (usePostgres && sql) {
    // PostgreSQL
    const [product] = await sql<Product[]>`
      SELECT * FROM products 
      WHERE id = ${id}
    `;
    return { data: product || null, error: null };
  } else {
    // Supabase
    return await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();
  }
}

export async function getProductBySlug(slug: string) {
  if (usePostgres && sql) {
    // PostgreSQL
    const [product] = await sql<Product[]>`
      SELECT * FROM products 
      WHERE slug = ${slug}
    `;
    return { data: product || null, error: null };
  } else {
    // Supabase
    return await supabase
      .from('products')
      .select('*')
      .eq('slug', slug)
      .single();
  }
}

export async function createProduct(productData: Partial<Product>) {
  if (usePostgres && sql) {
    // PostgreSQL
    const [product] = await sql<Product[]>`
      INSERT INTO products ${sql(productData as any)}
      RETURNING *
    `;
    return { data: product, error: null };
  } else {
    // Supabase
    return await supabase
      .from('products')
      .insert(productData)
      .select()
      .single();
  }
}

export async function updateProduct(id: string, updates: Partial<Product>) {
  if (usePostgres && sql) {
    // PostgreSQL
    const [product] = await sql<Product[]>`
      UPDATE products 
      SET ${sql(updates as any)}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    return { data: product, error: null };
  } else {
    // Supabase
    return await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
  }
}

export async function deleteProduct(id: string) {
  if (usePostgres && sql) {
    // PostgreSQL
    await sql`DELETE FROM products WHERE id = ${id}`;
    return { error: null };
  } else {
    // Supabase
    return await supabase
      .from('products')
      .delete()
      .eq('id', id);
  }
}

// ============================================
// VARIANTES
// ============================================

export async function getProductVariants(productId: string) {
  if (usePostgres && sql) {
    // PostgreSQL
    const variants = await sql<ProductVariant[]>`
      SELECT * FROM product_variants 
      WHERE product_id = ${productId}
      ORDER BY name ASC
    `;
    return { data: variants, error: null };
  } else {
    // Supabase
    return await supabase
      .from('product_variants')
      .select('*')
      .eq('product_id', productId)
      .order('name', { ascending: true });
  }
}

export async function getProductWithVariants(slug: string) {
  if (usePostgres && sql) {
    // PostgreSQL - Query com JOIN
    const [product] = await sql`
      SELECT 
        p.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', v.id,
              'product_id', v.product_id,
              'name', v.name,
              'price', v.price,
              'stock', v.stock,
              'unit', v.unit,
              'image', v.image,
              'created_at', v.created_at,
              'updated_at', v.updated_at
            )
          ) FILTER (WHERE v.id IS NOT NULL),
          '[]'
        ) as variants
      FROM products p
      LEFT JOIN product_variants v ON v.product_id = p.id
      WHERE p.slug = ${slug}
      GROUP BY p.id
    `;
    
    return { 
      data: product ? {
        ...product,
        variants: product.variants || []
      } : null, 
      error: null 
    };
  } else {
    // Supabase
    const { data: product, error } = await supabase
      .from('products')
      .select(`
        *,
        product_variants (*)
      `)
      .eq('slug', slug)
      .single();

    return { 
      data: product ? {
        ...product,
        variants: product.product_variants || []
      } : null,
      error
    };
  }
}

export async function createProductVariant(variantData: Partial<ProductVariant>) {
  if (usePostgres && sql) {
    // PostgreSQL
    const [variant] = await sql<ProductVariant[]>`
      INSERT INTO product_variants ${sql(variantData as any)}
      RETURNING *
    `;
    return { data: variant, error: null };
  } else {
    // Supabase
    return await supabase
      .from('product_variants')
      .insert(variantData)
      .select()
      .single();
  }
}

export async function updateProductVariant(id: string, updates: Partial<ProductVariant>) {
  if (usePostgres && sql) {
    // PostgreSQL
    const [variant] = await sql<ProductVariant[]>`
      UPDATE product_variants 
      SET ${sql(updates as any)}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    return { data: variant, error: null };
  } else {
    // Supabase
    return await supabase
      .from('product_variants')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
  }
}

export async function deleteProductVariant(id: string) {
  if (usePostgres && sql) {
    // PostgreSQL
    await sql`DELETE FROM product_variants WHERE id = ${id}`;
    return { error: null };
  } else {
    // Supabase
    return await supabase
      .from('product_variants')
      .delete()
      .eq('id', id);
  }
}

// ============================================
// BUSCA E FILTROS
// ============================================

export async function searchProducts(filters: {
  category?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  featured?: boolean;
}) {
  if (usePostgres && sql) {
    // PostgreSQL - Query dinâmica
    let conditions = ['show_in_shop = true'];
    const params: any[] = [];

    if (filters.category) {
      conditions.push(`category = $${params.length + 1}`);
      params.push(filters.category);
    }

    if (filters.search) {
      conditions.push(`name ILIKE $${params.length + 1}`);
      params.push(`%${filters.search}%`);
    }

    if (filters.minPrice !== undefined) {
      conditions.push(`price >= $${params.length + 1}`);
      params.push(filters.minPrice);
    }

    if (filters.maxPrice !== undefined) {
      conditions.push(`price <= $${params.length + 1}`);
      params.push(filters.maxPrice);
    }

    if (filters.featured !== undefined) {
      conditions.push(`featured = $${params.length + 1}`);
      params.push(filters.featured);
    }

    const query = `
      SELECT * FROM products 
      WHERE ${conditions.join(' AND ')}
      ORDER BY name ASC
    `;

    const products = await sql.unsafe(query, params);
    return { data: products, error: null };
  } else {
    // Supabase
    let query = supabase
      .from('products')
      .select('*')
      .eq('show_in_shop', true);

    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    if (filters.search) {
      query = query.ilike('name', `%${filters.search}%`);
    }

    if (filters.minPrice !== undefined) {
      query = query.gte('price', filters.minPrice);
    }

    if (filters.maxPrice !== undefined) {
      query = query.lte('price', filters.maxPrice);
    }

    if (filters.featured !== undefined) {
      query = query.eq('featured', filters.featured);
    }

    return await query.order('name', { ascending: true });
  }
}

// ============================================
// ESTATÍSTICAS
// ============================================

export async function getProductStats() {
  if (usePostgres && sql) {
    // PostgreSQL
    const [stats] = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE show_in_shop = true) as active,
        COUNT(*) FILTER (WHERE stock <= min_stock) as low_stock,
        SUM(stock * price) as total_value
      FROM products
    `;
    return { data: stats, error: null };
  } else {
    // Supabase - Múltiplas queries
    const [total, active, lowStock] = await Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }),
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('show_in_shop', true),
      supabase.from('products').select('stock, min_stock').lte('stock', 'min_stock')
    ]);

    return {
      data: {
        total: total.count || 0,
        active: active.count || 0,
        low_stock: lowStock.data?.length || 0
      },
      error: null
    };
  }
}
