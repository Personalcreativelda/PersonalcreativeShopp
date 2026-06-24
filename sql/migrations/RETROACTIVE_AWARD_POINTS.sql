-- Atribui pontos retroativos para todos os pedidos já entregues/concluídos.
-- Usa GREATEST para não reduzir pontos que possam já existir de outras fontes.
-- Corre apenas uma vez.
WITH order_totals AS (
  SELECT
    COALESCE(o.created_by, p.id) AS profile_id,
    SUM(FLOOR(o.total_amount / 10))::integer AS total_pts
  FROM orders o
  LEFT JOIN profiles p ON p.customer_id = o.customer_id
  WHERE o.status IN ('delivered', 'completed')
    AND COALESCE(o.created_by, p.id) IS NOT NULL
  GROUP BY COALESCE(o.created_by, p.id)
)
UPDATE profiles
SET
  points             = GREATEST(profiles.points,              ot.total_pts),
  total_points_earned = GREATEST(profiles.total_points_earned, ot.total_pts)
FROM order_totals ot
WHERE profiles.id = ot.profile_id;
