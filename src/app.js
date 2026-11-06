(() => {
  'use strict';

  /* =========================================================
     Constants & tiny helpers
     ========================================================= */

  const STORAGE_KEY = 'meow-system-v1';
  const APP_VERSION = '1.0.0';
  const MAX_RECORDS = 400;

  const AVATARS = ['pixel-1', 'pixel-2', 'pixel-3', '🐱', '🐈', '🐈‍⬛', '😺', '😻'];

  const DEFAULT_FIELDS = [
    { key: 'breed',   label: '品种',     type: 'text',    placeholder: '例如：布偶猫' },
    { key: 'sex',     label: '性别',     type: 'sex',     placeholder: '' },
    { key: 'birthday',label: '生日',     type: 'date',    placeholder: '' },
    { key: 'arrival', label: '到家日',   type: 'date',    placeholder: '' },
    { key: 'weight',  label: '体重',     type: 'text',    placeholder: '例如：4.8 kg' },
    { key: 'color',   label: '毛色',     type: 'text',    placeholder: '例如：海豹双色' },
    { key: 'source',  label: '来源',     type: 'text',    placeholder: '领养 / 猫舍 / 救助' },
    { key: 'vet',     label: '常去医院', type: 'text',    placeholder: '医院名称' },
    { key: 'notes',   label: '备注',     type: 'longtext',placeholder: '性格、习惯、过敏…' }
  ];

  const TYPE_LABEL = {
    deworm: '驱虫',
    vaccine: '疫苗',
    neuter: '绝育'
  };

  const REMINDER_TONE_PRIORITY = {
    overdue: 0,
    today: 1,
    soon: 2,
    later: 3,
    plan: 4
  };

  const REMINDER_GROUP_TITLE = {
    overdue: '逾期',
    today: '今天',
    soon: '7 天内',
    later: '之后',
    plan: '待安排'
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[ch]));
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function uid(prefix = 'id') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function cleanText(value) {
    return String(value ?? '').replace(/\u0000/g, '').trim();
  }

  function cleanCost(value) {
    return String(value ?? '').replace(/[^\d.,]/g, '').replace(/,/g, '').slice(0, 12);
  }

  /* =========================================================
     Dates
     ========================================================= */

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function parseISO(iso) {
    if (typeof iso !== 'string') return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.slice(0, 10));
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return null;
    }
    return date;
  }

  function isoFromDate(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function addDaysISO(iso, amount) {
    const date = parseISO(iso);
    if (!date) return '';
    date.setDate(date.getDate() + Number(amount || 0));
    return isoFromDate(date);
  }

  function addMonthsISO(iso, amount) {
    const date = parseISO(iso);
    if (!date) return '';
    const day = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + Number(amount || 0));
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(day, lastDay));
    return isoFromDate(date);
  }

  function daysBetween(fromISO, toISO) {
    const from = parseISO(fromISO);
    const to = parseISO(toISO);
    if (!from || !to) return 0;
    const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
    const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
    return Math.round((b - a) / 86400000);
  }

  function monthsBetweenISO(fromISO, toISO) {
    const from = parseISO(fromISO);
    const to = parseISO(toISO);
    if (!from || !to) return 0;
    let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
    if (to.getDate() < from.getDate()) months -= 1;
    return Math.max(0, months);
  }

  function fmtDot(iso) {
    const date = parseISO(iso);
    if (!date) return '—';
    return `${date.getFullYear()}.${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}`;
  }

  function fmtShort(iso) {
    const date = parseISO(iso);
    if (!date) return '—';
    return `${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}`;
  }

  function fmtDay(iso) {
    const date = parseISO(iso);
    return date ? pad2(date.getDate()) : '—';
  }

  function fmtMonth(iso) {
    const date = parseISO(iso);
    return date ? `${date.getMonth() + 1}月` : '—';
  }

  function weekdayCN(iso) {
    const date = parseISO(iso);
    if (!date) return '';
    return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
  }

  function dueInfo(iso) {
    if (!iso) return { tone: 'none', label: '未设置', diff: null };
    const diff = daysBetween(todayISO(), iso);
    if (diff < 0) return { tone: 'overdue', label: `逾期 ${Math.abs(diff)} 天`, diff };
    if (diff === 0) return { tone: 'today', label: '今天', diff };
    if (diff <= 7) return { tone: 'soon', label: `${diff} 天后`, diff };
    return { tone: 'later', label: `${diff} 天后`, diff };
  }

  function ageText(birthday) {
    const birth = parseISO(birthday);
    if (!birth) return '年龄未知';
    const now = new Date();
    let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
    if (now.getDate() < birth.getDate()) months -= 1;
    if (months < 0) return '年龄未知';
    if (months < 12) return `${months} 个月`;
    const years = Math.floor(months / 12);
    const rest = months % 12;
    return rest ? `${years} 岁 ${rest} 个月` : `${years} 岁`;
  }

  function greeting() {
    const hour = new Date().getHours();
    if (hour < 5) return '凌晨好';
    if (hour < 9) return '早上好';
    if (hour < 12) return '上午好';
    if (hour < 14) return '中午好';
    if (hour < 18) return '下午好';
    return '晚上好';
  }

  /* =========================================================
     Look: 系统色 + 背景图
     ========================================================= */

  const DEFAULT_ACCENT = '#2b3050';
  const DEFAULT_VEIL = 0.6;
  // 组件（方框）底色：默认等于原来的米色毛玻璃，alpha 就是原 --glass 的 0.82
  const DEFAULT_PANEL_COLOR = '#fbf4e5';
  const DEFAULT_PANEL_ALPHA = 0.82;
  const ACCENT_PRESETS = [
    { value: '#1e3bdb', label: '克莱因蓝' },
    { value: '#0e7d84', label: '湖水青' },
    { value: '#3f7a52', label: '苔绿' },
    { value: '#b8862b', label: '琥珀' },
    { value: '#c96a20', label: '落日橙' },
    { value: '#c2415c', label: '桃红' },
    { value: '#6b3fa0', label: '茄紫' },
    { value: '#2b3050', label: '石墨' }
  ];
  const BG_PRESETS = [
    { id: 'collage', label: '拼贴照片' },
    { id: 'plain', label: '纯色底' },
    { id: 'custom', label: '我的照片' }
  ];
  const MAX_BG_BYTES = 900 * 1024;

  function normaliseHex(value) {
    const text = String(value || '').trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(text)) return text;
    if (/^#[0-9a-f]{3}$/.test(text)) {
      return `#${text[1]}${text[1]}${text[2]}${text[2]}${text[3]}${text[3]}`;
    }
    return '';
  }

  function hexToRgb(hex) {
    const value = normaliseHex(hex) || DEFAULT_ACCENT;
    return {
      r: parseInt(value.slice(1, 3), 16),
      g: parseInt(value.slice(3, 5), 16),
      b: parseInt(value.slice(5, 7), 16)
    };
  }

  function rgbToHex(rgb) {
    const part = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
    return `#${part(rgb.r)}${part(rgb.g)}${part(rgb.b)}`;
  }

  function mixRgb(a, b, weight) {
    const t = clamp(weight, 0, 1);
    return {
      r: a.r + (b.r - a.r) * t,
      g: a.g + (b.g - a.g) * t,
      b: a.b + (b.b - a.b) * t
    };
  }

  function relativeLuminance(rgb) {
    const channel = (value) => {
      const c = value / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
  }

  function contrastRatio(a, b) {
    const l1 = relativeLuminance(a);
    const l2 = relativeLuminance(b);
    const light = Math.max(l1, l2);
    const dark = Math.min(l1, l2);
    return (light + 0.05) / (dark + 0.05);
  }

  const PAPER_RGB = { r: 251, g: 244, b: 229 };
  const INK_RGB = { r: 23, g: 28, b: 58 };

  // 系统色上的文字：亮色用深墨，深色用米白，取对比更高的那个
  function readableOn(accentHex) {
    const accent = hexToRgb(accentHex);
    const light = contrastRatio(accent, PAPER_RGB);
    const dark = contrastRatio(accent, INK_RGB);
    return dark >= light ? '#171c3a' : '#fffaf0';
  }

  // 系统色当文字用时（卡片是浅底），压深到正文级对比（4.5:1）
  function accentForText(accentHex, bgRgb) {
    const bg = bgRgb || PAPER_RGB;
    const accent = hexToRgb(accentHex);
    let candidate = accent;
    let step = 0;
    // 深底就往亮里抬，浅底往深里压
    const dark = relativeLuminance(bg) < 0.42;
    const toward = dark ? { r: 255, g: 250, b: 240 } : { r: 0, g: 0, b: 0 };
    // 深底上 4.5:1 会偏灰，抬到 6.5:1 才不至于糊在深色方框里
    const target = dark ? 6.5 : 4.5;
    while (contrastRatio(candidate, bg) < target && step < 24) {
      candidate = mixRgb(candidate, toward, 0.09);
      step += 1;
    }
    return rgbToHex(candidate);
  }

  // 时间电量栏底色：跟随系统色，但压深到白字能看清（≥4.5:1）
  const WHITE_RGB = { r: 255, g: 255, b: 255 };
  function statusBarTone(accentHex) {
    const accent = hexToRgb(accentHex);
    let candidate = accent;
    let step = 0;
    while (contrastRatio(candidate, WHITE_RGB) < 4.5 && step < 30) {
      candidate = mixRgb(candidate, { r: 0, g: 0, b: 0 }, 0.1);
      step += 1;
    }
    return rgbToHex(candidate);
  }

  // 下限 15%：全透明时压在照片上的大标题会糊成一片，留一点薄纱保底
  function normaliseVeil(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return DEFAULT_VEIL;
    return Math.round(clamp(num, 0.15, 0.75) * 100) / 100;
  }

  function normaliseBackground(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const preset = BG_PRESETS.some((item) => item.id === source.preset) ? source.preset : 'collage';
    const image = typeof source.image === 'string'
      && /^data:image\//.test(source.image)
      && source.image.length < MAX_BG_BYTES * 2
      ? source.image
      : '';
    if (preset === 'custom' && !image) {
      return { preset: 'collage', image: '', veil: normaliseVeil(source.veil) };
    }
    return { preset, image: preset === 'custom' ? image : '', veil: normaliseVeil(source.veil) };
  }

  function normaliseLook(settings) {
    const raw = settings && typeof settings === 'object' ? settings : {};
    return {
      accent: normaliseHex(raw.accent) || DEFAULT_ACCENT,
      background: normaliseBackground(raw.background),
      panel: normalisePanel(raw.panel)
    };
  }

  function normalisePanel(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const color = normaliseHex(source.color) || DEFAULT_PANEL_COLOR;
    let alpha = Number(source.alpha);
    if (source.alpha === undefined || source.alpha === null || !Number.isFinite(alpha)) {
      alpha = DEFAULT_PANEL_ALPHA;
    }
    return {
      color,
      alpha: Math.round(clamp(alpha, 0, 1) * 100) / 100
    };
  }

  function defaultLook() {
    return normaliseLook(null);
  }

  function lookAccentLabel(accent) {
    const preset = ACCENT_PRESETS.find((item) => item.value === accent);
    return preset ? preset.label : accent.toUpperCase();
  }

  function accentSwatches(accent) {
    return ACCENT_PRESETS.map((item) => {
      const active = item.value === accent;
      return `<button type="button" class="swatch" style="--swatch:${item.value}"
        data-action="set-accent" data-accent="${item.value}"
        aria-pressed="${active}" aria-label="系统色 ${esc(item.label)}" title="${esc(item.label)}">
        ${active ? `<span class="swatch-tick">${icon('check', 15, 2.6)}</span>` : ''}
      </button>`;
    }).join('');
  }

  function customAccentRow(accent) {
    const isCustom = !ACCENT_PRESETS.some((item) => item.value === accent);
    return `<label class="custom-accent" aria-pressed="${isCustom}">
      <span class="swatch" style="--swatch:${accent}">${isCustom ? `<span class="swatch-tick">${icon('check', 15, 2.6)}</span>` : ''}</span>
      <span class="custom-accent-copy">
        <strong>自定义颜色</strong>
        ${isCustom ? `<span>${accent.toUpperCase()}</span>` : ''}
      </span>
      <input type="color" value="${accent}" data-accent-input aria-label="自定义系统色">
    </label>`;
  }

  // 组件色：卡片 / 列表 / 输入框这些方框的底色，可自选颜色 + 透明度
  function panelColorRow(panel) {
    const alphaPercent = Math.round(panel.alpha * 100);
    return `<div class="panel-color-row">
      <label class="custom-accent" aria-pressed="false">
        <span class="swatch" style="--swatch:${panel.color}"></span>
        <span class="custom-accent-copy">
          <strong>方框颜色</strong>
        </span>
        <input type="color" value="${panel.color}" data-panel-input aria-label="自定义组件色">
      </label>
      <div class="veil-row">
        <span>透明度</span>
        <input type="range" min="0" max="100" step="1" value="${alphaPercent}" data-panel-alpha aria-label="组件透明度">
        <span class="veil-value" data-panel-alpha-value>${alphaPercent}%</span>
      </div>
    </div>`;
  }

  function backgroundTiles(background) {
    return BG_PRESETS.map((item) => {
      const active = background.preset === item.id;
      const hasCustom = Boolean(background.image);
      let inner = '';
      if (item.id === 'plain') {
        inner = `<span class="thumb-empty">${icon('close', 16)}</span>`;
      } else if (item.id === 'custom' && !hasCustom) {
        inner = `<span class="thumb-empty">${icon('upload', 16)}</span>`;
      }
      const thumbClass = item.id === 'custom' && hasCustom ? ` bg-thumb thumb-custom has-img` : ` bg-thumb thumb-${item.id}`;
      return `<button type="button" class="bg-tile" data-action="set-background" data-preset="${item.id}"
        aria-pressed="${active}" aria-label="背景 ${esc(item.label)}">
        <span class="${thumbClass.trim()}">${inner}</span>
        <span>${item.label}</span>
      </button>`;
    }).join('');
  }

  function escapeCssUrl(value) {
    return String(value).replace(/["\\\n\r]/g, '');
  }

  function applyLook() {
    const root = document.documentElement;
    const look = normaliseLook(store.settings);
    const accent = look.accent;
    const accentRgb = hexToRgb(accent);

    const panel = look.panel;
    const panelRgb = hexToRgb(panel.color);
    const panelDark = relativeLuminance(panelRgb) < 0.42;

    root.style.setProperty('--blue', accent);
    root.style.setProperty('--blue-2', rgbToHex(mixRgb(accentRgb, { r: 255, g: 255, b: 255 }, 0.32)));
    root.style.setProperty('--blue-deep', rgbToHex(mixRgb(accentRgb, { r: 0, g: 0, b: 0 }, 0.45)));
    // 方框外（压在照片上的小节标题、链接）永远按纸色算深色文字
    root.style.setProperty('--blue-ink', accentForText(accent, PAPER_RGB));
    // 方框内若是深底，再给一份压亮到能看清的版本，由 CSS 在框内覆盖
    root.style.setProperty('--blue-ink-on-dark', accentForText(accent, panelRgb));
    root.style.setProperty('--on-accent', readableOn(accent));
    root.style.setProperty('--status-bg', statusBarTone(accent));

    // 组件色：方框底色由用户自选，透明度直接写进 rgba
    const panelAlpha = panel.alpha;
    const softAlpha = Math.round(clamp(panelAlpha * 0.88, 0, 1) * 100) / 100;
    const strongAlpha = Math.round(clamp(panelAlpha + (1 - panelAlpha) * 0.55, 0, 1) * 100) / 100;
    root.style.setProperty('--glass', `rgba(${panelRgb.r}, ${panelRgb.g}, ${panelRgb.b}, ${panelAlpha})`);
    root.style.setProperty('--glass-soft', `rgba(${panelRgb.r}, ${panelRgb.g}, ${panelRgb.b}, ${softAlpha})`);
    root.style.setProperty('--glass-strong', `rgba(${panelRgb.r}, ${panelRgb.g}, ${panelRgb.b}, ${strongAlpha})`);
    // 底栏原本和卡片同透明度，这里保持一致，避免用户没动组件色时观感变化
    root.style.setProperty('--tab-bg', `rgba(${panelRgb.r}, ${panelRgb.g}, ${panelRgb.b}, ${panelAlpha})`);

    root.setAttribute('data-panel-dark', panelDark ? '1' : '0');

    const background = look.background;
    const photo = background.preset === 'custom' && background.image
      ? `url("${escapeCssUrl(background.image)}")`
      : background.preset === 'plain'
        ? 'none'
        : 'var(--bg-default-url)';
    root.style.setProperty('--bg-photo-url', photo);
    root.style.setProperty('--bg-custom-url', background.image ? `url("${escapeCssUrl(background.image)}")` : 'none');

    const veil = background.preset === 'plain' ? 0 : background.veil;
    root.style.setProperty('--photo-veil', `rgba(241, 231, 213, ${veil})`);
    root.style.setProperty('--photo-blur', background.preset === 'custom' ? '3px' : '2px');

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', accent);
  }

  /* =========================================================
     Icons
     ========================================================= */

  const ICONS = {
    home: '<path d="M3 10.7 12 3l9 7.7"/><path d="M5.4 9.5V20h13.2V9.5"/><path d="M9.4 20v-5.2h5.2V20"/>',
    bell: '<path d="M18 8.5a6 6 0 0 0-12 0c0 6.6-2.3 6.7-2.3 7.8h16.6c0-1.1-2.3-1.2-2.3-7.8Z"/><path d="M9.7 19.6a2.5 2.5 0 0 0 4.6 0"/>',
    user: '<circle cx="12" cy="8.2" r="3.4"/><path d="M5.2 20c.7-3.4 3.3-5.4 6.8-5.4s6.1 2 6.8 5.4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    back: '<path d="m14.5 5-7 7 7 7"/>',
    edit: '<path d="m4 16.5-.8 4.3 4.3-.8L19 8.5a2.1 2.1 0 0 0-3-3L4 16.5Z"/><path d="m13.8 7.2 3 3"/>',
    trash: '<path d="M4 7h16"/><path d="M9 7V4.8h6V7"/><path d="M7 7l.8 13h8.4L17 7"/><path d="M10 11v5M14 11v5"/>',
    check: '<path d="m5 12.5 4.2 4.2L19 7"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    download: '<path d="M12 3v11"/><path d="m7.5 10 4.5 4.5 4.5-4.5"/><path d="M4 19.5h16"/>',
    upload: '<path d="M12 15V4"/><path d="m7.5 8.5 4.5-4.5 4.5 4.5"/><path d="M4 19.5h16"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
    database: '<ellipse cx="12" cy="5.5" rx="7.5" ry="3"/><path d="M4.5 5.5v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6"/><path d="M4.5 11.5v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6"/>',
    shield: '<path d="M12 3 5 6v6c0 4.5 3 7.2 7 9 4-1.8 7-4.5 7-9V6l-7-3Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z"/>',
    auto: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17"/>',
    pill: '<rect x="3.5" y="8.5" width="17" height="7" rx="3.5" transform="rotate(-35 12 12)"/><path d="m9.5 7.5 7 9"/>',
    syringe: '<path d="m17 3 4 4"/><path d="m14 6 4 4"/><path d="m16 8-9.5 9.5L3 21l3.5-3.5L16 8Z"/><path d="m8 12 4 4M6 14l4 4"/>',
    scissors: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8.2 7.8 20 19M8.2 16.2 20 5"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M7.5 3v4M16.5 3v4M3.5 10h17"/>',
    note: '<path d="M5 3.8h9.5L19 8.3V20.2H5V3.8Z"/><path d="M14.2 3.9v4.5h4.6"/><path d="M8 12.5h8M8 16h5"/>',
    chevronRight: '<path d="m9 5 7 7-7 7"/>',
    chevronDown: '<path d="m5 9 7 7 7-7"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>',
    sparkle: '<path d="M12 3v5M12 16v5M3 12h5M16 12h5"/><path d="m6 6 2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.7h.01"/>',
    alert: '<path d="M12 3 2.7 20h18.6L12 3Z"/><path d="M12 9v5"/><path d="M12 17h.01"/>',
    lock: '<rect x="4.5" y="10" width="15" height="10.5" rx="2"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/>',
    settings: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>'
  };

  function icon(name, size = 20, strokeWidth = 1.75) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] || ICONS.sparkle}</svg>`;
  }

  /* =========================================================
     Pixel cat
     ========================================================= */

  const CAT_PALETTES = {
    'pixel-1': {
      base: '#f2e3c8',
      shade: '#b9b8aa',
      patch: '#8d9092',
      dark: '#171b38',
      nose: '#a83245',
      inner: '#e9aba6'
    },
    'pixel-2': {
      base: '#b5bac9',
      shade: '#7b8295',
      patch: '#4d536b',
      dark: '#12172f',
      nose: '#992c43',
      inner: '#e7afb1'
    },
    'pixel-3': {
      base: '#efd7b5',
      shade: '#c98c5e',
      patch: '#a45c3d',
      dark: '#1a1929',
      nose: '#8e2d3b',
      inner: '#e6a49e'
    }
  };

  function pixelCatSVG(variant = 'pixel-1') {
    const p = CAT_PALETTES[variant] || CAT_PALETTES['pixel-1'];
    return `<svg viewBox="0 0 24 24" shape-rendering="crispEdges" aria-hidden="true" focusable="false">
      <rect x="5" y="3" width="4" height="4" fill="${p.base}"/>
      <rect x="15" y="3" width="4" height="4" fill="${p.base}"/>
      <rect x="6" y="4" width="2" height="2" fill="${p.inner}"/>
      <rect x="16" y="4" width="2" height="2" fill="${p.inner}"/>
      <rect x="4" y="6" width="16" height="10" fill="${p.base}"/>
      <rect x="3" y="9" width="2" height="5" fill="${p.shade}"/>
      <rect x="19" y="9" width="2" height="5" fill="${p.shade}"/>
      <rect x="6" y="15" width="12" height="3" fill="${p.base}"/>
      <rect x="4" y="6" width="5" height="3" fill="${p.patch}"/>
      <rect x="16" y="12" width="4" height="5" fill="${p.shade}"/>
      <rect x="10" y="4" width="4" height="2" fill="${p.patch}"/>
      <rect x="5" y="9" width="5" height="3" fill="${p.patch}" opacity=".48"/>
      <rect x="7" y="9" width="1" height="1" fill="${p.dark}"/>
      <rect x="8" y="10" width="2" height="1" fill="${p.dark}"/>
      <rect x="10" y="9" width="1" height="1" fill="${p.dark}"/>
      <rect x="13" y="9" width="1" height="1" fill="${p.dark}"/>
      <rect x="14" y="10" width="2" height="1" fill="${p.dark}"/>
      <rect x="16" y="9" width="1" height="1" fill="${p.dark}"/>
      <rect x="11" y="12" width="2" height="1" fill="${p.nose}"/>
      <rect x="12" y="13" width="1" height="1" fill="${p.inner}"/>
      <rect x="9" y="14" width="2" height="1" fill="${p.dark}"/>
      <rect x="13" y="14" width="2" height="1" fill="${p.dark}"/>
      <rect x="1" y="12" width="2" height="1" fill="${p.base}" opacity=".7"/>
      <rect x="21" y="12" width="2" height="1" fill="${p.base}" opacity=".7"/>
      <rect x="2" y="14" width="2" height="1" fill="${p.base}" opacity=".45"/>
      <rect x="20" y="14" width="2" height="1" fill="${p.base}" opacity=".45"/>
    </svg>`;
  }

  function avatarMarkup(avatar, size = 48, extraClass = '') {
    const value = AVATARS.includes(avatar) ? avatar : 'pixel-1';
    if (value.startsWith('pixel-')) {
      return `<span class="avatar ${value} ${extraClass}" style="--size:${size}px" aria-hidden="true">${pixelCatSVG(value)}</span>`;
    }
    return `<span class="avatar emoji ${extraClass}" style="--size:${size}px" aria-hidden="true">${esc(value)}</span>`;
  }

  function avatarHTML(cat, size = 48, extraClass = '') {
    return avatarMarkup(cat && cat.avatar, size, extraClass);
  }

  /* =========================================================
     Data shape
     ========================================================= */

  function defaultFields(values = {}) {
    return DEFAULT_FIELDS.map((field) => ({
      id: uid('field'),
      key: field.key,
      label: field.label,
      value: values[field.key] ?? '',
      type: field.type,
      placeholder: field.placeholder || ''
    }));
  }

  function makeFields(values = {}, extra = []) {
    const fields = DEFAULT_FIELDS.map((field) => ({
      id: uid('field'),
      key: field.key,
      label: field.label,
      value: values[field.key] ?? '',
      type: field.type,
      placeholder: field.placeholder || ''
    }));
    extra.forEach((field) => {
      fields.push({
        id: uid('field'),
        key: `custom_${uid('key')}`,
        label: field.label || '自定义字段',
        value: field.value ?? '',
        type: field.type || 'text',
        placeholder: field.placeholder || ''
      });
    });
    return fields;
  }

  function demoCats() {
    const today = todayISO();
    const now = Date.now();

    return [
      {
        id: 'cat_nuomi',
        name: '糯米',
        avatar: 'pixel-1',
        fields: makeFields({
          breed: '布偶猫',
          sex: '母',
          birthday: '2022-03-18',
          arrival: '2022-06-01',
          weight: '4.8 kg',
          color: '海豹双色',
          chip: '985112000123456',
          source: '好友家繁育',
          vet: '喵星动物医院',
          notes: '怕生，喜欢纸箱。听到冻干袋子的声音会立刻出现。'
        }, [
          { label: '过敏史', value: '暂无', type: 'text' },
          { label: '保险', value: '平安宠物医保', type: 'text' }
        ]),
        dewormings: [
          {
            id: 'rec_nuomi_dew_1',
            kind: '内外同驱',
            date: addDaysISO(today, -95),
            product: '大宠爱',
            dose: '1 支（2.5–7.5kg）',
            batch: '',
            hospital: '喵星动物医院',
            cost: '128',
            intervalMonths: 3,
            nextDate: addDaysISO(today, -4),
            notes: '滴颈后 48 小时不要洗澡。',
            createdAt: now - 900000
          }
        ],
        vaccines: [
          {
            id: 'rec_nuomi_vac_1',
            kind: '猫三联',
            date: addDaysISO(today, -350),
            product: '妙三多',
            dose: '',
            batch: 'M2025-118',
            hospital: '喵星动物医院',
            cost: '180',
            intervalMonths: 12,
            nextDate: addDaysISO(today, 15),
            notes: '年度加强。',
            createdAt: now - 800000
          },
          {
            id: 'rec_nuomi_vac_2',
            kind: '狂犬',
            date: addDaysISO(today, -317),
            product: '瑞比克',
            dose: '',
            batch: 'R2025-031',
            hospital: '喵星动物医院',
            cost: '120',
            intervalMonths: 12,
            nextDate: addDaysISO(today, 48),
            notes: '',
            createdAt: now - 790000
          }
        ],
        neuter: {
          status: '已绝育',
          date: '2023-04-12',
          hospital: '喵星动物医院',
          cost: '1200',
          precheck: true,
          notes: '术后恢复良好，第二天就开始正常吃饭。'
        },
        createdAt: now - 2000000
      },
      {
        id: 'cat_zhima',
        name: '芝麻',
        avatar: 'pixel-2',
        fields: makeFields({
          breed: '英国短毛猫',
          sex: '公',
          birthday: '2021-11-02',
          arrival: '2022-01-15',
          weight: '6.1 kg',
          color: '蓝乳',
          chip: '985112000654321',
          source: '领养',
          vet: '爪子诊所',
          notes: '贪吃，需要控制体重。晚上会准时蹲在厨房门口。'
        }, [
          { label: '主粮', value: '皇家室内成猫', type: 'text' },
          { label: '性格', value: '粘人但慢热', type: 'text' }
        ]),
        dewormings: [
          {
            id: 'rec_zhima_dew_1',
            kind: '体外',
            date: addDaysISO(today, -20),
            product: '福来恩',
            dose: '1 支',
            batch: '',
            hospital: '爪子诊所',
            cost: '98',
            intervalMonths: 1,
            nextDate: addDaysISO(today, 10),
            notes: '',
            createdAt: now - 700000
          }
        ],
        vaccines: [
          {
            id: 'rec_zhima_vac_1',
            kind: '猫三联',
            date: addDaysISO(today, -365),
            product: '妙三多',
            dose: '',
            batch: 'M2025-077',
            hospital: '爪子诊所',
            cost: '160',
            intervalMonths: 12,
            nextDate: today,
            notes: '今天该打年度加强。',
            createdAt: now - 600000
          },
          {
            id: 'rec_zhima_vac_2',
            kind: '狂犬',
            date: addDaysISO(today, -340),
            product: '瑞比克',
            dose: '',
            batch: 'R2025-012',
            hospital: '爪子诊所',
            cost: '110',
            intervalMonths: 12,
            nextDate: addDaysISO(today, 25),
            notes: '',
            createdAt: now - 590000
          }
        ],
        neuter: {
          status: '计划中',
          date: '',
          hospital: '',
          cost: '',
          precheck: false,
          notes: '计划 12 月安排术前检查，先控制体重。'
        },
        createdAt: now - 1900000
      }
    ];
  }

  function normaliseField(field, index) {
    const type = ['text', 'date', 'longtext', 'sex'].includes(field && field.type) ? field.type : 'text';
    return {
      id: String((field && field.id) || uid('field')),
      key: String((field && field.key) || `custom_${uid('key')}`),
      label: cleanText(field && field.label) || `字段 ${index + 1}`,
      value: field && field.value != null ? String(field.value) : '',
      type,
      placeholder: cleanText(field && field.placeholder)
    };
  }

  function normaliseFields(fields) {
    if (!Array.isArray(fields)) return defaultFields();
    return fields
      .map(normaliseField)
      .filter((field) => !(field.key === 'chip' && !field.value.trim()));
  }

  function normaliseRecord(record) {
    const date = parseISO(record && record.date) ? record.date : '';
    const nextDate = parseISO(record && record.nextDate) ? record.nextDate : '';
    const interval = Number.parseInt(record && record.intervalMonths, 10);
    return {
      id: String((record && record.id) || uid('rec')),
      kind: cleanText(record && record.kind) || '其他',
      date,
      product: cleanText(record && record.product),
      dose: cleanText(record && record.dose),
      batch: cleanText(record && record.batch),
      hospital: cleanText(record && record.hospital),
      cost: cleanCost(record && record.cost),
      intervalMonths: Number.isFinite(interval) ? clamp(interval, 0, 120) : 0,
      nextDate,
      notes: cleanText(record && record.notes),
      createdAt: Number(record && record.createdAt) || Date.now()
    };
  }

  function normaliseNeuter(neuter) {
    if (!neuter || typeof neuter !== 'object') return null;
    const status = ['未绝育', '计划中', '已绝育'].includes(neuter.status) ? neuter.status : '未绝育';
    return {
      status,
      date: parseISO(neuter.date) ? neuter.date : '',
      hospital: cleanText(neuter.hospital),
      cost: cleanCost(neuter.cost),
      precheck: Boolean(neuter.precheck),
      notes: cleanText(neuter.notes)
    };
  }

  function normaliseEvent(event) {
    if (!event || typeof event !== 'object') return null;
    const title = cleanText(event.title);
    const text = cleanText(event.text);
    if (!title && !text) return null;
    return {
      id: String(event.id || uid('event')),
      date: parseISO(event.date) ? event.date : todayISO(),
      title: title.slice(0, 40) || '事件记录',
      text: text.slice(0, 400),
      createdAt: Number(event.createdAt) || Date.now()
    };
  }

  function normaliseCat(cat) {
    return {
      id: String((cat && cat.id) || uid('cat')),
      name: cleanText(cat && cat.name).slice(0, 30) || '未命名猫咪',
      avatar: AVATARS.includes(cat && cat.avatar) ? cat.avatar : 'pixel-1',
      fields: normaliseFields(cat && cat.fields),
      dewormings: Array.isArray(cat && cat.dewormings) ? cat.dewormings.map(normaliseRecord).slice(0, MAX_RECORDS) : [],
      vaccines: Array.isArray(cat && cat.vaccines) ? cat.vaccines.map(normaliseRecord).slice(0, MAX_RECORDS) : [],
      events: Array.isArray(cat && cat.events) ? cat.events.map(normaliseEvent).filter(Boolean).slice(0, MAX_RECORDS) : [],
      neuter: normaliseNeuter(cat && cat.neuter),
      createdAt: Number(cat && cat.createdAt) || Date.now()
    };
  }

  function normaliseStore(raw) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.cats)) {
      throw new Error('文件格式不正确：缺少 cats 数组');
    }
    const cats = raw.cats.map(normaliseCat).filter((cat) => cat.name);
    const updatedAt = Number(raw.updatedAt) || Date.parse(raw.updatedAt) || 0;
    return {
      version: 1,
      cats,
      settings: normaliseLook(raw.settings),
      updatedAt
    };
  }

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return { version: 1, cats: demoCats(), settings: defaultLook(), updatedAt: 0 };
      }
      return normaliseStore(JSON.parse(raw));
    } catch (error) {
      console.warn('MEOW SYSTEM: 无法读取本地数据，使用示例数据。', error);
      return { version: 1, cats: demoCats(), settings: defaultLook(), updatedAt: 0 };
    }
  }

  function isDemoStore(value) {
    if (!value || !Array.isArray(value.cats) || value.cats.length !== 2) return false;
    const ids = value.cats.map((cat) => cat.id).sort().join('|');
    if (ids !== ['cat_nuomi', 'cat_zhima'].sort().join('|')) return false;
    const names = value.cats.map((cat) => cat.name).sort().join('|');
    if (names !== ['糯米', '芝麻'].sort().join('|')) return false;
    const recordIds = value.cats
      .flatMap((cat) => [...cat.dewormings, ...cat.vaccines].map((record) => record.id))
      .sort();
    const demoRecordIds = [
      'rec_nuomi_dew_1',
      'rec_nuomi_vac_1',
      'rec_nuomi_vac_2',
      'rec_zhima_dew_1',
      'rec_zhima_vac_1',
      'rec_zhima_vac_2'
    ].sort();
    return recordIds.length === demoRecordIds.length
      && recordIds.every((id, index) => id === demoRecordIds[index]);
  }

  let store = loadStore();
  let storageWarningShown = false;
  let serverAvailable = false;
  let serverHasData = false;
  let serverSaveTimer = null;
  let serverSaveInFlight = false;
  let serverSaveQueued = false;
  let serverSaveErrorShown = false;

  function writeLocalStore() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 1,
        cats: store.cats,
        settings: store.settings,
        updatedAt: Number(store.updatedAt) || 0
      }));
      return true;
    } catch (error) {
      console.warn('MEOW SYSTEM: 浏览器本地存储写入失败。', error);
      return false;
    }
  }

  function persist(showError = true) {
    store.updatedAt = Date.now();
    const localOk = writeLocalStore();
    scheduleServerSave();

    if (!localOk && !serverAvailable && showError && !storageWarningShown) {
      storageWarningShown = true;
      showToast('本地存储不可用，刷新后数据可能丢失');
    }
    return localOk || serverAvailable;
  }

  function scheduleServerSave(delay = 260) {
    if (!serverAvailable) return;
    if (serverSaveTimer) window.clearTimeout(serverSaveTimer);
    serverSaveTimer = window.setTimeout(() => {
      serverSaveTimer = null;
      pushServerData();
    }, delay);
  }

  async function pushServerData() {
    if (!serverAvailable) return;
    if (serverSaveInFlight) {
      serverSaveQueued = true;
      return;
    }

    serverSaveInFlight = true;
    const payload = {
      version: 1,
      cats: store.cats,
      settings: store.settings,
      updatedAt: Number(store.updatedAt) || Date.now()
    };

    try {
      const response = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (!result || result.ok !== true) {
        throw new Error(result && result.error ? result.error : '保存失败');
      }
      serverHasData = true;
    } catch (error) {
      if (!serverSaveErrorShown) {
        serverSaveErrorShown = true;
        showToast('无法写入 data.json，当前数据已保存在浏览器');
      }
    } finally {
      serverSaveInFlight = false;
      if (serverSaveQueued) {
        serverSaveQueued = false;
        scheduleServerSave(0);
      }
    }
  }

  async function hydrateFromServer() {
    if (location.protocol === 'file:') return false;

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 1200);
    try {
      const response = await fetch('/api/data', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || !contentType.includes('application/json')) return false;
      const result = await response.json();
      if (!result || result.ok !== true) return false;

      serverAvailable = true;
      const serverData = result.data;

      if (serverData && Array.isArray(serverData.cats)) {
        let next;
        try {
          next = normaliseStore(serverData);
        } catch (error) {
          serverAvailable = false;
          return false;
        }
        const localUpdated = Number(store.updatedAt) || 0;
        const serverUpdated = Number(next.updatedAt) || 0;

        if (localUpdated > serverUpdated && !isDemoStore(store)) {
          store.updatedAt = localUpdated;
          writeLocalStore();
          scheduleServerSave(0);
        } else {
          store = next;
          ensureSelection();
          writeLocalStore();
          serverHasData = true;
        }
      } else {
        serverHasData = false;
        if (!isDemoStore(store)) {
          store.updatedAt = Date.now();
          writeLocalStore();
          scheduleServerSave(0);
        }
      }
      return true;
    } catch (error) {
      return false;
    } finally {
      window.clearTimeout(timer);
    }
  }

  const ui = {
    tab: 'home',
    view: 'tabs',
    selectedCatId: store.cats[0] ? store.cats[0].id : null,
    detailCatId: null,
    filter: 'all',
    monthFilter: { events: 'all', deworm: 'all' },
    pendingSection: null,
    returnScroll: 0
  };

  function catById(id) {
    return store.cats.find((cat) => cat.id === id) || null;
  }

  function ensureSelection() {
    if (ui.selectedCatId && catById(ui.selectedCatId)) return;
    ui.selectedCatId = store.cats[0] ? store.cats[0].id : null;
  }

  function selectedCat() {
    ensureSelection();
    return catById(ui.selectedCatId);
  }

  function getFieldValue(cat, key) {
    const field = cat && cat.fields.find((item) => item.key === key);
    return field ? String(field.value || '').trim() : '';
  }

  function fieldByKey(cat, key) {
    return cat && cat.fields.find((item) => item.key === key) || null;
  }

  function allRecordCount() {
    return store.cats.reduce((total, cat) => {
      return total + cat.dewormings.length + cat.vaccines.length + (cat.neuter ? 1 : 0);
    }, 0);
  }

  function storageKB() {
    try {
      return Math.max(0.1, Math.round(JSON.stringify(store).length / 1024 * 10) / 10);
    } catch (error) {
      return 0;
    }
  }

  /* =========================================================
     Reminder engine
     ========================================================= */

  function compareRecord(a, b) {
    const dateCompare = String(a.date || '').localeCompare(String(b.date || ''));
    if (dateCompare !== 0) return dateCompare;
    return (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0);
  }

  function sortRecordsDesc(a, b) {
    const dateCompare = String(b.date || '').localeCompare(String(a.date || ''));
    if (dateCompare !== 0) return dateCompare;
    return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0);
  }

  function latestRecordsByKind(records) {
    const map = new Map();
    records.forEach((record) => {
      const kind = record.kind || '其他';
      const previous = map.get(kind);
      if (!previous || compareRecord(record, previous) > 0) {
        map.set(kind, record);
      }
    });
    return Array.from(map.entries()).map(([kind, record]) => ({ kind, record }));
  }

  function reminderFromRecord(cat, type, kind, record) {
    const nextDate = record.nextDate || (record.intervalMonths ? addMonthsISO(record.date, record.intervalMonths) : '');
    if (!nextDate) return null;
    const due = dueInfo(nextDate);
    return {
      key: `${cat.id}:${type}:${record.id}`,
      catId: cat.id,
      cat,
      type,
      kind,
      recordId: record.id,
      dueDate: nextDate,
      tone: due.tone,
      dueLabel: due.label,
      diff: due.diff,
      title: kind,
      subtitle: record.product || (type === 'deworm' ? '驱虫记录' : '疫苗记录')
    };
  }

  function remindersForCat(cat) {
    const reminders = [];
    ['deworm', 'vaccine'].forEach((type) => {
      const records = type === 'deworm' ? cat.dewormings : cat.vaccines;
      latestRecordsByKind(records).forEach(({ kind, record }) => {
        const reminder = reminderFromRecord(cat, type, kind, record);
        if (reminder) reminders.push(reminder);
      });
    });

    if (cat.neuter && cat.neuter.status === '计划中') {
      reminders.push({
        key: `${cat.id}:neuter:plan`,
        catId: cat.id,
        cat,
        type: 'neuter',
        kind: '绝育计划',
        recordId: null,
        dueDate: '',
        tone: 'plan',
        dueLabel: '待安排',
        diff: null,
        title: '绝育计划',
        subtitle: cat.neuter.notes || '尚未安排手术日期'
      });
    }
    return reminders;
  }

  function reminderPriority(reminder) {
    return REMINDER_TONE_PRIORITY[reminder.tone] ?? 5;
  }

  function sortReminders(a, b) {
    const priority = reminderPriority(a) - reminderPriority(b);
    if (priority !== 0) return priority;
    const dateCompare = String(a.dueDate || '9999-12-31').localeCompare(String(b.dueDate || '9999-12-31'));
    if (dateCompare !== 0) return dateCompare;
    return String(a.cat.name).localeCompare(String(b.cat.name), 'zh-CN');
  }

  function allReminders() {
    return store.cats.flatMap(remindersForCat).sort(sortReminders);
  }

  function actionableReminders() {
    return allReminders().filter((reminder) => (
      reminder.type !== 'neuter' && ['overdue', 'today', 'soon'].includes(reminder.tone)
    ));
  }

  function moduleDue(cat, type) {
    if (type === 'neuter') {
      const status = cat.neuter ? cat.neuter.status : '';
      if (status === '已绝育') return { tone: 'soon', label: '已绝育', count: 1, first: null };
      if (status === '计划中') return { tone: 'plan', label: '待安排', count: 1, first: null };
      if (status === '未绝育') return { tone: 'later', label: '未绝育', count: 1, first: null };
      return { tone: 'none', label: '未记录', count: 0, first: null };
    }

    const list = remindersForCat(cat).filter((reminder) => reminder.type === type).sort(sortReminders);
    if (!list.length) {
      const records = type === 'deworm' ? cat.dewormings : cat.vaccines;
      return { tone: 'none', label: records.length ? '未设下次' : '未记录', count: 0, first: null };
    }
    const first = list[0];
    return {
      tone: first.tone,
      label: list.length > 1 ? `${list.length} 项 · ${first.dueLabel}` : first.dueLabel,
      count: list.length,
      first
    };
  }

  function neuterStatus(cat) {
    return cat.neuter && cat.neuter.status ? cat.neuter.status : '未记录';
  }

  function neuterTone(cat) {
    if (!cat.neuter) return 'none';
    if (cat.neuter.status === '已绝育') return 'soon';
    if (cat.neuter.status === '计划中') return 'plan';
    if (cat.neuter.status === '未绝育') return 'later';
    return 'none';
  }

  function catAge(cat) {
    return ageText(getFieldValue(cat, 'birthday'));
  }

  function catWeight(cat) {
    return getFieldValue(cat, 'weight') || '—';
  }

  function monthKey(iso) {
    const date = parseISO(iso);
    return date ? `${date.getFullYear()}-${pad2(date.getMonth() + 1)}` : '';
  }

  function monthLabel(key) {
    return `${key.slice(0, 4)}年${Number(key.slice(5))}月`;
  }

  function monthOptions(records) {
    const keys = new Set();
    records.forEach((record) => {
      const key = monthKey(record.date);
      if (key) keys.add(key);
    });
    return Array.from(keys).sort((a, b) => b.localeCompare(a)).map((key) => ({ key, label: monthLabel(key) }));
  }

  function filterByMonth(records, scope) {
    const key = ui.monthFilter[scope];
    if (!key || key === 'all') return records;
    const hit = records.filter((record) => monthKey(record.date) === key);
    // 选中的月份在这份数据里已不存在（切猫/删记录）时回退到全部，避免下拉显示与列表不一致
    if (!hit.length && !records.some((record) => monthKey(record.date) === key)) return records;
    return hit;
  }

  function renderMonthPick(scope, records) {
    const options = monthOptions(records);
    if (!options.length) return '';
    const picked = options.some((option) => option.key === ui.monthFilter[scope]) ? ui.monthFilter[scope] : 'all';
    return `<label class="month-pick">
      <select class="month-select" data-month-filter="${scope}" aria-label="选择月份">
        <option value="all"${picked === 'all' ? ' selected' : ''}>全部月份</option>
        ${options.map((option) => `<option value="${option.key}"${picked === option.key ? ' selected' : ''}>${option.label}</option>`).join('')}
      </select>
      ${icon('chevronDown', 11)}
    </label>`;
  }

  function catTags(cat) {
    const tags = [];
    const sex = getFieldValue(cat, 'sex');
    if (sex) {
      tags.push({ label: sex, cls: '' });
    }
    const breed = getFieldValue(cat, 'breed');
    if (breed) tags.push({ label: breed, cls: '' });
    const birthday = getFieldValue(cat, 'birthday');
    if (birthday) tags.push({ label: ageText(birthday), cls: '' });
    const weight = getFieldValue(cat, 'weight');
    if (weight) tags.push({ label: `体重 ${weight}`, cls: '' });
    return tags;
  }

  function tagMarkup(tags) {
    return tags.map((tag) => `<span class="tag ${tag.cls || ''}">${esc(tag.label)}</span>`).join('');
  }

  function catActivity(cat) {
    const items = [];
    cat.dewormings.forEach((record) => {
      items.push({
        type: 'deworm',
        date: record.date,
        createdAt: record.createdAt,
        record
      });
    });
    cat.vaccines.forEach((record) => {
      items.push({
        type: 'vaccine',
        date: record.date,
        createdAt: record.createdAt,
        record
      });
    });
    if (cat.neuter && cat.neuter.date) {
      items.push({
        type: 'neuter',
        date: cat.neuter.date,
        createdAt: 0,
        record: cat.neuter
      });
    }
    return items
      .filter((item) => item.date)
      .sort((a, b) => {
        const dateCompare = String(b.date).localeCompare(String(a.date));
        if (dateCompare !== 0) return dateCompare;
        return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0);
      });
  }

  /* =========================================================
     Render: shared
     ========================================================= */

  function renderTabbar() {
    const count = actionableReminders().length;
    const tabs = [
      { id: 'home', label: '首页', icon: 'home' },
      { id: 'reminders', label: '提醒', icon: 'bell' },
      { id: 'settings', label: '我的', icon: 'user' }
    ];

    return `<nav class="tabbar" aria-label="主导航">
      ${tabs.map((tab) => {
        const active = ui.tab === tab.id;
        const showBadge = tab.id === 'reminders' && count > 0;
        return `<button type="button" class="tab ${active ? 'active' : ''}" data-action="tab" data-tab="${tab.id}" ${active ? 'aria-current="page"' : ''} aria-label="${tab.label}${showBadge ? `，${count} 项待办` : ''}">
          ${icon(tab.icon, 21)}
          <span>${tab.label}</span>
          ${showBadge ? `<span class="tab-badge">${count > 9 ? '9+' : count}</span>` : ''}
        </button>`;
      }).join('')}
    </nav>`;
  }

  function renderCatSwitcher() {
    const chips = store.cats.map((cat) => {
      const active = cat.id === ui.selectedCatId;
      const hasDue = remindersForCat(cat).some((reminder) => ['overdue', 'today', 'soon'].includes(reminder.tone));
      return `<button type="button" class="cat-chip ${active ? 'active' : ''}" data-action="select-cat" data-id="${esc(cat.id)}" role="tab" aria-selected="${active}">
        ${avatarMarkup(cat.avatar, 30)}
        <span>${esc(cat.name)}</span>
        ${hasDue ? '<span class="chip-dot" aria-label="有待办"></span>' : ''}
      </button>`;
    }).join('');

    return `<div class="cat-switcher" role="tablist" aria-label="选择猫咪">
      ${chips}
      <button type="button" class="cat-chip add" data-action="add-cat">${icon('plus', 13)} 新猫</button>
    </div>`;
  }

  function renderCatHero(cat, options) {
    const opts = options || {};
    const withActions = opts.actions !== false;
    return `<article class="cat-hero paper-card">
      <div class="cat-hero-top">
        ${avatarHTML(cat, 74, 'lg')}
        <div class="cat-id">
          <div class="micro">档案 ${String(store.cats.findIndex((item) => item.id === cat.id) + 1).padStart(2, '0')}</div>
          <div class="cat-name-row">
            <h2>${esc(cat.name)}</h2>
            ${withActions ? `<div class="hero-actions">
              <button type="button" class="link-btn hero-full-link" data-action="open-detail" data-id="${esc(cat.id)}">完整档案 ${icon('chevronRight', 12)}</button>
              <button type="button" class="round-btn small edit-corner" data-action="edit-cat" data-id="${esc(cat.id)}" aria-label="编辑 ${esc(cat.name)} 的档案">${icon('edit', 13)}</button>
            </div>` : ''}
          </div>
          <div class="tag-row">${tagMarkup(catTags(cat))}</div>
        </div>
      </div>
    </article>`;
  }

  function moduleTile(cat, type, options) {
    const opts = options || {};
    const withAdd = opts.add !== false;
    const inDetail = opts.inDetail === true;
    const due = moduleDue(cat, type);
    const addAction = type === 'neuter' ? 'edit-neuter' : 'add-record';
    const iconName = type === 'deworm' ? 'pill' : type === 'vaccine' ? 'syringe' : 'scissors';
    const action = inDetail ? 'scroll-section' : 'open-detail';
    return `<div class="module-tile ${type}" role="button" tabindex="0" data-action="${action}" data-id="${esc(cat.id)}" data-section="${type}" aria-label="查看${TYPE_LABEL[type]}记录">
      ${withAdd ? `<button type="button" class="module-add" data-action="${addAction}" data-type="${type}" data-cat="${esc(cat.id)}" aria-label="添加${TYPE_LABEL[type]}记录">${icon('plus', 13)}</button>` : ''}
      <div class="module-row">
        <div class="module-icon">${icon(iconName, 16)}</div>
        <strong>${TYPE_LABEL[type]}</strong>
      </div>
      <span class="module-due ${due.tone}">${esc(due.label)}</span>
    </div>`;
  }

  function renderModuleGrid(cat, options) {
    const opts = options || {};
    return `<div class="module-grid${opts.className ? ` ${opts.className}` : ''}">
      ${moduleTile(cat, 'deworm', opts)}
      ${moduleTile(cat, 'vaccine', opts)}
      ${moduleTile(cat, 'neuter', opts)}
    </div>`;
  }

  function timelineItem(item) {
    const record = item.record;
    let title = '';
    let meta = '';

    if (item.type === 'neuter') {
      title = '绝育手术';
      meta = [record.hospital, record.status].filter(Boolean).join(' · ');
    } else {
      title = [record.product || record.kind, record.kind].filter(Boolean).join(' · ');
      meta = [record.hospital, record.nextDate ? `下次 ${fmtDot(record.nextDate)}` : ''].filter(Boolean).join(' · ');
    }

    return `<div class="timeline-item ${item.type}">
      <div class="t-date">${fmtDot(item.date)} · ${TYPE_LABEL[item.type]}</div>
      <div class="t-title">${esc(title)}</div>
      ${meta ? `<div class="t-meta">${esc(meta)}</div>` : ''}
    </div>`;
  }

  function renderRecent(cat) {
    const items = catActivity(cat).slice(0, 3);
    return `<div class="section-head">
      <div class="head-copy"><h2>最近动态<span class="head-hint">（预览三条）</span></h2></div>
      <button type="button" class="link-btn" data-action="open-detail" data-id="${esc(cat.id)}" data-section="deworm">完整动态 ${icon('chevronRight', 13)}</button>
    </div>
    <div class="list-card">
      ${items.length ? `<div class="timeline">${items.map(timelineItem).join('')}</div>` : `<div class="empty"><p>还没有健康记录。打开档案后可以添加驱虫、疫苗和绝育记录。</p></div>`}
    </div>`;
  }

  function sortEventsDesc(a, b) {
    const dateCompare = String(b.date).localeCompare(String(a.date));
    if (dateCompare !== 0) return dateCompare;
    return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0);
  }

  function renderEventRow(cat, event) {
    return `<div class="event-row">
      <div class="event-top">
        <span class="event-date">${fmtDot(event.date)}</span>
        <button type="button" class="icon-btn tiny" data-action="edit-event" data-cat="${esc(cat.id)}" data-event="${esc(event.id)}" aria-label="编辑这条事件">${icon('edit', 12)}</button>
      </div>
      <div class="event-title">${esc(event.title)}</div>
      ${event.text ? `<div class="event-text">${esc(event.text)}</div>` : ''}
    </div>`;
  }

  function renderEvents(cat, limit = 3) {
    const events = (cat.events || []).slice().sort(sortEventsDesc);
    const shown = limit ? events.slice(0, limit) : events;
    return `<div class="section-head">
      <div class="head-copy"><h2>猫咪事件<span class="head-hint">（预览三条）</span></h2></div>
      <div class="head-actions-inline">
        <button type="button" class="link-btn" data-action="add-event" data-cat="${esc(cat.id)}">${icon('plus', 12)} 记录</button>
        <button type="button" class="link-btn" data-action="open-detail" data-id="${esc(cat.id)}" data-section="events">完整记录 ${icon('chevronRight', 13)}</button>
      </div>
    </div>
    ${shown.length ? `<div class="event-list">${shown.map((event) => renderEventRow(cat, event)).join('')}</div>` : `<div class="empty"><p>还没有事件记录。可以记下洗澡、剪指甲、看医生、打翻花瓶……任何值得留下的事。</p></div>`}`;
  }

  function renderEventSection(cat) {
    const all = (cat.events || []).slice().sort(sortEventsDesc);
    const events = filterByMonth(all, 'events');
    const emptyText = all.length
      ? '这个月还没有事件记录。切换月份看看别的记录。'
      : '还没有事件记录。添加一件事，记下时间、标题和经过。';
    return `<section class="record-section" id="section-events">
      <div class="module-head">
        <div class="module-icon events">${icon('note', 17)}</div>
        <div class="module-title">
          <h2>猫咪事件</h2>
        </div>
        ${renderMonthPick('events', all)}
        <button type="button" class="btn small ghost" data-action="add-event" data-cat="${esc(cat.id)}">${icon('plus', 12)} 记录</button>
      </div>
      ${events.length
        ? `<div class="event-list all">${events.map((event) => renderEventRow(cat, event)).join('')}</div>`
        : `<div class="empty"><p>${emptyText}</p></div>`}
    </section>`;
  }

  function renderEmptyCats() {
    return `<div class="empty">
      <div class="empty-art">${pixelCatSVG('pixel-3')}</div>
      <strong>还没有猫咪档案</strong>
      <p>先添加第一只猫，再记录驱虫、疫苗和绝育。所有数据只保存在这台设备。</p>
      <button type="button" class="btn primary" data-action="add-cat">${icon('plus', 14)} 添加第一只猫</button>
    </div>`;
  }

  /* =========================================================
     Render: tabs
     ========================================================= */

  function renderHome() {
    const cat = selectedCat();

    return `<header class="page-head">
      <div>
        <div class="eyebrow">${greeting()} · ${fmtDot(todayISO())}</div>
        <h1>猫咪档案</h1>
      </div>
    </header>
    ${renderCatSwitcher()}
    ${cat ? renderHomeCard(cat) : renderEmptyCats()}
    ${cat ? renderEvents(cat) : ''}
    ${cat ? renderRecent(cat) : ''}`;
  }

  function renderHomeCard(cat) {
    return `<div class="home-card paper-card">
      ${renderCatHero(cat)}
      ${renderModuleGrid(cat)}
    </div>`;
  }

  function renderReminderCard(reminder) {
    const cat = reminder.cat;
    let action = '';

    if (reminder.type === 'neuter') {
      action = `<button type="button" class="btn-complete ghost" data-action="edit-neuter" data-cat="${esc(cat.id)}">安排</button>`;
    } else if (reminder.tone === 'later') {
      action = `<button type="button" class="btn-complete ghost" data-action="open-detail" data-id="${esc(cat.id)}" data-section="${reminder.type}">查看</button>`;
    } else {
      action = `<button type="button" class="btn-complete" data-action="complete-reminder" data-cat="${esc(cat.id)}" data-type="${reminder.type}" data-record="${esc(reminder.recordId)}">完成</button>`;
    }

    return `<div class="reminder-card ${reminder.tone}">
      ${avatarHTML(cat, 38)}
      <div class="r-copy">
        <strong>${esc(cat.name)} · ${esc(reminder.kind)}</strong>
        <span>${esc(reminder.subtitle)}${reminder.dueDate ? ` · ${fmtDot(reminder.dueDate)}` : ''}</span>
      </div>
      <div class="r-actions">
        <span class="r-date">${esc(reminder.dueLabel)}</span>
        ${action}
      </div>
    </div>`;
  }

  function renderReminders() {
    const filters = [
      { id: 'all', label: '全部' },
      { id: 'deworm', label: '驱虫' },
      { id: 'vaccine', label: '疫苗' },
      { id: 'neuter', label: '绝育' }
    ];

    const all = allReminders().sort(sortReminders);
    const filtered = ui.filter === 'all' ? all : all.filter((reminder) => reminder.type === ui.filter);
    const actionable = filtered.filter((reminder) => (
      reminder.type !== 'neuter' && ['overdue', 'today', 'soon'].includes(reminder.tone)
    ));

    const groups = { overdue: [], today: [], soon: [], later: [], plan: [] };
    filtered.forEach((reminder) => {
      if (!groups[reminder.tone]) groups[reminder.tone] = [];
      groups[reminder.tone].push(reminder);
    });

    let groupMarkup = '';
    ['overdue', 'today', 'soon', 'later', 'plan'].forEach((tone) => {
      const items = groups[tone];
      if (!items || !items.length) return;
      groupMarkup += `<div class="reminder-group">
        <div class="reminder-group-title">${REMINDER_GROUP_TITLE[tone]} · ${items.length}</div>
        ${items.map(renderReminderCard).join('')}
      </div>`;
    });

    const empty = `<div class="empty">
      <div class="empty-art">${pixelCatSVG('pixel-2')}</div>
      <strong>${all.length ? '这个分类还没有提醒' : '暂时没有提醒'}</strong>
      <p>${all.length ? '切换到「全部」看看其他猫的计划。' : '添加驱虫或疫苗记录后，下次日期会自动出现在这里。'}</p>
    </div>`;

    return `<header class="page-head">
      <div>
        <div class="eyebrow">提醒 · ${String(filtered.length).padStart(2, '0')} 项</div>
        <h1>提醒</h1>
      </div>
    </header>

    <div class="filter-chips" role="tablist" aria-label="筛选提醒">
      ${filters.map((filter) => `<button type="button" class="filter-chip ${ui.filter === filter.id ? 'active' : ''}" data-action="filter-reminders" data-filter="${filter.id}" role="tab" aria-selected="${ui.filter === filter.id}">${filter.label}</button>`).join('')}
    </div>

    <div class="reminder-summary">
      <div class="rs-copy">
        <div class="micro light">系统检查</div>
        <strong>${actionable.length ? `${actionable.length} 项需要处理` : '没有紧急待办'}</strong>
        <span>${actionable.length ? '逾期优先 · 完成后会自动生成下次记录' : '可以提前看看之后的计划'}</span>
      </div>
      <div class="rs-count">${String(actionable.length).padStart(2, '0')}</div>
    </div>

    ${groupMarkup || empty}
    <div class="screen-footer">提醒已同步 · ${fmtDot(todayISO())}</div>`;
  }

  function renderSettings() {
    const look = normaliseLook(store.settings);
    const accent = look.accent;
    const background = look.background;
    const panel = look.panel;
    const veilPercent = Math.round(background.veil * 100);
    const records = allRecordCount();
    const storageMode = serverAvailable ? '服务器' : '浏览器';

    return `<header class="page-head">
      <div>
        <div class="eyebrow">我的 · 设置</div>
        <h1>我的</h1>
      </div>
      <div class="head-actions">
        <button type="button" class="round-btn" data-action="tab" data-tab="home" aria-label="回到首页">${icon('home', 18)}</button>
      </div>
    </header>

    <section class="system-panel">
      <div class="sys-label"><span>系统</span><span>● 就绪</span></div>
      <div class="sys-grid">
        <div class="sys-mini"><span>猫咪</span><strong>${store.cats.length} 只</strong></div>
        <div class="sys-mini"><span>记录</span><strong>${records} 条</strong></div>
        <div class="sys-mini"><span>存储</span><strong>${storageMode}</strong></div>
        <div class="sys-mini"><span>备份</span><strong>JSON</strong></div>
      </div>
    </section>

    <div class="settings-group">
      <div class="settings-group-title">外观</div>
      <div class="appearance-card">
        <div class="appearance-label"><span>系统色</span><span class="hint">${esc(lookAccentLabel(accent))}</span></div>
        <div class="swatch-row" role="group" aria-label="系统色预设">
          ${accentSwatches(accent)}
        </div>
        ${customAccentRow(accent)}
        <div class="appearance-sep"></div>
        <div class="appearance-label"><span>组件色</span><span class="hint">${panel.color.toUpperCase()} · ${Math.round(panel.alpha * 100)}%</span></div>
        ${panelColorRow(panel)}
        <div class="appearance-sep"></div>
        <div class="appearance-label"><span>背景图</span><span class="hint">${background.preset === 'custom' ? '我的照片' : background.preset === 'plain' ? '无照片' : '拼贴照片'}</span></div>
        <div class="bg-grid" role="group" aria-label="背景图">
          ${backgroundTiles(background)}
        </div>
        ${background.preset === 'plain' ? '' : `<div class="veil-row">
          <span>薄纱</span>
          <input type="range" min="15" max="75" step="1" value="${veilPercent}" data-veil aria-label="背景薄纱浓度">
          <span class="veil-value" data-veil-value>${veilPercent}%</span>
        </div>`}
      </div>
    </div>

    <div class="settings-group">
      <div class="settings-group-title">数据</div>
      <div class="settings-card">
        <button type="button" class="setting-row" data-action="export">
          <span class="setting-icon">${icon('download', 16)}</span>
          <span class="setting-copy"><strong>导出 JSON 备份</strong><span>下载完整数据文件，换设备时用得上</span></span>
          <span class="chev">${icon('chevronRight', 14)}</span>
        </button>
        <button type="button" class="setting-row" data-action="import">
          <span class="setting-icon">${icon('upload', 16)}</span>
          <span class="setting-copy"><strong>导入 JSON 备份</strong><span>选择之前导出的文件，覆盖当前数据</span></span>
          <span class="chev">${icon('chevronRight', 14)}</span>
        </button>
        <button type="button" class="setting-row" data-action="reset-demo">
          <span class="setting-icon">${icon('refresh', 16)}</span>
          <span class="setting-copy"><strong>恢复示例数据</strong><span>重新生成糯米和芝麻的演示档案</span></span>
          <span class="chev">${icon('chevronRight', 14)}</span>
        </button>
        <button type="button" class="setting-row danger" data-action="clear-data">
          <span class="setting-icon">${icon('trash', 16)}</span>
          <span class="setting-copy"><strong>清空全部数据</strong><span>删除所有猫咪和健康记录</span></span>
          <span class="chev">${icon('chevronRight', 14)}</span>
        </button>
      </div>
    </div>`;
  }

  /* =========================================================
     Render: cat detail
     ========================================================= */

  function renderDetailHero(cat) {
    return `<div class="home-card paper-card detail-summary">
      ${renderCatHero(cat, { actions: false })}
      ${renderModuleGrid(cat, { add: false, inDetail: true })}
    </div>`;
  }

  function fieldEntries(fields) {
    const entries = fields.map((field) => {
      const raw = String(field.value || '').trim();
      return {
        field,
        display: field.type === 'date' ? fmtDot(raw) : raw,
        empty: !raw,
        span: field.type === 'longtext' || raw.length > 28
      };
    });

    let column = 0;
    entries.forEach((entry, index) => {
      if (entry.span) {
        if (column === 1 && index > 0) entries[index - 1].span = true;
        column = 0;
      } else {
        column = (column + 1) % 2;
      }
    });
    if (column === 1 && entries.length) entries[entries.length - 1].span = true;
    return entries;
  }

  function renderFieldGrid(fields) {
    const entries = fieldEntries(fields);
    if (!entries.length) return '';

    // 拆成显式的行：整行字段独占一行，其余两两成行。
    // 这样每行边界由 CSS 的 border-bottom 绘制，格子本身可以保持透明。
    const rows = [];
    let pending = null;
    entries.forEach((entry) => {
      if (entry.span) {
        if (pending) { rows.push([pending]); pending = null; }
        rows.push([entry, null]);
        return;
      }
      if (!pending) { pending = entry; return; }
      rows.push([pending, entry]);
      pending = null;
    });
    if (pending) rows.push([pending, null]);

    const cell = (entry) => {
      if (!entry) return '<div class="field field-empty" aria-hidden="true"></div>';
      return `<div class="field">
        <span>${esc(entry.field.label)}</span>
        <strong class="${entry.empty ? 'muted' : ''}">${entry.empty ? '—' : esc(entry.display)}</strong>
      </div>`;
    };

    return `<div class="field-grid">
      ${rows.map((row) => `<div class="field-row${row[1] === null ? ' single' : ''}">${cell(row[0])}${row[1] === null ? '' : cell(row[1])}</div>`).join('')}
    </div>`;
  }

  function renderInfoCard(cat) {
    return `<section class="info-card">
      <div class="section-head">
        <div class="head-copy"><h2>基础档案</h2></div>
        <button type="button" class="link-btn" data-action="edit-cat" data-id="${esc(cat.id)}">编辑字段</button>
      </div>
      ${cat.fields.length ? renderFieldGrid(cat.fields) : `<div class="empty"><p>还没有档案字段，点「编辑字段」添加品种、生日、体重等信息。</p></div>`}
    </section>`;
  }

  function renderNextStrip(cat, type, reminder) {
    return `<div class="next-strip ${reminder.tone}">
      <div class="ns-copy">
        <strong>${esc(reminder.kind)} · ${esc(reminder.dueLabel)}</strong>
        <span>下次 ${fmtDot(reminder.dueDate)}${reminder.subtitle ? ` · ${esc(reminder.subtitle)}` : ''}</span>
      </div>
      <button type="button" class="btn-complete" data-action="complete-reminder" data-cat="${esc(cat.id)}" data-type="${type}" data-record="${esc(reminder.recordId)}">${icon('check', 11)}完成</button>
    </div>`;
  }

  function renderRecordRow(cat, type, record, latest) {
    const due = record.nextDate ? dueInfo(record.nextDate) : null;
    const product = record.product || record.kind;
    const meta = [];
    if (record.kind) meta.push(record.kind);
    if (type === 'deworm' && record.dose) meta.push(record.dose);
    if (type === 'vaccine' && record.batch) meta.push(`批号 ${record.batch}`);
    if (record.hospital) meta.push(record.hospital);

    return `<div class="swipe-shell" data-open="0" data-record-id="${esc(record.id)}">
      <button type="button" class="swipe-delete" data-action="delete-record" data-cat="${esc(cat.id)}" data-type="${type}" data-record="${esc(record.id)}" aria-label="删除这条记录">
        ${icon('trash', 16)}
        <span>删除</span>
      </button>
      <div class="swipe-content">
        <div class="rec-date"><b>${fmtDay(record.date)}</b><span>${fmtMonth(record.date)}</span></div>
        <div class="rec-copy">
          <div class="rec-title">
            <strong>${esc(product)}</strong>
            ${latest ? '<span class="latest-tag">最新</span>' : ''}
          </div>
          <div class="rec-meta">${meta.map((item) => `<span>${esc(item)}</span>`).join('<span class="sep"></span>')}</div>
          ${due ? `<span class="rec-next ${due.tone}">下次 ${fmtDot(record.nextDate)} · ${due.label}</span>` : ''}
        </div>
        <div class="rec-actions">
          ${latest ? `<button type="button" class="icon-btn check" data-action="complete-record" data-cat="${esc(cat.id)}" data-type="${type}" data-record="${esc(record.id)}" title="完成并生成下次记录" aria-label="完成并生成下次记录">${icon('check', 14)}</button>` : ''}
          <button type="button" class="icon-btn" data-action="edit-record" data-cat="${esc(cat.id)}" data-type="${type}" data-record="${esc(record.id)}" title="编辑记录" aria-label="编辑记录">${icon('edit', 13)}</button>
        </div>
      </div>
    </div>`;
  }

  function renderModuleSection(cat, type) {
    const records = type === 'deworm' ? cat.dewormings : cat.vaccines;
    const all = records.slice().sort(sortRecordsDesc);
    const sorted = filterByMonth(all, type);
    const latest = latestRecordsByKind(records);
    const latestIds = new Set(latest.map((item) => item.record.id));
    const reminders = remindersForCat(cat).filter((reminder) => reminder.type === type).sort(sortReminders);
    const iconName = type === 'deworm' ? 'pill' : 'syringe';

    return `<section class="record-section" id="section-${type}">
      <div class="module-head">
        <div class="module-icon ${type}">${icon(iconName, 17)}</div>
        <div class="module-title">
          <h2>${TYPE_LABEL[type]}记录</h2>
        </div>
        ${type === 'deworm' ? renderMonthPick('deworm', all) : ''}
        <button type="button" class="btn small ghost" data-action="add-record" data-type="${type}" data-cat="${esc(cat.id)}">${icon('plus', 12)} 记录</button>
      </div>
      ${reminders.map((reminder) => renderNextStrip(cat, type, reminder)).join('')}
      ${sorted.length
        ? `<div class="record-list">${sorted.map((record) => renderRecordRow(cat, type, record, latestIds.has(record.id))).join('')}</div>`
        : `<div class="empty"><p>${all.length ? `这个月还没有${TYPE_LABEL[type]}记录。切换月份看看别的记录。` : `还没有${TYPE_LABEL[type]}记录。添加一次，之后可以一键完成并生成下次。`}</p></div>`}
    </section>`;
  }

  function renderNeuterSection(cat) {
    const neuter = cat.neuter;
    const status = neuter ? neuter.status : '未记录';
    const badgeClass = !neuter ? 'none' : neuter.status === '已绝育' ? 'done' : neuter.status === '计划中' ? 'plan' : 'none';

    return `<section class="record-section" id="section-neuter">
      <div class="module-head">
        <div class="module-icon neuter">${icon('scissors', 17)}</div>
        <div class="module-title">
          
          <h2>绝育</h2>
        </div>
        <button type="button" class="btn small ghost" data-action="edit-neuter" data-cat="${esc(cat.id)}">${neuter ? '编辑' : '添加'}</button>
      </div>
      ${neuter ? `<div class="neuter-card">
        <div class="neuter-top">
          <div class="n-copy">
            <strong>${esc(status)}</strong>
            <span>${neuter.date ? `手术日期 ${fmtDot(neuter.date)}` : neuter.status === '计划中' ? '手术日期待安排' : '尚未记录手术日期'}</span>
          </div>
          <span class="status-badge ${badgeClass}">${esc(status)}</span>
        </div>
        <div class="neuter-meta">
          <div class="nm"><span>日期</span><strong>${neuter.date ? fmtDot(neuter.date) : '—'}</strong></div>
          <div class="nm"><span>医院</span><strong>${neuter.hospital ? esc(neuter.hospital) : '—'}</strong></div>
          <div class="nm"><span>费用</span><strong>${neuter.cost ? `¥${esc(neuter.cost)}` : '—'}</strong></div>
          <div class="nm"><span>术前检查</span><strong>${neuter.precheck ? '已做' : '未做'}</strong></div>
        </div>
        ${neuter.notes ? `<div class="neuter-notes">${esc(neuter.notes)}</div>` : ''}
      </div>` : `<div class="empty"><p>还没有绝育记录。记录状态、手术日期和术后备注，方便以后查看。</p></div>`}
    </section>`;
  }

  function renderDetail() {
    const cat = catById(ui.detailCatId) || selectedCat();
    if (!cat) {
      return `<main class="screen"><div class="empty"><strong>找不到这只猫</strong><p>它可能已经被删除了。</p><button type="button" class="btn primary" data-action="back">回到首页</button></div></main>`;
    }

    return `<main class="screen detail-screen">
      <div class="detail-nav">
        <button type="button" class="round-btn small ghost" data-action="back" aria-label="返回">${icon('back', 18)}</button>
        <div class="nav-title">档案 · ${esc(cat.name)}</div>
        <button type="button" class="round-btn small" data-action="edit-cat" data-id="${esc(cat.id)}" aria-label="编辑档案">${icon('edit', 15)}</button>
      </div>
      ${renderDetailHero(cat)}
      ${renderInfoCard(cat)}
      ${renderEventSection(cat)}
      ${renderModuleSection(cat, 'deworm')}
      ${renderModuleSection(cat, 'vaccine')}
      ${renderNeuterSection(cat)}
      <div class="form-hint" style="text-align:center; margin-top:15px;">左滑记录可删除 · 点记录右侧的铅笔可以编辑</div>
      <div class="danger-zone">
        <button type="button" class="danger-link" data-action="delete-cat" data-id="${esc(cat.id)}">${icon('trash', 14)} 删除这只猫</button>
      </div>
    </main>`;
  }

  function renderTabs(animate) {
    const content = ui.tab === 'home'
      ? renderHome()
      : ui.tab === 'reminders'
        ? renderReminders()
        : renderSettings();
    return `<main class="screen ${animate ? 'enter' : ''}" data-screen="${ui.tab}">${content}</main>${renderTabbar()}`;
  }

  /* =========================================================
     Modal system
     ========================================================= */

  let modalReturnFocus = null;
  let modalKeyHandler = null;
  let toastTimer = null;

  function trapFocus(event) {
    const modal = $('#modal-root .modal');
    if (!modal) return;
    const focusables = $$('button:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])', modal)
      .filter((element) => element.offsetParent !== null || element === document.activeElement);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function installModalKeys() {
    if (modalKeyHandler) document.removeEventListener('keydown', modalKeyHandler);
    modalKeyHandler = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeModal();
        return;
      }
      if (event.key === 'Tab') trapFocus(event);
    };
    document.addEventListener('keydown', modalKeyHandler);
  }

  function closeModal(silent = false) {
    const root = $('#modal-root');
    if (!root) return;
    const hadContent = root.innerHTML.trim().length > 0;
    root.innerHTML = '';
    if (modalKeyHandler) {
      document.removeEventListener('keydown', modalKeyHandler);
      modalKeyHandler = null;
    }
    if (!silent && hadContent && modalReturnFocus && modalReturnFocus.isConnected) {
      try {
        modalReturnFocus.focus({ preventScroll: true });
      } catch (error) {
        /* noop */
      }
    }
    modalReturnFocus = null;
  }

  function openSheet(options) {
    const previousFocus = document.activeElement;
    closeModal(true);
    modalReturnFocus = previousFocus;

    const {
      kicker = 'MEOW SYSTEM',
      title = '',
      subtitle = '',
      body = '',
      footer = null,
      className = '',
      submitLabel = '保存',
      onSubmit = null,
      onMount = null
    } = options;

    const footerHTML = footer === null
      ? `<button type="button" class="btn" data-modal-close>取消</button><button type="submit" class="btn primary">${esc(submitLabel)}</button>`
      : footer;

    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-root">
      <div class="modal-backdrop" data-modal-close></div>
      <form class="modal ${className}" id="active-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-grab"></div>
        <div class="modal-head">
          <div class="modal-copy">
            <div class="micro">${esc(kicker)}</div>
            <h2 id="modal-title">${esc(title)}</h2>
            ${subtitle ? `<p>${esc(subtitle)}</p>` : ''}
          </div>
          <button type="button" class="modal-close" data-modal-close aria-label="关闭">${icon('close', 15)}</button>
        </div>
        <div class="modal-body">${body}</div>
        <div class="modal-foot">${footerHTML}</div>
      </form>
    </div>`;

    const form = $('#active-modal', root);
    installModalKeys();

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (typeof onSubmit === 'function') {
        onSubmit(form, new FormData(form));
      } else {
        closeModal();
      }
    });

    if (typeof onMount === 'function') {
      onMount(form, root);
    }

    window.setTimeout(() => {
      const target = root.querySelector('[data-autofocus]') || root.querySelector('.modal-close');
      if (target) {
        try {
          target.focus({ preventScroll: true });
        } catch (error) {
          /* noop */
        }
      }
    }, 40);
  }

  function openAlert(options) {
    const {
      title = '确认操作',
      message = '',
      confirmLabel = '确定',
      cancelLabel = '取消',
      danger = false,
      tone = 'alert',
      kicker = '确认操作',
      onConfirm = null
    } = options;

    const previousFocus = document.activeElement;
    closeModal(true);
    modalReturnFocus = previousFocus;

    const artIcon = tone === 'trash' ? 'trash' : tone === 'upload' ? 'upload' : tone === 'refresh' ? 'refresh' : tone === 'info' ? 'info' : tone === 'shield' ? 'shield' : 'alert';
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-root">
      <div class="modal-backdrop" data-modal-close></div>
      <div class="modal alert" role="alertdialog" aria-modal="true" aria-labelledby="alert-title">
        <div class="modal-grab"></div>
        <div class="modal-head">
          <div class="modal-copy">
            <div class="micro">${esc(kicker)}</div>
            <h2 id="alert-title">${esc(title)}</h2>
          </div>
          <button type="button" class="modal-close" data-modal-close aria-label="关闭">${icon('close', 15)}</button>
        </div>
        <div class="modal-body">
          <div class="alert-art">${icon(artIcon, 23)}</div>
          <p class="alert-message">${esc(message)}</p>
        </div>
        <div class="modal-foot">
          ${cancelLabel === null ? '' : `<button type="button" class="btn" data-modal-close>${esc(cancelLabel)}</button>`}
          <button type="button" class="btn ${danger ? 'red' : 'primary'}" data-alert-confirm>${esc(confirmLabel)}</button>
        </div>
      </div>
    </div>`;

    installModalKeys();
    const confirm = root.querySelector('[data-alert-confirm]');
    confirm.addEventListener('click', () => {
      closeModal();
      if (typeof onConfirm === 'function') onConfirm();
    });

    window.setTimeout(() => {
      try {
        confirm.focus({ preventScroll: true });
      } catch (error) {
        /* noop */
      }
    }, 40);
  }

  /* =========================================================
     Forms
     ========================================================= */

  function fieldRowHTML(field) {
    const type = ['text', 'date', 'longtext', 'sex'].includes(field.type) ? field.type : 'text';
    const value = field.value == null ? '' : String(field.value);
    const placeholder = field.placeholder || '';
    const commonAttrs = `data-field-value aria-label="${esc(field.label || '字段内容')}"`;

    let control = '';
    if (type === 'date') {
      const dateValue = parseISO(value) ? value : '';
      control = `<input class="field-value-input" ${commonAttrs} type="date" value="${esc(dateValue)}">`;
    } else if (type === 'longtext') {
      control = `<textarea class="field-value-input" ${commonAttrs} rows="1" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`;
    } else if (type === 'sex') {
      control = `<select class="field-value-input" ${commonAttrs}>
        ${['未填写', '公', '母', '未知'].map((option) => {
          const optionValue = option === '未填写' ? '' : option;
          return `<option value="${optionValue}" ${value === optionValue ? 'selected' : ''}>${option}</option>`;
        }).join('')}
      </select>`;
    } else {
      control = `<input class="field-value-input" ${commonAttrs} type="text" value="${esc(value)}" placeholder="${esc(placeholder)}" maxlength="80">`;
    }

    return `<div class="field-edit-row" data-field-row data-field-id="${esc(field.id || uid('field'))}" data-key="${esc(field.key || `custom_${uid('key')}`)}" data-type="${type}">
      <input class="label-input" data-field-label value="${esc(field.label || '')}" placeholder="字段名" maxlength="20" aria-label="字段名">
      ${control}
      <button type="button" class="icon-btn danger" data-remove-field aria-label="删除这个字段">${icon('trash', 12)}</button>
    </div>`;
  }

  function openCatForm(catId) {
    const existing = catId ? catById(catId) : null;
    const avatar = existing ? existing.avatar : 'pixel-1';
    const fields = existing ? existing.fields : defaultFields();
    const title = existing ? '编辑档案' : '添加猫咪';
    const kicker = '猫咪档案';

    const body = `<div class="form-label">头像</div>
      <div class="avatar-picker" role="group" aria-label="选择头像">
        ${AVATARS.map((option) => `<button type="button" class="avatar-option ${avatar === option ? 'selected' : ''}" data-avatar-option="${esc(option)}" aria-label="选择头像 ${esc(option)}" aria-pressed="${avatar === option}">
          ${avatarMarkup(option, 46)}
        </button>`).join('')}
      </div>
      <input type="hidden" name="avatar" value="${esc(avatar)}">

      <div class="field-editor single">
        <div class="field-edit-row name-row">
          <label class="label-static" for="cat-name">名字</label>
          <input class="field-value-input" id="cat-name" name="name" type="text" value="${esc(existing ? existing.name : '')}" placeholder="猫咪的名字" maxlength="30" required>
        </div>
      </div>

      <div class="form-label">基础字段</div>
      <div class="form-hint">这些字段会显示在档案里。你可以删除不需要的字段，或添加自定义字段。</div>
      <div class="field-editor">
        ${fields.map(fieldRowHTML).join('')}
      </div>

      <div class="add-field-box">
        <div class="add-field-title"><span>添加自定义字段</span></div>
        <div class="add-field-grid">
          <input id="new-field-label" class="input" type="text" placeholder="字段名，例如：保险" maxlength="20" aria-label="新字段名">
          <input id="new-field-value" class="input" type="text" placeholder="字段内容" maxlength="80" aria-label="新字段内容">
        </div>
        <div class="add-field-actions">
          <select id="new-field-type" class="select" aria-label="新字段类型">
            <option value="text">文本</option>
            <option value="date">日期</option>
            <option value="longtext">多行</option>
          </select>
          <button type="button" class="btn small" data-add-field>${icon('plus', 12)} 添加</button>
        </div>
      </div>

      <div class="form-hint" style="margin-top:8px;">
        <button type="button" class="btn small ghost" data-restore-defaults style="min-height:28px;">补齐默认字段</button>
      </div>`;

    openSheet({
      kicker,
      title,
      subtitle: '名字必填；其他字段都可以按你的习惯增删。',
      body,
      submitLabel: existing ? '保存档案' : '创建档案',
      onMount(form) {
        const hiddenAvatar = form.elements.avatar;
        const editor = form.querySelector('.field-editor');
        const newLabel = form.querySelector('#new-field-label');
        const newValue = form.querySelector('#new-field-value');
        const newType = form.querySelector('#new-field-type');

        form.addEventListener('click', (event) => {
          const avatarOption = event.target.closest('[data-avatar-option]');
          if (avatarOption) {
            const value = avatarOption.dataset.avatarOption;
            hiddenAvatar.value = value;
            $$('.avatar-option', form).forEach((option) => {
              const selected = option.dataset.avatarOption === value;
              option.classList.toggle('selected', selected);
              option.setAttribute('aria-pressed', String(selected));
            });
            return;
          }

          const removeButton = event.target.closest('[data-remove-field]');
          if (removeButton) {
            const row = removeButton.closest('[data-field-row]');
            if (row) row.remove();
            return;
          }

          const restoreButton = event.target.closest('[data-restore-defaults]');
          if (restoreButton) {
            const existingKeys = new Set($$('[data-field-row]', form).map((row) => row.dataset.key));
            let added = 0;
            DEFAULT_FIELDS.forEach((field) => {
              if (!existingKeys.has(field.key)) {
                const wrapper = document.createElement('div');
                wrapper.innerHTML = fieldRowHTML({
                  id: uid('field'),
                  key: field.key,
                  label: field.label,
                  value: '',
                  type: field.type,
                  placeholder: field.placeholder || ''
                }).trim();
                const row = wrapper.firstElementChild;
                if (row) {
                  editor.appendChild(row);
                  added += 1;
                }
              }
            });
            const original = restoreButton.textContent;
            restoreButton.textContent = added ? `已补回 ${added} 个` : '默认字段已齐全';
            window.setTimeout(() => {
              if (restoreButton.isConnected) restoreButton.textContent = original;
            }, 1600);
            return;
          }

          if (event.target.closest('[data-add-field]')) {
            addCustomField();
          }
        });

        form.addEventListener('input', (event) => {
          const target = event.target;
          if (target && target.matches && target.matches('#cat-name, [data-field-label], #new-field-label')) {
            target.setCustomValidity('');
          }
        });

        newType.addEventListener('change', () => {
          newValue.type = newType.value === 'date' ? 'date' : 'text';
          newValue.value = '';
        });

        const addCustomField = () => {
          const label = cleanText(newLabel.value);
          if (!label) {
            newLabel.setCustomValidity('请填写字段名');
            newLabel.reportValidity();
            newLabel.focus();
            return;
          }
          newLabel.setCustomValidity('');
          const wrapper = document.createElement('div');
          wrapper.innerHTML = fieldRowHTML({
            id: uid('field'),
            key: `custom_${uid('key')}`,
            label,
            value: newValue.value,
            type: newType.value,
            placeholder: ''
          }).trim();
          const row = wrapper.firstElementChild;
          if (row) {
            editor.appendChild(row);
            row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
          newLabel.value = '';
          newValue.value = '';
          newLabel.focus();
        };

        const handleAddEnter = (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            addCustomField();
          }
        };
        newLabel.addEventListener('keydown', handleAddEnter);
        newValue.addEventListener('keydown', handleAddEnter);
      },
      onSubmit(form, data) {
        const name = cleanText(data.get('name'));
        if (!name) {
          const nameInput = form.elements.name;
          nameInput.setCustomValidity('请填写名字');
          nameInput.reportValidity();
          nameInput.focus();
          return;
        }

        const rows = $$('[data-field-row]', form);
        const fields = [];
        for (const row of rows) {
          const labelInput = row.querySelector('[data-field-label]');
          const valueInput = row.querySelector('[data-field-value]');
          const label = cleanText(labelInput.value);
          if (!label) {
            labelInput.setCustomValidity('请填写字段名');
            labelInput.reportValidity();
            labelInput.focus();
            return;
          }
          fields.push({
            id: row.dataset.fieldId,
            key: row.dataset.key,
            label,
            value: valueInput.value,
            type: row.dataset.type,
            placeholder: valueInput.getAttribute('placeholder') || ''
          });
        }

        const avatarValue = AVATARS.includes(data.get('avatar')) ? data.get('avatar') : 'pixel-1';
        let savedCat;

        if (existing) {
          existing.name = name;
          existing.avatar = avatarValue;
          existing.fields = fields;
          savedCat = existing;
        } else {
          savedCat = {
            id: uid('cat'),
            name,
            avatar: avatarValue,
            fields,
            dewormings: [],
            vaccines: [],
            events: [],
            neuter: null,
            createdAt: Date.now()
          };
          store.cats.push(savedCat);
          ui.selectedCatId = savedCat.id;
          ui.detailCatId = savedCat.id;
          ui.view = 'detail';
        }

        persist();
        closeModal();
        ensureSelection();
        render({ preserveScroll: existing ? true : false });
        showToast(existing ? '档案已更新' : '档案已创建');
      }
    });
  }

  function openRecordForm(type, catId, recordId) {
    const cat = catById(catId);
    if (!cat) return;
    const records = type === 'deworm' ? cat.dewormings : cat.vaccines;
    const record = recordId ? records.find((item) => item.id === recordId) : null;
    const kinds = type === 'deworm' ? ['体内', '体外', '内外同驱'] : ['猫三联', '狂犬', '其他'];
    if (record && record.kind && !kinds.includes(record.kind)) kinds.push(record.kind);
    const defaultKind = type === 'deworm' ? '内外同驱' : '猫三联';
    const selectedKind = record ? record.kind : defaultKind;
    const intervalDefault = record ? record.intervalMonths : (type === 'deworm' ? 3 : 12);
    const date = record ? record.date : todayISO();
    const nextDate = record ? record.nextDate : (date && intervalDefault ? addMonthsISO(date, intervalDefault) : '');
    const isVaccine = type === 'vaccine';

    const body = `<div class="form-label">类型</div>
      <div class="choice-row">
        ${kinds.map((kind) => `<label class="choice"><input type="radio" name="kind" value="${esc(kind)}" ${kind === selectedKind ? 'checked' : ''}><span>${esc(kind)}</span></label>`).join('')}
      </div>

      <div class="form-row" style="margin-top:12px;">
        <div>
          <label class="form-label" for="record-date">日期</label>
          <input class="input" id="record-date" name="date" type="date" value="${esc(date)}" required>
        </div>
        <div>
          <label class="form-label" for="record-interval">间隔（月）</label>
          <input class="input" id="record-interval" name="interval" type="number" min="0" max="120" inputmode="numeric" value="${esc(intervalDefault)}">
        </div>
      </div>

      <label class="form-label" for="record-next">下次日期</label>
      <input class="input" id="record-next" name="nextDate" type="date" value="${esc(nextDate)}">
      <div class="form-hint">默认按「日期 + 间隔」自动推算，也可以直接修改。间隔填 0 表示不自动提醒。</div>

      <label class="form-label" for="record-product">${isVaccine ? '疫苗名称' : '药名'}</label>
      <input class="input" id="record-product" name="product" type="text" value="${esc(record ? record.product : '')}" placeholder="${isVaccine ? '例如：妙三多' : '例如：大宠爱'}" maxlength="40">

      <div class="form-row">
        <div>
          <label class="form-label" for="record-extra">${isVaccine ? '批号' : '剂量'}</label>
          <input class="input" id="record-extra" name="${isVaccine ? 'batch' : 'dose'}" type="text" value="${esc(record ? (isVaccine ? record.batch : record.dose) : '')}" placeholder="${isVaccine ? '例如：M2025-118' : '例如：1 支'}" maxlength="40">
        </div>
        <div>
          <label class="form-label" for="record-cost">费用</label>
          <input class="input" id="record-cost" name="cost" type="text" inputmode="decimal" value="${esc(record ? record.cost : '')}" placeholder="¥">
        </div>
      </div>

      <label class="form-label" for="record-hospital">医院</label>
      <input class="input" id="record-hospital" name="hospital" type="text" value="${esc(record ? record.hospital : getFieldValue(cat, 'vet'))}" placeholder="医院名称" maxlength="40">

      <label class="form-label" for="record-notes">备注</label>
      <textarea class="textarea" id="record-notes" name="notes" rows="3" placeholder="剂量、反应、下次注意事项…" maxlength="240">${esc(record ? record.notes : '')}</textarea>`;

    const footer = record
      ? `<button type="button" class="btn danger-auto danger-text" data-delete-record>${icon('trash', 12)} 删除</button><button type="button" class="btn" data-modal-close>取消</button><button type="submit" class="btn primary">保存记录</button>`
      : null;

    openSheet({
      kicker: isVaccine ? '健康记录 · 疫苗' : '健康记录 · 驱虫',
      title: `${record ? '编辑' : '添加'}${isVaccine ? '疫苗' : '驱虫'}记录`,
      subtitle: '保存后，下次日期会自动出现在提醒里。',
      body,
      footer,
      submitLabel: record ? '保存记录' : '添加记录',
      onMount(form) {
        const dateEl = form.elements.date;
        const intervalEl = form.elements.interval;
        const nextEl = form.elements.nextDate;
        let nextTouched = false;

        const recalc = () => {
          if (nextTouched) return;
          const months = Number.parseInt(intervalEl.value, 10) || 0;
          nextEl.value = dateEl.value && months ? addMonthsISO(dateEl.value, months) : '';
        };

        dateEl.addEventListener('change', recalc);
        intervalEl.addEventListener('input', recalc);
        nextEl.addEventListener('input', () => {
          nextTouched = true;
        });

        const deleteButton = form.querySelector('[data-delete-record]');
        if (deleteButton) {
          deleteButton.addEventListener('click', () => {
            closeModal();
            deleteRecord(cat.id, type, record.id);
          });
        }
      },
      onSubmit(form, data) {
        const recordDate = data.get('date');
        if (!parseISO(recordDate)) {
          form.elements.date.focus();
          return;
        }
        const interval = clamp(Number.parseInt(data.get('interval'), 10) || 0, 0, 120);
        const next = data.get('nextDate') || (interval ? addMonthsISO(recordDate, interval) : '');
        const payload = {
          kind: cleanText(data.get('kind')) || defaultKind,
          date: recordDate,
          product: cleanText(data.get('product')),
          dose: isVaccine ? (record ? record.dose : '') : cleanText(data.get('dose')),
          batch: isVaccine ? cleanText(data.get('batch')) : (record ? record.batch : ''),
          hospital: cleanText(data.get('hospital')),
          cost: cleanCost(data.get('cost')),
          intervalMonths: interval,
          nextDate: parseISO(next) ? next : '',
          notes: cleanText(data.get('notes'))
        };

        if (record) {
          Object.assign(record, payload);
        } else {
          records.push({
            id: uid('rec'),
            ...payload,
            createdAt: Date.now()
          });
        }

        persist();
        closeModal();
        render({ preserveScroll: true });
        showToast(record ? '记录已更新' : '记录已添加');
      }
    });
  }

  function openNeuterForm(catId) {
    const cat = catById(catId);
    if (!cat) return;
    const neuter = cat.neuter || {
      status: '未绝育',
      date: '',
      hospital: '',
      cost: '',
      precheck: false,
      notes: ''
    };
    const statuses = ['未绝育', '计划中', '已绝育'];

    const body = `<div class="form-label">状态</div>
      <div class="choice-row">
        ${statuses.map((status) => `<label class="choice"><input type="radio" name="status" value="${status}" ${neuter.status === status ? 'checked' : ''}><span>${status}</span></label>`).join('')}
      </div>

      <div class="form-row" style="margin-top:12px;">
        <div>
          <label class="form-label" for="neuter-date">手术日期</label>
          <input class="input" id="neuter-date" name="date" type="date" value="${esc(neuter.date)}">
        </div>
        <div>
          <label class="form-label" for="neuter-cost">费用</label>
          <input class="input" id="neuter-cost" name="cost" type="text" inputmode="decimal" value="${esc(neuter.cost)}" placeholder="¥">
        </div>
      </div>

      <label class="form-label" for="neuter-hospital">医院</label>
      <input class="input" id="neuter-hospital" name="hospital" type="text" value="${esc(neuter.hospital || getFieldValue(cat, 'vet'))}" placeholder="医院名称" maxlength="40">

      <div class="switch-row">
        <span>已完成术前检查</span>
        <label class="switch">
          <input type="checkbox" name="precheck" ${neuter.precheck ? 'checked' : ''}>
          <i></i>
        </label>
      </div>

      <label class="form-label" for="neuter-notes">备注</label>
      <textarea class="textarea" id="neuter-notes" name="notes" rows="3" placeholder="术前检查、术后恢复、注意事项…" maxlength="240">${esc(neuter.notes)}</textarea>`;

    openSheet({
      kicker: '健康记录 · 绝育',
      title: cat.neuter ? '编辑绝育记录' : '添加绝育记录',
      subtitle: '计划中的绝育会出现在提醒列表里。',
      body,
      submitLabel: '保存记录',
      onSubmit(form, data) {
        cat.neuter = {
          status: cleanText(data.get('status')) || '未绝育',
          date: parseISO(data.get('date')) ? data.get('date') : '',
          hospital: cleanText(data.get('hospital')),
          cost: cleanCost(data.get('cost')),
          precheck: data.get('precheck') === 'on',
          notes: cleanText(data.get('notes'))
        };
        persist();
        closeModal();
        render({ preserveScroll: true });
        showToast('绝育记录已更新');
      }
    });
  }

  function openEventForm(catId, eventId) {
    const cat = catById(catId);
    if (!cat) return;
    if (!Array.isArray(cat.events)) cat.events = [];
    const existing = eventId ? cat.events.find((item) => item.id === eventId) : null;
    const event = existing || { date: todayISO(), title: '', text: '' };

    const body = `<label class="form-label" for="event-date">日期</label>
      <input class="input" id="event-date" name="date" type="date" value="${esc(event.date)}" required>

      <label class="form-label" for="event-title">标题</label>
      <input class="input" id="event-title" name="title" type="text" value="${esc(event.title)}" placeholder="例如：第一次洗澡" maxlength="40" required>

      <label class="form-label" for="event-text">记录</label>
      <textarea class="textarea" id="event-text" name="text" rows="3" placeholder="发生了什么？有什么想记住的细节？" maxlength="400">${esc(event.text)}</textarea>`;

    const footer = existing
      ? `<button type="button" class="btn danger-auto danger-text" data-delete-event>${icon('trash', 12)} 删除</button><button type="button" class="btn" data-modal-close>取消</button><button type="submit" class="btn primary">保存记录</button>`
      : null;

    openSheet({
      kicker: '猫咪事件记录',
      title: existing ? '编辑事件记录' : '添加事件记录',
      subtitle: '记下时间、标题和经过，之后可以随时回看。',
      body,
      footer,
      submitLabel: existing ? '保存记录' : '添加记录',
      onMount(form) {
        const deleteButton = form.querySelector('[data-delete-event]');
        if (deleteButton) {
          deleteButton.addEventListener('click', () => {
            closeModal();
            deleteEvent(cat.id, event.id);
          });
        }
      },
      onSubmit(form, data) {
        const title = cleanText(data.get('title'));
        if (!title) {
          const titleInput = form.elements.title;
          titleInput.setCustomValidity('请填写标题');
          titleInput.reportValidity();
          titleInput.focus();
          return;
        }
        const payload = {
          date: parseISO(data.get('date')) ? data.get('date') : todayISO(),
          title: title.slice(0, 40),
          text: cleanText(data.get('text')).slice(0, 400)
        };

        if (existing) {
          Object.assign(existing, payload);
        } else {
          cat.events.push({
            id: uid('event'),
            ...payload,
            createdAt: Date.now()
          });
        }
        cat.events = cat.events.slice().sort(sortEventsDesc).slice(0, MAX_RECORDS);

        persist();
        closeModal();
        render({ preserveScroll: true });
        showToast(existing ? '事件已更新' : '事件已记录');
      }
    });
  }

  function deleteEvent(catId, eventId) {
    const cat = catById(catId);
    if (!cat || !Array.isArray(cat.events)) return;
    const index = cat.events.findIndex((item) => item.id === eventId);
    if (index < 0) return;
    const removed = cat.events.splice(index, 1)[0];
    persist();
    render({ preserveScroll: true });
    showToast(`已删除「${removed.title}」`, '撤销', () => {
      cat.events.splice(index, 0, removed);
      persist();
      render({ preserveScroll: true });
    });
  }

  /* =========================================================
     Actions
     ========================================================= */

  function resetFilters() {
    ui.filter = 'all';
  }

  function openDetail(catId, section) {
    const screen = $('.screen');
    ui.returnScroll = screen ? screen.scrollTop : 0;
    ui.detailCatId = catId || ui.selectedCatId;
    ui.selectedCatId = ui.detailCatId;
    ui.view = 'detail';
    ui.pendingSection = section || null;
    render({ animate: true });
  }

  function backToTabs() {
    const scrollTop = ui.returnScroll || 0;
    ui.view = 'tabs';
    ui.detailCatId = null;
    ui.pendingSection = null;
    render({ animate: true, scrollTop });
  }

  function completeRecord(catId, type, recordId) {
    if (!['deworm', 'vaccine'].includes(type)) return;
    const cat = catById(catId);
    if (!cat) return;
    const records = type === 'deworm' ? cat.dewormings : cat.vaccines;
    const record = records.find((item) => item.id === recordId);
    if (!record) return;

    const fallbackInterval = type === 'deworm' ? 3 : 12;
    let interval = Number(record.intervalMonths);
    if (!Number.isFinite(interval) || interval < 0) interval = fallbackInterval;
    if (interval === 0 && record.date && record.nextDate) {
      interval = monthsBetweenISO(record.date, record.nextDate) || fallbackInterval;
    }
    const date = todayISO();
    const nextDate = interval > 0 ? addMonthsISO(date, interval) : '';
    const newRecord = {
      id: uid('rec'),
      kind: record.kind,
      date,
      product: record.product,
      dose: record.dose,
      batch: record.batch,
      hospital: record.hospital,
      cost: record.cost,
      intervalMonths: interval,
      nextDate,
      notes: '',
      createdAt: Date.now()
    };
    records.push(newRecord);
    persist();
    render({ preserveScroll: true });
    showToast(
      nextDate
        ? `已记录「${newRecord.product || newRecord.kind}」，下次 ${fmtDot(nextDate)}`
        : `已记录「${newRecord.product || newRecord.kind}」，未设置下次提醒`,
      '撤销',
      () => {
        const index = records.indexOf(newRecord);
        if (index >= 0) records.splice(index, 1);
        persist();
        render({ preserveScroll: true });
      }
    );
  }

  function deleteRecord(catId, type, recordId) {
    if (!['deworm', 'vaccine'].includes(type)) return;
    const cat = catById(catId);
    if (!cat) return;
    const records = type === 'deworm' ? cat.dewormings : cat.vaccines;
    const index = records.findIndex((item) => item.id === recordId);
    if (index < 0) return;
    const removed = records.splice(index, 1)[0];
    persist();
    render({ preserveScroll: true });
    showToast(`已删除「${removed.product || removed.kind}」`, '撤销', () => {
      records.splice(index, 0, removed);
      persist();
      render({ preserveScroll: true });
    });
  }

  function confirmDeleteCat(catId) {
    const cat = catById(catId);
    if (!cat) return;
    const recordCount = cat.dewormings.length + cat.vaccines.length + (cat.neuter ? 1 : 0);
    openAlert({
      title: '删除猫咪档案？',
      message: `「${cat.name}」的档案、${recordCount} 条健康记录都会一起删除。\n这个操作可以从提示里撤销。`,
      confirmLabel: '删除',
      cancelLabel: '取消',
      danger: true,
      tone: 'trash',
      kicker: '删除猫咪',
      onConfirm() {
        const index = store.cats.findIndex((item) => item.id === cat.id);
        if (index < 0) return;
        const removed = store.cats.splice(index, 1)[0];
        if (ui.detailCatId === removed.id) {
          ui.view = 'tabs';
          ui.detailCatId = null;
          ui.tab = 'home';
        }
        ensureSelection();
        persist();
        render({ animate: true });
        showToast(`已删除「${removed.name}」`, '撤销', () => {
          store.cats.splice(index, 0, removed);
          ui.selectedCatId = removed.id;
          persist();
          render({ preserveScroll: true });
        });
      }
    });
  }

  function confirmClearData() {
    const catCount = store.cats.length;
    const recordCount = allRecordCount();
    openAlert({
      title: '清空全部数据？',
      message: `将删除 ${catCount} 只猫、${recordCount} 条健康记录。\n清空后可以用提示里的「撤销」恢复。`,
      confirmLabel: '全部清空',
      cancelLabel: '取消',
      danger: true,
      tone: 'trash',
      kicker: '清空全部数据',
      onConfirm() {
        const backup = store.cats;
        store.cats = [];
        ui.selectedCatId = null;
        ui.detailCatId = null;
        ui.view = 'tabs';
        ui.tab = 'home';
        resetFilters();
        persist();
        render({ animate: true });
        showToast('全部数据已清空', '撤销', () => {
          store.cats = backup;
          ensureSelection();
          persist();
          render({ preserveScroll: true });
        });
      }
    });
  }

  function confirmResetDemo() {
    openAlert({
      title: '恢复示例数据？',
      message: '会用「糯米」和「芝麻」两只示例猫替换当前所有档案。当前数据会丢失。',
      confirmLabel: '恢复示例',
      cancelLabel: '取消',
      danger: true,
      tone: 'refresh',
      kicker: '恢复示例数据',
      onConfirm() {
        store.cats = demoCats();
        ui.selectedCatId = store.cats[0].id;
        ui.detailCatId = null;
        ui.view = 'tabs';
        ui.tab = 'home';
        resetFilters();
        persist();
        render({ animate: true });
        showToast('示例数据已恢复');
      }
    });
  }

  function exportData() {
    const payload = {
      app: 'meow-system',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: store.settings,
      cats: store.cats
    };
    const text = JSON.stringify(payload, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `meow-system-${todayISO()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
    showToast('JSON 备份已导出');
  }

  function handleImportFile(event) {
    const input = event.target;
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ''));
        const next = normaliseStore(parsed);
        const records = next.cats.reduce((total, cat) => (
          total + cat.dewormings.length + cat.vaccines.length + (cat.neuter ? 1 : 0)
        ), 0);

        openAlert({
          title: '覆盖导入？',
          message: `检测到 ${next.cats.length} 只猫、${records} 条健康记录。\n导入会替换当前所有数据，建议先导出备份。`,
          confirmLabel: '覆盖导入',
          cancelLabel: '取消',
          tone: 'upload',
          kicker: '导入备份',
          onConfirm() {
            store = next;
            ui.selectedCatId = store.cats[0] ? store.cats[0].id : null;
            ui.detailCatId = null;
            ui.view = 'tabs';
            ui.tab = 'home';
            resetFilters();
            applyLook();
            persist();
            render({ animate: true });
            showToast('备份已导入');
          }
        });
      } catch (error) {
        openAlert({
          title: '无法导入',
          message: error && error.message ? error.message : '文件不是有效的喵档 JSON 备份。',
          confirmLabel: '知道了',
          cancelLabel: null,
          tone: 'info',
          kicker: '导入失败'
        });
      }
    };
    reader.onerror = () => {
      openAlert({
        title: '读取失败',
        message: '无法读取这个文件，请换一个 JSON 备份再试。',
        confirmLabel: '知道了',
        cancelLabel: null,
        tone: 'info',
        kicker: 'IMPORT / ERROR'
      });
    };
    reader.readAsText(file);
  }

  function setAccent(value) {
    const accent = normaliseHex(value);
    if (!accent) return;
    store.settings.accent = accent;
    persist();
    applyLook();
    render({ preserveScroll: true });
  }

  function setBackgroundPreset(preset) {
    if (!BG_PRESETS.some((item) => item.id === preset)) return;
    const background = normaliseBackground(store.settings.background);
    if (preset === 'custom' && !background.image) {
      pickBackgroundImage();
      return;
    }
    store.settings.background = { ...background, preset };
    persist();
    applyLook();
    render({ preserveScroll: true });
  }

  function setVeil(value, persistLook) {
    const veil = normaliseVeil(Number(value) / 100);
    store.settings.background = { ...normaliseBackground(store.settings.background), veil };
    applyLook();
    const label = document.querySelector('[data-veil-value]');
    if (label) label.textContent = `${Math.round(veil * 100)}%`;
    if (persistLook) persist();
  }

  function setPanelColor(value) {
    const color = normaliseHex(value);
    if (!color) return;
    store.settings.panel = { ...normalisePanel(store.settings.panel), color };
    persist();
    applyLook();
    render({ preserveScroll: true });
  }

  function setPanelAlpha(value, persistLook) {
    const alpha = clamp(Number(value), 0, 100) / 100;
    store.settings.panel = { ...normalisePanel(store.settings.panel), alpha };
    applyLook();
    const row = document.querySelector('[data-panel-alpha-value]');
    if (row) row.textContent = `${Math.round(alpha * 100)}%`;
    if (persistLook) {
      persist();
      render({ preserveScroll: true });
    }
  }

  function pickBackgroundImage() {
    const input = $('#bg-file');
    if (input) input.click();
  }

  function readImageAsBackground(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error('没有选择图片'));
        return;
      }
      if (!/^image\//.test(file.type)) {
        reject(new Error('请选择图片文件（JPG / PNG / WebP）'));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('读取图片失败'));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('这张图片无法解析'));
        image.onload = () => {
          try {
            resolve(compressImage(image));
          } catch (error) {
            reject(error);
          }
        };
        image.src = String(reader.result || '');
      };
      reader.readAsDataURL(file);
    });
  }

  // 背景图内联进单文件与 data.json，先压到 900KB 以内
  function compressImage(image) {
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('浏览器不支持图片处理');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    let quality = 0.86;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    while (dataUrl.length > MAX_BG_BYTES && quality > 0.42) {
      quality -= 0.08;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }
    if (dataUrl.length > MAX_BG_BYTES) {
      throw new Error('图片太大，换一张小一点的再试');
    }
    return dataUrl;
  }

  async function handleBackgroundFile(event) {
    const input = event.target;
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    try {
      const dataUrl = await readImageAsBackground(file);
      const current = normaliseBackground(store.settings.background);
      store.settings.background = { preset: 'custom', image: dataUrl, veil: current.veil || DEFAULT_VEIL };
      persist();
      applyLook();
      render({ preserveScroll: true });
      showToast('背景已更新');
    } catch (error) {
      showToast(error && error.message ? error.message : '背景图设置失败');
    }
  }

  function showToast(message, actionLabel, action) {
    const wrap = $('#toast-wrap');
    if (!wrap) return;
    if (toastTimer) window.clearTimeout(toastTimer);
    wrap.innerHTML = `<div class="toast">
      <span class="toast-dot"></span>
      <span>${esc(message)}</span>
      ${actionLabel ? `<button type="button">${esc(actionLabel)}</button>` : ''}
    </div>`;
    const button = wrap.querySelector('.toast button');
    if (button && typeof action === 'function') {
      button.addEventListener('click', () => {
        hideToast();
        action();
      });
    }
    toastTimer = window.setTimeout(() => {
      hideToast();
    }, 5200);
  }

  function hideToast() {
    const wrap = $('#toast-wrap');
    if (toastTimer) {
      window.clearTimeout(toastTimer);
      toastTimer = null;
    }
    if (wrap) wrap.innerHTML = '';
  }

  function updateClock() {
    const target = $('#clock');
    if (!target) return;
    const now = new Date();
    target.textContent = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  }

  /* =========================================================
     Render orchestration / swipe
     ========================================================= */

  function render(options = {}) {
    ensureSelection();
    if (ui.view === 'detail' && !catById(ui.detailCatId)) {
      ui.view = 'tabs';
      ui.detailCatId = null;
    }

    const oldScreen = $('.screen');
    const oldScroll = oldScreen ? oldScreen.scrollTop : 0;
    const app = $('#app');

    if (ui.view === 'detail') {
      app.innerHTML = renderDetail();
      if (options.animate) {
        const screen = $('.screen');
        if (screen) screen.classList.add('enter');
      }
    } else {
      app.innerHTML = renderTabs(Boolean(options.animate));
    }

    initSwipes();

    updateClock();

    window.requestAnimationFrame(() => {
      const screen = $('.screen');
      if (!screen) return;
      if (ui.pendingSection) {
        const section = document.getElementById(`section-${ui.pendingSection}`);
        if (section) section.scrollIntoView({ block: 'start' });
        ui.pendingSection = null;
      } else if (options.scrollTop != null) {
        screen.scrollTop = options.scrollTop;
      } else if (options.preserveScroll) {
        screen.scrollTop = oldScroll;
      } else {
        screen.scrollTop = 0;
      }
    });
  }

  function closeAllSwipes(except = null) {
    $$('.swipe-shell[data-open="1"]').forEach((shell) => {
      if (shell === except) return;
      shell.dataset.open = '0';
      shell.style.setProperty('--reveal', '0px');
      const content = shell.querySelector('.swipe-content');
      if (content) content.style.transform = 'translateX(0)';
    });
  }

  function initSwipes() {
    $$('.swipe-shell').forEach((shell) => {
      const content = shell.querySelector('.swipe-content');
      const deleteButton = shell.querySelector('.swipe-delete');
      if (!content || !deleteButton) return;

      const openWidth = 84;
      let startX = 0;
      let startY = 0;
      let startOffset = 0;
      let offset = 0;
      let dragging = false;
      let horizontal = false;
      let pointerId = null;

      const setX = (value) => {
        offset = value;
        content.style.transform = `translateX(${value}px)`;
        // 红色删除按钮只显示被滑开的那条缝，避免从半透明行下面透出来
        shell.style.setProperty('--reveal', `${Math.max(0, -value)}px`);
      };

      content.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        closeAllSwipes(shell);
        delete shell.dataset.swiped;
        pointerId = event.pointerId;
        startX = event.clientX;
        startY = event.clientY;
        startOffset = shell.dataset.open === '1' ? -openWidth : 0;
        offset = startOffset;
        dragging = true;
        horizontal = false;
        content.classList.add('swiping');
      });

      content.addEventListener('pointermove', (event) => {
        if (!dragging || event.pointerId !== pointerId) return;
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;

        if (!horizontal) {
          if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
          if (Math.abs(dy) > Math.abs(dx) * 1.1) {
            dragging = false;
            horizontal = false;
            content.classList.remove('swiping');
            setX(startOffset);
            return;
          }
          horizontal = true;
          try {
            if (!content.hasPointerCapture(event.pointerId)) {
              content.setPointerCapture(event.pointerId);
            }
          } catch (error) {
            /* noop */
          }
        }

        event.preventDefault();
        shell.dataset.swiped = '1';
        setX(clamp(startOffset + dx, -openWidth, 0));
      });

      const finish = (event) => {
        if (!dragging) return;
        dragging = false;
        content.classList.remove('swiping');
        if (event.pointerId !== pointerId) return;
        const shouldOpen = offset < -openWidth / 2;
        setX(shouldOpen ? -openWidth : 0);
        shell.dataset.open = shouldOpen ? '1' : '0';
        try {
          if (content.hasPointerCapture(event.pointerId)) {
            content.releasePointerCapture(event.pointerId);
          }
        } catch (error) {
          /* noop */
        }
      };

      content.addEventListener('pointerup', finish);
      content.addEventListener('pointercancel', finish);
      content.addEventListener('dragstart', (event) => event.preventDefault());

      content.addEventListener('click', (event) => {
        if (shell.dataset.swiped === '1') {
          event.preventDefault();
          event.stopPropagation();
          delete shell.dataset.swiped;
          return;
        }
        if (shell.dataset.open === '1') {
          event.preventDefault();
          event.stopPropagation();
          shell.dataset.open = '0';
          setX(0);
        }
      }, true);
    });
  }

  /* =========================================================
     Event delegation
     ========================================================= */

  function handleAppClick(event) {
    const actionElement = event.target.closest('[data-action]');
    if (!actionElement) return;
    const action = actionElement.dataset.action;
    if (!action) return;

    switch (action) {
      case 'tab': {
        ui.tab = actionElement.dataset.tab || 'home';
        ui.view = 'tabs';
        ui.detailCatId = null;
        ui.pendingSection = null;
        render({ animate: true, scrollTop: 0 });
        break;
      }
      case 'select-cat': {
        ui.selectedCatId = actionElement.dataset.id;
        ensureSelection();
        render({ preserveScroll: true });
        break;
      }
      case 'open-detail': {
        openDetail(actionElement.dataset.id, actionElement.dataset.section || null);
        break;
      }
      case 'back': {
        backToTabs();
        break;
      }
      case 'scroll-section': {
        const section = document.getElementById(`section-${actionElement.dataset.section}`);
        if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      }
      case 'add-cat': {
        openCatForm(null);
        break;
      }
      case 'edit-cat': {
        openCatForm(actionElement.dataset.id || ui.selectedCatId);
        break;
      }
      case 'add-record': {
        openRecordForm(actionElement.dataset.type, actionElement.dataset.cat || ui.selectedCatId);
        break;
      }
      case 'edit-record': {
        openRecordForm(actionElement.dataset.type, actionElement.dataset.cat || ui.selectedCatId, actionElement.dataset.record);
        break;
      }
      case 'complete-record': {
        completeRecord(actionElement.dataset.cat, actionElement.dataset.type, actionElement.dataset.record);
        break;
      }
      case 'delete-record': {
        deleteRecord(actionElement.dataset.cat, actionElement.dataset.type, actionElement.dataset.record);
        break;
      }
      case 'complete-reminder': {
        completeRecord(actionElement.dataset.cat, actionElement.dataset.type, actionElement.dataset.record);
        break;
      }
      case 'edit-neuter': {
        openNeuterForm(actionElement.dataset.cat || ui.selectedCatId);
        break;
      }
      case 'add-event': {
        openEventForm(actionElement.dataset.cat || ui.selectedCatId);
        break;
      }
      case 'edit-event': {
        openEventForm(actionElement.dataset.cat || ui.selectedCatId, actionElement.dataset.event);
        break;
      }
      case 'delete-cat': {
        confirmDeleteCat(actionElement.dataset.id);
        break;
      }
      case 'filter-reminders': {
        ui.filter = actionElement.dataset.filter || 'all';
        render({ preserveScroll: true });
        break;
      }
      case 'set-accent': {
        setAccent(actionElement.dataset.accent);
        break;
      }
      case 'set-background': {
        setBackgroundPreset(actionElement.dataset.preset);
        break;
      }
      case 'export': {
        exportData();
        break;
      }
      case 'import': {
        const input = $('#import-file');
        if (input) input.click();
        break;
      }
      case 'reset-demo': {
        confirmResetDemo();
        break;
      }
      case 'clear-data': {
        confirmClearData();
        break;
      }
      default:
        break;
    }
  }

  function handleAppChange(event) {
    const target = event.target;
    if (target.matches('[data-accent-input]')) {
      setAccent(target.value);
      return;
    }
    if (target.matches('[data-veil]')) {
      setVeil(target.value, true);
      return;
    }
    if (target.matches('[data-panel-input]')) {
      setPanelColor(target.value);
      return;
    }
    if (target.matches('[data-panel-alpha]')) {
      setPanelAlpha(target.value, true);
      return;
    }
    const select = target.closest('[data-month-filter]');
    if (!select) return;
    const scope = select.dataset.monthFilter;
    if (!scope) return;
    ui.monthFilter[scope] = select.value || 'all';
    render({ preserveScroll: true });
  }

  function handleAppInput(event) {
    const target = event.target;
    if (target.matches('[data-accent-input]')) {
      const accent = normaliseHex(target.value);
      if (!accent) return;
      store.settings.accent = accent;
      applyLook();
      return;
    }
    if (target.matches('[data-veil]')) {
      setVeil(target.value, false);
      return;
    }
    if (target.matches('[data-panel-input]')) {
      const color = normaliseHex(target.value);
      if (!color) return;
      store.settings.panel = { ...normalisePanel(store.settings.panel), color };
      applyLook();
      return;
    }
    if (target.matches('[data-panel-alpha]')) {
      setPanelAlpha(target.value, false);
    }
  }

  function handleAppKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (event.target.closest('button, a, input, select, textarea, [contenteditable="true"]')) return;
    const target = event.target.closest('[role="button"][data-action]');
    if (!target) return;
    event.preventDefault();
    target.click();
  }

  /* =========================================================
     Init
     ========================================================= */

  async function init() {
    const sceneCat = $('[data-scene-cat]');
    if (sceneCat) sceneCat.innerHTML = pixelCatSVG('pixel-1');

    const app = $('#app');
    if (app) {
      app.innerHTML = `<main class="screen"><div class="empty">
        <div class="empty-art">${pixelCatSVG('pixel-1')}</div>
        <strong>正在读取本地档案…</strong>
        <p>${location.protocol === 'file:' ? '浏览器本地存储' : 'data.json / 浏览器存储'}</p>
      </div></main>`;
    }

    ensureSelection();
    await hydrateFromServer();
    ensureSelection();
    applyLook();
    writeLocalStore();
    render();
    updateClock();
    window.setInterval(updateClock, 30000);

    app.addEventListener('click', handleAppClick);
    app.addEventListener('keydown', handleAppKeydown);
    app.addEventListener('change', handleAppChange);
    app.addEventListener('input', handleAppInput);

    document.addEventListener('click', (event) => {
      if (!event.target.closest('.swipe-shell')) closeAllSwipes();
    });

    const modalRoot = $('#modal-root');
    if (modalRoot) {
      modalRoot.addEventListener('click', (event) => {
        if (event.target.closest('[data-modal-close]')) closeModal();
      });
    }

    const importFile = $('#import-file');
    if (importFile) importFile.addEventListener('change', handleImportFile);

    const bgFile = $('#bg-file');
    if (bgFile) bgFile.addEventListener('change', handleBackgroundFile);

    window.addEventListener('storage', (event) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        store = normaliseStore(JSON.parse(event.newValue));
        ensureSelection();
        render({ preserveScroll: true });
      } catch (error) {
        /* ignore malformed external writes */
      }
    });

    if (new URLSearchParams(window.location.search).has('debug')) {
      window.__MEOW_DEBUG__ = {
        get store() { return store; },
        ui,
        render,
        normaliseStore,
        demoCats
      };
    }
  }

  function start() {
    init().catch((error) => {
      console.error('MEOW SYSTEM: 初始化失败。', error);
      try {
        render();
      } catch (renderError) {
        console.error('MEOW SYSTEM: 渲染失败。', renderError);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
