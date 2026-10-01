# MyLedger

MyLedger is a lightweight web interface for [hledger](https://hledger.org/) designed for personal, local accounting.

It provides a browser-based view of hledger journals with account balances, journal transactions, register views, charts, journal editing, and CSV import using hledger rules files.

The application is built with **Python, FastAPI, Jinja2, and vanilla JavaScript**, with hledger handling the underlying accounting calculations and journal processing.

## Features

### Dashboard

The main dashboard provides:

* Hierarchical account balances
* Support for selecting multiple journal files
* Journal transaction view
* Register view
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

The **Add Data** page provides a workflow for importing CSV financial data using hledger CSV rules.

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

The default journal is:

```text
journals/main.journal
```

Additional `.journal` files can be stored in the `journals/` directory.

### hledger Integration

MyLedger does not implement its own accounting engine. It calls the installed `hledger` executable and consumes hledger's JSON output.

This means the journal remains a normal hledger journal and can continue to be used directly with the hledger command line.

---

## Requirements

You will need:

* Python 3.10 or newer
* [hledger](https://hledger.org/)
* A modern web browser
* Windows, Linux, or another platform capable of running the required Python and hledger tools

The application uses Python features such as:

```python
str | None
```

so a reasonably recent Python version is required.

### Python packages

The application imports:

* FastAPI
* Uvicorn
* Jinja2
* itsdangerous
* python-dotenv
* python-multipart

Install the dependencies listed in `requirements.txt`:

For example:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1

python -m pip install -r requirements.txt
```

On systems where PowerShell script execution is restricted, activate the environment using the appropriate method for your shell.

---

## Installing hledger

MyLedger expects the `hledger` executable to be available on the system `PATH`.

Verify that it is available:

```powershell
hledger --version
```

If that command does not work, install hledger and make sure its installation directory is included in `PATH`.

MyLedger invokes hledger directly, so the web application cannot function without it.

---

## Project Structure

```text
myledger/
├── app.py
├── index.html
├── LICENSE
├── .gitignore
│
├── templates/
│   ├── dashboard.html
│   ├── add-data.html
│   └── footer.html
│
├── static/
│   ├── css/
│   │   └── main.css
│   ├── js/
│   │   ├── app.js
│   │   ├── add-data.js
│   │   └── vendor/
│   │       ├── chart.umd.min.js
│   │       └── CHARTJS-LICENSE.md
│   └── favicon.ico
│
├── examples/
│   ├── README.md
│   ├── data/
│   │   └── sample.csv
│   ├── journals/
│   │   ├── main.journal
│   │   └── sample.journal
│   └── rules/
│       └── sample.csv.rules
│
├── journals/
├── data/
└── rules/
```

The `journals/`, `data/`, and `rules/` directories are intentionally ignored by Git because they normally contain private financial information.

---

## Initial Setup

Clone the repository:

```powershell
git clone https://github.com/justbennett/myledger.git
cd myledger
```

Create a Python virtual environment:

```powershell
python -m venv .venv
```

Activate it:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install the Python dependencies:

```powershell
python -m pip install -r requirements.txt
```

On Linux, create and activate the environment and install the same dependencies with:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

Configure the login credentials before starting the application. Copy `.env.example` to `.env`:

```powershell
Copy-Item .env.example .env
```

```bash
cp .env.example .env
```

Then set `MYLEDGER_USERNAME`, `MYLEDGER_PASSWORD_HASH`, and `MYLEDGER_SESSION_SECRET`. The `.env` file is excluded from Git; keep it private.

Generate a password hash and a session secret with Python:

```powershell
python -c "import getpass, hashlib, secrets; salt=secrets.token_bytes(16); print(salt.hex()+':'+hashlib.pbkdf2_hmac('sha256', getpass.getpass('Password: ').encode(), salt, 200000).hex())"
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Put the first command's output in `MYLEDGER_PASSWORD_HASH` and the second command's output in `MYLEDGER_SESSION_SECRET` in `.env`. Set your chosen login name in `MYLEDGER_USERNAME`.

Create the directories used by the application:

```powershell
New-Item -ItemType Directory -Force journals, data, rules
```

You can then copy the included example files into those directories for testing.

```powershell
Copy-Item examples/journals/* journals/ -NoClobber
Copy-Item examples/data/* data/ -NoClobber
Copy-Item examples/rules/* rules/ -NoClobber
```

The example files use fictional data and are safe for testing.

**Do not copy the examples over an existing personal ledger.**

---

## Running MyLedger

MyLedger should be run from the project root.

Activate the virtual environment:

```powershell
.\.venv\Scripts\Activate.ps1
```

For Linux, activate it with:

```bash
source .venv/bin/activate
```

Start the FastAPI application for local development:

```powershell
python -m uvicorn app:app --reload
```

The same command works on Linux after activating the virtual environment. Install hledger separately and ensure it is available on `PATH` for the account that runs MyLedger.

Then open:

```text
http://127.0.0.1:8000/
```

The application expects to find the journal and supporting directories relative to the project directory.

For example:

```text
myledger/
├── app.py
├── journals/
│   └── main.journal
├── data/
└── rules/
```

Running the application from another working directory may prevent hledger and the application from finding these files correctly.

---

## Journal Files

The default journal is:

```text
journals/main.journal
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

Place rules files in:

```text
rules/
```

and CSV source files in:

```text
data/
```

The Add Data page will automatically discover files in those directories.

### Import workflow

From the web interface:

1. Open **Add Data**
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

The repository's `.gitignore` intentionally excludes:

```text
/data/
/journals/
/rules/
```

as well as CSV files and common Python virtual-environment files.

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

---

## Security Considerations

MyLedger has a single-user login configured through `.env`; it is not a hardened, multi-user service. The login does not replace network-level access controls.

The application directly reads and writes journal files and executes the `hledger` executable. The session cookie is currently configured with `https_only=False`, so do not expose this version directly to the public Internet, even behind a TLS-terminating reverse proxy.

For private remote use, restrict access with a VPN or firewall and bind Uvicorn to localhost behind a properly configured HTTPS reverse proxy. Run without `--reload`, keep `.env` and the journal, data, and rules directories readable only by the service account, and back up ledger files securely. Before public deployment, enable HTTPS-only session cookies in the application and review the authentication and deployment security controls.

The default Uvicorn host is localhost. For example, a Linux development run is:

```bash
python -m uvicorn app:app --host 127.0.0.1 --port 8000 --reload
```

The application must be run from the project root so it can find its journals, templates, and static files.

---

## Development

During development, use:

```powershell
python -m uvicorn app:app --reload
```

The `--reload` option causes Uvicorn to restart the application when Python source files change.

The application is deliberately lightweight, so most changes can be made directly to:

```text
app.py
templates/
static/js/
static/css/
```

No frontend build step is currently required.

---

## Limitations

The current project does not include:

* A Python dependency lockfile
* A frontend package/build system
* Hardened authentication and multi-user access control
* Database-backed storage
* Automated tests in the repository
* A production deployment configuration

MyLedger is therefore best treated as a personal/local accounting interface rather than a multi-user accounting service.

---

## License

MyLedger is licensed under the **GNU General Public License v3.0**.

See [`LICENSE`](LICENSE) for the complete license text.

---

## Acknowledgments

MyLedger is built around [hledger](https://hledger.org/), which provides the accounting engine, journal processing, reporting, and CSV import functionality.

Charting is provided by [Chart.js](https://www.chartjs.org/).
