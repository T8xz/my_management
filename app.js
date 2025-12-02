const STORAGE_KEY = "mm_transactions_v1";
const CATEGORY_KEY = "mm_categories_v1";

const defaultCategories = [
  "Makanan & Minuman",
  "Belanja Barang",
  "Rokok",
  "Kebutuhan Rumah",
  "Hobi & Gear",
  "Nongki / Cafe",
  "Tarik Tunai",
  "Hiburan & Jalan-Jalan",
];

let transactions = [];
let categories = [...defaultCategories];

let summaryChart = null; // chart instance untuk tab Ringkasan
let currentSummaryMode = "daily";

document.addEventListener("DOMContentLoaded", () => {
  initDate();
  loadData();
  loadCategoryData();
  initNav();
  initButtons();
  renderAll();
  renderCategories();
  renderSummary();
});

function initDate() {
  const el = document.getElementById("current-date");
  el.textContent = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
function handleResetData() {
  const ok = confirm(
    "Yakin mau reset SEMUA data? (Transaksi + kategori akan dihapus)"
  );
  if (!ok) return;

  // kosongin data di memori
  transactions = [];
  categories = [...defaultCategories];

  // hapus di localStorage
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(CATEGORY_KEY);

  // atau kalau emang web ini cuma buat app ini doang, boleh:
  // localStorage.clear();

  // simpan ulang kategori default
  saveCategoryData();

  // rerender UI
  renderAll();
  renderCategories();

  alert("Semua data berhasil direset.");
}

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      transactions = JSON.parse(raw);
    } catch (e) {
      transactions = [];
    }
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

// NAVIGATION
function initNav() {
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.target;
      // toggle active nav
      navItems.forEach((b) => b.classList.remove("nav-item-active"));
      btn.classList.add("nav-item-active");
      // toggle pages
      switchPage(target);
    });
  });
}

function switchPage(target) {
  const pages = document.querySelectorAll(".page");
  pages.forEach((p) => p.classList.remove("page-active"));

  const id = `page-${target}`;
  const page = document.getElementById(id);
  if (page) page.classList.add("page-active");
}

// BUTTONS (modal + others)
function initButtons() {
  const incomeBtn = document.querySelector(".btn-income");
  const expenseBtn = document.querySelector(".btn-expense");

  incomeBtn.addEventListener("click", () => openTransactionModal("income"));
  expenseBtn.addEventListener("click", () => openTransactionModal("expense"));

  document
    .getElementById("btn-cancel")
    .addEventListener("click", closeTransactionModal);

  document
    .getElementById("transaction-form")
    .addEventListener("submit", handleTransactionSubmit);

  const resetBtn = document.getElementById("btn-reset");
  resetBtn.addEventListener("click", handleResetData);
  document.getElementById("btn-import-csv").addEventListener("click", () => {
    document.getElementById("csv-input").click();
  });
  document.getElementById("csv-input").addEventListener("change", handleCSV);
}

function handleCSV(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = function (event) {
    const text = event.target.result;
    processCSV(text);
  };

  reader.readAsText(file);
}

function parseBRINumber(str) {
  if (!str) return 0;
  // hapus tanda kutip & spasi
  str = str.replace(/"/g, "").trim();
  // parse sebagai float (contoh: 23500.00 → 23500)
  const num = parseFloat(str);
  return isNaN(num) ? 0 : Math.round(num);
}

function processCSV(text) {
  const lines = text.split(/\r?\n/);
  const newTransactions = [];

  // deteksi delimiter (comma atau semicolon)
  const delimiter = lines[0].includes(";") ? ";" : ",";

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].trim();
    if (!row) continue;

    const cols = row.split(delimiter);
    if (cols.length < 10) continue;

    // FIX TANGGAL CSV BRImo
    // TGL_TRAN ada di COL[2], bukan COL[3]
    const rawDate = cols[2].replace(/"/g, "").trim();
    const cleanDate = rawDate.slice(0, 10); // hasil: YYYY-MM-DD

    // deskripsi
    const desc = cols[6].replace(/"/g, "").trim();

    // FIX ANGKA BRI (format 23500.00)
    const debit = parseBRINumber(cols[8]);
    const credit = parseBRINumber(cols[9]);

    // tentukan tipe transaksi
    let type = "";
    let amount = 0;

    if (debit > 0) {
      type = "expense";
      amount = debit;
    } else if (credit > 0) {
      type = "income";
      amount = credit;
    } else {
      continue;
    }

    const category = detectCategory(desc);

    newTransactions.push({
      id: Date.now() + Math.random(),
      type,
      category,
      description: desc,
      amount,
      date: cleanDate,
    });
  }

  // simpan ke database localStorage
  transactions = transactions.concat(newTransactions);
  saveData();
  renderAll();

  alert("Import CSV selesai! Transaksi berhasil ditambahkan.");
}

function detectCategory(desc) {
  desc = desc.toLowerCase();

  if (desc.includes("shopee") || desc.includes("tokopedia"))
    return "Belanja Barang";

  if (desc.includes("kopi") || desc.includes("cafe") || desc.includes("janji"))
    return "Nongki / Cafe";

  if (
    desc.includes("kfc") ||
    desc.includes("mcd") ||
    desc.includes("ayam") ||
    desc.includes("nasi")
  )
    return "Makanan & Minuman";

  if (desc.includes("qris")) return "Makanan & Minuman";

  if (
    desc.includes("rokok") ||
    desc.includes("djarum") ||
    desc.includes("sampoerna")
  )
    return "Rokok";

  if (desc.includes("atm") || desc.includes("tarik tunai"))
    return "Tarik Tunai";

  if (desc.includes("mall") || desc.includes("cinema") || desc.includes("tix"))
    return "Hiburan & Jalan-Jalan";

  if (desc.includes("gaji") || desc.includes("salary")) return "Gaji";

  return "Lainnya";
}

// MODAL
function openTransactionModal(type, existing = null) {
  const backdrop = document.getElementById("modal-backdrop");
  backdrop.classList.add("modal-backdrop-active");

  document.getElementById("transaction-type").value = type;
  document.getElementById("transaction-id").value = existing ? existing.id : "";
  document.getElementById("modal-title").textContent = existing
    ? "Edit Transaksi"
    : type === "income"
    ? "Tambah Pemasukan"
    : "Tambah Pengeluaran";
  if (type === "income") {
    document.querySelector(
      "input[name='income-cat'][value='Gaji']"
    ).checked = true;
  }

  // isi kategori dropdown
  const catSelect = document.getElementById("transaction-category");
  catSelect.innerHTML = "";
  categories.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    catSelect.appendChild(opt);
  });
  // tampilkan kategori sesuai tipe
  const incomeCat = document.getElementById("income-category-container");
  const expenseCat = document.getElementById("expense-category-container");

  if (type === "income") {
    incomeCat.style.display = "block";
    expenseCat.style.display = "none";
  } else {
    incomeCat.style.display = "none";
    expenseCat.style.display = "block";
  }

  // isi field kalau edit
  if (existing) {
    document.getElementById("transaction-amount").value = existing.amount;
    document.getElementById("transaction-description").value =
      existing.description;
    catSelect.value = existing.category;
    document.getElementById("transaction-date").value = existing.date;
  } else {
    document.getElementById("transaction-amount").value = "";
    document.getElementById("transaction-description").value = "";
    catSelect.value = categories[0];
    document.getElementById("transaction-date").value = new Date()
      .toISOString()
      .slice(0, 10);
  }
}

function closeTransactionModal() {
  document
    .getElementById("modal-backdrop")
    .classList.remove("modal-backdrop-active");
}

// HANDLE SUBMIT
function handleTransactionSubmit(e) {
  e.preventDefault();
  const id = document.getElementById("transaction-id").value;
  const type = document.getElementById("transaction-type").value;
  const amount = Number(
    document.getElementById("transaction-amount").value || 0
  );
  const description = document
    .getElementById("transaction-description")
    .value.trim();
  let category;

  if (type === "income") {
    const selected = document.querySelector('input[name="income-cat"]:checked');
    category = selected ? selected.value : "Lainnya";
  } else {
    category = document.getElementById("transaction-category").value;
  }

  const date = document.getElementById("transaction-date").value;

  if (!amount || !description || !date) return;

  if (id) {
    // edit
    const idx = transactions.findIndex((t) => t.id === id);
    if (idx !== -1) {
      transactions[idx] = {
        ...transactions[idx],
        type,
        amount,
        description,
        category,
        date,
      };
    }
  } else {
    // new
    const newT = {
      id: "t_" + Date.now(),
      type,
      amount,
      description,
      category,
      date,
      createdAt: new Date().toISOString(),
    };
    transactions.unshift(newT);
  }

  saveData();
  renderAll();
  closeTransactionModal();
}

// RENDER SEMUA
function renderAll() {
  renderDashboard();
  renderHistory();
  renderSummary();
  // nanti: renderSummary() dll
}

function renderDashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  let totalIncome = 0;
  let totalExpense = 0;

  let todayIncome = 0;
  let todayExpense = 0;

  let weekIncome = 0;
  let weekExpense = 0;

  let monthIncome = 0;
  let monthExpense = 0;

  transactions.forEach((t) => {
    const amt = t.amount;
    const d = new Date(t.date);

    // total global
    if (t.type === "income") totalIncome += amt;
    else totalExpense += amt;

    // hari ini
    if (t.date === today) {
      if (t.type === "income") todayIncome += amt;
      else todayExpense += amt;
    }

    // minggu ini (7 hari ke belakang dari hari ini)
    const diffDays = (now - d) / (1000 * 60 * 60 * 24);
    if (diffDays >= 0 && diffDays <= 7) {
      if (t.type === "income") weekIncome += amt;
      else weekExpense += amt;
    }

    // bulan ini
    if (d.getMonth() === month && d.getFullYear() === year) {
      if (t.type === "income") monthIncome += amt;
      else monthExpense += amt;
    }
  });

  // saldo total
  document.getElementById("total-balance").textContent = formatRupiah(
    totalIncome - totalExpense
  );

  // hari ini
  document.getElementById("today-income").textContent =
    formatRupiah(todayIncome);
  document.getElementById("today-expense").textContent =
    formatRupiah(todayExpense);
  document.getElementById("today-balance").textContent = formatRupiah(
    todayIncome - todayExpense
  );

  // minggu ini
  document.getElementById("week-income").textContent = formatRupiah(weekIncome);
  document.getElementById("week-expense").textContent =
    formatRupiah(weekExpense);
  document.getElementById("week-balance").textContent = formatRupiah(
    weekIncome - weekExpense
  );

  // bulan ini
  document.getElementById("month-income").textContent =
    formatRupiah(monthIncome);
  document.getElementById("month-expense").textContent =
    formatRupiah(monthExpense);
  document.getElementById("month-balance").textContent = formatRupiah(
    monthIncome - monthExpense
  );
}

function renderHistory() {
  const container = document.getElementById("history-list");
  container.innerHTML = "";

  const range = document.getElementById("history-range").value;
  const categoryFilter = document.getElementById("history-category").value;

  const filtered = transactions.filter((t) => {
    if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
    if (!matchRange(t.date, range)) return false;
    return true;
  });

  filtered.forEach((t) => {
    const item = document.createElement("div");
    item.className = "list-item";

    const main = document.createElement("div");
    main.className = "list-item-main";

    const icon = document.createElement("div");
    icon.className =
      "list-icon " +
      (t.type === "income" ? "list-icon-income" : "list-icon-expense");
    icon.textContent = t.type === "income" ? "+" : "-";

    const texts = document.createElement("div");
    const title = document.createElement("div");
    title.className = "list-text-title";
    title.textContent = t.description;

    const meta = document.createElement("div");
    meta.className = "list-text-meta";
    meta.textContent = `${t.category} • ${t.date}`;

    texts.appendChild(title);
    texts.appendChild(meta);

    main.appendChild(icon);
    main.appendChild(texts);

    const right = document.createElement("div");
    right.className =
      "list-amount " +
      (t.type === "income" ? "list-amount-income" : "list-amount-expense");
    right.textContent =
      (t.type === "income" ? "+ " : "- ") + formatRupiah(t.amount);

    // klik kanan / tombol kecil utk edit/hapus bisa ditambah nanti

    item.appendChild(main);
    item.appendChild(right);

    container.appendChild(item);
  });
}

function renderCategoryChart() {
  const ctx = document.getElementById("category-chart");
  if (!ctx) return;

  const today = new Date();
  const mNow = today.getMonth();
  const yNow = today.getFullYear();

  // hitung pengeluaran per kategori bulan ini
  const map = {};
  transactions.forEach((t) => {
    if (t.type !== "expense") return;
    const d = new Date(t.date);
    if (d.getMonth() !== mNow || d.getFullYear() !== yNow) return;
    map[t.category] = (map[t.category] || 0) + t.amount;
  });

  const labels = Object.keys(map);
  const values = Object.values(map);

  if (categoryChart) {
    categoryChart.destroy();
  }

  if (labels.length === 0) {
    // kalau belum ada pengeluaran bulan ini, bikin chart kosong
    categoryChart = new Chart(ctx, {
      type: "pie",
      data: {
        labels: ["Belum ada data"],
        datasets: [
          {
            data: [1],
          },
        ],
      },
      options: {
        plugins: {
          legend: {
            display: false,
          },
        },
      },
    });
    return;
  }

  categoryChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels,
      datasets: [
        {
          data: values,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom",
        },
      },
    },
  });
}

function renderInsights() {
  const today = new Date();
  const mNow = today.getMonth();
  const yNow = today.getFullYear();

  let totalExpense = 0;

  const byCategory = {};
  const byDate = {};

  transactions.forEach((t) => {
    const d = new Date(t.date);
    if (d.getMonth() !== mNow || d.getFullYear() !== yNow) return;

    if (t.type === "expense") {
      totalExpense += t.amount;

      // kategori
      byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;

      // per tanggal
      const key = t.date; // 'YYYY-MM-DD'
      byDate[key] = (byDate[key] || 0) + t.amount;
    }
  });

  // total pengeluaran
  document.getElementById("insight-total-expense").textContent =
    formatRupiah(totalExpense);

  // kategori terbesar
  let topCatName = "-";
  let topCatValue = 0;
  Object.entries(byCategory).forEach(([cat, val]) => {
    if (val > topCatValue) {
      topCatValue = val;
      topCatName = `${cat} (${formatRupiah(val)})`;
    }
  });
  document.getElementById("insight-top-category").textContent = topCatName;

  // rata-rata per hari (pakai hari yang sudah lewat di bulan ini)
  const year = yNow;
  const month = mNow;
  const nowDate = today.getDate();

  const daysPassed = nowDate; // hari ke-berapa di bulan (1..31)
  const avgPerDay = daysPassed > 0 ? Math.round(totalExpense / daysPassed) : 0;

  document.getElementById("insight-avg-per-day").textContent =
    formatRupiah(avgPerDay);

  // hari paling boros
  let worstDay = "-";
  let worstVal = 0;
  Object.entries(byDate).forEach(([dateStr, val]) => {
    if (val > worstVal) {
      worstVal = val;
      worstDay = dateStr;
    }
  });

  if (worstDay !== "-") {
    const d = new Date(worstDay);
    const formatted = d.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "short",
    });
    document.getElementById(
      "insight-worst-day"
    ).textContent = `${formatted} (${formatRupiah(worstVal)})`;
  } else {
    document.getElementById("insight-worst-day").textContent = "-";
  }
}

function renderWeeklySummary() {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // Hitung 7 hari terakhir
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 6);

  let wIncome = 0;
  let wExpense = 0;

  const catMap = {}; // kategori terbesar minggu ini

  transactions.forEach((t) => {
    const d = new Date(t.date);

    if (d >= weekStart && d <= now) {
      if (t.type === "income") wIncome += t.amount;
      else {
        wExpense += t.amount;
        catMap[t.category] = (catMap[t.category] || 0) + t.amount;
      }
    }
  });

  // saldo minggu ini
  const wBalance = wIncome - wExpense;

  // kategori terbesar minggu ini
  let topCat = "-";
  let topVal = 0;
  Object.entries(catMap).forEach(([cat, val]) => {
    if (val > topVal) {
      topVal = val;
      topCat = `${cat} (${formatRupiah(val)})`;
    }
  });

  // inject ke UI
  document.getElementById("week-income-summary").textContent =
    formatRupiah(wIncome);
  document.getElementById("week-expense-summary").textContent =
    formatRupiah(wExpense);
  document.getElementById("week-balance-summary").textContent =
    formatRupiah(wBalance);
  document.getElementById("week-top-category").textContent = topCat;
}

function renderMonthlyChart() {
  const ctx = document.getElementById("monthly-chart");
  if (!ctx) return;

  const today = new Date();
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ];

  const labels = [];
  const incomes = [];
  const expenses = [];
  const balances = [];

  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // 6 bulan terakhir
  for (let i = 5; i >= 0; i--) {
    let m = currentMonth - i;
    let y = currentYear;
    if (m < 0) {
      m += 12;
      y -= 1;
    }

    labels.push(`${monthNames[m]} ${String(y).slice(-2)}`);

    let monthIncome = 0;
    let monthExpense = 0;

    transactions.forEach((t) => {
      const d = new Date(t.date);
      if (d.getMonth() === m && d.getFullYear() === y) {
        if (t.type === "income") monthIncome += t.amount;
        else monthExpense += t.amount;
      }
    });

    incomes.push(monthIncome);
    expenses.push(monthExpense);
    balances.push(monthIncome - monthExpense);
  }

  if (monthlyChart) {
    monthlyChart.destroy();
  }

  monthlyChart = new Chart(ctx, {
    data: {
      labels,
      datasets: [
        {
          type: "bar",
          label: "Pemasukan",
          data: incomes,
          borderWidth: 1,
        },
        {
          type: "bar",
          label: "Pengeluaran",
          data: expenses,
          borderWidth: 1,
        },
        {
          type: "line",
          label: "Saldo",
          data: balances,
          borderWidth: 2,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "top",
        },
      },
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  });
}

let monthlyChart = null;
let categoryChart = null;

function renderSummary() {
  renderMonthlyChart();
  renderCategoryChart();
  renderInsights();
  renderWeeklySummary();
}

function matchRange(dateStr, range) {
  if (range === "all") return true;
  const d = new Date(dateStr);
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  if (range === "today") {
    return dateStr === todayStr;
  }
  if (range === "week") {
    const diff = (now - d) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7;
  }
  if (range === "month") {
    return (
      d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    );
  }
  return true;
}

function renderCategories() {
  const list = document.getElementById("category-list");
  list.innerHTML = "";

  categories.forEach((cat) => {
    const li = document.createElement("li");
    li.textContent = cat;

    const delBtn = document.createElement("button");
    delBtn.className = "category-delete";
    delBtn.textContent = "Hapus";

    delBtn.addEventListener("click", () => {
      categories = categories.filter((c) => c !== cat);
      saveCategoryData();
      renderCategories();
    });

    li.appendChild(delBtn);
    list.appendChild(li);
  });

  // update dropdown tambah transaksi juga
  updateCategorySelect();
}

function saveCategoryData() {
  localStorage.setItem("mm_categories_v1", JSON.stringify(categories));
}

function loadCategoryData() {
  const raw = localStorage.getItem("mm_categories_v1");
  if (raw) categories = JSON.parse(raw);
}

function updateCategorySelect() {
  const select = document.getElementById("transaction-category");
  if (!select) return;

  select.innerHTML = "";

  categories.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });
}

document.getElementById("btn-add-category").addEventListener("click", () => {
  const input = document.getElementById("input-new-category");
  const value = input.value.trim();
  if (!value) return;

  if (!categories.includes(value)) {
    categories.push(value);
    saveCategoryData();
    renderCategories();
  }

  input.value = "";
});

function formatRupiah(num) {
  return "Rp " + Number(num || 0).toLocaleString("id-ID");
}
