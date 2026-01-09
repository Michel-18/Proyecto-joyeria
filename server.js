require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

const app = express();

// ==============================
// CONEXIÓN A MYSQL (XAMPP)
// ==============================
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'Jewerly_girl',
  port: 3306
});

// ==============================
// MIDDLEWARE
// ==============================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'secreto_jewelry',
  resave: false,
  saveUninitialized: true
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// ==============================
// RUTAS PÚBLICAS
// ==============================
app.get('/', (req, res) => {
  res.render('bienvenida', { titulo: 'Bienvenida a Jewelry Girl 💎' });
});

app.get('/login', (req, res) => {
  res.render('login', { titulo: 'Iniciar Sesión' });
});

app.get('/registro', (req, res) => {
  res.render('registro', { titulo: 'Registro' });
});

app.get('/inicio', (req, res) => {
  res.render('inicio', { titulo: 'Inicio' });
});

app.get('/ofertas', (req, res) => {
  const carrito = req.session.carrito || [];
  res.render('ofertas', {
    titulo: 'Ofertas',
    reemplazar: req.query.reemplazar || null,
    carrito
  });
});

// ==============================
// REGISTRO
// ==============================
app.post('/registro', async (req, res) => {
  try {
    const { nombre, correo, password } = req.body;
    const hashed = await bcrypt.hash(password, 10);

    await pool.query(
      'INSERT INTO registro (nombre, correo, password) VALUES (?, ?, ?)',
      [nombre, correo.toLowerCase(), hashed]
    );

    res.redirect('/login');
  } catch (error) {
    console.error(error);
    res.send('Error al registrar usuario');
  }
});

// ==============================
// LOGIN
// ==============================
app.post('/login', async (req, res) => {
  try {
    const { correo, password } = req.body;
    const [rows] = await pool.query(
      'SELECT * FROM registro WHERE correo = ?',
      [correo.toLowerCase()]
    );

    if (rows.length === 0) return res.send('Correo no registrado');

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.send('Contraseña incorrecta');

    req.session.userId = user.id;
    req.session.userNombre = user.nombre;

    res.redirect('/inicio');
  } catch (error) {
    console.error(error);
    res.send('Error al iniciar sesión');
  }
});

// ==============================
// PERFIL PROTEGIDO
// ==============================
app.get('/perfil', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  res.send(`Bienvenido ${req.session.userNombre}`);
});

// ==============================
// CARRITO (SIN EDITAR PRECIO/NOMBRE)
// ==============================

// Agregar producto normal
app.post('/agregar-carrito', (req, res) => {
  const { nombre, precio } = req.body;

  if (!req.session.carrito) req.session.carrito = [];

  const id = Date.now(); // ID único real
  req.session.carrito.push({ id, nombre, precio: Number(precio) });

  res.redirect('/consulta');
});

// Mostrar carrito
app.get('/consulta', (req, res) => {
  const carrito = req.session.carrito || [];
  res.render('consulta', {
    titulo: 'Tu Carrito',
    carrito
  });
});

// Reemplazar producto
app.get('/carrito/reemplazar', (req, res) => {
  const { viejoId, nombre, precio } = req.query;

  if (!req.session.carrito) return res.redirect('/consulta');

  // eliminar producto viejo
  req.session.carrito = req.session.carrito.filter(
    p => p.id !== Number(viejoId)
  );

  // agregar nuevo producto
  req.session.carrito.push({
    id: Date.now(),
    nombre,
    precio: Number(precio)
  });

  res.redirect('/consulta');
});

// Eliminar producto
app.post('/consulta/eliminar/:id', (req, res) => {
  const id = Number(req.params.id);

  if (!req.session.carrito) return res.redirect('/consulta');

  req.session.carrito = req.session.carrito.filter(p => p.id !== id);
  res.redirect('/consulta');
});

// ==============================
// 404
// ==============================
app.use((req, res) => {
  res.status(404).send('404 - Página no encontrada');
});

// ==============================
// INICIAR SERVIDOR
// ==============================
const PORT = process.env.PORT || 9999;
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});
