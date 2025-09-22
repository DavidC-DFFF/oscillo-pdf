// ========= Réglages de base =========
const DIV_X = 10, DIV_Y = 8;
const CENTER_TWEAK_PX = -2;

// Calage horizontal : 50 Hz @ 2 ms/div ≈ 10 div (20 ms)
const TIME_SCALE_CORR = 1.039;

// Échelles disponibles
const VDIV_STEPS = [5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01, 0.005, 0.002, 0.001];
const TDIV_STEPS = [0.5, 0.2, 0.1, 0.05, 0.02, 0.01, 0.005, 0.002, 0.001, 0.0005, 0.0002, 0.0001];

// Indices init
let vIndex = VDIV_STEPS.indexOf(1);
let tIndex = TDIV_STEPS.indexOf(0.002);

// Canvas
const cvs = document.getElementById('trace');
const ctx = cvs.getContext('2d');

// UI entraînement (menu type & tolérance supprimés, pas de bouton Générer)
const ui = {
    answers: document.getElementById('answers'),
    btnValidate: document.getElementById('btnValidate'),
    feedback: document.getElementById('feedback'),
    solution: document.getElementById('solution'),
    diffGroup: document.getElementById('diffGroup')
};

let currentDifficulty = 'easy';
ui.diffGroup?.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg[data-level]');
    if (!btn) return;
    currentDifficulty = btn.dataset.level;        // 'easy' | 'medium' | 'hard'
    [...ui.diffGroup.querySelectorAll('.seg')].forEach(b => b.classList.toggle('active', b === btn));
    generateExercise(); // génère directement
});

// Centres (en divisions)
let yCenterDiv = DIV_Y / 2; // vertical
let xCenterDiv = DIV_X / 2; // horizontal

// ========= État interne du signal =========
const state = {
    wave: 'sine',
    duty: 0.5,
    amp: 2,         // Um (V)
    offset: 0,      // Ucc (V)
    freq: 50        // Hz
};

// ====== Couplage AC/DC ======
let acCoupling = false; // false = DC (par défaut) ; true = AC (supprime la composante continue)
function showCouplingStatus() {
    if (!ui.feedback) return;
    ui.feedback.textContent = acCoupling ? 'Couplage AC' : 'Couplage DC';
    ui.feedback.className = 'feedback';
}

// ========= Helpers =========
function readNum(inputEl, fallback = 0) {
    const raw = String(inputEl?.value ?? '');
    const n = inputEl && Number.isFinite(inputEl.valueAsNumber)
        ? inputEl.valueAsNumber
        : parseFloat(raw.replace(',', '.'));
    return Number.isFinite(n) ? n : fallback;
}
function resizeCanvasToCSS() {
    const rect = cvs.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return false;
    const dpr = window.devicePixelRatio || 1;
    cvs.width = Math.round(rect.width * dpr);
    cvs.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randIn(min, max) { return min + Math.random() * (max - min); }
function roundToStep(x, step) { return Math.round(x / step) * step; }

// Génère les points du signal courant
function generateSamples(vPerDiv, sPerDiv) {
    const w = Math.max(2, cvs.getBoundingClientRect().width);
    const secTotal = sPerDiv * DIV_X * TIME_SCALE_CORR;

    const f = Math.max(0.000001, state.freq);
    const A = Math.abs(state.amp);
    const DC = state.offset;

    const stepT = secTotal / (w - 1);
    const tOffset = xCenterDiv * sPerDiv;

    const pts = [];
    for (let x = 0; x < w; x++) {
        const t = (x * stepT) - tOffset;
        let y = A * Math.sin(2 * Math.PI * f * t);
        y += (acCoupling ? 0 : DC);
        pts.push({ x, y });
    }
    return { pts, vPerDiv, DC };
}

function draw() {
    if (!resizeCanvasToCSS()) return;

    const rect = cvs.getBoundingClientRect();
    const W = rect.width, H = rect.height;

    const vPerDiv = VDIV_STEPS[vIndex];
    const sPerDiv = TDIV_STEPS[tIndex];

    const { pts, DC } = generateSamples(vPerDiv, sPerDiv);

    const pxPerDivY = H / DIV_Y;
    const centerY = yCenterDiv * pxPerDivY + CENTER_TWEAK_PX;
    const pxPerVolt = pxPerDivY / vPerDiv;

    ctx.clearRect(0, 0, W, H);

    // Ligne DC (seulement en mode DC et si offset ≠ 0)
    if (!acCoupling && Math.abs(DC) > 1e-6) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#d11';
        ctx.beginPath();
        const yDC = centerY - DC * pxPerVolt;
        ctx.moveTo(0, yDC); ctx.lineTo(W, yDC);
        ctx.stroke();
    }

    // Trace
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#0a7d2c';
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const x = p.x;
        const y = centerY - p.y * pxPerVolt;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
}

// Formattage SI compact pour noms de fichiers
function fmtSI(val, kind) { // kind: 'Hz' ou 'V'
    const a = Math.abs(val);
    let unit = kind, scale = 1;
    if (kind === 'Hz') {
        if (a >= 1e6) { unit = 'MHz'; scale = 1e6; }
        else if (a >= 1e3) { unit = 'kHz'; scale = 1e3; }
        else { unit = 'Hz'; scale = 1; }
    } else if (kind === 'V') {
        if (a < 1e-3) { unit = 'uV'; scale = 1e-6; }   // ASCII: uV (pas µ)
        else if (a < 1) { unit = 'mV'; scale = 1e-3; }
        else { unit = 'V'; scale = 1; }
    }
    const n = val / scale;
    // arrondi propre et suppression des zéros inutiles
    const s = (Math.round(n * 1000) / 1000).toString()
        .replace(/\.0+$/, '')
        .replace(/(\.\d*[1-9])0+$/, '$1');
    return s + unit;
}

function exportFileNameFromState() {
    // 'sine' | 'square' | 'triangle' (par défaut 'sine')
    const wave = (state.wave || 'sine').toLowerCase();
    const fStr = fmtSI(state.freq, 'Hz');
    const umStr = fmtSI(Math.abs(state.amp), 'V');   // Umax = Um (crête)
    const uccStr = fmtSI(state.offset, 'V');
    return `${wave}_f-${fStr}_Umax-${umStr}_Ucc-${uccStr}.png`;
}


// ========= Knobs (V/div & s/div) =========
const MIN_ANGLE = 0, MAX_ANGLE = 330;
function stepAngle(list, idx) { return MIN_ANGLE + (MAX_ANGLE - MIN_ANGLE) * (idx / (list.length - 1)); }
function setNeedle(needle, list, idx) { needle.style.transform = `translate(-50%,-100%) rotate(${stepAngle(list, idx)}deg)`; }
function polarAngleCWdeg(x, y) { let a = Math.atan2(y, x) * 180 / Math.PI; return (a + 450) % 360; }
function angleFromEvent(e, el) {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const ex = (e.touches ? e.touches[0].clientX : e.clientX) - cx;
    const ey = (e.touches ? e.touches[0].clientY : e.clientY) - cy;
    return Math.max(MIN_ANGLE, Math.min(MAX_ANGLE, polarAngleCWdeg(ex, ey)));
}
function idxFromAngle(ang, list) {
    const ratio = (ang - MIN_ANGLE) / (MAX_ANGLE - MIN_ANGLE);
    return Math.max(0, Math.min(list.length - 1, Math.round(ratio * (list.length - 1))));
}

const vNeedle = document.getElementById('vNeedle');
const tNeedle = document.getElementById('tNeedle');
const vLabel = document.getElementById('vdivVal');
const tLabel = document.getElementById('tdivVal');

function fmtV(v) { return v >= 1 ? `${v} V/div` : (v >= 1e-3 ? `${v * 1e3} mV/div` : `${v * 1e6} µV/div`); }
function fmtT(s) {
    if (s >= 1) return `${s} s/div`;
    if (s >= 1e-3) return `${s * 1e3} ms/div`;
    return `${s * 1e6} µs/div`;
}

function setScale(vIdx, tIdx) {
    vIndex = vIdx; tIndex = tIdx;
    setNeedle(vNeedle, VDIV_STEPS, vIndex);
    setNeedle(tNeedle, TDIV_STEPS, tIndex);
    vLabel.textContent = fmtV(VDIV_STEPS[vIndex]);
    tLabel.textContent = fmtT(TDIV_STEPS[tIndex]);
    yCenterDiv = DIV_Y / 2; xCenterDiv = DIV_X / 2;
    draw();
}

function attachKnobDrag(el, list, getIdx, setIdx, labelEl, fmt, needleEl) {
    let dragging = false;
    function applyIndex(i) {
        const idx = Math.max(0, Math.min(list.length - 1, i));
        if (idx !== getIdx()) {
            setIdx(idx);
            if (labelEl) labelEl.textContent = fmt(list[idx]);
            setNeedle(needleEl, list, idx);
            draw();
        }
    }
    function onDown(e) { dragging = true; e.preventDefault(); onMove(e); }
    function onMove(e) { if (!dragging) return; e.preventDefault(); const ang = angleFromEvent(e, el); applyIndex(idxFromAngle(ang, list)); }
    function onUp() { dragging = false; }

    el.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    el.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);

    if (labelEl) labelEl.textContent = fmt(list[getIdx()]);
    setNeedle(needleEl, list, getIdx());
}
attachKnobDrag(document.getElementById('knobV'), VDIV_STEPS, () => vIndex, (i) => { vIndex = i; }, vLabel, fmtV, vNeedle);
attachKnobDrag(document.getElementById('knobT'), TDIV_STEPS, () => tIndex, (i) => { tIndex = i; }, tLabel, fmtT, tNeedle);

// ========= Décalage horizontal (bouton bas) =========
(function () {
    const h = document.getElementById('hShift');
    if (!h) return;
    let dragging = false, startX = 0, startCenter = DIV_X / 2;
    function onDown(e) { dragging = true; startX = (e.touches ? e.touches[0].clientX : e.clientX); startCenter = xCenterDiv; e.preventDefault(); }
    function onMove(e) {
        if (!dragging) return;
        const rect = cvs.getBoundingClientRect();
        const pxPerDivX = rect.width / DIV_X;
        const clientX = (e.touches ? e.touches[0].clientX : e.clientX);
        const dx = clientX - startX;
        const deltaDiv = dx / pxPerDivX;
        xCenterDiv = Math.max(0, Math.min(DIV_X, startCenter + deltaDiv));
        draw(); e.preventDefault();
    }
    function onUp() { dragging = false; }
    h.addEventListener('dblclick', () => { xCenterDiv = DIV_X / 2; draw(); });
    h.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    h.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
})();

// ========= Génération conforme aux difficultés =========

// Choix “divisions entières” (Easy)
const EASY_KV = [1, 2, 3];                    // Um = 1,2,3 divisions
const EASY_KH = [2, 4, 5, 10];                 // T = 2,4,5,10 divisions
function pickQuint(minDiv, maxDiv) {         // multiples de 0.2 div (Medium/Hard)
    return roundToStep(minDiv + Math.random() * (maxDiv - minDiv), 0.2);
}

// ====== Construction des champs de réponse avec unités ======
const UNIT_SETS = {
    volt: [{ v: 'V', k: 1 }, { v: 'mV', k: 1e-3 }, { v: 'uV', k: 1e-6 }],
    time: [{ v: 's', k: 1 }, { v: 'ms', k: 1e-3 }, { v: 'us', k: 1e-6 }],
    freq: [{ v: 'Hz', k: 1 }, { v: 'kHz', k: 1e3 }, { v: 'MHz', k: 1e6 }]
};
const LABELS = {
    um: 'Um (amplitude crête)',
    upp: 'Upp (crête à crête)',
    ucc: 'Ucc (composante continue)',
    t: 'Période T',
    f: 'Fréquence f'
};
function buildAnswerField(key, unitSet, placeholder) {
    const block = document.createElement('div');
    block.className = 'answer-block';
    const lab = document.createElement('label');
    lab.textContent = LABELS[key];
    const row = document.createElement('div');
    row.className = 'answer-row';

    const inp = document.createElement('input');
    inp.id = 'ans_' + key; inp.type = 'number'; inp.step = '0.001'; inp.placeholder = placeholder;

    const sel = document.createElement('select');
    sel.id = 'unit_' + key;
    unitSet.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.v;
        opt.textContent = (u.v === 'uV' ? 'µV' : u.v);
        sel.appendChild(opt);
    });

    row.appendChild(inp);
    row.appendChild(sel);
    block.appendChild(lab);
    block.appendChild(row);
    ui.answers.appendChild(block);
}
function buildAnswerFieldsFor(metrics) {
    ui.answers.innerHTML = '';
    metrics.forEach(key => {
        if (['um', 'upp', 'ucc'].includes(key)) buildAnswerField(key, UNIT_SETS.volt, 'ex: 2');
        if (key === 't') buildAnswerField(key, UNIT_SETS.time, 'ex: 0.02');
        if (key === 'f') buildAnswerField(key, UNIT_SETS.freq, 'ex: 50');
    });
}
function readAnswerWithUnit(key) {
    const val = readNum(document.getElementById('ans_' + key), NaN);
    const unit = document.getElementById('unit_' + key)?.value || '';
    const unitMap = { V: 1, mV: 1e-3, uV: 1e-6, s: 1, ms: 1e-3, us: 1e-6, Hz: 1, kHz: 1e3, MHz: 1e6 };
    const k = unitMap[unit] ?? 1;
    return val * k; // converti en unité SI (V, s, Hz)
}

// Échelle + génération
function makeExercise(difficulty) {
    // échelle aléatoire mais raisonnable
    const vIdx = Math.floor(Math.random() * Math.min(6, VDIV_STEPS.length)); // 5→0.1 V/div
    const tIdx = Math.floor(Math.random() * Math.min(8, TDIV_STEPS.length)); // 0.02→0.002 s/div
    setScale(vIdx, tIdx);
    const vPerDiv = VDIV_STEPS[vIndex];
    const sPerDiv = TDIV_STEPS[tIndex];

    // Grandeurs demandées
    let askedMetrics = [];
    if (difficulty === 'easy') askedMetrics = [pick(['um', 'ucc', 't'])];
    else if (difficulty === 'medium') askedMetrics = [pick(['um', 'ucc', 't', 'f'])];
    else askedMetrics = ['um', 'upp', 'ucc', 't', 'f']; // Hard : toutes
    buildAnswerFieldsFor(askedMetrics);

    // Choix divisions
    let Um_div, Ucc_div, T_div;
    if (difficulty === 'easy') {
        Um_div = pick(EASY_KV);
        T_div = pick(EASY_KH);
        const maxOff = Math.max(0, 3.6 - Um_div);
        const offChoices = [];
        for (let k = -Math.floor(maxOff); k <= Math.floor(maxOff); k++) offChoices.push(k);
        Ucc_div = pick(offChoices);
    } else {
        Um_div = pickQuint(0.4, 3.6);
        const maxOff = Math.max(0, 3.6 - Um_div);
        Ucc_div = roundToStep(randIn(-maxOff, maxOff), 0.2);
        T_div = pickQuint(2.0, 8.0);
    }

    // Conversion unités physiques
    const A = Um_div * vPerDiv;          // Um (V)
    const Ucc = Ucc_div * vPerDiv;          // Ucc (V)
    const T = T_div * sPerDiv;          // T (s)
    const f = 1 / T;

    // Applique au signal
    state.wave = 'sine';
    state.amp = A;
    state.offset = Ucc;
    state.freq = f;

    draw();

    return {
        askedMetrics,
        trueUm: A,
        trueUpp: 2 * A,
        trueUcc: Ucc,
        truePer: T,
        trueFreq: f
    };
}

let currentExercise = null;

// ========= Générer / Valider =========
function generateExercise() {
    currentExercise = makeExercise(currentDifficulty);
    ui.btnValidate.disabled = false;
    ui.solution.textContent = '';
    // affiche le couplage dès le départ (feedback non bloquant, remplacé à la validation)
    showCouplingStatus();
}

// tolérance fixée à 5 %
const TOL_PCT = 5;

function withinTol(val, ref, tolPct) {
    if (!(Math.abs(ref) > 0)) return Math.abs(val - ref) < 1e-9;
    return Math.abs(val - ref) <= (Math.abs(ref) * (tolPct / 100));
}

function validateExercise() {
    if (!currentExercise) return;
    const tol = TOL_PCT;

    let ok = true;
    const messages = [];

    const checkOne = (key, ref, label, unit, decimals) => {
        const v = readAnswerWithUnit(key);
        const isOk = Number.isFinite(v) && withinTol(v, ref, tol);
        ok = ok && !!isOk;
        messages.push(isOk ? `${label} ✅`
            : `${label} ❌ (attendu ≈ ${ref.toFixed(decimals)} ${unit})`);
    };

    // Corrige SEULEMENT les grandeurs demandées
    for (const key of currentExercise.askedMetrics) {
        if (key === 'um') checkOne('um', currentExercise.trueUm, 'Um', 'V', 3);
        if (key === 'upp') checkOne('upp', currentExercise.trueUpp, 'Upp', 'V', 3);
        if (key === 'ucc') checkOne('ucc', currentExercise.trueUcc, 'Ucc', 'V', 3);
        if (key === 't') checkOne('t', currentExercise.truePer, 'Période T', 's', 6);
        if (key === 'f') checkOne('f', currentExercise.trueFreq, 'f', 'Hz', 3);
    }

    ui.feedback.textContent = messages.join(' • ');
    ui.feedback.className = 'feedback ' + (ok ? 'ok' : 'ko');

    // Correction affichée = seulement la/les grandeur(s) demandée(s)
    const parts = [];
    for (const key of currentExercise.askedMetrics) {
        if (key === 'um') parts.push(`Um = ${currentExercise.trueUm.toFixed(3)} V`);
        if (key === 'upp') parts.push(`Upp = ${currentExercise.trueUpp.toFixed(3)} V`);
        if (key === 'ucc') parts.push(`Ucc = ${currentExercise.trueUcc.toFixed(3)} V`);
        if (key === 't') parts.push(`Période T = ${currentExercise.truePer.toFixed(6)} s`);
        if (key === 'f') parts.push(`f = ${currentExercise.trueFreq.toFixed(3)} Hz`);
    }
    ui.solution.textContent = parts.join(' • ');
}

// ========= Init / listeners =========
const bg = document.getElementById('bg');
const ro = new ResizeObserver(() => draw());

function init() {
    ro.observe(document.getElementById('scope'));
    ro.observe(cvs);
    requestAnimationFrame(() => { draw(); setTimeout(draw, 80); });
    // génère un premier exercice par défaut (Easy)
    generateExercise();
}
if (bg.complete) init(); else bg.addEventListener('load', init, { once: true });

window.addEventListener('resize', draw);

// Pan vertical à la molette + recentrage clic droit
cvs.addEventListener('wheel', (e) => {
    e.preventDefault();
    const deltaDiv = (e.deltaY > 0 ? 0.2 : -0.2);
    yCenterDiv = Math.max(0, Math.min(DIV_Y, yCenterDiv + deltaDiv));
    draw();
}, { passive: false });
cvs.addEventListener('contextmenu', (e) => { e.preventDefault(); yCenterDiv = DIV_Y / 2; draw(); });

// Bouton Valider
ui.btnValidate.addEventListener('click', validateExercise);

// ========= Hotspot AC sur l'image =========
const AC_BTN_X = 12.9;   // % depuis la gauche (ajuste si besoin)
const AC_BTN_Y = 91.6;   // % depuis le haut   (ajuste si besoin)
const AC_BTN_R = 2.2;    // rayon (%)          (ajuste si besoin)

document.getElementById('scope').addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const xPct = ((e.clientX - r.left) / r.width) * 100;
    const yPct = ((e.clientY - r.top) / r.height) * 100;

    const dx = xPct - AC_BTN_X, dy = yPct - AC_BTN_Y;
    const dist = Math.hypot(dx, dy);
    if (dist <= AC_BTN_R) {
        acCoupling = !acCoupling;
        draw();
        showCouplingStatus();
        e.stopPropagation();
        return;
    }
    // console.log(`--left: ${xPct.toFixed(1)}%;  --top: ${yPct.toFixed(1)}%;`);
});

// Raccourci clavier "A" pour basculer AC/DC (ignoré pendant la saisie)
window.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (e.key.toLowerCase() === 'a') {
        acCoupling = !acCoupling;
        draw();
        showCouplingStatus();
    }
});

// Afficher l’état de couplage dès le chargement
showCouplingStatus();

// ======== Export PNG (fond + trace + aiguilles) ========
function exportFullPNG() {
    const bg = document.getElementById('bg');
    const out = document.createElement('canvas');
    out.width = bg.naturalWidth;
    out.height = bg.naturalHeight;
    const octx = out.getContext('2d');

    // 1) Fond
    octx.drawImage(bg, 0, 0, out.width, out.height);

    // 2) Zone écran (vars CSS -> px export)
    const css = getComputedStyle(document.documentElement);
    const leftPct = parseFloat(css.getPropertyValue('--screen-left'));
    const topPct = parseFloat(css.getPropertyValue('--screen-top'));
    const wPct = parseFloat(css.getPropertyValue('--screen-width'));
    const hPct = parseFloat(css.getPropertyValue('--screen-height'));

    const sx = Math.round(out.width * leftPct / 100);
    const sy = Math.round(out.height * topPct / 100);
    const sW = Math.round(out.width * wPct / 100);
    const sH = Math.round(out.height * hPct / 100);

    // 3) Trace
    const trace = document.getElementById('trace');
    octx.drawImage(trace, 0, 0, trace.width, trace.height, sx, sy, sW, sH);

    // 4) Aiguilles des knobs (DOM -> canvas)
    const bgRect = bg.getBoundingClientRect();
    const kVRect = document.getElementById('knobV').getBoundingClientRect();
    const kTRect = document.getElementById('knobT').getBoundingClientRect();
    const scaleX = out.width / bgRect.width;
    const scaleY = out.height / bgRect.height;
    const scaleA = (scaleX + scaleY) / 2;

    function drawNeedleFromRect(r, angleDeg) {
        const cx = ((r.left - bgRect.left) + r.width / 2) * scaleX;
        const cy = ((r.top - bgRect.top) + r.height / 2) * scaleY;
        const len = Math.min(r.width * scaleX, r.height * scaleY) * 0.45;
        const th = angleDeg * Math.PI / 180;
        const x2 = cx + Math.sin(th) * len;
        const y2 = cy - Math.cos(th) * len;

        octx.lineCap = 'round';
        // liseré clair
        octx.lineWidth = 6 * scaleA;
        octx.strokeStyle = 'rgba(255,255,255,0.85)';
        octx.beginPath(); octx.moveTo(cx, cy); octx.lineTo(x2, y2); octx.stroke();
        // trait noir
        octx.lineWidth = 4 * scaleA;
        octx.strokeStyle = '#111';
        octx.beginPath(); octx.moveTo(cx, cy); octx.lineTo(x2, y2); octx.stroke();
        // pastille centrale
        const capR = 0.09 * Math.min(r.width * scaleX, r.height * scaleY);
        octx.fillStyle = '#e9e7df';
        octx.strokeStyle = 'rgba(0,0,0,0.25)';
        octx.lineWidth = 1 * scaleA;
        octx.beginPath(); octx.arc(cx, cy, capR, 0, Math.PI * 2); octx.fill(); octx.stroke();
    }

    // mêmes angles que l’affichage DOM
    const angV = (MIN_ANGLE + (MAX_ANGLE - MIN_ANGLE) * (vIndex / (VDIV_STEPS.length - 1)));
    const angT = (MIN_ANGLE + (MAX_ANGLE - MIN_ANGLE) * (tIndex / (TDIV_STEPS.length - 1)));
    drawNeedleFromRect(kVRect, angV);
    drawNeedleFromRect(kTRect, angT);

    // 5) Télécharger
    const a = document.createElement('a');
    a.href = out.toDataURL('image/png');
    a.download = exportFileNameFromState();
    document.body.appendChild(a); a.click(); a.remove();
}

// Bouton Export
document.getElementById('btnExport')?.addEventListener('click', exportFullPNG);

// --- Export : masqué par défaut + commandes console ---
(function () {
    const btn = document.getElementById('btnExport');
    if (!btn) return;

    // Masqué par défaut
    btn.style.display = 'none';

    // Commandes dispo dans la console
    window.showExport = function (on = true) {
        btn.style.display = on ? '' : 'none';
    };
    window.toggleExport = function () {
        window.showExport(btn.style.display === 'none');
    };

    // Astuce : ?export=1 ou #export pour l'afficher au chargement
    const qs = new URLSearchParams(location.search);
    if (qs.get('export') === '1' || location.hash.includes('export')) {
        window.showExport(true);
    }
})();

