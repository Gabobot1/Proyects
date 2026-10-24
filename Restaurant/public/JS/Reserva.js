
document.getElementById("btnReserva").addEventListener("click", function () {
    const nombre = document.getElementById("nombre").value;
    const telefono = document.getElementById("telefono").value;
    const hora = document.getElementById("hora").value;
    const fecha = document.getElementById("fecha").value;
    const personas = document.getElementById("personas").value;

    if (!nombre || !telefono || !hora || !fecha || !personas) {
      alert("Por favor completa todos los campos.");
      return;
    }

    const mensaje = `Hola, soy ${nombre}. Quiero reservar para ${personas} persona(s) el ${fecha} a las ${hora}. Mi número es ${telefono}.`;

    const numeroRestaurante = "51906426099"; 
    const url = `https://wa.me/${numeroRestaurante}?text=${encodeURIComponent(mensaje)}`;
    
    window.open(url, "_blank");
  });