document.getElementById("btnContacto").addEventListener("click", function (event) {
    event.preventDefault(); // 🚫 Evita el envío automático del formulario

    const nombre = document.getElementById("nombre").value;
    const correo = document.getElementById("correo").value;
    const asunto = document.getElementById("asunto").value;
    const mensaj = document.getElementById("mensaje").value;

    if (!nombre || !correo || !asunto || !mensaj) {
      alert("Por favor completa todos los campos.");
      return;
    }

    const mensaje = `Hola, soy ${nombre}. Mi correo es ${correo}. Asunto: ${asunto}. Mensaje: ${mensaj}`;

    const numeroRestaurante = "51906426099"; // ✅ Tu número de WhatsApp con código de país
    const url = `https://wa.me/${numeroRestaurante}?text=${encodeURIComponent(mensaje)}`;

    window.open(url, "_blank");
  });