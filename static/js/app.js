// static/js/app.js
// JavaScript code for hledger UI
/*****************Main Loading Functions************** */
let selectedJournals = ['main'];
let currentAccountFilter = null;
let currentJournalSearch = "";
let activeJournalEdit = null;
let journalEditorMode = "edit";

let debugMode = false; //set to true to enable debug logging

const journalDataService = {
  buildQueryParams(filters = {}) {
    const params = new URLSearchParams({ journals: selectedJournals.join(',') });
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") {
        params.set(key, String(value));
      }
    });
    return params;
  },

  async fetchJournals() {
    const response = await fetch("/journals");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  },

  async fetchBalance() {
    const params = this.buildQueryParams();
    const response = await fetch(`/balance?${params.toString()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  },

  async fetchRegister({ account = null, query = currentJournalSearch } = {}) {
    const params = this.buildQueryParams({ account: account || undefined, query: query || undefined });
    const response = await fetch(`/register?${params.toString()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  },

  async fetchJournal(filters = {}) {
    const params = this.buildQueryParams(filters);
    const response = await fetch(`/journal?${params.toString()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  },
};

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
    const data = await journalDataService.fetchJournals();
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
  const data = await journalDataService.fetchBalance();

  const container = document.getElementById("accounts");
  container.innerHTML = "";
  for (const node of data) {
    container.appendChild(renderAccount(node));
  }
}

document.getElementById("download-balance").addEventListener("click", () => {
  document.getElementById("balance-download-dialog").showModal();
});

document.getElementById("balance-download-close").addEventListener("click", () => {
  document.getElementById("balance-download-dialog").close();
});

document.getElementById("balance-download-cancel").addEventListener("click", () => {
  document.getElementById("balance-download-dialog").close();
});

document.getElementById("balance-download-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const outputFormat = document.getElementById("balance-download-format").value;
  const params = new URLSearchParams({
    journals: selectedJournals.join(","),
    output: outputFormat,
  });
  const begin = document.getElementById("balance-download-begin").value;
  const end = document.getElementById("balance-download-end").value;
  const depth = document.getElementById("balance-download-depth").value;
  if (begin) params.set("begin", begin);
  if (end) params.set("end", end);
  if (depth) params.set("depth", depth);

  try {
    const response = await fetch(`/balance?${params.toString()}`);
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || `HTTP ${response.status}`);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = `balance-sheet.${outputFormat}`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    document.getElementById("balance-download-dialog").close();
  } catch (error) {
    console.error("Balance sheet download failed:", error);
    window.alert(`Balance sheet download failed: ${error.message}`);
  }
});

function resetTransactionSelection(table) {
  const selectAll = table.querySelector("[data-select-all]");
  if (!selectAll) return;
  selectAll.checked = false;
  selectAll.indeterminate = false;
}

document.addEventListener("change", (event) => {
  const checkbox = event.target;
  if (!(checkbox instanceof HTMLInputElement)) return;

  const table = checkbox.closest("table");
  if (!table) return;

  if (checkbox.matches("[data-select-all]")) {
    const rowCheckboxes = table.querySelectorAll("tbody [data-transaction-select]");
    checkbox.checked = rowCheckboxes.length > 0 && checkbox.checked;
    rowCheckboxes.forEach((rowCheckbox) => {
      rowCheckbox.checked = checkbox.checked;
    });
    checkbox.indeterminate = false;
    return;
  }

  if (!checkbox.matches("[data-transaction-select]")) return;
  const selectAll = table.querySelector("[data-select-all]");
  if (!selectAll) return;
  const rowCheckboxes = Array.from(table.querySelectorAll("tbody [data-transaction-select]"));
  const checkedCount = rowCheckboxes.filter((rowCheckbox) => rowCheckbox.checked).length;
  selectAll.checked = rowCheckboxes.length > 0 && checkedCount === rowCheckboxes.length;
  selectAll.indeterminate = checkedCount > 0 && checkedCount < rowCheckboxes.length;
});

async function loadRegister(account = null, query = currentJournalSearch) {
  const transactions = await journalDataService.fetchRegister({ account, query });

  const table = document.getElementById("register");
  const tbody = table.querySelector("tbody");
  tbody.innerHTML = "";
  resetTransactionSelection(table);

  for (const tx of transactions) {
    tbody.appendChild(renderTransactionRow(tx));
  }
}

async function loadJournal(filters = {}) {
  setLoading(true);
  try {
    if (debugMode) console.log("Loading journal with params:", filters);
    const data = await journalDataService.fetchJournal(filters);

    const table = document.getElementById("journal-table");
    const tbody = table.querySelector("tbody");
    tbody.innerHTML = "";
    resetTransactionSelection(table);

    for (const tx of data) {
      tbody.appendChild(renderJournalRow(tx));
    }
  } catch (e) {
    console.error("Failed to load journal:", e);
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

  const selectCell = document.createElement("td");
  selectCell.className = "transaction-select-cell";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.dataset.transactionSelect = "";
  checkbox.setAttribute("aria-label", `Select transaction ${tx.date} ${tx.description}`);
  selectCell.appendChild(checkbox);

  const statusCell = document.createElement("td");
  statusCell.className = "transaction-status";
  statusCell.textContent = transactionStatus(tx.status);

  const idCell = document.createElement("td");
  idCell.className = "deEmphasize";
  idCell.textContent = tx.id;
  const dateCell = document.createElement("td");
  dateCell.textContent = tx.date;
  const descriptionCell = document.createElement("td");
  descriptionCell.textContent = tx.description;
  const accountCell = document.createElement("td");
  accountCell.textContent = tx.account;
  const amountCell = document.createElement("td");
  amountCell.className = "amount";
  amountCell.textContent = formatAmount(tx.amount);
  const balanceCell = document.createElement("td");
  balanceCell.className = "balance";
  balanceCell.textContent = formatAmount(tx.balance);
  tr.append(selectCell, statusCell, idCell, dateCell, descriptionCell, accountCell, amountCell, balanceCell);

 // tr.addEventListener("click", () => toggleDetails(tx.id));
 // return tr;
 // )

 // New behavior: expand/collapse split rows on click
  tr.addEventListener("click", (event) => {
  if (event.target.closest("[data-transaction-select]")) return;
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

function getJournalEntryFields() {
  const postings = Array.from(document.querySelectorAll(".journal-entry-posting-row"))
    .map((row) => {
      const account = row.querySelector(".journal-entry-account-input").value.trim();
      const amount = formatJournalEntryAmount(row.querySelector(".journal-entry-amount-input").value);
      return account ? `${account}${amount ? `  ${amount}` : ""}` : amount;
    })
    .filter((posting) => posting);
  const date = document.getElementById("journal-entry-date").value;
  const status = document.getElementById("journal-entry-status").value;
  const description = document.getElementById("journal-entry-description").value.trim();
  const comment = document.getElementById("journal-entry-comment").value.trim();

  const header = `${date}${date ? " " : ""}${status ? `${status} ` : ""}${description}${comment ? `  ; ${comment}` : ""}`;
  return [header, ...postings.map((posting) => `    ${posting.trim()}`)].join("\n");
}

function formatJournalEntryAmount(value) {
  const amount = value.trim();
  const dollarAmount = amount.match(/^\s*(?:([+-]?)\s*\$\s*|\$\s*([+-]?)\s*)(\d+(?:,\d{3})*(?:\.\d+)?|\.\d+)\s*$/);
  if (dollarAmount) return `$${dollarAmount[1] || dollarAmount[2] || ""}${dollarAmount[3]}`;

  const numericAmount = amount.match(/^([+-]?)(\d+(?:,\d{3})*(?:\.\d+)?|\.\d+)$/);
  return numericAmount ? `$${numericAmount[1]}${numericAmount[2]}` : amount;
}

function setJournalEntryFields(content) {
  const [header = "", ...lines] = content.replace(/\r\n?/g, "\n").split("\n");
  const headerMatch = header.match(/^(\d{4}-\d{2}-\d{2})(?:\s+(.*))?$/);
  const dateInput = document.getElementById("journal-entry-date");
  const statusInput = document.getElementById("journal-entry-status");
  const descriptionInput = document.getElementById("journal-entry-description");
  const commentInput = document.getElementById("journal-entry-comment");

  if (headerMatch) {
    dateInput.value = headerMatch[1];
    let headerText = headerMatch[2] || "";
    const statusMatch = headerText.match(/^([*!])(?:\s+|$)/);
    statusInput.value = statusMatch ? statusMatch[1] : "";
    if (statusMatch) headerText = headerText.slice(statusMatch[0].length);
    const commentIndex = headerText.indexOf(";");
    descriptionInput.value = (commentIndex < 0 ? headerText : headerText.slice(0, commentIndex)).trim();
    commentInput.value = commentIndex < 0 ? "" : headerText.slice(commentIndex + 1).trim();
  } else {
    dateInput.value = "";
    statusInput.value = "";
    descriptionInput.value = "";
    commentInput.value = "";
  }

  const postings = lines
    .filter((line) => /^\s+\S/.test(line))
    .map((line) => {
      const posting = line.trimStart();
      const amountSeparator = posting.search(/[ \t]{2,}/);
      if (amountSeparator < 0) return { account: posting, amount: "" };
      return {
        account: posting.slice(0, amountSeparator).trimEnd(),
        amount: posting.slice(amountSeparator).trim(),
      };
    });
  renderJournalEntryPostings(postings.length >= 2 ? postings : [...postings, ...Array(Math.max(0, 2 - postings.length)).fill("")]);
}

function renderJournalEntryPostings(postings) {
  const container = document.getElementById("journal-entry-postings");
  container.replaceChildren();
  postings.forEach((posting, index) => {
    const row = document.createElement("div");
    row.className = "journal-entry-posting-row";

    const label = document.createElement("label");
    label.className = "journal-entry-account-label";
    label.textContent = `Account ${index + 1}`;

    const accountInput = document.createElement("input");
    accountInput.type = "text";
    accountInput.className = "journal-entry-account-input";
    accountInput.value = typeof posting === "string" ? posting : posting.account;
    accountInput.placeholder = "Account name";
    accountInput.setAttribute("aria-label", `Account ${index + 1} name`);

    const amountInput = document.createElement("input");
    amountInput.type = "text";
    amountInput.className = "journal-entry-amount-input";
    const rawAmount = typeof posting === "string" ? "" : posting.amount;
    const dollarAmount = rawAmount.match(/^\s*(?:([+-]?)\s*\$\s*|\$\s*([+-]?)\s*)(\d+(?:,\d{3})*(?:\.\d+)?|\.\d+)\s*$/);
    amountInput.value = dollarAmount
      ? `${dollarAmount[1] || dollarAmount[2] || ""}${dollarAmount[3]}`
      : rawAmount;
    amountInput.placeholder = "Amount";
    amountInput.inputMode = "decimal";
    amountInput.setAttribute("aria-label", `Amount for account ${index + 1}`);

    const amountField = document.createElement("span");
    amountField.className = "journal-entry-amount-field";
    const currencySymbol = document.createElement("span");
    currencySymbol.className = "journal-entry-currency-symbol";
    currencySymbol.textContent = "$";
    currencySymbol.hidden = Boolean(rawAmount && !dollarAmount && !/^[+-]?(?:\d+(?:,\d{3})*(?:\.\d+)?|\.\d+)$/.test(rawAmount));
    amountInput.addEventListener("input", () => {
      const isDollarAmount = /^[+-]?(?:\d+(?:,\d{3})*(?:\.\d+)?|\.\d+)$/.test(amountInput.value.trim());
      currencySymbol.hidden = Boolean(amountInput.value.trim()) && !isDollarAmount;
    });
    amountField.append(currencySymbol, amountInput);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "icon-button";
    removeButton.textContent = "×";
    removeButton.title = `Remove account ${index + 1}`;
    removeButton.setAttribute("aria-label", `Remove account ${index + 1}`);
    removeButton.disabled = postings.length <= 2;
    removeButton.addEventListener("click", () => {
      renderJournalEntryPostings(
        Array.from(container.querySelectorAll(".journal-entry-posting-row"))
            .map((postingRow) => ({
              account: postingRow.querySelector(".journal-entry-account-input").value,
              amount: postingRow.querySelector(".journal-entry-amount-input").value,
            }))
            .filter((_, postingIndex) => postingIndex !== index),
        );
    });

    row.append(label, accountInput, amountField, removeButton);
    container.appendChild(row);
  });
}

function updateJournalEntryPreview() {
  document.getElementById("journal-entry-preview").textContent =
    document.getElementById("journal-entry-content").value;
}

function updateJournalEntryFromFields() {
  document.getElementById("journal-entry-content").value = getJournalEntryFields();
  updateJournalEntryPreview();
}

function openJournalEditor(edit) {
  journalEditorMode = "edit";
  activeJournalEdit = edit;
  document.getElementById("journal-editor-title").textContent = "Edit Journal Entry";
  document.getElementById("journal-editor-destination").hidden = true;
  document.getElementById("journal-destination").disabled = true;
  document.getElementById("journal-editor-save").textContent = "Save entry";
  document.getElementById("journal-entry-content").value = edit.content;
  setJournalEntryFields(edit.content);
  updateJournalEntryPreview();
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
    setJournalEntryFields(`${date} Description\n    account1  $1\n    account2  $-1`);
    document.getElementById("journal-entry-content").value = getJournalEntryFields();
    updateJournalEntryPreview();
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

document.getElementById("journal-entry-add-posting").addEventListener("click", () => {
  const postings = Array.from(document.querySelectorAll(".journal-entry-posting-row"))
    .map((row) => ({
      account: row.querySelector(".journal-entry-account-input").value,
      amount: row.querySelector(".journal-entry-amount-input").value,
    }));
  renderJournalEntryPostings([...postings, ""]);
  updateJournalEntryFromFields();
});

document.querySelector(".journal-entry-fields").addEventListener("input", updateJournalEntryFromFields);
document.querySelector(".journal-entry-fields").addEventListener("change", updateJournalEntryFromFields);

document.getElementById("journal-entry-postings").addEventListener("click", (event) => {
  if (event.target.closest(".journal-entry-posting-row") && event.target.closest("button")) {
    updateJournalEntryFromFields();
  }
});

document.getElementById("journal-entry-content").addEventListener("input", updateJournalEntryPreview);

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
  const views = ["journal", "register"];
  for (const candidate of views) {
    const selected = candidate === view;
    const tab = document.getElementById(`${candidate}-view-tab`);
    tab.classList.toggle("active", selected);
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    const panelId = candidate === "journal" ? "journal-table-panel" : `${candidate}-panel`;
    document.getElementById(panelId).hidden = !selected;
  }
  if (view === "register") loadRegister(currentAccountFilter);
}

document.getElementById("journal-view-tab").addEventListener("click", () => setJournalView("journal"));
document.getElementById("register-view-tab").addEventListener("click", () => setJournalView("register"));

for (const [tab, view] of [
  [document.getElementById("journal-view-tab"), "journal"],
  [document.getElementById("register-view-tab"), "register"],
]) {
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const views = ["journal", "register"];
    const currentIndex = views.indexOf(view);
    const nextIndex = event.key === "Home" ? 0
      : event.key === "End" ? views.length - 1
      : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + views.length) % views.length;
    const nextView = views[nextIndex];
    setJournalView(nextView);
    document.getElementById(`${nextView}-view-tab`).focus();
  });
}

function renderSplitRows(tx) {
  if (!tx.other_accounts.length && !tx.comment) return "";

  if (tx.other_accounts.length) {
    return tx.other_accounts.map((o, index) => `
      <tr class="split-row">
        <td></td><td></td><td></td><td></td>
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
        <td></td><td></td><td></td><td></td>
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
