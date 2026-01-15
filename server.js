require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

const app = express();

// ==============================
// MYSQL (POOL)
// ==============================
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'Jewerly_girl',
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// ==============================
// MIDDLEWARE
// ==============================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: 'secreto_jewelry',
  resave: false,
  saveUninitialized: true
}));

// ==============================
// EJS + ESTÁTICOS
// ==============================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// ==============================
// AUTH
// ==============================
function auth(req, res, next) {
  if (!req.session.userId) return res.redirect('/login');
  next();
}

// ==============================
// RUTAS GENERALES
// ==============================
app.get('/', (req, res) =>
  res.render('bienvenida', { titulo: 'Bienvenida' })
);

app.get('/login', (req, res) =>
  res.render('login', { titulo: 'Iniciar sesión' })
);

app.get('/registro', (req, res) =>
  res.render('registro', { titulo: 'Registro' })
);

app.get('/inicio', auth, (req, res) =>
  res.render('inicio', { titulo: 'Inicio' })
);

app.get('/tienda', auth, (req, res) =>
  res.render('tienda', { titulo: 'Tienda' })
);

app.get('/ofertas', auth, (req, res) =>
  res.render('ofertas', {
    titulo: 'Ofertas',
    carrito: req.session.carrito || [],
    reemplazar: req.query.reemplazar || null
  })
);

app.get('/consulta', auth, (req, res) =>
  res.render('consulta', {
    titulo: 'Carrito',
    carrito: req.session.carrito || []
  })
);

// ==============================
// CARRITO
// ==============================
app.get('/carrito/agregar', auth, (req, res) => {
  const { nombre, precio, reemplazar } = req.query;

  if (!req.session.carrito) req.session.carrito = [];

  const nuevo = {
    id: Date.now(),
    nombre,
    precio: Number(precio)
  };

  if (reemplazar) {
    const i = req.session.carrito.findIndex(p => p.id == reemplazar);
    if (i !== -1) req.session.carrito[i] = nuevo;
  } else {
    req.session.carrito.push(nuevo);
  }

  res.redirect('/consulta');
});

app.post('/consulta/eliminar/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  req.session.carrito = (req.session.carrito || []).filter(p => p.id !== id);
  res.redirect('/consulta');
});

// ==============================
// PAGO
// ==============================
app.post('/comprar', auth, (req, res) => res.redirect('/pago'));

app.get('/pago', auth, (req, res) => {
  const carrito = req.session.carrito || [];
  const total = carrito.reduce((s, p) => s + p.precio, 0);

  res.render('pagotarjeta', {
    titulo: 'Pago con tarjeta',
    carrito,
    total
  });
});

// ==============================
// PAGOTARJETA (TRANSACCIÓN)
// ==============================
app.post('/pagotarjeta', auth, async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const { nombre, numero } = req.body;
    const carrito = req.session.carrito || [];
    const total = carrito.reduce((s, p) => s + p.precio, 0);

    if (!carrito.length) return res.redirect('/consulta');

    await conn.beginTransaction();

    const [pago] = await conn.query(
      'INSERT INTO pagos (usuario_id, total, metodo, tarjeta, nombre) VALUES (?, ?, ?, ?, ?)',
      [req.session.userId, total, 'Tarjeta', numero.slice(-4), nombre]
    );

    const detalle = carrito.map(p => `${p.nombre} $${p.precio}`).join(', ');

    await conn.query(
      'INSERT INTO tickets (pago_id, detalle, total) VALUES (?, ?, ?)',
      [pago.insertId, detalle, total]
    );

    await conn.commit();

    req.session.carrito = [];
    res.redirect(`/ticket/${pago.insertId}`);

  } catch (error) {
    await conn.rollback();
    console.error('❌ Error en pago:', error);
    res.status(500).send('Error procesando el pago');
  } finally {
    conn.release();
  }
});

// ==============================
// VER TICKET INDIVIDUAL
// ==============================
app.get('/ticket/:id', auth, async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM tickets WHERE pago_id = ?',
    [req.params.id]
  );

  if (!rows.length) return res.send('Ticket no encontrado');

  res.render('ticket', {
    titulo: 'Ticket de compra',
    ticket: rows[0]
  });
});

// ==============================
// LISTAR TICKETS DEL USUARIO
// ==============================
app.get('/tickets', auth, async (req, res) => {
  const [rows] = await pool.query(`
    SELECT 
      t.id,
      t.pago_id,
      t.detalle,
      t.total
    FROM tickets t
    INNER JOIN pagos p ON t.pago_id = p.id
    WHERE p.usuario_id = ?
    ORDER BY t.id DESC
  `, [req.session.userId]);

  res.render('tickets', {
    titulo: 'Mis tickets',
    tickets: rows
  });
});

// ==============================
// LOGIN / REGISTRO
// ==============================
app.post('/registro', async (req, res) => {
  const hash = await bcrypt.hash(req.body.password, 10);

  await pool.query(
    'INSERT INTO registro (nombre, correo, password) VALUES (?, ?, ?)',
    [req.body.nombre, req.body.correo.toLowerCase(), hash]
  );

  res.redirect('/login');
});

app.post('/login', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM registro WHERE correo = ?',
    [req.body.correo.toLowerCase()]
  );

  if (!rows.length) return res.send('Usuario no encontrado');

  const ok = await bcrypt.compare(req.body.password, rows[0].password);
  if (!ok) return res.send('Contraseña incorrecta');

  req.session.userId = rows[0].id;
  res.redirect('/inicio');
});

app.get('/logout', (req, res) =>
  req.session.destroy(() => res.redirect('/login'))
);

// ==============================
app.listen(9999, () =>
  console.log('✅ Servidor en http://localhost:9999')
);
