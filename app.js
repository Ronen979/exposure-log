'use strict';

const STORAGE_KEY = 'exposure-log.records.v1';
const $ = (id) => document.getElementById(id);

const form = $('form-view');
const pickers = { peak: null, end: null };

/* ---------- storage ---------- */

function loadRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecords(records) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    return true;
  } catch {
    toast('השמירה נכשלה. כדאי ליצור קובץ גיבוי ולבדוק את נפח האחסון.');
    return false;
  }
}

function sorted(records) {
  return [...records].sort((a, b) => b.when.localeCompare(a.when));
}

function normalize(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const text = (v) => (typeof v === 'string' ? v.trim() : '');
  const level = (v) => (Number.isInteger(v) && v >= 0 && v <= 10 ? v : null);
  const when = text(raw.when);
  const situation = text(raw.situation);
  if (!situation || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(when)) return null;
  return {
    id: text(raw.id) || crypto.randomUUID(),
    when: when.slice(0, 16),
    situation,
    peak: level(raw.peak),
    thought: text(raw.thought),
    prevented: text(raw.prevented),
    helped: text(raw.helped),
    end: level(raw.end),
  };
}

/* ---------- list ---------- */

function formatWhen(when) {
  const [date, time] = when.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':');
  return `${d}.${m}.${y}  ${Number(hh)}:${mm}`;
}

function el(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

function metaItem(label, value) {
  const item = el('span', '', `${label}: `);
  item.append(el('b', '', value));
  return item;
}

function renderList() {
  const records = sorted(loadRecords());
  const list = $('records');
  list.replaceChildren();
  $('empty').hidden = records.length > 0;

  for (const r of records) {
    const card = el('button', 'record');
    card.type = 'button';
    card.addEventListener('click', () => { location.hash = `view/${r.id}`; });

    const head = el('div', 'record-head');
    head.append(el('bdi', '', formatWhen(r.when)));
    const isIncomplete = r.peak === null || !r.thought || !r.prevented || !r.helped;
    if (isIncomplete) head.append(el('span', 'incomplete', 'להשלמה'));

    const meta = el('div', 'record-meta');
    if (r.peak !== null) meta.append(metaItem('שיא', r.peak));
    if (r.end !== null) meta.append(metaItem('סיום', r.end));

    card.append(head, el('p', 'record-situation', r.situation), meta);
    const li = el('li');
    li.append(card);
    list.append(li);
  }
}

/* ---------- detail ---------- */

function renderDetail(r) {
  const fields = [
    ['תאריך ושעה', formatWhen(r.when)],
    ['סיטואציה / חשיפה שבוצעה', r.situation],
    ['רמת חרדה בשיא', r.peak],
    ['מה הייתה המחשבה הטורדנית / הדחף לשחזר?', r.thought],
    ['האם הצלחתי למנוע שחזור מנטלי?', r.prevented],
    ['מה עזר לי לעצור את השחזור?', r.helped],
    ['רמת חרדה בסיום', r.end],
  ];
  const list = $('detail-fields');
  list.replaceChildren();
  for (const [label, value] of fields) {
    const isEmpty = value === null || value === undefined || value === '';
    list.append(el('dt', '', label), el('dd', isEmpty ? 'unfilled' : '', isEmpty ? 'לא מולא' : String(value)));
  }
}

/* ---------- form ---------- */

function setPicked(name, value) {
  pickers[name] = value;
  const root = form.querySelector(`[data-scale="${name}"]`);
  for (const b of root.querySelectorAll('button')) {
    b.setAttribute('aria-pressed', String(b.dataset.value === String(value)));
  }
}

function buildPicker(name, root, values, parse) {
  for (const value of values) {
    const b = el('button', '', String(value));
    b.type = 'button';
    b.dataset.value = String(value);
    b.setAttribute('aria-pressed', 'false');
    // Tapping the selected option again clears it, so a mistaken tap can be undone.
    b.addEventListener('click', () => {
      const parsed = parse(value);
      setPicked(name, pickers[name] === parsed ? null : parsed);
    });
    root.append(b);
  }
}

function nowLocal() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fillForm(record) {
  form.elements.when.value = record ? record.when : nowLocal();
  form.elements.situation.value = record ? record.situation : '';
  form.elements.thought.value = record ? record.thought : '';
  form.elements.helped.value = record ? record.helped : '';
  // Records saved before this became a text field can hold null here.
  form.elements.prevented.value = (record && record.prevented) || '';
  setPicked('peak', record ? record.peak : null);
  setPicked('end', record ? record.end : null);
  showSituationError(false);
  $('delete').hidden = !record;
}

function showSituationError(show) {
  $('situation-error').hidden = !show;
  form.elements.situation.classList.toggle('invalid', show);
}

function submitForm(event) {
  event.preventDefault();
  const situation = form.elements.situation.value.trim();
  if (!situation) {
    showSituationError(true);
    form.elements.situation.focus();
    return;
  }
  const id = currentEditId();
  const record = normalize({
    id: id || crypto.randomUUID(),
    when: form.elements.when.value || nowLocal(),
    situation,
    peak: pickers.peak,
    thought: form.elements.thought.value,
    prevented: form.elements.prevented.value,
    helped: form.elements.helped.value,
    end: pickers.end,
  });
  const records = loadRecords().filter((r) => r.id !== record.id);
  records.push(record);
  if (saveRecords(records)) {
    location.hash = id ? `view/${id}` : '';
    toast('נשמר');
  }
}

function deleteCurrent() {
  const id = currentEditId();
  if (!id || !confirm('למחוק את הרישום? אי אפשר לבטל את הפעולה.')) return;
  if (saveRecords(loadRecords().filter((r) => r.id !== id))) {
    location.hash = '';
    toast('הרישום נמחק');
  }
}

/* ---------- export and import ---------- */

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function buildCsv() {
  const header = [
    'תאריך ושעה', 'סיטואציה / חשיפה שבוצעה', 'רמת חרדה בשיא (0-10)',
    'מחשבה טורדנית / דחף לשחזר', 'האם הצלחתי למנוע שחזור מנטלי',
    'מה עזר לי לעצור את השחזור', 'רמת חרדה בסיום (0-10)',
  ];
  const rows = sorted(loadRecords()).reverse().map((r) => [
    formatWhen(r.when), r.situation, r.peak, r.thought, r.prevented, r.helped, r.end,
  ]);
  // The BOM makes Excel read the file as UTF-8, otherwise Hebrew comes out garbled.
  return '﻿' + [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

async function deliverFile(name, type, content) {
  const file = new File([content], name, { type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
    } catch (err) {
      if (err.name !== 'AbortError') toast('השיתוף נכשל');
    }
    return;
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function stamp() {
  return nowLocal().slice(0, 10);
}

async function importFile(file) {
  try {
    const parsed = JSON.parse(await file.text());
    const incoming = (Array.isArray(parsed) ? parsed : parsed.records || []).map(normalize);
    const valid = incoming.filter(Boolean);
    if (!valid.length) {
      toast('לא נמצאו רישומים בקובץ');
      return;
    }
    const merged = new Map(loadRecords().map((r) => [r.id, r]));
    for (const r of valid) merged.set(r.id, r);
    if (saveRecords([...merged.values()])) {
      renderList();
      const skipped = incoming.length - valid.length;
      toast(skipped ? `נטענו ${valid.length} רישומים, ${skipped} לא תקינים דולגו` : `נטענו ${valid.length} רישומים`);
    }
  } catch {
    toast('אי אפשר לקרוא את הקובץ');
  }
}

/* ---------- navigation ---------- */

function currentEditId() {
  const match = location.hash.match(/^#edit\/(.+)$/);
  return match ? match[1] : null;
}

function currentViewId() {
  const match = location.hash.match(/^#view\/(.+)$/);
  return match ? match[1] : null;
}

function route() {
  const isNew = location.hash === '#new';
  const id = currentEditId() || currentViewId();
  const record = id ? loadRecords().find((r) => r.id === id) : null;
  const isEdit = Boolean(record && currentEditId());
  const isView = Boolean(record && currentViewId());
  const showForm = isNew || isEdit;
  const isList = !showForm && !isView;

  $('list-view').hidden = !isList;
  $('detail-view').hidden = !isView;
  form.hidden = !showForm;
  $('back').hidden = isList;
  $('menu-btn').hidden = !isList;
  $('title').textContent = isNew ? 'רישום חדש' : isEdit ? 'עריכת רישום' : isView ? 'סיכום רישום' : 'מעקב חשיפות';
  toggleMenu(false);

  if (showForm) fillForm(record);
  else if (isView) renderDetail(record);
  else renderList();
  window.scrollTo(0, 0);
}

function toggleMenu(open) {
  $('menu').hidden = !open;
  $('menu-btn').setAttribute('aria-expanded', String(open));
}

let toastTimer;
function toast(message) {
  const node = $('toast');
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.hidden = true; }, 3500);
}

/* ---------- start ---------- */

const levels = Array.from({ length: 11 }, (_, i) => i);
buildPicker('peak', form.querySelector('[data-scale="peak"]'), levels, Number);
buildPicker('end', form.querySelector('[data-scale="end"]'), levels, Number);

form.addEventListener('submit', submitForm);
form.elements.situation.addEventListener('input', () => showSituationError(false));
$('add').addEventListener('click', () => { location.hash = 'new'; });
$('back').addEventListener('click', () => {
  const editId = currentEditId();
  location.hash = editId ? `view/${editId}` : '';
});
$('edit').addEventListener('click', () => { location.hash = `edit/${currentViewId()}`; });
$('delete').addEventListener('click', deleteCurrent);

$('menu-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  toggleMenu($('menu').hidden);
});
document.addEventListener('click', (e) => {
  if (!$('menu').contains(e.target)) toggleMenu(false);
});

$('export-csv').addEventListener('click', () => {
  toggleMenu(false);
  deliverFile(`exposure-log-${stamp()}.csv`, 'text/csv', buildCsv());
});
$('export-json').addEventListener('click', () => {
  toggleMenu(false);
  deliverFile(`exposure-log-backup-${stamp()}.json`, 'application/json',
    JSON.stringify({ version: 1, records: loadRecords() }, null, 2));
});
$('import-json').addEventListener('click', () => {
  toggleMenu(false);
  $('import-file').click();
});
$('import-file').addEventListener('change', (e) => {
  if (e.target.files[0]) importFile(e.target.files[0]);
  e.target.value = '';
});

window.addEventListener('hashchange', route);
route();

if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
