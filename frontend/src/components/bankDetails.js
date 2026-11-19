// The "pay to" bank details printed on invoices and on estimates that ask for
// payment. Which accounts appear is chosen in Options -> Bank Accounts
// ("Show on invoices"); see SettingsContext. BANK_DETAILS is only a fallback
// for the moment before those accounts have loaded.
export const BANK_DETAILS = [
  ["Bank", "Commercial Bank"],
  ["Branch", "Ja-ela"],
  ["Account Name", "NSS Auto Engineers"],
  ["Account No.", "1000956014"],
];

// A bank account from the API as [label, value] rows, blanks left out.
export const accountRows = (account) =>
  [
    ["Bank", account.name],
    ["Branch", account.branch],
    ["Account Name", account.account_name],
    ["Account No.", account.account_number],
  ].filter(([, value]) => value);

// The accounts to print, each as rows: the chosen ones once loaded (possibly
// none), the fallback until then.
export const invoiceBankRows = (invoiceAccounts) =>
  invoiceAccounts == null ? [BANK_DETAILS] : invoiceAccounts.map(accountRows).filter((rows) => rows.length);
