const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const path = require('path');
const sql = require('mssql');
const session = require('express-session');

const config = {
  user: 'gabo',
  password: '12345678Ge',
  server: 'gimnasio-pagina.database.windows.net',
  database: 'gimnasio-db',
  options: { encrypt: true, trustServerCertificate: false }
};

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'tu_secreto_aqui',
  resave: false,
  saveUninitialized: true
}));

// Logger middleware for debugging incoming requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Conexión a base de datos
let pool;
sql.connect(config).then(p => {
  pool = p;
  console.log('Conectado a SQL Server');
}).catch(err => {
  console.log('Error de conexión:', err);
});

// RUTA REGISTRO
app.post('/api/registro', async (req, res) => {
  try {
    const { usuario, contraseña, email, telefono, fechaNacimiento } = req.body;

    // Validar campos
    if (!usuario || !contraseña || !email || !telefono || !fechaNacimiento) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(contraseña, 10);

    // Verificar si el correo ya existe
    const checkUser = await pool.request()
      .input('Correo', sql.VarChar, email)
      .query('SELECT * FROM Usuario_registrado WHERE Correo = @Correo');

    if (checkUser.recordset.length > 0) {
      return res.status(400).json({ error: 'El correo ya está registrado' });
    }

    // Insertar en base de datos
    await pool.request()
      .input('Nombre', sql.VarChar, usuario)
      .input('Contraseña_hash', sql.VarChar, hashedPassword)
      .input('Correo', sql.VarChar, email)
      .input('Numero_telefono', sql.Numeric, telefono)
      .input('Fecha_nacimiento', sql.Date, fechaNacimiento)
      .query('INSERT INTO Usuario_registrado (Nombre, Contraseña_hash, Correo, Numero_telefono, Fecha_nacimiento) VALUES (@Nombre, @Contraseña_hash, @Correo, @Numero_telefono, @Fecha_nacimiento)');

    // Crear sesión
    req.session.usuario = usuario;
    req.session.correo = email;

    res.json({ success: true, mensaje: 'Registro exitoso' });
  } catch (error) {
    console.log('Error en registro:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// RUTA LOGIN
app.post('/api/login', async (req, res) => {
  try {
    const { usuario, contraseña } = req.body;

    if (!usuario || !contraseña) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }

    // Buscar usuario por nombre o correo
    const result = await pool.request()
      .input('busqueda', sql.VarChar, usuario)
      .query('SELECT * FROM Usuario_registrado WHERE Nombre = @busqueda OR Correo = @busqueda');

    if (result.recordset.length === 0) {
      return res.status(400).json({ error: 'Usuario no encontrado' });
    }

    const user = result.recordset[0];

    // Verificar contraseña
    const validPassword = await bcrypt.compare(contraseña, user.Contraseña_hash);

    if (!validPassword) {
      return res.status(400).json({ error: 'Contraseña incorrecta' });
    }

    // Crear sesión
    req.session.usuario = user.Nombre;
    req.session.usuarioId = user.ID_usuario;
    req.session.correo = user.Correo;

    res.json({ success: true, mensaje: 'Login exitoso' });
  } catch (error) {
    console.log('Error en login:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// RUTA VERIFICAR SESIÓN
app.get('/api/verificar', (req, res) => {
  if (req.session.usuario) {
    res.json({ autenticado: true, usuario: req.session.usuario, correo: req.session.correo });
  } else {
    res.json({ autenticado: false });
  }
});

// RUTA CONTACTO
app.post('/api/contacto', async (req, res) => {
  try {
    const { nombre, correo, mensaje } = req.body;

    // Validar campos
    if (!nombre || !correo || !mensaje) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    // Insertar en base de datos
    await pool.request()
      .input('Nombre', sql.VarChar, nombre)
      .input('Correo', sql.VarChar, correo)
      .input('Mensaje', sql.Text, mensaje)
      .query('INSERT INTO Contacto (Nombre, Correo, Mensaje) VALUES (@Nombre, @Correo, @Mensaje)');

    res.json({ success: true, mensaje: 'Mensaje enviado correctamente' });
  } catch (error) {
    console.log('Error en contacto:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// 404 handler - log unmatched routes
app.use((req, res) => {
  console.log(`Unhandled request: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: 'Not Found' });
});

// RUTA LOGOUT
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true, mensaje: 'Sesión cerrada' });
});

app.listen(3000, () => {
  console.log('✅ Servidor corriendo en http://localhost:3000');
});
