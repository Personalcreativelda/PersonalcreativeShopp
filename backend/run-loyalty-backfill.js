// Backfill: award loyalty points for all past completed/delivered orders
// Uses a single connection for all operations to avoid VPS connection drops
import pool from './db.js';
import { getTierForPoints, POINTS_PER_MT } from './services/loyaltyService.js';

const client = await pool.connect();
try {
  // Find pending orders
  const { rows: orders } = await client.query(`
    SELECT o.id, o.order_number, o.customer_id, o.created_by, o.total_amount, o.status
    FROM orders o
    WHERE o.status IN ('completed','delivered')
      AND NOT EXISTS (
        SELECT 1 FROM loyalty_log l WHERE l.order_id = o.id AND l.type = 'earn'
      )
    ORDER BY o.created_at ASC
  `);

  console.log(`Found ${orders.length} orders to backfill`);

  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  let success = 0, skipped = 0;

  for (const order of orders) {
    // Resolve profile: created_by first, then email match via customer
    let profileId = order.created_by;

    if (!profileId && order.customer_id) {
      const { rows: linked } = await client.query(
        `SELECT p.id FROM profiles p
         JOIN customers c ON LOWER(p.email) = LOWER(c.email)
         WHERE c.id = $1 AND c.email IS NOT NULL LIMIT 1`,
        [order.customer_id]
      );
      if (linked.length) profileId = linked[0].id;
    }

    if (!profileId) {
      console.log(`⏭  Order #${order.order_number}: no profile linked — skipped`);
      skipped++; continue;
    }

    // Verify profile exists
    const { rows: prof } = await client.query(
      'SELECT id, loyalty_points FROM profiles WHERE id = $1', [profileId]
    );
    if (!prof.length) {
      console.log(`⏭  Order #${order.order_number}: profile not found — skipped`);
      skipped++; continue;
    }

    const points = Math.floor(Number(order.total_amount || 0) * POINTS_PER_MT);
    if (points <= 0) {
      console.log(`⏭  Order #${order.order_number}: 0 points (total=${order.total_amount}) — skipped`);
      skipped++; continue;
    }

    const currentPoints = Number(prof[0].loyalty_points || 0);
    const newPoints = currentPoints + points;
    const tier = getTierForPoints(newPoints);

    await client.query(
      `UPDATE profiles SET loyalty_points = $1, loyalty_tier = $2 WHERE id = $3`,
      [newPoints, tier.name, profileId]
    );

    await client.query(
      `INSERT INTO loyalty_log (customer_id, order_id, type, points, description, expires_at)
       VALUES ($1, $2, 'earn', $3, $4, $5)`,
      [profileId, order.id, points,
       `Pontos pela encomenda #${order.order_number}`, expiresAt]
    );

    console.log(`✅ Order #${order.order_number}: +${points} pts → total ${newPoints} pts (${tier.name})`);
    success++;
  }

  console.log(`\nBackfill complete: ${success} awarded, ${skipped} skipped`);

  // Final state
  const { rows: profiles } = await client.query(`
    SELECT name, loyalty_points, loyalty_tier FROM profiles
    WHERE loyalty_points > 0 ORDER BY loyalty_points DESC
  `);
  if (profiles.length) {
    console.log('\nCustomers with points:');
    profiles.forEach(p => console.log(`  ${p.name}: ${p.loyalty_points} pts (${p.loyalty_tier})`));
  }

} catch (err) {
  console.error('❌ Backfill error:', err.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
