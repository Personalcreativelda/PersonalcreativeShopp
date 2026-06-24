import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// ── Migrate on startup ─────────────────────────────────────────────────────────
async function migrate() {
  const run = async (sql, label) => {
    try { await pool.query(sql); }
    catch (e) { console.error(`[hr] migrate ${label}:`, e.message); }
  };
  await run(`CREATE TABLE IF NOT EXISTS departments (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    description TEXT,
    manager_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
  )`, 'departments');
  await run(`CREATE TABLE IF NOT EXISTS employees (
    id                SERIAL PRIMARY KEY,
    profile_id        UUID REFERENCES profiles(id) ON DELETE SET NULL,
    department_id     INT REFERENCES departments(id) ON DELETE SET NULL,
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
  )`, 'employees');
  await run(`CREATE TABLE IF NOT EXISTS contracts (
    id          SERIAL PRIMARY KEY,
    employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    type        VARCHAR(30) DEFAULT 'full_time',
    start_date  DATE NOT NULL,
    end_date    DATE,
    salary      DECIMAL(12,2) DEFAULT 0,
    status      VARCHAR(20) DEFAULT 'active',
    notes       TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
  )`, 'contracts');
  await run(`CREATE TABLE IF NOT EXISTS leave_requests (
    id          SERIAL PRIMARY KEY,
    employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    type        VARCHAR(30) DEFAULT 'annual',
    start_date  DATE NOT NULL,
    end_date    DATE NOT NULL,
    days        INT NOT NULL DEFAULT 1,
    reason      TEXT,
    status      VARCHAR(20) DEFAULT 'pending',
    approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW()
  )`, 'leave_requests');
  await run(`CREATE TABLE IF NOT EXISTS payroll_periods (
    id          SERIAL PRIMARY KEY,
    period_name VARCHAR(50) NOT NULL,
    start_date  DATE NOT NULL,
    end_date    DATE NOT NULL,
    status      VARCHAR(20) DEFAULT 'draft',
    notes       TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
  )`, 'payroll_periods');
  await run(`CREATE TABLE IF NOT EXISTS payslips (
    id                SERIAL PRIMARY KEY,
    period_id         INT NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
    employee_id       INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    gross_salary      DECIMAL(12,2) DEFAULT 0,
    inss_employee     DECIMAL(12,2) DEFAULT 0,
    inss_employer     DECIMAL(12,2) DEFAULT 0,
    irps              DECIMAL(12,2) DEFAULT 0,
    other_deductions  DECIMAL(12,2) DEFAULT 0,
    other_additions   DECIMAL(12,2) DEFAULT 0,
    net_salary        DECIMAL(12,2) DEFAULT 0,
    status            VARCHAR(20) DEFAULT 'pending',
    notes             TEXT,
    paid_at           TIMESTAMPTZ,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (period_id, employee_id)
  )`, 'payslips');
}
migrate();

// ── DEPARTMENTS ───────────────────────────────────────────────────────────────
router.get('/departments', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT d.*, p.name AS manager_name,
             COUNT(e.id)::int AS employee_count
      FROM departments d
      LEFT JOIN profiles p ON p.id = d.manager_id
      LEFT JOIN employees e ON e.department_id = d.id AND e.status = 'active'
      GROUP BY d.id, p.name
      ORDER BY d.name
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/departments', authMiddleware, async (req, res) => {
  const { name, description, manager_id } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO departments (name, description, manager_id) VALUES ($1,$2,$3) RETURNING *`,
      [name, description || null, manager_id || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/departments/:id', authMiddleware, async (req, res) => {
  const { name, description, manager_id } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE departments SET name=$1, description=$2, manager_id=$3 WHERE id=$4 RETURNING *`,
      [name, description || null, manager_id || null, req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/departments/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query(`DELETE FROM departments WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── EMPLOYEES ─────────────────────────────────────────────────────────────────
router.get('/employees', authMiddleware, async (req, res) => {
  const { status, department_id, q } = req.query;
  const filters = []; const params = [];
  if (status)        { params.push(status);        filters.push(`e.status = $${params.length}`); }
  if (department_id) { params.push(department_id); filters.push(`e.department_id = $${params.length}`); }
  if (q)             { params.push(`%${q}%`);      filters.push(`(e.full_name ILIKE $${params.length} OR e.email ILIKE $${params.length})`); }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  try {
    const { rows } = await pool.query(`
      SELECT e.*, d.name AS department_name
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      ${where}
      ORDER BY e.full_name
    `, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/employees/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT e.*, d.name AS department_name
      FROM employees e LEFT JOIN departments d ON d.id = e.department_id
      WHERE e.id = $1
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    const contracts = await pool.query(`SELECT * FROM contracts WHERE employee_id=$1 ORDER BY start_date DESC`, [req.params.id]);
    const leaves    = await pool.query(`SELECT * FROM leave_requests WHERE employee_id=$1 ORDER BY created_at DESC LIMIT 20`, [req.params.id]);
    res.json({ ...rows[0], contracts: contracts.rows, leaves: leaves.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/employees', authMiddleware, async (req, res) => {
  const { full_name, job_title, department_id, hire_date, contract_type, salary,
          phone, email, nuit, emergency_contact, notes, avatar_url, profile_id } = req.body;
  try {
    const { rows } = await pool.query(`
      INSERT INTO employees
        (full_name, job_title, department_id, hire_date, contract_type, salary,
         phone, email, nuit, emergency_contact, notes, avatar_url, profile_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *
    `, [full_name, job_title, department_id||null, hire_date||null, contract_type||'full_time',
        salary||0, phone||null, email||null, nuit||null, emergency_contact||null,
        notes||null, avatar_url||null, profile_id||null]);
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/employees/:id', authMiddleware, async (req, res) => {
  const { full_name, job_title, department_id, hire_date, contract_type, salary,
          phone, email, nuit, emergency_contact, notes, avatar_url, status } = req.body;
  try {
    const { rows } = await pool.query(`
      UPDATE employees SET
        full_name=$1, job_title=$2, department_id=$3, hire_date=$4, contract_type=$5,
        salary=$6, phone=$7, email=$8, nuit=$9, emergency_contact=$10, notes=$11,
        avatar_url=$12, status=$13, updated_at=NOW()
      WHERE id=$14 RETURNING *
    `, [full_name, job_title, department_id||null, hire_date||null, contract_type||'full_time',
        salary||0, phone||null, email||null, nuit||null, emergency_contact||null,
        notes||null, avatar_url||null, status||'active', req.params.id]);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/employees/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query(`DELETE FROM employees WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── CONTRACTS ─────────────────────────────────────────────────────────────────
router.post('/contracts', authMiddleware, async (req, res) => {
  const { employee_id, type, start_date, end_date, salary, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO contracts (employee_id,type,start_date,end_date,salary,notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [employee_id, type||'full_time', start_date, end_date||null, salary||0, notes||null]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/contracts/:id', authMiddleware, async (req, res) => {
  const { type, start_date, end_date, salary, notes, status } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE contracts SET type=$1,start_date=$2,end_date=$3,salary=$4,notes=$5,status=$6 WHERE id=$7 RETURNING *`,
      [type, start_date, end_date||null, salary||0, notes||null, status||'active', req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── LEAVE REQUESTS ────────────────────────────────────────────────────────────
router.get('/leaves', authMiddleware, async (req, res) => {
  const { status, employee_id } = req.query;
  const filters = []; const params = [];
  if (status)      { params.push(status);      filters.push(`l.status = $${params.length}`); }
  if (employee_id) { params.push(employee_id); filters.push(`l.employee_id = $${params.length}`); }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  try {
    const { rows } = await pool.query(`
      SELECT l.*, e.full_name AS employee_name
      FROM leave_requests l
      LEFT JOIN employees e ON e.id = l.employee_id
      ${where} ORDER BY l.created_at DESC
    `, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/leaves', authMiddleware, async (req, res) => {
  const { employee_id, type, start_date, end_date, days, reason } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO leave_requests (employee_id,type,start_date,end_date,days,reason) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [employee_id, type||'annual', start_date, end_date, days||1, reason||null]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/leaves/:id/status', authMiddleware, async (req, res) => {
  const { status } = req.body;
  const approved_by = status === 'approved' ? (req.user?.id || null) : null;
  const approved_at = status === 'approved' ? new Date() : null;
  try {
    const { rows } = await pool.query(
      `UPDATE leave_requests SET status=$1, approved_at=$2, approved_by=$3 WHERE id=$4 RETURNING *`,
      [status, approved_at, approved_by, req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── STATS ─────────────────────────────────────────────────────────────────────
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const [total, active, onLeave, depts, pendingLeaves] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS n FROM employees`),
      pool.query(`SELECT COUNT(*)::int AS n FROM employees WHERE status='active'`),
      pool.query(`SELECT COUNT(*)::int AS n FROM employees WHERE status='on_leave'`),
      pool.query(`SELECT COUNT(*)::int AS n FROM departments`),
      pool.query(`SELECT COUNT(*)::int AS n FROM leave_requests WHERE status='pending'`),
    ]);
    res.json({
      total: total.rows[0].n, active: active.rows[0].n,
      on_leave: onLeave.rows[0].n, departments: depts.rows[0].n,
      pending_leaves: pendingLeaves.rows[0].n,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PAYROLL PERIODS ───────────────────────────────────────────────────────────
router.get('/payroll', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT pp.*,
             COUNT(ps.id)::int AS slip_count,
             COALESCE(SUM(ps.gross_salary), 0) AS total_gross,
             COALESCE(SUM(ps.net_salary), 0)   AS total_net
      FROM payroll_periods pp
      LEFT JOIN payslips ps ON ps.period_id = pp.id
      GROUP BY pp.id
      ORDER BY pp.start_date DESC
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/payroll', authMiddleware, async (req, res) => {
  const { period_name, start_date, end_date, notes } = req.body;
  try {
    const { rows } = await pool.query(`
      INSERT INTO payroll_periods (period_name, start_date, end_date, notes)
      VALUES ($1,$2,$3,$4) RETURNING *
    `, [period_name, start_date, end_date, notes||null]);
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Calcular IRPS Moçambique (tabela progressiva simplificada) ────────────────
function calcIRPS(taxableIncome) {
  // Valores em MZN — tabela IRPS 2024 (annual → monthly divide by 12)
  const annual = taxableIncome * 12;
  let irpsAnnual = 0;
  if (annual <= 42000)       irpsAnnual = 0;
  else if (annual <= 168000) irpsAnnual = (annual - 42000) * 0.10;
  else if (annual <= 504000) irpsAnnual = 12600 + (annual - 168000) * 0.15;
  else if (annual <= 1512000) irpsAnnual = 63000 + (annual - 504000) * 0.20;
  else if (annual <= 3024000) irpsAnnual = 264600 + (annual - 1512000) * 0.25;
  else                        irpsAnnual = 642600 + (annual - 3024000) * 0.32;
  return Math.round(irpsAnnual / 12 * 100) / 100;
}

// Processar: gerar payslips para todos os funcionários activos
router.post('/payroll/:id/process', authMiddleware, async (req, res) => {
  try {
    const period = await pool.query(`SELECT * FROM payroll_periods WHERE id=$1`, [req.params.id]);
    if (!period.rows.length) return res.status(404).json({ error: 'Período não encontrado' });
    if (period.rows[0].status === 'closed') return res.status(400).json({ error: 'Período já fechado' });

    const emps = await pool.query(`SELECT * FROM employees WHERE status='active'`);
    const slips = [];
    for (const emp of emps.rows) {
      const gross = parseFloat(emp.salary) || 0;
      const inssEmp  = Math.round(gross * 0.03 * 100) / 100;   // INSS funcionário 3%
      const inssEmpr = Math.round(gross * 0.04 * 100) / 100;   // INSS entidade 4%
      const taxable  = gross - inssEmp;
      const irps     = calcIRPS(taxable);
      const net      = Math.round((gross - inssEmp - irps) * 100) / 100;

      await pool.query(`
        INSERT INTO payslips (period_id, employee_id, gross_salary, inss_employee, inss_employer, irps, net_salary)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (period_id, employee_id) DO UPDATE
          SET gross_salary=$3, inss_employee=$4, inss_employer=$5, irps=$6, net_salary=$7, updated_at=NOW()
        RETURNING *
      `, [req.params.id, emp.id, gross, inssEmp, inssEmpr, irps, net]);
      slips.push({ employee: emp.full_name, gross, inssEmp, irps, net });
    }
    await pool.query(`UPDATE payroll_periods SET status='processing', updated_at=NOW() WHERE id=$1`, [req.params.id]);
    res.json({ processed: slips.length, slips });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Obter payslips de um período
router.get('/payroll/:id/payslips', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT ps.*, e.full_name, e.job_title, e.nuit,
             d.name AS department_name
      FROM payslips ps
      JOIN employees e ON e.id = ps.employee_id
      LEFT JOIN departments d ON d.id = e.department_id
      WHERE ps.period_id = $1
      ORDER BY e.full_name
    `, [req.params.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Ajuste manual de um payslip
router.put('/payroll/payslips/:slipId', authMiddleware, async (req, res) => {
  const { gross_salary, inss_employee, inss_employer, irps, other_deductions, other_additions, notes } = req.body;
  try {
    const gross  = parseFloat(gross_salary) || 0;
    const inssE  = parseFloat(inss_employee) || 0;
    const irpsV  = parseFloat(irps) || 0;
    const dedOth = parseFloat(other_deductions) || 0;
    const addOth = parseFloat(other_additions) || 0;
    const net    = Math.round((gross - inssE - irpsV - dedOth + addOth) * 100) / 100;
    const { rows } = await pool.query(`
      UPDATE payslips SET
        gross_salary=$1, inss_employee=$2, inss_employer=$3, irps=$4,
        other_deductions=$5, other_additions=$6, net_salary=$7, notes=$8, updated_at=NOW()
      WHERE id=$9 RETURNING *
    `, [gross, inssE, parseFloat(inss_employer)||0, irpsV, dedOth, addOth, net, notes||null, req.params.slipId]);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Marcar payslip como pago
router.put('/payroll/payslips/:slipId/pay', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE payslips SET status='paid', paid_at=NOW(), updated_at=NOW() WHERE id=$1 RETURNING *`,
      [req.params.slipId]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Fechar período
router.put('/payroll/:id/close', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE payroll_periods SET status='closed', updated_at=NOW() WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
