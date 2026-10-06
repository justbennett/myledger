// -------------------------
// Dropdown auto-hide (global)
// -------------------------
function closeAllSelects(exceptId = null) {
  const selectorIds = ['data-select', 'rules-select', 'journal-select'];
  for (const id of selectorIds) {
    if (id === exceptId) continue;
    const dropdown = document.getElementById(id);
    if (dropdown) dropdown.style.display = 'none';
  }
}

function toggleSelect(id) {
  const dropdown = document.getElementById(id);
  if (!dropdown) return;

  const isOpen = dropdown.style.display === 'block';
  closeAllSelects(isOpen ? null : id);
  dropdown.style.display = isOpen ? 'none' : 'block';
}

document.addEventListener('click', (e) => {
  const target = e.target;
  const clickedToggle = target.closest('.select-toggle');
  const clickedSelect = target.closest('.list-select');

  if (!clickedToggle && !clickedSelect) {
    closeAllSelects();
  }
});

// -------------------------
// Toggle buttons
// -------------------------
document.getElementById('rules-toggle').addEventListener('click', (event) => {
  event.stopPropagation();
  toggleSelect('rules-select');
});

document.getElementById('rules-create-button')?.addEventListener('click', () => {
  const dialog = document.getElementById('rules-create-dialog');
  const nameInput = document.getElementById('rules-create-name');
  document.getElementById('rules-create-status').textContent = 'The .rules extension is added automatically.';
  document.getElementById('rules-create-submit').disabled = false;
  nameInput.value = '';
  dialog.showModal();
  nameInput.focus();
});

document.getElementById('rules-create-close')?.addEventListener('click', () => {
  document.getElementById('rules-create-dialog').close();
});

document.getElementById('rules-create-cancel')?.addEventListener('click', () => {
  document.getElementById('rules-create-dialog').close();
});

document.getElementById('rules-create-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitButton = document.getElementById('rules-create-submit');
  const status = document.getElementById('rules-create-status');
  submitButton.disabled = true;
  status.textContent = 'Creating file...';

  try {
    const response = await fetch('/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: document.getElementById('rules-create-name').value }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || 'Unable to create rules file');

    const select = document.getElementById('rules-select');
    const option = document.createElement('option');
    option.value = result.filename;
    option.textContent = result.filename;
    select.appendChild(option);
    select.value = result.filename;
    select.dispatchEvent(new Event('change'));
    document.getElementById('rules-create-dialog').close();
  } catch (error) {
    status.textContent = error.message;
    submitButton.disabled = false;
  }
});

document.getElementById('data-toggle')?.addEventListener('click', (event) => {
  event.stopPropagation();
  toggleSelect('data-select');
});

document.getElementById('journal-toggle')?.addEventListener('click', (event) => {
  event.stopPropagation();
  toggleSelect('journal-select');
});

document.getElementById('journal-create-button')?.addEventListener('click', () => {
  const dialog = document.getElementById('journal-create-dialog');
  const nameInput = document.getElementById('journal-create-name');
  document.getElementById('journal-create-status').textContent = 'The .journal extension is added automatically.';
  document.getElementById('journal-create-submit').disabled = false;
  nameInput.value = '';
  dialog.showModal();
  nameInput.focus();
});

document.getElementById('journal-create-close')?.addEventListener('click', () => {
  document.getElementById('journal-create-dialog').close();
});

document.getElementById('journal-create-cancel')?.addEventListener('click', () => {
  document.getElementById('journal-create-dialog').close();
});

document.getElementById('journal-create-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitButton = document.getElementById('journal-create-submit');
  const status = document.getElementById('journal-create-status');
  submitButton.disabled = true;
  status.textContent = 'Creating file...';

  try {
    const response = await fetch('/journals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: document.getElementById('journal-create-name').value }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || 'Unable to create journal file');

    const select = document.getElementById('journal-select');
    const option = document.createElement('option');
    option.value = result.filename;
    option.textContent = result.filename;
    select.appendChild(option);
    select.value = result.filename;
    select.dispatchEvent(new Event('change'));
    document.getElementById('journal-create-dialog').close();
  } catch (error) {
    status.textContent = error.message;
    submitButton.disabled = false;
  }
});

let activeJournalName = '';
let activeJournalContent = '';

document.getElementById('journal-select')?.addEventListener('change', async function() {
  const sel = this.value;
  const editButton = document.getElementById('journal-edit-button');
  
  try {
    const response = await fetch(`/journal-files/${encodeURIComponent(sel)}?t=${Date.now()}`);
    if (!response.ok) throw new Error('Unable to load journal file');
    const text = await response.text();
    if (this.value !== sel) return;
    const url = makeObjectUrlFromText(text);
    document.getElementById('journal-viewer').style.display = 'block';
    document.getElementById('journal-details').textContent = sel;
    const rc = document.getElementById('journal-content');
    if (rc?.dataset.blobUrl) URL.revokeObjectURL(rc.dataset.blobUrl);
    if (rc) rc.data = url;
    if (rc) rc.dataset.blobUrl = url;
    activeJournalName = sel;
    activeJournalContent = text;
    editButton.hidden = false;
    console.log('Selected journal:', sel);
  } catch (error) {
    console.error('Error loading journal file:', error);
  }
});

document.getElementById('journal-edit-button')?.addEventListener('click', () => {
  if (!activeJournalName) return;
  document.getElementById('journal-editor-title').textContent = `Edit ${activeJournalName}`;
  document.getElementById('journal-editor-content').value = activeJournalContent;
  document.getElementById('journal-editor-status').textContent = '';
  document.getElementById('journal-editor-save').disabled = false;
  document.getElementById('journal-editor').showModal();
  document.getElementById('journal-editor-content').focus();
});

document.getElementById('journal-editor-close')?.addEventListener('click', () => {
  document.getElementById('journal-editor').close();
});

document.getElementById('journal-editor-cancel')?.addEventListener('click', () => {
  document.getElementById('journal-editor').close();
});

document.getElementById('journal-editor-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const saveButton = document.getElementById('journal-editor-save');
  const status = document.getElementById('journal-editor-status');
  const content = document.getElementById('journal-editor-content').value;

  const confirmed = window.confirm(
    `You are about to overwrite ${activeJournalName}.\n\nThis is risky and should only be done if you have a backup. Continue?`
  );
  if (!confirmed) {
    status.textContent = 'Save cancelled.';
    saveButton.disabled = false;
    return;
  }

  saveButton.disabled = true;
  status.textContent = 'Saving...';

  try {
    const response = await fetch(`/journal-files/${encodeURIComponent(activeJournalName)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, original_content: activeJournalContent }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || 'Unable to save journal file');

    activeJournalContent = content;
    const preview = document.getElementById('journal-content');
    if (preview.dataset.blobUrl) URL.revokeObjectURL(preview.dataset.blobUrl);
    const url = makeObjectUrlFromText(content);
    preview.data = url;
    preview.dataset.blobUrl = url;
    document.getElementById('journal-editor').close();
  } catch (error) {
    status.textContent = error.message;
    saveButton.disabled = false;
  }
});

//Add a click event listener to the data-upload-button to trigger the file input click
document.getElementById('data-upload-button')?.addEventListener('click', () => {
  document.getElementById('upload-data-input').click();
});
// -------------------------
// Utilities
// -------------------------
function makeObjectUrlFromText(text) {
  const blob = new Blob([text], { type: 'text/plain' });
  return URL.createObjectURL(blob);
}

async function showJournalPreview(filename) {
  const viewer = document.getElementById('journal-viewer');
  const details = document.getElementById('journal-details');
  const preview = document.getElementById('journal-content');
  if (!viewer || !details || !preview) return;
  if (!filename) {
    viewer.style.display = 'none';
    return;
  }

  details.textContent = filename;
  try {
    const response = await fetch(`/journal-files/${encodeURIComponent(filename)}`);
    if (!response.ok) throw new Error('Could not load journal file');
    const text = await response.text();

    if (preview.dataset.blobUrl) URL.revokeObjectURL(preview.dataset.blobUrl);
    const url = makeObjectUrlFromText(text);
    preview.data = url;
    preview.dataset.blobUrl = url;
    viewer.style.display = 'block';
  } catch (error) {
    details.textContent = `${filename} (preview unavailable)`;
    console.error('Error loading journal file:', error);
  }
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
let activeRuleName = '';
let activeRuleContent = '';

document.getElementById('rules-select').addEventListener('change', async function() {
    const sel = this.value;
    const editButton = document.getElementById('rules-edit-button');
    editButton.hidden = true;
    try {
      const response = await fetch(`/rules/${encodeURIComponent(sel)}?t=${Date.now()}`);
      if (!response.ok) throw new Error('Unable to load rules file');
      const text = await response.text();
      if (this.value !== sel) return;
      const url = makeObjectUrlFromText(text);
      document.getElementById('rules-viewer').style.display = 'block';
      document.getElementById('rule-details').textContent = sel;
      const rc = document.getElementById('rule-content');
      if (rc?.dataset.blobUrl) URL.revokeObjectURL(rc.dataset.blobUrl);
      if (rc) rc.data = url;
      if (rc) rc.dataset.blobUrl = url;
      activeRuleName = sel;
      activeRuleContent = text;
      editButton.hidden = false;
      console.log('Selected rule:', sel);
    } catch (error) {
      console.error('Error loading rule file:', error);
    }
});

document.getElementById('rules-edit-button')?.addEventListener('click', () => {
  if (!activeRuleName) return;
  document.getElementById('rules-editor-title').textContent = `Edit ${activeRuleName}`;
  document.getElementById('rules-editor-content').value = activeRuleContent;
  document.getElementById('rules-editor-status').textContent = '';
  document.getElementById('rules-editor-save').disabled = false;
  document.getElementById('rules-editor').showModal();
  document.getElementById('rules-editor-content').focus();
});

document.getElementById('rules-editor-close')?.addEventListener('click', () => {
  document.getElementById('rules-editor').close();
});

document.getElementById('rules-editor-cancel')?.addEventListener('click', () => {
  document.getElementById('rules-editor').close();
});

document.getElementById('rules-editor-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const saveButton = document.getElementById('rules-editor-save');
  const status = document.getElementById('rules-editor-status');
  const content = document.getElementById('rules-editor-content').value;
  saveButton.disabled = true;
  status.textContent = 'Saving...';

  try {
    const response = await fetch(`/rules/${encodeURIComponent(activeRuleName)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, original_content: activeRuleContent }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || 'Unable to save rules file');

    activeRuleContent = content;
    const preview = document.getElementById('rule-content');
    if (preview.dataset.blobUrl) URL.revokeObjectURL(preview.dataset.blobUrl);
    const url = makeObjectUrlFromText(content);
    preview.data = url;
    preview.dataset.blobUrl = url;
    document.getElementById('rules-editor').close();
  } catch (error) {
    status.textContent = error.message;
    saveButton.disabled = false;
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
      
      //if a journal name matches the year like '2026.journal' then select it
      if (journal.match(/^\d{4}\.journal$/)) {
        option.selected = true;
      }
      dropdown.appendChild(option);
    });

    const selectedJournal = dropdown.value;
    if (selectedJournal) showJournalPreview(selectedJournal);
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
  uploadButton.hidden = !file;
  status.textContent = file ? `File selected. Upload it to use it for import.` : '';
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
    uploadButton.hidden = true;
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

// -------------------------
// MyLedger updates
// -------------------------



async function checkForUpdates() {


  const updateButton = document.getElementById('update-my-ledger');
  const version = document.getElementById('update-version');
  const status = document.getElementById('update-status');

  updateButton.hidden = true;
  status.textContent = 'Checking GitHub...';

  try {
    const response = await fetch('/update-status');

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.detail || 'Unable to check for updates');
    }

  if (!result.available) {
      version.textContent = '';
      status.textContent = result.message;
      updateButton.hidden = true;
      return;
    }

    const currentShort = result.current.substring(0, 7);
    const remoteShort = result.remote.substring(0, 7);

    version.textContent =
      `Installed: ${currentShort}    GitHub: ${remoteShort}`;

    if (result.update_available) {
      status.textContent = 'An update is available.';
      updateButton.hidden = false;
    } else {
      status.textContent = 'MyLedger is up to date.';
    }

  } catch (error) {
    status.textContent = error.message;
  } 
}

document.getElementById('update-my-ledger')?.addEventListener(
  'click',
  async () => {
    const updateButton = document.getElementById('update-my-ledger');
    const version = document.getElementById('update-version');
    const status = document.getElementById('update-status');

    if (!confirm(
      'Update MyLedger now?\n\n' +
      'The application will restart automatically.'
    )) {
      return;
    }

    checkButton.disabled = true;
    updateButton.disabled = true;
    status.textContent = 'Updating MyLedger...';
    version.textContent = 'Please wait...';

    try {
      const response = await fetch('/update', {
        method: 'POST',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || 'Unable to start update');
      }

      status.textContent =
        'Update started. Waiting for MyLedger to restart...';

      waitForRestart();

    } catch (error) {
      status.textContent = error.message;
      checkButton.disabled = false;
      updateButton.disabled = false;
    }
  }
);

async function waitForRestart() {
  const status = document.getElementById('update-status');

  // Give the deployment process time to restart the service.
  await new Promise(resolve => setTimeout(resolve, 3000));

  let attempts = 0;
  const maxAttempts = 30;

  const check = async () => {
    attempts++;

    try {
      const response = await fetch(`/update-status?t=${Date.now()}`);

      if (response.ok) {
        const result = await response.json();

        if (!result.update_available) {
          window.location.reload();
          return;
        }
      }
    } catch (error) {
      // Server is probably restarting. Keep waiting.
    }

    if (attempts >= maxAttempts) {
      status.textContent =
        'The update may still be running. Refresh the page in a moment.';
      return;
    }

    status.textContent =
      `Waiting for MyLedger to restart... (${attempts}/${maxAttempts})`;

    setTimeout(check, 2000);
  };

  check();
}

// Initialization
// -------------------------
document.addEventListener('DOMContentLoaded', function() {
  loadFileList('data-files', 'data-select');
  loadFileList('rules', 'rules-select');
  loadJournalList();
  checkForUpdates();
});


