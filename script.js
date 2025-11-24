// ================== Estado global ==================
let lastImageData = null;     // dataURL o URL de la imagen cargada
let lastDominantHsl = null;   // Nuevo: HSL dominante de la última imagen cargada
const box     = document.getElementById('imagen3');
const fgPhoto = document.getElementById('fgPhoto');
const bgBlur  = document.getElementById('bgBlur');
const fitChk  = document.getElementById('fitMode');
// NUEVOS CONTROLES DE COLOR:
const toggleDynamicColor = document.getElementById('toggleDynamicColor');
const customColorGroup   = document.getElementById('customColorGroup');
const customColorInput   = document.getElementById('customColorInput');
const imagen3El          = document.getElementById('imagen3'); // Referencia para setear variables CSS
// ... (resto de referencias)
const toggleSubtitle = document.getElementById('toggleSubtitle');
const subGroup       = document.getElementById('subGroup');
const subInput       = document.getElementById('sub');
const tituloSubEl    = document.getElementById('tituloSub');
// NUEVO: refs para rotulo/titulo y sus espejos
// === LIVE: rótulo/título en tiempo real ===
const rotuloInput = document.getElementById('rotulo');
const tituloInput = document.getElementById('titulo');
const rectEl      = document.getElementById('rectNar2img2');
const tituloEl    = document.getElementById('titulo3');

// NUEVO: Refs para Modo Oscuro y Descarga
const toggleDarkMode   = document.getElementById('toggleDarkMode');
const downloadFormatEl = document.getElementById('downloadFormat');


// Convierte una URL remota a dataURL (evita CORS al exportar)
async function urlToDataURL(url) {
  const res = await fetch(url, { mode: 'cors' }); // intenta CORS
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const blob = await res.blob();
  // Blob -> dataURL
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function isHttpUrl(s){ return /^https?:/i.test(s || ''); }
function isDataUrl(s){ return /^data:/i.test(s || ''); }

// En mbm-o2/script.js (Añadir al inicio)

// Referencia al nuevo selector de modo predeterminado
const defaultModeSelect = document.getElementById('defaultModeSelect');

// ============ PERSISTENCIA DE MODO (NUEVO) ============

function loadDefaultMode() {
    // Carga la preferencia guardada, por defecto es 'dark'
    return localStorage.getItem('defaultMode') || 'dark';
}

function saveDefaultMode(mode) {
    localStorage.setItem('defaultMode', mode);
    // Vuelve a aplicar el modo por si es necesario
    applyInitialMode();
}

function applyInitialMode() {
    const savedMode = loadDefaultMode();
    
    // 1. Sincronizar el selector con la preferencia guardada
    if (defaultModeSelect) {
        defaultModeSelect.value = savedMode;
    }

    // 2. Aplicar el modo al interruptor y al body
    const isDarkModeDefault = savedMode === 'dark';

    // Establece el estado del interruptor. Si el modo guardado es 'light', el interruptor NO debe estar checked.
    toggleDarkMode.checked = isDarkModeDefault;

    // Aplica la clase light-mode al body según el estado inicial
    document.body.classList.toggle('light-mode', !isDarkModeDefault); 
}

// Listener para guardar la preferencia del usuario
if (defaultModeSelect) {
    defaultModeSelect.addEventListener('change', (e) => {
        saveDefaultMode(e.target.value);
    });
}

// Llamar a applyInitialMode justo después de definir toggleDarkModeHandler.

// ... (después de definir toggleDarkModeHandler en script.js) ...

toggleDarkMode.addEventListener('change', toggleDarkModeHandler);

// Llamada Inicial:
applyInitialMode(); // <-- REEMPLAZA la llamada anterior a toggleDarkModeHandler()
applyAccentColor();

async function applyAll(src) { 
  lastImageData = src; // puede ser dataURL o URL (si CORS bloquea)

  if (!fitChk.checked) {
    showFitLayers(false);
    setCoverBackground(src);
    // Llamar a computeDominantColor para el color dinámico, incluso en modo COVER
    await setBgFromDominant(src); 
    bgBlur.style.display = 'none'; // Asegurar que el fondo borroso no se muestre en modo COVER
  } else {
    clearCoverBackground();
    await setBgFromDominant(src);
    fgPhoto.src = src;
    fgPhoto.onload = () => { fitDrag.offsetTop = 0; applyTop(); };
    showFitLayers(true);
  }
  
  // APLICAR EL COLOR DE ACENTO después de la potencial actualización de lastDominantHsl
  applyAccentColor();

  // Subtítulo (respeta el checkbox)
  if (toggleSubtitle.checked) {
    let sub = (subInput.value || '').trim();
    if (!sub) sub = 'Tu subtítulo acá';
    tituloSubEl.textContent = sub;
    tituloSubEl.style.display = 'block';
  } else {
    tituloSubEl.style.display = 'none';
  }
}

function safeText(v, fallback){ v = (v || '').trim(); return v ? v : fallback; }

/**
 * Procesa el texto del título, envolviendo el texto entre /barras/ en un span naranja.
 * Además, escapa el HTML del resto del texto por seguridad.
 * @param {string} rawText El texto crudo del input del título.
 * @returns {string} El HTML procesado para innerHTML.
 */
function processTitleForColor(rawText) {
  rawText = (rawText || '').trim();
  if (!rawText) return 'Tu título acá'; // Texto de respaldo

  const regex = /\/([^\/]+)\//g; // Busca /.../ capturando el contenido
  let parts = [];
  let lastIndex = 0;

  // 1. Iterar sobre todas las coincidencias y almacenar las partes
  rawText.replace(regex, (match, capturedText, offset) => {
    // Escapar y guardar el texto que precede al match
    let precedingText = rawText.substring(lastIndex, offset);
    parts.push(precedingText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));

    // Escapar y guardar el texto de color envuelto en el <span>
    let escapedContent = capturedText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    parts.push(`<span class="orange-text">${escapedContent}</span>`);
    
    lastIndex = offset + match.length;
    return match;
  });

  // 2. Escapar y guardar el texto restante
  let remainingText = rawText.substring(lastIndex);
  parts.push(remainingText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));

  // 3. Unir todas las partes en una sola cadena HTML
  return parts.join('');
}


function updateTituloRotuloLive(){
  rectEl.textContent   = safeText(rotuloInput.value, 'RÓTULO');        // default (usa textContent)
  // ¡CAMBIO CLAVE! Usamos innerHTML con el procesamiento del color
  tituloEl.innerHTML   = processTitleForColor(tituloInput.value);      
}

// Listeners (actualiza mientras escribís / pegás)
rotuloInput.addEventListener('input',  updateTituloRotuloLive);
tituloInput.addEventListener('input',  updateTituloRotuloLive);
// Opcional: por si hay autocompletado móvil o cambio sin teclear
rotuloInput.addEventListener('change', updateTituloRotuloLive);
tituloInput.addEventListener('change', updateTituloRotuloLive);

// Init al cargar
updateTituloRotuloLive();


toggleSubtitle.addEventListener('change', () => {
  const on = toggleSubtitle.checked;

  // mostrar/ocultar el input debajo del checkbox
  subGroup.classList.toggle('d-none', !on);

  // mostrar/ocultar el H3 ya mismo (con default si está vacío)
  if (on) {
    const val = (subInput.value || '').trim() || 'Tu subtítulo acá';
    tituloSubEl.textContent = val;
    tituloSubEl.style.display = 'block';
  } else {
    tituloSubEl.style.display = 'none';
  }

  // 🚫 No tocar fitChk ni las capas de imagen acá.
});


function syncSubtitleUIInitial(){
  const on = toggleSubtitle.checked;

  // mostrar/ocultar el input debajo del checkbox
  subGroup.classList.toggle('d-none', !on);

  // mostrar/ocultar el H3 (con default si no hay texto)
  const val = (subInput.value || '').trim() || 'Tu subtítulo acá';
  tituloSubEl.textContent = val;
  tituloSubEl.style.display = on ? 'block' : 'none';
}

// Llamada única de sincronización al final del script:
syncSubtitleUIInitial();


// reflejar en vivo mientras se escribe
subInput.addEventListener('input', () => {
  if (!toggleSubtitle.checked) return;
  const val = (subInput.value || '').trim();
  tituloSubEl.textContent = val || 'Tu subtítulo acá';
});


// ============ Utilidades =============
function setCoverBackground(url) {
  box.style.backgroundImage    = `url(${url})`;
  box.style.backgroundSize     = 'cover';
  box.style.backgroundRepeat   = 'no-repeat';
  box.style.backgroundPosition = '50% center';
}

function clearCoverBackground() {
  box.style.backgroundImage = 'none';
}

function setBlurBg(url) {
  bgBlur.style.backgroundImage = `url(${url})`;
}

function showFitLayers(show) {
  fgPhoto.style.display = show ? 'block' : 'none';
  bgBlur.style.display  = show ? 'block' : 'none';
}

// ============ Carga / Preview (Botón deshabilitado, pero se mantiene la lógica en vivo) ============
/*
// Este botón fue deshabilitado en el HTML:
document.getElementById('previewButton').addEventListener('click', async function () {
  const imageUrl  = document.getElementById('image_url').value.trim();
  const imageFile = document.getElementById('image_file').files[0];

  updateTituloRotuloLive(); 

  if (imageFile) {
    const reader = new FileReader();
    reader.onload = e => applyAll(e.target.result); // data: ✔
    reader.readAsDataURL(imageFile);
  } else if (imageUrl) {
    try {
      const dataURL = await urlToDataURL(imageUrl);  // ← acá usamos await
      applyAll(dataURL);
    } catch (err) {
      console.warn('CORS bloqueó la conversión a dataURL:', err);
      applyAll(imageUrl); // se verá en preview, pero puede no exportar
      alert('Esa URL no permite exportar por CORS. Subí el archivo o usá una URL con CORS habilitado.');
    }
  }
});
*/

function debounce(fn, ms=400){
  let t; 
  return (...args) => { clearTimeout(t); t = setTimeout(()=>fn(...args), ms); };
}

const urlInput  = document.getElementById('image_url');
const fileInput = document.getElementById('image_file');

// Preview en vivo se mantiene
urlInput.addEventListener('input', debounce(async () => {
  const url = urlInput.value.trim();
  if (!url) return;

  // Al usar URL, limpiamos el archivo para evitar solapamiento
  if (fileInput.value) fileInput.value = '';

  try {
    const dataURL = await urlToDataURL(url); // intenta CORS
    applyAll(dataURL);                       // previsualiza YA
  } catch (err) {
    console.warn('CORS bloqueó la conversión a dataURL:', err);
    // Mostramos igual para preview inmediata (puede no exportar):
    applyAll(url);
  }
}, 500)); 

fileInput.addEventListener('change', () => {
  const file = fileInput.files && fileInput.files[0];
  if (!file) return;

  // Al subir archivo, limpiamos la URL para evitar solapamiento
  if (urlInput.value) urlInput.value = '';

  const reader = new FileReader();
  reader.onload = e => applyAll(e.target.result); // data:
  reader.readAsDataURL(file);
});

// ============ Descargar (normaliza a dataURL antes de capturar) ============
document.getElementById('downloadButton').addEventListener('click', async function () {
  const node = document.getElementById('imagen3');

  // 1) Si la imagen actual es por URL http(s), convertimos a dataURL
  if (lastImageData && isHttpUrl(lastImageData)) {
    try {
      const dataURL = await urlToDataURL(lastImageData);   // ← puede fallar por CORS
      lastImageData = dataURL;

      // reinyectamos la dataURL al DOM según el modo activo
      if (!fitChk.checked) {
        setCoverBackground(dataURL);                       // background-image: data:
      } else {
        fgPhoto.src = dataURL;
        await new Promise(res => {
          if (fgPhoto.complete) return res();
          fgPhoto.onload = res; fgPhoto.onerror = res;
        });
      }
    } catch (e) {
      alert('Esa URL no permite ser exportada por CORS. Subí el archivo o usá una URL con CORS habilitado.');
      return; // cancelamos para no exportar una imagen sin fondo
    }
  }

  // Determinar formato y MIME type
  const selectedOption = downloadFormatEl.options[downloadFormatEl.selectedIndex];
  const format = selectedOption.value; // jpg, png, webp
  const mimeType = selectedOption.getAttribute('data-mime'); // image/jpeg, image/png, etc.
  
  // Calidad (solo afecta a JPEG y WebP)
  const quality = (format === 'png') ? 1.0 : 0.95; 

  // 2) Capturamos (ahora todo es same-origin: data:)
  try {
    const canvas = await html2canvas(node, {
      useCORS: true,
      allowTaint: false,
      backgroundColor: (format === 'png' && !lastImageData) ? null : '#fff',
      scale: 2,
      scrollX: 0,
      scrollY: 0
    });

    // Esta llamada toBlob es única y descarga un solo archivo.
    canvas.toBlob(function (blob) {
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `imagen-1080x1350.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }, mimeType, quality); // <-- Usar MIME type y calidad dinámicos

  } catch (e) {
    console.error(e);
    alert('No se pudo exportar.');
  }
});


// ============ Arrastre HORIZONTAL (solo para COVER) ============
(function setupHorizontalDrag() {
  const drag = { active: false, lastX: 0, offsetX: 50 }; // 0..100

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function applyPosition() {
    // Solo si NO está en modo FIT
    if (!fitChk.checked) box.style.backgroundPosition = drag.offsetX + '% center';
  }

  box.addEventListener('mousedown', (e) => {
    if (fitChk.checked) return; // deshabilitado en FIT
    drag.active = true;
    drag.lastX = e.clientX;
    box.classList.add('dragging');
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!drag.active || fitChk.checked) return;
    const dx = e.clientX - drag.lastX;
    drag.lastX = e.clientX;
    const deltaPct = (dx / box.clientWidth) * 100;
    drag.offsetX = clamp(drag.offsetX - deltaPct, 0, 100); // ← signo invertido
    applyPosition();
  });
  window.addEventListener('mouseup', () => {
    drag.active = false;
    box.classList.remove('dragging');
  });

  // Recentrar al previsualizar si estás en COVER (no hace falta si el botón está disabled)
  // document.getElementById('previewButton').addEventListener('click', () => {
  //   if (!fitChk.checked) {
  //     drag.offsetX = 50;
  //     applyPosition();
  //   }
  // });

  // Si el usuario tilda/destilda el checkbox, no hacemos nada acá:
  // el propio handler de "change" alternará capas.
})();

// ============ Arrastre VERTICAL (solo para FIT) ============
const fitDrag = { active: false, lastY: 0, offsetTop: 0 };

function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
function applyTop() {
  // Solo si estamos en FIT
  if (!fitChk.checked) return;
  // Calcular límites para que la imagen no “salga” del canvas
  const boxH = box.clientHeight;
  const imgW = fgPhoto.naturalWidth;
  const imgH = fgPhoto.naturalHeight;
  if (!imgW || !imgH) return;

  // Altura resultante al escalar a width:100%
  const renderedH = (box.clientWidth / imgW) * imgH;

  // Queremos que arranque arriba (top=0) y permita mover hacia abajo
  // hasta que el borde inferior de la imagen toque el borde inferior del canvas.
  const minTop = 0;
  const maxTop = Math.max(0, boxH - renderedH); // si img es más chica, hay “espacio extra” abajo
  fitDrag.offsetTop = clamp(fitDrag.offsetTop, minTop, maxTop);
  fgPhoto.style.top = fitDrag.offsetTop + 'px';
}

function startFitDrag(y) {
  if (!fitChk.checked) return;
  fitDrag.active = true;
  fitDrag.lastY = y;
  fgPhoto.classList.add('dragging');
}

function moveFitDrag(y) {
  if (!fitDrag.active || !fitChk.checked) return;
  const dy = y - fitDrag.lastY;
  fitDrag.lastY = y;
  fitDrag.offsetTop += dy;
  applyTop();
}

function endFitDrag() {
  fitDrag.active = false;
  fgPhoto.classList.remove('dragging');
}

// Mouse
fgPhoto.addEventListener('mousedown', (e) => { startFitDrag(e.clientY); e.preventDefault(); });
window.addEventListener('mousemove', (e) => moveFitDrag(e.clientY));
window.addEventListener('mouseup', endFitDrag);

// Touch
fgPhoto.addEventListener('touchstart', (e) => { startFitDrag(e.touches[0].clientY); }, { passive: false });
window.addEventListener('touchmove', (e) => { moveFitDrag(e.touches[0].clientY); e.preventDefault(); }, { passive: false });
window.addEventListener('touchend', endFitDrag);

// ============ Alternar modos con el checkbox ============
fitChk.addEventListener('change', async () => {
  if (fitChk.checked) {
    if (lastImageData) {
      clearCoverBackground();
      await setBgFromDominant(lastImageData);
      fgPhoto.src = lastImageData;
      fgPhoto.onload = () => { fitDrag.offsetTop = 0; applyTop(); };
      showFitLayers(true);
    }
  } else {
    if (lastImageData) {
      showFitLayers(false);
      setCoverBackground(lastImageData);
    }
    // el subtítulo NO se oculta automáticamente; eso lo maneja toggleSubtitle
  }
});

function hslToCss(h, s, l) {
  return `hsl(${Math.round(h*360)}, ${Math.round(s*100)}%, ${Math.round(l*100)}%)`;
}

function shadeHsl({h, s, l}, deltaL) {
  // deltaL en puntos de 0..1 (p.ej. -0.1 oscurece 10%)
  const nl = Math.max(0, Math.min(1, l + deltaL));
  return { h, s, l: nl };
}

function clamp(v, a, b){ return Math.min(b, Math.max(a, v)); }

// ---- Promedio rápido de color (predominante aproximado) ----
// ---- Utilidades de color (igual que antes) ----
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > .5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h, s, l };
}
function hslToCss({h,s,l}) { return `hsl(${Math.round(h*360)}, ${Math.round(s*100)}%, ${Math.round(l*100)}%)`; }
function shadeHsl({h,s,l}, dL) { return { h, s, l: Math.max(0, Math.min(1, l + dL)) }; }

/**
 * Convierte HSL a HEX (necesario para la verificación de contraste)
 * @param {{h: number, s: number, l: number}} hsl El color HSL (0-1)
 * @returns {string} El color en formato HEX.
 */
function HSLToHex({ h, s, l }) {
    h *= 360; // h en 0-360
    s *= 100; // s en 0-100%
    l *= 100; // l en 0-100%

    s /= 100;
    l /= 100;
    let c = (1 - Math.abs(2 * l - 1)) * s,
        x = c * (1 - Math.abs((h / 60) % 2 - 1)),
        m = l - c / 2,
        r = 0, g = 0, b = 0;

    if (0 <= h && h < 60) {
        r = c; g = x; b = 0;
    } else if (60 <= h && h < 120) {
        r = x; g = c; b = 0;
    } else if (120 <= h && h < 180) {
        r = 0; g = c; b = x;
    } else if (180 <= h && h < 240) {
        r = 0; g = x; b = c;
    } else if (240 <= h && h < 300) {
        r = x; g = 0; b = c;
    } else if (300 <= h && h < 360) {
        r = c; g = 0; b = x;
    }
    r = Math.round((r + m) * 255).toString(16);
    g = Math.round((g + m) * 255).toString(16);
    b = Math.round((b + m) * 255).toString(16);

    if (r.length == 1) r = "0" + r;
    if (g.length == 1) g = "0" + g;
    if (b.length == 1) b = "0" + b;

    return "#" + r + g + b;
}


/**
 * Convierte un color HSL a un HSL más vibrante para el acento.
 * Aumenta la saturación y ajusta la luminosidad a un valor medio.
 * @param {{h: number, s: number, l: number}} hsl El color HSL predominante.
 * @returns {{h: number, s: number, l: number}} El color HSL vibrante.
 */
function getVibrantHsl({ h, s, l }) {
    // 1. Aumentar la saturación (al menos 70%)
    const vibrantS = Math.min(1, Math.max(0.7, s * 1.1));
    
    // 2. Ajustar luminosidad hacia un rango medio (30% a 70%) para vibración
    let vibrantL = (l * 0.4) + (0.5 * 0.6); // Mover L hacia 0.5
    vibrantL = clamp(vibrantL, 0.3, 0.7); 
    
    return { h, s: vibrantS, l: vibrantL };
}

/**
 * Determina el color del texto (white o black) para el rótulo basado en el color de fondo.
 * PRIORIDAD: Blanco. Solo cambia a negro si es muy claro.
 * @param {string} hexColor El color de fondo (HEX).
 * @returns {string} 'white' o 'black'.
 */
function getContrastColor(hexColor) {
    // 1. Convertir HEX a RGB
    const r = parseInt(hexColor.substring(1, 3), 16);
    const g = parseInt(hexColor.substring(3, 5), 16);
    const b = parseInt(hexColor.substring(5, 7), 16);

    // 2. Calcular la luminancia (para la percepción humana)
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; 

    // 3. Umbral. Usamos 0.65 para priorizar 'white' (solo cambia si es REALMENTE claro).
    const threshold = 0.65; 

    return luminance > threshold ? 'black' : 'white';
}

// ---- NUEVO: muestreo robusto (data:, blob:, http(s): con CORS) ----
async function computeDominantColor(src) {
  const isHttp  = /^https?:/i.test(src);
  const isData  = /^data:/i.test(src);
  const isBlob  = /^blob:/i.test(src);

  // 1) Cargamos imagen de forma segura y garantizamos decode()
  const img = new Image();
  if (isHttp) {
    // SOLO en http(s) pedimos CORS. Para data:/blob: NO lo seteamos.
    img.crossOrigin = 'anonymous';
  }
  const loaded = new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });
  img.src = src;
  try {
    await loaded;
    if (img.decode) { try { await img.decode(); } catch(e){} } // mayor robustez
  } catch (e) {
    // No se pudo cargar la imagen
    return 'linear-gradient(180deg, #222 0%, #2a2a2a 60%, #333 100%)';
  }

  // 2) Dibujamos reducido y leemos píxeles
  try {
    // Si es http(s) sin CORS correcto, getImageData lanzará SecurityError
    const s = 48; // muestreo 48x48
    const c = document.createElement('canvas');
    c.width = s; c.height = s;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, s, s);
    const { data } = ctx.getImageData(0, 0, s, s);

    let r=0, g=0, b=0, count=0;
    for (let i=0; i<data.length; i+=4) {
      const a = data[i+3];
      if (a < 8) continue;
      r += data[i];
      g += data[i+1];
      b += data[i+2];
      count++;
    }
    if (!count) {
      // totalmente transparente o fallo raro
      return 'linear-gradient(180deg, #222 0%, #2a2a2a 60%, #333 100%)';
    }

    r = Math.round(r/count); g = Math.round(g/count); b = Math.round(b/count);
    const hsl  = rgbToHsl(r,g,b);
    lastDominantHsl = hsl; // <-- Guardar HSL globalmente

    const dark = hslToCss(shadeHsl(hsl, -0.12));
    const base = hslToCss(hsl);
    const lite = hslToCss(shadeHsl(hsl, +0.08));
    return `linear-gradient(180deg, ${dark} 0%, ${base} 60%, ${lite} 100%)`;
  } catch (e) {
    // SecurityError (CORS) u otro -> fallback
    lastDominantHsl = null; // <-- Limpiar HSL en caso de fallo
    return 'linear-gradient(180deg, #222 0%, #2a2a2a 60%, #333 100%)';
  }
}

async function setBgFromDominant(src){
  const fill = await computeDominantColor(src);
  bgBlur.style.background = fill;   // <- capturable por html2canvas
}

/**
 * Gestiona el color de acento (dinámico/manual/defecto) y actualiza las variables CSS.
 */
function applyAccentColor() {
  const dynamicOn = toggleDynamicColor.checked;
  const customColorVal = customColorInput.value;
  let finalColorHex = '#FF7A00'; // Default: Naranja

  // 1. Determinar el color final (Dinámico, Manual o Defecto)
  if (dynamicOn) {
    customColorGroup.classList.add('d-none'); // Ocultar input manual

    if (lastDominantHsl) {
        // Generar color vibrante y convertir a HEX
        const vibrantHsl = getVibrantHsl(lastDominantHsl);
        finalColorHex = HSLToHex(vibrantHsl);
    } 
  } else if (customColorVal !== '#FF7A00') {
    // 2. Color Manual
    customColorGroup.classList.remove('d-none'); // Mostrar input manual
    finalColorHex = customColorVal;
  } else {
    // 3. Naranja por defecto
    customColorGroup.classList.add('d-none'); // Ocultar input manual
    finalColorHex = '#FF7A00'; 
  }

  // 4. Aplicar los colores vía variables CSS
  const textColor = getContrastColor(finalColorHex);
  
  imagen3El.style.setProperty('--accent-color', finalColorHex);
  imagen3El.style.setProperty('--label-text-color', textColor);
}

// ============ Listeners para Color Dinámico / Manual ============

// Toggle Dynamic Color
toggleDynamicColor.addEventListener('change', () => {
    // Resetear custom color a default si se activa el dinámico
    if (toggleDynamicColor.checked) {
        customColorInput.value = '#FF7A00'; 
    }
    applyAccentColor(); 
});

// Custom Color Input (uso 'input' para reacción en tiempo real)
customColorInput.addEventListener('input', () => {
    // Desactivar dinámico si se cambia el color manual
    if (toggleDynamicColor.checked) {
        toggleDynamicColor.checked = false;
    }
    customColorGroup.classList.remove('d-none'); // Asegurar que se muestre
    applyAccentColor();
});

// ============ Listeners para Modo Oscuro (ACTUALIZADO) ============
function toggleDarkModeHandler() {
    // Si está checked (true): Modo Oscuro (quita la clase light-mode)
    // Si NO está checked (false): Modo Claro (añade la clase light-mode)
    const darkModeActive = toggleDarkMode.checked;
    document.body.classList.toggle('light-mode', !darkModeActive); 
}

toggleDarkMode.addEventListener('change', toggleDarkModeHandler);

// Llamada Inicial:
toggleDarkModeHandler(); // Mantiene el estado inicial

// ============ Llamada Inicial ============
// Ejecutar al inicio para configurar los colores por defecto.
applyAccentColor();