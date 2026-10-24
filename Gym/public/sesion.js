async function verificarSesion() {
  try {
    const response = await fetch('/api/verificar');
    const data = await response.json();

    if (data.autenticado) {
      mostrarPerfilUsuario(data.usuario);
    } else {
      mostrarLoginButton();
    }
  } catch (error) {
    console.error('Error verificando sesión:', error);
    mostrarLoginButton();
  }
}

// =======================
// MOSTRAR PERFIL (ESTILO ORIGINAL)
// =======================
function mostrarPerfilUsuario(usuario) {
  const loginLi = document.querySelector('nav ul li:has(> a[href="login.html"])');
  const registerLi = document.querySelector('nav ul li:last-child');

  if (loginLi) loginLi.style.display = 'none';
  if (registerLi && registerLi.textContent.includes('Login/Register')) {
    registerLi.style.display = 'none';
  }

  const profileLi = document.createElement('li');
  profileLi.style.position = 'relative';

  const profileHTML = `
    <style>
      .Btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border: none;
        border-radius: 25px;
        cursor: pointer;
        position: relative;
        overflow: hidden;
        transition: 0.3s;
        background-color: rgb(255, 65, 65);
        gap: 8px;
      }

      .sign {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 30px;
        transition: 0.3s;
      }

      .sign svg {
        width: 14px;
      }

      .sign svg path {
        fill: white;
      }

      .text {
        white-space: nowrap;
        font-size: 13px;
        font-weight: 600;
        color: white;
        opacity: 0;
        width: 0;
        overflow: hidden;
        transition: 0.3s;
      }

      .Btn:hover {
        width: 150px;
        border-radius: 30px;
        transition-duration: .3s;
      }

      .Btn:hover .sign {
        width: 30%;
        transition-duration: .3s;
        padding-left: 15px;
      }

      .Btn:hover .text {
        opacity: 1;
        width: 70%;
        transition-duration: .3s;
        padding-right: 8px;
      }

      .Btn:active {
        transform: translate(2px ,2px);
      }

      .submenu-perfil {
        padding: 15px;
        color: #ffffff;
        text-align: center;
        font-weight: bold;
        border-bottom: 1px solid #00ff99;
      }

      .submenu-container {
        padding: 10px;
      }

      .submenu-btn {
        color: #00ff99;
        text-decoration: none;
        font-size: 16px;
        border: none;
        background: none;
        font-weight: 600;
        font-family: 'Poppins', sans-serif;
        padding: 10px 8px;
        display: inline-block;
        cursor: pointer;
        position: relative;
        overflow: hidden;
      }

      .submenu-btn::after, .submenu-btn::before {
        content: '';
        width: 0%;
        height: 2px;
        background: #00ff99;
        display: block;
        transition: 0.5s;
        position: absolute;
        left: 0;
      }

      .submenu-btn::before { top: 0; }
      .submenu-btn::after { bottom: 0; }

      .submenu-btn:hover::after,
      .submenu-btn:hover::before {
        width: 100%;
      }
    </style>

    <div style="display:flex;align-items:center;gap:10px;cursor:pointer;" onclick="toggleMenu()">
      <svg width="30" height="30" viewBox="0 0 30 30" style="fill:#00ff99;">
        <circle cx="15" cy="10" r="5"/>
        <path d="M15 15 Q5 20 5 27 L25 27 Q25 20 15 15 Z"/>
      </svg>
      <span style="color:#00ff99;">${usuario}</span>
      <span class="material-symbols-outlined" style="font-size:18px;">expand_more</span>
    </div>

    <div id="submenu" style="display:none;position:absolute;top:100%;right:0;background:#1a1a1a;border:2px solid #00ff99;border-radius:5px;min-width:180px;z-index:999;">
      <div class="submenu-perfil">${usuario}</div>

      <div class="submenu-container">
        <button class="submenu-btn" onclick="openPedidos()">Pedidos</button>
        <div style="height:8px"></div>

        <button class="submenu-btn" onclick="openSuscripciones()">Suscripciones</button>
        <div style="height:8px"></div>

        <!-- NUEVO: INFO SUSCRIPCIÓN -->
        <div id="info-suscripcion" style="display:none;">
          <div id="plan-usuario" style="color:#00ff99;font-size:14px;margin:6px 0;"></div>

          <button class="submenu-btn" onclick="verEntrenador()">Mi entrenador</button>
          <div style="height:8px"></div>
        </div>

        <button class="Btn" onclick="cerrarSesion()">
          <div class="sign">
            <svg viewBox="0 0 512 512">
              <path d="M377.9 105.9L500.7 228.7c7.2 7.2 11.3 17.1 11.3 27.3s-4.1 20.1-11.3 27.3L377.9 406.1c-6.4 6.4-15 9.9-24 9.9c-18.7 0-33.9-15.2-33.9-33.9v-62.1h-128c-17.7 0-32-14.3-32-32v-64c0-17.7 14.3-32 32-32h128V129c0-18.7 15.2-33.9 33.9-33.9z"/>
            </svg>
          </div>
          <div class="text">Cerrar Sesión</div>
        </button>
      </div>
    </div>
  `;

  profileLi.innerHTML = profileHTML;
  const nav = document.querySelector('nav ul');
  if (nav) nav.appendChild(profileLi);

  // 🔹 Cargar datos de suscripción después de renderizar
  setTimeout(cargarSuscripcionUsuario, 300);
}

// =======================
// MOSTRAR LOGIN
// =======================
function mostrarLoginButton() {
  const loginLi = document.querySelector('nav ul li:has(> a[href="login.html"])');
  const registerLi = document.querySelector('nav ul li:last-child');

  if (loginLi) loginLi.style.display = 'inline';
  if (registerLi) registerLi.style.display = 'inline';
}

// =======================
// TOGGLE MENU
// =======================
function toggleMenu() {
  const submenu = document.getElementById('submenu');
  if (submenu) {
    submenu.style.display = submenu.style.display === 'none' ? 'block' : 'none';
  }
}

// =======================
// SUSCRIPCIÓN ACTIVA
// =======================
async function cargarSuscripcionUsuario() {
  try {
    const resp = await fetch('/api/usuario/suscripcion-activa');
    const data = await resp.json();

    if (!data.tieneSuscripcion) return;

    document.getElementById('info-suscripcion').style.display = 'block';
    document.getElementById('plan-usuario').textContent =
      `Plan activo: ${data.NombrePlan}`;

    window.entrenadorInfo = data;
  } catch (err) {
    console.error('Error cargando suscripción:', err);
  }
}

// =======================
// VER ENTRENADOR
// =======================
function verEntrenador() {
  const e = window.entrenadorInfo;

  if (!e) {
    Swal.fire({
      icon: 'info',
      title: 'Sin entrenador',
      text: 'No tienes un entrenador asignado aún',
      background: '#0a3d3d',
      color: '#00ff99'
    });
    return;
  }

  Swal.fire({
    title: `${e.Entrenador}`,
    html: `
      <p><strong>Plan:</strong> ${e.NombrePlan}</p>
      <p><strong>Días:</strong> ${e.Dias}</p>
      <p><strong>Horario:</strong> ${e.Horario}</p>
    `,
    background: '#0a3d3d',
    color: '#00ff99',
    confirmButtonText: 'Cerrar',
    confirmButtonColor: '#00ff99'
  });
}

// =======================
// NAVEGACIÓN
// =======================
function openPedidos() {
  window.location.href = 'pedidos.html';
}

function openSuscripciones() {
  window.location.href = 'suscripciones.html';
}

// =======================
// LOGOUT
// =======================
async function cerrarSesion() {
  try {
    const response = await fetch('/api/logout', { method: 'POST' });
    const data = await response.json();

    if (data.success) {
      Swal.fire({
        icon: 'success',
        title: 'Sesión cerrada',
        text: 'Redirigiendo...',
        background: '#0a3d3d',
        color: '#00ff99',
        confirmButtonColor: '#00ff99',
        confirmButtonText: 'OK',
        timer: 1500,
        allowOutsideClick: false
      }).then(() => {
        window.location.href = 'Index.html';
      });
    }
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
  }
}

// =======================
// INIT
// =======================
document.addEventListener('DOMContentLoaded', verificarSesion);
