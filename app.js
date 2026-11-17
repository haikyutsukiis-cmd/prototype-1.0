"use strict";

const STORAGE_KEY = "produksi-control-room-v1";
const defaultOperators = ["AMRI", "HAFIDZ", "AGUS", "SIGIT", "ERWIN", "M. RIPAI"];
const defaultMachines = ["VMC 850", "VMC 650", "KASUGA", "HYUNDAI", "FINISHING", "GENTAP"];
let operators = [...defaultOperators];
let machines = [...defaultMachines];
const customers = ["PT. HILEX", "PT. PINDAD", "Lainnya"];
const consumables = ["Kikir", "Mata gerinda", "Plastik", "Sarung tangan", "Klem", "Selang"];
const viewTitles = { dashboard: "Dashboard", operator: "Input operator", tools: "Kontrol tools", materials: "Material & PO", master: "Data master", verification: "Verifikasi hasil", reports: "Laporan", settings: "Pengaturan" };
const roleViews = { admin: ["dashboard", "operator", "tools", "materials", "master", "verification", "reports", "settings"], boss: ["dashboard", "reports", "settings"], operator: ["operator", "tools"] };
let activeRole = null;
let activeOperator = null;
let loginRole = "admin";
try {
  const savedRole = sessionStorage.getItem("produksi-role");
  const savedOperator = sessionStorage.getItem("produksi-operator");
  if (savedRole === "operator" && savedOperator) {
    activeRole = savedRole;
    activeOperator = savedOperator;
  } else if (savedRole === "admin" || savedRole === "boss") {
    activeRole = savedRole;
  }
} catch (error) {
  console.warn("Sesi role tidak dapat dipulihkan:", error);
}
let activeView = activeRole === "operator" ? "operator" : "dashboard";
let activeToolTab = "log";
let recentToolCode = "";
let toastTimer;

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const stamp = () => new Date().toISOString();
const localInputTime = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};
const makeId = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
function toolCodePrefix(name, operator, pickedAt, machine) {
  const date = pickedAt instanceof Date ? pickedAt : new Date(pickedAt);
  const pad = (value) => String(value).padStart(2, "0");
  const typeInitial = /^insert\b/i.test(name) ? "I" : /\bend\s?mill\b/i.test(name) ? "E" : (name.trim()[0] || "T").toUpperCase();
  const identifier = name.match(/\d+(?:[.,]\d+)?/i)?.[0]?.replace(",", "") ?? name.match(/CNMG/i)?.[0] ?? "";
  const toolTag = `${typeInitial}${identifier}`.toUpperCase();
  const operatorCode = operator.replace(/[^A-Z]/gi, "").slice(0, 3).toUpperCase();
  const machineCode = machine.match(/\d+/)?.[0] ?? machine.replace(/[^A-Z]/gi, "").slice(0, 3).toUpperCase();
  return `${toolTag}-${operatorCode}-${machineCode}-${String(date.getFullYear()).slice(-2)}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}
function nextToolCode(name, operator, pickedAt, machine) {
  const prefix = toolCodePrefix(name, operator, pickedAt, machine);
  const sequence = store.tools.filter((tool) => tool.code?.startsWith(`${prefix}-`)).length + 1;
  return `${prefix}-${String(sequence).padStart(2, "0")}`;
}

function demoStore() {
  const date = today();
  const insertIssuedAt = stamp();
  const kikirIssuedAt = stamp();
  const drillIssuedAt = stamp();
  const items = [
    { id: "ITM-001", name: "Housing Pump A12", po: "PO-24018", customer: "PT. HILEX", materialSpec: "Aluminium 6061 · Ø 40 mm", target: 120, ops: ["OP1", "OP2", "OP3"], opTargets: { OP1: 120, OP2: 120, OP3: 120 }, cycleMin: 8, loadMin: 1, unloadMin: 1 },
    { id: "ITM-002", name: "Bracket HXE-04", po: "PO-24021", customer: "PT. PINDAD", materialSpec: "SS400 · plat 8 mm", target: 80, ops: ["OP1", "OP2"], opTargets: { OP1: 80, OP2: 80 }, cycleMin: 11, loadMin: 2, unloadMin: 1 },
    { id: "ITM-003", name: "Shaft Coupling 32", po: "PO-24025", customer: "PT. HILEX", materialSpec: "S45C · Ø 32 mm", target: 60, ops: ["OP1", "OP2", "OP3"], opTargets: { OP1: 60, OP2: 60, OP3: 60 }, cycleMin: 14, loadMin: 2, unloadMin: 2 },
  ];
  return {
    items,
    production: [
      { id: "PR-1001", date, time: "07:42", operator: "AMRI", machine: "VMC 850", itemId: "ITM-001", op: "OP1", cycleMin: 8, loadMin: 1, unloadMin: 1, ok: 24, repair: 1, ng: 1, shift: "Shift 1" },
      { id: "PR-1002", date, time: "08:10", operator: "HAFIDZ", machine: "VMC 650", itemId: "ITM-002", op: "OP1", cycleMin: 11, loadMin: 2, unloadMin: 1, ok: 18, repair: 0, ng: 1, shift: "Shift 1" },
      { id: "PR-1003", date, time: "08:35", operator: "AGUS", machine: "KASUGA", itemId: "ITM-001", op: "OP2", cycleMin: 9, loadMin: 1, unloadMin: 1, ok: 16, repair: 1, ng: 0, shift: "Shift 1" },
      { id: "PR-1004", date, time: "09:05", operator: "SIGIT", machine: "HYUNDAI", itemId: "ITM-003", op: "OP1", cycleMin: 14, loadMin: 2, unloadMin: 2, ok: 12, repair: 1, ng: 1, shift: "Shift 1" },
      { id: "PR-1005", date, time: "09:22", operator: "ERWIN", machine: "FINISHING", itemId: "ITM-002", op: "OP2", cycleMin: 7, loadMin: 1, unloadMin: 1, ok: 14, repair: 0, ng: 0, shift: "Shift 1" },
      { id: "PR-1006", date, time: "09:40", operator: "M. RIPAI", machine: "GENTAP", itemId: "ITM-001", op: "OP1", cycleMin: 8, loadMin: 1, unloadMin: 1, ok: 19, repair: 1, ng: 0, shift: "Shift 1" },
    ],
    receipts: [
      { id: "RC-001", date, itemId: "ITM-001", suratJalan: "SJ-01822", customer: "PT. HILEX", qty: 240, sourceQty: 20, unit: "batang", pcsPerBar: 12 },
      { id: "RC-002", date, itemId: "ITM-002", suratJalan: "SJ-01827", customer: "PT. PINDAD", qty: 160, sourceQty: 160, unit: "pcs", pcsPerBar: 1 },
      { id: "RC-003", date, itemId: "ITM-003", suratJalan: "SJ-01831", customer: "PT. HILEX", qty: 120, sourceQty: 10, unit: "batang", pcsPerBar: 12 },
    ],
    shipments: [{ id: "SH-001", date, time: "08:55", itemId: "ITM-001", customer: "PT. HILEX", suratJalan: "SJ-KLR-0091", qty: 12 }],
    tools: [
      { id: "TL-001", code: `${toolCodePrefix("Insert carbide CNMG", "AMRI", insertIssuedAt, "VMC 850")}-01`, date: insertIssuedAt, operator: "AMRI", name: "Insert carbide CNMG", qty: 4, condition: "Baik", consumable: false, returned: 1, returnEvents: [], machine: "VMC 850", stockType: "Baru", broken: 0, blunt: 0, damaged: 0, shift: "Shift 1" },
      { id: "TL-002", code: `${toolCodePrefix("Kikir", "HAFIDZ", kikirIssuedAt, "VMC 650")}-01`, date: kikirIssuedAt, operator: "HAFIDZ", name: "Kikir", qty: 2, condition: "Baik", consumable: true, returned: 0, returnEvents: [], machine: "VMC 650", stockType: "Baru", broken: 0, blunt: 1, damaged: 0, shift: "Shift 1" },
      { id: "TL-003", code: `${toolCodePrefix("Mata bor 8 mm", "AGUS", drillIssuedAt, "KASUGA")}-01`, date: drillIssuedAt, operator: "AGUS", name: "Mata bor 8 mm", qty: 3, condition: "Baik", consumable: false, returned: 0, returnEvents: [], machine: "KASUGA", stockType: "Baru", broken: 1, blunt: 0, damaged: 0, shift: "Shift 1" },
    ],
    handovers: [],
    customers: ["PT. HILEX", "PT. PINDAD"],
    operators: [...defaultOperators],
    machines: [...defaultMachines],
    toolsInventory: [
      { id: "TI-001", name: "Insert carbide CNMG", newQty: 12, usedQty: 6, scrapQty: 1, minQty: 4 },
      { id: "TI-002", name: "Endmill 10 mm", newQty: 8, usedQty: 3, scrapQty: 1, minQty: 2 },
      { id: "TI-003", name: "Mata bor 8 mm", newQty: 9, usedQty: 4, scrapQty: 2, minQty: 3 },
      { id: "TI-004", name: "Kikir", newQty: 8, usedQty: 0, scrapQty: 0, minQty: 2 },
    ],
    jobs: [
      { id: "JB-001", date, operator: "AGUS", machine: "KASUGA", fromItem: "ITM-001", toItem: "ITM-002", start: `${date}T08:30`, end: `${date}T08:48`, reason: "Pergantian PO" },
    ],
    attendance: Object.fromEntries(operators.map((name) => [name, "Hadir"])),
    attendanceLogs: [],
    leaveRequests: [],
    progressAdjustments: [],
  };
}

function loadStore() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return demoStore();
    const parsed = JSON.parse(saved);
    if (!parsed || !Array.isArray(parsed.items) || !Array.isArray(parsed.production)) throw new Error("Format data lokal tidak valid");
    const normalizeOperator = (name) => name === "HAFID" ? "HAFIDZ" : name === "M.RIPAI" ? "M. RIPAI" : name;
    for (const row of parsed.production) row.operator = normalizeOperator(row.operator);
    for (const row of parsed.tools ?? []) row.operator = normalizeOperator(row.operator);
    for (const row of parsed.jobs ?? []) row.operator = normalizeOperator(row.operator);
    for (const row of parsed.handovers ?? []) {
      row.fromOperator = normalizeOperator(row.fromOperator);
      row.toOperator = normalizeOperator(row.toOperator);
    }
    for (const row of parsed.attendanceLogs ?? []) row.operator = normalizeOperator(row.operator);
    for (const row of parsed.leaveRequests ?? []) row.operator = normalizeOperator(row.operator);
    if (parsed.attendance) {
      parsed.attendance = Object.fromEntries(Object.entries(parsed.attendance).map(([name, value]) => [normalizeOperator(name), value]));
    }
    parsed.customers ??= ["PT. HILEX", "PT. PINDAD"];
    parsed.operators ??= [...operators];
    parsed.machines ??= [...machines];
    parsed.progressAdjustments ??= [];
    for (const item of parsed.items) {
      item.materialSpec ??= "";
      item.opTargets ??= Object.fromEntries((item.ops ?? ["OP1"]).map((op) => [op, item.target ?? 0]));
    }
    parsed.toolsInventory ??= demoStore().toolsInventory;
    parsed.attendanceLogs ??= [];
    parsed.leaveRequests ??= [];
    return parsed;
  } catch (error) {
    console.error("Gagal membaca data aplikasi:", error);
    return demoStore();
  }
}

let store = loadStore();
operators = [...new Set([...(store.operators ?? []), ...operators])];
machines = [...new Set([...(store.machines ?? []), ...machines])];
store.operators = operators;
store.machines = machines;
function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch (error) {
    showToast("Gagal menyimpan data browser. Periksa ruang penyimpanan.");
    console.error("Gagal menyimpan data aplikasi:", error);
    return false;
  }
}

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const number = (value) => (Number(value) || 0).toLocaleString("id-ID");
const itemById = (id) => store.items.find((item) => item.id === id);
const itemName = (id) => itemById(id)?.name ?? "Item dihapus";
const customerOptions = (selected = "") => [...new Set([...(store.customers ?? customers.filter((name) => name !== "Lainnya")), "Lainnya"])].map((customer) => `<option ${selected === customer ? "selected" : ""}>${escapeHtml(customer)}</option>`).join("");
const customerDatalist = () => [...new Set([...(store.customers ?? []), ...store.items.map((item) => item.customer)])].map((name) => `<option value="${escapeHtml(name)}"></option>`).join("");
const operatorOptions = (selected = "") => operators.map((name) => `<option ${selected === name ? "selected" : ""}>${name}</option>`).join("");
const machineOptions = (selected = "") => machines.map((name) => `<option ${selected === name ? "selected" : ""}>${name}</option>`).join("");
const itemOptions = (selected = "") => store.items.map((item) => `<option value="${escapeHtml(item.id)}" ${selected === item.id ? "selected" : ""}>${escapeHtml(item.name)} · ${escapeHtml(item.po || "PO belum ada")}</option>`).join("");
const totalFor = (rows, key) => rows.reduce((sum, row) => sum + (Number(row[key]) || 0), 0);
const processed = (row) => (Number(row.ok) || 0) + (Number(row.repair) || 0) + (Number(row.ng) || 0);
const todayProduction = () => store.production.filter((row) => row.date === today());
const itemProduction = (itemId) => store.production.filter((row) => row.itemId === itemId);
const itemReceipts = (itemId) => store.receipts.filter((row) => row.itemId === itemId).reduce((sum, row) => sum + row.qty, 0);
const itemOpDone = (itemId, op) => itemProduction(itemId).filter((row) => row.op === op).reduce((sum, row) => sum + row.ok, 0)
  + (store.progressAdjustments ?? []).filter((row) => row.itemId === itemId && row.op === op).reduce((sum, row) => sum + row.qty, 0);
const itemConsumed = (itemId) => itemProduction(itemId).filter((row) => row.op === "OP1").reduce((sum, row) => sum + processed(row), 0);
const itemStock = (itemId) => itemReceipts(itemId) - itemConsumed(itemId);
const finalOp = (item) => item.ops[item.ops.length - 1];
const itemFinished = (item) => itemOpDone(item.id, finalOp(item));
const itemShipped = (itemId) => store.shipments.filter((row) => row.itemId === itemId).reduce((sum, row) => sum + row.qty, 0);
const itemGoodAvailable = (item) => Math.max(0, itemFinished(item) - itemShipped(item.id));
const attendanceForToday = (operator) => (store.attendanceLogs ?? []).filter((row) => row.operator === operator && row.date === today()).sort((a, b) => b.checkInAt.localeCompare(a.checkInAt))[0];
const currentAttendance = (operator) => (store.attendanceLogs ?? []).filter((row) => row.operator === operator && row.date === today() && row.checkInAt && !row.checkOutAt).sort((a, b) => b.checkInAt.localeCompare(a.checkInAt))[0];
const hasOpenAttendance = (operator) => Boolean(currentAttendance(operator));
function toolHeldByOperator(tool, operator) {
  const returns = (tool.returnEvents ?? []).filter((entry) => entry.status !== "rejected");
  const initialReturns = Math.max(0, tool.returned - returns.reduce((sum, entry) => sum + entry.qty, 0));
  let held = tool.operator === operator ? tool.qty - initialReturns : 0;
  for (const handover of store.handovers ?? []) {
    if (handover.toolCode !== tool.code) continue;
    if (handover.fromOperator === operator) held -= handover.qty;
    if (handover.toOperator === operator) held += handover.qty;
  }
  for (const entry of returns) if (entry.operator === operator) held -= entry.qty;
  return Math.max(0, held);
}
function toolHolders(tool) {
  return operators.map((operator) => ({ operator, qty: toolHeldByOperator(tool, operator) })).filter((entry) => entry.qty > 0);
}
const fmtHours = (minutes) => {
  const rounded = Math.round(minutes);
  return `${Math.floor(rounded / 60)}j ${rounded % 60}m`;
};
const percent = (value, max) => max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
const initials = (name) => name.split(/[.\s]/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2);

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function render() {
  const app = document.querySelector("#app");
  if (!activeRole) {
    document.querySelector("#pageLabel").textContent = "Masuk";
    document.querySelectorAll(".nav-link").forEach((button) => { button.hidden = true; });
    document.querySelector("#logoutButton").hidden = true;
    document.querySelector("#resetDemo").hidden = true;
    document.querySelector("#userName").textContent = "Belum masuk";
    document.querySelector("#userRole").textContent = "Pilih akses";
    app.innerHTML = renderLogin();
    return;
  }
  if (!roleViews[activeRole].includes(activeView)) activeView = activeRole === "operator" ? "operator" : "dashboard";
  document.querySelector("#pageLabel").textContent = viewTitles[activeView];
  document.querySelectorAll(".nav-link").forEach((button) => {
    button.hidden = !roleViews[activeRole].includes(button.dataset.view);
    button.classList.toggle("active", button.dataset.view === activeView);
  });
  document.querySelector("#logoutButton").hidden = false;
  document.querySelector("#resetDemo").hidden = activeRole !== "admin";
  document.querySelector("#userName").textContent = activeRole === "operator" ? activeOperator : activeRole === "boss" ? "Boss" : "Administrator";
  document.querySelector("#userRole").textContent = activeRole === "admin" ? "Admin · akses penuh (demo)" : activeRole === "boss" ? "Boss · dashboard baca saja" : "Operator · input terbatas";
  document.querySelector("#userAvatar").textContent = activeRole === "operator" ? initials(activeOperator ?? "OP") : activeRole === "boss" ? "BS" : "AD";
  app.innerHTML = ({
    dashboard: renderDashboard,
    operator: renderOperator,
    tools: renderTools,
    materials: renderMaterials,
    master: renderMaster,
    verification: renderVerification,
    reports: renderReports,
    settings: renderSettings,
  })[activeView]();
  if (activeView === "operator") {
    document.querySelector("#machineInputs")?.insertAdjacentHTML("beforeend", machineRow());
    updateOpOptions();
  }
}

function renderLogin() {
  const needsSetup = ["admin", "boss"].includes(loginRole) && !store[`${loginRole}PasswordHash`];
  const roleLabel = loginRole === "admin" ? "Admin" : loginRole === "boss" ? "Boss" : "Operator";
  return `<div class="login-layout"><section class="login-card">
    <div class="login-brand"><span class="brand-mark">P</span><div><strong>PRODUKSI</strong><small>CONTROL ROOM</small></div></div>
    <p class="eyebrow">AKSES WORKSPACE</p><h1>${needsSetup ? `Buat akses ${roleLabel}` : "Selamat datang"}</h1>
    <p class="subtitle">${needsSetup ? `Atur kata sandi ${roleLabel} untuk browser ini.` : "Masuk ke dashboard sesuai peran Anda."}</p>
    <form id="loginForm" class="login-form">
      <div class="field"><label for="loginRole">Peran</label><select id="loginRole" name="role"><option value="admin" ${loginRole === "admin" ? "selected" : ""}>Admin</option><option value="boss" ${loginRole === "boss" ? "selected" : ""}>Boss</option><option value="operator" ${loginRole === "operator" ? "selected" : ""}>Operator</option></select></div>
      ${loginRole === "operator" ? `<div class="field"><label for="loginOperator">Nama operator</label><input id="loginOperator" name="operator" list="loginOperatorNames" required placeholder="Pilih atau ketik nama operator" /><datalist id="loginOperatorNames">${operators.map((name) => `<option value="${escapeHtml(name)}"></option>`).join("")}</datalist></div>` : ""}
      ${["admin", "boss"].includes(loginRole) ? `<div class="field"><label for="loginPassword">${needsSetup ? `Kata sandi ${roleLabel} baru` : `Kata sandi ${roleLabel}`}</label><input id="loginPassword" name="password" type="password" minlength="8" autocomplete="${needsSetup ? "new-password" : "current-password"}" required placeholder="Minimal 8 karakter" /></div>${needsSetup ? `<div class="field"><label for="loginPasswordConfirm">Ulangi kata sandi</label><input id="loginPasswordConfirm" name="passwordConfirm" type="password" minlength="8" autocomplete="new-password" required /></div>` : ""}` : ""}
      <button class="button primary login-submit" type="submit">${needsSetup ? `Simpan &amp; masuk sebagai ${roleLabel}` : "Masuk"}</button>
    </form>
    <div class="login-notice"><strong>Prototype lokal:</strong> sandi Admin/Boss disimpan sebagai hash di browser ini; profil Operator belum memakai sandi. Pembatasan peran tetap simulasi UI—gunakan autentikasi dan otorisasi server sebelum dipakai di jaringan atau untuk data produksi.</div>
  </section></div>`;
}

function renderDashboard() {
  const rows = todayProduction();
  const good = totalFor(rows, "ok");
  const target = store.items.reduce((sum, item) => sum + item.target, 0);
  const repairs = totalFor(rows, "repair");
  const ng = totalFor(rows, "ng");
  const openTools = store.tools.filter((tool) => !tool.consumable).reduce((sum, tool) => sum + Math.max(0, tool.qty - tool.returned), 0);
  const attendance = new Set(store.attendanceLogs.filter((row) => row.date === today() && row.checkInAt).map((row) => row.operator)).size;
  const pendingVerification = store.production.filter((row) => (row.verificationStatus ?? "pending") === "pending").length;
  const activeItems = store.items.map((item) => {
    const goodDone = itemOpDone(item.id, "OP1");
    const complete = itemFinished(item);
    const activeOp = item.ops.find((op) => itemOpDone(item.id, op) < Number(item.opTargets?.[op] ?? item.target)) ?? finalOp(item);
    const progress = percent(complete, Number(item.opTargets?.[finalOp(item)] ?? item.target));
    const cycle = item.cycleMin + item.loadMin + item.unloadMin;
    const left = Math.max(0, Number(item.opTargets?.[activeOp] ?? item.target) - itemOpDone(item.id, activeOp));
    return { item, goodDone, complete, progress, activeOp, eta: fmtHours(left * cycle) };
  });
  const performance = operators.map((operator) => ({ operator, qty: rows.filter((row) => row.operator === operator).reduce((sum, row) => sum + row.ok, 0) })).sort((a, b) => b.qty - a.qty);
  return `
    <div class="page-heading">
      <div><p class="eyebrow">${escapeHtml(new Date().toLocaleDateString("id-ID", { weekday: "long" }).toUpperCase())} · CONTROL ROOM</p><h1>Ringkasan produksi</h1><p class="subtitle">Pantau hasil, target, alur PO, dan pemakaian tools dalam satu tampilan.</p></div>
      <div class="heading-actions"><select class="select-control" aria-label="Filter shift"><option>Semua shift</option><option>Shift 1</option><option>Shift 2</option></select><button class="button" data-export="production">↓ Ekspor CSV</button></div>
    </div>
    <div class="metric-grid">
      ${metric("Hasil OK hari ini", number(good), `<span class="${good >= target ? "positive" : ""}">${percent(good, target)}%</span> dari target ${number(target)} pcs`, "▣", "")}
      ${metric("Sedang dikerjakan", number(activeItems.filter((entry) => entry.progress < 100).length), "PO aktif di line produksi", "◷", "green")}
      ${metric("Repair / NG", `${number(repairs)} / ${number(ng)}`, "Jumlah aktual · tidak disamarkan", "!", "amber")}
      ${metric("Tools di operator", number(openTools), `${number(pendingVerification)} laporan menunggu verifikasi · ${number(attendance)} hadir*`, "⌁", "red")}
    </div>
    <div class="dashboard-grid">
      <section class="panel">
        <div class="panel-header"><div><h2 class="panel-title">Loading line · progres PO</h2><p class="panel-subtitle">Perkiraan waktu berdasarkan cycle + loading + unloading yang diinput.</p></div><span class="status info">${store.items.length} PO</span></div>
        <div class="progress-list">
          ${activeItems.map(({ item, complete, progress, activeOp, eta }) => `<div class="progress-row"><div class="progress-meta"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.po)} · ${escapeHtml(item.customer)}</small></div><div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div><div class="progress-value"><strong>${progress}%</strong><br>${escapeHtml(activeOp)} · ${eta}</div></div>`).join("")}
        </div>
      </section>
      <section class="panel">
        <div class="panel-header"><div><h2 class="panel-title">Hasil OK per jam</h2><p class="panel-subtitle">Berdasarkan laporan yang diinput hari ini · pcs</p></div><div class="legend"><i class="legend-dot"></i>Produksi OK</div></div>
        ${renderChart(rows)}
      </section>
    </div>
    <section class="panel mb-13"><div class="panel-header"><div><h2 class="panel-title">Loading line per mesin</h2><p class="panel-subtitle">Pekerjaan terakhir, operator, tahap, waktu proses, dan status verifikasi.</p></div>${activeRole === "admin" ? `<button class="panel-link" data-view="verification">Buka verifikasi →</button>` : ""}</div>${renderMachineLines()}</section>
    <div class="lower-grid">
      <section class="panel">
        <div class="panel-header"><div><h2 class="panel-title">Hasil operator hari ini</h2><p class="panel-subtitle">Output dipisahkan per operator dan mesin.</p></div>${activeRole === "admin" ? `<button class="panel-link" data-view="operator">Input laporan →</button>` : ""}</div>
        ${renderOperatorSummary(rows)}
      </section>
      <section class="panel">
        <div class="panel-header"><div><h2 class="panel-title">Status material &amp; tools</h2><p class="panel-subtitle">Stok dihitung dari penerimaan dikurangi konsumsi di OP1.</p></div><button class="panel-link" data-view="materials">Lihat detail →</button></div>
        <div class="stock-summary"><div class="stock-box"><span>Material tersedia</span><strong>${number(store.items.reduce((sum, item) => sum + Math.max(0, itemStock(item.id)), 0))} pcs</strong></div><div class="stock-box"><span>Tools dipegang</span><strong>${number(openTools)} pcs</strong></div><div class="stock-box"><span>Barang terkirim</span><strong>${number(store.shipments.filter((row) => row.date === today()).reduce((sum, row) => sum + row.qty, 0))} pcs</strong></div></div>
        <div class="operator-bars">${performance.slice(0, 4).map(({ operator, qty }) => `<div class="operator-bar-row"><span>${escapeHtml(operator)}</span><div class="bar-track"><div class="bar-fill" style="width:${percent(qty, Math.max(1, ...performance.map((entry) => entry.qty)))}%"></div></div><strong>${number(qty)}</strong></div>`).join("")}</div>
      </section>
    </div>
    <p class="table-note">* Status absensi adalah data demo/manual; integrasi Google Sheets belum diaktifkan. Estimasi line memakai target harian dan waktu proses per item, bukan prediksi jadwal shift yang terverifikasi.</p>
  `;
}

function verificationBadge(row) {
  const status = row.verificationStatus ?? "pending";
  const label = status === "verified" ? `Terverifikasi · ${row.verifiedBy ?? "Admin"}` : status === "rejected" ? "Perlu koreksi" : "Menunggu";
  const color = status === "verified" ? "ok" : status === "rejected" ? "bad" : "warn";
  return `<span class="status ${color}">${escapeHtml(label)}</span>`;
}

function renderMachineLines() {
  const latest = new Map();
  store.production.forEach((row) => {
    const previous = latest.get(row.machine);
    if (!previous || `${row.date}T${row.time}` > `${previous.date}T${previous.time}`) latest.set(row.machine, row);
  });
  return `<div class="table-wrap"><table><thead><tr><th>Mesin</th><th>Pekerjaan / PO</th><th>Operator</th><th>Tahap</th><th>Terakhir dilaporkan</th><th>Cycle · loading · unloading</th><th>Verifikasi</th></tr></thead><tbody>${machines.map((machine) => {
    const row = latest.get(machine);
    return `<tr><td><strong>${escapeHtml(machine)}</strong></td>${row ? `<td>${escapeHtml(itemName(row.itemId))}<br><span class="muted">${escapeHtml(itemById(row.itemId)?.po ?? "")}</span></td><td>${escapeHtml(row.operator)}</td><td><span class="status info">${escapeHtml(row.op)}</span></td><td>${number(row.ok)} OK · ${number(row.repair)} repair · ${number(row.ng)} NG<br><span class="muted">${escapeHtml(row.date)} ${escapeHtml(row.time)}</span></td><td>CT ${fmtHours(row.cycleMin)} · L ${fmtHours(row.loadMin)} · U ${fmtHours(row.unloadMin)}</td><td>${verificationBadge(row)}</td>` : `<td colspan="6"><span class="muted">Belum ada laporan pekerjaan</span></td>`}</tr>`;
  }).join("")}</tbody></table></div>`;
}

function metric(title, value, foot, icon, color) {
  return `<div class="metric-card"><div class="metric-top">${title}<span class="metric-icon ${color}">${icon}</span></div><div class="metric-value">${value}</div><div class="metric-foot">${foot}</div></div>`;
}

function renderChart(rows) {
  const labels = ["07", "08", "09", "10", "11", "12", "13", "14"];
  const series = labels.map((hour) => rows.filter((row) => row.time?.slice(0, 2) === hour).reduce((sum, row) => sum + row.ok, 0));
  const width = 480, height = 165, left = 25, top = 10, chartW = 440, chartH = 120;
  const max = Math.max(1, ...series);
  const points = series.map((value, index) => `${left + index * (chartW / (series.length - 1))},${top + chartH - (value / max) * chartH}`);
  const path = points.join(" ");
  const area = `${left},${top + chartH} ${path} ${left + chartW},${top + chartH}`;
  const grid = [0, 1, 2, 3].map((index) => `<line class="chart-grid" x1="${left}" y1="${top + index * chartH / 3}" x2="${left + chartW}" y2="${top + index * chartH / 3}"/>`).join("");
  return `<div class="chart-wrap"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Grafik hasil OK aktual per jam"><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#5478f5" stop-opacity=".17"/><stop offset="100%" stop-color="#5478f5" stop-opacity="0"/></linearGradient></defs>${grid}<polygon class="chart-area" points="${area}"/><polyline class="chart-line" points="${path}"/>${points.map((point) => { const [x, y] = point.split(","); return `<circle class="chart-dot" cx="${x}" cy="${y}" r="3"/>`; }).join("")}${labels.map((label, index) => `<text class="chart-label" x="${left + index * (chartW / 7)}" y="153" text-anchor="middle">${label}:00</text>`).join("")}</svg></div>`;
}

function renderOperatorSummary(rows) {
  if (!rows.length) return `<div class="empty-state">Belum ada laporan produksi hari ini.</div>`;
  const summary = new Map();
  rows.forEach((row) => {
    const key = `${row.operator}__${row.machine}`;
    const current = summary.get(key) ?? { operator: row.operator, machine: row.machine, ok: 0, repair: 0, ng: 0, last: row.time };
    current.ok += row.ok;
    current.repair += row.repair;
    current.ng += row.ng;
    if (row.time > current.last) current.last = row.time;
    summary.set(key, current);
  });
  return `<div class="table-wrap"><table><thead><tr><th>Operator / Mesin</th><th>Item / OP</th><th>OK</th><th>Repair</th><th>NG</th><th>Waktu input</th></tr></thead><tbody>${[...summary.values()].slice(0, 7).map((entry) => {
    const lastRow = rows.filter((row) => row.operator === entry.operator && row.machine === entry.machine).at(-1);
    return `<tr><td><span class="operator-cell"><span class="mini-avatar">${initials(entry.operator)}</span><span><strong>${escapeHtml(entry.operator)}</strong><br><span class="muted">${escapeHtml(entry.machine)}</span></span></span></td><td>${escapeHtml(itemById(lastRow.itemId)?.name ?? "-")}<br><span class="muted">${escapeHtml(lastRow.op)}</span></td><td><strong>${number(entry.ok)}</strong></td><td>${number(entry.repair)}</td><td>${number(entry.ng)}</td><td>${escapeHtml(entry.last)}</td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function renderOperator() {
  const allRows = activeRole === "operator" ? store.production.filter((row) => row.operator === activeOperator) : store.production;
  const rows = [...allRows].reverse().slice(0, 12);
  const todayRows = allRows.filter((row) => row.date === today());
  const spkLocked = activeRole === "operator" && !hasOpenAttendance(activeOperator);
  const attendancePanel = activeRole === "operator" ? renderOperatorAttendance() : "";
  const operatorField = activeRole === "operator"
    ? `<div class="field"><label for="prodOperator">Nama operator (boleh isi manual)</label><input id="prodOperator" name="prodOperator" value="${escapeHtml(activeOperator)}" list="operatorNames" required /><datalist id="operatorNames">${operators.map((name) => `<option value="${escapeHtml(name)}"></option>`).join("")}</datalist></div>`
    : `<div class="field"><label for="prodOperator">Nama operator</label><select required id="prodOperator" name="prodOperator">${operatorOptions()}</select></div>`;
  const jobOperatorField = activeRole === "operator"
    ? `<div class="field"><label>Operator</label><input value="${escapeHtml(activeOperator)}" readonly /><input type="hidden" name="operator" value="${escapeHtml(activeOperator)}" /></div>`
    : `<div class="field"><label>Operator</label><select name="operator" required>${operatorOptions()}</select></div>`;
  return `
    <div class="page-heading"><div><p class="eyebrow">${activeRole === "operator" ? "DASHBOARD OPERATOR" : "INPUT OPERATOR"}</p><h1>${activeRole === "operator" ? `Halo, ${escapeHtml(activeOperator)}` : "Laporan hasil mesin"}</h1><p class="subtitle">Input hasil per mesin. Untuk kerja gabungan, tambahkan setiap mesin dengan kuantitasnya masing-masing.</p></div><div class="heading-actions"><span class="status info">${number(todayRows.length)} input hari ini</span></div></div>
    ${attendancePanel}
    ${spkLocked ? `<div class="helper-banner"><strong>SPK terkunci:</strong> lakukan absen masuk terlebih dahulu untuk membuka form hasil produksi dan setting mesin.</div>` : ""}
    <div class="helper-banner ${spkLocked ? "hidden" : ""}"><strong>Catatan alur:</strong> total OK, repair, dan NG dicatat apa adanya. Stok material berkurang hanya pada OP1 agar proses OP2/OP3 tidak menghitung material yang sama berulang kali.</div>
    <section class="form-card ${spkLocked ? "hidden" : ""}">
      <h2 class="section-title">Input produksi baru</h2>
      <form id="productionForm">
        <div class="form-grid">
          ${operatorField}
          <div class="field"><label for="prodItem">Nama item / PO</label><select required id="prodItem">${itemOptions()}</select></div>
          <div class="field"><label for="prodOp">Tahap proses</label><select required id="prodOp"></select></div>
          <div class="field"><label for="prodShift">Shift</label><select id="prodShift"><option>Shift 1</option><option>Shift 2</option></select></div>
          <div class="field"><label for="prodDate">Tanggal</label><input id="prodDate" type="date" value="${today()}" required /></div>
          <div class="field"><label for="prodTime">Jam laporan</label><input id="prodTime" type="time" value="${new Date().toTimeString().slice(0, 5)}" required /></div>
        </div>
        <hr class="form-divider" />
        <div class="panel-header"><div><h3 class="section-title" style="margin-bottom:0">Hasil per mesin</h3><p class="panel-subtitle">Isi cycle, loading, dan unloading aktual oleh operator (menit).</p></div><button class="button small" type="button" id="addMachine">＋ Tambah mesin</button></div>
        <div id="machineInputs" class="machine-inputs"></div>
        <div id="productionTotals" class="input-summary"><span>Total hasil: 0 pcs</span><span>0 mesin</span></div>
        <div class="form-actions"><button class="button primary" type="submit">Simpan laporan produksi</button></div>
      </form>
    </section>
    <section class="panel ${spkLocked ? "hidden" : ""}">
      <div class="panel-header"><div><h2 class="panel-title">Laporan operator terbaru</h2><p class="panel-subtitle">Data tersimpan lokal di browser ini.</p></div>${activeRole === "admin" ? `<button class="button small" data-export="production">↓ CSV</button>` : ""}</div>
      ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Tanggal / Jam</th><th>Operator</th><th>Mesin</th><th>Nama item</th><th>OP</th><th>Cycle + L/U</th><th>OK</th><th>Repair</th><th>NG</th><th>Verifikasi</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row.date)}<br><span class="muted">${escapeHtml(row.time)} · ${escapeHtml(row.shift)}</span></td><td><strong>${escapeHtml(row.operator)}</strong></td><td>${escapeHtml(row.machine)}</td><td>${escapeHtml(itemName(row.itemId))}</td><td><span class="status info">${escapeHtml(row.op)}</span></td><td>CT ${fmtHours(row.cycleMin)} · L ${fmtHours(row.loadMin)} · U ${fmtHours(row.unloadMin)}</td><td><strong>${number(row.ok)}</strong></td><td>${number(row.repair)}</td><td>${number(row.ng)}</td><td>${verificationBadge(row)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state">Belum ada input produksi.</div>`}
    </section>
    <section class="form-card mt-13 ${spkLocked ? "hidden" : ""}">
      <h2 class="section-title">Perubahan pekerjaan / setting mesin</h2>
      <p class="panel-subtitle">Catat pergantian item pada mesin untuk mengukur waktu setup dan pergantian pekerjaan.</p>
      <form id="jobForm" class="inline-form mt-13">
        ${jobOperatorField}
        <div class="field"><label>Mesin</label><select name="machine" required>${machineOptions()}</select></div>
        <div class="field"><label>Pekerjaan sebelumnya</label><select name="fromItem">${itemOptions()}</select></div>
        <div class="field"><label>Pekerjaan berikutnya</label><select name="toItem" required>${itemOptions()}</select></div>
        <div class="field"><label>Mulai setting</label><input name="start" type="datetime-local" value="${localInputTime()}" required /></div>
        <div class="field"><label>Selesai setting</label><input name="end" type="datetime-local" /></div>
        <div class="field"><label>Alasan / catatan</label><input name="reason" placeholder="Pergantian PO, setting awal..." /></div>
        <button class="button primary" type="submit">Simpan setting</button>
      </form>
    </section>
    <section class="panel mt-13 ${spkLocked ? "hidden" : ""}"><div class="panel-header"><div><h2 class="panel-title">Riwayat setting mesin</h2><p class="panel-subtitle">Durasi dihitung dari waktu mulai dan selesai yang diinput.</p></div></div>${renderJobs()}</section>
  `;
}

function renderOperatorAttendance() {
  const latest = attendanceForToday(activeOperator);
  const open = currentAttendance(activeOperator);
  const logs = store.attendanceLogs.filter((row) => row.operator === activeOperator).slice(-5).reverse();
  return `<section class="panel attendance-panel mb-13"><div class="panel-header"><div><h2 class="panel-title">Absensi &amp; pengajuan izin</h2><p class="panel-subtitle">Waktu masuk/pulang otomatis dicatat. Status menunggu verifikasi Admin.</p></div><span class="status ${open ? "ok" : "warn"}">${open ? "Sedang bekerja" : latest?.checkOutAt ? "Sudah pulang" : "Belum absen"}</span></div>
    <div class="attendance-actions"><div class="field"><label>Shift saat ini</label><select id="attendanceShift"><option>Shift 1</option><option>Shift 2</option><option>Tukar shift</option></select></div><button class="button primary" type="button" data-attendance-action="checkin" ${open ? "disabled" : ""}>Absen masuk</button><button class="button" type="button" data-attendance-action="checkout" ${open ? "" : "disabled"}>Absen pulang</button></div>
    <div class="attendance-warning"><strong>Pengingat:</strong> laporkan hasil sesuai aktual. Pengajuan sakit disarankan minimal 10 jam sebelum; cuti/libur minimal 1 minggu sebelum melalui formulir di bawah.</div>
    <form id="leaveForm" class="leave-form"><h3 class="section-title">Form izin sakit / cuti</h3><div class="form-grid">
      <div class="field"><label>Jenis pengajuan</label><select name="type"><option>Sakit</option><option>Izin</option><option>Cuti</option></select></div>
      <div class="field"><label>Mulai</label><input name="startAt" type="datetime-local" required /></div>
      <div class="field"><label>Selesai</label><input name="endAt" type="datetime-local" required /></div>
      <div class="field"><label>Alasan</label><input name="reason" required placeholder="Jelaskan alasan pengajuan" /></div>
    </div><div class="form-actions"><button class="button" type="submit">Kirim pengajuan</button></div></form>
    ${logs.length ? `<div class="table-wrap mt-13"><table><thead><tr><th>Tanggal / Shift</th><th>Masuk</th><th>Status masuk</th><th>Pulang</th><th>Status pulang</th></tr></thead><tbody>${logs.map((row) => `<tr><td>${escapeHtml(row.date)}<br><span class="muted">${escapeHtml(row.shift)}</span></td><td>${row.checkInAt ? escapeHtml(new Date(row.checkInAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })) : "—"}</td><td>${attendanceBadge(row.checkInVerification)}</td><td>${row.checkOutAt ? escapeHtml(new Date(row.checkOutAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })) : "—"}</td><td>${row.checkOutAt ? attendanceBadge(row.checkOutVerification) : "—"}</td></tr>`).join("")}</tbody></table></div>` : ""}
    </section>`;
}

function attendanceBadge(status = "pending") {
  return `<span class="status ${status === "verified" ? "ok" : status === "rejected" ? "bad" : "warn"}">${status === "verified" ? "Terverifikasi" : status === "rejected" ? "Ditolak" : "Pending"}</span>`;
}

function machineRow(index = 0) {
  return `<div class="machine-input-row" data-machine-row="${index}">
    <div class="field"><label>Mesin</label><select name="machine" required>${machineOptions()}</select></div>
    <div class="field"><label>Cycle time (menit)</label><input name="cycleMin" type="number" min="0" step="0.1" placeholder="8" required /></div>
    <div class="field"><label>Loading (menit)</label><input name="loadMin" type="number" min="0" step="0.1" placeholder="1" required /></div>
    <div class="field"><label>Unloading (menit)</label><input name="unloadMin" type="number" min="0" step="0.1" placeholder="1" required /></div>
    <div class="field"><label>Hasil OK (pcs)</label><input name="ok" type="number" min="0" step="1" value="0" required /></div>
    <div class="field"><label>Repair (pcs)</label><input name="repair" type="number" min="0" step="1" value="0" required /></div>
    <div class="field"><label>NG (pcs)</label><input name="ng" type="number" min="0" step="1" value="0" required /></div>
    ${index > 0 ? `<button class="button small danger remove-machine" type="button">Hapus mesin</button>` : `<span class="field-hint">Cycle + loading + unloading digunakan untuk estimasi waktu proses.</span>`}
  </div>`;
}

function updateOpOptions() {
  const item = itemById(document.querySelector("#prodItem")?.value);
  const select = document.querySelector("#prodOp");
  if (select) select.innerHTML = (item?.ops ?? ["OP1"]).map((op) => `<option>${escapeHtml(op)}</option>`).join("");
}

function updateProductionTotals() {
  const form = document.querySelector("#productionForm");
  if (!form) return;
  const values = [...form.querySelectorAll(".machine-input-row")].map((row) => {
    const read = (name) => Number(row.querySelector(`[name="${name}"]`).value) || 0;
    return { total: read("ok") + read("repair") + read("ng"), ok: read("ok"), repair: read("repair"), ng: read("ng") };
  });
  const summary = document.querySelector("#productionTotals");
  summary.innerHTML = `<span>Hasil: <strong>${number(values.reduce((sum, value) => sum + value.total, 0))} pcs</strong> · OK ${number(values.reduce((sum, value) => sum + value.ok, 0))} · Repair ${number(values.reduce((sum, value) => sum + value.repair, 0))} · NG ${number(values.reduce((sum, value) => sum + value.ng, 0))}</span><span>${values.length} mesin</span>`;
}

function renderJobs() {
  const jobs = activeRole === "operator" ? store.jobs.filter((job) => job.operator === activeOperator) : store.jobs;
  if (!jobs.length) return `<div class="empty-state">Belum ada perubahan pekerjaan.</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Operator / Mesin</th><th>Dari item</th><th>Ke item</th><th>Mulai</th><th>Selesai</th><th>Durasi</th><th>Catatan</th></tr></thead><tbody>${[...jobs].reverse().slice(0, 8).map((job) => {
    const duration = job.end ? Math.max(0, Math.round((new Date(job.end) - new Date(job.start)) / 60000)) : null;
    return `<tr><td><strong>${escapeHtml(job.operator)}</strong><br><span class="muted">${escapeHtml(job.machine)}</span></td><td>${escapeHtml(itemName(job.fromItem))}</td><td>${escapeHtml(itemName(job.toItem))}</td><td>${escapeHtml(job.start.replace("T", " "))}</td><td>${job.end ? escapeHtml(job.end.replace("T", " ")) : `<span class="status warn">Berjalan</span>`}</td><td>${duration === null ? "—" : `${number(duration)} menit`}</td><td>${escapeHtml(job.reason || "—")}</td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function renderVerification() {
  const rows = [...store.production].reverse();
  const pending = rows.filter((row) => (row.verificationStatus ?? "pending") === "pending").length;
  return `<div class="page-heading"><div><p class="eyebrow">KONTROL ADMIN</p><h1>Verifikasi hasil pekerjaan</h1><p class="subtitle">Periksa catatan operator, item/PO, mesin, waktu proses, dan hasil sebelum menyetujui laporan.</p></div><div class="heading-actions"><span class="status ${pending ? "warn" : "ok"}">${number(pending)} menunggu</span></div></div>
    <div class="helper-banner"><strong>Audit:</strong> setiap keputusan verifikasi mencatat akun admin, waktu, status, dan catatan koreksi. Data OK/repair/NG asli tidak diubah saat diverifikasi.</div>
    <section class="panel"><div class="panel-header"><div><h2 class="panel-title">Daftar hasil yang dilaporkan</h2><p class="panel-subtitle">Hanya Admin yang dapat mengubah status verifikasi.</p></div><button class="button small" data-export="production">↓ Ekspor CSV</button></div>
      ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Tanggal / Jam</th><th>Operator / Mesin</th><th>Item / OP</th><th>Waktu proses</th><th>OK</th><th>Repair</th><th>NG</th><th>Status verifikasi</th><th>Tindakan Admin</th></tr></thead><tbody>${rows.map((row) => {
        const status = row.verificationStatus ?? "pending";
        const audit = status === "pending" ? "—" : `${escapeHtml(row.verifiedBy ?? "Admin")}<br><span class="muted">${escapeHtml(row.verifiedAt ? new Date(row.verifiedAt).toLocaleString("id-ID") : "")}</span>${row.verificationNote ? `<br><span class="muted">${escapeHtml(row.verificationNote)}</span>` : ""}`;
        return `<tr><td>${escapeHtml(row.date)}<br><span class="muted">${escapeHtml(row.time)}</span></td><td><strong>${escapeHtml(row.operator)}</strong><br><span class="muted">${escapeHtml(row.machine)} · ${escapeHtml(row.shift)}</span></td><td>${escapeHtml(itemName(row.itemId))}<br><span class="muted">${escapeHtml(itemById(row.itemId)?.po ?? "")} · ${escapeHtml(row.op)}</span></td><td>CT ${fmtHours(row.cycleMin)}<br><span class="muted">L ${fmtHours(row.loadMin)} · U ${fmtHours(row.unloadMin)}</span></td><td><strong>${number(row.ok)}</strong></td><td>${number(row.repair)}</td><td>${number(row.ng)}</td><td>${verificationBadge(row)}${audit !== "—" ? `<br>${audit}` : ""}</td><td>${status === "pending" ? `<div class="verify-actions"><button class="button small primary" data-verify="${escapeHtml(row.id)}" data-verdict="verified">Setujui</button><button class="button small danger" data-verify="${escapeHtml(row.id)}" data-verdict="rejected">Koreksi</button></div>` : "—"}</td></tr>`;
      }).join("")}</tbody></table></div>` : `<div class="empty-state">Belum ada laporan yang dapat diverifikasi.</div>`}
    </section>
    ${renderAttendanceVerification()}
    ${renderLeaveVerification()}`;
}

function renderAttendanceVerification() {
  const rows = [...store.attendanceLogs].reverse();
  return `<section class="panel mt-13"><div class="panel-header"><div><h2 class="panel-title">Verifikasi absensi masuk &amp; pulang</h2><p class="panel-subtitle">Status menjadi terverifikasi hanya setelah Admin menekan tombol verifikasi.</p></div></div>${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Tanggal / Operator</th><th>Shift</th><th>Masuk</th><th>Status masuk</th><th>Aksi masuk</th><th>Pulang</th><th>Status pulang</th><th>Aksi pulang</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row.date)}<br><strong>${escapeHtml(row.operator)}</strong></td><td>${escapeHtml(row.shift)}</td><td>${row.checkInAt ? escapeHtml(new Date(row.checkInAt).toLocaleString("id-ID")) : "—"}</td><td>${row.checkInAt ? attendanceBadge(row.checkInVerification) : "—"}</td><td>${row.checkInAt && (row.checkInVerification ?? "pending") === "pending" ? `<button class="button small primary" data-verify-attendance="${escapeHtml(row.id)}" data-attendance-kind="checkIn">Verifikasi masuk</button>` : "—"}</td><td>${row.checkOutAt ? escapeHtml(new Date(row.checkOutAt).toLocaleString("id-ID")) : "—"}</td><td>${row.checkOutAt ? attendanceBadge(row.checkOutVerification) : "—"}</td><td>${row.checkOutAt && (row.checkOutVerification ?? "pending") === "pending" ? `<button class="button small primary" data-verify-attendance="${escapeHtml(row.id)}" data-attendance-kind="checkOut">Verifikasi pulang</button>` : "—"}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state">Belum ada data absensi untuk diverifikasi.</div>`}</section>`;
}

function renderLeaveVerification() {
  const requests = [...store.leaveRequests].reverse();
  return `<section class="panel mt-13"><div class="panel-header"><div><h2 class="panel-title">Verifikasi izin / cuti</h2><p class="panel-subtitle">Pengajuan operator menunggu persetujuan Admin.</p></div></div>${requests.length ? `<div class="table-wrap"><table><thead><tr><th>Operator</th><th>Jenis</th><th>Waktu pengajuan</th><th>Periode</th><th>Alasan</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${requests.map((row) => `<tr><td><strong>${escapeHtml(row.operator)}</strong></td><td>${escapeHtml(row.type)}</td><td>${escapeHtml(new Date(row.submittedAt).toLocaleString("id-ID"))}</td><td>${escapeHtml(new Date(row.startAt).toLocaleString("id-ID"))}<br><span class="muted">s/d ${escapeHtml(new Date(row.endAt).toLocaleString("id-ID"))}</span></td><td>${escapeHtml(row.reason)}</td><td>${attendanceBadge(row.status)}</td><td>${row.status === "pending" ? `<div class="verify-actions"><button class="button small primary" data-verify-leave="${escapeHtml(row.id)}" data-verdict="verified">Setujui</button><button class="button small danger" data-verify-leave="${escapeHtml(row.id)}" data-verdict="rejected">Tolak</button></div>` : escapeHtml(row.verifiedBy ? `Oleh ${row.verifiedBy}` : "—")}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state">Belum ada pengajuan izin atau cuti.</div>`}</section>`;
}

function renderTools() {
  const visibleTools = activeRole === "operator" ? store.tools.filter((tool) => tool.operator === activeOperator || (store.handovers ?? []).some((row) => row.toolCode === tool.code && (row.fromOperator === activeOperator || row.toOperator === activeOperator))) : store.tools;
  const active = visibleTools.filter((tool) => !tool.consumable && tool.qty > tool.returned);
  const heldCount = activeRole === "operator" ? visibleTools.reduce((sum, tool) => sum + toolHeldByOperator(tool, activeOperator), 0) : active.reduce((sum, tool) => sum + tool.qty - tool.returned, 0);
  const broken = totalFor(visibleTools, "broken") + totalFor(visibleTools, "damaged");
  return `
    <div class="page-heading"><div><p class="eyebrow">PEMAKAIAN &amp; SERAH TERIMA</p><h1>Kontrol tools</h1><p class="subtitle">Lacak pengambilan, kondisi, perpindahan shift, dan pengembalian dengan kode unik.</p></div><div class="heading-actions"><span class="status ${active.length ? "warn" : "ok"}">${number(active.reduce((sum, tool) => sum + tool.qty - tool.returned, 0))} pcs belum kembali</span></div></div>
    <div class="metric-grid">
      ${metric("Tools sedang dipegang", number(heldCount), `${active.length} kode tools aktif`, "⌁", "blue")}
      ${metric("Patah / rusak", number(broken), "Dicatat sesuai laporan operator", "!", "red")}
      ${metric("Tumpul", number(totalFor(visibleTools, "blunt")), "Tercatat pada log pengambilan", "⌑", "amber")}
      ${metric("Pengembalian tercatat", number(totalFor(visibleTools, "returned")), "Termasuk tools non-habis-pakai", "↩", "green")}
    </div>
    <div class="helper-banner"><strong>Kode retur:</strong> tools non-habis-pakai harus dikembalikan memakai kode yang sama dengan pengambilan. Item habis pakai (${consumables.join(", ")}) masuk catatan pemakaian dan tidak menambah stok retur.</div>
    <div class="subnav"><button data-tool-tab="log" class="${activeToolTab === "log" ? "active" : ""}">Log tools</button><button data-tool-tab="issue" class="${activeToolTab === "issue" ? "active" : ""}">Ambil / tambah log</button><button data-tool-tab="handover" class="${activeToolTab === "handover" ? "active" : ""}">Serah terima shift</button>${activeRole === "admin" ? `<button data-tool-tab="inventory" class="${activeToolTab === "inventory" ? "active" : ""}">Stok inventori</button><button data-tool-tab="verifyReturns" class="${activeToolTab === "verifyReturns" ? "active" : ""}">Verifikasi retur</button>` : ""}</div>
    ${activeToolTab === "issue" ? renderToolForm() : activeToolTab === "handover" ? renderHandoverForm() : activeToolTab === "inventory" && activeRole === "admin" ? renderToolInventory() : ""}
    ${activeToolTab === "handover" ? renderHandoverTable() : activeToolTab === "verifyReturns" && activeRole === "admin" ? renderToolReturnVerification() : activeToolTab === "inventory" && activeRole === "admin" ? "" : renderToolTable()}
  `;
}

function renderToolForm() {
  const operatorField = activeRole === "operator"
    ? `<div class="field"><label>Operator</label><input value="${escapeHtml(activeOperator)}" readonly /><input type="hidden" name="operator" value="${escapeHtml(activeOperator)}" /></div>`
    : `<div class="field"><label>Operator</label><select name="operator" required>${operatorOptions()}</select></div>`;
  return `<section class="form-card"><h2 class="section-title">Catat pengambilan / pemakaian tools</h2><form id="toolForm">
    <div class="form-grid">
      ${operatorField}
      <div class="field"><label>Nama tools inventori</label><select name="name" required>${store.toolsInventory.map((tool) => `<option value="${escapeHtml(tool.name)}">${escapeHtml(tool.name)} · baru ${number(tool.newQty)} / bekas ${number(tool.usedQty)}</option>`).join("")}</select></div>
      <div class="field"><label>Jumlah diambil</label><input name="qty" type="number" min="1" step="1" value="1" required /></div>
      <div class="field"><label>Ambil dari stok</label><select name="stockType"><option value="baru">Baru</option><option value="bekas">Bekas · reusable</option></select></div>
      <div class="field"><label>Mesin yang menggunakan</label><select name="machine" required>${machineOptions()}</select></div>
      <div class="field"><label>Kondisi saat diambil</label><select name="condition"><option>Baik</option><option>Tumpul</option><option>Patah</option><option>Rusak</option></select></div>
      <div class="field"><label>Shift</label><select name="shift"><option>Shift 1</option><option>Shift 2</option></select></div>
      <div class="field"><label>Jam pengambilan</label><input name="date" type="datetime-local" value="${localInputTime()}" required /></div>
      <div class="field"><label>Jumlah patah</label><input name="broken" type="number" min="0" value="0" /></div>
      <div class="field"><label>Jumlah tumpul</label><input name="blunt" type="number" min="0" value="0" /></div>
      <div class="field"><label>Jumlah rusak</label><input name="damaged" type="number" min="0" value="0" /></div>
    </div>
    <label class="checkline mt-13"><input type="checkbox" name="consumable" /> Item habis pakai (tidak perlu retur berkode)</label>
    <div class="form-actions"><button class="button primary" type="submit">Simpan pengambilan</button></div>
  </form>${recentToolCode ? `<div class="generated-code"><span>Kode unik pengambilan</span><strong>${escapeHtml(recentToolCode)}</strong><small>Gunakan kode yang sama saat tools dikembalikan.</small></div>` : ""}</section>`;
}

function renderToolInventory() {
  return `<section class="form-card"><h2 class="section-title">Tambah tools ke inventori</h2><form id="toolInventoryForm" class="form-grid">
    <div class="field"><label>Nama tools</label><input name="name" required placeholder="Contoh: Endmill 10 mm" /></div>
    <div class="field"><label>Stok baru</label><input name="newQty" type="number" min="0" value="0" required /></div>
    <div class="field"><label>Stok bekas · reusable</label><input name="usedQty" type="number" min="0" value="0" required /></div>
    <div class="field"><label>Stok afkir</label><input name="scrapQty" type="number" min="0" value="0" required /></div>
    <div class="field"><label>Batas minimal</label><input name="minQty" type="number" min="0" value="0" required /></div>
    <div class="form-actions"><button class="button primary" type="submit">Tambah stok tools</button></div>
  </form></section>
  <section class="panel"><div class="panel-header"><div><h2 class="panel-title">Stok inventori tools</h2><p class="panel-subtitle">Nilai stok bisa disesuaikan admin. Retur operator menambah stok setelah diverifikasi.</p></div></div><div class="table-wrap"><table><thead><tr><th>Nama tools</th><th>Stok baru</th><th>Bekas reusable</th><th>Afkir</th><th>Batas minimal</th><th>Status stok</th></tr></thead><tbody>${store.toolsInventory.map((item) => {
    const available = item.newQty + item.usedQty;
    const low = available <= item.minQty;
    return `<tr><td><strong>${escapeHtml(item.name)}</strong></td>${["newQty", "usedQty", "scrapQty", "minQty"].map((field) => `<td><input class="stock-edit" type="number" min="0" step="1" value="${item[field]}" data-stock-id="${escapeHtml(item.id)}" data-stock-field="${field}" aria-label="${escapeHtml(item.name)} ${field}" /></td>`).join("")}<td><span class="status ${low ? "warn" : "ok"}">${low ? "Perlu restock" : "Cukup"}</span></td></tr>`;
  }).join("")}</tbody></table></div></section>`;
}

function renderToolReturnVerification() {
  const pending = store.tools.flatMap((tool) => (tool.returnEvents ?? []).map((entry, index) => ({ tool, entry, index }))).filter(({ entry }) => entry.status === "pending");
  return `<section class="panel"><div class="panel-header"><div><h2 class="panel-title">Retur menunggu verifikasi Admin</h2><p class="panel-subtitle">Kode awal sudah cocok; stok bekas/afkir bertambah setelah Admin menyetujui kondisi retur.</p></div></div>${pending.length ? `<div class="table-wrap"><table><thead><tr><th>Kode awal</th><th>Tools / mesin</th><th>Operator</th><th>Jumlah</th><th>Kondisi / alasan</th><th>Waktu kembali</th><th>Aksi</th></tr></thead><tbody>${pending.map(({ tool, entry, index }) => `<tr><td><span class="tool-code">${escapeHtml(tool.code)}</span><br><span class="status info">Kode cocok</span></td><td>${escapeHtml(tool.name)}<br><span class="muted">${escapeHtml(tool.machine ?? "—")}</span></td><td>${escapeHtml(entry.operator)}</td><td>${number(entry.qty)}</td><td>${escapeHtml(entry.condition)}<br><span class="muted">${escapeHtml(entry.reason || "—")}</span></td><td>${escapeHtml(new Date(entry.date).toLocaleString("id-ID"))}</td><td><div class="verify-actions"><button class="button small primary" data-verify-tool-return="${escapeHtml(tool.id)}" data-return-index="${index}" data-verdict="verified">Verifikasi</button><button class="button small danger" data-verify-tool-return="${escapeHtml(tool.id)}" data-return-index="${index}" data-verdict="rejected">Tolak</button></div></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state">Tidak ada retur yang menunggu verifikasi.</div>`}</section>`;
}

function renderToolTable() {
  const tools = activeRole === "operator" ? store.tools.filter((tool) => tool.operator === activeOperator || (store.handovers ?? []).some((row) => row.toolCode === tool.code && (row.fromOperator === activeOperator || row.toOperator === activeOperator))) : store.tools;
  if (!tools.length) return `<section class="panel"><div class="empty-state">Belum ada catatan tools.</div></section>`;
  return `<section class="panel"><div class="panel-header"><div><h2 class="panel-title">Log tools &amp; status pengembalian</h2><p class="panel-subtitle">Kode: tipe tools + inisial operator + tanggal/jam pengambilan + nomor urut.</p></div>${activeRole === "admin" ? `<button class="button small" data-export="tools">↓ CSV</button>` : ""}</div><div class="table-wrap"><table><thead><tr><th>Kode unik</th><th>Waktu ambil</th><th>Operator / Shift</th><th>Tools</th><th>Diambil</th><th>Kondisi</th><th>Dipegang</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${[...tools].reverse().map((tool) => {
    const held = tool.consumable ? 0 : Math.max(0, tool.qty - tool.returned);
    const holders = toolHolders(tool).map((entry) => `${entry.operator} ${number(entry.qty)}`).join(", ");
    const pendingReturn = (tool.returnEvents ?? []).some((entry) => entry.status === "pending");
    const canReturn = !tool.consumable && (activeRole === "admin" || toolHeldByOperator(tool, activeOperator) > 0);
    const returnStatus = tool.consumable ? "Habis pakai" : pendingReturn ? "Retur · verifikasi admin" : held ? "Di operator" : "Selesai";
    return `<tr><td>${tool.consumable ? `<span class="muted">Habis pakai</span>` : `<span class="tool-code">${escapeHtml(tool.code)}</span>`}</td><td>${escapeHtml(new Date(tool.date).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" }))}</td><td><strong>${escapeHtml(tool.operator)}</strong><br><span class="muted">${escapeHtml(tool.shift)}</span></td><td>${escapeHtml(tool.name)}<br><span class="muted">${escapeHtml(tool.machine ?? "—")} · ${escapeHtml(tool.stockType ?? "—")}</span></td><td>${number(tool.qty)}</td><td>${escapeHtml(tool.condition)}${tool.broken ? ` · patah ${number(tool.broken)}` : ""}${tool.blunt ? ` · tumpul ${number(tool.blunt)}` : ""}${tool.damaged ? ` · rusak ${number(tool.damaged)}` : ""}</td><td>${number(held)}${holders ? `<br><span class="muted">${escapeHtml(holders)}</span>` : ""}</td><td><span class="status ${held || pendingReturn ? "warn" : "ok"}">${returnStatus}</span></td><td>${canReturn ? `<button class="button small" data-return-tool="${escapeHtml(tool.code)}">Retur</button>` : "—"}</td></tr>`;
  }).join("")}</tbody></table></div><p class="table-note">Jumlah patah/tumpul/rusak dicatat untuk pelaporan kondisi; admin tetap perlu memeriksa fisik dan menyetujui selisih stok.</p></section>`;
}

function renderHandoverForm() {
  const fromOperatorField = activeRole === "operator"
    ? `<div class="field"><label>Operator menyerahkan</label><input value="${escapeHtml(activeOperator)}" readonly /><input type="hidden" name="fromOperator" value="${escapeHtml(activeOperator)}" /></div>`
    : `<div class="field"><label>Operator menyerahkan</label><select name="fromOperator" required>${operatorOptions()}</select></div>`;
  const handoverTools = store.tools.filter((tool) => !tool.consumable && tool.qty > tool.returned && (activeRole !== "operator" || toolHeldByOperator(tool, activeOperator) > 0));
  return `<section class="form-card"><h2 class="section-title">Serah terima tools antar-shift</h2><form id="handoverForm">
    <div class="form-grid">
      ${fromOperatorField}
      <div class="field"><label>Operator menerima</label><select name="toOperator" required>${operatorOptions(activeRole === "operator" ? operators.find((name) => name !== activeOperator) : "")}</select></div>
      <div class="field"><label>Shift asal</label><select name="fromShift"><option>Shift 1</option><option>Shift 2</option></select></div>
      <div class="field"><label>Shift tujuan</label><select name="toShift"><option>Shift 2</option><option>Shift 1</option></select></div>
      <div class="field"><label>Kode unik tools</label><select name="toolCode" required>${handoverTools.map((tool) => `<option value="${escapeHtml(tool.code)}">${escapeHtml(tool.code)} · ${escapeHtml(tool.name)}</option>`).join("")}</select></div>
      <div class="field"><label>Jumlah diserahterimakan</label><input name="qty" type="number" min="1" value="1" required /></div>
      <div class="field"><label>Jam serah terima</label><input name="date" type="datetime-local" value="${localInputTime()}" required /></div>
      <div class="field"><label>Bukti / catatan</label><input name="evidence" placeholder="Nomor form, catatan kondisi..." required /></div>
    </div><div class="form-actions"><button class="button primary" type="submit">Simpan serah terima</button></div>
  </form></section>`;
}

function renderHandoverTable() {
  const handovers = activeRole === "operator" ? store.handovers.filter((row) => row.fromOperator === activeOperator || row.toOperator === activeOperator) : store.handovers;
  if (!handovers.length) return `<section class="panel"><div class="empty-state">Belum ada serah terima tools.</div></section>`;
  return `<section class="panel"><div class="panel-header"><div><h2 class="panel-title">Bukti serah terima</h2><p class="panel-subtitle">Riwayat pindah tanggung jawab per shift.</p></div></div><div class="table-wrap"><table><thead><tr><th>Waktu</th><th>Dari</th><th>Ke</th><th>Kode tools</th><th>Jumlah</th><th>Bukti / catatan</th></tr></thead><tbody>${[...handovers].reverse().map((row) => `<tr><td>${escapeHtml(new Date(row.date).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" }))}</td><td><strong>${escapeHtml(row.fromOperator)}</strong><br><span class="muted">${escapeHtml(row.fromShift)}</span></td><td><strong>${escapeHtml(row.toOperator)}</strong><br><span class="muted">${escapeHtml(row.toShift)}</span></td><td><span class="tool-code">${escapeHtml(row.toolCode)}</span></td><td>${number(row.qty)}</td><td>${escapeHtml(row.evidence)}</td></tr>`).join("")}</tbody></table></div></section>`;
}

function renderMaterials() {
  const totalStock = store.items.reduce((sum, item) => sum + Math.max(0, itemStock(item.id)), 0);
  const incoming = totalFor(store.receipts, "qty");
  const sent = totalFor(store.shipments, "qty");
  return `
    <div class="page-heading"><div><p class="eyebrow">INVENTORY &amp; PURCHASE ORDER</p><h1>Material &amp; progres PO</h1><p class="subtitle">Pantau material masuk, WIP per operasi, barang jadi, dan pengiriman aktual.</p></div><div class="heading-actions"><button class="button" data-export="inventory">↓ Stok CSV</button><button class="button" data-export="customer">↓ Laporan kirim</button></div></div>
    <datalist id="customerNames">${customerDatalist()}</datalist>
    <div class="metric-grid">
      ${metric("Material masuk", `${number(incoming)} pcs`, `${number(store.receipts.length)} penerimaan tercatat`, "↓", "green")}
      ${metric("Bahan belum diproses", `${number(totalStock)} pcs`, "Penerimaan dikurangi jumlah yang masuk OP1", "▤", "blue")}
      ${metric("Barang terkirim", `${number(sent)} pcs`, "Berdasarkan catatan surat jalan keluar", "↗", "amber")}
      ${metric("PO / item berjalan", number(store.items.length), "WIP ditampilkan terpisah per tahap", "◷", "red")}
    </div>
    <div class="helper-banner"><strong>Penghitungan material:</strong> stock bahan hanya dikurangi dari jumlah yang mulai diproses di OP1. OP2/OP3 mencatat progres WIP tanpa mengurangi stock bahan lagi, sehingga unit yang sama tidak dihitung berkali-kali. Laporan customer berisi pengiriman OK aktual saja; angka internal tetap utuh.</div>
    <section class="form-card"><h2 class="section-title">Barang masuk</h2><form id="receiptForm" class="form-grid">
      <div class="field"><label>Nama item</label><select name="itemId" required>${itemOptions()}</select></div>
      <div class="field"><label>Nomor surat jalan</label><input name="suratJalan" required placeholder="SJ-..." /></div>
      <div class="field"><label>Customer</label><input name="customer" list="customerNames" value="${escapeHtml(store.items[0]?.customer ?? "")}" required /></div>
      <div class="field"><label>Satuan barang masuk</label><select name="unit"><option value="pcs">PCS</option><option value="batang">Batang (konversi ke PCS)</option></select></div>
      <div class="field"><label>Jumlah masuk</label><input name="sourceQty" type="number" min="1" step="1" required placeholder="0" /></div>
      <div class="field hidden" id="pcsPerBarField"><label>EQ · PCS per batang</label><input name="pcsPerBar" type="number" min="1" step="1" value="1" /><span class="field-hint">Isi konversi PCS per batang sesuai material.</span></div>
      <div class="field"><label>Tanggal masuk</label><input name="date" type="date" value="${today()}" required /></div>
      <div class="form-actions" style="grid-column:1/-1"><button class="button primary" type="submit">Catat barang masuk</button></div>
    </form></section>
    <section class="form-card"><h2 class="section-title">Barang keluar / kirim ke customer</h2><form id="shipmentForm" class="form-grid">
      <div class="field"><label>Nama item / PO</label><select name="itemId" required>${itemOptions()}</select></div>
      <div class="field"><label>Customer</label><input name="customer" list="customerNames" value="${escapeHtml(store.items[0]?.customer ?? "")}" required /></div>
      <div class="field"><label>Surat jalan keluar</label><input name="suratJalan" required placeholder="SJ-KLR-..." /></div>
      <div class="field"><label>Jumlah dikirim (pcs OK)</label><input name="qty" type="number" min="1" step="1" required /></div>
      <div class="field"><label>Tanggal kirim</label><input name="date" type="date" value="${today()}" required /></div>
      <div class="form-actions" style="grid-column:1/-1"><button class="button primary" type="submit">Catat pengiriman</button></div>
    </form><p class="table-note">Jumlah pengiriman dibatasi oleh hasil OK pada tahap akhir yang belum terkirim.</p></section>
    <section class="panel mb-13"><div class="panel-header"><div><h2 class="panel-title">Loading line per item / customer</h2><p class="panel-subtitle">Stock, WIP tiap OP, selesai, terkirim, dan target PO.</p></div></div>${renderInventoryTable()}</section>
    ${activeRole === "admin" ? renderManualProgress() : ""}
    <div class="dashboard-grid">
      <section class="panel"><div class="panel-header"><div><h2 class="panel-title">Barang masuk terbaru</h2><p class="panel-subtitle">Konversi barang batang ke PCS disimpan di catatan.</p></div></div>${renderReceipts()}</section>
      <section class="panel"><div class="panel-header"><div><h2 class="panel-title">Pengiriman aktual</h2><p class="panel-subtitle">Data terkirim tidak mencakup repair atau NG.</p></div></div>${renderShipments()}</section>
    </div>
  `;
}

function renderInventoryTable() {
  return `<div class="table-wrap"><table><thead><tr><th>Nama barang / PO</th><th>Customer</th><th>Spesifikasi material</th><th>Masuk</th><th>Belum proses</th><th>WIP per operasi</th><th>Selesai OK</th><th>Terkirim</th><th>Target per OP</th><th>Progres</th><th>Waktu standar</th></tr></thead><tbody>${store.items.map((item) => {
    const final = itemFinished(item);
    const shipped = itemShipped(item.id);
    const wip = item.ops.slice(0, -1).map((op, index) => `${op}: ${number(Math.max(0, itemOpDone(item.id, op) - itemOpDone(item.id, item.ops[index + 1])))}`).join(" · ") || "—";
    const finalTarget = Number(item.opTargets?.[finalOp(item)] ?? item.target);
    const progress = percent(final, finalTarget);
    const opTargets = item.ops.map((op) => `${op}: ${number(item.opTargets?.[op] ?? item.target)}`).join(" · ");
    return `<tr><td><strong>${escapeHtml(item.name)}</strong><br><span class="muted">${escapeHtml(item.po || "PO belum ada")}</span></td><td>${escapeHtml(item.customer)}</td><td>${escapeHtml(item.materialSpec || "—")}</td><td>${number(itemReceipts(item.id))}</td><td>${number(itemStock(item.id))}</td><td>${escapeHtml(wip)}</td><td>${number(final)}</td><td>${number(shipped)}</td><td>${escapeHtml(opTargets)}</td><td><span class="status ${progress >= 100 ? "ok" : "info"}">${progress}%</span></td><td>CT ${fmtHours(item.cycleMin)} · L ${fmtHours(item.loadMin)} · U ${fmtHours(item.unloadMin)}</td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function renderManualProgress() {
  const rows = [...(store.progressAdjustments ?? [])].reverse();
  return `<section class="form-card"><h2 class="section-title">Penyesuaian progres berjalan (admin)</h2><p class="panel-subtitle">Catat saldo progres awal atau koreksi progres PO secara terpisah. Laporan operator tidak diubah atau dihapus.</p>
    <form id="progressAdjustmentForm" class="form-grid mt-13">
      <div class="field"><label>Item / PO</label><select id="progressItem" name="itemId" required>${itemOptions()}</select></div>
      <div class="field"><label>OP</label><select id="progressOp" name="op" required>${progressOpOptions(store.items[0]?.id)}</select></div>
      <div class="field"><label>Qty progres tambahan (pcs)</label><input name="qty" type="number" min="1" step="1" required /></div>
      <div class="field"><label>Catatan / referensi</label><input name="note" required placeholder="Saldo awal / koreksi progres" /></div>
      <div class="form-actions" style="grid-column:1/-1"><button class="button primary" type="submit">Simpan progres</button></div>
    </form>
    ${rows.length ? `<div class="table-wrap mt-13"><table><thead><tr><th>Waktu</th><th>Item / OP</th><th>Qty</th><th>Catatan</th><th>Aksi</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(new Date(row.createdAt).toLocaleString("id-ID"))}</td><td>${escapeHtml(itemName(row.itemId))} · ${escapeHtml(row.op)}</td><td>${number(row.qty)}</td><td>${escapeHtml(row.note)}</td><td><button class="button small" data-edit-progress="${escapeHtml(row.id)}">Ubah data</button></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state">Belum ada penyesuaian progres manual.</div>`}
  </section>`;
}

function progressOpOptions(itemId) {
  const item = itemById(itemId);
  return (item?.ops ?? []).map((op) => `<option value="${escapeHtml(item.id)}|${escapeHtml(op)}">${escapeHtml(op)}</option>`).join("");
}

function renderReceipts() {
  if (!store.receipts.length) return `<div class="empty-state">Belum ada penerimaan barang.</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Item / SJ</th><th>Customer</th><th>Asal</th><th>Setara PCS</th></tr></thead><tbody>${[...store.receipts].reverse().slice(0, 5).map((row) => `<tr><td>${escapeHtml(row.date)}</td><td><strong>${escapeHtml(itemName(row.itemId))}</strong><br><span class="muted">${escapeHtml(row.suratJalan)}</span></td><td>${escapeHtml(row.customer)}</td><td>${number(row.sourceQty)} ${escapeHtml(row.unit)}${row.unit === "batang" ? ` × ${number(row.pcsPerBar)}` : ""}</td><td><strong>${number(row.qty)}</strong></td></tr>`).join("")}</tbody></table></div>`;
}

function renderShipments() {
  if (!store.shipments.length) return `<div class="empty-state">Belum ada barang yang dikirim.</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Tanggal / SJ</th><th>Item</th><th>Customer</th><th>Qty OK</th></tr></thead><tbody>${[...store.shipments].reverse().slice(0, 5).map((row) => `<tr><td>${escapeHtml(row.date)}<br><span class="muted">${escapeHtml(row.suratJalan)}</span></td><td>${escapeHtml(itemName(row.itemId))}</td><td>${escapeHtml(row.customer)}</td><td><strong>${number(row.qty)}</strong></td></tr>`).join("")}</tbody></table></div>`;
}

function renderMaster() {
  const items = store.items.map((item) => `<tr><td><strong>${escapeHtml(item.name)}</strong></td><td>${escapeHtml(item.customer)}</td><td>${escapeHtml(item.po || "—")}</td><td>${escapeHtml(item.materialSpec || "—")}</td><td>${escapeHtml(item.ops.map((op) => `${op} (${number(item.opTargets?.[op] ?? item.target)})`).join(" · "))}</td><td><button class="button small" data-edit-item="${escapeHtml(item.id)}">Ubah</button></td></tr>`).join("");
  return `<div class="page-heading"><div><p class="eyebrow">KONFIGURASI ADMIN</p><h1>Data master</h1><p class="subtitle">Kelola item, customer, OP dan target per OP, operator, serta mesin dari satu tempat.</p></div></div>
    <section class="form-card"><h2 class="section-title">Tambah item / PO</h2><form id="itemForm">
      <div class="form-grid">
        <div class="field"><label>Nama item</label><input name="name" required placeholder="Nama barang / part" /></div>
        <div class="field"><label>Nomor PO (opsional)</label><input name="po" placeholder="Boleh kosong / diperbarui nanti" /></div>
        <div class="field"><label>Customer</label><input name="customer" list="customerNames" required placeholder="Pilih atau ketik customer" /></div>
        <div class="field"><label>Spesifikasi material</label><input name="materialSpec" placeholder="Jenis material, ukuran, grade" /></div>
        <div class="field"><label>OP (pisahkan koma)</label><input name="ops" value="OP1, OP2, OP3" required placeholder="OP1, OP2, OP3" /></div>
        <div class="field"><label>Target PO / OP terakhir (pcs)</label><input name="target" type="number" min="1" required placeholder="100" /></div>
        <div class="field"><label>Target OP pertama (pcs)</label><input name="targetOP1" type="number" min="1" required placeholder="100" /></div>
        <div class="field"><label>Target OP2 (pcs)</label><input name="targetOP2" type="number" min="1" placeholder="100" /></div>
        <div class="field"><label>Target OP3 (pcs)</label><input name="targetOP3" type="number" min="1" placeholder="100" /></div>
        <div class="field"><label>Cycle time standar (menit)</label><input name="cycleMin" type="number" min="0" step="0.1" required placeholder="8" /></div>
        <div class="field"><label>Loading (menit)</label><input name="loadMin" type="number" min="0" step="0.1" required placeholder="1" /></div>
        <div class="field"><label>Unloading (menit)</label><input name="unloadMin" type="number" min="0" step="0.1" required placeholder="1" /></div>
      </div><div class="form-actions"><button class="button primary" type="submit">Tambah item master</button></div>
    </form></section>
    <section class="panel mb-13"><div class="panel-header"><div><h2 class="panel-title">Master item, PO, OP &amp; ukuran</h2><p class="panel-subtitle">Perubahan master akan tampil pada transaksi material tanpa menghapus riwayat laporan operator.</p></div></div><div class="table-wrap"><table><thead><tr><th>Item</th><th>Customer</th><th>PO</th><th>Spesifikasi material</th><th>OP / target</th><th>Aksi</th></tr></thead><tbody>${items}</tbody></table></div></section>
    <div class="dashboard-grid">
      <section class="form-card"><h2 class="section-title">Master customer</h2><form id="customerForm" class="inline-form"><div class="field"><label>Nama customer</label><input name="name" required placeholder="Nama perusahaan" /></div><button class="button primary" type="submit">Tambah</button></form>
        <div class="table-wrap mt-13"><table><thead><tr><th>Nama customer</th><th>Aksi</th></tr></thead><tbody>${store.customers.filter((name) => name !== "Lainnya").map((name) => `<tr><td><strong>${escapeHtml(name)}</strong></td><td><button class="button small" data-edit-customer="${escapeHtml(name)}">Ubah nama</button></td></tr>`).join("")}</tbody></table></div>
      </section>
      <section class="form-card"><h2 class="section-title">Tambah operator dan mesin</h2>
        <form id="operatorMasterForm" class="inline-form"><div class="field"><label>Nama operator</label><input name="name" required placeholder="Nama operator" /></div><button class="button primary" type="submit">Tambah operator</button></form>
        <form id="machineMasterForm" class="inline-form mt-13"><div class="field"><label>Nama mesin</label><input name="name" required placeholder="Nama mesin" /></div><button class="button primary" type="submit">Tambah mesin</button></form>
        <div class="table-wrap mt-13"><table><thead><tr><th>Operator</th><th>Aksi</th></tr></thead><tbody>${operators.map((name) => `<tr><td>${escapeHtml(name)}</td><td><button class="button small" data-edit-operator="${escapeHtml(name)}">Ubah</button></td></tr>`).join("")}</tbody></table></div>
        <div class="table-wrap mt-13"><table><thead><tr><th>Mesin</th><th>Aksi</th></tr></thead><tbody>${machines.map((name) => `<tr><td>${escapeHtml(name)}</td><td><button class="button small" data-edit-machine="${escapeHtml(name)}">Ubah</button></td></tr>`).join("")}</tbody></table></div>
      </section>
    </div><datalist id="customerNames">${customerDatalist()}</datalist>`;
}

function renderSettings() {
  const roleLabel = activeRole === "admin" ? "Admin" : "Boss";
  return `<div class="page-heading"><div><p class="eyebrow">KEAMANAN AKUN LOKAL</p><h1>Pengaturan akses ${roleLabel}</h1><p class="subtitle">Ubah kata sandi ${roleLabel} yang tersimpan di browser ini.</p></div></div>
    <section class="form-card"><form id="passwordChangeForm" class="form-grid two">
      <div class="field"><label>Kata sandi saat ini</label><input name="currentPassword" type="password" autocomplete="current-password" required /></div>
      <div class="field"><label>Kata sandi baru (minimal 8 karakter)</label><input name="newPassword" type="password" minlength="8" autocomplete="new-password" required /></div>
      <div class="field"><label>Ulangi kata sandi baru</label><input name="confirmPassword" type="password" minlength="8" autocomplete="new-password" required /></div>
      <div class="form-actions"><button class="button primary" type="submit">Ubah kata sandi</button></div>
    </form><p class="table-note">Sandi hanya berlaku pada browser ini. Aplikasi masih prototype lokal dan belum menyediakan autentikasi server.</p></section>`;
}

function renderReports() {
  return `<div class="page-heading"><div><p class="eyebrow">EKSPOR &amp; REKAP</p><h1>Laporan operasional</h1><p class="subtitle">Unduh data produksi, stok, tools, dan pengiriman dalam CSV yang bisa dibuka di Excel.</p></div></div>
    <div class="helper-banner"><strong>Format file:</strong> CSV UTF-8 dengan pemisah koma; dapat dibuka di Microsoft Excel atau Google Sheets. Ekspor customer hanya menampilkan data barang OK yang tercatat terkirim, bukan rekayasa angka hasil produksi internal.</div>
    <div class="report-grid">
      ${reportCard("Hasil produksi operator", "Nama operator, mesin, item, tahap OP, cycle time, loading/unloading, shift, serta jumlah OK/repair/NG.", "production", "Ekspor laporan produksi")}
      ${reportCard("Material & status PO", "Ringkasan masuk, material belum diproses, WIP, hasil OK tahap akhir, terkirim, dan target per item/customer.", "inventory", "Ekspor stok & progres")}
      ${reportCard("Pemakaian tools", "Kode unik pengambilan, operator, jumlah, kondisi patah/tumpul/rusak, sisa dipegang, dan pengembalian.", "tools", "Ekspor log tools")}
      ${reportCard("Pengiriman customer", "Surat jalan keluar, customer, item/PO, tanggal, dan jumlah barang OK yang benar-benar dikirim.", "customer", "Ekspor laporan customer")}
      ${reportCard("Serah terima shift", "Bukti serah terima, waktu, operator, shift, kode tools, dan kuantitas.", "handovers", "Ekspor serah terima")}
      ${reportCard("Perubahan setting mesin", "Riwayat operator, mesin, item sebelum/sesudah, waktu, durasi, dan catatan perubahan pekerjaan.", "jobs", "Ekspor setting mesin")}
      ${reportCard("Absensi operator", "Timestamp masuk/pulang, shift, status verifikasi, dan Admin yang memverifikasi.", "attendance", "Ekspor absensi")}
      ${reportCard("Izin & cuti", "Jenis, periode, alasan, status persetujuan, timestamp, dan verifikator Admin.", "leaves", "Ekspor izin/cuti")}
    </div>
    <section class="panel mt-13"><div class="panel-header"><div><h2 class="panel-title">Performa operator · hari ini</h2><p class="panel-subtitle">Kemampuan diukur dari output OK, kualitas hasil, mesin yang dikerjakan, dan waktu proses yang diinput.</p></div></div>${renderPerformanceTable()}</section>
    <section class="panel mt-13"><div class="panel-header"><div><h2 class="panel-title">Status absensi</h2><p class="panel-subtitle">Data demo/manual. Sinkronisasi Google Sheets belum tersedia di prototype lokal.</p></div></div>${renderAttendance()}</section>
  `;
}

function reportCard(title, description, kind, buttonText) {
  return `<section class="panel report-card"><h2>${title}</h2><p>${description}</p><button class="button small" data-export="${kind}">↓ ${buttonText}</button></section>`;
}

function renderPerformanceTable() {
  const rows = todayProduction();
  return `<div class="table-wrap"><table><thead><tr><th>Operator</th><th>Mesin aktif</th><th>Hasil OK</th><th>Repair</th><th>NG</th><th>Rasio OK</th><th>Rata-rata CT + L/U</th><th>Evaluasi</th></tr></thead><tbody>${operators.map((operator) => {
    const own = rows.filter((row) => row.operator === operator);
    const total = own.reduce((sum, row) => sum + processed(row), 0);
    const ok = totalFor(own, "ok"), repair = totalFor(own, "repair"), ng = totalFor(own, "ng");
    const average = own.length ? own.reduce((sum, row) => sum + row.cycleMin + row.loadMin + row.unloadMin, 0) / own.length : 0;
    const machineCount = new Set(own.map((row) => row.machine)).size;
    const quality = total ? Math.round(ok / total * 100) : 0;
    const rating = !total ? "Belum ada data" : quality >= 95 ? "Baik" : quality >= 85 ? "Perlu pantau" : "Perlu evaluasi";
    return `<tr><td><span class="operator-cell"><span class="mini-avatar">${initials(operator)}</span><strong>${escapeHtml(operator)}</strong></span></td><td>${number(machineCount)}</td><td><strong>${number(ok)}</strong></td><td>${number(repair)}</td><td>${number(ng)}</td><td>${quality}%</td><td>${average ? `${average.toFixed(1)} menit` : "—"}</td><td><span class="status ${rating === "Baik" ? "ok" : rating === "Belum ada data" ? "info" : "warn"}">${rating}</span></td></tr>`;
  }).join("")}</tbody></table></div><p class="table-note">Pemakaian tools dihitung terpisah dari performa produksi agar tidak menyimpulkan irit/boros tanpa standar pemakaian dan persetujuan supervisor.</p>`;
}

function renderAttendance() {
  return `<div class="table-wrap"><table><thead><tr><th>Operator</th><th>Absensi hari ini</th><th>Masuk</th><th>Verifikasi masuk</th><th>Pulang</th><th>Verifikasi pulang</th></tr></thead><tbody>${operators.map((operator) => {
    const row = attendanceForToday(operator);
    const status = !row ? "Belum absen" : row.checkOutAt ? "Sudah pulang" : "Sedang bekerja";
    return `<tr><td><strong>${escapeHtml(operator)}</strong></td><td><span class="status ${row ? "ok" : "warn"}">${status}</span></td><td>${row?.checkInAt ? escapeHtml(new Date(row.checkInAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })) : "—"}</td><td>${row?.checkInAt ? attendanceBadge(row.checkInVerification) : "—"}</td><td>${row?.checkOutAt ? escapeHtml(new Date(row.checkOutAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })) : "—"}</td><td>${row?.checkOutAt ? attendanceBadge(row.checkOutVerification) : "—"}</td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function addProductionRows() {
  const container = document.querySelector("#machineInputs");
  container.insertAdjacentHTML("beforeend", machineRow(container.children.length));
  updateProductionTotals();
}

function handleProductionSubmit(form) {
  if (!["admin", "operator"].includes(activeRole)) {
    showToast("Peran ini tidak diizinkan menginput produksi.");
    return;
  }
  if (activeRole === "operator" && !currentAttendance(activeOperator)) {
    showToast("Absen masuk terlebih dahulu untuk membuka input SPK.");
    return;
  }
  const data = new FormData(form);
  const date = data.get("prodDate");
  const time = data.get("prodTime");
  const rows = [...form.querySelectorAll(".machine-input-row")];
  const machinesUsed = rows.map((row) => row.querySelector('[name="machine"]').value);
  if (new Set(machinesUsed).size !== machinesUsed.length) {
    showToast("Pilih mesin yang berbeda untuk setiap baris.");
    return;
  }
  const itemId = data.get("prodItem");
  const op = data.get("prodOp");
  const reportedOperator = data.get("prodOperator").trim().replace(/\s+/g, " ");
  if (!reportedOperator) {
    showToast("Nama operator wajib diisi.");
    return;
  }
  const already = store.production.filter((row) => row.itemId === itemId && row.op === op).reduce((sum, row) => sum + processed(row), 0);
  const qty = rows.reduce((sum, row) => sum + ["ok", "repair", "ng"].reduce((sub, key) => sub + Number(row.querySelector(`[name="${key}"]`).value || 0), 0), 0);
  if (qty === 0) {
    showToast("Isi jumlah hasil OK, repair, atau NG sebelum menyimpan.");
    return;
  }
  if (op === "OP1" && qty > itemStock(itemId)) {
    showToast(`Jumlah OP1 melebihi stok tersedia (${number(itemStock(itemId))} pcs).`);
    return;
  }
  const item = itemById(itemId);
  if (op !== "OP1" && qty + already > Math.max(0, itemOpDone(itemId, item.ops[item.ops.indexOf(op) - 1]))) {
    showToast("Hasil proses melebihi hasil OK dari tahap sebelumnya.");
    return;
  }
  rows.forEach((row) => {
    const read = (key) => Number(row.querySelector(`[name="${key}"]`).value) || 0;
    store.production.push({
      id: makeId("PR"), date, time, shift: data.get("prodShift"), operator: reportedOperator,
      itemId, op, machine: row.querySelector('[name="machine"]').value,
      cycleMin: read("cycleMin"), loadMin: read("loadMin"), unloadMin: read("unloadMin"),
      ok: read("ok"), repair: read("repair"), ng: read("ng"),
      verificationStatus: "pending", verifiedBy: "", verifiedAt: "", verificationNote: "",
    });
    if (reportedOperator && !operators.includes(reportedOperator)) {
      operators.push(reportedOperator);
      store.operators = operators;
    }
  });
  persist();
  showToast(`Laporan tersimpan untuk ${rows.length} mesin.`);
  render();
}

function handleToolSubmit(form) {
  if (!["admin", "operator"].includes(activeRole)) {
    showToast("Peran ini tidak diizinkan mencatat tools.");
    return;
  }
  if (activeRole === "operator" && !currentAttendance(activeOperator)) {
    showToast("Absen masuk terlebih dahulu sebelum mengambil tools.");
    return;
  }
  const data = new FormData(form);
  const name = data.get("name").trim();
  const qty = Number(data.get("qty"));
  const inventory = store.toolsInventory.find((item) => item.name.toLowerCase() === name.toLowerCase());
  const stockType = data.get("stockType");
  const stockKey = stockType === "bekas" ? "usedQty" : "newQty";
  if (!inventory) {
    showToast("Tools belum terdaftar di inventori. Minta Admin menambahkannya.");
    return;
  }
  if (!Number.isInteger(qty) || qty < 1 || qty > inventory[stockKey]) {
    showToast(`Stok ${stockType} ${name} tidak cukup. Tersedia ${number(inventory[stockKey])}.`);
    return;
  }
  inventory[stockKey] -= qty;
  const consumable = data.has("consumable") || consumables.some((item) => item.toLowerCase() === name.toLowerCase());
  const operator = activeRole === "operator" ? activeOperator : data.get("operator");
  const pickedAt = new Date(data.get("date"));
  const machine = data.get("machine");
  const code = nextToolCode(name, operator, pickedAt, machine);
  store.tools.push({
    id: makeId("TL"), code, operator, name, qty, condition: data.get("condition"), shift: data.get("shift"),
    machine, stockType: stockType === "bekas" ? "Bekas" : "Baru",
    date: new Date(data.get("date")).toISOString(), consumable,
    broken: Number(data.get("broken")) || 0, blunt: Number(data.get("blunt")) || 0, damaged: Number(data.get("damaged")) || 0, returned: 0, returnEvents: [],
  });
  persist();
  showToast(consumable ? "Pemakaian habis pakai dicatat." : `Pengambilan dicatat · kode ${code}`);
  recentToolCode = code;
  activeToolTab = "issue";
  render();
}

function handleReturn(code) {
  if (!["admin", "operator"].includes(activeRole)) {
    showToast("Peran ini tidak diizinkan mencatat retur.");
    return;
  }
  const tool = store.tools.find((entry) => entry.code === code);
  if (!tool || tool.consumable) return;
  const inputCode = window.prompt(`Masukkan kode unik saat pengambilan untuk retur: ${code}`);
  if (inputCode === null) return;
  if (inputCode.trim().toUpperCase() !== code.toUpperCase()) {
    showToast("Kode tidak cocok. Tools belum dicatat kembali.");
    return;
  }
  const rawOperator = activeRole === "operator" ? activeOperator : window.prompt(`Nama operator yang mengembalikan (${operators.join(", ")}):`, tool.operator);
  if (!rawOperator || !operators.includes(rawOperator)) {
    showToast("Nama operator pengembali tidak valid.");
    return;
  }
  const remaining = toolHeldByOperator(tool, rawOperator);
  if (!remaining) {
    showToast(`${rawOperator} tidak tercatat memegang tools dengan kode tersebut.`);
    return;
  }
  const rawQty = window.prompt(`Jumlah yang dikembalikan (maksimal ${remaining}):`, String(remaining));
  if (rawQty === null) return;
  const qty = Number(rawQty);
  if (!Number.isInteger(qty) || qty < 1 || qty > remaining) {
    showToast(`Jumlah retur harus antara 1 dan ${remaining}.`);
    return;
  }
  const condition = window.prompt("Kondisi retur: Baik, Tumpul, Patah, atau Rusak", "Baik");
  if (!["Baik", "Tumpul", "Patah", "Rusak"].includes(condition)) {
    showToast("Pilih kondisi retur yang valid.");
    return;
  }
  const reason = condition === "Baik" ? "" : window.prompt(`Alasan kondisi ${condition}:`, "")?.trim() ?? "";
  if (condition !== "Baik" && !reason) {
    showToast("Alasan tools tumpul/patah/rusak wajib diisi.");
    return;
  }
  tool.returned += qty;
  tool.returnEvents ??= [];
  tool.returnEvents.push({
    operator: rawOperator, qty, date: stamp(), condition, reason,
    category: condition === "Patah" || condition === "Rusak" ? "scrap" : "used",
    codeVerified: true, status: "pending",
  });
  tool.returnedAt = stamp();
  persist();
  showToast(`Kode cocok. Retur ${number(qty)} tools tercatat dan menunggu verifikasi Admin.`);
  render();
}

function handleToolReturnVerification(toolId, returnIndex, verdict) {
  if (activeRole !== "admin") {
    showToast("Hanya Admin yang dapat memverifikasi retur tools.");
    return;
  }
  const tool = store.tools.find((entry) => entry.id === toolId);
  const returned = tool?.returnEvents?.[Number(returnIndex)];
  if (!tool || !returned || returned.status !== "pending" || !returned.codeVerified) {
    showToast("Retur tidak ditemukan atau sudah diproses.");
    return;
  }
  if (verdict === "verified") {
    const inventory = store.toolsInventory.find((item) => item.name.toLowerCase() === tool.name.toLowerCase());
    if (!inventory) {
      showToast("Item tools tidak ditemukan pada inventori. Tambahkan item sebelum verifikasi retur.");
      return;
    }
    inventory[returned.category === "scrap" ? "scrapQty" : "usedQty"] += returned.qty;
    returned.status = "verified";
  } else {
    const note = window.prompt("Alasan penolakan retur:", "")?.trim() ?? "";
    if (!note) {
      showToast("Alasan penolakan wajib diisi.");
      return;
    }
    tool.returned = Math.max(0, tool.returned - returned.qty);
    returned.status = "rejected";
    returned.verificationNote = note;
  }
  returned.verifiedBy = "Administrator";
  returned.verifiedAt = stamp();
  persist();
  showToast(verdict === "verified" ? "Retur diverifikasi dan stok inventori diperbarui." : "Retur ditolak; jumlah kembali dikembalikan ke status dipegang.");
  render();
}

function handleHandoverSubmit(form) {
  if (!["admin", "operator"].includes(activeRole)) {
    showToast("Peran ini tidak diizinkan mencatat serah terima.");
    return;
  }
  const data = new FormData(form);
  const tool = store.tools.find((entry) => entry.code === data.get("toolCode"));
  const qty = Number(data.get("qty"));
  if (!tool || qty < 1 || qty > toolHeldByOperator(tool, data.get("fromOperator"))) {
    showToast("Jumlah serah terima melebihi jumlah tools yang dipegang.");
    return;
  }
  if (activeRole === "operator" && data.get("fromOperator") !== activeOperator && data.get("toOperator") !== activeOperator) {
    showToast("Operator hanya dapat mencatat serah terima yang melibatkan dirinya.");
    return;
  }
  if (data.get("fromOperator") === data.get("toOperator")) {
    showToast("Pilih operator penerima yang berbeda.");
    return;
  }
  store.handovers.push({
    id: makeId("HO"), date: new Date(data.get("date")).toISOString(),
    fromOperator: data.get("fromOperator"), toOperator: data.get("toOperator"),
    fromShift: data.get("fromShift"), toShift: data.get("toShift"),
    toolCode: data.get("toolCode"), qty, evidence: data.get("evidence").trim(),
  });
  persist();
  showToast("Bukti serah terima tersimpan.");
  render();
}

function handleReceiptSubmit(form) {
  if (activeRole !== "admin") {
    showToast("Hanya Admin yang dapat mencatat barang masuk.");
    return;
  }
  const data = new FormData(form);
  const sourceQty = Number(data.get("sourceQty"));
  const unit = data.get("unit");
  const pcsPerBar = unit === "batang" ? Number(data.get("pcsPerBar")) : 1;
  if (unit === "batang" && (!Number.isInteger(pcsPerBar) || pcsPerBar < 1)) {
    showToast("EQ harus berupa jumlah PCS per batang yang valid.");
    return;
  }
  store.receipts.push({
    id: makeId("RC"), date: data.get("date"), itemId: data.get("itemId"),
    suratJalan: data.get("suratJalan").trim(), customer: data.get("customer").trim(),
    sourceQty, unit, pcsPerBar, qty: sourceQty * pcsPerBar,
  });
  persist();
  showToast(`Barang masuk tercatat: ${number(sourceQty * pcsPerBar)} pcs.`);
  render();
}

function handleShipmentSubmit(form) {
  if (activeRole !== "admin") {
    showToast("Hanya Admin yang dapat mencatat pengiriman.");
    return;
  }
  const data = new FormData(form);
  const item = itemById(data.get("itemId"));
  const qty = Number(data.get("qty"));
  if (qty > itemGoodAvailable(item)) {
    showToast(`Pengiriman melebihi hasil OK yang tersedia (${number(itemGoodAvailable(item))} pcs).`);
    return;
  }
  store.shipments.push({
    id: makeId("SH"), date: data.get("date"), time: new Date().toTimeString().slice(0, 5),
    itemId: item.id, customer: data.get("customer").trim(), suratJalan: data.get("suratJalan").trim(), qty,
  });
  persist();
  showToast("Pengiriman OK aktual berhasil dicatat.");
  render();
}

function handleItemSubmit(form) {
  if (activeRole !== "admin") {
    showToast("Hanya Admin yang dapat mengelola item dan PO.");
    return;
  }
  const data = new FormData(form);
  const customer = data.get("customer").trim();
  if (!customer) {
    showToast("Isi nama customer manual.");
    return;
  }
  const ops = [...new Set(data.get("ops").split(",").map((op) => op.trim()).filter(Boolean))];
  if (!ops.length || ops.some((op) => op.length > 20)) {
    showToast("Isi minimal satu nama OP yang valid.");
    return;
  }
  const opTargets = Object.fromEntries(ops.map((op, index) => {
    const targetValue = Number(data.get(`targetOP${index + 1}`)) || Number(data.get("target"));
    return [op, targetValue];
  }));
  if (Object.values(opTargets).some((value) => !Number.isInteger(value) || value < 1)) {
    showToast("Target setiap OP harus berupa bilangan bulat lebih dari nol.");
    return;
  }
  store.items.push({
    id: makeId("ITM"), name: data.get("name").trim(), po: data.get("po").trim(), customer,
    materialSpec: data.get("materialSpec").trim(), target: Number(data.get("target")), opTargets, cycleMin: Number(data.get("cycleMin")),
    loadMin: Number(data.get("loadMin")), unloadMin: Number(data.get("unloadMin")),
    ops,
  });
  if (!store.customers.includes(customer)) store.customers.push(customer);
  persist();
  showToast("Item dan PO berhasil ditambahkan.");
  render();
}

function handleCustomerSubmit(form) {
  if (activeRole !== "admin") {
    showToast("Hanya Admin yang dapat mengelola master customer.");
    return;
  }
  const name = new FormData(form).get("name").trim();
  if (!name || name.toLowerCase() === "lainnya") {
    showToast("Masukkan nama customer yang valid.");
    return;
  }
  if (store.customers.some((customer) => customer.toLowerCase() === name.toLowerCase())) {
    showToast("Customer sudah terdaftar.");
    return;
  }
  store.customers.push(name);
  persist();
  showToast("Customer ditambahkan ke master data.");
  render();
}

function handleEditCustomer(previousName) {
  if (activeRole !== "admin") return;
  const nextName = window.prompt("Ubah nama customer:", previousName)?.trim();
  if (!nextName || nextName === previousName) return;
  if (store.customers.some((customer) => customer.toLowerCase() === nextName.toLowerCase() && customer !== previousName)) {
    showToast("Nama customer sudah digunakan.");
    return;
  }
  store.customers = store.customers.map((customer) => customer === previousName ? nextName : customer);
  store.items.forEach((item) => { if (item.customer === previousName) item.customer = nextName; });
  store.receipts.forEach((row) => { if (row.customer === previousName) row.customer = nextName; });
  store.shipments.forEach((row) => { if (row.customer === previousName) row.customer = nextName; });
  persist();
  showToast("Master customer diperbarui.");
  render();
}

function handleEditItem(itemId) {
  if (activeRole !== "admin") return;
  const item = itemById(itemId);
  if (!item) return;
  const name = window.prompt("Nama item:", item.name);
  if (name === null) return;
  const po = window.prompt("Nomor PO (boleh dikosongkan):", item.po ?? "");
  if (po === null) return;
  const customer = window.prompt("Nama customer:", item.customer);
  if (customer === null || !name.trim() || !customer.trim()) {
    showToast("Nama item dan customer wajib diisi.");
    return;
  }
  const materialSpec = window.prompt("Spesifikasi material / ukuran:", item.materialSpec ?? "");
  if (materialSpec === null) return;
  const opsText = window.prompt("Daftar OP, pisahkan dengan koma:", item.ops.join(", "));
  if (opsText === null) return;
  const ops = [...new Set(opsText.split(",").map((op) => op.trim()).filter(Boolean))];
  if (!ops.length || ops.some((op) => op.length > 20)) {
    showToast("Isi minimal satu nama OP yang valid.");
    return;
  }
  const opTargets = {};
  for (let index = 0; index < ops.length; index += 1) {
    const currentTarget = item.opTargets?.[ops[index]] ?? item.target;
    const targetText = window.prompt(`Target ${ops[index]} (pcs):`, String(currentTarget));
    if (targetText === null) return;
    const target = Number(targetText);
    if (!Number.isInteger(target) || target < 1) {
      showToast(`Target ${ops[index]} harus berupa bilangan bulat lebih dari nol.`);
      return;
    }
    opTargets[ops[index]] = target;
  }
  const target = opTargets[ops.at(-1)];
  const cycleText = window.prompt("Cycle time standar (menit):", String(item.cycleMin));
  if (cycleText === null) return;
  const cycleMin = Number(cycleText);
  if (!Number.isFinite(cycleMin) || cycleMin < 0) {
    showToast("Cycle time harus nol atau lebih.");
    return;
  }
  const loadText = window.prompt("Loading standar (menit):", String(item.loadMin));
  if (loadText === null) return;
  const unloadText = window.prompt("Unloading standar (menit):", String(item.unloadMin));
  if (unloadText === null) return;
  const loadMin = Number(loadText);
  const unloadMin = Number(unloadText);
  if (!Number.isFinite(loadMin) || loadMin < 0 || !Number.isFinite(unloadMin) || unloadMin < 0) {
    showToast("Loading dan unloading harus nol atau lebih.");
    return;
  }
  item.name = name.trim();
  item.po = po.trim();
  item.customer = customer.trim();
  item.materialSpec = materialSpec.trim();
  item.ops = ops;
  item.opTargets = opTargets;
  item.target = target;
  item.cycleMin = cycleMin;
  item.loadMin = loadMin;
  item.unloadMin = unloadMin;
  if (!store.customers.includes(item.customer)) store.customers.push(item.customer);
  store.receipts.filter((row) => row.itemId === item.id).forEach((row) => { row.customer = item.customer; });
  store.shipments.filter((row) => row.itemId === item.id).forEach((row) => { row.customer = item.customer; });
  persist();
  showToast("Master item dan target PO diperbarui.");
  render();
}

function handleToolInventorySubmit(form) {
  if (activeRole !== "admin") {
    showToast("Hanya Admin yang dapat mengubah inventori tools.");
    return;
  }
  const data = new FormData(form);
  const name = data.get("name").trim();
  if (store.toolsInventory.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
    showToast("Nama tools sudah ada di inventori.");
    return;
  }
  const quantities = ["newQty", "usedQty", "scrapQty", "minQty"].map((key) => Number(data.get(key)));
  if (!name || quantities.some((value) => !Number.isInteger(value) || value < 0)) {
    showToast("Nama tools dan semua jumlah harus valid.");
    return;
  }
  store.toolsInventory.push({
    id: makeId("TI"), name, newQty: quantities[0], usedQty: quantities[1],
    scrapQty: quantities[2], minQty: quantities[3],
  });
  persist();
  showToast("Inventori tools ditambahkan.");
  render();
}

function handleProgressAdjustmentSubmit(form) {
  if (activeRole !== "admin") {
    showToast("Hanya Admin yang dapat menyesuaikan progres manual.");
    return;
  }
  const data = new FormData(form);
  const [itemId, op] = data.get("op").split("|");
  const qty = Number(data.get("qty"));
  if (itemId !== data.get("itemId") || !itemById(itemId) || !itemById(itemId).ops.includes(op) || !Number.isInteger(qty) || qty < 1) {
    showToast("Pilih item/OP yang valid dan isi qty progres bilangan bulat.");
    return;
  }
  store.progressAdjustments.push({ id: makeId("PA"), itemId, op, qty, note: data.get("note").trim(), createdAt: stamp() });
  persist();
  showToast("Progres tersimpan terpisah dari laporan operator.");
  render();
}

function handleEditProgress(id) {
  if (activeRole !== "admin") return;
  const row = store.progressAdjustments.find((entry) => entry.id === id);
  if (!row) return;
  const value = window.prompt("Qty progres manual:", String(row.qty));
  if (value === null) return;
  const qty = Number(value);
  if (!Number.isInteger(qty) || qty < 1) {
    showToast("Qty harus berupa bilangan bulat lebih dari nol.");
    return;
  }
  const note = window.prompt("Catatan / referensi progres:", row.note);
  if (note === null || !note.trim()) {
    showToast("Catatan progres wajib diisi.");
    return;
  }
  row.qty = qty;
  row.note = note.trim();
  persist();
  showToast("Progres manual diperbarui. Laporan operator tetap utuh.");
  render();
}

function handleMasterNameSubmit(form, kind) {
  if (activeRole !== "admin") {
    showToast("Hanya Admin yang dapat mengubah data master.");
    return;
  }
  const name = new FormData(form).get("name").trim();
  const list = kind === "operator" ? operators : machines;
  if (!name || list.some((entry) => entry.toLowerCase() === name.toLowerCase())) {
    showToast(name ? "Nama sudah terdaftar." : "Nama wajib diisi.");
    return;
  }
  list.push(name);
  if (kind === "operator") store.operators = operators;
  else store.machines = machines;
  persist();
  showToast(`${kind === "operator" ? "Operator" : "Mesin"} ditambahkan ke master.`);
  render();
}

function handleEditMasterName(kind, previousName) {
  if (activeRole !== "admin") return;
  const nextName = window.prompt(`Ubah ${kind === "operator" ? "nama operator" : "nama mesin"}:`, previousName)?.trim();
  if (!nextName || nextName === previousName) return;
  const list = kind === "operator" ? operators : machines;
  if (list.some((entry) => entry.toLowerCase() === nextName.toLowerCase() && entry !== previousName)) {
    showToast("Nama tersebut sudah terdaftar.");
    return;
  }
  if (kind === "operator") {
    operators = operators.map((entry) => entry === previousName ? nextName : entry);
    for (const collection of [store.production, store.tools, store.jobs, store.attendanceLogs, store.leaveRequests]) {
      collection.forEach((row) => { if (row.operator === previousName) row.operator = nextName; });
    }
    store.handovers.forEach((row) => {
      if (row.fromOperator === previousName) row.fromOperator = nextName;
      if (row.toOperator === previousName) row.toOperator = nextName;
    });
    store.operators = operators;
    if (activeOperator === previousName) {
      activeOperator = nextName;
      try { sessionStorage.setItem("produksi-operator", nextName); } catch (error) { console.warn("Nama operator sesi tidak dapat diperbarui:", error); }
    }
  } else {
    machines = machines.map((entry) => entry === previousName ? nextName : entry);
    for (const collection of [store.production, store.tools, store.jobs]) {
      collection.forEach((row) => { if (row.machine === previousName) row.machine = nextName; });
    }
    store.machines = machines;
  }
  persist();
  showToast(`${kind === "operator" ? "Operator" : "Mesin"} diperbarui pada master dan riwayat terkait.`);
  render();
}

async function handlePasswordChange(form) {
  if (!["admin", "boss"].includes(activeRole)) {
    showToast("Pengaturan sandi hanya tersedia untuk Admin dan Boss.");
    return;
  }
  const data = new FormData(form);
  const passwordKey = `${activeRole}PasswordHash`;
  try {
    if (await passwordDigest(data.get("currentPassword")) !== store[passwordKey]) {
      showToast("Kata sandi saat ini tidak sesuai.");
      return;
    }
    if (data.get("newPassword").length < 8 || data.get("newPassword") !== data.get("confirmPassword")) {
      showToast("Kata sandi baru minimal 8 karakter dan harus sama dengan konfirmasi.");
      return;
    }
    const previousHash = store[passwordKey];
    store[passwordKey] = await passwordDigest(data.get("newPassword"));
    if (!persist()) {
      store[passwordKey] = previousHash;
      return;
    }
    showToast("Kata sandi berhasil diubah.");
    form.reset();
  } catch (error) {
    console.error("Perubahan kata sandi gagal:", error);
    showToast(error.message || "Tidak dapat mengubah kata sandi.");
  }
}

function handleJobSubmit(form) {
  if (!["admin", "operator"].includes(activeRole)) {
    showToast("Peran ini tidak diizinkan mencatat setting mesin.");
    return;
  }
  if (activeRole === "operator" && !currentAttendance(activeOperator)) {
    showToast("Absen masuk terlebih dahulu sebelum mencatat setting mesin.");
    return;
  }
  const data = new FormData(form);
  const start = data.get("start"), end = data.get("end");
  if (end && new Date(end) < new Date(start)) {
    showToast("Waktu selesai setting tidak boleh lebih awal dari waktu mulai.");
    return;
  }
  store.jobs.push({
    id: makeId("JB"), date: today(), operator: data.get("operator"), machine: data.get("machine"),
    fromItem: data.get("fromItem"), toItem: data.get("toItem"), start, end,
    reason: data.get("reason").trim(),
  });
  persist();
  showToast("Perubahan pekerjaan mesin tersimpan.");
  render();
}

function handleAttendanceAction(action) {
  if (activeRole !== "operator" || !activeOperator) {
    showToast("Absen hanya tersedia untuk akun operator.");
    return;
  }
  if (action === "checkin") {
    if (currentAttendance(activeOperator)) {
      showToast("Anda masih tercatat bekerja. Absen pulang terlebih dahulu.");
      return;
    }
    const shift = document.querySelector("#attendanceShift")?.value ?? "Shift 1";
    store.attendanceLogs.push({
      id: makeId("AT"), operator: activeOperator, date: today(), shift,
      checkInAt: stamp(), checkInVerification: "pending", checkOutAt: "", checkOutVerification: "pending",
    });
    persist();
    showToast("Absen masuk berhasil dicatat. Status menunggu verifikasi Admin.");
  } else if (action === "checkout") {
    const row = currentAttendance(activeOperator);
    if (!row) {
      showToast("Belum ada absensi masuk yang aktif.");
      return;
    }
    row.checkOutAt = stamp();
    row.checkOutVerification = "pending";
    persist();
    showToast("Absen pulang berhasil dicatat. Status menunggu verifikasi Admin.");
  }
  render();
}

function handleLeaveSubmit(form) {
  if (activeRole !== "operator" || !activeOperator) {
    showToast("Pengajuan izin/cuti hanya tersedia untuk operator.");
    return;
  }
  const data = new FormData(form);
  const startAt = new Date(data.get("startAt"));
  const endAt = new Date(data.get("endAt"));
  if (Number.isNaN(startAt.valueOf()) || Number.isNaN(endAt.valueOf()) || endAt <= startAt) {
    showToast("Periksa kembali waktu mulai dan selesai pengajuan.");
    return;
  }
  const type = data.get("type");
  const leadTime = startAt.valueOf() - Date.now();
  const requiredNotice = type === "Sakit" ? 10 * 60 * 60 * 1000 : type === "Cuti" ? 7 * 24 * 60 * 60 * 1000 : 0;
  if (requiredNotice && leadTime < requiredNotice && !window.confirm(type === "Sakit" ? "Pengajuan sakit kurang dari 10 jam sebelum mulai. Tetap kirim?" : "Pengajuan cuti kurang dari 1 minggu sebelum mulai. Tetap kirim?")) return;
  store.leaveRequests.push({
    id: makeId("LV"), operator: activeOperator, type, startAt: startAt.toISOString(), endAt: endAt.toISOString(),
    reason: data.get("reason").trim(), submittedAt: stamp(), status: "pending", verifiedBy: "", verifiedAt: "", verificationNote: "",
  });
  persist();
  showToast("Pengajuan izin/cuti dikirim dan menunggu verifikasi Admin.");
  render();
}

function handleAttendanceVerification(id, kind) {
  if (activeRole !== "admin") {
    showToast("Hanya Admin yang dapat memverifikasi absensi.");
    return;
  }
  const row = store.attendanceLogs.find((entry) => entry.id === id);
  const timestampKey = kind === "checkIn" ? "checkInAt" : "checkOutAt";
  const statusKey = kind === "checkIn" ? "checkInVerification" : "checkOutVerification";
  if (!row || !row[timestampKey] || (row[statusKey] ?? "pending") !== "pending") {
    showToast("Absensi tidak ditemukan atau sudah diverifikasi.");
    return;
  }
  row[statusKey] = "verified";
  row[`${kind}VerifiedBy`] = "Administrator";
  row[`${kind}VerifiedAt`] = stamp();
  persist();
  showToast("Absensi berhasil diverifikasi.");
  render();
}

function handleLeaveVerification(id, verdict) {
  if (activeRole !== "admin") {
    showToast("Hanya Admin yang dapat memverifikasi izin/cuti.");
    return;
  }
  const row = store.leaveRequests.find((entry) => entry.id === id);
  if (!row || row.status !== "pending") {
    showToast("Pengajuan tidak ditemukan atau sudah diproses.");
    return;
  }
  let note = "";
  if (verdict === "rejected") {
    note = window.prompt("Alasan penolakan:", "")?.trim() ?? "";
    if (!note) {
      showToast("Alasan penolakan wajib diisi.");
      return;
    }
  }
  row.status = verdict;
  row.verifiedBy = "Administrator";
  row.verifiedAt = stamp();
  row.verificationNote = note;
  persist();
  showToast(verdict === "verified" ? "Izin/cuti disetujui." : "Izin/cuti ditolak.");
  render();
}

async function passwordDigest(password) {
  if (!globalThis.crypto?.subtle) throw new Error("Web Crypto tidak tersedia. Buka aplikasi melalui localhost atau HTTPS.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function handleLogin(form) {
  const data = new FormData(form);
  const role = data.get("role");
  if (!Object.hasOwn(roleViews, role)) {
    showToast("Pilih peran yang valid.");
    return;
  }
  try {
    if (["admin", "boss"].includes(role)) {
      const passwordKey = `${role}PasswordHash`;
      const password = data.get("password");
      if (store[passwordKey]) {
        if (await passwordDigest(password) !== store[passwordKey]) {
          showToast(`Kata sandi ${role === "admin" ? "Admin" : "Boss"} salah.`);
          return;
        }
      } else {
        if (typeof password !== "string" || password.length < 8 || password !== data.get("passwordConfirm")) {
          showToast("Kata sandi minimal 8 karakter dan harus sama dengan konfirmasi.");
          return;
        }
        store[passwordKey] = await passwordDigest(password);
        if (!persist()) return;
      }
    }
    if (role === "operator") {
      const operatorName = data.get("operator").trim().replace(/\s+/g, " ");
      if (!operatorName) {
        showToast("Isi nama operator.");
        return;
      }
      if (!operators.includes(operatorName)) {
        operators.push(operatorName);
        store.operators = operators;
        if (!persist()) return;
        showToast("Nama operator baru ditambahkan dan dapat dikelola Admin di Data Master.");
      }
      data.set("operator", operatorName);
    }
    activeRole = role;
    activeOperator = role === "operator" ? data.get("operator") : null;
    activeView = role === "operator" ? "operator" : "dashboard";
    activeToolTab = "log";
    try {
      sessionStorage.setItem("produksi-role", activeRole);
      if (activeOperator) sessionStorage.setItem("produksi-operator", activeOperator);
      else sessionStorage.removeItem("produksi-operator");
    } catch (error) {
      console.warn("Sesi role tidak dapat disimpan:", error);
    }
    render();
  } catch (error) {
    console.error("Login gagal:", error);
    showToast(error.message || "Tidak dapat memproses login.");
  }
}

function handleVerification(id, verdict) {
  if (activeRole !== "admin") {
    showToast("Hanya Admin yang dapat memverifikasi hasil.");
    return;
  }
  const row = store.production.find((entry) => entry.id === id);
  if (!row || (row.verificationStatus ?? "pending") !== "pending") {
    showToast("Laporan tidak ditemukan atau sudah diverifikasi.");
    return;
  }
  let note = "";
  if (verdict === "rejected") {
    note = window.prompt("Tuliskan alasan koreksi agar operator dapat menindaklanjuti:", "")?.trim() ?? "";
    if (!note) {
      showToast("Alasan koreksi wajib diisi.");
      return;
    }
  }
  row.verificationStatus = verdict;
  row.verifiedBy = "Administrator";
  row.verifiedAt = stamp();
  row.verificationNote = note;
  persist();
  showToast(verdict === "verified" ? "Hasil pekerjaan disetujui." : "Hasil dikembalikan untuk koreksi.");
  render();
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename, headers, rows) {
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  showToast(`File ${filename} berhasil diekspor.`);
}

function exportData(kind) {
  if (!["admin", "boss"].includes(activeRole)) {
    showToast("Ekspor data hanya tersedia untuk Admin dan Boss.");
    return;
  }
  const date = today();
  if (kind === "production") return downloadCsv(`produksi-operator-${date}.csv`,
    ["ID laporan", "Tanggal", "Jam", "Shift", "Operator", "Mesin", "Nama item", "PO", "Customer", "Tahap OP", "Cycle time (menit)", "Loading (menit)", "Unloading (menit)", "OK (pcs)", "Repair (pcs)", "NG (pcs)", "Status verifikasi", "Diverifikasi oleh", "Waktu verifikasi", "Catatan verifikasi"],
    store.production.map((row) => [row.id, row.date, row.time, row.shift, row.operator, row.machine, itemName(row.itemId), itemById(row.itemId)?.po, itemById(row.itemId)?.customer, row.op, row.cycleMin, row.loadMin, row.unloadMin, row.ok, row.repair, row.ng, row.verificationStatus ?? "pending", row.verifiedBy, row.verifiedAt, row.verificationNote]));
  if (kind === "tools") return downloadCsv(`pemakaian-tools-${date}.csv`,
    ["Kode unik", "Tanggal ambil", "Operator", "Shift", "Nama tools", "Jumlah ambil", "Habis pakai", "Kondisi", "Patah", "Tumpul", "Rusak", "Jumlah kembali", "Masih dipegang"],
    store.tools.map((tool) => [tool.code, tool.date, tool.operator, tool.shift, tool.name, tool.qty, tool.consumable ? "Ya" : "Tidak", tool.condition, tool.broken, tool.blunt, tool.damaged, tool.returned, tool.consumable ? 0 : tool.qty - tool.returned]));
  if (kind === "inventory") return downloadCsv(`stok-progres-po-${date}.csv`,
    ["Nama item", "PO", "Customer", "Spesifikasi material", "Material masuk PCS", "Bahan belum proses PCS", "WIP per operasi", "Selesai OK PCS", "Terkirim PCS", "Target per OP", "Cycle (menit)", "Loading (menit)", "Unloading (menit)"],
    store.items.map((item) => [item.name, item.po, item.customer, item.materialSpec, itemReceipts(item.id), itemStock(item.id), item.ops.slice(0, -1).map((op, index) => `${op}: ${Math.max(0, itemOpDone(item.id, op) - itemOpDone(item.id, item.ops[index + 1]))}`).join(" | "), itemFinished(item), itemShipped(item.id), item.ops.map((op) => `${op}: ${item.opTargets?.[op] ?? item.target}`).join(" | "), item.cycleMin, item.loadMin, item.unloadMin]));
  if (kind === "customer") return downloadCsv(`pengiriman-customer-${date}.csv`,
    ["Tanggal", "Surat jalan", "Nama item", "PO", "Customer", "Jumlah terkirim OK (pcs)"],
    store.shipments.map((row) => [row.date, row.suratJalan, itemName(row.itemId), itemById(row.itemId)?.po, row.customer, row.qty]));
  if (kind === "handovers") return downloadCsv(`serah-terima-tools-${date}.csv`,
    ["Waktu", "Dari operator", "Shift asal", "Ke operator", "Shift tujuan", "Kode tools", "Jumlah", "Bukti"],
    store.handovers.map((row) => [row.date, row.fromOperator, row.fromShift, row.toOperator, row.toShift, row.toolCode, row.qty, row.evidence]));
  if (kind === "jobs") return downloadCsv(`setting-mesin-${date}.csv`,
    ["Operator", "Mesin", "Dari item", "Ke item", "Mulai", "Selesai", "Durasi menit", "Catatan"],
    store.jobs.map((job) => [job.operator, job.machine, itemName(job.fromItem), itemName(job.toItem), job.start, job.end, job.end ? Math.round((new Date(job.end) - new Date(job.start)) / 60000) : "", job.reason]));
  if (kind === "attendance") return downloadCsv(`absensi-operator-${date}.csv`,
    ["Tanggal", "Operator", "Shift", "Waktu masuk", "Status masuk", "Diverifikasi masuk oleh", "Waktu verifikasi masuk", "Waktu pulang", "Status pulang", "Diverifikasi pulang oleh", "Waktu verifikasi pulang"],
    store.attendanceLogs.map((row) => [row.date, row.operator, row.shift, row.checkInAt, row.checkInVerification ?? "pending", row.checkInVerifiedBy, row.checkInVerifiedAt, row.checkOutAt, row.checkOutVerification ?? "pending", row.checkOutVerifiedBy, row.checkOutVerifiedAt]));
  if (kind === "leaves") return downloadCsv(`izin-cuti-${date}.csv`,
    ["Operator", "Jenis", "Mulai", "Selesai", "Alasan", "Diajukan", "Status", "Diverifikasi oleh", "Waktu verifikasi", "Catatan verifikasi"],
    store.leaveRequests.map((row) => [row.operator, row.type, row.startAt, row.endAt, row.reason, row.submittedAt, row.status, row.verifiedBy, row.verifiedAt, row.verificationNote]));
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.id === "logoutButton") {
    activeRole = null;
    activeOperator = null;
    loginRole = "admin";
    try {
      sessionStorage.removeItem("produksi-role");
      sessionStorage.removeItem("produksi-operator");
    } catch (error) {
      console.warn("Sesi role tidak dapat dihapus:", error);
    }
    render();
  } else if (target.dataset.verify) {
    handleVerification(target.dataset.verify, target.dataset.verdict);
  } else if (target.dataset.verifyAttendance) {
    handleAttendanceVerification(target.dataset.verifyAttendance, target.dataset.attendanceKind);
  } else if (target.dataset.verifyLeave) {
    handleLeaveVerification(target.dataset.verifyLeave, target.dataset.verdict);
  } else if (target.dataset.verifyToolReturn) {
    handleToolReturnVerification(target.dataset.verifyToolReturn, target.dataset.returnIndex, target.dataset.verdict);
  } else if (target.dataset.editCustomer) {
    handleEditCustomer(target.dataset.editCustomer);
  } else if (target.dataset.editItem) {
    handleEditItem(target.dataset.editItem);
  } else if (target.dataset.editProgress) {
    handleEditProgress(target.dataset.editProgress);
  } else if (target.dataset.editOperator) {
    handleEditMasterName("operator", target.dataset.editOperator);
  } else if (target.dataset.editMachine) {
    handleEditMasterName("machine", target.dataset.editMachine);
  } else if (target.dataset.attendanceAction) {
    handleAttendanceAction(target.dataset.attendanceAction);
  } else if (target.dataset.view) {
    activeView = target.dataset.view;
    render();
  } else if (target.dataset.toolTab) {
    activeToolTab = target.dataset.toolTab;
    render();
  } else if (target.id === "addMachine") {
    addProductionRows();
  } else if (target.classList.contains("remove-machine")) {
    target.closest(".machine-input-row").remove();
    updateProductionTotals();
  } else if (target.dataset.returnTool) {
    handleReturn(target.dataset.returnTool);
  } else if (target.dataset.export) {
    exportData(target.dataset.export);
  } else if (target.id === "resetDemo") {
    if (activeRole === "admin" && window.confirm("Pulihkan data demo? Data yang tersimpan di browser ini akan diganti.")) {
      const adminPasswordHash = store.adminPasswordHash;
      const bossPasswordHash = store.bossPasswordHash;
      operators = [...defaultOperators];
      machines = [...defaultMachines];
      store = demoStore();
      store.adminPasswordHash = adminPasswordHash;
      store.bossPasswordHash = bossPasswordHash;
      persist();
      activeView = "dashboard";
      render();
      showToast("Data demo dipulihkan.");
    }
  }
});

document.addEventListener("change", (event) => {
  if (event.target.id === "loginRole") {
    loginRole = event.target.value;
    render();
    return;
  }
  if (event.target.dataset.stockId) {
    const inventory = store.toolsInventory.find((item) => item.id === event.target.dataset.stockId);
    const value = Number(event.target.value);
    const stockFields = ["newQty", "usedQty", "scrapQty", "minQty"];
    if (activeRole !== "admin" || !inventory || !stockFields.includes(event.target.dataset.stockField) || !Number.isInteger(value) || value < 0) {
      showToast("Stok hanya dapat diperbarui Admin dengan jumlah nol atau lebih.");
      render();
      return;
    }
    inventory[event.target.dataset.stockField] = value;
    persist();
    showToast("Stok inventori tools diperbarui.");
    render();
    return;
  }
  if (event.target.id === "prodItem") updateOpOptions();
  if (event.target.id === "progressItem") {
    const opSelect = document.querySelector("#progressOp");
    if (opSelect) opSelect.innerHTML = progressOpOptions(event.target.value);
  }
  if (event.target.name === "unit") {
    const field = document.querySelector("#pcsPerBarField");
    if (field) field.classList.toggle("hidden", event.target.value !== "batang");
  }
});

document.addEventListener("input", (event) => {
  if (event.target.closest("#productionForm")) updateProductionTotals();
});

document.addEventListener("submit", (event) => {
  const form = event.target;
  event.preventDefault();
  if (form.id === "loginForm") handleLogin(form);
  else if (form.id === "leaveForm") handleLeaveSubmit(form);
  else if (form.id === "toolInventoryForm") handleToolInventorySubmit(form);
  else if (form.id === "customerForm") handleCustomerSubmit(form);
  else if (form.id === "productionForm") handleProductionSubmit(form);
  else if (form.id === "toolForm") handleToolSubmit(form);
  else if (form.id === "handoverForm") handleHandoverSubmit(form);
  else if (form.id === "receiptForm") handleReceiptSubmit(form);
  else if (form.id === "shipmentForm") handleShipmentSubmit(form);
  else if (form.id === "itemForm") handleItemSubmit(form);
  else if (form.id === "progressAdjustmentForm") handleProgressAdjustmentSubmit(form);
  else if (form.id === "operatorMasterForm") handleMasterNameSubmit(form, "operator");
  else if (form.id === "machineMasterForm") handleMasterNameSubmit(form, "machine");
  else if (form.id === "passwordChangeForm") handlePasswordChange(form);
  else if (form.id === "jobForm") handleJobSubmit(form);
});

document.querySelector("#currentDate").textContent = new Date().toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
render();
