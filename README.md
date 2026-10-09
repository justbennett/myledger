# MyLedger

MyLedger is a lightweight web interface for [hledger](https://hledger.org/) designed for personal, local accounting.

It provides a browser-based view of hledger journals with account balances, journal transactions, register views, charts, journal editing, and CSV import using hledger rules files.

The application is built with **Python, FastAPI, Jinja2, and vanilla JavaScript**, with hledger handling the underlying accounting calculations and journal processing.

For local development, authentication setup, and production deployment procedures, see [development.md](development.md).

## Features

### Dashboard

The main dashboard provides:

* Hierarchical account balances
* Support for selecting multiple journal files
* Journal transaction view
* Register view
* Download selected journals as a plain-text file
* Charts for:

  * Expenses
  * Income
  * Assets
  * Liabilities
* Bar and pie charts
* Grouping by month or account
* Account filtering
* Journal search/query support
* Expandable transaction details

### Journal Editing

Journal entries can be edited directly from the browser.

The editor:

* Displays the original hledger transaction
* Validates edited transactions with hledger before saving
* Prevents multiple transactions from being entered as a single edit
* Detects changes made to the journal since the entry was loaded
* Preserves the journal's existing line-ending style
* Writes changes through a temporary file before replacing the original

New transactions can also be added to an existing journal from the web interface.

### CSV Import

The **Data Management** page provides a workflow for importing CSV financial data using hledger CSV rules.

The import workflow supports:

1. Selecting a CSV data file
2. Selecting an hledger rules file
3. Selecting the destination journal
4. Viewing the selected source and rules files
5. Running an hledger dry run
6. Reviewing the dry-run result
7. Performing the actual import

Completed imports are also annotated in the journal with a comment containing the import timestamp, source file, rules file, and hledger's import result.

### Multiple Journals

MyLedger can work with multiple journal files.

The dashboard allows journals to be selected for viewing, and the account balances, register, and journal views are generated from the selected files.

The default journal is `main.journal` inside the configured ledger-data directory:

```text
<MYLEDGER_DATA_DIR>/journals/main.journal
```

Additional `.journal` files can be stored in `<MYLEDGER_DATA_DIR>/journals/`.
`MYLEDGER_DATA_DIR` defaults to the application's working directory (`.`), so with the default configuration the path is `journals/main.journal`. Set this environment variable to keep ledger files outside the application checkout.

### hledger Integration

MyLedger does not implement its own accounting engine. It calls the installed `hledger` executable and consumes hledger's JSON output.

This means the journal remains a normal hledger journal and can continue to be used directly with the hledger command line.

---

## Journal Files

The default journal is `main.journal` in the configured ledger-data directory:

```text
<MYLEDGER_DATA_DIR>/journals/main.journal
```

A basic hledger journal might look like:

```text
2026-01-01 Opening Balance
    assets:checking     $1000.00
    equity:opening     $-1000.00

2026-01-02 Grocery Store
    expenses:food         $50.00
    assets:checking      $-50.00
```

MyLedger leaves the underlying journal format in hledger's hands. Journal entries can therefore be inspected and manipulated using the normal hledger command-line tools as well.

---

## CSV Imports

CSV imports are controlled by hledger rules files.

For example, a simple rules file might contain:

```text
skip 1
fields date, description, amount
date-format %Y-%m-%d

account1 assets:checking
account2 expenses:sample

amount %amount
```

The rules file determines how the CSV fields are mapped into hledger transactions.

Place rules files in the configured ledger-data directory:

```text
<MYLEDGER_DATA_DIR>/rules/
```

CSV source files remain in the application's `data/` directory:

```text
data/
```

The Data Management page discovers rules from `<MYLEDGER_DATA_DIR>/rules/` and CSV files from `data/`.

### Import workflow

From the web interface:

1. Open **Data Management**
2. Select a CSV file
3. Select the corresponding rules file
4. Select the destination journal
5. Execute **Dry Run**
6. Review the output
7. Click **Import Data** if the result is correct

The dry run is intended to provide an opportunity to catch problems before modifying the journal.

---

## Working With Private Financial Data

Financial data should remain local.

The repository's `.gitignore` excludes these application-root data directories:

```text
/data/
/journals/
/rules/
/myledger-data/
```

as well as CSV files and common Python virtual-environment files. Keep any other `MYLEDGER_DATA_DIR` location outside the repository or add it to `.gitignore` so private ledger files are not committed.

This allows the application code and example data to be committed to GitHub without committing the user's actual financial records.

Before committing changes, verify that personal journals and bank exports are not staged:

```powershell
git status
```

---

## API Endpoints

The FastAPI application exposes several endpoints used by the web interface.

### Dashboard

```text
GET /
```

Returns the main dashboard.

### Balance

```text
GET /balance
```

Returns the account hierarchy and balances using hledger's JSON output.

Optional parameters include:

```text
journals
begin
end
depth
```

### Journals

```text
GET /journals
```

Lists available journal files.

### Register

```text
GET /register
```

Returns register information generated from hledger.

Optional parameters include:

```text
journals
account
begin
end
```

### Journal

```text
GET /journal
```

Returns journal transactions in JSON form.

Optional parameters include:

```text
journals
account
match
query
```

### Add Journal Entry

```text
POST /journal/add
```

Adds a validated hledger transaction to a journal.

### Edit Journal Entry

```text
POST /journal/edit
```

Edits an existing transaction after validating it with hledger.

The edit mechanism uses a hash of the original transaction to detect conflicting changes.

### CSV Import

```text
POST /import
```

Runs hledger's CSV import using a selected data file and rules file.

The endpoint supports a dry-run mode before actually modifying the journal.

### Data and Rules

```text
GET /get-data-files
GET /data-files/{filename}

GET /get-rules
GET /rules/{filename}
```

These endpoints provide the files used by the import interface.

### Journal

```text
GET /journal
```

Returns the journal transactions as JSON by default. Supplying `output` requests a downloadable file in one of the supported formats: `txt`, `html`, `csv`, `fods`, `beancount`, `sql`, or `json`.

---

## Architecture

The application is intentionally small.

```text
                 Browser
                    │
                    ▼
              FastAPI / Jinja
                    │
          ┌─────────┴─────────┐
          │                   │
          ▼                   ▼
     HTML / JavaScript      hledger
          │                   │
          │                   ▼
          │             Journal files
          │             CSV / rules
          │
          └────── JSON API
```

### Backend

The backend is implemented in `app.py`.

FastAPI handles:

* HTTP routes
* Journal operations
* File access
* hledger process execution
* Validation
* JSON responses
* HTML template rendering

### Frontend

The frontend uses:

* HTML
* CSS
* Vanilla JavaScript
* Jinja2 templates
* Chart.js

There is no frontend build system or JavaScript package manager required by the current project.

Chart.js is included in the repository under:

```text
static/js/vendor/
```

### Frontend Structure

Jinja page templates are in `templates/`. Shared dashboard and page fragments are in `templates/components/`.

```text
templates/
├── components/
│   ├── charts.html
│   ├── footer.html
│   ├── header.html
│   ├── journal.html
│   ├── leftbar.html
│   ├── main-view.html
│   └── register.html
├── dashboard.html
├── login.html
└── move-data.html

static/
├── css/
│   └── main.css
└── js/
    ├── app.js
    ├── journal-table.js
    ├── move-data.js
    └── vendor/
        ├── CHARTJS-LICENSE.md
        └── chart.umd.min.js
```

`app.js` and `move-data.js` contain page-specific behavior. The shared `journal-table.js` renderer is loaded by both pages that display the journal table.

---

## Examples

The repository includes a small set of safe example files:

```text
examples/
├── data/
│   └── sample.csv
├── journals/
│   ├── main.journal
│   └── sample.journal
└── rules/
    └── sample.csv.rules
```

These fixtures use invented accounts, descriptions, and amounts.

See [`examples/README.md`](examples/README.md) for the recommended way to copy them into a clean checkout.

The example files are fictional. Do not copy them over an existing personal ledger.

---

## Security Considerations

MyLedger has a single-user login configured through `.env`; it is not a hardened, multi-user service. The login does not replace network-level access controls.

The application directly reads and writes journal files and executes the `hledger` executable. The session cookie is currently configured with `https_only=False`, so do not expose this version directly to the public Internet, even behind a TLS-terminating reverse proxy.

For private remote use, restrict access with a VPN or firewall and bind Uvicorn to localhost behind a properly configured HTTPS reverse proxy. Run without `--reload`, keep `.env` and the journal, data, and rules directories readable only by the service account, and back up ledger files securely. Before public deployment, enable HTTPS-only session cookies in the application and review the authentication and deployment security controls.

## Limitations

The current project does not include:

* A Python dependency lockfile
* A frontend package/build system
* Hardened authentication and multi-user access control
* Database-backed storage
* Automated tests in the repository

MyLedger is therefore best treated as a personal/local accounting interface rather than a multi-user accounting service.

---

## License

MyLedger is licensed under the **GNU General Public License v3.0**.

See [`LICENSE`](LICENSE) for the complete license text.

---

## Acknowledgments

MyLedger is built around [hledger](https://hledger.org/), which provides the accounting engine, journal processing, reporting, and CSV import functionality.

Charting is provided by [Chart.js](https://www.chartjs.org/).
