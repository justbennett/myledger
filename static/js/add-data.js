// -------------------------
// Dropdown auto-hide (global)
// -------------------------
document.addEventListener('click', (e) => {
  for (const dropdown of document.getElementsByTagName('select')) {
    const toggle = dropdown.previousElementSibling;
    if (!toggle.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  }
});

// -------------------------
// Toggle buttons
// -------------------------
document.getElementById('rules-toggle').addEventListener('click', () => {
  const dropdown = document.getElementById('rules-select');
  dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('data-toggle')?.addEventListener('click', () => {
  const dropdown = document.getElementById('data-select');
  dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('journal-toggle')?.addEventListener('click', () => {
  const dropdown = document.getElementById('journal-select');
  dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('journal-select')?.addEventListener('change', function() {
  const viewer = document.getElementById('journal-viewer');
  const details = document.getElementById('journal-details');
  if (!viewer || !details) return;

  details.textContent = this.value;
  viewer.style.display = 'block';
});

// -------------------------
// Utilities
// -------------------------
function makeObjectUrlFromText(text) {
  const blob = new Blob([text], { type: 'text/plain' });
  return URL.createObjectURL(blob);
}

let pendingImport = null;

// -------------------------
// Data loaders
// -------------------------

// show data details when the selection changes
document.getElementById('data-select').addEventListener('change', async function() {
    const sel = this.value;
    try {
      const response = await fetch(`/data-files/${encodeURIComponent(sel)}`);
      const text = await response.text();
      const url = makeObjectUrlFromText(text);
      document.getElementById('data-viewer').style.display = 'block';
      document.getElementById('data-details').textContent = sel;
      const rc = document.getElementById('file-preview');
      if (rc) rc.data = url;
      console.log('Selected data:', sel);
    } catch (error) {
      console.error('Error loading data file:', error);
    }
});

// show rule details when the selection changes
document.getElementById('rules-select').addEventListener('change', async function() {
    const sel = this.value;
    try {
      const response = await fetch(`/rules/${encodeURIComponent(sel)}?t=${Date.now()}`);
      const text = await response.text();
      const url = makeObjectUrlFromText(text);
      document.getElementById('rules-viewer').style.display = 'block';
      document.getElementById('rule-details').textContent = sel;
      const rc = document.getElementById('rule-content');
      if (rc) rc.data = url;
      console.log('Selected rule:', sel);
    } catch (error) {
      console.error('Error loading rule file:', error);
    }
});

async function loadFileList(list, elementId){
    return fetch(`/get-${list}`)
    .then(response => response.json())
    .then(data => {
        const dropdown = document.getElementById(elementId);
        if (!dropdown) return;
        dropdown.innerHTML = '';
        data[`${list}`].forEach(item => {
          const option = document.createElement('option');
          option.value = item;
          option.textContent = item;
          dropdown.appendChild(option);
        });
      })
      .catch(error => {
        console.error(`Error loading ${list}:`, error);
      });

}

async function loadJournalList() {
  try {
    const response = await fetch('/journals');
    const data = await response.json();
    const dropdown = document.getElementById('journal-select');
    if (!dropdown) return;

    dropdown.innerHTML = '';
    data.journals.forEach(journal => {
      const option = document.createElement('option');
      option.value = journal;
      option.textContent = journal;
      option.selected = journal === 'main.journal';
      dropdown.appendChild(option);
    });

    const selectedJournal = dropdown.value;
    const viewer = document.getElementById('journal-viewer');
    const details = document.getElementById('journal-details');
    if (selectedJournal && viewer && details) {
      details.textContent = selectedJournal;
      viewer.style.display = 'block';
    }
  } catch (error) {
    console.error('Error loading journals:', error);
  }
}
 
// Import actions
// -------------------------
async function runImport({ dryRun = false, file, rule, journal } = {}) {
  const fileInput = document.getElementById('data-select');
  const ruleSelect = document.getElementById('rules-select');
  const journalSelect = document.getElementById('journal-select');

  file = file || fileInput?.value;
  rule = rule || ruleSelect?.value;
  journal = journal || journalSelect?.value;

  if (!file) {
    alert('Select a CSV file');
    return;
  }
  if (!rule) {
    alert('Select a rule');
    return;
  }
  if (!journal) {
    alert('Select a destination journal');
    return;
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('rule', rule);
  formData.append('journal', journal);
  formData.append('dry_run', dryRun);

  const res = await fetch('/import', {
    method: 'POST',
    body: formData,
  });

  const data = await res.json();
  document.getElementById('dry-run-results').style.display = 'block';

  return data;
}

function formatJournalAmount(amounts) {
  return amounts.map((amount) => {
    const quantity = Number(amount.aquantity?.floatingPoint ?? 0);
    return `${amount.acommodity || ""}${quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })}`;
  }).join(", ");
}

function renderDryRunJournal(transactions) {
  const tbody = document.querySelector("#dry-run-journal-table tbody");
  tbody.replaceChildren();

  for (const transaction of transactions) {
    const postings = transaction.tpostings || [];
    const firstPosting = postings[0];
    const row = document.createElement("tr");
    const values = [
      transaction.tdate || "",
      transaction.tdescription || "",
      firstPosting?.paccount || "",
      firstPosting ? formatJournalAmount(firstPosting.pamount || []) : "",
    ];
    for (const value of values) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    }
    row.lastElementChild.className = "amount";
    tbody.appendChild(row);

    if (transaction.tcomment || postings.length > 1) {
      const detailsRow = document.createElement("tr");
      detailsRow.className = "dry-run-detail-row";
      const detailsCell = document.createElement("td");
      detailsCell.colSpan = 4;
      if (transaction.tcomment) {
        const comment = document.createElement("p");
        comment.className = "comment";
        comment.textContent = transaction.tcomment.trim();
        detailsCell.appendChild(comment);
      }
      const postingTable = document.createElement("table");
      postingTable.className = "journal-postings";
      for (const posting of postings.slice(1)) {
        const postingRow = document.createElement("tr");
        const accountCell = document.createElement("td");
        accountCell.textContent = `↳ ${posting.paccount || ""}`;
        const amountCell = document.createElement("td");
        amountCell.className = "amount";
        amountCell.textContent = formatJournalAmount(posting.pamount || []);
        postingRow.append(accountCell, amountCell);
        postingTable.appendChild(postingRow);
      }
      detailsCell.appendChild(postingTable);
      detailsRow.appendChild(detailsCell);
      tbody.appendChild(detailsRow);
    }
  }
}

function setDryRunView(view) {
  const showJournal = view === "journal";
  document.getElementById("dry-run-journal-view").hidden = !showJournal;
  document.getElementById("dry-run-text-view").hidden = showJournal;
  document.getElementById("dry-run-journal-tab").classList.toggle("active", showJournal);
  document.getElementById("dry-run-text-tab").classList.toggle("active", !showJournal);
  document.getElementById("dry-run-journal-tab").setAttribute("aria-selected", String(showJournal));
  document.getElementById("dry-run-text-tab").setAttribute("aria-selected", String(!showJournal));
}

document.getElementById("dry-run-journal-tab")?.addEventListener("click", () => setDryRunView("journal"));
document.getElementById("dry-run-text-tab")?.addEventListener("click", () => setDryRunView("text"));
 
// UI handlers
// -------------------------
document.getElementById('upload-data-input')?.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  const uploadButton = document.getElementById('upload-csv');
  const status = document.getElementById('upload-status');
  uploadButton.disabled = !file;
  status.textContent = file ? `${file.name} selected. Upload it to use it for import.` : '';
  if (!file) return;
  const text = await file.text();
  const preview = document.getElementById('file-preview');
  const viewer = document.getElementById('data-viewer');

  // Revoke old blob if present
  if (preview?.dataset?.blobUrl) {
    URL.revokeObjectURL(preview.dataset.blobUrl);
  }

  const url = makeObjectUrlFromText(text);

  if (preview) {
    preview.data = url;
    preview.dataset.blobUrl = url;
  }
  if (viewer) viewer.style.display = 'block';
  document.getElementById('data-details').textContent = file.name;
});

document.getElementById('upload-csv')?.addEventListener('click', async () => {
  const input = document.getElementById('upload-data-input');
  const uploadButton = document.getElementById('upload-csv');
  const status = document.getElementById('upload-status');
  const file = input.files[0];
  if (!file) return;

  uploadButton.disabled = true;
  status.textContent = `Uploading ${file.name}...`;
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('/upload-data', { method: 'POST', body: formData });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || 'CSV upload failed');

    const dataSelect = document.getElementById('data-select');
    let option = Array.from(dataSelect.options).find((item) => item.value === result.file);
    if (!option) {
      option = document.createElement('option');
      option.value = result.file;
      option.textContent = result.file;
      dataSelect.appendChild(option);
    }
    Array.from(dataSelect.options).forEach((item) => { item.selected = false; });
    option.selected = true;
    pendingImport = null;
    const importButton = document.getElementById('import-data');
    importButton.disabled = true;
    importButton.style.display = 'none';
    status.textContent = `${result.file} uploaded. Select an import rule and destination journal, then execute a dry run.`;
    input.value = '';
  } catch (error) {
    status.textContent = error.message;
    uploadButton.disabled = false;
  }
});

document.getElementById('dry-run')?.addEventListener('click', async () => {
  const importButton = document.getElementById('import-data');
  importButton.disabled = true;
  importButton.style.display = 'none';

  const result = await runImport({ dryRun: true });
  if (!result) return;
  document.getElementById('dry-run-details').textContent = result.output || result.message || '';
  renderDryRunJournal(result.transactions || []);
  document.getElementById('dry-run-preview-status').textContent = result.preview_error
    || (result.transactions?.length ? `${result.transactions.length} transactions in this preview.` : 'No new transactions to preview.');
  setDryRunView(result.transactions?.length ? 'journal' : 'text');

  if (result.success) {
    pendingImport = {
      file: document.getElementById('data-select').value,
      rule: document.getElementById('rules-select').value,
      journal: document.getElementById('journal-select').value,
    };
    importButton.style.display = 'inline-block';
    importButton.disabled = false;
  } else {
    alert(result.message || 'Dry run failed');
  }
});

document.getElementById('import-data')?.addEventListener('click', async () => {
  const importButton = document.getElementById('import-data');
  importButton.disabled = true;

  const result = await runImport({ dryRun: false, ...pendingImport });
  document.getElementById('dry-run-details').textContent = result.output || result.message || '';

  if (!result.success) {
    importButton.disabled = false;
    alert(result.message || 'Import failed');
    return;
  }

  importButton.style.display = 'none';
  pendingImport = null;
  alert('Data imported successfully');
});
 
// Initialization
// -------------------------
document.addEventListener('DOMContentLoaded', function() {
  loadFileList('data-files', 'data-select');
  loadFileList('rules', 'rules-select');
  loadJournalList();
});


