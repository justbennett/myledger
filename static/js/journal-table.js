function renderJournalTableRow(tx, { formatAmount, renderAccount, onEdit } = {}) {
  const previewMode = document.body.dataset.page === "move-data";
  const postings = tx.postings || tx.tpostings || [];
  const firstPosting = postings[0];
  const account = firstPosting?.account || firstPosting?.paccount || null;
  const amount = firstPosting
    ? formatAmount(firstPosting.amount || firstPosting.pamount || [])
    : "";
  const description = tx.description ?? tx.tdescription ?? "";
  const comment = tx.comment ?? tx.tcomment ?? "";
  const otherPostings = postings.slice(1);
  const fragment = document.createDocumentFragment();
  const row = document.createElement("tr");
  row.classList.add("clickable-row");

  const values = [
    tx.date ?? tx.tdate ?? "",
    description,
  ];
  for (const value of values) {
    const cell = document.createElement("td");
    cell.textContent = value;
    row.appendChild(cell);
  }

  const accountCell = document.createElement("td");
  accountCell.append(renderAccount ? renderAccount(account) : document.createTextNode(account ?? "(unnamed)"));
  row.appendChild(accountCell);

  const amountCell = document.createElement("td");
  amountCell.className = "amount";
  amountCell.textContent = amount;
  row.appendChild(amountCell);

  if (!previewMode) {
    const actionsCell = document.createElement("td");
    actionsCell.className = "journal-row-actions";
    if (tx.edit && onEdit) {
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "journal-edit-button";
      editButton.textContent = "✎";
      editButton.title = "Edit transaction";
      editButton.setAttribute("aria-label", "Edit transaction");
      editButton.addEventListener("click", (event) => {
        event.stopPropagation();
        onEdit(tx.edit);
      });
      actionsCell.appendChild(editButton);
    }
    row.appendChild(actionsCell);
  }

  const detailRow = document.createElement("tr");
  detailRow.className = "journal-detail";
  detailRow.hidden = true;
  if (!previewMode) detailRow.appendChild(document.createElement("td"));

  const detailCell = document.createElement("td");
  detailCell.colSpan = 4;
  const details = document.createElement("div");
  details.className = "details-row";

  if (comment) {
    const commentElement = document.createElement("div");
    commentElement.className = "comment";
    commentElement.textContent = previewMode ? comment.trim() : comment;
    details.appendChild(commentElement);
  }

  const postingTable = document.createElement("table");
  postingTable.className = "journal-postings";
  for (const posting of otherPostings) {
    const postingRow = document.createElement("tr");
    const postingAccount = document.createElement("td");
    postingAccount.textContent = posting.account ?? posting.paccount ?? "";
    const postingAmount = document.createElement("td");
    postingAmount.className = "amount";
    postingAmount.textContent = formatAmount(posting.amount || posting.pamount || []);
    postingRow.append(postingAccount, postingAmount);
    postingTable.appendChild(postingRow);
  }
  details.appendChild(postingTable);
  detailCell.appendChild(details);
  detailRow.appendChild(detailCell);

  row.addEventListener("click", (event) => {
    if (event.target.closest(".filter-icon")) return;
    detailRow.hidden = !detailRow.hidden;
  });

  fragment.append(row, detailRow);
  return fragment;
}
