const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'mini-garagem-secret-2024';
const DB_PATH = path.join(__dirname, 'data', 'db.json');
const IS_VERCEL = !!process.env.VERCEL;
const UPLOADS_DIR = IS_VERCEL ? '/tmp/uploads' : path.join(__dirname, 'uploads');

// ─── Ensure directories exist ────────────────────────────────
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ─── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOADS_DIR));
// Serve admin panel at /admin
app.use('/admin', express.static(path.join(__dirname, '..', 'frontend', 'admin')));
// Serve catalog at root
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ─── Multer (file uploads) ────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Tipo de arquivo não permitido. Use JPEG, PNG, WebP ou GIF.'), false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// ─── DB helpers ───────────────────────────────────────────────
function readDB() {
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(raw);
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// ─── Auth middleware ──────────────────────────────────────────
function authRequired(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }
  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

// ═══════════════════════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════════════════════

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
  }

  const db = readDB();
  if (db.admin.username !== username) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const valid = await bcrypt.compare(password, db.admin.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Credenciais inválidas' });

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, username });
});

// POST /api/auth/change-password
app.post('/api/auth/change-password', authRequired, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Nova senha deve ter pelo menos 6 caracteres' });
  }

  const db = readDB();
  const valid = await bcrypt.compare(currentPassword, db.admin.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Senha atual incorreta' });

  db.admin.passwordHash = await bcrypt.hash(newPassword, 10);
  writeDB(db);
  res.json({ message: 'Senha alterada com sucesso' });
});

// ═══════════════════════════════════════════════════════════════
// PUBLIC API ROUTES (consumed by the frontend catalog)
// ═══════════════════════════════════════════════════════════════

// GET /api/products
app.get('/api/products', (req, res) => {
  const db = readDB();
  let products = db.products;

  const { brand, model, badge, q } = req.query;
  if (brand && brand !== 'Todos') products = products.filter(p => p.brand === brand);
  if (model && model !== 'Todos') products = products.filter(p => p.model === model);
  if (badge) products = products.filter(p => p.badge === badge);
  if (q) {
    const lq = q.toLowerCase();
    products = products.filter(p =>
      p.name.toLowerCase().includes(lq) ||
      p.description.toLowerCase().includes(lq) ||
      p.brand.toLowerCase().includes(lq)
    );
  }

  res.json(products);
});

// GET /api/products/:id
app.get('/api/products/:id', (req, res) => {
  const db = readDB();
  const product = db.products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Produto não encontrado' });
  res.json(product);
});

// GET /api/settings
app.get('/api/settings', (req, res) => {
  const db = readDB();
  res.json(db.settings);
});

// ═══════════════════════════════════════════════════════════════
// ADMIN API ROUTES (protected)
// ═══════════════════════════════════════════════════════════════

// POST /api/admin/products
app.post('/api/admin/products', authRequired, upload.single('image'), (req, res) => {
  const { name, description, price, brand, model, scale, stock, badge, stars } = req.body;

  if (!name || !price || !brand) {
    return res.status(400).json({ error: 'Nome, preço e marca são obrigatórios' });
  }

  const db = readDB();
  const newProduct = {
    id: uuidv4(),
    name: name.trim(),
    description: description || '',
    price: parseFloat(price),
    brand: brand.trim(),
    model: model || '',
    scale: scale || '1/64',
    stock: parseInt(stock) || 0,
    badge: badge || 'Novo',
    stars: parseInt(stars) || 5,
    img: req.file
      ? `/uploads/${req.file.filename}`
      : (req.body.imgUrl || ''),
    createdAt: new Date().toISOString()
  };

  db.products.unshift(newProduct);
  writeDB(db);
  res.status(201).json(newProduct);
});

// PUT /api/admin/products/:id
app.put('/api/admin/products/:id', authRequired, upload.single('image'), (req, res) => {
  const db = readDB();
  const idx = db.products.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Produto não encontrado' });

  const { name, description, price, brand, model, scale, stock, badge, stars } = req.body;
  const existing = db.products[idx];

  // If new image uploaded, delete old local file
  if (req.file && existing.img && existing.img.startsWith('/uploads/')) {
    const oldPath = path.join(__dirname, existing.img);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  db.products[idx] = {
    ...existing,
    name: name !== undefined ? name.trim() : existing.name,
    description: description !== undefined ? description : existing.description,
    price: price !== undefined ? parseFloat(price) : existing.price,
    brand: brand !== undefined ? brand.trim() : existing.brand,
    model: model !== undefined ? model : existing.model,
    scale: scale !== undefined ? scale : existing.scale,
    stock: stock !== undefined ? parseInt(stock) : existing.stock,
    badge: badge !== undefined ? badge : existing.badge,
    stars: stars !== undefined ? parseInt(stars) : existing.stars,
    img: req.file
      ? `/uploads/${req.file.filename}`
      : (req.body.imgUrl !== undefined ? req.body.imgUrl : existing.img),
    updatedAt: new Date().toISOString()
  };

  writeDB(db);
  res.json(db.products[idx]);
});

// DELETE /api/admin/products/:id
app.delete('/api/admin/products/:id', authRequired, (req, res) => {
  const db = readDB();
  const idx = db.products.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Produto não encontrado' });

  const [removed] = db.products.splice(idx, 1);
  if (removed.img && removed.img.startsWith('/uploads/')) {
    const filePath = path.join(__dirname, removed.img);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  writeDB(db);
  res.json({ message: 'Produto excluído com sucesso', id: removed.id });
});

// PUT /api/admin/settings
app.put('/api/admin/settings', authRequired, upload.single('banner'), (req, res) => {
  const db = readDB();
  const { storeName, whatsapp, instagramUrl, bannerUrl } = req.body;

  db.settings = {
    ...db.settings,
    storeName: storeName || db.settings.storeName,
    whatsapp: whatsapp || db.settings.whatsapp,
    instagramUrl: instagramUrl || db.settings.instagramUrl,
    bannerUrl: req.file
      ? `/uploads/${req.file.filename}`
      : (bannerUrl !== undefined ? bannerUrl : db.settings.bannerUrl)
  };

  writeDB(db);
  res.json(db.settings);
});

// POST /api/admin/upload
app.post('/api/admin/upload', authRequired, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  res.json({ url: `/uploads/${req.file.filename}`, filename: req.file.filename });
});

// GET /api/admin/stats
app.get('/api/admin/stats', authRequired, (req, res) => {
  const db = readDB();
  const products = db.products;
  const totalValue = products.reduce((sum, p) => sum + (p.price * (p.stock || 0)), 0);
  const lowStock = products.filter(p => p.stock <= 2).length;
  const outOfStock = products.filter(p => p.stock === 0).length;

  res.json({
    totalProducts: products.length,
    totalValue,
    lowStock,
    outOfStock,
    brands: [...new Set(products.map(p => p.brand))].length
  });
});

// ─── Error handler ────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Arquivo muito grande. Máximo: 5MB' });
  }
  console.error(err);
  res.status(500).json({ error: err.message || 'Erro interno do servidor' });
});

// ─── Start ────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🏎️  Mini Garagem CMS rodando em http://localhost:${PORT}`);
    console.log(`📦  API: http://localhost:${PORT}/api/products`);
    console.log(`🔐  Admin: http://localhost:${PORT}/admin`);
    console.log(`\n   Login padrão: admin / admin123\n`);
  });
}

module.exports = app;
