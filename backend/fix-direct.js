import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  host: process.env.PG_HOST,
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  ssl: false
});

// Hashes pré-computados localmente (bcrypt 10 rounds)
// @Palmira08  → hash para conta ekson.cuamba05@gmail.com
// @Palmira008 → hash para conta ultraprinter.geral@gmail.com
const fixes = [
  {
    id: '7a1768e9-789b-4ec9-a2f0-d914b3662f4a',
    realEmail: 'ekson.cuamba05@gmail.com',
    name: 'Ekson Cuamba',
    hash: '$2b$10$SzN7gBgjtuBFK/L1g7Uf3eWmvN6GYgaARsC.sOV67Lz.AADExaV6.',
    oldEmail: '@Palmira08'
  },
  {
    id: '50f95a34-2c45-46a9-8208-011ed8b3a3a0',
    realEmail: 'ultraprinter.geral@gmail.com',
    name: 'Ultraprinter Geral',
    hash: '$2b$10$CWeoUCWkQTWsczLAK7aFt.y0yLHSMdAsORfWJ96I.8s.M1QG/v85i',
    oldEmail: '@Palmira008'
  }
];

for (const f of fixes) {
  await pool.query(
    'UPDATE profiles SET email=$1, name=$2, password_hash=$3, updated_at=NOW() WHERE id=$4',
    [f.realEmail, f.name, f.hash, f.id]
  );
  console.log(`✅ ${f.name} → profiles corrigido (${f.realEmail})`);

  const { rows: cust } = await pool.query(
    'SELECT id FROM customers WHERE email=$1 LIMIT 1',
    [f.oldEmail]
  );
  if (cust.length) {
    await pool.query(
      'UPDATE customers SET name=$1, email=$2, updated_at=NOW() WHERE id=$3',
      [f.name, f.realEmail, cust[0].id]
    );
    console.log(`   ✅ customers corrigido`);
  }
}

// Verificação final
const { rows: bad } = await pool.query(
  "SELECT id, name, email FROM profiles WHERE name LIKE '%@%' AND name LIKE '%.%' AND email NOT LIKE '%@%.%' AND email NOT LIKE 'dup_%'"
);
console.log('\n📊 Verificação final — contas ainda corrompidas:', bad.length);

const { rows: ok } = await pool.query(
  'SELECT name, email, is_active FROM profiles WHERE id = ANY($1::uuid[])',
  [fixes.map(f => f.id)]
);
console.log('Contas corrigidas:');
ok.forEach(r => console.log(`  Nome: ${r.name} | Email: ${r.email} | Activo: ${r.is_active}`));

await pool.end();
