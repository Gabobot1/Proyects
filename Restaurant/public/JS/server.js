const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');

const app = express();
app.use(bodyParser.json());
const path = require('path');
app.use(express.static(path.join(__dirname, '..')));

const sql = require('mssql');

const config = {
  user: 'Gabo',
  password: '12345678',
  server: '127.0.0.1',
  database: 'pagina_web',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

app.post('/login', async (req, res) => {
  const { Correo, Contraseña } = req.body;

  try {
    await sql.connect(config);
    const result = await sql.query(`
      SELECT Contraseña_hash FROM Usuario_registrado WHERE Correo = '${Correo}'
    `);

    if (result.recordset.length === 0) {
      return res.json({ success: false });
    }

    const hash = result.recordset[0].Contraseña_hash;
    const match = await bcrypt.compare(Contraseña, hash);

    res.json({ success: match });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

app.post('/registrar', async (req, res) => {
  const { Nombre, Correo, Contraseña } = req.body;
  const hash = await bcrypt.hash(Contraseña, 10);

  try {
    await sql.connect(config);
    const request = new sql.Request();
    request.input('Nombre', sql.VarChar, Nombre);
    request.input('Correo', sql.Text, Correo);
    request.input('Hash', sql.Text, hash);

    await request.query(`
      INSERT INTO Usuario_registrado (
        Nombre, Apellido_Paterno, Apellido_Materno,
        Correo, Numero_telefono, Contraseña_hash
      ) VALUES (
        @Nombre, '', '', @Correo, '', @Hash
      )
    `);
    res.json({ success: true });
  } catch (err) {
    console.error("Error en /registrar:", JSON.stringify(err, null, 2));
    res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(3000, () => {
  console.log('Servidor corriendo en http://localhost:3000');
});