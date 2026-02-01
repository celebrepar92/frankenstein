// ================== Referencias DOM ==================
const safeGet = (id) => document.getElementById(id);

const box = safeGet('imagen3');
const fgPhoto = safeGet('fgPhoto');
const bgBlur = safeGet('bgBlur');
const fitChk = safeGet('fitMode');
const toggleDynamicColor = safeGet('toggleDynamicColor');
const customColorGroup = safeGet('customColorGroup');
const customColorInput = safeGet('customColorInput');
const imagen3El = safeGet('imagen3');
const toggleSubtitle = safeGet('toggleSubtitle');
const subGroup = safeGet('subGroup');
const subInput = safeGet('sub');
const tituloSubEl = safeGet('tituloSub');
const rotuloInput = safeGet('rotulo');
const tituloInput = safeGet('titulo');
const rectEl = safeGet('rectNar2img2');
const tituloEl = safeGet('titulo3');
const toggleDarkMode = safeGet('toggleDarkMode');
const downloadFormatEl = safeGet('downloadFormat');
const defaultModeSelect = safeGet('defaultModeSelect');
const urlMOLInput = safeGet('urlMOL');
const btnImportar = safeGet('btnImportar');
const importLoader = safeGet('importLoader');
const importStatus = safeGet('importStatus');

let lastImageData = null;     
let lastDominantHsl = null;   

// ============ LÓGICA DE IMPORTACIÓN ============

async function importarDesdeMOL() {
    if (!urlMOLInput) return;
    const url = urlMOLInput.value.trim();
    if (!url || !url.includes("misionesonline.net")) {
        alert("Enlace no válido.");
        return;
    }

    if (importLoader) importLoader.style.display = "flex";
    if (importStatus) {
        importStatus.innerText = "Extrayendo información...";
        importStatus.style.display = "block";
    }

    try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const res = await fetch(proxyUrl);
        const data = await res.json();
        const html = data.contents;
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        let titulo = doc.querySelector('meta[property="og:title"]')?.content || doc.querySelector('title')?.innerText;
        let imagenUrl = doc.querySelector('meta[property="og:image"]')?.content;
        let categoria = doc.querySelector('meta[property="article:section"]')?.content;

        if (titulo && tituloInput) tituloInput.value = titulo.split(' - MisionesOnline')[0].trim();
        if (categoria && rotuloInput) rotuloInput.value = categoria.split(',')[0].trim();

        if (toggleSubtitle) {
            toggleSubtitle.checked = false;
            if (subGroup) subGroup.classList.add('d-none');
            if (tituloSubEl) tituloSubEl.style.display = 'none';
        }

        updateTituloRotuloLive();

        if (imagenUrl) {
            safeGet('image_url').value = imagenUrl;
            try {
                const dataURL = await urlToDataURL(imagenUrl);
                applyAll(dataURL);
            } catch (e) { applyAll(imagenUrl); }
        }
        if (importStatus) importStatus.innerText = "✅ Éxito";
    } catch (error) {
        if (importStatus) importStatus.innerText = "❌ Error";
    } finally {
        if (importLoader) importLoader.style.display = "none";
        setTimeout(() => { if (importStatus) importStatus.style.display = "none"; }, 3000);
    }
}

if (btnImportar) btnImportar.addEventListener('click', importarDesdeMOL);

// ============ PROCESAMIENTO DE IMAGEN Y TEXTO ============

async function urlToDataURL(url) {
    const res = await fetch(url); 
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function isHttpUrl(s){ return /^https?:/i.test(s || ''); }

async function applyAll(src) { 
    lastImageData = src;
    if (!fitChk.checked) {
        showFitLayers(false);
        setCoverBackground(src);
        await setBgFromDominant(src); 
        if (bgBlur) bgBlur.style.display = 'none';
    } else {
        clearCoverBackground();
        await setBgFromDominant(src);
        if (fgPhoto) {
            fgPhoto.src = src;
            fgPhoto.onload = () => { fitDrag.offsetTop = 0; applyTop(); };
        }
        showFitLayers(true);
    }
    applyAccentColor();
}

function updateTituloRotuloLive(){
    if (rectEl) rectEl.textContent = (rotuloInput.value || '').trim().toUpperCase() || 'RÓTULO';
    if (tituloEl) tituloEl.innerHTML = processTitleForColor(tituloInput.value);      
    const isSubOn = toggleSubtitle && toggleSubtitle.checked;
    if (tituloSubEl) {
        tituloSubEl.textContent = (subInput.value || '').trim() || 'Tu subtítulo acá';
        tituloSubEl.style.display = isSubOn ? 'block' : 'none';
    }
}

function processTitleForColor(rawText) {
    rawText = (rawText || '').trim();
    if (!rawText) return 'Tu título acá';
    const regex = /\/([^\/]+)\//g;
    let parts = [];
    let lastIndex = 0;
    rawText.replace(regex, (match, capturedText, offset) => {
        let precedingText = rawText.substring(lastIndex, offset);
        parts.push(precedingText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
        parts.push(`<span class="orange-text">${capturedText}</span>`);
        lastIndex = offset + match.length;
    });
    parts.push(rawText.substring(lastIndex).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
    return parts.join('');
}

// ============ ARRASTRE (DRAG) ============
const coverDrag = { active: false, lastX: 0, offsetX: 50 };
box?.addEventListener('mousedown', (e) => {
    if (fitChk.checked) return;
    coverDrag.active = true; coverDrag.lastX = e.clientX;
    box.classList.add('dragging'); e.preventDefault();
});

const fitDrag = { active: false, lastY: 0, offsetTop: 0 };
fgPhoto?.addEventListener('mousedown', (e) => { 
    if(!fitChk.checked) return;
    fitDrag.active = true; fitDrag.lastY = e.clientY; e.preventDefault(); 
});

window.addEventListener('mousemove', (e) => {
    if (coverDrag.active && !fitChk.checked) {
        const dx = e.clientX - coverDrag.lastX;
        coverDrag.lastX = e.clientX;
        coverDrag.offsetX = Math.min(100, Math.max(0, coverDrag.offsetX - (dx / box.clientWidth) * 100));
        box.style.backgroundPosition = `${coverDrag.offsetX}% center`;
    }
    if (fitDrag.active && fitChk.checked) {
        const dy = e.clientY - fitDrag.lastY;
        fitDrag.lastY = e.clientY;
        fitDrag.offsetTop += dy;
        applyTop();
    }
});

window.addEventListener('mouseup', () => {
    coverDrag.active = false; fitDrag.active = false;
    if (box) box.classList.remove('dragging');
});

function applyTop() {
    if (!fitChk.checked || !fgPhoto || !box) return;
    const boxH = box.clientHeight;
    const imgW = fgPhoto.naturalWidth;
    const imgH = fgPhoto.naturalHeight;
    const renderedH = (box.clientWidth / imgW) * imgH;
    const maxTop = Math.max(0, boxH - renderedH);
    fitDrag.offsetTop = Math.min(maxTop, Math.max(0, fitDrag.offsetTop));
    fgPhoto.style.top = fitDrag.offsetTop + 'px';
}

// ============ LISTENERS UI ============

rotuloInput?.addEventListener('input', updateTituloRotuloLive);
tituloInput?.addEventListener('input', updateTituloRotuloLive);
subInput?.addEventListener('input', updateTituloRotuloLive);
toggleSubtitle?.addEventListener('change', () => {
    if (subGroup) subGroup.classList.toggle('d-none', !toggleSubtitle.checked);
    updateTituloRotuloLive();
});

function debounce(fn, ms=400){
    let t; return (...args) => { clearTimeout(t); t = setTimeout(()=>fn(...args), ms); };
}

safeGet('image_url')?.addEventListener('input', debounce(async (e) => {
    const url = e.target.value.trim();
    if (!url) return;
    if (safeGet('image_file')) safeGet('image_file').value = '';
    try { const dataURL = await urlToDataURL(url); applyAll(dataURL); } catch (e) { applyAll(url); }
}, 500));

safeGet('image_file')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (safeGet('image_url')) safeGet('image_url').value = '';
    const reader = new FileReader();
    reader.onload = ev => applyAll(ev.target.result);
    reader.readAsDataURL(file);
});

fitChk?.addEventListener('change', () => { if (lastImageData) applyAll(lastImageData); });

// ============ MODOS Y COLORES ============

function applyAccentColor() {
    let color = customColorInput.value;
    const isDynamic = toggleDynamicColor.checked;
    
    // CORRECCIÓN: Mostrar grupo manual SIEMPRE que NO sea dinámico
    if (customColorGroup) {
        customColorGroup.classList.toggle('d-none', isDynamic);
    }

    if (isDynamic && lastDominantHsl) {
        color = `hsl(${Math.round(lastDominantHsl.h*360)}, 80%, 50%)`;
    }
    if (box) box.style.setProperty('--accent-color', color);
}

toggleDynamicColor?.addEventListener('change', applyAccentColor);
customColorInput?.addEventListener('input', applyAccentColor);

function applyInitialMode() {
    const savedMode = localStorage.getItem('defaultMode') || 'dark';
    if (defaultModeSelect) defaultModeSelect.value = savedMode;
    if (toggleDarkMode) toggleDarkMode.checked = (savedMode === 'dark');
    document.body.classList.toggle('light-mode', savedMode !== 'dark'); 
}

toggleDarkMode?.addEventListener('change', () => {
    document.body.classList.toggle('light-mode', !toggleDarkMode.checked);
});

defaultModeSelect?.addEventListener('change', (e) => {
    localStorage.setItem('defaultMode', e.target.value);
    applyInitialMode();
});

// ============ DESCARGA E INICIO ============
safeGet('downloadButton')?.addEventListener('click', async function () {
    const format = downloadFormatEl.value;
    const mime = downloadFormatEl.options[downloadFormatEl.selectedIndex].dataset.mime;
    try {
        const canvas = await html2canvas(box, { useCORS: true, scale: 2, backgroundColor: (format === 'png' && !lastImageData) ? null : '#000' });
        canvas.toBlob(blob => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `portada-mol.${format}`;
            link.click();
        }, mime, 0.95);
    } catch (e) { alert('Error al exportar.'); }
});

window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const autoUrl = urlParams.get('url');
    if (autoUrl && urlMOLInput) {
        urlMOLInput.value = decodeURIComponent(autoUrl);
        setTimeout(importarDesdeMOL, 600);
    }
});

function setCoverBackground(url) {
    if (!box) return;
    box.style.backgroundImage = `url(${url})`;
    box.style.backgroundSize = 'cover';
    box.style.backgroundPosition = coverDrag.offsetX + '% center';
}

function clearCoverBackground() { if (box) box.style.backgroundImage = 'none'; }
function showFitLayers(show) {
    if (fgPhoto) fgPhoto.style.display = show ? 'block' : 'none';
    if (bgBlur) bgBlur.style.display  = show ? 'block' : 'none';
}

async function setBgFromDominant(src){
    try {
        const img = new Image();
        if (isHttpUrl(src)) img.crossOrigin = 'anonymous';
        img.src = src;
        await new Promise(res => img.onload = res);
        const canvas = document.createElement('canvas');
        const s = 40; canvas.width = s; canvas.height = s;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, s, s);
        const data = ctx.getImageData(0, 0, s, s).data;
        let r=0, g=0, b=0, count=0;
        for (let i=0; i<data.length; i+=4) { if (data[i+3] < 10) continue; r+=data[i]; g+=data[i+1]; b+=data[i+2]; count++; }
        const hsl = rgbToHsl(r/count, g/count, b/count);
        lastDominantHsl = hsl;
        if (bgBlur) bgBlur.style.background = `linear-gradient(180deg, hsl(${hsl.h*360},${hsl.s*100}%,${hsl.l*100-15}%) 0%, hsl(${hsl.h*360},${hsl.s*100}%,${hsl.l*100}%) 60%, hsl(${hsl.h*360},${hsl.s*100}%,${hsl.l*100+10}%) 100%)`;
    } catch(e) { if (bgBlur) bgBlur.style.background = "#222"; }
}

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    let h, s, l = (max + min) / 2;
    if (max === min) h = s = 0;
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

applyInitialMode();
updateTituloRotuloLive();
applyAccentColor();