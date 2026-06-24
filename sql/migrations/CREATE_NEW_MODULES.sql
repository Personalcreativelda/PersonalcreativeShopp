-- ══════════════════════════════════════════════════════════════════════════════
-- Novos módulos: RH, Projecto, Helpdesk, Timesheets, Mensagens, Assinaturas, Documentos
-- ══════════════════════════════════════════════════════════════════════════════

-- ── RH ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS departments (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  manager_id  INT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employees (
  id                 SERIAL PRIMARY KEY,
  profile_id         INT REFERENCES profiles(id) ON DELETE SET NULL,
  department_id      INT REFERENCES departments(id) ON DELETE SET NULL,
  full_name          VARCHAR(150) NOT NULL,
  job_title          VARCHAR(100),
  hire_date          DATE,
  contract_type      VARCHAR(30) DEFAULT 'full_time', -- full_time | part_time | intern | contractor
  salary             DECIMAL(12,2) DEFAULT 0,
  phone              VARCHAR(30),
  email              VARCHAR(150),
  nuit               VARCHAR(20),
  emergency_contact  VARCHAR(150),
  status             VARCHAR(20) DEFAULT 'active', -- active | inactive | on_leave
  avatar_url         TEXT,
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contracts (
  id            SERIAL PRIMARY KEY,
  employee_id   INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  type          VARCHAR(30) DEFAULT 'full_time',
  start_date    DATE NOT NULL,
  end_date      DATE,
  salary        DECIMAL(12,2) DEFAULT 0,
  status        VARCHAR(20) DEFAULT 'active', -- active | expired | terminated
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id            SERIAL PRIMARY KEY,
  employee_id   INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  type          VARCHAR(30) DEFAULT 'annual', -- annual | sick | maternity | unpaid | other
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  days          INT NOT NULL DEFAULT 1,
  reason        TEXT,
  status        VARCHAR(20) DEFAULT 'pending', -- pending | approved | rejected
  approved_by   INT REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── PROJECTO ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(150) NOT NULL,
  description  TEXT,
  status       VARCHAR(20) DEFAULT 'active', -- active | on_hold | completed | cancelled
  priority     VARCHAR(20) DEFAULT 'medium', -- low | medium | high | urgent
  start_date   DATE,
  end_date     DATE,
  manager_id   INT REFERENCES profiles(id) ON DELETE SET NULL,
  color        VARCHAR(7) DEFAULT '#635BFF',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id           SERIAL PRIMARY KEY,
  project_id   INT REFERENCES projects(id) ON DELETE CASCADE,
  title        VARCHAR(200) NOT NULL,
  description  TEXT,
  status       VARCHAR(30) DEFAULT 'todo', -- todo | in_progress | review | done
  priority     VARCHAR(20) DEFAULT 'medium',
  assigned_to  INT REFERENCES profiles(id) ON DELETE SET NULL,
  due_date     DATE,
  completed_at TIMESTAMPTZ,
  position     INT DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_comments (
  id          SERIAL PRIMARY KEY,
  task_id     INT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id     INT REFERENCES profiles(id) ON DELETE SET NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── HELPDESK ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ticket_categories (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(80) NOT NULL,
  description TEXT,
  color       VARCHAR(7) DEFAULT '#635BFF'
);

INSERT INTO ticket_categories (name, color) VALUES
  ('Suporte Técnico', '#0a84ff'),
  ('Faturação',       '#ff9f0a'),
  ('Entrega',         '#30d158'),
  ('Produto',         '#ff453a'),
  ('Outro',           '#8e8e93')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS support_tickets (
  id            SERIAL PRIMARY KEY,
  title         VARCHAR(200) NOT NULL,
  description   TEXT,
  status        VARCHAR(20) DEFAULT 'open', -- open | in_progress | waiting | resolved | closed
  priority      VARCHAR(20) DEFAULT 'medium', -- low | medium | high | urgent
  category_id   INT REFERENCES ticket_categories(id) ON DELETE SET NULL,
  customer_id   INT REFERENCES customers(id) ON DELETE SET NULL,
  assigned_to   INT REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id          SERIAL PRIMARY KEY,
  ticket_id   INT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id     INT REFERENCES profiles(id) ON DELETE SET NULL,
  content     TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── TIMESHEETS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS timesheet_entries (
  id           SERIAL PRIMARY KEY,
  employee_id  INT REFERENCES employees(id) ON DELETE CASCADE,
  project_id   INT REFERENCES projects(id) ON DELETE SET NULL,
  task_id      INT REFERENCES tasks(id) ON DELETE SET NULL,
  date         DATE NOT NULL,
  hours        DECIMAL(4,2) NOT NULL DEFAULT 0,
  description  TEXT,
  billable     BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── MENSAGENS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id         SERIAL PRIMARY KEY,
  type       VARCHAR(20) DEFAULT 'direct', -- direct | group
  name       VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id INT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         INT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at       TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id              SERIAL PRIMARY KEY,
  conversation_id INT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       INT REFERENCES profiles(id) ON DELETE SET NULL,
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  read_by         JSONB DEFAULT '[]'
);

-- ── ASSINATURAS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscription_plans (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(100) NOT NULL,
  description    TEXT,
  price          DECIMAL(12,2) NOT NULL DEFAULT 0,
  billing_cycle  VARCHAR(20) DEFAULT 'monthly', -- monthly | quarterly | yearly
  features       JSONB DEFAULT '[]',
  status         VARCHAR(20) DEFAULT 'active', -- active | inactive
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id                SERIAL PRIMARY KEY,
  customer_id       INT REFERENCES customers(id) ON DELETE CASCADE,
  plan_id           INT REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  status            VARCHAR(20) DEFAULT 'active', -- active | paused | cancelled | expired
  start_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date          DATE,
  next_billing_date DATE,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscription_invoices (
  id              SERIAL PRIMARY KEY,
  subscription_id INT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  amount          DECIMAL(12,2) NOT NULL DEFAULT 0,
  status          VARCHAR(20) DEFAULT 'pending', -- pending | paid | overdue | cancelled
  due_date        DATE,
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── DOCUMENTOS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doc_folders (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  parent_id   INT REFERENCES doc_folders(id) ON DELETE CASCADE,
  created_by  INT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
  id          SERIAL PRIMARY KEY,
  folder_id   INT REFERENCES doc_folders(id) ON DELETE SET NULL,
  name        VARCHAR(200) NOT NULL,
  file_url    TEXT NOT NULL,
  file_size   BIGINT DEFAULT 0,
  mime_type   VARCHAR(100),
  created_by  INT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_shares (
  id          SERIAL PRIMARY KEY,
  document_id INT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id     INT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  permission  VARCHAR(20) DEFAULT 'view', -- view | edit
  shared_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (document_id, user_id)
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_employees_dept       ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_status     ON employees(status);
CREATE INDEX IF NOT EXISTS idx_tasks_project        ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned       ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status         ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tickets_status       ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned     ON support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_timesheet_employee   ON timesheet_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_date       ON timesheet_entries(date);
CREATE INDEX IF NOT EXISTS idx_messages_conv        ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_cust   ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_documents_folder     ON documents(folder_id);
