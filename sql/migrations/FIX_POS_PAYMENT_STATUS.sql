-- Corrigir pedidos POS existentes que ficaram com payment_status incorreto
UPDATE orders
SET payment_status = 'paid',
    updated_at     = NOW()
WHERE source = 'pos'
  AND status IN ('completed', 'delivered')
  AND payment_status != 'paid';
