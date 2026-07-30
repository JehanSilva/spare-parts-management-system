import React, { forwardRef } from "react";
import Receipt from "./Receipt";
import Invoice from "./Invoice";
import { useSettings } from "../context/SettingsContext";

// Renders whichever sale document the billing method (Home → Options) selects.
// Drop-in for either component — same props, same forwarded ref, so printing
// and WhatsApp rasterisation work identically for both.
const BillingDocument = forwardRef((props, ref) => {
  const { isInvoice } = useSettings();
  const Document = isInvoice ? Invoice : Receipt;
  return <Document ref={ref} {...props} />;
});

export default BillingDocument;
