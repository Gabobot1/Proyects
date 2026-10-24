document.addEventListener("DOMContentLoaded", () => {

  const listaCarrito = document.getElementById("lista-carrito");
  const totalTexto = document.getElementById("precio-total");
  const btnReserva = document.getElementById("reservar");

  function obtenerCarrito() {
    return JSON.parse(localStorage.getItem("carrito")) || [];
  }

  function guardarCarrito(carrito) {
    localStorage.setItem("carrito", JSON.stringify(carrito));
  }

function actualizarCarrito() {
  const carrito = obtenerCarrito();

  // --- Agrupar productos repetidos ---
  const productosUnificados = [];

  carrito.forEach(item => {
    const existente = productosUnificados.find(p => p.id === item.id);
    if (existente) {
      existente.cantidad += item.cantidad;
    } else {
      productosUnificados.push({ ...item });
    }
  });

  listaCarrito.innerHTML = "";
  let total = 0;

  productosUnificados.forEach(item => {
    const li = document.createElement("li");
    li.classList.add("item-carrito");

    const texto = document.createElement("span");
    texto.textContent = `${item.nombre} - S/ ${item.precio} x ${item.cantidad}`;

    const btnEliminar = document.createElement("button");
    btnEliminar.classList.add("btn-x");
    btnEliminar.innerHTML = "✖";

    btnEliminar.addEventListener("click", () => {
      let carrito = obtenerCarrito();

      const producto = carrito.find(p => p.id === item.id);

      if (producto.cantidad > 1) {
        producto.cantidad--;
      } else {
        carrito = carrito.filter(p => p.id !== item.id);
      }

      guardarCarrito(carrito);
      actualizarCarrito();
    });

    li.appendChild(texto);
    li.appendChild(btnEliminar);
    listaCarrito.appendChild(li);

    total += item.precio * item.cantidad;
  });

  totalTexto.textContent = `S/ ${total.toFixed(2)}`;
}

  actualizarCarrito();

  btnReserva.addEventListener("click", async () => {

    const carrito = obtenerCarrito();

    const usuario = localStorage.getItem("usuarioLogueado");
    if (!usuario) {
      alert("Debes iniciar sesión para reservar.");
      window.location.href = "LOGIN.html";
      return;
    }

  });

});
