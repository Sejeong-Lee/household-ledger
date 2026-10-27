/**
 * Household Ledger v2 — server (Google Apps Script web app)
 * Execute as: User accessing the web app. Data access is limited by sheet sharing.
 * Files: Code.gs, Engine.html, Index.html, App.html
 */

const SHEET_ID = '1tlEn19II6VIaHzFGsgOJcivzp_gggyxhxP6ynOv7mL4';
const TZ = 'Asia/Singapore';
const TX_COLS = 20; // transactions A:T
const STATUS_COL = 17; // Q = status
const RULES_HEADER = ['key', 'cat', 'sub', 'share', 'memo', 'set_by', 'set_at', 'conf', 'note'];
const DEFAULT_PRICES = { // USD per 1M tokens: [input, output]
  haiku: [0.10, 0.50],
  sonnet: [2, 10]
};

/* ---------- web app entry ---------- */

function doGet() {
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('Household Ledger')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Used by Index.html: <?!= include('Engine') ?> */
function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/* ---------- helpers (trailing underscore = not callable from the browser) ---------- */

function ss_() { return SpreadsheetApp.openById(SHEET_ID); }

function tab_(name) {
  const sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('Missing sheet tab: ' + name);
  return sh;
}

function cleanVal_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  return v;
}

function readTab_(name, maxCols) {
  const sh = tab_(name);
  const lr = sh.getLastRow(), lc = Math.min(sh.getLastColumn(), maxCols || sh.getLastColumn());
  if (lr < 1 || lc < 1) return [];
  return sh.getRange(1, 1, lr, lc).getValues().map(r => r.map(cleanVal_));
}

function settingsMap_() {
  const m = {};
  readTab_('settings').slice(1).forEach(r => { if (r[0] !== '') m[String(r[0]).trim()] = r[1]; });
  return m;
}

function email_() {
  const e = Session.getActiveUser().getEmail();
  if (!e) throw new Error('Could not read your Google account email. Open the app while signed in to Google.');
  return e.toLowerCase();
}

/** Only people listed in settings (user_<email>) may use the app and spend API credit. */
function requireUser_() {
  const e = email_();
  const s = settingsMap_();
  const key = Object.keys(s).find(k => k.toLowerCase() === 'user_' + e);
  if (!key) throw new Error('This Google account (' + e + ') is not set up for this app. Ask Sejeong to add user_' + e + ' in the settings tab.');
  return { email: e, name: String(s[key]), settings: s };
}

function monthKey_(d) { return Utilities.formatDate(d || new Date(), TZ, 'yyyy-MM'); }

/* ---------- bootstrap ---------- */

/** One call at startup: who am I, accounts, settings, fx, rules, transactions, AI usage this month. */
function getBootstrap() {
  const me = requireUser_();
  const tx = readTab_('transactions', TX_COLS);
  const rulesSh = ss_().getSheetByName('rules');
  return {
    email: me.email,
    name: me.name,
    accounts: readTab_('accounts'),
    settings: readTab_('settings'),
    fx: readTab_('fx'),
    rules: rulesSh ? readTab_('rules') : [RULES_HEADER],
    transactions: tx, // header row first; the client parses with rowFromSheet()
    usage: usageThisMonth_(me.settings)
  };
}

/* ---------- saving ---------- */

/**
 * rows: array of arrays, each already produced by rowToSheet() in the browser (20 columns).
 * meta: { file: string, account: string, month: string } — logged in runs (who uploaded).
 */
function saveRows(rows, meta) {
  const me = requireUser_();
  if (!rows || !rows.length) return { saved: 0 };
  rows.forEach(r => { if (r.length !== TX_COLS) throw new Error('Bad row length: ' + r.length); });
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = tab_('transactions');
    const start = sh.getLastRow() + 1;
    sh.getRange(start, 1, rows.length, TX_COLS).setValues(rows);
    SpreadsheetApp.flush();
    appendRun_('statement upload (ledger-v2)', (meta && meta.month) || '', rows.length, 0, me.name,
      ((meta && meta.account) || '') + '; ' + ((meta && meta.file) || '') + '; uploaded by ' + me.email);
    return { saved: rows.length, firstRow: start };
  } finally {
    lock.releaseLock();
  }
}

/** Soft delete: status = deleted. Never removes the row. */
function deleteRow(id) {
  requireUser_();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = tab_('transactions');
    const lr = sh.getLastRow();
    if (lr < 2) return { ok: false };
    const ids = sh.getRange(2, 1, lr - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(id)) {
        sh.getRange(i + 2, STATUS_COL).setValue('deleted');
        return { ok: true, row: i + 2 };
      }
    }
    return { ok: false };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- learned rules ---------- */

function rulesSheet_() {
  let sh = ss_().getSheetByName('rules');
  if (!sh) {
    sh = ss_().insertSheet('rules');
    sh.getRange(1, 1, 1, RULES_HEADER.length).setValues([RULES_HEADER]);
    sh.setFrozenRows(1);
  }
  return sh;
}

/**
 * rule: { key, cat, sub, share, memo, conf, note } — learned in Review, upsert by exact key.
 * rules tab (9 columns): key, cat, sub, share, memo, set_by, set_at, conf, note.
 * Existing rows (including preset 're:' rows) are never cleared or reordered.
 */
function saveRule(rule) {
  const me = requireUser_();
  if (!rule || !rule.key) throw new Error('Rule needs a key.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = rulesSheet_();
    const row = [String(rule.key), rule.cat || '', rule.sub || '', rule.share == null ? '' : rule.share,
      rule.memo || '', me.email, Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ss"),
      rule.conf === 'mid' ? 'mid' : 'high', rule.note || 'Learned in Review'];
    const lr = sh.getLastRow();
    if (lr >= 2) {
      const keys = sh.getRange(2, 1, lr - 1, 1).getValues();
      for (let i = 0; i < keys.length; i++) {
        if (String(keys[i][0]) === row[0]) {
          sh.getRange(i + 2, 1, 1, row.length).setValues([row]);
          return { ok: true, updated: true };
        }
      }
    }
    sh.getRange(lr + 1, 1, 1, row.length).setValues([row]);
    return { ok: true, updated: false };
  } finally {
    lock.releaseLock();
  }
}

/** Settings screen: remove a learned rule. */
function deleteRule(key) {
  requireUser_();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = rulesSheet_();
    const lr = sh.getLastRow();
    if (lr < 2) return { ok: false };
    const keys = sh.getRange(2, 1, lr - 1, 9).getValues();
    for (let i = 0; i < keys.length; i++) {
      if (String(keys[i][0]) === String(key)) {
        if (keys[i][5] === 'seed') throw new Error('Preset rules can only be changed in the rules tab.');
        sh.deleteRow(i + 2); return { ok: true }; }
    }
    return { ok: false };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- settings + fx (Settings screen) ---------- */

const EDITABLE_SETTINGS = ['ratio_ankit'];

function saveSetting(key, value) {
  requireUser_();
  if (EDITABLE_SETTINGS.indexOf(key) < 0) throw new Error('This setting cannot be changed from the app.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = tab_('settings');
    const lr = sh.getLastRow();
    if (lr >= 2) {
      const keys = sh.getRange(2, 1, lr - 1, 1).getValues();
      for (let i = 0; i < keys.length; i++) {
        if (String(keys[i][0]).trim() === key) { sh.getRange(i + 2, 2).setValue(value); return { ok: true }; }
      }
    }
    sh.getRange(lr + 1, 1, 1, 2).setValues([[key, value]]);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- exchange rates ---------- */

const FX_CURRENCIES = ['KRW', 'INR', 'USD'];

/** Upsert one fx row: month 'yyyy-MM' (stored as text), currency, rate_to_sgd, note. */
function upsertFx_(month, currency, rate, note) {
  const sh = tab_('fx');
  const lr = sh.getLastRow();
  if (lr >= 2) {
    const vals = sh.getRange(2, 1, lr - 1, 2).getValues();
    for (let i = 0; i < vals.length; i++) {
      if (String(cleanVal_(vals[i][0])).slice(0, 7) === month && String(vals[i][1]).trim() === currency) {
        sh.getRange(i + 2, 3).setValue(rate);
        sh.getRange(i + 2, 4).setValue(note || '');
        return;
      }
    }
  }
  sh.getRange(lr + 1, 1, 1, 4).setValues([["'" + month, currency, rate, note || '']]);
}

/**
 * When a month's rate is stored, recompute sgd for that month's foreign-currency rows written by this app
 * (source = ledger-v2) and turn provisional ones into final. Returns the number of rows changed.
 */
function repriceMonth_(month) {
  const fx = {};
  readTab_('fx').slice(1).forEach(r => {
    if (String(r[0]).slice(0, 7) === month && Number(r[2]) > 0) fx[String(r[1]).trim()] = Number(r[2]);
  });
  const sh = tab_('transactions');
  const lr = sh.getLastRow();
  if (lr < 2) return 0;
  const vals = sh.getRange(2, 1, lr - 1, TX_COLS).getValues();
  let n = 0;
  vals.forEach((r, i) => {
    if (String(cleanVal_(r[13])).slice(0, 7) !== month || r[14] !== 'ledger-v2' || r[16] === 'deleted') return;
    const cur = String(r[4]).trim();
    if (cur === 'SGD' || !(fx[cur] > 0)) return;
    const orig = Number(r[5]);
    if (!isFinite(orig)) return;
    sh.getRange(i + 2, 4).setValue(Math.round(orig * fx[cur] * 100) / 100);
    if (r[16] === 'provisional') sh.getRange(i + 2, STATUS_COL).setValue('final');
    n++;
  });
  return n;
}

/** Settings screen: type a month-end rate by hand (overrides the automatic one). SGD per 1 unit. */
function saveFx(month, currency, rate) {
  requireUser_();
  month = String(month).slice(0, 7);
  currency = String(currency).trim().toUpperCase();
  rate = Number(rate);
  if (!/^\d{4}-\d{2}$/.test(month) || !/^[A-Z]{3}$/.test(currency) || !(rate > 0)) throw new Error('Invalid exchange rate.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    upsertFx_(month, currency, rate, 'manual (ledger-v2)');
    return { ok: true, repriced: repriceMonth_(month) };
  } finally {
    lock.releaseLock();
  }
}

function findRow_(sh, key) {
  const lr = sh.getLastRow();
  if (lr < 1) return 0;
  const keys = sh.getRange(1, 1, lr, 1).getValues();
  for (let i = 0; i < keys.length; i++) if (String(keys[i][0]).trim() === key) return i + 1;
  return 0;
}

/** Internal upsert into the settings tab (no whitelist). */
function setSetting_(key, value, note) {
  const sh = tab_('settings');
  const row = findRow_(sh, key);
  if (row) {
    sh.getRange(row, 2).setValue(value);
    if (note !== undefined) sh.getRange(row, 3).setValue(note);
  } else {
    sh.getRange(sh.getLastRow() + 1, 1, 1, 3).setValues([[key, value, note || '']]);
  }
}

/** Helper cells in settings: fx_live_KRW etc. hold =GOOGLEFINANCE("CURRENCY:KRWSGD") (SGD per 1 unit, current value). */
function ensureFxProbe_() {
  const sh = tab_('settings');
  FX_CURRENCIES.forEach(c => {
    const key = 'fx_live_' + c;
    let row = findRow_(sh, key);
    if (!row) {
      row = sh.getLastRow() + 1;
      sh.getRange(row, 1).setValue(key);
      sh.getRange(row, 3).setValue('Auto: current ' + c + ' to SGD from GOOGLEFINANCE. Ledger v2 reads this.');
    }
    const cell = sh.getRange(row, 2);
    if (!cell.getFormula()) cell.setFormula('=GOOGLEFINANCE("CURRENCY:' + c + 'SGD")');
  });
  SpreadsheetApp.flush();
}

/** Reads the live rate for each currency (3 tries, 4 s apart), stores it for `month`. Returns { got, missing }. */
function captureFx_(month, only) {
  ensureFxProbe_();
  const sh = tab_('settings');
  const got = {}, missing = [];
  (only || FX_CURRENCIES).forEach(c => {
    const row = findRow_(sh, 'fx_live_' + c);
    let v = null;
    for (let t = 0; t < 3 && !v; t++) {
      SpreadsheetApp.flush();
      const x = sh.getRange(row, 2).getValue();
      if (typeof x === 'number' && x > 0) v = x; else Utilities.sleep(4000);
    }
    if (v) { upsertFx_(month, c, v, 'auto GOOGLEFINANCE'); got[c] = v; } else missing.push(c);
  });
  return { got: got, missing: missing };
}

function deleteTriggers_(handler) {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === handler) ScriptApp.deleteTrigger(t); });
}

/** Run once from the Apps Script editor after deploying (Run > setupTriggers). */
function setupTriggers() {
  requireUser_();
  deleteTriggers_('fxDailyJob_');
  ScriptApp.newTrigger('fxDailyJob_').timeBased().atHour(23).nearMinute(30).everyDays(1).inTimezone(TZ).create();
  ensureFxProbe_();
  return 'Daily exchange-rate job set for about 23:30 SGT.';
}

/** Every night 23:30 SGT; only acts when tomorrow is the 1st. */
function fxDailyJob_() {
  if (Utilities.formatDate(new Date(Date.now() + 864e5), TZ, 'd') !== '1') return;
  const month = monthKey_();
  const lock = LockService.getScriptLock();
  lock.waitLock(60000);
  try {
    const r = captureFx_(month);
    repriceMonth_(month);
    if (r.missing.length) {
      PropertiesService.getScriptProperties().setProperties({ FX_RETRY_MONTH: month, FX_RETRY_CUR: r.missing.join(',') });
      deleteTriggers_('fxRetryJob_');
      ScriptApp.newTrigger('fxRetryJob_').timeBased().after(60 * 60 * 1000).create();
    } else if (findRow_(tab_('settings'), 'fx_warning')) {
      setSetting_('fx_warning', '');
    }
  } finally {
    lock.releaseLock();
  }
}

/** One retry an hour later for currencies that came back as error or 0. Still missing: warning on the Settings screen. */
function fxRetryJob_() {
  deleteTriggers_('fxRetryJob_');
  const props = PropertiesService.getScriptProperties();
  const month = props.getProperty('FX_RETRY_MONTH'), cur = (props.getProperty('FX_RETRY_CUR') || '').split(',').filter(Boolean);
  if (!month || !cur.length) return;
  const lock = LockService.getScriptLock();
  lock.waitLock(60000);
  try {
    const r = captureFx_(month, cur);
    repriceMonth_(month);
    if (r.missing.length) {
      setSetting_('fx_warning', 'No automatic exchange rate for ' + r.missing.join(', ') + ' (' + month + '). Enter it by hand below.', 'Auto: shown on the Settings screen');
    } else {
      setSetting_('fx_warning', '');
    }
    props.deleteProperty('FX_RETRY_MONTH');
    props.deleteProperty('FX_RETRY_CUR');
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Claude API (the only place that calls it) ---------- */

/**
 * model: e.g. 'claude-haiku-5-5'
 * system: string
 * content: string, or an array of content blocks (text / document / image with base64)
 * Returns { text, usage:{input_tokens,output_tokens}, model }.
 */
function callClaude(model, system, content, maxTokens) {
  const me = requireUser_();
  const key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!key) throw new Error('ANTHROPIC_API_KEY is missing in Script Properties.');
  const u = usageThisMonth_(me.settings);
  if (u.cost >= u.cap) throw new Error('Claude API limit reached (credit or monthly cap). This month: $' + u.cost + ' of $' + u.cap + '.');
  const body = {
    model: model,
    max_tokens: maxTokens || 8000,
    system: system || '',
    messages: [{ role: 'user', content: content }]
  };
  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  const raw = res.getContentText();
  let j;
  try { j = JSON.parse(raw); } catch (e) { j = null; }
  if (code !== 200) {
    const msg = (j && j.error && j.error.message) || raw.slice(0, 200);
    console.error('Claude API ' + code + ': ' + raw.slice(0, 500));
    if (code === 429 || /credit|billing|usage limit|spend/i.test(msg)) {
      throw new Error('Claude API refused the request (HTTP ' + code + '): ' + msg + ' Check Billing/Limits in the Anthropic Console.');
    }
    throw new Error('Claude API error ' + code + ': ' + msg);
  }
  const text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  const usage = j.usage || {};
  logUsage_(model, usage, me.email, me.settings);
  return { text: text, usage: { input_tokens: usage.input_tokens || 0, output_tokens: usage.output_tokens || 0 }, model: model };
}

/* ---------- usage log (runs tab) ---------- */

/**
 * runs tab columns: run_at, type, range_covered, rows_added, rows_updated, by, notes.
 * Statement uploads: type 'statement upload (ledger-v2)', range_covered = statement month.
 * AI usage: type 'api_usage', range_covered = yyyy-MM, rows_added = input tokens,
 *           rows_updated = output tokens, by = email, notes = 'model=...; cost_usd=...'.
 */
function appendRun_(type, rangeCovered, added, updated, by, notes) {
  const sh = tab_('runs');
  const ts = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm') + ' SGT';
  sh.getRange(sh.getLastRow() + 1, 1, 1, 7)
    .setValues([[ts, type, "'" + rangeCovered, added, updated, by, notes]]);
}

function priceFor_(model, settings) {
  const tier = /sonnet/i.test(model) ? 'sonnet' : 'haiku';
  const inP = Number(settings['price_' + tier + '_in']);
  const outP = Number(settings['price_' + tier + '_out']);
  return [isFinite(inP) && inP > 0 ? inP : DEFAULT_PRICES[tier][0],
          isFinite(outP) && outP > 0 ? outP : DEFAULT_PRICES[tier][1]];
}

function logUsage_(model, usage, email, settings) {
  try {
    const p = priceFor_(model, settings || settingsMap_());
    const inT = usage.input_tokens || 0, outT = usage.output_tokens || 0;
    const cost = (inT * p[0] + outT * p[1]) / 1e6;
    appendRun_('api_usage', monthKey_(), inT, outT, email,
      'model=' + model + '; cost_usd=' + (Math.round(cost * 1e6) / 1e6));
  } catch (e) {
    // Never fail the user's request because logging failed.
    console.error('logUsage failed: ' + e);
  }
}

/** Exposed so the client can log usage it measured itself (spec: logUsage). */
function logUsage(model, usage) {
  const me = requireUser_();
  logUsage_(model, usage || {}, me.email, me.settings);
  return usageThisMonth_(me.settings);
}

function usageThisMonth_(settings) {
  const mk = monthKey_();
  let cost = 0, calls = 0;
  const sh = ss_().getSheetByName('runs');
  if (sh && sh.getLastRow() >= 2) {
    const vals = sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues();
    vals.forEach(r => {
      if (r[1] === 'api_usage' && String(cleanVal_(r[2])).slice(0, 7) === mk) {
        const m = /cost_usd=([0-9.eE-]+)/.exec(String(r[6]));
        cost += m ? Number(m[1]) || 0 : 0;
        calls++;
      }
    });
  }
  const cap = Number(settings && settings.api_cap_usd);
  return { month: mk, cost: Math.round(cost * 10000) / 10000, calls: calls, cap: isFinite(cap) && cap > 0 ? cap : 5 };
}

function getUsage() {
  const me = requireUser_();
  return usageThisMonth_(me.settings);
}
