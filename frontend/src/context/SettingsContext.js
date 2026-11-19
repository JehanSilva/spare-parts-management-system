import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { fetchChequeBanks } from "../services/api";

// App-wide preferences that are per-device rather than per-account, kept in
// localStorage so a reload (or the auto-logout) doesn't reset them. Currently
// just the billing method: whether a completed sale is documented as an 80mm
// thermal RECEIPT or a full A4 INVOICE.
const STORAGE_KEY = "nss_billing_method";
export const BILLING_METHODS = { RECEIPT: "RECEIPT", INVOICE: "INVOICE" };

const SettingsContext = createContext(null);

export const SettingsProvider = ({ children }) => {
  const [billingMethod, setBillingMethodState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === BILLING_METHODS.INVOICE ? BILLING_METHODS.INVOICE : BILLING_METHODS.RECEIPT;
  });

  const setBillingMethod = useCallback((method) => {
    const next = method === BILLING_METHODS.INVOICE ? BILLING_METHODS.INVOICE : BILLING_METHODS.RECEIPT;
    setBillingMethodState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  // Bank accounts switched on for invoices (Options -> Bank Accounts). Shared
  // by everyone, so it comes from the server, not localStorage. null until
  // loaded; only fetched once logged in.
  const [invoiceAccounts, setInvoiceAccounts] = useState(null);
  const refreshInvoiceAccounts = useCallback(async () => {
    if (!localStorage.getItem("access_token")) return;
    try {
      const banks = await fetchChequeBanks();
      setInvoiceAccounts(banks.filter((b) => b.show_on_invoice));
    } catch {
      // Keep whatever was showing; the fallback covers a first load failing.
    }
  }, []);
  useEffect(() => {
    refreshInvoiceAccounts();
    window.addEventListener("focus", refreshInvoiceAccounts);
    return () => window.removeEventListener("focus", refreshInvoiceAccounts);
  }, [refreshInvoiceAccounts]);

  // Keep other open tabs in sync — the POS is often open alongside the
  // dashboard where the setting is changed.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY && e.newValue) setBillingMethodState(e.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <SettingsContext.Provider
      value={{
        billingMethod,
        setBillingMethod,
        invoiceAccounts,
        refreshInvoiceAccounts,
        isInvoice: billingMethod === BILLING_METHODS.INVOICE,
        // "Invoice" / "Receipt" — for buttons, filenames and messages that
        // should name whatever document the sale actually produces.
        documentLabel: billingMethod === BILLING_METHODS.INVOICE ? "Invoice" : "Receipt",
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within a SettingsProvider");
  return ctx;
};
