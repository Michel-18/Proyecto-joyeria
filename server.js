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
const db = mysql.createPool({
  host: 'sql3.freesqldatabase.com',
  user: 'sql3814404',
  password: 'ldvmce7MY1',
  database: 'sql3814404'
});

// ================== MIDDLEWARE ==================
function auth(req, res, next) {
  if (!req.session.usuario) {
    return res.redirect('/login');
  }
  next();
}

// ================== RUTA RAÍZ ==================
app.get('/', (req, res) => {
  if (req.session.usuario) {
    res.redirect('/inicio');
  } else {
    res.redirect('/login');
  }
});

// ================== LOGIN ==================
app.get('/login', (req, res) => {
  res.render('login', { titulo: 'Iniciar sesión' });
});

app.post('/login', async (req, res) => {
  const { correo, password } = req.body;

  try {
    const [rows] = await db.promise().query(
      'SELECT * FROM registro WHERE correo = ? AND password = ?',
      [correo, password]
    );

    if (rows.length === 0) return res.redirect('/login');

    req.session.usuario = rows[0];
    req.session.carrito = req.session.carrito || [];

    res.redirect('/inicio');

  } catch (error) {
    console.error(error);
    res.send('Error al iniciar sesión');
  }
});

// ================== REGISTRO ==================
app.get('/registro', (req, res) => {
  res.render('registro', { titulo: 'Registro' });
});

app.post('/registro', async (req, res) => {
  const { nombre, correo, password } = req.body;

  try {
    await db.promise().query(
      'INSERT INTO registro (nombre, correo, password) VALUES (?, ?, ?)',
      [nombre, correo, password]
    );
    res.redirect('/login');

  } catch (error) {
    console.error(error);
    res.send('Error al registrar usuario');
  }
});

// ================== LOGOUT ==================
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// ================== INICIO / TIENDA ==================
app.get('/inicio', auth, async (req, res) => {
  try {
    const [productos] = await db.promise().query('SELECT * FROM productos');

    res.render('tienda', {
      productos: productos || [],
      usuario: req.session.usuario
    });

  } catch (error) {
    console.error(error);
    res.send('Error al cargar productos');
  }
});

// ================== AGREGAR AL CARRITO ==================
app.get('/carrito/agregar/:id', auth, async (req, res) => {
  const id = parseInt(req.params.id);
  req.session.carrito = req.session.carrito || [];

  try {
    const [rows] = await db.promise().query(
      'SELECT id, nombre, precio FROM productos WHERE id = ?',
      [id]
    );

    if (rows.length > 0) req.session.carrito.push(rows[0]);
    res.redirect('/consulta');

  } catch (error) {
    console.error(error);
    res.send('Error al agregar al carrito');
  }
});

// ================== VER CARRITO ==================
app.get('/consulta', auth, (req, res) => {
  res.render('consulta', { carrito: req.session.carrito || [] });
});

// ================== ELIMINAR DEL CARRITO ==================
app.post('/consulta/eliminar/:id', auth, (req, res) => {
  const id = parseInt(req.params.id);
  req.session.carrito = (req.session.carrito || []).filter(p => p.id !== id);
  res.redirect('/consulta');
});

// ================== COMPRAR ==================
app.post('/comprar', auth, async (req, res) => {
  const carrito = req.session.carrito || [];
  if (carrito.length === 0) return res.redirect('/consulta');

  const total = carrito.reduce((s, p) => s + Number(p.precio), 0);
  const usuario_id = req.session.usuario.id;

  try {
    // Guardar venta
    const [venta] = await db.promise().query(
      'INSERT INTO ventas (usuario_id, total, fecha) VALUES (?, ?, NOW())',
      [usuario_id, total]
    );
    const venta_id = venta.insertId;

    // Guardar detalle de venta
    for (let item of carrito) {
      await db.promise().query(
        'INSERT INTO detalle_venta (venta_id, producto_id, cantidad, precio) VALUES (?, ?, ?, ?)',
        [venta_id, item.id, 1, item.precio]
      );
    }

    // Limpiar carrito
    req.session.carrito = [];
    res.redirect('/tickets');

  } catch (error) {
    console.error(error);
    res.send('Error al guardar la compra');
  }
});

// ================== TICKETS ==================
app.get('/tickets', auth, async (req, res) => {
  try {
    const usuario_id = req.session.usuario.id;
    const [ventas] = await db.promise().query(
      'SELECT * FROM ventas WHERE usuario_id = ? ORDER BY fecha DESC',
      [usuario_id]
    );

    res.render('tickets', { ventas });
  } catch (error) {
    console.error(error);
    res.send('Error al cargar tickets');
  }
});

// ================== SERVIDOR ==================
app.listen(9999, () => {
  console.log('Servidor activo en http://localhost:9999');
});
