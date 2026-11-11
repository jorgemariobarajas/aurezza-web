// Catálogo de AUREZZA: carrusel de categorías, filtros, búsqueda y bolsa de pedido por WhatsApp.
const WHATSAPP = '573003212658';

// Orden y nombre visible de cada categoría (la clave es como aparece en el nombre de la foto).
const CATEGORIAS = [
  ['PANDORA', 'Pandora'],
  ['TOPOS + DIJE', 'Topos + dije'],
  ['ANILLOS', 'Anillos'],
  ['TOPOS', 'Topos'],
  ['DIJES', 'Dijes'],
  ['CANDONGAS', 'Candongas'],
  ['JUEGOS COMPLETOS', 'Juegos completos'],
  ['PULSERAS', 'Pulseras'],
  ['TOBILLERAS', 'Tobilleras'],
  ['TOPOS DE SEGURIDAD', 'Topos de seguridad'],
  ['GARGANTILLAS', 'Gargantillas'],
  ['OTROS', 'Otros'],
  ['CADENAS', 'Cadenas'],
];
const nombreCategoria = new Map(CATEGORIAS);

const MINUSCULAS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'en', 'con', 'x', 'of', 'a']);

// "VAN CLEEF DOBLE TRÉBOL" -> "Van Cleef Doble Trébol"
function aTitulo(texto) {
  return texto.toLowerCase().split(' ').map((palabra, i) => {
    if (/^([a-z]\.)+$/.test(palabra)) return palabra.toUpperCase();   // siglas: A.E.
    if (i > 0 && MINUSCULAS.has(palabra)) return palabra;
    return palabra.charAt(0).toUpperCase() + palabra.slice(1);
  }).join(' ');
}

const categoriaDe = joya => nombreCategoria.get(joya.categoria) || aTitulo(joya.categoria);
const valor = precio => parseInt(precio.replace(/\D/g, ''), 10) || 0;          // "$135.000" -> 135000
const pesos = n => '$' + n.toLocaleString('es-CO');                             // 135000 -> "$135.000"
const agotada = joya => /agotad/i.test(joya.precio);                            // foto con "(AGOTADO)" en lugar de precio
const rutaFoto = ruta => ruta.split('/').map(encodeURIComponent).join('/');
const enlaceWhatsApp = texto => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto)}`;

const catalogo = window.CATALOGO || [];
const porFoto = new Map(catalogo.map(j => [j.foto, j]));

// Orden de la vitrina: por categoría (según CATEGORIAS) y luego por nombre.
const posicion = new Map(CATEGORIAS.map(([c], i) => [c, i]));
catalogo.sort((a, b) => (posicion.get(a.categoria) ?? 99) - (posicion.get(b.categoria) ?? 99) || a.nombre.localeCompare(b.nombre, 'es'));

const cuenta = catalogo.reduce((m, j) => m.set(j.categoria, (m.get(j.categoria) || 0) + 1), new Map());
const extra = [...cuenta.keys()].filter(c => !nombreCategoria.has(c)).map(c => [c, aTitulo(c)]);
const listaCategorias = [...CATEGORIAS, ...extra].map(([clave, nombre]) => ({
  clave, nombre, total: cuenta.get(clave) || 0,
  portada: catalogo.find(j => j.categoria === clave),
}));

const barra = document.querySelector('.barra');
const pista = document.querySelector('.carrusel__pista');
const filtros = document.querySelector('.filtros');
const ancla = document.querySelector('.ancla-catalogo');
const rejilla = document.querySelector('.rejilla');
const buscador = document.querySelector('.buscador input');
const resumen = document.querySelector('.resumen');
let categoriaActiva = 'TODAS';

// La cinta de categorías se queda fija justo debajo de la barra superior.
function medirBarra() {
  document.documentElement.style.setProperty('--alto-barra', barra.offsetHeight + 'px');
}

/* ---------- Carrusel y cinta de categorías ---------- */

// Carrusel en movimiento: las tarjetas van tres veces seguidas para que se pueda recorrer
// sin cortes hacia ambos lados. Las dos últimas copias son solo visuales.
function pintarCarrusel() {
  pista.innerHTML = '';
  const recorrido = document.createElement('div');
  recorrido.className = 'carrusel__recorrido';
  for (const copia of [false, true, true]) {
    for (const cat of listaCategorias) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'categoria';
      b.dataset.categoria = cat.clave;
      b.innerHTML = `
        <span class="categoria__foto">${cat.portada ? '<img alt="">' : '<img class="categoria__sello" alt="" src="imagenes/logo.svg.crema.svg">'}</span>
        <span class="categoria__nombre"></span>
        <span class="categoria__total"></span>`;
      if (cat.portada) b.querySelector('img').src = rutaFoto(cat.portada.foto);
      b.querySelector('img').draggable = false;
      b.querySelector('.categoria__nombre').textContent = cat.nombre;
      b.querySelector('.categoria__total').textContent = cat.total ? `${cat.total} ${cat.total === 1 ? 'pieza' : 'piezas'}` : 'Próximamente';
      if (copia) { b.tabIndex = -1; b.setAttribute('aria-hidden', 'true'); }
      b.addEventListener('click', () => seleccionar(cat.clave));
      recorrido.appendChild(b);
    }
  }
  pista.appendChild(recorrido);
  animarCarrusel(recorrido);
}

// Avanza solo de derecha a izquierda; se detiene mientras el cliente lo toca, lo arrastra
// o pasa el ratón por encima, y continúa poco después desde donde lo dejó.
function animarCarrusel(recorrido) {
  const SEGUNDOS_POR_VUELTA = 50, ESPERA_MS = 1500, UMBRAL_ARRASTRE = 5;
  const sinMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let tramo = 0, posicion = 0, pausaHasta = 0, tocando = false, ratonEncima = false, arrastre = null, anterior = performance.now();

  const medir = () => {
    const nuevo = recorrido.getBoundingClientRect().width / 3;
    const avance = tramo ? ((pista.scrollLeft % tramo) / tramo) : 0;
    tramo = nuevo;
    posicion = tramo + avance * tramo;
    pista.scrollLeft = posicion;
  };
  // Mantiene el recorrido en la copia del medio, donde siempre hay espacio a ambos lados.
  const recentrar = () => {
    if (pista.scrollLeft < tramo * 0.5) pista.scrollLeft += tramo;
    else if (pista.scrollLeft > tramo * 1.5) pista.scrollLeft -= tramo;
    posicion = pista.scrollLeft;
  };
  const conTeclado = () => pista.contains(document.activeElement) && document.activeElement.matches(':focus-visible');

  function cuadro(ahora) {
    const dt = Math.min(ahora - anterior, 100);
    anterior = ahora;
    if (!sinMovimiento && !tocando && !arrastre && ahora >= pausaHasta) {
      if (ratonEncima || conTeclado()) {
        recentrar();
      } else {
        if (Math.abs(pista.scrollLeft - posicion) > 3) recentrar();
        posicion += tramo / SEGUNDOS_POR_VUELTA * dt / 1000;
        if (posicion > tramo * 1.5) posicion -= tramo;
        pista.scrollLeft = posicion;
      }
    }
    requestAnimationFrame(cuadro);
  }

  // Dedo: el navegador mueve la fila; aquí solo se detiene el avance automático.
  pista.addEventListener('touchstart', () => { tocando = true; }, { passive: true });
  const soltar = () => { tocando = false; pausaHasta = performance.now() + ESPERA_MS; };
  pista.addEventListener('touchend', soltar, { passive: true });
  pista.addEventListener('touchcancel', soltar, { passive: true });
  // El impulso del dedo sigue moviendo la fila un rato después de soltar.
  pista.addEventListener('scroll', () => {
    if (Math.abs(pista.scrollLeft - posicion) > 3 && !arrastre) pausaHasta = Math.max(pausaHasta, performance.now() + ESPERA_MS);
  }, { passive: true });

  // Ratón: arrastrar con el botón presionado.
  pista.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') ratonEncima = true; });
  pista.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') ratonEncima = false; });
  pista.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    arrastre = { x: e.clientX, inicio: pista.scrollLeft, movido: false };
  });
  window.addEventListener('pointermove', e => {
    if (!arrastre) return;
    const dx = e.clientX - arrastre.x;
    if (!arrastre.movido && Math.abs(dx) < UMBRAL_ARRASTRE) return;
    arrastre.movido = true;
    pista.classList.add('carrusel__pista--arrastrando');
    pista.scrollLeft = arrastre.inicio - dx;
    const antes = pista.scrollLeft;
    recentrar();
    arrastre.inicio += pista.scrollLeft - antes;
  });
  window.addEventListener('pointerup', () => {
    if (!arrastre) return;
    // Un arrastre no debe abrir la categoría sobre la que se soltó el ratón.
    if (arrastre.movido) {
      const bloquear = e => { e.preventDefault(); e.stopPropagation(); };
      pista.addEventListener('click', bloquear, { capture: true, once: true });
      setTimeout(() => pista.removeEventListener('click', bloquear, { capture: true }), 50);
    }
    arrastre = null;
    pista.classList.remove('carrusel__pista--arrastrando');
    pausaHasta = performance.now() + ESPERA_MS;
  });

  medir();
  window.addEventListener('resize', medir);
  requestAnimationFrame(cuadro);
}

function pintarFiltros() {
  filtros.innerHTML = '';
  const opciones = [{ clave: 'TODAS', nombre: 'Todas', total: catalogo.length }, ...listaCategorias];
  for (const { clave, nombre, total } of opciones) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'filtro';
    b.dataset.categoria = clave;
    b.innerHTML = `${nombre}<small>${total || 'pronto'}</small>`;
    b.addEventListener('click', () => seleccionar(clave));
    filtros.appendChild(b);
  }
  marcarActiva();
}

// Flechas de la cinta: se apagan en los extremos y se ocultan si todo cabe en pantalla.
function actualizarFlechas() {
  const [atras, adelante] = document.querySelectorAll('.cinta__flecha');
  const sobra = filtros.scrollWidth - filtros.clientWidth > 2;
  atras.hidden = adelante.hidden = !sobra;
  atras.disabled = filtros.scrollLeft <= 2;
  adelante.disabled = filtros.scrollLeft >= filtros.scrollWidth - filtros.clientWidth - 2;
}

document.querySelectorAll('.cinta__flecha').forEach(f => f.addEventListener('click', () => {
  filtros.scrollBy({ left: Number(f.dataset.dir) * filtros.clientWidth * 0.7, behavior: 'smooth' });
}));
filtros.addEventListener('scroll', actualizarFlechas, { passive: true });

function marcarActiva() {
  document.querySelectorAll('.filtro, .categoria').forEach(b => b.setAttribute('aria-pressed', b.dataset.categoria === categoriaActiva));
  const chip = filtros.querySelector(`[data-categoria="${CSS.escape(categoriaActiva)}"]`);
  if (chip) filtros.scrollTo({ left: chip.offsetLeft - (filtros.clientWidth - chip.offsetWidth) / 2, behavior: 'smooth' });
}

// Abre una categoría: filtra la vitrina y baja hasta ella.
function seleccionar(clave) {
  categoriaActiva = clave;
  buscador.value = '';
  marcarActiva();
  pintarJoyas();
  const destino = ancla.getBoundingClientRect().top + window.scrollY - barra.offsetHeight;
  window.scrollTo({ top: destino, behavior: 'smooth' });
}

/* ---------- Vitrina ---------- */

function tarjeta(joya) {
  const art = document.createElement('article');
  art.className = 'joya';
  const nombre = aTitulo(joya.nombre);
  art.innerHTML = `
    <button class="joya__marco" type="button"><img loading="lazy" alt=""></button>
    <p class="joya__categoria"></p>
    <h3 class="joya__nombre"><button class="joya__titulo" type="button"></button></h3>
    ${joya.detalle ? '<p class="joya__detalle"></p>' : ''}
    <p class="joya__precio"></p>
    <button class="joya__anadir" type="button"></button>`;
  const img = art.querySelector('img');
  img.src = rutaFoto(joya.foto);
  img.alt = `Ver ${nombre}, ${categoriaDe(joya)}`;
  art.querySelector('.joya__categoria').textContent = categoriaDe(joya);
  art.querySelector('.joya__titulo').textContent = nombre;
  art.querySelectorAll('.joya__marco, .joya__titulo').forEach(b => b.addEventListener('click', () => abrirFicha(joya)));
  if (joya.detalle) art.querySelector('.joya__detalle').textContent = aTitulo(joya.detalle);
  art.querySelector('.joya__precio').textContent = agotada(joya) ? 'Agotado' : joya.precio;
  const boton = art.querySelector('.joya__anadir');
  boton.dataset.foto = joya.foto;
  if (agotada(joya)) {
    boton.disabled = true;
    boton.textContent = 'Agotado';
    return art;
  }
  boton.addEventListener('click', () => bolsa.has(joya.foto) ? abrirBolsa() : anadir(joya));
  pintarBotonAnadir(boton);
  return art;
}

function pintarBotonAnadir(boton) {
  if (boton.disabled) return;
  const dentro = bolsa.has(boton.dataset.foto);
  boton.classList.toggle('joya__anadir--dentro', dentro);
  boton.textContent = dentro ? 'En tu bolsa ✓' : 'Añadir a la bolsa';
}

function pintarJoyas() {
  const texto = buscador.value.trim().toLowerCase();
  const lista = catalogo.filter(j =>
    (categoriaActiva === 'TODAS' || j.categoria === categoriaActiva) &&
    (!texto || `${j.nombre} ${j.categoria} ${j.detalle}`.toLowerCase().includes(texto)));

  rejilla.innerHTML = '';
  if (!lista.length) {
    const nombre = nombreCategoria.get(categoriaActiva) || 'esta búsqueda';
    const vacio = document.createElement('div');
    vacio.className = 'vacio';
    vacio.innerHTML = `<p>Muy pronto tendremos novedades en <strong></strong>. Pregúntanos por lo que buscas.</p>
      <a class="boton" target="_blank" rel="noopener">Consultar por WhatsApp</a>`;
    vacio.querySelector('strong').textContent = texto ? `“${buscador.value.trim()}”` : nombre;
    vacio.querySelector('a').href = enlaceWhatsApp('Hola AUREZZA, estoy buscando ' + (texto || nombre.toLowerCase()));
    rejilla.appendChild(vacio);
    resumen.textContent = '';
    return;
  }
  lista.forEach(j => rejilla.appendChild(tarjeta(j)));
  resumen.textContent = `${lista.length} ${lista.length === 1 ? 'pieza' : 'piezas'}`;
}

/* ---------- Ficha de cada joya ---------- */

const DESCRIPCION_GENERAL = 'Una pieza de AUREZZA, elegida para acompañarte todos los días con el brillo discreto de lo atemporal.';
const ficha = document.querySelector('.ficha');
const fichaFoto = ficha.querySelector('.ficha__foto img');
const fichaMiniaturas = ficha.querySelector('.ficha__miniaturas');
const fichaBoton = ficha.querySelector('.ficha__anadir');
const limpio = texto => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const enlaceDe = joya => limpio(`${joya.categoria} ${joya.nombre}`);
let joyaEnFicha = null;
let fichaEnHistorial = false;   // true si abrir la ficha añadió un paso al botón "atrás"
let elementoPrevio = null;

function mostrarFoto(joya, ruta, boton) {
  fichaFoto.src = rutaFoto(ruta);
  fichaFoto.alt = `${aTitulo(joya.nombre)}, ${categoriaDe(joya)}`;
  fichaMiniaturas.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b === boton));
}

function pintarFicha(joya) {
  joyaEnFicha = joya;
  const fotos = [joya.foto, ...[].concat(joya.extras || [])];
  fichaMiniaturas.innerHTML = '';
  fichaMiniaturas.hidden = fotos.length < 2;
  fotos.forEach((ruta, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', i ? `Ver foto ${i + 1}` : 'Ver foto principal');
    const mini = document.createElement('img');
    mini.src = rutaFoto(ruta);
    mini.alt = '';
    b.appendChild(mini);
    b.addEventListener('click', () => mostrarFoto(joya, ruta, b));
    fichaMiniaturas.appendChild(b);
  });
  mostrarFoto(joya, joya.foto, fichaMiniaturas.firstChild);
  ficha.querySelector('.ficha__categoria').textContent = categoriaDe(joya);
  ficha.querySelector('#ficha-nombre').textContent = aTitulo(joya.nombre);
  const detalle = ficha.querySelector('.ficha__detalle');
  detalle.textContent = joya.detalle ? aTitulo(joya.detalle) : '';
  detalle.hidden = !joya.detalle;
  ficha.querySelector('.ficha__precio').textContent = agotada(joya) ? 'Agotado' : joya.precio;
  ficha.querySelector('.ficha__descripcion').textContent = window.DESCRIPCIONES?.[`${joya.categoria}|${joya.nombre}`] || DESCRIPCION_GENERAL;
  fichaBoton.dataset.foto = joya.foto;
  fichaBoton.disabled = agotada(joya);
  if (agotada(joya)) fichaBoton.textContent = 'Agotado'; else pintarBotonAnadir(fichaBoton);
  ficha.querySelector('.ficha__hoja').scrollTop = 0;
}

function mostrarFicha() {
  ficha.hidden = false;
  document.body.style.overflow = 'hidden';
  ficha.querySelector('.ficha__cerrar').focus();
}

function ocultarFicha() {
  ficha.hidden = true;
  joyaEnFicha = null;
  fichaEnHistorial = false;
  document.body.style.overflow = '';
  if (elementoPrevio?.isConnected) elementoPrevio.focus({ preventScroll: true });
  elementoPrevio = null;
}

function abrirFicha(joya) {
  elementoPrevio = document.activeElement;
  history.pushState(null, '', `#joya=${enlaceDe(joya)}`);
  fichaEnHistorial = true;
  pintarFicha(joya);
  mostrarFicha();
}

function cerrarFicha() {
  if (fichaEnHistorial) { history.back(); return; }   // el evento popstate termina de cerrarla
  history.replaceState(null, '', location.pathname + location.search);
  ocultarFicha();
}

// Abre la ficha si la dirección trae #joya=... (enlace compartido o botón "adelante").
function revisarEnlace() {
  const enlace = location.hash.startsWith('#joya=') ? location.hash.slice(6) : null;
  const joya = enlace && catalogo.find(j => enlaceDe(j) === enlace);
  if (joya) {
    pintarFicha(joya);
    mostrarFicha();
  } else if (!ficha.hidden) {
    ocultarFicha();
  }
}

fichaBoton.addEventListener('click', () => {
  if (!joyaEnFicha || fichaBoton.disabled) return;
  if (bolsa.has(joyaEnFicha.foto)) abrirBolsa(); else anadir(joyaEnFicha);
});
ficha.querySelector('.ficha__cerrar').addEventListener('click', cerrarFicha);
ficha.querySelector('.ficha__velo').addEventListener('click', cerrarFicha);
window.addEventListener('popstate', revisarEnlace);

/* ---------- Bolsa ---------- */

const CLAVE_BOLSA = 'aurezza-bolsa';
const CLAVE_CUPON = 'aurezza-cupon';
// Cupones válidos: código -> porcentaje de descuento.
const CUPONES = { AUREZZASOYYO: 10 };
const ENVIO_GRATIS_DESDE = 150000;
// Casi todas las piezas tienen 1 unidad; aquí van solo las que tienen más.
const UNIDADES = {};
const unidadesDe = joya => UNIDADES[joya.nombre] || 1;
// Categorías que combinan con lo que el cliente ya lleva, en orden de preferencia.
const COMBINA = {
  'PANDORA': ['PANDORA', 'ANILLOS', 'PULSERAS'],
  'TOPOS + DIJE': ['ANILLOS', 'PULSERAS', 'TOPOS DE SEGURIDAD'],
  'ANILLOS': ['TOPOS', 'PULSERAS', 'TOPOS DE SEGURIDAD'],
  'TOPOS': ['DIJES', 'ANILLOS', 'TOPOS DE SEGURIDAD'],
  'DIJES': ['TOPOS', 'CANDONGAS', 'TOPOS DE SEGURIDAD'],
  'CANDONGAS': ['DIJES', 'ANILLOS', 'PULSERAS'],
  'JUEGOS COMPLETOS': ['ANILLOS', 'PULSERAS', 'TOPOS DE SEGURIDAD'],
  'PULSERAS': ['ANILLOS', 'TOPOS', 'CANDONGAS'],
  'TOBILLERAS': ['PULSERAS', 'TOPOS', 'TOPOS DE SEGURIDAD'],
  'TOPOS DE SEGURIDAD': ['TOPOS', 'DIJES', 'ANILLOS'],
  'GARGANTILLAS': ['TOPOS', 'ANILLOS', 'PULSERAS'],
  'OTROS': ['DIJES', 'ANILLOS', 'TOPOS'],
};
const bolsa = new Map();   // foto -> cantidad
let cupon = null;          // código aplicado, o null
const panel = document.querySelector('.bolsa');
const velo = document.querySelector('.velo');
const listaBolsa = document.querySelector('.bolsa__lista');
const contador = document.querySelector('.contador');
const aviso = document.querySelector('.aviso');

function cargarBolsa() {
  try {
    for (const { foto, cantidad } of JSON.parse(localStorage.getItem(CLAVE_BOLSA) || '[]')) {
      const joya = porFoto.get(foto);
      if (joya && !agotada(joya) && cantidad > 0) bolsa.set(foto, Math.min(cantidad, unidadesDe(joya)));
    }
    const guardado = localStorage.getItem(CLAVE_CUPON);
    if (guardado in CUPONES) cupon = guardado;
  } catch { /* sin almacenamiento: la bolsa empieza vacía */ }
}

function guardarBolsa() {
  try {
    localStorage.setItem(CLAVE_BOLSA, JSON.stringify([...bolsa].map(([foto, cantidad]) => ({ foto, cantidad }))));
    if (cupon) localStorage.setItem(CLAVE_CUPON, cupon); else localStorage.removeItem(CLAVE_CUPON);
  } catch { /* sin almacenamiento: la bolsa dura mientras la página esté abierta */ }
}

const campoCupon = document.getElementById('cupon');
const mensajeCupon = document.querySelector('.cupon__mensaje');

function aplicarCupon(e) {
  e.preventDefault();
  const codigo = campoCupon.value.trim().toUpperCase().replace(/\s+/g, '');
  if (!codigo) return;
  if (codigo in CUPONES) {
    cupon = codigo;
    campoCupon.value = '';
    mensajeCupon.textContent = `¡Listo! Cupón aplicado: ${CUPONES[codigo]}% de descuento.`;
    mensajeCupon.className = 'cupon__mensaje cupon__mensaje--ok';
    cambioBolsa();
  } else {
    mensajeCupon.textContent = 'Ese cupón no es válido. Revisa que esté bien escrito.';
    mensajeCupon.className = 'cupon__mensaje cupon__mensaje--error';
  }
}

function quitarCupon() {
  cupon = null;
  mensajeCupon.textContent = '';
  cambioBolsa();
}

function anadir(joya) {
  bolsa.set(joya.foto, (bolsa.get(joya.foto) || 0) + 1);
  cambioBolsa();
  if (!panel.classList.contains('bolsa--abierta')) mostrarAviso(`${aTitulo(joya.nombre)} se añadió a tu bolsa`);
}

function cambiarCantidad(foto, delta) {
  const nueva = Math.min((bolsa.get(foto) || 0) + delta, unidadesDe(porFoto.get(foto)));
  if (nueva > 0) bolsa.set(foto, nueva); else bolsa.delete(foto);
  cambioBolsa();
}

// La pieza más económica que completa el envío gratis, entre las categorías que combinan.
// Si ninguna alcanza, la que más acerca.
function piezaSugerida(falta, factor) {
  const ultima = porFoto.get([...bolsa.keys()].pop());
  const categorias = COMBINA[ultima.categoria] || [];
  const posibles = catalogo.filter(j => categorias.includes(j.categoria) && !agotada(j) && !bolsa.has(j.foto));
  if (!posibles.length) return null;
  const precioFinal = j => valor(j.precio) * factor;
  const porPrecio = [...posibles].sort((a, b) => precioFinal(a) - precioFinal(b));
  const alcanza = porPrecio.find(j => precioFinal(j) >= falta);
  return { joya: alcanza || porPrecio[porPrecio.length - 1], completa: Boolean(alcanza) };
}

function pintarSugerencia({ joya, completa }) {
  const li = document.createElement('li');
  li.className = 'sugerencia';
  li.innerHTML = `
    <p class="sugerencia__titulo"></p>
    <div class="sugerencia__pieza">
      <img alt="">
      <div>
        <p class="item__nombre"></p>
        <p class="item__detalle"></p>
        <p class="item__precio"></p>
      </div>
      <button class="sugerencia__anadir" type="button">Añadir</button>
    </div>`;
  li.querySelector('.sugerencia__titulo').textContent = completa ? 'Con esta pieza completas tu envío gratis' : 'Combina con tu pedido';
  li.querySelector('img').src = rutaFoto(joya.foto);
  li.querySelector('.item__nombre').textContent = aTitulo(joya.nombre);
  li.querySelector('.item__detalle').textContent = [categoriaDe(joya), joya.detalle && aTitulo(joya.detalle)].filter(Boolean).join(' · ');
  li.querySelector('.item__precio').textContent = joya.precio;
  li.querySelector('.sugerencia__anadir').addEventListener('click', () => anadir(joya));
  listaBolsa.appendChild(li);
}

function cambioBolsa() {
  guardarBolsa();
  pintarBolsa();
  document.querySelectorAll('.joya__anadir').forEach(pintarBotonAnadir);
}

function pintarBolsa() {
  const piezas = [...bolsa.values()].reduce((a, b) => a + b, 0);
  contador.hidden = piezas === 0;
  contador.textContent = piezas;
  panel.classList.toggle('bolsa--vacia', piezas === 0);

  listaBolsa.innerHTML = '';
  let total = 0;
  const lineas = [];
  for (const [foto, cantidad] of bolsa) {
    const joya = porFoto.get(foto);
    const subtotal = valor(joya.precio) * cantidad;
    total += subtotal;
    const nombre = aTitulo(joya.nombre);
    lineas.push(`${lineas.length + 1}. ${nombre} (${categoriaDe(joya)})${joya.detalle ? ' – ' + aTitulo(joya.detalle) : ''} – ${joya.precio}${cantidad > 1 ? ` x${cantidad} = ${pesos(subtotal)}` : ''}`);

    const li = document.createElement('li');
    li.className = 'item';
    li.innerHTML = `
      <img alt="">
      <div class="item__info">
        <p class="item__nombre"></p>
        <p class="item__detalle"></p>
        <div class="item__cantidad">
          <button type="button" data-delta="-1" aria-label="Quitar una">−</button>
          <span></span>
          <button type="button" data-delta="1" aria-label="Añadir una">+</button>
        </div>
      </div>
      <div class="item__lado">
        <p class="item__precio"></p>
        <button class="item__quitar" type="button">Quitar</button>
      </div>`;
    li.querySelector('img').src = rutaFoto(foto);
    li.querySelector('.item__nombre').textContent = nombre;
    li.querySelector('.item__detalle').textContent = [categoriaDe(joya), joya.detalle && aTitulo(joya.detalle)].filter(Boolean).join(' · ');
    li.querySelector('.item__cantidad').hidden = unidadesDe(joya) === 1;
    li.querySelector('.item__cantidad span').textContent = cantidad;
    li.querySelector('[data-delta="1"]').disabled = cantidad >= unidadesDe(joya);
    li.querySelector('.item__precio').textContent = pesos(subtotal);
    li.querySelectorAll('[data-delta]').forEach(b => b.addEventListener('click', () => cambiarCantidad(foto, Number(b.dataset.delta))));
    li.querySelector('.item__quitar').addEventListener('click', () => cambiarCantidad(foto, -cantidad));
    listaBolsa.appendChild(li);
  }

  const porcentaje = cupon ? CUPONES[cupon] : 0;
  const rebaja = Math.round(total * porcentaje / 100);
  const aPagar = total - rebaja;

  document.querySelector('.bolsa__subtotal').textContent = pesos(total);
  document.querySelector('.bolsa__descuento').hidden = !cupon;
  document.querySelector('.bolsa__codigo').textContent = cupon ? `${cupon} (−${porcentaje}%)` : '';
  document.querySelector('.bolsa__rebaja').textContent = '−' + pesos(rebaja);
  document.querySelector('.bolsa__total strong').textContent = pesos(aPagar);

  // Envío gratis: se calcula sobre lo que el cliente paga, ya con el cupón aplicado.
  const falta = Math.max(0, ENVIO_GRATIS_DESDE - aPagar);
  const progreso = Math.min(100, Math.round(aPagar / ENVIO_GRATIS_DESDE * 100));
  document.querySelector('.envio__texto').textContent = falta
    ? `Te faltan ${pesos(falta)} para el envío gratis`
    : 'Tu pedido ya tiene envío gratis';
  document.querySelector('.envio__barra span').style.width = progreso + '%';
  document.querySelector('.envio__barra').setAttribute('aria-valuenow', progreso);
  document.querySelector('.bolsa__envio').textContent = falta ? 'Se confirma por WhatsApp' : 'Gratis';

  if (falta && bolsa.size) {
    const sugerida = piezaSugerida(falta, 1 - porcentaje / 100);
    if (sugerida) pintarSugerencia(sugerida);
  }

  const cuentas = cupon
    ? `Subtotal: ${pesos(total)}\nCupón ${cupon} (−${porcentaje}%): −${pesos(rebaja)}\nTotal: ${pesos(aPagar)}`
    : `Total: ${pesos(total)}`;
  const envio = falta ? 'Envío: por confirmar' : 'Envío: gratis';
  const mensaje = `Hola AUREZZA, quiero hacer este pedido:\n\n${lineas.join('\n')}\n\n${cuentas}\n${envio}\n\nMi ciudad de entrega es: `;
  document.querySelector('.bolsa__enviar').href = enlaceWhatsApp(mensaje);
}

function abrirBolsa() {
  aviso.classList.remove('aviso--visible');
  panel.classList.add('bolsa--abierta');
  panel.setAttribute('aria-hidden', 'false');
  velo.hidden = false;
  document.body.style.overflow = 'hidden';
  document.querySelector('.bolsa__cerrar').focus();
}

function cerrarBolsa() {
  panel.classList.remove('bolsa--abierta');
  panel.setAttribute('aria-hidden', 'true');
  velo.hidden = true;
  document.body.style.overflow = ficha.hidden ? '' : 'hidden';
}

let temporizadorAviso;
function mostrarAviso(texto) {
  aviso.textContent = texto;
  aviso.classList.add('aviso--visible');
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => aviso.classList.remove('aviso--visible'), 2200);
}

document.querySelector('.barra__bolsa').addEventListener('click', abrirBolsa);
document.querySelector('.bolsa__cerrar').addEventListener('click', cerrarBolsa);
velo.addEventListener('click', cerrarBolsa);
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (panel.classList.contains('bolsa--abierta')) cerrarBolsa();
  else if (!ficha.hidden) cerrarFicha();
});
document.querySelector('.bolsa__vaciar').addEventListener('click', () => { bolsa.clear(); cambioBolsa(); });
document.querySelector('.cupon').addEventListener('submit', aplicarCupon);
document.querySelector('.cupon__quitar').addEventListener('click', quitarCupon);

/* ---------- Inicio ---------- */

buscador.addEventListener('input', pintarJoyas);
window.addEventListener('resize', () => { medirBarra(); actualizarFlechas(); });
document.getElementById('anio').textContent = new Date().getFullYear();
medirBarra();
cargarBolsa();
pintarCarrusel();
pintarFiltros();
pintarJoyas();
pintarBolsa();
revisarEnlace();
actualizarFlechas();
document.fonts.ready.then(actualizarFlechas);   // los anchos cambian al cargar las tipografías
