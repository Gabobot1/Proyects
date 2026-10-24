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
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'intro.html'));
});
app.use(express.static('public'));
app.use(session({
  secret: 'tu_secreto_aqui',
  resave: false,
  saveUninitialized: true
}));
app.use(express.static(path.join(__dirname, 'public')));

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

// Helpers para persistir carrito en BD (si las tablas existen)
async function saveCartToDB(userId, carrito) {
  if (!pool) return;
  let transaction;
  try {
    transaction = new sql.Transaction(pool);
    await transaction.begin();
    // Use a fresh request() for each query to avoid re-declaring parameters
    // Borrar carrito anterior del usuario (si existe)
    await transaction.request()
      .input('ID_usuario', sql.Int, userId)
      .query('DELETE CI FROM CarritoItems CI INNER JOIN Carritos C ON CI.ID_carrito = C.ID_carrito WHERE C.ID_usuario = @ID_usuario');

    await transaction.request()
      .input('ID_usuario', sql.Int, userId)
      .query('DELETE FROM Carritos WHERE ID_usuario = @ID_usuario');

    // Crear nuevo carrito
    const insertCartReq = transaction.request();
    const insertCart = await insertCartReq
      .input('ID_usuario', sql.Int, userId)
      .query("INSERT INTO Carritos (ID_usuario, Fecha_actualizacion) OUTPUT INSERTED.ID_carrito VALUES (@ID_usuario, GETDATE())");
    const cartId = insertCart.recordset && insertCart.recordset[0] && insertCart.recordset[0].ID_carrito;

    if (cartId && Array.isArray(carrito) && carrito.length > 0) {
      for (const item of carrito) {
        // Store producto as "id:::nombre" so we can restore original id when loading
        const productoStored = (item.id ? String(item.id) + ':::' : '') + (item.nombre || '');
        await transaction.request()
          .input('ID_carrito', sql.Int, cartId)
          .input('Producto', sql.VarChar, productoStored)
          .input('Cantidad', sql.Int, item.cantidad)
          .input('Precio', sql.Decimal(18,2), item.precio)
          .input('Descripcion', sql.Text, item.descripcion || '')
          .query('INSERT INTO CarritoItems (ID_carrito, Producto, Cantidad, Precio, Descripcion) VALUES (@ID_carrito, @Producto, @Cantidad, @Precio, @Descripcion)');
      }
    }

    await transaction.commit();
  } catch (err) {
    console.log('Error guardando carrito en BD (puede que las tablas no existan):', err.message || err);
    try { if (transaction) await transaction.rollback(); } catch(e){}
  }
}

async function loadCartFromDB(userId) {
  if (!pool) return [];
  try {
    const result = await pool.request()
      .input('ID_usuario', sql.Int, userId)
      .query('SELECT C.ID_carrito, CI.Producto, CI.Cantidad, CI.Precio, CI.Descripcion FROM Carritos C LEFT JOIN CarritoItems CI ON C.ID_carrito = CI.ID_carrito WHERE C.ID_usuario = @ID_usuario ORDER BY C.Fecha_actualizacion DESC');

    const rows = result.recordset || [];
    const carrito = [];
    for (const r of rows) {
      if (!r || !r.Producto) continue;
      // Producto may be stored as "id:::nombre" — try to parse
      let parsedId = undefined;
      let parsedNombre = r.Producto;
      if (typeof r.Producto === 'string' && r.Producto.includes(':::')) {
        const parts = r.Producto.split(':::');
        parsedId = parts[0] || undefined;
        parsedNombre = parts.slice(1).join(':::') || '';
      }
      carrito.push({ id: parsedId, nombre: parsedNombre, cantidad: Number(r.Cantidad) || 1, precio: Number(r.Precio) || 0, descripcion: r.Descripcion || '' });
    }
    return carrito;
  } catch (err) {
    console.log('Error cargando carrito desde BD (posible tabla inexistente):', err.message || err);
    return [];
  }
}

function ensureItemIds(carrito) {
  if (!Array.isArray(carrito)) return carrito;
  return carrito.map(item => {
    if (item.id) return item;
    const name = (item.nombre || '') + '';
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return Object.assign({}, item, { id: slug || ('p_' + Math.floor(Math.random()*100000)) });
  });
}

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

// RUTA LOGOUT
app.post('/api/logout', (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'No se pudo cerrar sesión' });
      }
      res.json({ success: true, mensaje: 'Sesión cerrada correctamente' });
    });
  } catch (error) {
    console.log('Error en logout:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// RUTA CONTACTO
app.post('/api/contacto', async (req, res) => {
  try {
    const { nombre, correo, mensaje } = req.body;

    if (!nombre || !correo || !mensaje) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

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

// ===== API CARRITO (almacenado en BD + sesión temporal) =====
app.post('/api/carrito/add', async (req, res) => {
  try {
    const { id, nombre, precio, cantidad, descripcion } = req.body;
    if (!id || !nombre || !precio || !cantidad) {
      return res.status(400).json({ error: 'Campos de producto incompletos' });
    }

    // Validar que el usuario esté autenticado
    if (!req.session.usuarioId) {
      return res.status(401).json({ error: 'Debes iniciar sesión para agregar productos' });
    }

    // Mantener en sesión para UX inmediata
    if (!req.session.carrito) req.session.carrito = [];
    const existing = req.session.carrito.find(i => i.id === id);
    if (existing) {
      existing.cantidad = existing.cantidad + Number(cantidad);
    } else {
      req.session.carrito.push({ id, nombre, precio: Number(precio), cantidad: Number(cantidad), descripcion: descripcion || '' });
    }

    // Persistir carrito en BD (si está disponible)
    try { await saveCartToDB(req.session.usuarioId, req.session.carrito); } catch(e){ console.log('Warning: no se pudo persistir carrito tras add', e.message || e); }

    res.json({ success: true, carrito: req.session.carrito });
  } catch (err) {
    console.log('Error en /api/carrito/add:', err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

app.get('/api/carrito', async (req, res) => {
  try {
    if (!req.session.usuarioId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    // Si no hay carrito en sesión intentar cargar desde BD
    if (!req.session.carrito || req.session.carrito.length === 0) {
      try {
        const dbCart = await loadCartFromDB(req.session.usuarioId);
        if (Array.isArray(dbCart) && dbCart.length > 0) {
          req.session.carrito = ensureItemIds(dbCart);
        } else {
          req.session.carrito = ensureItemIds(req.session.carrito || []);
        }
      } catch(e) {
        console.log('No se pudo cargar carrito desde BD:', e.message || e);
        req.session.carrito = ensureItemIds(req.session.carrito || []);
      }
    }

    res.json({ success: true, carrito: req.session.carrito || [] });
  } catch (err) {
    console.log('Error en /api/carrito:', err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

app.post('/api/carrito/remove', async (req, res) => {
  try {
    if (!req.session.usuarioId) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    const { id } = req.body;
    if (!req.session.carrito) req.session.carrito = [];
    req.session.carrito = req.session.carrito.filter(i => i.id !== id);

    try { await saveCartToDB(req.session.usuarioId, req.session.carrito); } catch(e){ console.log('Warning: no se pudo persistir carrito tras remove', e.message || e); }

    res.json({ success: true, carrito: req.session.carrito });
  } catch (err) {
    console.log('Error en /api/carrito/remove:', err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

app.post('/api/carrito/update', async (req, res) => {
  try {
    if (!req.session.usuarioId) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    
    const { id, cantidad } = req.body;
    console.log('Actualizando carrito:', {id, cantidad, carritoActual: req.session.carrito});
    
    if (!id || cantidad === undefined || cantidad === null) {
      console.log('Faltan parámetros: id=', id, 'cantidad=', cantidad);
      return res.status(400).json({ error: 'ID y cantidad requeridos' });
    }

    if (!req.session.carrito) req.session.carrito = [];

    const item = req.session.carrito.find(i => i.id === id);
    if (!item) {
      console.log('Producto no encontrado. Productos en carrito:', req.session.carrito.map(i => i.id));
      return res.status(404).json({ error: 'Producto no encontrado en el carrito' });
    }

    const nuevaCantidad = parseInt(cantidad);
    if (isNaN(nuevaCantidad) || nuevaCantidad < 1) {
      console.log('Cantidad inválida:', nuevaCantidad);
      return res.status(400).json({ error: 'Cantidad debe ser mayor a 0' });
    }

    item.cantidad = nuevaCantidad;
    console.log('Carrito actualizado:', req.session.carrito);

    try { await saveCartToDB(req.session.usuarioId, req.session.carrito); } catch(e){ console.log('Warning: no se pudo persistir carrito tras update', e.message || e); }

    res.json({ success: true, carrito: req.session.carrito, mensaje: 'Cantidad actualizada correctamente' });
  } catch (err) {
    console.log('Error en /api/carrito/update:', err);
    res.status(500).json({ error: 'Error en el servidor: ' + err.message });
  }
});

app.post('/api/carrito/checkout', async (req, res) => {
  try {
    if (!req.session.usuarioId) {
      return res.status(401).json({ error: 'Debes iniciar sesión para hacer un pedido' });
    }

    const carrito = req.session.carrito || [];
    if (!carrito || carrito.length === 0) {
      return res.status(400).json({ error: 'Carrito vacío' });
    }

    try {
      // Calcular total
      const total = carrito.reduce((s, i) => s + (i.precio * i.cantidad), 0);
      
      // Insertar cabecera de pedido
      const result = await pool.request()
        .input('ID_usuario', sql.Int, req.session.usuarioId)
        .input('Total', sql.Decimal(18, 2), total)
        .query("INSERT INTO Pedidos (ID_usuario, Total, Fecha) OUTPUT INSERTED.ID_pedido VALUES (@ID_usuario, @Total, GETDATE())");

      const pedidoId = result.recordset && result.recordset[0] && result.recordset[0].ID_pedido;

      if (pedidoId) {
        // Insertar detalles del pedido
        for (const item of carrito) {
          await pool.request()
            .input('ID_pedido', sql.Int, pedidoId)
            .input('Producto', sql.VarChar, item.nombre)
            .input('Cantidad', sql.Int, item.cantidad)
            .input('Precio', sql.Decimal(18, 2), item.precio)
            .input('Descripcion', sql.Text, item.descripcion || '')
            .query('INSERT INTO PedidoItems (ID_pedido, Producto, Cantidad, Precio, Descripcion) VALUES (@ID_pedido, @Producto, @Cantidad, @Precio, @Descripcion)');
        }
        
        console.log('Pedido #' + pedidoId + ' creado para usuario ' + req.session.usuarioId);
      }

      // Limpiar carrito en sesión
      req.session.carrito = [];
      
      // También limpiar carrito de la BD
      try {
        await pool.request()
          .input('ID_usuario', sql.Int, req.session.usuarioId)
          .query('DELETE CI FROM CarritoItems CI INNER JOIN Carritos C ON CI.ID_carrito = C.ID_carrito WHERE C.ID_usuario = @ID_usuario');
        
        await pool.request()
          .input('ID_usuario', sql.Int, req.session.usuarioId)
          .query('DELETE FROM Carritos WHERE ID_usuario = @ID_usuario');
      } catch(dbCleanErr) {
        console.log('Warning: no se pudo limpiar carrito de BD:', dbCleanErr.message || dbCleanErr);
      }
      
      res.json({ success: true, mensaje: 'Pedido realizado exitosamente', pedidoId: pedidoId });
    } catch (dbErr) {
      console.log('Error guardando pedido en BD:', dbErr.message || dbErr);
      // Si hay error con la BD, limpiar sesión de todas formas
      req.session.carrito = [];
      res.status(500).json({ error: 'Error al procesar el pedido: ' + dbErr.message });
    }
  } catch (err) {
    console.log('Error en /api/carrito/checkout:', err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// RUTA PEDIDOS - devuelve pedidos para el usuario autenticado
app.get('/api/pedidos', async (req, res) => {
  try {
    if (!req.session || !req.session.usuarioId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const userId = req.session.usuarioId;

    // Intentar leer la tabla Pedidos; si no existe se responde con arreglo vacío
    try {
      const result = await pool.request()
        .input('ID_usuario', sql.Int, userId)
        .query('SELECT * FROM Pedidos WHERE ID_usuario = @ID_usuario ORDER BY Fecha DESC');

      return res.json({ success: true, pedidos: result.recordset });
    } catch (err) {
      console.log('Error leyendo Pedidos (posible tabla inexistente):', err.message || err);
      return res.json({ success: true, pedidos: [] });
    }
  } catch (error) {
    console.log('Error en /api/pedidos:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// RUTA DETALLES DE UN PEDIDO ESPECÍFICO
app.get('/api/pedidos/:id', async (req, res) => {
  try {
    if (!req.session || !req.session.usuarioId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const pedidoId = parseInt(req.params.id);
    const userId = req.session.usuarioId;

    try {
      // Obtener cabecera del pedido (verificar que pertenece al usuario)
      const pedidoResult = await pool.request()
        .input('ID_pedido', sql.Int, pedidoId)
        .input('ID_usuario', sql.Int, userId)
        .query('SELECT * FROM Pedidos WHERE ID_pedido = @ID_pedido AND ID_usuario = @ID_usuario');

      if (!pedidoResult.recordset || pedidoResult.recordset.length === 0) {
        return res.status(404).json({ error: 'Pedido no encontrado' });
      }

      const pedido = pedidoResult.recordset[0];

      // Obtener detalles del pedido
      const detallesResult = await pool.request()
        .input('ID_pedido', sql.Int, pedidoId)
        .query('SELECT * FROM PedidoItems WHERE ID_pedido = @ID_pedido');

      const detalles = detallesResult.recordset || [];

      res.json({ 
        success: true, 
        pedido: {
          id: pedido.ID_pedido,
          fecha: pedido.Fecha,
          total: pedido.Total,
          estado: 'Completado',
          items: detalles
        }
      });
    } catch (err) {
      console.log('Error leyendo detalles de pedido:', err.message || err);
      res.status(500).json({ error: 'Error al obtener detalles del pedido' });
    }
  } catch (error) {
    console.log('Error en /api/pedidos/:id:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// RUTA CREAR SUSCRIPCIÓN
app.post('/api/suscripciones/crear', async (req, res) => {
  try {
    if (!req.session || !req.session.usuarioId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { planId, nombre, precio } = req.body;
    const userId = req.session.usuarioId;

    if (!planId || !nombre || precio === undefined) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    try {
      // Crear orden de suscripción (similar a un pedido)
      const result = await pool.request()
        .input('ID_usuario', sql.Int, userId)
        .input('PlanId', sql.Int, planId)
        .input('NombrePlan', sql.VarChar, nombre)
        .input('Precio', sql.Decimal(18, 2), precio)
        .query(`
          INSERT INTO Suscripciones (ID_usuario, PlanId, NombrePlan, Precio, FechaInicio, Estado)
          OUTPUT INSERTED.ID_suscripcion
          VALUES (@ID_usuario, @PlanId, @NombrePlan, @Precio, GETDATE(), 'Activa')
        `);

      const suscripcionId = result.recordset && result.recordset[0] && result.recordset[0].ID_suscripcion;

      if (suscripcionId) {
        console.log('Suscripción #' + suscripcionId + ' creada para usuario ' + userId);
        res.json({ 
          success: true, 
          mensaje: 'Suscripción contratada exitosamente',
          suscripcionId: suscripcionId 
        });
      } else {
        res.status(500).json({ error: 'No se pudo crear la suscripción' });
      }
    } catch (dbErr) {
      console.log('Error guardando suscripción en BD:', dbErr.message || dbErr);
      // Si la tabla no existe, responder exitosamente de todas formas
      if (dbErr.message && dbErr.message.includes('Invalid object name')) {
        res.json({ 
          success: true, 
          mensaje: 'Suscripción contratada exitosamente (almacenamiento pending)',
          suscripcionId: 0
        });
      } else {
        res.status(500).json({ error: 'Error al procesar la suscripción: ' + dbErr.message });
      }
    }
  } catch (err) {
    console.log('Error en /api/suscripciones/crear:', err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// RUTA OBTENER SUSCRIPCIONES DEL USUARIO
app.get('/api/suscripciones', async (req, res) => {
  try {
    if (!req.session || !req.session.usuarioId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const userId = req.session.usuarioId;

    try {
      const result = await pool.request()
        .input('ID_usuario', sql.Int, userId)
        .query('SELECT * FROM Suscripciones WHERE ID_usuario = @ID_usuario ORDER BY FechaInicio DESC');

      res.json({ success: true, suscripciones: result.recordset || [] });
    } catch (err) {
      console.log('Error leyendo suscripciones (posible tabla inexistente):', err.message || err);
      res.json({ success: true, suscripciones: [] });
    }
  } catch (error) {
    console.log('Error en /api/suscripciones:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});
app.post('/api/suscripciones/asignar-entrenador', async (req, res) => {
  try {
    const { suscripcionId, entrenador } = req.body;

    if (!suscripcionId || !entrenador) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    await pool.request()
      .input('ID', sql.Int, suscripcionId)
      .input('Entrenador', sql.VarChar, entrenador)
      .query(`
        UPDATE Suscripciones
        SET Entrenador = @Entrenador
        WHERE ID_suscripcion = @ID
      `);

    res.json({ success: true });
  } catch (err) {
    console.log('Error asignando entrenador:', err);
    res.status(500).json({ error: 'Error al asignar entrenador' });
  }
});
app.get('/api/usuario/suscripcion-activa', async (req, res) => {
  try {
    if (!req.session || !req.session.usuarioId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const userId = req.session.usuarioId;

    const result = await pool.request()
      .input('ID_usuario', sql.Int, userId)
      .query(`
        SELECT TOP 1
          s.NombrePlan,
          s.Entrenador,
          e.Dias,
          e.Horario
        FROM Suscripciones s
        LEFT JOIN Entrenadores e
          ON s.Entrenador = e.Nombre
        WHERE s.ID_usuario = @ID_usuario
          AND s.Estado = 'Activa'
        ORDER BY s.FechaInicio DESC
      `);

    if (result.recordset.length === 0) {
      return res.json({ tieneSuscripcion: false });
    }

    res.json({
      tieneSuscripcion: true,
      ...result.recordset[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
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
