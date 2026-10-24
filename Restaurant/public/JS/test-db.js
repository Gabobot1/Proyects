const sql = require('mssql');

const config = {
  user: 'Gabobot1',
  password: 'TuNuevaContraseña',
  server: '127.0.0.1',
  database: 'pagina_web',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

sql.connect(config).then(() => {
  console.log("✅ Conexión exitosa");
  return sql.query('SELECT TOP 1 * FROM Usuario_registrado');
}).then(result => {
  console.log("📦 Datos recibidos:", result.recordset);
}).catch(err => {
  console.error("❌ Error de conexión:", JSON.stringify(err, null, 2));
});