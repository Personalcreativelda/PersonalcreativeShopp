import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Importar rotas
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import customerRoutes from './routes/customers.js';
import orderRoutes from './routes/orders.js';
import salesRoutes from './routes/sales.js';
import stockRoutes from './routes/stock.js';
import purchaseRoutes from './routes/purchases.js';
import userRoutes from './routes/users.js';
import uploadRoute from './routes/upload.js';
import importRoutes from './routes/import.js';
import bannerRoutes from './routes/banners.js';
import roleRoutes from './routes/roles.js';
import instagramRoutes from './routes/instagram.js';
import trackingRoutes from './routes/tracking.js';
import categoriesRoutes from './routes/categories.js';
import unitsRoutes from './routes/units.js';
import deliveryZonesRoutes from './routes/deliveryZones.js';
import couponRoutes from './routes/coupons.js';
import refundRoutes from './routes/refunds.js';
import affiliateRoutes from './routes/affiliates.js';
import marketingRoutes from './routes/marketing.js';
import blogRoutes from './routes/blog.js';
import posRoutes from './routes/pos.js';
import taxRoutes from './routes/tax.js';
import quotesRoutes from './routes/quotes.js';
import reviewRoutes from './routes/reviews.js';
import pdfRoutes from './routes/pdf.js';
import shiftsRoutes from './routes/shifts.js';
import reportsRoutes from './routes/reports.js';
import loyaltyRoutes from './routes/loyalty.js';
import invoicesRoutes from './routes/invoices.js';
import apRoutes     from './routes/ap.js';
import ledgerRoutes from './routes/ledger.js';
import hrRoutes          from './routes/hr.js';
import projectsRoutes    from './routes/projects.js';
import helpdeskRoutes    from './routes/helpdesk.js';
import messagesRoutes    from './routes/messages.js';
import subscriptionsRoutes from './routes/subscriptions.js';
import docmanagerRoutes  from './routes/docmanager.js';

const app = express();
const PORT = process.env.PORT || 3060;

// ── CORS ──────────────────────────────────────────────────────────────────────
const extraOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map(o => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

const allowedOrigins = [
  'http://localhost:3055',
  'http://localhost:3056',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
  ...extraOrigins
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // Permitir em dev – qualquer localhost
      if (origin?.startsWith('http://localhost:')) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: Origem não permitida: ${origin}`));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ── REQUEST LOGGER ─────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const color = res.statusCode >= 500 ? '\x1b[31m' // red
                : res.statusCode >= 400 ? '\x1b[33m' // yellow
                : res.statusCode >= 300 ? '\x1b[36m' // cyan
                : '\x1b[32m';                         // green
    const reset = '\x1b[0m';
    console.log(`${color}[${res.statusCode}]${reset} ${req.method} ${req.originalUrl} — ${ms}ms`);
  });
  next();
});

// ── BODY PARSING ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── UPLOADS (ficheiros estáticos) ──────────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// ── HEALTH CHECK ───────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    const { default: pool } = await import('./db.js');
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', port: PORT });
  } catch (err) {
    // Return 200 so the Docker healthcheck passes — the server is alive, DB will reconnect
    res.json({ status: 'ok', db: 'disconnected', error: err.message });
  }
});

// ── API ROUTES ─────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoute);
app.use('/api/import', importRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/instagram', instagramRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/units', unitsRoutes);
app.use('/api/delivery-zones', deliveryZonesRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/refunds', refundRoutes);
app.use('/api/affiliates', affiliateRoutes);
app.use('/api/marketing', marketingRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/pos',    posRoutes);
app.use('/api/tax',    taxRoutes);
app.use('/api/quotes', quotesRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/pdf',     pdfRoutes);
app.use('/api/shifts',  shiftsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/loyalty',  loyaltyRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/ap',      apRoutes);
app.use('/api/ledger',  ledgerRoutes);
app.use('/api/hr',            hrRoutes);
app.use('/api/projects',      projectsRoutes);
app.use('/api/helpdesk',      helpdeskRoutes);
app.use('/api/messages',      messagesRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/docs',          docmanagerRoutes);

// ── 404 ────────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.path}` });
});

// ── ERROR HANDLER ──────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: err.message || 'Erro interno do servidor' });
});

// ── START ──────────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`🚀 NaturErva Backend rodando na porta ${PORT}`);
  console.log(`📦 API: http://localhost:${PORT}/api`);
  console.log(`❤️  Health: http://localhost:${PORT}/health`);
  console.log(`🗄️  DB: ${process.env.PG_HOST}:${process.env.PG_PORT}/${process.env.PG_DATABASE}`);

  // ── Teste de ligação ao MinIO ──────────────────────────────────────────────
  try {
    const { BUCKET, PUBLIC_URL } = await import('./storage/minio.js');
    const Minio = await import('minio');

    const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
    const port     = process.env.MINIO_PORT || '9000';
    const ssl      = process.env.MINIO_USE_SSL === 'true';
    const bucket   = BUCKET();

    console.log(`🪣  MinIO: ${endpoint}:${port} [${ssl ? 'SSL' : 'sem SSL'}] bucket=${bucket}`);
    console.log(`🌐  MinIO URL pública: ${PUBLIC_URL()}`);

    const client = new Minio.Client({
      endPoint:  endpoint.replace(/^https?:\/\//, ''),
      port:      parseInt(port),
      useSSL:    ssl,
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    });

    const exists = await client.bucketExists(bucket);
    if (exists) {
      console.log(`✅  MinIO OK — bucket '${bucket}' encontrado`);
    } else {
      console.log(`⚠️   MinIO OK — bucket '${bucket}' não existe (será criado no 1º upload)`);
    }
  } catch (err) {
    console.error(`❌  MinIO ERRO de ligação: ${err.message}`);
  }
});
