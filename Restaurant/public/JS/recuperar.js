const usuarios = [
  { usuario: "juan", email: "juan@gmail.com", contraseña: "123456" },
  { usuario: "ana", email: "ana@gmail.com", contraseña: "abc123" },
  { usuario: "santos", email: "santos@gmail.com", contraseña: "claveSegura" }
];

document.getElementById('recuperarForm').addEventListener('submit', function(e) {
  e.preventDefault();

  const correoIngresado = document.getElementById('email').value;
  const mensaje = document.getElementById('mensaje');

  const usuarioEncontrado = usuarios.find(u => u.email === correoIngresado);

  if (usuarioEncontrado) {
    mensaje.textContent = `Hola ${usuarioEncontrado.usuario}, hemos enviado un correo para restablecer tu contraseña`;
    mensaje.style.color = 'lightgreen';
  } else {
    mensaje.textContent = 'Correo no registrado. Verifica e intenta nuevamente.';
    mensaje.style.color = 'tomato';
  }
});
