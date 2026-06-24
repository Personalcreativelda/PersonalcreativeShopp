-- Sistema de Afiliados NaturErva
-- Geração de comissões por referências de clientes

CREATE TABLE IF NOT EXISTS affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  referral_code VARCHAR(20) UNIQUE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','pending')),
  commission_rate DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  total_earned DECIMAL(12,2) NOT NULL DEFAULT 0,
  pending_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  available_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  withdrawn_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_referrals INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS affiliate_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  referred_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referred_profile_id)
);

CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id),
  referred_profile_id UUID REFERENCES profiles(id),
  order_amount DECIMAL(12,2) NOT NULL,
  commission_rate DECIMAL(5,2) NOT NULL,
  commission_amount DECIMAL(12,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','paid')),
  notes TEXT,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS affiliate_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  method VARCHAR(50) NOT NULL DEFAULT 'mpesa',
  account_info TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','paid')),
  admin_notes TEXT,
  processed_by UUID REFERENCES profiles(id),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by_code VARCHAR(20);
