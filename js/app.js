import { SIZE, TYPE, PRESET, sizeType, buildEmptyConfig } from './schema.js';
import { ARCH_PRESET, HANDLING_STYLES, applyStealthMode, cloneAssistPreset } from './presets.js';
import { validateSize, suggestSize, clampAssistToPhysics } from './validator.js';
import { applyNominals, getNominals, RCS_RATIO, computeHullRadius } from './nominals.js';

const SPRITE_ALPHA_THRESHOLD = 12;

const state = {
  ship: buildEmptyConfig(),
  statusLog: [],
  ui: { showJson: false }
};

const SECTION_SETS = {
  geometry: ['geometry.length_m', 'geometry.width_m', 'geometry.height_m', 'mass.dry_t'],
  signatures: ['signatures.IR', 'signatures.EM', 'signatures.CS'],
  performance: [
    'performance.accel_fwd_mps2',
    'performance.strafe_mps2.x',
    'performance.strafe_mps2.y',
    'performance.strafe_mps2.z',
    'performance.angular_dps.pitch',
    'performance.angular_dps.yaw',
    'performance.angular_dps.roll'
  ],
  propulsion: ['propulsion.main_thrust_MN', 'propulsion.rcs_budget_MN'],
  payload: ['payload.cargo_scu', 'payload.crew', 'weapons.summary'],
  hardpoints: ['hardpoints_opt.fixed', 'hardpoints_opt.gimbals', 'hardpoints_opt.turrets', 'hardpoints_opt.missiles', 'notes_opt']
};

const RECOMMEND_FIELDS = buildRecommendFields();

function buildRecommendFields() {
  return [
    { path: 'geometry.length_m', label: 'Длина, м', numeric: true, tolerance: 0.12, decimals: 1 },
    { path: 'geometry.width_m', label: 'Ширина, м', numeric: true, tolerance: 0.12, decimals: 1 },
    { path: 'geometry.height_m', label: 'Высота, м', numeric: true, tolerance: 0.15, decimals: 1 },
    { path: 'geometry.hull_radius_m', label: 'Радиус корпуса', numeric: true, tolerance: 0.1, decimals: 2 },
    { path: 'mass.dry_t', label: 'Масса, т', numeric: true, tolerance: 0.18, decimals: 1 },
    { path: 'signatures.IR', label: 'IR', numeric: true, tolerance: 0.34, decimals: 0 },
    { path: 'signatures.EM', label: 'EM', numeric: true, tolerance: 0.34, decimals: 0 },
    { path: 'signatures.CS', label: 'CS', numeric: true, tolerance: 0.34, decimals: 0 },
    { path: 'performance.accel_fwd_mps2', label: 'Accel fwd', numeric: true, tolerance: 0.2, decimals: 1 },
    { path: 'performance.strafe_mps2.x', label: 'Strafe X', numeric: true, tolerance: 0.25, decimals: 1 },
    { path: 'performance.strafe_mps2.y', label: 'Strafe Y', numeric: true, tolerance: 0.25, decimals: 1 },
    { path: 'performance.strafe_mps2.z', label: 'Strafe Z', numeric: true, tolerance: 0.25, decimals: 1 },
    { path: 'performance.angular_dps.pitch', label: 'Pitch DPS', numeric: true, tolerance: 0.25, decimals: 1 },
    { path: 'performance.angular_dps.yaw', label: 'Yaw DPS', numeric: true, tolerance: 0.25, decimals: 1 },
    { path: 'performance.angular_dps.roll', label: 'Roll DPS', numeric: true, tolerance: 0.25, decimals: 1 },
    { path: 'propulsion.main_thrust_MN', label: 'Главная тяга', numeric: true, tolerance: 0.2, decimals: 2 },
    { path: 'propulsion.rcs_budget_MN', label: 'RCS бюджет', numeric: true, tolerance: 0.2, decimals: 2 },
    { path: 'payload.cargo_scu', label: 'Груз, SCU', numeric: true, tolerance: 0.25, decimals: 0 },
    { path: 'payload.crew', label: 'Экипаж', numeric: false },
    { path: 'weapons.summary', label: 'Вооружение', numeric: false }
  ];
}

const dom = {};
const bindings = [];
const textBindings = [];
let recommendationCache = [];
let integrityIssues = [];
let spriteScanSource = null;
let infoPopoverTarget = null;

init();

function init() {
  cacheDom();
  initSelectOptions();
  registerBindings();
  registerTextBindings();
  bindButtons();
  bindInfoButtons();
  ensureShipShapeInPlace();
  renderAll();
  logStatus('Редактор готов', 'info');
}

function cacheDom() {
  Object.assign(dom, {
    sizeSelect: document.getElementById('sizeSelect'),
    typeSelect: document.getElementById('typeSelect'),
    stealthSelect: document.getElementById('stealthSelect'),
    assistPreset: document.getElementById('assistPreset'),
    assistStyle: document.getElementById('assistStyle'),
    sizeTypeChip: document.getElementById('sizeTypeChip'),
    envelopeChip: document.getElementById('envelopeChip'),
    presetChip: document.getElementById('presetChip'),
    suggestedPreset: document.getElementById('suggestedPreset'),
    spritePreview: document.getElementById('spritePreview'),
    spriteInfo: document.getElementById('spriteInfo'),
    spriteInput: document.getElementById('spriteInput'),
    clearSprite: document.getElementById('clearSprite'),
    spriteDetachBtn: document.getElementById('spriteDetachBtn'),
    spriteScanBtn: document.getElementById('spriteScanBtn'),
    autoBtn: document.getElementById('autoBtn'),
    recommendBtn: document.getElementById('recommendBtn'),
    nominalBtn: document.getElementById('nominalBtn'),
    resetBtn: document.getElementById('resetBtn'),
    autoSizeBtn: document.getElementById('autoSizeBtn'),
    applyPresetBtn: document.getElementById('applyPresetBtn'),
    geometryAutoBtn: document.getElementById('geometryAutoBtn'),
    geometryRecommendBtn: document.getElementById('geometryRecommendBtn'),
    massAutoBtn: document.getElementById('massAutoBtn'),
    signaturesRecommendBtn: document.getElementById('signaturesRecommendBtn'),
    performanceAutoBtn: document.getElementById('performanceAutoBtn'),
    autoPropulsionBtn: document.getElementById('autoPropulsionBtn'),
    propulsionRecommendBtn: document.getElementById('propulsionRecommendBtn'),
    payloadRecommendBtn: document.getElementById('payloadRecommendBtn'),
    assistAutoBtn: document.getElementById('assistAutoBtn'),
    inertiaAutoBtn: document.getElementById('inertiaAutoBtn'),
    hardpointsRecommendBtn: document.getElementById('hardpointsRecommendBtn'),
    recommendationsList: document.getElementById('recommendationsList'),
    applyAllRecommendations: document.getElementById('applyAllRecommendations'),
    refreshRecommendations: document.getElementById('refreshRecommendations'),
    integritySummary: document.getElementById('integritySummary'),
    statusLog: document.getElementById('statusLog'),
    importFile: document.getElementById('importFile'),
    importBtn: document.getElementById('importBtn'),
    exportBtn: document.getElementById('exportBtn'),
    copyJson: document.getElementById('copyJson'),
    toggleJson: document.getElementById('toggleJson'),
    jsonPanel: document.getElementById('jsonPanel'),
    recommendationsCard: document.getElementById('recommendationsList'),
    out: document.getElementById('out'),
    infoPopover: document.getElementById('infoPopover'),
    infoText: document.getElementById('infoText'),
    infoClose: document.getElementById('infoClose')
  });
}

function initSelectOptions() {
  SIZE.forEach(size => dom.sizeSelect.add(new Option(size, size)));
  TYPE.forEach(type => dom.typeSelect.add(new Option(type, type)));
  PRESET.forEach(preset => dom.assistPreset?.add(new Option(preset, preset)));
  HANDLING_STYLES.forEach(style => dom.assistStyle?.add(new Option(style, style)));
}

function registerBindings() {
  const elements = document.querySelectorAll('[data-bind]');
  elements.forEach(el => {
    const path = el.dataset.bind;
    const format = el.dataset.format || inferFormat(el);
    const isInput = el.matches('input,textarea,select');
    const binding = { el, path, format, isInput };
    bindings.push(binding);
    if (isInput) {
      const event = el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(event, () => {
        const value = readValue(el, format);
        setPath(state.ship, path, value);
        handlePostChange(path);
        renderAll();
      });
    }
  });
}

function registerTextBindings() {
  document.querySelectorAll('[data-text]').forEach(el => {
    textBindings.push({ el, path: el.dataset.text });
  });
}

function bindButtons() {
  dom.autoBtn?.addEventListener('click', () => runAutoDerive());
  dom.recommendBtn?.addEventListener('click', () => renderAll({ focusRecommendations: true }));
  dom.nominalBtn?.addEventListener('click', () => applyNominalFill());
  dom.resetBtn?.addEventListener('click', () => resetShip());
  dom.autoSizeBtn?.addEventListener('click', () => applySuggestedSize());
  dom.applyPresetBtn?.addEventListener('click', () => applySuggestedPreset());
  dom.geometryAutoBtn?.addEventListener('click', () => autoHullRadius());
  dom.massAutoBtn?.addEventListener('click', () => autoMassFromGeometry());
  dom.geometryRecommendBtn?.addEventListener('click', () => recommendSection('geometry'));
  dom.signaturesRecommendBtn?.addEventListener('click', () => recommendSection('signatures'));
  dom.performanceAutoBtn?.addEventListener('click', () => autoPerformanceFromTemplate());
  dom.autoPropulsionBtn?.addEventListener('click', () => {
    const changes = autoPropulsion();
    if (!changes.length) {
      logStatus('Auto тяга: ничего не изменено', 'info');
    }
  });
  dom.propulsionRecommendBtn?.addEventListener('click', () => recommendSection('propulsion'));
  dom.payloadRecommendBtn?.addEventListener('click', () => recommendSection('payload'));
  dom.assistAutoBtn?.addEventListener('click', () => autoAssistFromTemplate());
  dom.inertiaAutoBtn?.addEventListener('click', () => autoInertiaAndPower());
  dom.hardpointsRecommendBtn?.addEventListener('click', () => recommendSection('hardpoints'));
  dom.spriteScanBtn?.addEventListener('click', () => scanSpriteForGeometry());
  dom.spriteDetachBtn?.addEventListener('click', () => detachSpriteData());
  dom.spriteInput?.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (file) loadSprite(file);
  });
  dom.clearSprite?.addEventListener('click', () => {
    if (state.ship.media?.sprite?.dataUrl || state.ship.media?.sprite?.path) {
      state.ship.media.sprite = { name: "", dataUrl: "", path: "", width: null, height: null };
      spriteScanSource = null;
      renderAll();
      logStatus('Спрайт очищен', 'info');
    }
  });
  dom.applyAllRecommendations?.addEventListener('click', () => applyAllRecommendations());
  dom.refreshRecommendations?.addEventListener('click', () => renderAll({ focusRecommendations: true }));
  dom.recommendationsList?.addEventListener('click', e => {
    const btn = e.target.closest('[data-apply-recommend]');
    if (!btn) return;
    const idx = Number(btn.dataset.index);
    applyRecommendation(idx);
  });
  dom.importBtn?.addEventListener('click', () => importConfig());
  dom.exportBtn?.addEventListener('click', () => exportConfig());
  dom.copyJson?.addEventListener('click', () => copyJson());
  dom.toggleJson?.addEventListener('click', () => {
    state.ui.showJson = !state.ui.showJson;
    updateJsonPanel();
  });
}

function bindInfoButtons() {
  const buttons = document.querySelectorAll('.info-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      toggleInfoPopover(btn, btn.dataset.info || '');
    });
  });
  dom.infoClose?.addEventListener('click', e => {
    e.preventDefault();
    hideInfoPopover();
  });
  document.addEventListener('click', e => {
    if (dom.infoPopover && !dom.infoPopover.contains(e.target)) {
      hideInfoPopover();
    }
  });
  window.addEventListener('resize', () => hideInfoPopover());
  document.addEventListener('scroll', () => hideInfoPopover(), true);
}

function handlePostChange(path) {
  if (path.startsWith('classification.')) {
    syncClassification();
  }
  if (path === 'geometry.length_m' || path === 'geometry.width_m') {
    if (!(state.ship.geometry?.hull_radius_m > 0)) {
      autoHullRadius(false);
    }
  }
  if (path.startsWith('media.')) return;
}

function renderAll(options = {}) {
  ensureShipShapeInPlace();
  rememberSpriteSource();
  ensureHullRadiusValue();
  syncClassification();
  syncBindings();
  syncTextBindings();
  updateChips();
  updateSpritePreview();
  renderOutput();
  updateJsonPanel();
  rebuildRecommendations();
  renderIntegrity();
  if (options.focusRecommendations) {
    dom.recommendationsList.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function syncClassification() {
  const cls = state.ship.classification;
  if (!cls.size) cls.size = 'small';
  if (!cls.type) cls.type = 'fighter';
  if (cls.type === 'recon') cls.stealth = 'stealth';
  cls.size_type = sizeType(cls.size, cls.type);
}

function syncBindings() {
  bindings.forEach(({ el, path, format, isInput }) => {
    if (isInput && document.activeElement === el) return;
    const value = getPath(state.ship, path);
    setElementValue(el, value, format);
  });
}

function syncTextBindings() {
  textBindings.forEach(({ el, path }) => {
    const value = getPath(state.ship, path);
    el.textContent = value ?? '';
  });
}

function updateChips() {
  dom.sizeTypeChip.textContent = state.ship.classification.size_type;
  updatePresetChip();
  updateEnvelopeChip();
  dom.suggestedPreset.textContent = getSuggestedPreset();
}

function updatePresetChip() {
  const recommended = getSuggestedPreset();
  const current = state.ship.assist?.preset || 'custom';
  dom.presetChip.textContent = `Preset: ${current}${current === recommended ? '' : ` · rec ${recommended}`}`;
  dom.presetChip.className = `chip ${current === recommended ? 'chip--ok' : 'chip--warn'}`;
}

function updateEnvelopeChip() {
  const status = validateSize(state.ship);
  dom.envelopeChip.textContent = status.level === 'ok'
    ? 'Envelope ok'
    : status.level === 'warn'
      ? 'Envelope warn'
      : 'Envelope error';
  dom.envelopeChip.className = `chip ${status.level === 'ok' ? 'chip--ok' : status.level === 'warn' ? 'chip--warn' : 'chip--error'}`;
  dom.envelopeChip.title = status.suggestion ? `Предлагается размер: ${status.suggestion}` : '';
}

function updateSpritePreview() {
  const sprite = state.ship.media?.sprite;
  dom.spritePreview.innerHTML = '';
  const source = sprite?.dataUrl || sprite?.path;
  if (source) {
    const img = document.createElement('img');
    img.src = source;
    img.alt = sprite.name || 'sprite';
    dom.spritePreview.appendChild(img);
    const meta = [];
    if (sprite.name) meta.push(sprite.name);
    if (sprite.width && sprite.height) meta.push(`${sprite.width}×${sprite.height}px`);
    if (sprite.path && !sprite.dataUrl) meta.push(sprite.path);
    dom.spriteInfo.textContent = meta.join(' · ') || 'Спрайт подключен';
  } else {
    const span = document.createElement('span');
    span.id = 'spritePlaceholder';
    span.textContent = 'Перетащите PNG/JPG или выберите файл';
    dom.spritePreview.appendChild(span);
    dom.spriteInfo.textContent = 'Нет спрайта';
  }
}

function renderOutput() {
  const exportObj = JSON.parse(JSON.stringify(state.ship));
  exportObj.classification.size_type = sizeType(exportObj.classification.size, exportObj.classification.type);
  exportObj.meta.version = exportObj.meta.version || '0.6.4';
  dom.out.textContent = JSON.stringify(exportObj, null, 2);
}

function updateJsonPanel() {
  if (!dom.jsonPanel || !dom.toggleJson) return;
  dom.jsonPanel.classList.toggle('is-open', state.ui.showJson);
  dom.toggleJson.textContent = state.ui.showJson ? 'Скрыть JSON' : 'Показать JSON';
}

function rebuildRecommendations() {
  recommendationCache = buildRecommendations(state.ship);
  renderRecommendations();
}

function buildRecommendations(ship) {
  const recs = [];
  const archetype = getNominals(ship.classification.size, ship.classification.type, ship.classification.stealth === 'stealth');
  if (archetype) {
    RECOMMEND_FIELDS.forEach(field => {
      const target = getPath(archetype, field.path);
      if (target === undefined || target === null) return;
      const current = getPath(ship, field.path);
      if (!needsRecommendation(current, target, field)) return;
      const severity = field.numeric
        ? severityByDelta(delta(current, target), field)
        : 'warn';
      recs.push({
        label: field.label,
        message: formatRecMessage(current, target, field),
        severity,
        path: field.path,
        apply: () => setPath(state.ship, field.path, cloneValue(target))
      });
    });
  }
  const envelope = validateSize(ship);
  if (envelope.level !== 'ok' && envelope.suggestion) {
    recs.push({
      label: 'Размер корпуса',
      message: `Рекомендуемый размер: ${envelope.suggestion}`,
      severity: envelope.level === 'error' ? 'error' : 'warn',
      path: 'classification.size',
      apply: () => {
        state.ship.classification.size = envelope.suggestion;
        syncClassification();
      }
    });
  }
  const preset = getSuggestedPreset();
  if (ship.assist?.preset !== preset) {
    recs.push({
      label: 'Preset ассиста',
      message: `Применить ${preset} под ${ship.classification.size_type}`,
      severity: 'warn',
      path: 'assist.preset',
      apply: () => applyAssistPresetByName(preset, { skipRender: true })
    });
  }
  if (!ship.media?.sprite?.dataUrl) {
    recs.push({
      label: 'Спрайт',
      message: 'Добавьте визуал корабля для полного набора данных',
      severity: 'info',
      path: 'media.sprite',
      apply: null
    });
  }
  const thrustIssue = thrustRecommendation(ship);
  if (thrustIssue) recs.push(thrustIssue);
  return recs;
}

function thrustRecommendation(ship) {
  const mass = Number(ship.mass?.dry_t);
  const accel = Number(ship.performance?.accel_fwd_mps2);
  if (!(mass > 0 && accel > 0)) return null;
  const expected = (mass * accel) / 1000;
  const current = Number(ship.propulsion?.main_thrust_MN);
  if (!(current > 0)) {
    return {
      label: 'Главная тяга',
      message: `Рассчитать из массы (${expected.toFixed(2)} МН)`,
      severity: 'warn',
      path: 'propulsion.main_thrust_MN',
      apply: () => {
        state.ship.propulsion.main_thrust_MN = Number(expected.toFixed(2));
      }
    };
  }
  const diff = Math.abs(current - expected) / expected;
  if (diff < 0.2) return null;
  return {
    label: 'Главная тяга',
    message: `Сейчас ${current.toFixed(2)} МН → ${expected.toFixed(2)} МН`,
    severity: diff > 0.4 ? 'error' : 'warn',
    path: 'propulsion.main_thrust_MN',
    apply: () => {
      state.ship.propulsion.main_thrust_MN = Number(expected.toFixed(2));
    }
  };
}

function renderRecommendations() {
  const container = dom.recommendationsList;
  container.innerHTML = '';
  if (!recommendationCache.length) {
    const placeholder = document.createElement('div');
    placeholder.className = 'recommendations-empty';
    placeholder.textContent = 'Нет несоответствий архетипу';
    container.appendChild(placeholder);
  } else {
    recommendationCache.forEach((rec, idx) => {
      const row = document.createElement('div');
      row.className = 'recommendation';
      row.dataset.severity = rec.severity || 'info';
      const textWrap = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = rec.label;
      const body = document.createElement('span');
      body.textContent = rec.message;
      textWrap.appendChild(title);
      textWrap.appendChild(body);
      row.appendChild(textWrap);
      if (typeof rec.apply === 'function') {
        const btn = document.createElement('button');
        btn.className = 'btn btn-small btn-outline';
        btn.dataset.applyRecommend = 'true';
        btn.dataset.index = idx;
        btn.textContent = 'Apply';
        row.appendChild(btn);
      }
      container.appendChild(row);
    });
  }
  updateHighlights();
}

function applyRecommendation(index) {
  const rec = recommendationCache[index];
  if (!rec || typeof rec.apply !== 'function') {
    logStatus('Для этой рекомендации нет автоматического действия', 'info');
    return;
  }
  rec.apply();
  renderAll();
  logStatus(`Применено: ${rec.label}`, 'success');
}

function applyAllRecommendations() {
  const actionable = recommendationCache.filter(rec => typeof rec.apply === 'function');
  if (!actionable.length) {
    logStatus('Нет рекомендаций с авто-применением', 'info');
    return;
  }
  actionable.forEach(rec => rec.apply());
  renderAll();
  logStatus('Все рекомендации применены', 'success');
}

function computeIntegrityIssues(ship) {
  const issues = [];
  const env = validateSize(ship);
  issues.push({
    label: 'Габариты',
    severity: env.level,
    message: env.level === 'ok' ? 'В пределах нормы' : `Выход за пределы: предложен ${env.suggestion}`,
    path: env.level === 'ok' ? null : 'classification.size'
  });
  const thrust = thrustIntegrity(ship);
  if (thrust) issues.push(thrust);
  const rcs = rcsIntegrity(ship);
  if (rcs) issues.push(rcs);
  const assist = assistIntegrity(ship);
  if (assist) issues.push(assist);
  if (!ship.media?.sprite?.dataUrl) {
    issues.push({
      label: 'Спрайт',
      severity: 'warn',
      message: 'Не прикреплён визуал корпуса',
      path: 'media.sprite'
    });
  }
  return issues;
}

function thrustIntegrity(ship) {
  const mass = Number(ship.mass?.dry_t);
  const accel = Number(ship.performance?.accel_fwd_mps2);
  const thrust = Number(ship.propulsion?.main_thrust_MN);
  if (!(mass > 0 && accel > 0 && thrust > 0)) return null;
  const expected = (mass * accel) / 1000;
  const diff = Math.abs(thrust - expected) / expected;
  if (diff < 0.15) {
    return {
      label: 'Главная тяга',
      severity: 'ok',
      message: 'Соответствует массе и ускорению'
    };
  }
  return {
    label: 'Главная тяга',
    severity: diff > 0.35 ? 'error' : 'warn',
    message: `Отклонение ${Math.round(diff * 100)}%`,
    path: 'propulsion.main_thrust_MN'
  };
}

function rcsIntegrity(ship) {
  const thrust = Number(ship.propulsion?.main_thrust_MN);
  const rcs = Number(ship.propulsion?.rcs_budget_MN);
  if (!(thrust > 0 && rcs > 0)) return null;
  const ratio = rcs / thrust;
  const target = RCS_RATIO[ship.classification.size] ?? 0.25;
  const diff = Math.abs(ratio - target) / target;
  if (diff < 0.25) {
    return { label: 'RCS бюджет', severity: 'ok', message: 'Баланс в норме' };
  }
  return {
    label: 'RCS бюджет',
    severity: diff > 0.5 ? 'error' : 'warn',
    message: `Отклонение ${Math.round(diff * 100)}%`,
    path: 'propulsion.rcs_budget_MN'
  };
}

function assistIntegrity(ship) {
  const accel = Number(ship.performance?.accel_fwd_mps2);
  if (!(accel > 0)) return null;
  const g = accel / 9.80665;
  const sustain = Number(ship.assist?.brake?.g_sustain);
  const boost = Number(ship.assist?.brake?.g_boost);
  if (!(sustain > 0 && boost > 0)) return null;
  const over = (value) => value > g * 1.3;
  if (!over(sustain) && !over(boost)) {
    return { label: 'Assist торможение', severity: 'ok', message: 'Соответствует физике' };
  }
  return {
    label: 'Assist торможение',
    severity: 'warn',
    message: 'Значения выше физического лимита',
    path: 'assist.brake.g_sustain'
  };
}

function renderIntegrity() {
  integrityIssues = computeIntegrityIssues(state.ship);
  if (dom.integritySummary) {
    dom.integritySummary.innerHTML = '';
    const subset = integrityIssues.length ? integrityIssues.slice(0, 4) : [{ label: 'Состояние', message: 'В норме', severity: 'ok' }];
    subset.forEach(issue => {
      const li = document.createElement('li');
      li.dataset.severity = issue.severity;
      li.innerHTML = `<span>${issue.label}</span><span>${issue.message}</span>`;
      dom.integritySummary.appendChild(li);
    });
  }
  updateHighlights();
}

function updateHighlights() {
  const highlight = new Set();
  recommendationCache.forEach(rec => { if (rec.path) highlight.add(rec.path); });
  integrityIssues.forEach(issue => { if (issue.path && issue.severity !== 'ok') highlight.add(issue.path); });
  bindings.forEach(({ el, path }) => {
    const flagged = highlight.has(path);
    if (el.classList) el.classList.toggle('has-warning', flagged);
    const field = el.closest('.field');
    if (field) field.classList.toggle('has-warning', flagged);
  });
}

function logStatus(message, tone = 'info') {
  state.statusLog.unshift({ message, tone, time: new Date() });
  state.statusLog = state.statusLog.slice(0, 6);
  renderStatusLog();
}

function renderStatusLog() {
  dom.statusLog.innerHTML = '';
  if (!state.statusLog.length) {
    dom.statusLog.textContent = 'Нет событий';
    return;
  }
  state.statusLog.forEach(entry => {
    const line = document.createElement('div');
    const time = entry.time.toLocaleTimeString();
    line.textContent = `[${time}] ${entry.message}`;
    dom.statusLog.appendChild(line);
  });
}

function runAutoDerive() {
  const changes = [];
  const thrustChanges = autoPropulsion({ silent: true });
  if (thrustChanges.length) changes.push(...thrustChanges);
  if (autoHullRadius(false)) changes.push('hull radius');
  const suggested = suggestSize(state.ship);
  if (suggested && suggested !== state.ship.classification.size) {
    state.ship.classification.size = suggested;
    syncClassification();
    changes.push(`size→${suggested}`);
  }
  state.ship.assist = normalizeAssistStructure(
    clampAssistToPhysics(state.ship.assist, state.ship.performance)
  );
  changes.push('assist clamp');
  renderAll();
  logStatus(changes.length ? `Auto: ${changes.join(', ')}` : 'Auto: без изменений', changes.length ? 'success' : 'info');
}

function autoPropulsion({ silent = false } = {}) {
  const notes = [];
  const mass = Number(state.ship.mass?.dry_t);
  const accel = Number(state.ship.performance?.accel_fwd_mps2);
  if (mass > 0 && accel > 0) {
    const thrust = Number(((mass * accel) / 1000).toFixed(2));
    if (!almostEqual(state.ship.propulsion.main_thrust_MN, thrust)) {
      state.ship.propulsion.main_thrust_MN = thrust;
      notes.push(`тяга ${thrust}`);
    }
    const ratio = RCS_RATIO[state.ship.classification.size] ?? 0.25;
    const rcs = Number((thrust * ratio).toFixed(2));
    if (!almostEqual(state.ship.propulsion.rcs_budget_MN, rcs)) {
      state.ship.propulsion.rcs_budget_MN = rcs;
      notes.push(`rcs ${rcs}`);
    }
  }
  if (!silent) {
    renderAll();
    logStatus(notes.length ? `Auto тяга: ${notes.join(', ')}` : 'Auto тяга: нет входных данных', notes.length ? 'success' : 'warn');
  }
  return notes;
}

function autoHullRadius(log = true) {
  const L = Number(state.ship.geometry?.length_m);
  const W = Number(state.ship.geometry?.width_m);
  if (!(L > 0 && W > 0)) {
    if (log) logStatus('Не хватает длины/ширины для расчёта радиуса', 'warn');
    return false;
  }
  const radius = computeHullRadius(L, W);
  state.ship.geometry.hull_radius_m = radius;
  if (log) {
    renderAll();
    logStatus(`Радиус корпуса → ${radius} м`, 'success');
  }
  return true;
}

function autoMassFromGeometry() {
  const { length_m: L, width_m: W, height_m: H } = state.ship.geometry;
  if (!(L > 0 && W > 0 && H > 0)) {
    logStatus('Auto масса: заполните длину, ширину и высоту', 'warn');
    return;
  }
  const template = getNominals(state.ship.classification.size, state.ship.classification.type, state.ship.classification.stealth === 'stealth');
  const baseMass = template?.mass?.dry_t || state.ship.mass?.dry_t || 50;
  const baseGeom = template?.geometry || {};
  const baseL = baseGeom.length_m || L;
  const baseW = baseGeom.width_m || W;
  const baseH = baseGeom.height_m || H;
  const volume = Math.max(L * W * H, 1);
  const baseVolume = Math.max(baseL * baseW * baseH, 1);
  const ratio = Math.pow(volume / baseVolume, 0.8);
  const scaled = baseMass * ratio;
  const minMass = baseMass * 0.5;
  const maxMass = baseMass * 2.2;
  const mass = Number(Math.min(Math.max(scaled, minMass), maxMass).toFixed(1));
  state.ship.mass.dry_t = Math.max(mass, 5);
  renderAll();
  logStatus(`Масса рассчитана по архетипу: ${state.ship.mass.dry_t} т`, 'success');
}

function autoInertiaAndPower() {
  const massT = Number(state.ship.mass?.dry_t);
  const L = Number(state.ship.geometry?.length_m);
  const W = Number(state.ship.geometry?.width_m);
  const H = Number(state.ship.geometry?.height_m);
  if (!(massT > 0 && L > 0 && W > 0 && H > 0)) {
    logStatus('Auto inertia: заполните массу и габариты', 'warn');
    return;
  }
  const massKg = massT * 1000;
  const Ixx = (massKg / 12) * (Math.pow(H, 2) + Math.pow(W, 2));
  const Iyy = (massKg / 12) * (Math.pow(L, 2) + Math.pow(H, 2));
  const Izz = (massKg / 12) * (Math.pow(L, 2) + Math.pow(W, 2));
  state.ship.inertia_opt.Ixx = Number(Ixx.toFixed(2));
  state.ship.inertia_opt.Iyy = Number(Iyy.toFixed(2));
  state.ship.inertia_opt.Izz = Number(Izz.toFixed(2));
  const reactor = Number((massT * 0.35).toFixed(1));
  state.ship.power_opt.reactor_MW = reactor;
  state.ship.power_opt.cooling_MW = Number((reactor * 0.8).toFixed(1));
  renderAll();
  logStatus('Инерция и питание рассчитаны автоматически', 'success');
}

function autoPerformanceFromTemplate() {
  const template = getNominals(state.ship.classification.size, state.ship.classification.type, state.ship.classification.stealth === 'stealth');
  if (!template?.performance) {
    logStatus('Нет архетипных данных производительности', 'warn');
    return;
  }
  state.ship.performance = {
    ...state.ship.performance,
    accel_fwd_mps2: template.performance.accel_fwd_mps2,
    strafe_mps2: { ...state.ship.performance.strafe_mps2, ...template.performance.strafe_mps2 },
    angular_dps: { ...state.ship.performance.angular_dps, ...template.performance.angular_dps }
  };
  renderAll();
  logStatus('Производительность обновлена из архетипа', 'success');
}

function autoAssistFromTemplate({ silent = false } = {}) {
  const preset = getNominals(state.ship.classification.size, state.ship.classification.type, state.ship.classification.stealth === 'stealth')?.preset
    || dom.assistPreset?.value
    || getSuggestedPreset();
  dom.assistPreset.value = preset;
  applyAssistPresetByName(preset);
  if (!silent) logStatus(`Assist → ${preset}`, 'success');
}

async function scanSpriteForGeometry() {
  const source = state.ship.media?.sprite?.dataUrl || spriteScanSource;
  if (!source) {
    logStatus('Сначала загрузите спрайт (PNG/JPG)', 'warn');
    return;
  }
  try {
    const img = await loadImageFromSource(source);
    const bounds = extractOpaqueBounds(img);
    if (!bounds) {
      logStatus('Не удалось найти непрозрачные пиксели на спрайте', 'warn');
      return;
    }
    const template = getNominals(state.ship.classification.size, state.ship.classification.type, state.ship.classification.stealth === 'stealth');
    const currentLength = state.ship.geometry.length_m > 0 ? state.ship.geometry.length_m : template?.geometry?.length_m || 10;
    const lengthRatio = bounds.width || 1;
    const widthRatio = bounds.height || 1;
    const newLength = Number(currentLength.toFixed(2));
    const newWidth = Number((newLength * (widthRatio / lengthRatio || 1)).toFixed(2));
    state.ship.geometry.length_m = newLength;
    state.ship.geometry.width_m = newWidth;
    if (!state.ship.geometry.height_m && template?.geometry?.height_m) {
      state.ship.geometry.height_m = template.geometry.height_m;
    }
    autoHullRadius(false);
    renderAll();
    logStatus(`Габариты обновлены по спрайту: ${newLength} × ${newWidth} м`, 'success');
  } catch (err) {
    console.error(err);
    logStatus('Не удалось обработать спрайт (возможно, CORS)', 'error');
  }
}

function loadImageFromSource(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function extractOpaqueBounds(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const alpha = data[(y * canvas.width + x) * 4 + 3];
      if (alpha > SPRITE_ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX === -1 || maxY === -1) return null;
  return { width: maxX - minX + 1, height: maxY - minY + 1 };
}

function recommendSection(section) {
  const template = getNominals(state.ship.classification.size, state.ship.classification.type, state.ship.classification.stealth === 'stealth');
  if (section === 'assist') {
    autoAssistFromTemplate();
    return;
  }
  if (!template) {
    logStatus('Нет архетипных данных для этой секции', 'warn');
    return;
  }
  const fields = SECTION_SETS[section];
  if (!fields?.length) {
    logStatus('Секция не поддерживает автозаполнение', 'warn');
    return;
  }
  let applied = 0;
  fields.forEach(path => {
    const value = getPath(template, path);
    if (value !== undefined) {
      setPath(state.ship, path, cloneValue(value));
      applied++;
    }
  });
  if (section === 'geometry') {
    state.ship.geometry.hull_radius_m = template.geometry?.hull_radius_m
      ?? computeHullRadius(state.ship.geometry.length_m, state.ship.geometry.width_m);
  }
  if (section === 'propulsion') {
    // clamp propulsion to derived physics as well
    autoPropulsion({ silent: true });
  }
  renderAll();
  logStatus(applied ? `Секция ${section} заполнена архетипом` : `Для секции ${section} нет данных архетипа`, applied ? 'success' : 'warn');
}

function applySuggestedSize() {
  const suggestion = suggestSize(state.ship);
  if (suggestion) {
    state.ship.classification.size = suggestion;
    syncClassification();
    renderAll();
    logStatus(`Размер установлен: ${suggestion}`, 'success');
  } else {
    logStatus('Нет достаточных данных для размера', 'warn');
  }
}

function applySuggestedPreset() {
  const preset = getSuggestedPreset();
  applyAssistPresetByName(preset, { skipRender: true });
  dom.assistPreset.value = preset;
  renderAll();
  logStatus(`Preset ${preset} применён`, 'success');
}

function getSuggestedPreset() {
  return ARCH_PRESET.find(a => a.size === state.ship.classification.size && a.type === state.ship.classification.type)?.preset || 'Balanced';
}

function applyAssistPresetByName(name, { skipRender = false } = {}) {
  const presetValues = cloneAssistPreset(name);
  const tuned =
    state.ship.classification.stealth === "stealth" && state.ship.classification.type !== "recon"
      ? applyStealthMode(presetValues, state.ship.classification.type)
      : presetValues;
  tuned.preset = name;
  const clamped = clampAssistToPhysics(tuned, state.ship.performance);
  state.ship.assist = normalizeAssistStructure(clamped);
  if (dom.assistPreset) dom.assistPreset.value = name;
  if (dom.assistStyle && state.ship.assist?.handling_style) {
    dom.assistStyle.value = state.ship.assist.handling_style;
  }
  if (!skipRender) {
    renderAll();
  }
}

function applyNominalFill() {
  state.ship = applyNominals(state.ship, 'overwrite');
  ensureShipShapeInPlace();
  renderAll();
  logStatus('Архетип заполнен номиналами', 'success');
}

function resetShip() {
  if (!confirm('Сбросить конфиг к значениям по умолчанию?')) return;
  state.ship = buildEmptyConfig();
  renderAll();
  logStatus('Конфиг сброшен', 'warn');
}

async function importConfig() {
  const file = dom.importFile.files[0];
  if (!file) {
    alert('Выберите файл JSON');
    return;
  }
  let text = '';
  try {
    text = await readFileAsText(file);
  } catch (error) {
    console.error('Не удалось прочитать файл ShipConfig', error);
    alert('Не удалось прочитать файл. Проверьте права доступа.');
    return;
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    alert('Некорректный JSON');
    return;
  }
  if (!parsed.meta || !parsed.classification) {
    const { migrateToV06 } = await import('./migrate.js');
    parsed = migrateToV06(parsed);
  }
  state.ship = ensureShipShape(parsed);
  renderAll();
  logStatus(`Импортировано: ${file.name}`, 'success');
}

function exportConfig() {
  renderOutput();
  const blob = new Blob([dom.out.textContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.ship.meta?.name || 'ship'}-config.json`;
  a.click();
  URL.revokeObjectURL(url);
  logStatus('Экспорт завершён', 'success');
}

async function copyJson() {
  try {
    await navigator.clipboard.writeText(dom.out.textContent);
    logStatus('JSON скопирован', 'success');
  } catch {
    logStatus('Не удалось скопировать JSON', 'error');
  }
}

function readFileAsText(file) {
  if (file?.text) {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('readAsText failed'));
    reader.readAsText(file);
  });
}

function loadSprite(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      state.ship.media.sprite = {
        name: file.name,
        dataUrl: reader.result,
        path: state.ship.media?.sprite?.path || file.name,
        width: img.width,
        height: img.height
      };
      spriteScanSource = reader.result;
      renderAll();
      logStatus(`Спрайт загружен: ${file.name}`, 'success');
      if (dom.spriteInput) dom.spriteInput.value = '';
    };
    img.onerror = () => alert('Не удалось прочитать изображение');
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function detachSpriteData() {
  if (!state.ship.media?.sprite?.dataUrl) {
    logStatus('dataUrl уже отсутствует', 'info');
    return;
  }
  state.ship.media.sprite.dataUrl = '';
  renderAll();
  logStatus('dataUrl удалён. Используйте путь к ассету для загрузки в игре.', 'success');
}

function ensureShipShapeInPlace() {
  state.ship = ensureShipShape(state.ship);
}

function ensureShipShape(source) {
  const base = buildEmptyConfig({
    id: source?.meta?.id || undefined,
    name: source?.meta?.name || undefined,
    version: source?.meta?.version || undefined,
    author: source?.meta?.author || undefined
  });
  const merged = mergeDeep(base, source || {});
  merged.assist = normalizeAssistStructure(merged.assist);
  return merged;
}

function mergeDeep(target, source) {
  if (typeof source !== 'object' || !source) return target;
  const output = Array.isArray(target) ? [...target] : { ...target };
  Object.keys(source).forEach(key => {
    const srcVal = source[key];
    if (Array.isArray(srcVal)) {
      output[key] = srcVal.map(item => (typeof item === 'object' ? mergeDeep({}, item) : item));
    } else if (srcVal && typeof srcVal === 'object') {
      output[key] = mergeDeep(output[key] || {}, srcVal);
    } else {
      output[key] = srcVal;
    }
  });
  return output;
}

function normalizeAssistStructure(rawAssist) {
  const presetName = rawAssist?.preset || 'Balanced';
  const base = cloneAssistPreset(presetName);
  let merged = mergeDeep(base, rawAssist || {});
  const legacyMap = [
    ['slip_lim_deg', 'handling.slip_limit_deg'],
    ['stab_gain', 'handling.stab_gain'],
    ['oversteer_bias', 'handling.oversteer_bias'],
    ['cap_main_coupled', 'handling.cap_main_coupled'],
    ['brake_g_sustain', 'brake.g_sustain'],
    ['brake_g_boost', 'brake.g_boost'],
    ['boost_duration_s', 'brake.boost_duration_s'],
    ['boost_cooldown_s', 'brake.boost_cooldown_s']
  ];
  legacyMap.forEach(([legacyKey, targetPath]) => {
    if (rawAssist && rawAssist[legacyKey] !== undefined) {
      setPath(merged, targetPath, rawAssist[legacyKey]);
    }
    if (merged[legacyKey] !== undefined) {
      delete merged[legacyKey];
    }
  });
  if (!merged.handling) {
    merged.handling = cloneAssistPreset('Balanced').handling;
  }
  if (!merged.jerk) {
    merged.jerk = cloneAssistPreset('Balanced').jerk;
  }
  if (!merged.brake) {
    merged.brake = cloneAssistPreset('Balanced').brake;
  }
  if (!merged.handling.slip_target_max) {
    merged.handling.slip_target_max = merged.handling.slip_limit_deg;
  }
  merged.preset = presetName;
  merged.handling_style = HANDLING_STYLES.includes(merged.handling_style) ? merged.handling_style : merged.handling_style || base.handling_style;
  const defaults = cloneAssistPreset(merged.preset);
  merged.speed_limiter_ratio = typeof merged.speed_limiter_ratio === 'number' ? merged.speed_limiter_ratio : defaults.speed_limiter_ratio;
  merged.handling = mergeDeep(defaults.handling, merged.handling);
  merged.jerk = mergeDeep(defaults.jerk, merged.jerk);
  merged.brake = mergeDeep(defaults.brake, merged.brake);
  return merged;
}

function ensureHullRadiusValue() {
  if (!state.ship.geometry) return;
  if (!(state.ship.geometry.hull_radius_m > 0)) {
    autoHullRadius(false);
  }
}

function rememberSpriteSource() {
  if (state.ship.media?.sprite?.dataUrl) {
    spriteScanSource = state.ship.media.sprite.dataUrl;
  }
}

function readValue(el, format) {
  if (format === 'number') return el.value === '' ? null : Number(el.value);
  if (format === 'list') {
    return el.value
      .split(/\r?\n|,/)
      .map(v => v.trim())
      .filter(Boolean);
  }
  return el.value;
}

function setElementValue(el, value, format) {
  if (format === 'number') {
    el.value = value ?? '';
    return;
  }
  if (format === 'list') {
    el.value = Array.isArray(value) ? value.join('\n') : '';
    return;
  }
  el.value = value ?? '';
}

function inferFormat(el) {
  if (el.type === 'number') return 'number';
  if (el.dataset.format) return el.dataset.format;
  return 'text';
}

function getPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc ? acc[key] : undefined), obj);
}

function setPath(obj, path, value) {
  const keys = path.split('.');
  let ref = obj;
  keys.slice(0, -1).forEach(key => {
    if (ref[key] === undefined || ref[key] === null) ref[key] = {};
    ref = ref[key];
  });
  ref[keys[keys.length - 1]] = value;
}

function needsRecommendation(current, target, field) {
  if (field.numeric) {
    if (current === null || current === undefined || current === '') return true;
    const d = delta(current, target);
    return d >= (field.tolerance ?? 0.2);
  }
  return (current || '').trim() !== (target || '').trim();
}

function delta(current, target) {
  if (!isFinite(current) || !isFinite(target) || target === 0) return 1;
  return Math.abs(current - target) / Math.abs(target);
}

function severityByDelta(diff, field) {
  if (diff >= (field.critical ?? 0.4)) return 'error';
  if (diff >= (field.tolerance ?? 0.2)) return 'warn';
  return 'info';
}

function formatRecMessage(current, target, field) {
  if (!field.numeric) {
    return current ? `Текущее "${current}" → "${target}"` : `Заполнить "${target}"`;
  }
  if (current === null || current === undefined || current === '') {
    return `Пусто → ${target}`;
  }
  return `${Number(current).toFixed(field.decimals ?? 0)} → ${Number(target).toFixed(field.decimals ?? 0)}`;
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(v => cloneValue(v));
  if (value && typeof value === 'object') return mergeDeep({}, value);
  return value;
}

function almostEqual(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  return Math.abs(a - b) < 1e-6;
}

function toggleInfoPopover(target, text) {
  if (!dom.infoPopover || !dom.infoText) return;
  if (infoPopoverTarget === target && dom.infoPopover.classList.contains('visible')) {
    hideInfoPopover();
    return;
  }
  infoPopoverTarget = target;
  dom.infoText.textContent = text;
  const rect = target.getBoundingClientRect();
  dom.infoPopover.style.top = `${rect.bottom + window.scrollY + 8}px`;
  dom.infoPopover.style.left = `${rect.left + window.scrollX}px`;
  dom.infoPopover.classList.remove('hidden');
  dom.infoPopover.classList.add('visible');
}

function hideInfoPopover() {
  if (!dom.infoPopover) return;
  dom.infoPopover.classList.remove('visible');
  dom.infoPopover.classList.add('hidden');
  infoPopoverTarget = null;
}

