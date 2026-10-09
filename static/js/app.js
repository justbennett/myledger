// static/js/app.js
// JavaScript code for hledger UI
/*****************Main Loading Functions************** */
let selectedJournals = ['main'];
let currentAccountFilter = null;
let currentJournalSearch = "";
let activeJournalEdit = null;
let journalEditorMode = "edit";
let currentJournalTransactions = [];
let activeJournalView = "journal";
let journalChart = null;

let debugMode = false; //set to true to enable debug logging


  // Toggle visibility
  const toggle = document.getElementById('journal-toggle');
  toggle.addEventListener('click', () => {
    const select = document.getElementById('journal-select');
    select.style.display = select.style.display === 'none' ? 'inline' : 'none';
  });

    // Close on outside click
  document.addEventListener('click', (e) => {
    const select = document.getElementById('journal-select');
    const toggle = document.getElementById('journal-toggle');
    if (!toggle.contains(e.target) && !select.contains(e.target)) {
      select.style.display = 'none';
    }
  });

function setLoading(isLoading) {
  const el = document.getElementById("journal-loading");
  if (!el) return;
  el.classList.toggle("hidden", !isLoading);
}

function updateAccountFilterDisplay() {
  const displays = document.querySelectorAll('.account-filter');
  const clearFilters = document.querySelectorAll('.clear-filter');
  const text = currentAccountFilter ? `Showing: ${currentAccountFilter}` : '';
  displays.forEach(display => display.textContent = text);
  clearFilters.forEach(link => {
    link.style.display = currentAccountFilter ? 'inline' : 'none';
  });
}

// Update the displayed list of included journals
function updateIncludedJournals() {
  const container = document.getElementById('included-journals');
  container.innerHTML = '';
  if (selectedJournals.length > 0) {
    const tagContainer = document.createElement('div');
    tagContainer.className = 'journal-tags';
    selectedJournals.forEach(j => {
      const tag = document.createElement('span');
      tag.className = 'journal-tag';
      tag.textContent = j.replace('.journal', '');
      tagContainer.appendChild(tag);
    });
    container.appendChild(tagContainer);
  }
}

// Load available journals and set up the journal selector
async function loadJournals() {
  
  try {
    const res = await fetch("/journals");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const select = document.getElementById('journal-select');
    select.innerHTML = '';
    data.journals.forEach(j => {
      const option = document.createElement('option');
      option.value = j;
      //display without ".journal" suffix
      option.textContent = j.replace('.journal', '');
      
      if (j.replace('.journal', '') === 'main') option.selected = true; //default select main
      select.appendChild(option);
    });
    
    selectedJournals = Array.from(select.selectedOptions).map(o => o.value); //get selected journals
    selectedJournals = selectedJournals.map(j => j.endsWith('.journal') ? j : `${j}.journal`);    //add ".journal" suffix if not present
    if (selectedJournals.length === 0) selectedJournals = ['main.journal'];  //default to main.journal if none selected
    updateIncludedJournals(); //initial update that displays selected journal tags

    // Handle selection changes
    select.addEventListener('change', () => {
      selectedJournals = Array.from(select.selectedOptions).map(o => o.value);
      if (selectedJournals.length === 0) selectedJournals = ['main.journal'];
      updateIncludedJournals();
      loadBalance();
      loadRegister(currentAccountFilter);
      reloadJournal();
    });
  } catch (e) {
    console.error('Failed to load journals:', e);
    selectedJournals = ['main.journal'];    // Fallback to default

    updateIncludedJournals();
    loadBalance();
    loadJournal();
    loadRegister();
  }


}


/*****************Data Loading Functions************** */
async function loadBalance() {
  const res = await fetch(`/balance?journals=${selectedJournals.join(',')}`);

  const data = await res.json();

  const container = document.getElementById("accounts");
  container.innerHTML = "";
  for (const node of data) {
    container.appendChild(renderAccount(node));
  }
}

async function loadRegister(account = null, query = currentJournalSearch) {
  const params = new URLSearchParams({ journals: selectedJournals.join(',') });
  if (account) params.set("account", account);
  if (query) params.set("query", query);
  const url = `/register?${params.toString()}`;
  const res = await fetch(url);
  const transactions = await res.json();

  const tbody = document.querySelector("#register tbody");
  tbody.innerHTML = "";

  for (const tx of transactions) {
    tbody.appendChild(renderTransactionRow(tx));
  }
}

async function loadJournal(filters = {}) {
  setLoading(true);
  try {
    const params = new URLSearchParams({journals: selectedJournals.join(','), ...filters});
    if (debugMode) console.log("Loading journal with params:", params.toString());
    const res = await fetch(`/journal?${params.toString()}`);
    const data = await res.json();
    currentJournalTransactions = data;

    const tbody = document.querySelector("#journal-table tbody");
    tbody.innerHTML = "";

    for (const tx of data) {
      tbody.appendChild(renderJournalRow(tx));
    }
    if (activeJournalView === "charts") updateJournalChart();
  } catch (e) {
    console.error("Failed to load journal:", e);
    currentJournalTransactions = [];
    if (activeJournalView === "charts") updateJournalChart();
  } finally {
    setLoading(false);
  }
}

document.getElementById("download-journal").addEventListener("click", () => {
  document.getElementById("journal-download-dialog").showModal();
});

document.getElementById("journal-download-cancel").addEventListener("click", () => {
  document.getElementById("journal-download-dialog").close();
});

document.getElementById("journal-download-cancel-button").addEventListener("click", () => {
  document.getElementById("journal-download-dialog").close();
});

document.getElementById("journal-download-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const outputFormat = document.getElementById("journal-download-format").value;
  document.getElementById("journal-download-dialog").close();
  const params = new URLSearchParams({
    journals: selectedJournals.join(","),
    output: outputFormat,
  });
  if (currentAccountFilter) params.set("account", currentAccountFilter);
  const searchQuery = document.getElementById("journal-search").value.trim();
  if (searchQuery) params.set("query", searchQuery);

  try {
    const response = await fetch(`/journal?${params.toString()}`);
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || `HTTP ${response.status}`);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = `selected-journals.${outputFormat}`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    console.error("Journal download failed:", error);
    window.alert(`Journal download failed: ${error.message}`);
  }
});


//Make a function to render account names with a filter icon next to them
/*****************Rendering Functions************** */
function renderAccountName(accountName, filterAccount = accountName) {
  const label = document.createElement("span");
  label.textContent = accountName ?? "(unnamed)";
  label.className = "account-name";

  const icon = document.createElement("button");
  icon.className = "filter-icon";
  icon.title = "Filter register and journal";
  icon.textContent = " ▤";
  icon.type = "button"; // prevent form submission
  label.append(icon);
  icon.addEventListener("click", (e) => {
  e.stopImmediatePropagation(); // stronger than stopPropagation
  e.preventDefault();

  currentAccountFilter = filterAccount;
  updateAccountFilterDisplay();
  reloadJournal();
  loadRegister(filterAccount);

  if (debugMode) console.log(`Filtered by account: ${filterAccount}`);
});

  return label;
}

function renderAccount(node, depth = 0) {  // Recursive function to render account tree
  const li = document.createElement("li");

  // Create a row container for name + balance
  const row = document.createElement("span");
  row.className = "account-row";
  row.style.setProperty("--depth", depth);

  const label = renderAccountName(node.name, node.account);

  const amount = document.createElement("span");
  amount.textContent = formatAmount(node.balance);
  amount.className = "account-balance";

  row.append(label, amount);

  // If the node has children, wrap them in <details> for collapsible tree
  if (node.accounts && node.accounts.length > 0) {
    const details = document.createElement("details");

    const summary = document.createElement("summary");
    summary.appendChild(row);
    details.appendChild(summary);

    const ul = document.createElement("ul");
    for (const child of node.accounts) {
      ul.appendChild(renderAccount(child, depth + 1));
    }
    details.appendChild(ul);

    li.appendChild(details);
  } else {
    // Leaf nodes: just append the row directly
    li.appendChild(row);
  }

  return li;
}

function renderTransactionRow(tx) {
  const tr = document.createElement("tr");
  tr.className = "clickable-row";
  tr.dataset.txid = tx.id;

  tr.innerHTML = `
    <td class="deEmphasize">${tx.id}</td>
    <td>${tx.date}</td>
    <td>${tx.description}</td>
    <td>${tx.account}</td>
    <td class="amount">${formatAmount(tx.amount)}</td>
    <td class="balance">${formatAmount(tx.balance)}</td>
  `;

 // tr.addEventListener("click", () => toggleDetails(tx.id));
 // return tr;
 // )

 // New behavior: expand/collapse split rows on click
  tr.addEventListener("click", () => {
  if (tr.classList.contains("expanded")) {
    tr.classList.remove("expanded");
    tr.nextElementSibling?.classList.contains("split-row") &&
      tr.parentNode.querySelectorAll(".split-row")
        .forEach(r => r.remove());
    return;
  }

  tr.classList.add("expanded");

  tr.insertAdjacentHTML(
    "afterend",
    renderSplitRows(tx)
  );
});

return tr;

}

function renderJournalRow(tx) {
  let account = tx.postings[0] ? tx.postings[0].account : null;
  
  // if tx.description begins with "open ", use that as account, The description is in the form "open <account name>"
  // So split the description by space and take the second part as account name
  if (tx.description.startsWith("open ")) {
    const parts = tx.description.split(" ");
    account = parts[1];
    tx.description = "Account opened";
  }
  return renderJournalTableRow(tx, {
    formatAmount,
    renderAccount: () => renderAccountName(account),
    onEdit: openJournalEditor,
  });
}

function openJournalEditor(edit) {
  journalEditorMode = "edit";
  activeJournalEdit = edit;
  document.getElementById("journal-editor-title").textContent = "Edit Journal Entry";
  document.getElementById("journal-editor-destination").hidden = true;
  document.getElementById("journal-destination").disabled = true;
  document.getElementById("journal-editor-save").textContent = "Save entry";
  document.getElementById("journal-entry-content").value = edit.content;
  document.getElementById("journal-editor-status").textContent = "";
  document.getElementById("journal-editor-save").disabled = false;
  document.getElementById("journal-editor").showModal();
}

async function openAddJournalEntry() {
  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const status = document.getElementById("journal-editor-status");
  const destination = document.getElementById("journal-destination");
  const saveButton = document.getElementById("journal-editor-save");
  status.textContent = "";
  destination.disabled = false;
  destination.required = true;
  saveButton.disabled = true;

  try {
    const response = await fetch("/journals");
    const result = await response.json();
    if (!response.ok) throw new Error("Unable to load journals");

    const journals = result.journals.filter((name) => name.endsWith(".journal"));
    if (!journals.length) throw new Error("No journal files are available");
    destination.replaceChildren(...journals.map((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      return option;
    }));

    const yearJournal = `${today.getFullYear()}.journal`;
    destination.value = journals.includes(yearJournal)
      ? yearJournal
      : (selectedJournals.find((name) => journals.includes(name)) || journals[0]);

    journalEditorMode = "add";
    activeJournalEdit = null;
    document.getElementById("journal-editor-title").textContent = "Add Journal Entry";
    document.getElementById("journal-editor-destination").hidden = false;
    document.getElementById("journal-editor-save").textContent = "Add entry";
    document.getElementById("journal-entry-content").value =
      `${date} description ; comment\n    account1 $AMT\n    account2 $AMT`;
    saveButton.disabled = false;
    document.getElementById("journal-editor").showModal();
  } catch (error) {
    status.textContent = error.message;
    saveButton.disabled = true;
    document.getElementById("journal-editor-title").textContent = "Add Journal Entry";
    document.getElementById("journal-editor").showModal();
  }
}

document.getElementById("add-journal-entry").addEventListener("click", openAddJournalEntry);

document.getElementById("journal-editor-close").addEventListener("click", () => {
  document.getElementById("journal-editor").close();
});

document.getElementById("journal-editor-cancel").addEventListener("click", () => {
  document.getElementById("journal-editor").close();
});

document.getElementById("journal-editor-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (journalEditorMode === "edit" && !activeJournalEdit) return;

  const saveButton = document.getElementById("journal-editor-save");
  const status = document.getElementById("journal-editor-status");
  saveButton.disabled = true;
  status.textContent = "Saving...";

  try {
    const isEdit = journalEditorMode === "edit";
    const response = await fetch(isEdit ? "/journal/edit" : "/journal/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isEdit
        ? { ...activeJournalEdit, content: document.getElementById("journal-entry-content").value }
        : {
            journal: document.getElementById("journal-destination").value,
            content: document.getElementById("journal-entry-content").value,
          }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || "Unable to save journal entry");

    document.getElementById("journal-editor").close();
    await Promise.all([loadBalance(), loadRegister(currentAccountFilter)]);
    reloadJournal();
  } catch (error) {
    status.textContent = error.message;
    saveButton.disabled = false;
  }
});

function setJournalView(view) {
  activeJournalView = view;
  const views = ["journal", "charts", "register"];
  for (const candidate of views) {
    const selected = candidate === view;
    const tab = document.getElementById(`${candidate}-view-tab`);
    tab.classList.toggle("active", selected);
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    const panelId = candidate === "journal" ? "journal-table-panel" : `${candidate}-panel`;
    document.getElementById(panelId).hidden = !selected;
  }
  if (view === "charts") updateJournalChart();
  if (view === "register") loadRegister(currentAccountFilter);
}

document.getElementById("journal-view-tab").addEventListener("click", () => setJournalView("journal"));
document.getElementById("charts-view-tab").addEventListener("click", () => setJournalView("charts"));
document.getElementById("register-view-tab").addEventListener("click", () => setJournalView("register"));

for (const [tab, view] of [
  [document.getElementById("journal-view-tab"), "journal"],
  [document.getElementById("charts-view-tab"), "charts"],
  [document.getElementById("register-view-tab"), "register"],
]) {
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const views = ["journal", "charts", "register"];
    const currentIndex = views.indexOf(view);
    const nextIndex = event.key === "Home" ? 0
      : event.key === "End" ? views.length - 1
      : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + views.length) % views.length;
    const nextView = views[nextIndex];
    setJournalView(nextView);
    document.getElementById(`${nextView}-view-tab`).focus();
  });
}

for (const controlId of ["chart-type", "chart-account-class", "chart-grouping", "chart-commodity"]) {
  document.getElementById(controlId).addEventListener("change", updateJournalChart);
}

function chartAmountsForClass() {
  const accountClass = document.getElementById("chart-account-class").value.toLowerCase();
  const amounts = [];
  for (const transaction of currentJournalTransactions) {
    for (const posting of transaction.postings) {
      const account = posting.account || "";
      if (account.split(":", 1)[0].toLowerCase() !== accountClass) continue;
      for (const amount of posting.amount) {
        amounts.push({
          date: transaction.date,
          account,
          commodity: amount.commodity || "(no commodity)",
          quantity: Number(amount.quantity),
        });
      }
    }
  }
  return amounts.filter((amount) => Number.isFinite(amount.quantity));
}

function updateJournalChart() {
  const status = document.getElementById("chart-status");
  const container = document.getElementById("chart-container");
  const excludedContainer = document.getElementById("chart-excluded");
  const excludedList = document.getElementById("chart-excluded-list");
  const commodityControl = document.getElementById("chart-commodity-control");
  const commoditySelect = document.getElementById("chart-commodity");
  const type = document.getElementById("chart-type").value;
  const accountClass = document.getElementById("chart-account-class").value.toLowerCase();
  const amounts = chartAmountsForClass();
  const commodities = [...new Set(amounts.map((amount) => amount.commodity))].sort();
  const previousCommodity = commoditySelect.value;

  commoditySelect.replaceChildren(...commodities.map((commodity) => {
    const option = document.createElement("option");
    option.value = commodity;
    option.textContent = commodity;
    return option;
  }));
  commodityControl.hidden = commodities.length < 2;
  if (commodities.includes(previousCommodity)) commoditySelect.value = previousCommodity;

  if (journalChart) {
    journalChart.destroy();
    journalChart = null;
  }
  excludedContainer.hidden = true;
  excludedList.replaceChildren();

  const commodity = commoditySelect.value;
  const selectedAmounts = amounts.filter((amount) => amount.commodity === commodity);
  if (!selectedAmounts.length) {
    container.hidden = true;
    status.textContent = amounts.length
      ? "No postings for this commodity."
      : "No postings match this account class and filter.";
    return;
  }

  const grouping = document.getElementById("chart-grouping").value;
  const totals = new Map();
  for (const amount of selectedAmounts) {
    const label = grouping === "month" ? amount.date.slice(0, 7) : amount.account;
    totals.set(label, (totals.get(label) || 0) + amount.quantity);
  }

  let chartEntries = [...totals].map(([label, total]) => ({
    label,
    value: type === "pie" && accountClass === "income" ? -total : total,
  }));
  let excludedEntries = [];
  if (type === "pie") {
    excludedEntries = chartEntries.filter((entry) => entry.value < 0)
      .sort((left, right) => left.label.localeCompare(right.label));
    chartEntries = chartEntries.filter((entry) => entry.value > 0);
    if (excludedEntries.length) {
      excludedList.replaceChildren(...excludedEntries.map((entry) => {
        const item = document.createElement("li");
        item.textContent = `${entry.label}: ${commodity} ${entry.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
        return item;
      }));
      excludedContainer.hidden = false;
    }
  }

  if (grouping === "account" && chartEntries.length > 12) {
    const ranked = chartEntries
      .sort((left, right) => Math.abs(right.value) - Math.abs(left.value));
    const leading = ranked.slice(0, 11);
    const remainder = ranked.slice(11).reduce((sum, item) => sum + item.value, 0);
    chartEntries = leading.concat({ label: "Other accounts", value: remainder });
  } else {
    chartEntries.sort((left, right) => left.label.localeCompare(right.label));
  }

  if (!chartEntries.length) {
    container.hidden = true;
    status.textContent = type === "pie" && excludedEntries.length
      ? "No positive net values to chart."
      : "No non-zero values to chart.";
    return;
  }

  const labels = chartEntries.map((entry) => entry.label);
  const values = chartEntries.map((entry) => entry.value);

  const palette = ["#167d75", "#e07a5f", "#377eb8", "#e3a008", "#795548", "#7b61a8", "#4d9f70", "#d1495b", "#54717a", "#d17cbd", "#8c8f2f", "#6674a6"];
  const chartData = type === "pie"
    ? {
        labels,
        datasets: [{
          data: values,
          backgroundColor: labels.map((_, index) => palette[index % palette.length]),
          borderColor: "#fff",
          borderWidth: 2,
        }],
      }
    : {
        labels,
        datasets: [{
          label: commodity,
          data: values,
          backgroundColor: "#167d75",
          borderColor: "#0f625c",
          borderWidth: 1,
        }],
      };

  container.hidden = false;
  status.textContent = type === "pie"
    ? `Showing net values in ${commodity}${accountClass === "income" ? " with income signs reversed" : ""}.`
    : `Signed posting amounts in ${commodity}.`;
  journalChart = new Chart(document.getElementById("journal-chart"), {
    type,
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: type === "pie", position: "bottom" },
        tooltip: {
          callbacks: {
            label(context) {
              const value = type === "pie" ? values[context.dataIndex] : context.parsed.y;
              return `${context.label}: ${commodity} ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
            },
          },
        },
      },
      ...(type === "bar" ? {
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, title: { display: true, text: commodity } },
        },
      } : {}),
    },
  });
}

function renderSplitRows(tx) {
  if (!tx.other_accounts.length && !tx.comment) return "";

  if (tx.other_accounts.length) {
    return tx.other_accounts.map((o, index) => `
      <tr class="split-row">
        <td></td><td></td>
        <td class="comment">${index === 0 && tx.comment ? tx.comment : ""}</td>
        <td class="account split-account">↳ ${o.account}</td>
        <td class="amount">${formatAmount(o.amount)}</td>
        <td></td>
      </tr>
    `).join("");
  } else {
    // only comment
    return `
      <tr class="split-row">
        <td></td><td></td>
        <td class="comment">${tx.comment}</td>
        <td class="account split-account"></td>
        <td class="amount"></td>
        <td></td>
      </tr>
    `;
  }
}

/*****************Utility Functions************** */
function formatAmount(amounts) {
  return amounts.map(a =>
      `${a.commodity}${a.quantity.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`
    )
    .join(", ");
}
document.querySelectorAll('.clear-filter').forEach(link => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    currentAccountFilter = null;
    updateAccountFilterDisplay();
    loadRegister();
    reloadJournal();
  });
});

let searchTimer = null;

document
  .getElementById("journal-search")
  .addEventListener("input", (e) => {
    clearTimeout(searchTimer);

    searchTimer = setTimeout(() => {
      currentJournalSearch = e.target.value.trim();
      reloadJournal();
      loadRegister(currentAccountFilter, currentJournalSearch);
    }, 300);
  });

function reloadJournal() {
  const params = {};
  if (currentAccountFilter) {
    params.account = currentAccountFilter;
  }
  if (currentJournalSearch) {
    params.query = currentJournalSearch;
  }
  if (debugMode) console.log("Reloading journal with params:", params);
  loadJournal(params);
}

// Initial load

loadJournals().then(() => {
  updateAccountFilterDisplay(); // Initialize filter display state
  loadBalance();
  loadRegister();
  loadJournal();
});
