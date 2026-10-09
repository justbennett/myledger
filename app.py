#****This must be run in the root of the project (where the journals/ directory is) for the hledger command to find the journal file(s)********
# To run: .\.venv\Scripts\Activate.ps1
# Then: python -m uvicorn app:app --reload
# Go to http://127.0.0.1:8000/
#Version 0.1.1 

import cmd
import hmac
from importlib.metadata import files
from fastapi import FastAPI, HTTPException, Request,UploadFile, File, Form
from fastapi.responses import HTMLResponse, PlainTextResponse, RedirectResponse, Response
from starlette.middleware.sessions import SessionMiddleware

from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from collections import OrderedDict
from collections import defaultdict
import subprocess
import json
from datetime import datetime
from pathlib import Path
import hashlib
import os
import re
import shlex
import tempfile
from dotenv import load_dotenv

load_dotenv()  # Load environment variables from .env file

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

@app.middleware("http")
async def require_login(request: Request, call_next):
    public_paths = {"/login"}

    if request.url.path in public_paths or request.url.path.startswith("/static/"):
        return await call_next(request)

    if not request.session.get("authenticated"):
        return RedirectResponse("/login", status_code=303)

    return await call_next(request)

app.add_middleware(
    SessionMiddleware,
    secret_key=os.environ["MYLEDGER_SESSION_SECRET"],
    https_only=False,
    max_age=43200,
)
DATA_DIR = Path("data")
LEDGER_DATA_DIR = Path(os.environ.get("MYLEDGER_DATA_DIR", "."))
JOURNAL_DIR = LEDGER_DATA_DIR / "journals"
RULES_DIR = LEDGER_DATA_DIR / "rules"
JOURNAL = str(JOURNAL_DIR / "main.journal")

#************** Helper functions ***************************
def hledger(args, files=None):
    if files is None:
        files = [JOURNAL]

    cmd = ["hledger"]
    for f in files:
        cmd.extend(["-f", f])
    cmd.extend(args)

    p = subprocess.run(cmd, capture_output=True, text=True, errors="replace")
    if p.returncode != 0:
        raise RuntimeError(p.stderr)
    return p.stdout

def append_query_terms(args, query):
    try:
        args.extend(shlex.split(query))
    except ValueError as error:
        raise HTTPException(status_code=400, detail=f"Invalid query quoting: {error}")

def build_register_transactions(rows, account_filter=None):
    grouped = group_register_rows(rows)
    transactions = []

    for txid, tx_rows in grouped.items():
        # Use first row for shared fields
        first = tx_rows[0]
        date = first[0]
        description = first[2]

        postings = []
        comments = []

        for row in tx_rows:
            p = row[3]
            postings.append(p)
            if p.get("pcomment"):
                comments.append(p["pcomment"])

        # Choose primary posting
        # Primary posting = the posting for THIS register row
        primary = row[3]

        # Amount from primary posting
        amount = [
            {
                "commodity": a["acommodity"],
                "quantity": a["aquantity"]["floatingPoint"],
            }
            for a in primary["pamount"]
        ]

        # Running balance from register row (last column)
        balance = [
            {
                "commodity": a["acommodity"],
                "quantity": a["aquantity"]["floatingPoint"],
            }
            for a in first[4]
        ]

        # Other accounts = all accounts in this transaction except the primary
        other_accounts = []

        for row in tx_rows:
            p = row[3]

            if p["paccount"] == primary["paccount"]:
                continue

            amounts = [
                {
                    "commodity": a["acommodity"],
                    "quantity": a["aquantity"]["floatingPoint"],
                    "cost": (
                        {
                            "commodity": a["acost"]["acommodity"],
                            "quantity": a["acost"]["aquantity"]["floatingPoint"],
                        }
                        if a["acost"] else None
                    )
                }
                for a in p["pamount"]
            ]

            other_accounts.append({
                "account": p["paccount"],
                "amount": amounts
            })


        transactions.append({
            "id": txid,
            "date": date,
            "description": description,
            "account": primary["paccount"],
            "amount": amount,
            "balance": balance,
            "comment": "; ".join(comments),
            "other_accounts": other_accounts,
        })

    # Preserve register order
    return sorted(transactions, key=lambda t: (t["date"], t["id"]))

def parse_hledger_rows(rows):
    tree = []
    stack = []  # track parent nodes

    for row in rows:
        full_name, display_name, depth, amounts = row
        node = {
            "name": display_name,
            "account": full_name,
            "balance": [
                { "commodity": a["acommodity"], "quantity": a["aquantity"]["floatingPoint"] }
                for a in amounts
            ],
            "accounts": []
        } 

        # manage hierarchy using depth
        while stack and stack[-1][1] >= depth:
            stack.pop()

        if stack:
            parent_node = stack[-1][0]
            parent_node["accounts"].append(node)
        else:
            tree.append(node)

        stack.append((node, depth))

    return tree

def group_register_rows(rows):
    grouped = defaultdict(list)
    for row in rows:
        txid = row[3]["ptransaction_"]
        grouped[txid].append(row)
    return grouped

def get_edit_metadata(tx):
    positions = tx.get("tsourcepos") or []
    if not positions:
        return None

    source_path = Path(positions[0]["sourceName"]).resolve()
    try:
        journal_name = source_path.relative_to(JOURNAL_DIR.resolve()).as_posix()
    except ValueError:
        return None

    line_start = positions[0]["sourceLine"]
    line_end = positions[-1]["sourceLine"] - 1
    with source_path.open("r", encoding="utf-8", newline="") as journal_file:
        lines = journal_file.read().splitlines()
    if line_start < 1 or line_end < line_start or line_end > len(lines):
        return None

    entry = "\n".join(lines[line_start - 1:line_end])
    return {
        "journal": journal_name,
        "line_start": line_start,
        "line_end": line_end,
        "content": entry,
        "original_hash": hashlib.sha256(entry.encode("utf-8")).hexdigest(),
    }

def validate_journal_entry_content(entry):
    if not isinstance(entry, str):
        raise HTTPException(status_code=400, detail="Transaction text is required")

    entry = entry.replace("\r\n", "\n").replace("\r", "\n").rstrip("\n")
    if not re.match(r"^\d{4}-\d{2}-\d{2}(?:\s|$)", entry):
        raise HTTPException(status_code=400, detail="Entry must begin with a dated transaction")
    if re.search(r"\n\d{4}-\d{2}-\d{2}(?:\s|$)", entry):
        raise HTTPException(status_code=400, detail="Enter only one transaction at a time")

    validation = subprocess.run(
        ["hledger", "print", "-f", "-", "-O", "json"],
        input=entry,
        capture_output=True,
        text=True,
        errors="replace",
    )
    if validation.returncode != 0:
        raise HTTPException(status_code=400, detail=validation.stderr.strip())
    try:
        parsed_entries = json.loads(validation.stdout)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="hledger could not parse this entry")
    if len(parsed_entries) != 1:
        raise HTTPException(status_code=400, detail="Enter only one transaction at a time")
    return entry

def resolve_data_file(directory, filename):
    if not isinstance(filename, str) or Path(filename).name != filename:
        raise HTTPException(status_code=404, detail="File not found")
    root = directory.resolve()
    file_path = (root / filename).resolve()
    if file_path.parent != root or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return file_path

# API Endpoints ***************************
@app.get("/balance")
def balance(
    journals: str | None = None,
    begin: str | None = None,
    end: str | None = None,
    depth: int | None = None,
    output: str | None = None,
):
    supported_outputs = {"txt", "csv", "tsv", "json", "fods"}
    if output is not None and output not in supported_outputs:
        raise HTTPException(status_code=400, detail="Invalid balance output format")

    files = [str(JOURNAL_DIR / j) for j in journals.split(',')] if journals else [JOURNAL]
    args = ["balance", "--tree", "--empty", "-O", output or "json"]

    if begin:
        args += ["--begin", begin]
    if end:
        args += ["--end", end]
    if depth:
        args += ["--depth", str(depth)]

    out = hledger(args, files)
    if output is not None:
        media_types = {
            "csv": "text/csv",
            "json": "application/json",
            "fods": "application/vnd.oasis.opendocument.spreadsheet-flat-xml",
        }
        return Response(
            out,
            media_type=media_types.get(output, "text/plain"),
            headers={
                "Content-Disposition": f'attachment; filename="balance-sheet.{output}"',
            },
        )

    rows = json.loads(out)
    tree = parse_hledger_rows(rows[0])  # the outermost array
    return tree

@app.get("/journals")
def list_journals():
    import os
    journals_dir = JOURNAL_DIR
    if os.path.exists(journals_dir):
        files = [f for f in os.listdir(journals_dir) if not f.startswith('.')]
        return {"journals": files}
    return {"journals": []}

@app.post("/journals")
async def create_journal_file(request: Request):
    data = await request.json()
    requested_name = data.get("filename") if isinstance(data, dict) else None
    if not isinstance(requested_name, str):
        raise HTTPException(status_code=400, detail="Enter a valid journal file name")

    stem = requested_name.strip()
    if stem.lower().endswith(".journal"):
        stem = stem[:-7]
    if (
        not stem
        or len(stem) > 100
        or stem.startswith(".")
        or Path(stem).name != stem
        or "/" in stem
        or "\\" in stem
        or any(character in stem for character in '<>:"|?*')
        or any(ord(character) < 32 for character in stem)
        or stem.endswith((" ", "."))
    ):
        raise HTTPException(status_code=400, detail="Enter a valid journal file name")

    filename = f"{stem}.journal"
    JOURNAL_DIR.mkdir(parents=True, exist_ok=True)
    journal_path = JOURNAL_DIR / filename
    try:
        with journal_path.open("x", encoding="utf-8"):
            pass
    except FileExistsError:
        raise HTTPException(status_code=409, detail="A journal file with that name already exists")

    return {"filename": filename}

@app.get("/journal-files/{filename}", response_class=PlainTextResponse)
def read_journal_file(filename: str):
    if Path(filename).suffix.lower() != ".journal":
        raise HTTPException(status_code=404, detail="File not found")
    return resolve_data_file(JOURNAL_DIR, filename).read_text(encoding="utf-8")

@app.put("/journal-files/{filename}")
async def update_journal_file(filename: str, request: Request):
    if Path(filename).suffix.lower() != ".journal":
        raise HTTPException(status_code=404, detail="File not found")
    journal_path = resolve_data_file(JOURNAL_DIR, filename)
    data = await request.json()
    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="Invalid journal update")
    content = data.get("content")
    original_content = data.get("original_content")
    if not isinstance(content, str) or not isinstance(original_content, str):
        raise HTTPException(status_code=400, detail="Invalid journal update")

    with journal_path.open("r", encoding="utf-8", newline="") as journal_file:
        current_content = journal_file.read()
    normalized_current = current_content.replace("\r\n", "\n").replace("\r", "\n")
    if normalized_current != original_content:
        raise HTTPException(status_code=409, detail="Journal file changed; reload before editing")

    newline = "\r\n" if "\r\n" in current_content else "\n"
    updated_content = content.replace("\r\n", "\n").replace("\r", "\n").replace("\n", newline)
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", newline="", dir=journal_path.parent,
            delete=False,
        ) as temp_file:
            temp_path = Path(temp_file.name)
            temp_file.write(updated_content)
        os.replace(temp_path, journal_path)
    finally:
        if temp_path and temp_path.exists():
            temp_path.unlink()

    return {"success": True}

@app.get("/register")
def register(
    journals: str | None = None,
    account: str | None = None,
    begin: str | None = None,
    end: str | None = None,
    query: str | None = None,
):
    files = [str(JOURNAL_DIR / j) for j in journals.split(',')] if journals else [JOURNAL]
    args = ["register", "-O", "json"]

    if account:
        args.append(account)
    if begin:
        args += ["--begin", begin]
    if end:
        args += ["--end", end]
    if query:
        append_query_terms(args, query)

    raw = hledger(args, files)  # get raw JSON output
    rows = json.loads(raw) # parse JSON

    transactionsOut = build_register_transactions(rows, account_filter=account)

    return transactionsOut

@app.get("/", response_class=HTMLResponse)
def dashboard(request: Request):
    return templates.TemplateResponse(
        request,
        "dashboard.html"
    )

@app.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    return templates.TemplateResponse(
        request,
        "login.html"
    )

@app.post("/login")
def login(
    request: Request,
    username: str = Form(...),
    password: str = Form(...)
):
    if username != os.environ["MYLEDGER_USERNAME"]:
        return templates.TemplateResponse(
            request,
            "login.html",
            {"error": "Invalid username or password"}
        )

    stored = os.environ["MYLEDGER_PASSWORD_HASH"]

    try:
        salt_hex, hash_hex = stored.split(":", 1)
        salt = bytes.fromhex(salt_hex)
        expected_hash = bytes.fromhex(hash_hex)
    except ValueError:
        raise RuntimeError("Invalid MYLEDGER_PASSWORD_HASH format")

    actual_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode(),
        salt,
        200000
    )

    if not hmac.compare_digest(actual_hash, expected_hash):
        return templates.TemplateResponse(
            request,
            "login.html",
            {"error": "Invalid username or password"}
        )

    request.session["authenticated"] = True

    return RedirectResponse("/", status_code=303)

@app.get("/logout")
def logout(request: Request):
    request.session.clear()
    return RedirectResponse("/login", status_code=303)

@app.get("/update-status")
def update_status():

    deploy_script = "/usr/local/bin/myledger-deploy"

    if not os.path.exists(deploy_script):
        return {
            "available": False,
            "message": "This environment has not been configured for updates.",
        }
    
    result = subprocess.run(
        ["/usr/local/bin/myledger-deploy", "--check"],
        capture_output=True,
        text=True,
    )

    if result.returncode not in (0, 10):
        raise HTTPException(
            status_code=500,
            detail=result.stderr.strip() or result.stdout.strip() or "Unable to check for updates",
        )

    current = None
    remote = None

    for line in result.stdout.splitlines():
        if line.startswith("Production:"):
            current = line.split(":", 1)[1].strip()
        elif line.startswith("GitHub:"):
            remote = line.split(":", 1)[1].strip()

    if not current or not remote:
        raise HTTPException(
            status_code=500,
            detail="Unable to determine installed and GitHub versions",
        )

    return {
        "update_available": result.returncode == 10,
        "current": current,
        "remote": remote,
        "available": True
    }

@app.post("/update")
def update():
    try:
        subprocess.Popen(
            ["/usr/local/bin/myledger-deploy"],
            start_new_session=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to start update: {error}",
        )

    return {
        "success": True,
        "message": "Update started. MyLedger will restart automatically.",
    }

@app.get("/move-data", response_class=HTMLResponse)
def add_data(request: Request):
    return templates.TemplateResponse(
        request,
        "move-data.html"
    )

@app.get("/journal")
def journal(
    journals: str | None = None,
    account: str | None = None,
    match: str | None = None,
    output: str | None = None,
   # begin: str | None = None,
   # end: str | None = None,
    query: str | None = None,
):
    supported_outputs = {
        "txt",
        "html",
        "csv",
        "fods",
        "sql",
        "json",
    }
    if output is not None and output not in supported_outputs:
        raise HTTPException(status_code=400, detail="Invalid output format")

    files = [str(JOURNAL_DIR / j) for j in journals.split(',')] if journals else [JOURNAL]
    args = ["print", "-O", output] if output else ["print", "--output-format=json"]

    if account:
        args.append(account)
    if match:
        args += ["-m ", match]
    if query:
        append_query_terms(args, query)

    out = hledger(args, files)
    if output is not None:
        media_types = {
            "html": "text/html",
            "csv": "text/csv",
            "fods": "application/vnd.oasis.opendocument.spreadsheet-flat-xml",
            "json": "application/json",
        }
        return Response(
            out,
            media_type=media_types.get(output, "text/plain"),
            headers={
                "Content-Disposition": f'attachment; filename="selected-journals.{output}"',
            },
        )

    txs = json.loads(out)

    results = []

    for tx in txs:
        date = tx["tdate"]
        desc = tx["tdescription"]
        postings = tx["tpostings"]

        results.append({
            "date": date,
            "description": desc,
            "comment": tx.get("tcomment", ""),
            "edit": get_edit_metadata(tx),
            "postings": [
                {
                    "account": p["paccount"],
                    "amount": [
                        {
                            "commodity": a["acommodity"],
                            "quantity": a["aquantity"]["floatingPoint"],
                            "cost": (
                                {
                                    "commodity": a["acost"]["acommodity"],
                                    "quantity": a["acost"]["aquantity"]["floatingPoint"],
                                }
                                if a["acost"] else None
                            )
                        }
                        for a in p["pamount"]
                    ],
                }
                for p in postings
            ]
        })

    return results

@app.post("/journal/edit")
async def edit_journal_entry(request: Request):
    data = await request.json()
    journal_name = data.get("journal")
    if not isinstance(journal_name, str):
        raise HTTPException(status_code=400, detail="Invalid journal path")

    journal_root = JOURNAL_DIR.resolve()
    journal_path = (journal_root / journal_name).resolve()
    try:
        journal_path.relative_to(journal_root)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid journal path")
    if not journal_path.is_file():
        raise HTTPException(status_code=404, detail="Journal file not found")

    line_start = data.get("line_start")
    line_end = data.get("line_end")
    original_hash = data.get("original_hash")
    edited_entry = data.get("content")
    if (
        not isinstance(line_start, int) or isinstance(line_start, bool) or line_start < 1
        or not isinstance(line_end, int) or isinstance(line_end, bool) or line_end < line_start
        or not isinstance(original_hash, str)
    ):
        raise HTTPException(status_code=400, detail="Invalid edit request")

    edited_entry = validate_journal_entry_content(edited_entry)

    with journal_path.open("r", encoding="utf-8", newline="") as journal_file:
        original_content = journal_file.read()
    lines = original_content.splitlines(keepends=True)
    if line_end > len(lines):
        raise HTTPException(status_code=409, detail="Journal changed; reload before editing")

    original_entry = "".join(lines[line_start - 1:line_end])
    normalized_original = original_entry.replace("\r\n", "\n").replace("\r", "\n").rstrip("\n")
    current_hash = hashlib.sha256(normalized_original.encode("utf-8")).hexdigest()
    if current_hash != original_hash:
        raise HTTPException(status_code=409, detail="Journal entry changed; reload before editing")

    newline = "\r\n" if "\r\n" in original_content else "\n"
    replacement = edited_entry.replace("\n", newline)
    if original_entry.endswith(("\n", "\r")):
        replacement += newline
    updated_content = (
        "".join(lines[:line_start - 1])
        + replacement
        + "".join(lines[line_end:])
    )

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", newline="", dir=journal_path.parent,
            delete=False,
        ) as temp_file:
            temp_path = Path(temp_file.name)
            temp_file.write(updated_content)
        os.replace(temp_path, journal_path)
    finally:
        if temp_path and temp_path.exists():
            temp_path.unlink()

    return {"success": True}

@app.post("/journal/add")
async def add_journal_entry(request: Request):
    data = await request.json()
    journal_name = data.get("journal") if isinstance(data, dict) else None
    if not isinstance(journal_name, str) or not journal_name.endswith(".journal"):
        raise HTTPException(status_code=400, detail="Invalid destination journal")

    journal_root = JOURNAL_DIR.resolve()
    journal_path = (journal_root / journal_name).resolve()
    try:
        journal_path.relative_to(journal_root)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid destination journal")
    if not journal_path.is_file():
        raise HTTPException(status_code=404, detail="Destination journal not found")

    entry = validate_journal_entry_content(data.get("content"))
    with journal_path.open("r", encoding="utf-8", newline="") as journal_file:
        current_content = journal_file.read()

    newline = "\r\n" if "\r\n" in current_content else "\n"
    prefix = current_content
    if prefix and not prefix.endswith(("\n", "\r")):
        prefix += newline
    if prefix and not prefix.endswith(newline + newline):
        prefix += newline

    with journal_path.open("a", encoding="utf-8", newline="") as journal_file:
        journal_file.write(prefix[len(current_content):])
        journal_file.write(entry.replace("\n", newline) + newline)

    return {"success": True, "journal": journal_name}

@app.get("/get-rules")
def get_rules():
    if RULES_DIR.exists():
        files = [path.name for path in RULES_DIR.iterdir() if path.is_file() and not path.name.startswith('.')]
        return {"rules": files}
    return {"rules": []}

@app.post("/rules")
async def create_rule_file(request: Request):
    data = await request.json()
    requested_name = data.get("filename") if isinstance(data, dict) else None
    if not isinstance(requested_name, str):
        raise HTTPException(status_code=400, detail="Enter a valid rules file name")

    stem = requested_name.strip()
    if stem.lower().endswith(".rules"):
        stem = stem[:-6]
    if (
        not stem
        or len(stem) > 100
        or stem.startswith(".")
        or Path(stem).name != stem
        or "/" in stem
        or "\\" in stem
        or any(character in stem for character in '<>:"|?*')
        or any(ord(character) < 32 for character in stem)
        or stem.endswith((" ", "."))
    ):
        raise HTTPException(status_code=400, detail="Enter a valid rules file name")

    filename = f"{stem}.rules"
    RULES_DIR.mkdir(parents=True, exist_ok=True)
    rule_path = RULES_DIR / filename
    try:
        with rule_path.open("x", encoding="utf-8"):
            pass
    except FileExistsError:
        raise HTTPException(status_code=409, detail="A rules file with that name already exists")

    return {"filename": filename}

@app.get("/rules/{filename}", response_class=PlainTextResponse)
def read_rule_file(filename: str):
    return resolve_data_file(RULES_DIR, filename).read_text(encoding="utf-8")

@app.put("/rules/{filename}")
async def update_rule_file(filename: str, request: Request):
    if Path(filename).suffix.lower() != ".rules":
        raise HTTPException(status_code=404, detail="File not found")
    rule_path = resolve_data_file(RULES_DIR, filename)
    data = await request.json()
    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="Invalid rules update")
    content = data.get("content")
    original_content = data.get("original_content")
    if not isinstance(content, str) or not isinstance(original_content, str):
        raise HTTPException(status_code=400, detail="Invalid rules update")

    with rule_path.open("r", encoding="utf-8", newline="") as rule_file:
        current_content = rule_file.read()
    normalized_current = current_content.replace("\r\n", "\n").replace("\r", "\n")
    if normalized_current != original_content:
        raise HTTPException(status_code=409, detail="Rules file changed; reload before editing")

    newline = "\r\n" if "\r\n" in current_content else "\n"
    updated_content = content.replace("\r\n", "\n").replace("\r", "\n").replace("\n", newline)
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", newline="", dir=rule_path.parent,
            delete=False,
        ) as temp_file:
            temp_path = Path(temp_file.name)
            temp_file.write(updated_content)
        os.replace(temp_path, rule_path)
    finally:
        if temp_path and temp_path.exists():
            temp_path.unlink()

    return {"success": True}

@app.get("/get-data-files")
def get_data_files():
    if DATA_DIR.exists():
        files = [path.name for path in DATA_DIR.iterdir() if path.is_file() and not path.name.startswith('.')]
        return {"data-files": files}
    return {"data-files": []}

@app.get("/data-files/{filename}", response_class=PlainTextResponse)
def read_data_file(filename: str):
    return resolve_data_file(DATA_DIR, filename).read_text(encoding="utf-8")

@app.post("/upload-data")
async def upload_data(file: UploadFile = File(...)):
    filename = file.filename
    if (
        not filename
        or Path(filename).name != filename
        or filename.startswith(".")
        or Path(filename).suffix.lower() != ".csv"
    ):
        raise HTTPException(status_code=400, detail="Choose a valid CSV file")

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    destination = DATA_DIR / filename
    try:
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="The selected CSV file is empty")
        with destination.open("xb") as destination_file:
            destination_file.write(contents)
    except FileExistsError:
        raise HTTPException(
            status_code=409,
            detail="A file with this name already exists in data. Select it from the existing data files or rename the upload.",
        )
    finally:
        await file.close()

    return {"success": True, "file": filename}

@app.post("/import")
async def import_data(
    file: str = Form(...),
    rule: str = Form(...),
    journal: str = Form("main.journal"),
    dry_run: bool = Form(False),
):
    if os.path.basename(journal) != journal or not journal.endswith(".journal"):
        return {"success": False, "message": "Invalid destination journal"}

    try:
        file_path = resolve_data_file(DATA_DIR, file)
        rule_path = resolve_data_file(RULES_DIR, rule)
    except HTTPException as error:
        return {"success": False, "message": error.detail}
    journal_path = str(JOURNAL_DIR / journal)

    with open(journal_path, "r", encoding="utf-8") as journal_file:
        journal_before_import = journal_file.read()
  
    cmd = ["hledger", "import", "-f", journal_path, str(file_path), "--rules", str(rule_path)]
    if dry_run:
        cmd.append("--dry-run")
    p = subprocess.run(cmd, capture_output=True, text=True, errors="replace")
    if p.returncode != 0:
        return {"success": False, "message": p.stderr}

    preview_transactions = []
    preview_error = None
    if dry_run and p.stdout.strip():
        preview = subprocess.run(
            ["hledger", "print", "-f", "-", "-O", "json"],
            input=p.stdout,
            capture_output=True,
            text=True,
            errors="replace",
        )
        if preview.returncode == 0:
            try:
                preview_transactions = json.loads(preview.stdout)
            except json.JSONDecodeError:
                preview_error = "The journal preview could not be parsed; use plain text output."
        else:
            preview_error = "The journal preview could not be parsed; use plain text output."

    import_comment = None
    if not dry_run:
        result = (p.stderr.strip() or p.stdout.strip() or "transactions imported")
        result = " ".join(result.split())
        timestamp = datetime.now().astimezone().isoformat(timespec="seconds")
        import_comment = (
            f"# Import completed {timestamp}: source={file}, rules={rule}, \n"
            f"# result={result}\n"
        )
        with open(journal_path, "r", encoding="utf-8") as journal_file:
            journal_after_import = journal_file.read()

        if journal_after_import.startswith(journal_before_import):
            imported_data = journal_after_import[len(journal_before_import):].lstrip("\r\n")
            journal_content = journal_before_import
            if journal_content and not journal_content.endswith("\n"):
                journal_content += "\n"
            journal_content += f"\n{import_comment}{imported_data}"
            with open(journal_path, "w", encoding="utf-8") as journal_file:
                journal_file.write(journal_content)

    return {
        "success": True,
        "file": file,
        "journal": journal,
        "output": p.stdout,
        "message": p.stderr,
        "comment": import_comment,
        "transactions": preview_transactions,
        "preview_error": preview_error,
    }

    
