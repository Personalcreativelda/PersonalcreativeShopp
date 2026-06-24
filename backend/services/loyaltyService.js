import pool from '../db.js';

export const TIERS = [
  { name: 'Semente',       min: 0,    max: 99    },
  { name: 'Raiz',          min: 100,  max: 299   },
  { name: 'Broto',         min: 300,  max: 699   },
  { name: 'Flor',          min: 700,  max: 1499  },
  { name: 'Planta Mestre', min: 1500, max: Infinity },
];

export const POINTS_PER_MT = 0.1; // 1 ponto por cada 10 MT

export function getTierForPoints(pts) {
  return TIERS.find(t => pts >= t.min && pts <= t.max) || TIERS[0];
}

/**
 * Awards points for a completed order.
 * Call this when an order status changes to 'completed' or 'delivered'.
 */
export async function awardOrderPoints(orderId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: orders } = await client.query(
      'SELECT * FROM orders WHERE id = $1',
      [orderId]
    );
    if (!orders.length) { await client.query('ROLLBACK'); return null; }
    const order = orders[0];

    // Determine which profile to award points to.
    // Priority: created_by (self-placed shop orders) → profile linked via customer_id
    let profileId = order.created_by || null;

    // If no direct profile link, try to find profile via customer email
    if (!profileId && order.customer_id) {
      const { rows: linked } = await client.query(
        `SELECT p.id FROM profiles p
         JOIN customers c ON LOWER(p.email) = LOWER(c.email)
         WHERE c.id = $1 AND c.email IS NOT NULL LIMIT 1`,
        [order.customer_id]
      );
      if (linked.length) profileId = linked[0].id;
    }

    if (!profileId) { await client.query('ROLLBACK'); return null; }

    // Skip if already rewarded for this order
    const { rows: logs } = await client.query(
      `SELECT id FROM loyalty_log WHERE order_id = $1 AND type = 'earn'`,
      [orderId]
    );
    if (logs.length) { await client.query('ROLLBACK'); return null; }

    const points = Math.floor(Number(order.total_amount || 0) * POINTS_PER_MT);
    if (points <= 0) { await client.query('ROLLBACK'); return null; }

    // Update profile loyalty_points
    await client.query(
      `UPDATE profiles SET loyalty_points = COALESCE(loyalty_points, 0) + $1 WHERE id = $2`,
      [points, profileId]
    );

    // Read updated points and compute new tier
    const { rows: profiles } = await client.query(
      'SELECT loyalty_points FROM profiles WHERE id = $1',
      [profileId]
    );
    const newPoints = Number(profiles[0]?.loyalty_points || 0);
    const tier = getTierForPoints(newPoints);

    await client.query(
      `UPDATE profiles SET loyalty_tier = $1 WHERE id = $2`,
      [tier.name, profileId]
    );

    // Log the transaction
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    await client.query(
      `INSERT INTO loyalty_log (customer_id, order_id, type, points, description, expires_at)
       VALUES ($1, $2, 'earn', $3, $4, $5)`,
      [
        profileId,
        orderId,
        points,
        `Pontos pela encomenda #${order.order_number || orderId.slice(0, 8)}`,
        expiresAt,
      ]
    );

    await client.query('COMMIT');
    return { points, totalPoints: newPoints, tier: tier.name };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Redeems points for a discount. 1 point = 0.10 MT.
 * Returns the discount amount in MT.
 */
export async function redeemPoints(customerId, pointsToRedeem) {
  const RATE = 0.10; // MT per point
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      'SELECT loyalty_points FROM profiles WHERE id = $1 FOR UPDATE',
      [customerId]
    );
    if (!rows.length) throw new Error('Cliente não encontrado');
    const available = Number(rows[0].loyalty_points || 0);
    if (pointsToRedeem > available) throw new Error('Pontos insuficientes');

    const discount = pointsToRedeem * RATE;

    await client.query(
      `UPDATE profiles SET loyalty_points = loyalty_points - $1 WHERE id = $2`,
      [pointsToRedeem, customerId]
    );

    const { rows: updated } = await client.query(
      'SELECT loyalty_points FROM profiles WHERE id = $1',
      [customerId]
    );
    const newPoints = Number(updated[0]?.loyalty_points || 0);
    const tier = getTierForPoints(newPoints);
    await client.query(
      `UPDATE profiles SET loyalty_tier = $1 WHERE id = $2`,
      [tier.name, customerId]
    );

    await client.query(
      `INSERT INTO loyalty_log (customer_id, type, points, description)
       VALUES ($1, 'redeem', $2, $3)`,
      [customerId, -pointsToRedeem, `Desconto de ${discount.toFixed(2)} MT`]
    );

    await client.query('COMMIT');
    return { discount, remaining: newPoints };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Expires points older than 1 year. Run via cron/scheduled job.
 */
export async function expirePoints() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: expired } = await client.query(
      `SELECT id, customer_id, points FROM loyalty_log
       WHERE type = 'earn' AND expires_at <= NOW() AND expired = false`
    );

    let totalExpired = 0;
    for (const row of expired) {
      await client.query(
        `UPDATE profiles SET loyalty_points = GREATEST(0, loyalty_points - $1) WHERE id = $2`,
        [row.points, row.customer_id]
      );
      await client.query(
        `UPDATE loyalty_log SET expired = true WHERE id = $1`,
        [row.id]
      );
      await client.query(
        `INSERT INTO loyalty_log (customer_id, type, points, description)
         VALUES ($1, 'expire', $2, 'Pontos expirados (validade 1 ano)')`,
        [row.customer_id, -row.points]
      );
      totalExpired += row.points;
    }

    await client.query('COMMIT');
    return { expired: expired.length, totalPoints: totalExpired };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Returns full loyalty summary for a customer.
 */
export async function getCustomerLoyalty(customerId) {
  const { rows: profiles } = await pool.query(
    'SELECT loyalty_points, loyalty_tier FROM profiles WHERE id = $1',
    [customerId]
  );
  if (!profiles.length) return null;

  const points = Number(profiles[0].loyalty_points || 0);
  const tier   = getTierForPoints(points);

  const { rows: history } = await pool.query(
    `SELECT type, points, description, created_at, expires_at
     FROM loyalty_log WHERE customer_id = $1
     ORDER BY created_at DESC LIMIT 20`,
    [customerId]
  );

  const nextTier = TIERS.find(t => t.min > points) || null;

  return {
    points,
    tier:     tier.name,
    tierInfo: tier,
    nextTier,
    history,
    redeemRate: 0.10,
  };
}
