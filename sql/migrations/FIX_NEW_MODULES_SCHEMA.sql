-- ══════════════════════════════════════════════════════════════════════════════
-- Correcção completa do schema dos novos módulos
-- Problema: CREATE_NEW_MODULES.sql usou INT FKs para profiles.id (UUID)
--           e nomes de tabelas diferentes do backend actual
-- Seguro de correr múltiplas vezes (IF NOT EXISTS / IF EXISTS)
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── 1. REMOVER TABELAS ANTIGAS COM SCHEMA ERRADO ─────────────────────────────
-- Estas tabelas foram criadas pelo CREATE_NEW_MODULES.sql com FKs INT erradas
-- ou nomes que conflituam com o backend. São novas e não têm dados.

DROP TABLE IF EXISTS message_reads        CASCADE;
DROP TABLE IF EXISTS messages             CASCADE;
DROP TABLE IF EXISTS conversation_members CASCADE;
DROP TABLE IF EXISTS conversations        CASCADE;
DROP TABLE IF EXISTS channel_members      CASCADE;
DROP TABLE IF EXISTS message_channels     CASCADE;

DROP TABLE IF EXISTS ticket_messages      CASCADE;
DROP TABLE IF EXISTS support_tickets      CASCADE;
DROP TABLE IF EXISTS ticket_categories    CASCADE;
DROP TABLE IF EXISTS helpdesk_tickets     CASCADE;
DROP TABLE IF EXISTS helpdesk_categories  CASCADE;

DROP TABLE IF EXISTS timesheet_entries    CASCADE;
DROP TABLE IF EXISTS task_comments        CASCADE;
DROP TABLE IF EXISTS tasks                CASCADE;
DROP TABLE IF EXISTS projects             CASCADE;

DROP TABLE IF EXISTS leave_requests       CASCADE;
DROP TABLE IF EXISTS contracts            CASCADE;
DROP TABLE IF EXISTS employees            CASCADE;
DROP TABLE IF EXISTS departments          CASCADE;

DROP TABLE IF EXISTS document_shares      CASCADE;
DROP TABLE IF EXISTS document_access      CASCADE;
DROP TABLE IF EXISTS document_versions    CASCADE;
DROP TABLE IF EXISTS documents            CASCADE;
DROP TABLE IF EXISTS doc_folders          CASCADE;

DROP TABLE IF EXISTS subscription_invoices CASCADE;
DROP TABLE IF EXISTS subscription_payments CASCADE;
DROP TABLE IF EXISTS subscriptions         CASCADE;
DROP TABLE IF EXISTS subscription_plans    CASCADE;

DROP TABLE IF EXISTS payslips              CASCADE;
DROP TABLE IF EXISTS payroll_periods       CASCADE;

-- ─── 2. MENSAGENS (message_channels / channel_members / messages) ─────────────

CREATE TABLE IF NOT EXISTS message_channels (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100),
  description TEXT,
  type        VARCHAR(20) DEFAULT 'group',
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS channel_members (
  channel_id INT  NOT NULL REFERENCES message_channels(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id)          ON DELETE CASCADE,
  joined_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id         SERIAL PRIMARY KEY,
  channel_id INT  NOT NULL REFERENCES message_channels(id) ON DELETE CASCADE,
  sender_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  content    TEXT NOT NULL,
  edited_at  TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS message_reads (
  message_id INT  NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id)
);

-- Canal Geral padrão
INSERT INTO message_channels (name, type)
SELECT 'Geral', 'group'
WHERE NOT EXISTS (SELECT 1 FROM message_channels WHERE name = 'Geral');

-- ─── 3. RH (departments / employees / contracts / leave_requests) ─────────────

CREATE TABLE IF NOT EXISTS departments (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  manager_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employees (
  id                SERIAL PRIMARY KEY,
  profile_id        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  department_id     INT  REFERENCES departments(id) ON DELETE SET NULL,
  full_name         VARCHAR(150) NOT NULL,
  job_title         VARCHAR(100),
  hire_date         DATE,
  contract_type     VARCHAR(30) DEFAULT 'full_time',
  salary            DECIMAL(12,2) DEFAULT 0,
  phone             VARCHAR(30),
  email             VARCHAR(150),
  nuit              VARCHAR(20),
  emergency_contact VARCHAR(150),
  status            VARCHAR(20) DEFAULT 'active',
  avatar_url        TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contracts (
  id          SERIAL PRIMARY KEY,
  employee_id INT  NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  type        VARCHAR(30) DEFAULT 'full_time',
  start_date  DATE NOT NULL,
  end_date    DATE,
  salary      DECIMAL(12,2) DEFAULT 0,
  status      VARCHAR(20) DEFAULT 'active',
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id          SERIAL PRIMARY KEY,
  employee_id INT  NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  type        VARCHAR(30) DEFAULT 'annual',
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  days        INT  NOT NULL DEFAULT 1,
  reason      TEXT,
  status      VARCHAR(20) DEFAULT 'pending',
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Tabelas de folha de salários
CREATE TABLE IF NOT EXISTS payroll_periods (
  id          SERIAL PRIMARY KEY,
  period_name VARCHAR(50)  NOT NULL,
  start_date  DATE         NOT NULL,
  end_date    DATE         NOT NULL,
  status      VARCHAR(20)  DEFAULT 'draft',
  notes       TEXT,
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payslips (
  id               SERIAL PRIMARY KEY,
  period_id        INT          NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  employee_id      INT          NOT NULL REFERENCES employees(id)       ON DELETE CASCADE,
  gross_salary     DECIMAL(12,2) DEFAULT 0,
  inss_employee    DECIMAL(12,2) DEFAULT 0,
  inss_employer    DECIMAL(12,2) DEFAULT 0,
  irps             DECIMAL(12,2) DEFAULT 0,
  other_deductions DECIMAL(12,2) DEFAULT 0,
  other_additions  DECIMAL(12,2) DEFAULT 0,
  net_salary       DECIMAL(12,2) DEFAULT 0,
  status           VARCHAR(20)  DEFAULT 'pending',
  paid_at          TIMESTAMPTZ,
  notes            TEXT,
  created_at       TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE (period_id, employee_id)
);

-- ─── 4. PROJECTOS ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS projects (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  description TEXT,
  status      VARCHAR(20)  DEFAULT 'active',
  priority    VARCHAR(20)  DEFAULT 'medium',
  start_date  DATE,
  end_date    DATE,
  manager_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  color       VARCHAR(7)   DEFAULT '#635BFF',
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id           SERIAL PRIMARY KEY,
  project_id   INT  REFERENCES projects(id) ON DELETE CASCADE,
  title        VARCHAR(200) NOT NULL,
  description  TEXT,
  status       VARCHAR(30)  DEFAULT 'todo',
  priority     VARCHAR(20)  DEFAULT 'medium',
  assigned_to  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  due_date     DATE,
  completed_at TIMESTAMPTZ,
  position     INT          DEFAULT 0,
  created_at   TIMESTAMPTZ  DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_comments (
  id         SERIAL PRIMARY KEY,
  task_id    INT  NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- employee_id sem FK para evitar dependência circular com employees
CREATE TABLE IF NOT EXISTS timesheet_entries (
  id          SERIAL PRIMARY KEY,
  employee_id INT,
  project_id  INT REFERENCES projects(id) ON DELETE SET NULL,
  task_id     INT REFERENCES tasks(id)    ON DELETE SET NULL,
  date        DATE         NOT NULL,
  hours       DECIMAL(4,2) NOT NULL DEFAULT 0,
  description TEXT,
  billable    BOOLEAN      DEFAULT false,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- ─── 5. HELPDESK ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS helpdesk_categories (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(50) NOT NULL UNIQUE,
  color      VARCHAR(20) DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO helpdesk_categories (name, color) VALUES
  ('Geral',     '#6366f1'),
  ('Faturação', '#f59e0b'),
  ('Técnico',   '#ef4444'),
  ('Envio',     '#10b981'),
  ('Outro',     '#8b5cf6')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS helpdesk_tickets (
  id          SERIAL PRIMARY KEY,
  subject     VARCHAR(200) NOT NULL,
  description TEXT,
  status      VARCHAR(20)  DEFAULT 'open',
  priority    VARCHAR(20)  DEFAULT 'medium',
  category    VARCHAR(50)  DEFAULT 'general',
  category_id INT          REFERENCES helpdesk_categories(id) ON DELETE SET NULL,
  customer_id UUID         REFERENCES customers(id)            ON DELETE SET NULL,
  assigned_to UUID         REFERENCES profiles(id)             ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id          SERIAL PRIMARY KEY,
  ticket_id   INT  NOT NULL REFERENCES helpdesk_tickets(id) ON DELETE CASCADE,
  user_id     UUID          REFERENCES profiles(id)          ON DELETE SET NULL,
  content     TEXT NOT NULL,
  is_staff    BOOLEAN DEFAULT false,
  is_internal BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 6. ASSINATURAS ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subscription_plans (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  description   TEXT,
  price         DECIMAL(10,2) DEFAULT 0,
  billing_cycle VARCHAR(20)   DEFAULT 'monthly',
  features      JSONB         DEFAULT '[]',
  is_active     BOOLEAN       DEFAULT true,
  created_at    TIMESTAMPTZ   DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id           SERIAL PRIMARY KEY,
  customer_id  UUID REFERENCES customers(id)          ON DELETE CASCADE,
  plan_id      INT  REFERENCES subscription_plans(id) ON DELETE SET NULL,
  status       VARCHAR(20)   DEFAULT 'active',
  start_date   DATE          NOT NULL,
  end_date     DATE,
  next_billing DATE,
  amount       DECIMAL(10,2) DEFAULT 0,
  auto_renew   BOOLEAN       DEFAULT true,
  notes        TEXT,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  created_at   TIMESTAMPTZ   DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscription_payments (
  id              SERIAL PRIMARY KEY,
  subscription_id INT          NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  amount          DECIMAL(10,2) NOT NULL,
  status          VARCHAR(20)   DEFAULT 'pending',
  payment_date    DATE,
  method          VARCHAR(50),
  reference       VARCHAR(100),
  notes           TEXT,
  created_at      TIMESTAMPTZ   DEFAULT NOW()
);

-- ─── 7. DOCUMENTOS ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS doc_folders (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  parent_id   INT  REFERENCES doc_folders(id) ON DELETE CASCADE,
  created_by  UUID REFERENCES profiles(id)    ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  description TEXT,
  folder_id   INT  REFERENCES doc_folders(id) ON DELETE SET NULL,
  file_url    TEXT,
  file_size   INT          DEFAULT 0,
  mime_type   VARCHAR(100),
  version     INT          DEFAULT 1,
  tags        TEXT[],
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_versions (
  id          SERIAL PRIMARY KEY,
  document_id INT  NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version     INT  NOT NULL,
  file_url    TEXT,
  file_size   INT  DEFAULT 0,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_access (
  document_id INT  NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id)   ON DELETE CASCADE,
  permission  VARCHAR(20) DEFAULT 'view',
  granted_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (document_id, user_id)
);

-- ─── 8. ÍNDICES DE PERFORMANCE ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_employees_dept        ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_status      ON employees(status);
CREATE INDEX IF NOT EXISTS idx_tasks_project         ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status          ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_timesheet_date        ON timesheet_entries(date);
CREATE INDEX IF NOT EXISTS idx_helpdesk_status       ON helpdesk_tickets(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status  ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_messages_channel      ON messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_documents_folder      ON documents(folder_id);
