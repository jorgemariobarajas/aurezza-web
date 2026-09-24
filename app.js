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

// Carrusel en movimiento: las tarjetas van dos veces seguidas para que el recorrido
// de derecha a izquierda no tenga cortes. La segunda copia es solo visual.
function pintarCarrusel() {
  pista.innerHTML = '';
  const recorrido = document.createElement('div');
  recorrido.className = 'carrusel__recorrido';
  for (const copia of [false, true]) {
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
      b.querySelector('.categoria__nombre').textContent = cat.nombre;
      b.querySelector('.categoria__total').textContent = cat.total ? `${cat.total} ${cat.total === 1 ? 'pieza' : 'piezas'}` : 'Próximamente';
      if (copia) { b.tabIndex = -1; b.setAttribute('aria-hidden', 'true'); }
      b.addEventListener('click', () => seleccionar(cat.clave));
      recorrido.appendChild(b);
    }
  }
  pista.appendChild(recorrido);
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
    <div class="joya__marco"><img loading="lazy" alt=""></div>
    <p class="joya__categoria"></p>
    <h3 class="joya__nombre"></h3>
    ${joya.detalle ? '<p class="joya__detalle"></p>' : ''}
    <p class="joya__precio"></p>
    <button class="joya__anadir" type="button"></button>`;
  const img = art.querySelector('img');
  img.src = rutaFoto(joya.foto);
  img.alt = `${nombre}, ${categoriaDe(joya)}`;
  art.querySelector('.joya__categoria').textContent = categoriaDe(joya);
  art.querySelector('.joya__nombre').textContent = nombre;
  if (joya.detalle) art.querySelector('.joya__detalle').textContent = aTitulo(joya.detalle);
  art.querySelector('.joya__precio').textContent = joya.precio;
  const boton = art.querySelector('.joya__anadir');
  boton.dataset.foto = joya.foto;
  boton.addEventListener('click', () => bolsa.has(joya.foto) ? abrirBolsa() : anadir(joya));
  pintarBotonAnadir(boton);
  return art;
}

function pintarBotonAnadir(boton) {
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

/* ---------- Bolsa ---------- */

const CLAVE_BOLSA = 'aurezza-bolsa';
const CLAVE_CUPON = 'aurezza-cupon';
// Cupones válidos: código -> porcentaje de descuento.
const CUPONES = { AUREZZASOYYO: 10 };
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
      if (porFoto.has(foto) && cantidad > 0) bolsa.set(foto, cantidad);
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
  mostrarAviso(`${aTitulo(joya.nombre)} se añadió a tu bolsa`);
}

function cambiarCantidad(foto, delta) {
  const nueva = (bolsa.get(foto) || 0) + delta;
  if (nueva > 0) bolsa.set(foto, nueva); else bolsa.delete(foto);
  cambioBolsa();
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
    li.querySelector('.item__cantidad span').textContent = cantidad;
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

  const cuentas = cupon
    ? `Subtotal: ${pesos(total)}\nCupón ${cupon} (−${porcentaje}%): −${pesos(rebaja)}\nTotal: ${pesos(aPagar)}`
    : `Total: ${pesos(total)}`;
  const mensaje = `Hola AUREZZA, quiero hacer este pedido:\n\n${lineas.join('\n')}\n\n${cuentas}`;
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
  document.body.style.overflow = '';
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
document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarBolsa(); });
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
actualizarFlechas();
document.fonts.ready.then(actualizarFlechas);   // los anchos cambian al cargar las tipografías
