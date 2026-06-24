-- ══════════════════════════════════════════════════════════════════════════════
-- Correcção do schema das tabelas de chat interno (Mensagens)
-- Problema: CREATE_NEW_MODULES.sql criou tabelas com INT FKs → profiles.id (UUID)
-- Esta migração remove as tabelas antigas e recria com o schema correcto.
-- Seguro de correr múltiplas vezes.
-- ══════════════════════════════════════════════════════════════════════════════

-- Remover tabelas antigas (schema com FK INT errado ou de versão anterior)
DROP TABLE IF EXISTS message_reads        CASCADE;
DROP TABLE IF EXISTS messages             CASCADE;
DROP TABLE IF EXISTS channel_members      CASCADE;
DROP TABLE IF EXISTS message_channels     CASCADE;

-- Tabela de canais/grupos
CREATE TABLE IF NOT EXISTS message_channels (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100),
  description TEXT,
  type        VARCHAR(20) DEFAULT 'group',
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Membros de cada canal
CREATE TABLE IF NOT EXISTS channel_members (
  channel_id INT  NOT NULL REFERENCES message_channels(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id)          ON DELETE CASCADE,
  joined_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (channel_id, user_id)
);

-- Mensagens
CREATE TABLE IF NOT EXISTS messages (
  id         SERIAL PRIMARY KEY,
  channel_id INT  NOT NULL REFERENCES message_channels(id) ON DELETE CASCADE,
  sender_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  content    TEXT NOT NULL,
  edited_at  TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Registo de leituras (para contagem de não lidas)
CREATE TABLE IF NOT EXISTS message_reads (
  message_id INT  NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id)
);

-- Índice de performance
CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id);

-- Canal Geral por defeito
INSERT INTO message_channels (name, type)
SELECT 'Geral', 'group'
WHERE NOT EXISTS (SELECT 1 FROM message_channels WHERE name = 'Geral');
