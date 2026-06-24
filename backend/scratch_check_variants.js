import pool from './db.js';

async function check() {
  try {
    const { rows: products } = await pool.query("SELECT id, name, image, image_url2, image_url3, image_url4 FROM products WHERE name = 'teste'");
    console.log('Product Data:', products[0]);
    if (products.length > 0) {
      const { rows: variants } = await pool.query("SELECT * FROM product_variants WHERE product_id = $1", [products[0].id]);
      console.log('Variants:', variants);
    }
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

check();
