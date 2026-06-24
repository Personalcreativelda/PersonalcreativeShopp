import pool from './db.js';
import bcrypt from 'bcryptjs';

async function migrate() {
  console.log('Iniciando migração de autenticação...');

  // 1. Adicionar colunas necessárias na tabela profiles
  try {
    await pool.query('ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)');
    console.log('Coluna password_hash verificada/adicionada.');
  } catch (err) {
    console.log('Aviso (password_hash):', err.message);
  }

  try {
    await pool.query('ALTER TABLE profiles ADD COLUMN IF NOT EXISTS requires_strong_password BOOLEAN DEFAULT false');
    console.log('Coluna requires_strong_password verificada/adicionada.');
  } catch (err) {
    console.log('Aviso (requires_strong_password):', err.message);
  }

  // 2. Definir uma password padrão para o utilizador atual para que ele consiga entrar
  try {
    // Definir "naturerva2025" como senha provisória
    const defaultPassword = 'naturerva2025';
    const hash = await bcrypt.hash(defaultPassword, 12);
    
    // Atualizar o utilizador específico (ou todos se preferir, mas vamos focar neste)
    const result = await pool.query(
      'UPDATE profiles SET password_hash = $1 WHERE email = $2',
      [hash, 'denylsondanial@gmail.com']
    );
    console.log(`Password atualizada para ${result.rowCount} utilizador(es). Senha provisória: ${defaultPassword}`);
  } catch (err) {
    console.error('Erro ao definir senha:', err.message);
  }

  process.exit(0);
}

migrate();
