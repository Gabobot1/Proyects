const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const path = require('path');
const sql = require('mssql');

const config = {
  user: 'gabo',
  password: '12345678Ge',
  server: 'pagina-web.database.windows.net',
  database: 'pagina-web',
  options: { encrypt: true, trustServerCertificate: false }
};

const app = express();
app.use(bodyParser.json());
app.get("/reservas", async (req, res) => {
  try {
    await sql.connect(config);

    const result = await new sql.Request().query(`
      SELECT 
        ID_reserva,
        Nombre,
        Telefono,
        Fecha,
        Hora,
        Personas,
        Estado
      FROM Reserva
      ORDER BY Fecha DESC, Hora DESC
    `);

    res.json(result.recordset);
  } catch (error) {
    console.error("❌ Error /reservas:", error);
    res.status(500).json({ message: "Error al obtener reservas" });
  }
});
app.put("/reserva/:id/estado", async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  try {
    await sql.connect(config);

    await new sql.Request()
      .input("id", sql.Int, id)
      .input("estado", sql.VarChar(20), estado)
      .query(`
        UPDATE Reserva 
        SET Estado = @estado 
        WHERE ID_reserva = @id
      `);

    res.json({ success: true });
  } catch (error) {
    console.error("❌ Error cambiar estado:", error);
    res.status(500).json({ success: false });
  }
});
app.delete("/reserva/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await sql.connect(config);

    const result = await new sql.Request()
      .input("id", sql.Int, id)
      .query(`
        DELETE FROM Reserva
        WHERE ID_reserva = @id
      `);

    res.json({ success: true });
  } catch (error) {
    console.error("❌ Error al eliminar reserva:", error);
    res.status(500).json({ success: false });
  }
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/imagenes', express.static(path.join(__dirname, 'public/imagenes')));
const multer = require("multer");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/imagenes/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});

const upload = multer({ storage });
function convertirHora(horaRaw) {
  if (!horaRaw) return null;

  horaRaw = horaRaw.trim().toLowerCase();
  let match = horaRaw.match(/(\d{1,2}):(\d{2}):(\d{2})\s*(a\. m\.|p\. m\.)/);

  if (match) {
    let h = parseInt(match[1]);
    let m = match[2];
    let s = match[3];
    let ampm = match[4];

    if (ampm.includes("p") && h < 12) h += 12;
    if (ampm.includes("a") && h === 12) h = 0;

    return `${h.toString().padStart(2, '0')}:${m}:${s}`;
  }
  if (/^\d{2}:\d{2}$/.test(horaRaw)) {
    return horaRaw + ":00";
  }
  if (/^\d{2}:\d{2}:\d{2}$/.test(horaRaw)) {
    return horaRaw;
  }

  return null;
}
function toSQLTime(hhmmss) {
  const [h, m, s] = hhmmss.split(":").map(Number);
  const date = new Date();
  date.setHours(h, m, s, 0);
  return date;
}

const verificacion = {}; // almacén temporal

app.post("/enviar-codigo", async (req, res) => {
    const { correo } = req.body;

    if (!correo) {
        return res.json({ success: false, message: "Correo no recibido" });
    }

    const codigo = Math.floor(100000 + Math.random() * 900000);
    verificacion[correo] = codigo;

    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: "tuCorreo@gmail.com",
            pass: "clave_app"
        }
    });

    await transporter.sendMail({
        from: "tuCorreo@gmail.com",
        to: correo,
        subject: "Código de verificación",
        text: `Tu código es: ${codigo}`
    });

    res.json({ success: true, message: "Código enviado al correo" });
});


app.post("/verificar-codigo", (req, res) => {
    const { correo, codigo } = req.body;

    if (verificacion[correo] && verificacion[correo] == codigo) {
        return res.json({ success: true, message: "Código correcto" });
    }  

    res.json({ success: false, message: "Código incorrecto" });
});

app.post('/login', async (req, res) => {
  const { identificador, Contraseña } = req.body;

  if (!identificador || !Contraseña) {
    return res.json({ success: false, message: 'Faltan datos' });
  }

  try {
    await sql.connect(config);

    const request = new sql.Request();
    request.input('identificador', sql.VarChar(50), identificador);

    const result = await request.query(`
      SELECT ID_usuario, Nombre, Correo, Contraseña_hash 
      FROM Usuario_registrado 
      WHERE Nombre = @identificador OR Correo = @identificador
    `);

    if (result.recordset.length === 0) {
      return res.json({ success: false, message: 'Usuario no encontrado' });
    }

    const usuario = result.recordset[0];

    const match = await bcrypt.compare(Contraseña, usuario.Contraseña_hash);
    if (!match) {
      return res.json({ success: false, message: 'Contraseña incorrecta' });
    }

    res.json({
      success: true,
      message: 'Login correcto',
      idUsuario: usuario.ID_usuario,
      nombre: usuario.Nombre,
      correo: usuario.Correo
    });

  } catch (err) {
    console.error("Error en /login:", err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

const dominiosValidos = new Set([
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com",
  "icloud.com"
]);

function correoValido(correo) {
  if (typeof correo !== "string") return false;

  correo = correo.trim().toLowerCase();

  if (!correo.includes("@")) return false;

  const [local, dominio] = correo.split("@");

  if (!local || !dominio) return false;

  return dominiosValidos.has(dominio);
}

app.post('/registrar', async (req, res) => {
  const { Nombre, apmate, appate, Correo, Numero_telefono, Contraseña } = req.body;
  if (!Nombre || !appate || !apmate || !Correo || !Contraseña) {
    return res.json({ success: false, message: 'Faltan datos obligatorios' });
  }

  if (!correoValido(Correo)) {
    return res.json({ success: false, message: 'El dominio del correo no es válido.' });
  }

  try {
    await sql.connect(config);
    const check = await new sql.Request()
      .input('Correo', sql.VarChar(50), Correo)
      .query(`SELECT 1 FROM Usuario_registrado WHERE Correo = @Correo`);

    if (check.recordset.length > 0) {
      return res.json({ success: false, message: 'El correo ya está registrado' });
    }
    const hash = await bcrypt.hash(Contraseña, 10);
    await new sql.Request()
      .input('Nombre', sql.VarChar(20), Nombre)
      .input('Apellido_Paterno', sql.VarChar(20), appate)
      .input('Apellido_Materno', sql.VarChar(20), apmate)
      .input('Correo', sql.VarChar(50), Correo)
      .input('Numero_telefono', sql.Numeric(9), Numero_telefono || null)
      .input('Hash', sql.Text, hash)
      .query(`
        INSERT INTO Usuario_registrado 
        (Nombre, Apellido_Paterno, Apellido_Materno, Correo, Numero_telefono, Contraseña_hash)
        VALUES (@Nombre, @Apellido_Paterno, @Apellido_Materno, @Correo, @Numero_telefono, @Hash)
      `);

    res.json({ success: true, message: 'Usuario registrado correctamente' });

  } catch (err) {
    console.error("Error en /registrar:", err);
    res.status(500).json({ success: false, message: 'Error al registrar usuario' });
  }
});
app.post("/crear-pedido", async (req, res) => {
  const { usuario, productos } = req.body;

  if (!usuario) {
    return res.json({ success: false, message: "Correo no recibido" });
  }

  if (!productos || !Array.isArray(productos) || productos.length === 0) {
    return res.json({ success: false, message: "Productos del pedido incompletos" });
  }

  try {
    await sql.connect(config);
    const userQuery = await sql.query(`
      SELECT ID_usuario 
      FROM Usuario_registrado 
      WHERE Correo = '${usuario}'
    `);

    if (userQuery.recordset.length === 0) {
      return res.json({ success: false, message: "Usuario no encontrado" });
    }

    const ID_usuario = userQuery.recordset[0].ID_usuario;
    let total = 0;
    productos.forEach(p => {
      total += p.precio * p.cantidad;
    });
    const pedidoResult = await new sql.Request()
      .input("ID_usuario", sql.Int, ID_usuario)
      .input("Total", sql.Decimal(10, 2), total)
      .query(`
        INSERT INTO Pedido (ID_usuario, Total)
        VALUES (@ID_usuario, @Total);

        SELECT SCOPE_IDENTITY() AS ID_pedido;
      `);

    const ID_pedido = pedidoResult.recordset[0].ID_pedido;
    for (const p of productos) {
      await new sql.Request()
        .input("ID_pedido", sql.Int, ID_pedido)
        .input("ID_producto", sql.Int, p.id)
        .input("Cantidad", sql.Int, p.cantidad)
        .input("Monto", sql.Decimal(10,2), p.precio * p.cantidad)
        .query(`
          INSERT INTO Pedido_detalle (ID_pedido, ID_producto, Cantidad, Monto)
          VALUES (@ID_pedido, @ID_producto, @Cantidad, @Monto)
        `);
    }
    res.json({ success: true, message: "Pedido registrado correctamente" });

  } catch (error) {
    console.error("Error en /crear-pedido:", error);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});


app.post("/crear-reserva", async (req, res) => {
  console.log("📥 Hora recibida del FRONT:", req.body.hora);

  try {
    const { correo, nombre, telefono, fecha, hora, personas } = req.body;

    console.log("📦 Datos recibidos:", req.body);

    if (!correo || !nombre || !telefono || !fecha || !hora || !personas) {
      return res.status(400).json({ success: false, message: "Faltan datos" });
    }
    const horaFix = convertirHora(hora);
    console.log("⏰ Hora normalizada:", horaFix);

    if (!horaFix) {
      return res.status(400).json({ success: false, message: "Hora inválida" });
    }

    const pool = await sql.connect(config);

    const userQuery = await pool.request()
      .input("Correo", sql.VarChar(100), correo)
      .query("SELECT ID_usuario FROM Usuario_registrado WHERE Correo = @Correo");

    if (userQuery.recordset.length === 0) {
      return res.status(400).json({ success: false, message: "Usuario no encontrado" });
    }
    await pool.request()
      .input("Correo", sql.VarChar(100), correo)
      .input("Nombre", sql.VarChar(100), nombre)
      .input("Telefono", sql.VarChar(20), telefono)
      .input("Fecha", sql.Date, fecha)
      .input("Personas", sql.Int, personas)
      .input("Hora", sql.Time, toSQLTime(horaFix))
      .query(`
        INSERT INTO Reserva (Correo, Nombre, Telefono, Fecha, Personas, Hora)
        VALUES (@Correo, @Nombre, @Telefono, @Fecha, @Personas, @Hora)
      `);

    res.json({ success: true, message: "Reserva creada correctamente" });

  } catch (error) {
    console.error("❌ Error en /crear-reserva:", error);
    res.status(500).json({ success: false, message: "Error del servidor" });
  }
});

app.get('/productos', async (req, res) => {
  try {
    await sql.connect(config);
    const result = await new sql.Request()
      .query('SELECT ID_producto_pedido, Nombre, Precio, Imagen FROM Producto');

    const productos = result.recordset.map(p => {
      let img = p.Imagen;

      if (!img) img = "/imagenes/default.png";
      if (img.startsWith("http")) return { ...p, Imagen: img };

      if (!img.startsWith("/")) img = "/" + img;

      return { ...p, Imagen: img };
    });

    res.json(productos);

  } catch (err) {
    console.error("Error en /productos:", err);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

app.get('/productos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await sql.connect(config);
    const result = await new sql.Request()
      .input('id', sql.Int, id)
      .query('SELECT ID_producto_pedido, Nombre, Precio FROM Producto WHERE ID_producto_pedido = @id');
    if (result.recordset.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(result.recordset[0]);
  } catch (err) {
    console.error("Error en /productos/:id:", err);
    res.status(500).json({ error: 'Error al obtener producto' });
  }
});

app.post('/agregar-producto', upload.single("imagen"), async (req, res) => {
  try {

    console.log("BODY:", req.body);
    console.log("FILE:", req.file);

    let imagen = "";

    if (req.file) {
      imagen = "/imagenes/" + req.file.filename;
    } else if (req.body.Imagen) {
      if (req.body.Imagen.startsWith("http://") || req.body.Imagen.startsWith("https://")) {
        imagen = req.body.Imagen;
      } else {
        imagen = "/imagenes/" + req.body.Imagen.replace(/^\/+/, "");
      }
    }

    await sql.connect(config);

    await new sql.Request()
      .input("Nombre", sql.VarChar(50), req.body.Nombre)
      .input("Precio", sql.Decimal(10, 2), req.body.Precio)
      .input("Descripcion", sql.VarChar(250), req.body.Descripcion)
      .input("Imagen", sql.VarChar(300), imagen)
      .input("Categoria", sql.VarChar(50), req.body.Categoria)
      .input("Disponible", sql.Bit, parseInt(req.body.Disponible))
      .query(`
        INSERT INTO Producto (Nombre, Precio, Descripcion, Imagen, Categoria, Disponible)
        VALUES (@Nombre, @Precio, @Descripcion, @Imagen, @Categoria, @Disponible)
      `);

    res.json({ success: true, mensaje: "Producto agregado correctamente" });

  } catch (err) {
    console.error("ERROR /agregar-producto:", err);
    res.status(500).json({ success: false, mensaje: "Error al agregar producto" });
  }
});

app.get("/productos/categoria/:cat", async (req, res) => {
  try {
    const categoria = req.params.cat;

    await sql.connect(config);

    const result = await new sql.Request()
      .input("Categoria", sql.VarChar(50), categoria)
      .query(`
        SELECT * FROM Producto
        WHERE Categoria = @Categoria AND Disponible = 1
      `);

    res.json(result.recordset);

  } catch (err) {
    console.error("ERROR /productos/categoria:", err);
    res.json([]);
  }
});


app.delete('/eliminar-producto/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await sql.connect(config);

    const request = new sql.Request();
    request.input('id', sql.Int, id);

    const result = await request.query(`
      DELETE FROM Producto WHERE ID_producto_pedido = @id
    `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ mensaje: 'Producto no encontrado' });
    }

    res.json({ mensaje: 'Producto eliminado correctamente' });

  } catch (err) {
    console.error("Error en DELETE /eliminar-producto:", err);
    res.status(500).json({ mensaje: 'Error al eliminar el producto' });
  }
});


app.post('/enviar-contacto', async (req, res) => {
  try {
    const { nombre, correo, asunto, mensaje } = req.body;

    if (!nombre || !correo || !asunto || !mensaje) {
      return res.json({ success: false, message: "Faltan datos" });
    }

    let pool = await sql.connect(config);
    let request = pool.request();

    request.input("Nombre", sql.VarChar(100), nombre);
    request.input("Correo", sql.VarChar(100), correo);
    request.input("Asunto", sql.VarChar(150), asunto);
    request.input("Mensaje", sql.Text, mensaje);

    await request.query(`
      INSERT INTO Contacto (Nombre, Correo, Asunto, Mensaje)
      VALUES (@Nombre, @Correo, @Asunto, @Mensaje)
    `);

    res.json({ success: true, message: "Mensaje enviado correctamente" });
  } catch (err) {
    console.error("Error en /enviar-contacto:", err);
    res.status(500).json({ success: false, message: "Error del servidor" });
  }
});

app.listen(3000, () => {
  console.log('✅ Servidor corriendo en http://localhost:3000');
});
