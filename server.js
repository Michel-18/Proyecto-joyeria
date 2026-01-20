const express = require('express');
const session = require('express-session');
const mysql = require('mysql2');
const path = require('path');

const app = express();

// ================== CONFIG ==================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'jewelry-secret',
  resave: false,
  saveUninitialized: false
}));

// ================== DB ==================
// ================== DB ==================
const db = mysql.createPool({
  host: 'sql5.freesqldatabase.com',
  user: 'sql5814841',
  password: 'L5A9IQuHI8',
  database: 'sql5814841'
});

// ================== AUTH ==================
function auth(req, res, next) {
  if (!req.session.usuario) return res.redirect('/login');
  next();
}

// ================== RUTA RAÍZ ==================
app.get('/', (req, res) => {
  req.session.usuario ? res.redirect('/inicio') : res.redirect('/login');
});

// ================== LOGIN ==================
app.get('/login', (req, res) => {
  res.render('login', { titulo: 'Iniciar sesión' });
});

app.post('/login', async (req, res) => {
  const { correo, password } = req.body;

  const [rows] = await db.promise().query(
    'SELECT * FROM registro WHERE correo = ? AND contrasena = ?',
    [correo, password]
  );

  if (!rows.length) {
    return res.render('login', {
      titulo: 'Login',
      error: 'Correo o contraseña incorrectos'
    });
  }

  req.session.usuario = rows[0];
  req.session.carrito = [];
  res.redirect('/inicio');
});
// ================== REGISTRO ==================
app.get('/registro', (req, res) => {
  res.render('registro', { titulo: 'Registro' });
});

// ================== LOGOUT ==================
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// ================== IMÁGENES ==================
function asignarImagenes(productos) {
  return productos.map(p => {
    const n = p.nombre.toLowerCase();
    p.imagen =
      n.includes('arete') ? '/images/aretes.jpg' :
      n.includes('collar') ? '/images/collar.jpg' :
      n.includes('anillo') ? '/images/anillo.jpg' :
      n.includes('pulsera') ? '/images/pulsera.jpg' :
      '/images/default.jpg';
    return p;
  });
}

// ================== TIENDA ==================
app.get('/inicio', auth, async (req, res) => {
  const [productos] = await db.promise().query(
    'SELECT id, nombre, precio FROM productos'
  );

  res.render('tienda', {
    productos: asignarImagenes(productos),
    usuario: req.session.usuario
  });
});

// ================== CARRITO ==================
app.get('/carrito/agregar/:id', auth, async (req, res) => {
  const id = Number(req.params.id);
  req.session.carrito ||= [];

  const [rows] = await db.promise().query(
    'SELECT id, nombre, precio FROM productos WHERE id = ?',
    [id]
  );

  if (rows.length) req.session.carrito.push(rows[0]);
  res.redirect('/consulta');
});

app.get('/consulta', auth, (req, res) => {
  res.render('consulta', { carrito: req.session.carrito || [] });
});

app.post('/consulta/eliminar/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  req.session.carrito = req.session.carrito.filter(p => p.id !== id);
  res.redirect('/consulta');
});

// ================== PAGO ==================
app.get('/pago', auth, (req, res) => {
  const carrito = req.session.carrito || [];
  if (!carrito.length) return res.redirect('/consulta');

  const total = carrito.reduce((s, p) => s + Number(p.precio), 0);
  res.render('pago', { total });
});

// ================== PAGO CON TARJETA ==================
app.get('/pagotarjeta', auth, (req, res) => {
  const carrito = req.session.carrito || [];

  if (!carrito.length) {
    return res.redirect('/consulta');
  }

  const total = carrito.reduce((s, p) => s + Number(p.precio), 0);

  res.render('pagotarjeta', {
    titulo: 'Pago con tarjeta',
    carrito,
    total
  });
});

app.post('/pagotarjeta', auth, async (req, res) => {
  const carrito = req.session.carrito || [];
  if (!carrito.length) return res.redirect('/consulta');

  const total = carrito.reduce((s, p) => s + Number(p.precio), 0);
  const usuario_id = req.session.usuario.id;

  // (simulación de pago exitoso)
  await db.promise().query(
    'INSERT INTO ventas (usuario_id, total) VALUES (?, ?)',
    [usuario_id, total]
  );

  req.session.carrito = [];
  res.redirect('/tickets');
});

// ================== COMPRAR ==================
app.post('/comprar', auth, async (req, res) => {
  const carrito = req.session.carrito || [];
  if (!carrito.length) return res.redirect('/consulta');

  const total = carrito.reduce((s, p) => s + Number(p.precio), 0);
  const usuario_id = req.session.usuario.id;

  await db.promise().query(
    'INSERT INTO ventas (usuario_id, total) VALUES (?, ?)',
    [usuario_id, total]
  );

  req.session.carrito = [];
  res.redirect('/tickets');
});

// ================== TICKETS ==================
app.get('/tickets', auth, async (req, res) => {
  const [ventas] = await db.promise().query(
    'SELECT * FROM ventas WHERE usuario_id = ? ORDER BY fecha DESC',
    [req.session.usuario.id]
  );

  res.render('tickets', { ventas });
});

// ================== ELIMINAR TICKET ==================
app.post('/tickets/eliminar/:id', auth, async (req, res) => {
  const id = Number(req.params.id);

  try {
    await db.promise().query(
      'DELETE FROM ventas WHERE id = ? AND usuario_id = ?',
      [id, req.session.usuario.id]
    );

    res.redirect('/tickets');

  } catch (error) {
    console.error(error);
    res.send('Error al eliminar el registro');
  }
});

// ================== SERVER ==================
app.listen(9999, () => {
  console.log('Servidor activo en http://localhost:9999');
});
