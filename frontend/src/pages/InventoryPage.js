import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  Search,
  Plus,
  AlertTriangle,
  Package,
  MapPin,
  Edit2,
  Trash2,
  Car,
  XCircle,
  Download,
} from "lucide-react";
import {
  deletePart,
  createPart,
  updatePart,
  fetchSuppliers,
  bulkUploadParts,
  resolveBulkUploadConflicts,
  cancelBulkUpload,
} from "../services/api";
import { useParts } from "../context/PartsContext";
import AddPartForm from "../components/forms/AddPartForm";
import QuickRestockModal from "../components/forms/QuickRestockModal";
import AlertComponent from "../components/AlertComponent";
import ConfirmModal from "../components/ConfirmModal";
import PartDetailsModal from "../components/PartDetailsModal";
import bulkUploadTemplate from "../assets/template/bulk upload template.xlsx";

// --- SIMPLE REORDER LIST PDF (for out-of-stock — send to suppliers) ---
const generateReorderListPDF = (parts, supplierName) => {
  const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Reorder List - NSS Auto Spares</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 11pt; padding: 40px; }
        
        .header { text-align: center; border-bottom: 3px solid #b91c1c; padding-bottom: 16px; margin-bottom: 24px; }
        .header h1 { font-size: 22pt; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px; }
        .header h2 { font-size: 14pt; font-weight: 700; color: #444; margin-bottom: 6px; }
        .header p { font-size: 10pt; color: #666; }
        
        .info { margin-bottom: 20px; font-size: 10pt; color: #555; }
        .info strong { color: #111; }
        
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        thead th { background: #f3f4f6; font-size: 9pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #374151; padding: 12px 12px; border-bottom: 2px solid #9ca3af; text-align: left; }
        thead th.c { text-align: center; }
        
        tbody td { padding: 11px 12px; border-bottom: 1px solid #e5e7eb; font-size: 10.5pt; vertical-align: middle; }
        tbody tr:nth-child(even) { background: #fafafa; }
        tbody td.c { text-align: center; }
        
        .part-name { font-weight: 700; color: #111; }
        .part-number { font-family: monospace; color: #374151; font-size: 10pt; }
        .row-num { color: #9ca3af; font-weight: 600; }
        
        tfoot td { border-top: 2px solid #374151; font-weight: 800; padding: 12px; font-size: 10pt; }
        
        .footer { margin-top: 30px; text-align: center; font-size: 8pt; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 12px; }
        
        @media print {
          body { padding: 0; }
          @page { size: A4 portrait; margin: 15mm; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>NSS Auto Spares</h1>
        <h2>Items to Reorder</h2>
        <p>${dateStr}</p>
      </div>

      <div class="info">
        ${supplierName ? `<strong>Supplier:</strong> ${supplierName} &nbsp;&bull;&nbsp;` : ''}
        <strong>Total items to reorder:</strong> ${parts.length}
      </div>

      <table>
        <thead>
          <tr>
            <th class="c" style="width: 8%">#</th>
            <th style="width: 55%">Part Name</th>
            <th style="width: 37%">Part Number</th>
          </tr>
        </thead>
        <tbody>
          ${parts.map((part, idx) => `
            <tr>
              <td class="c row-num">${idx + 1}</td>
              <td class="part-name">${part.name}</td>
              <td class="part-number">${part.part_number}</td>
            </tr>
          `).join("")}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" style="text-align: center;">Total: ${parts.length} items</td>
          </tr>
        </tfoot>
      </table>

      <div class="footer">
        Generated on ${new Date().toLocaleString()} &bull; NSS Auto Spares
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open("", "_blank");
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.onload = () => { printWindow.print(); };
};

// --- DETAILED STOCK REPORT PDF (for low stock — internal use) ---
const generateStockReportPDF = (parts, supplierName) => {
  const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const formatLKR = (amount) => `LKR ${parseFloat(amount || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const totalBuyValue = parts.reduce((sum, p) => sum + (parseFloat(p.buy_price) * p.stock_qty), 0);
  const totalSellValue = parts.reduce((sum, p) => sum + (parseFloat(p.sell_price) * p.stock_qty), 0);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Low Stock Report - NSS Auto Spares</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 11pt; padding: 30px; }
        
        .header { text-align: center; border-bottom: 3px solid #b91c1c; padding-bottom: 16px; margin-bottom: 20px; }
        .header h1 { font-size: 22pt; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px; }
        .header h2 { font-size: 14pt; font-weight: 700; color: #444; margin-bottom: 6px; }
        .header p { font-size: 10pt; color: #666; }
        
        .summary-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding: 12px 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; }
        .summary-item { text-align: center; }
        .summary-item .label { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; margin-bottom: 2px; }
        .summary-item .value { font-size: 14pt; font-weight: 900; color: #111; }
        
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        thead th { background: #f3f4f6; font-size: 8pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #374151; padding: 10px 8px; border-bottom: 2px solid #9ca3af; text-align: left; }
        thead th.r { text-align: right; }
        thead th.c { text-align: center; }
        
        tbody td { padding: 10px 8px; border-bottom: 1px solid #e5e7eb; font-size: 10pt; vertical-align: middle; }
        tbody tr:nth-child(even) { background: #fafafa; }
        tbody td.r { text-align: right; }
        tbody td.c { text-align: center; }
        
        .part-name { font-weight: 700; font-size: 10pt; color: #111; }
        .part-number { font-size: 8pt; color: #6b7280; font-family: monospace; }
        .stock-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 8pt; font-weight: 700; }
        .stock-low { background: #fff7ed; color: #ea580c; border: 1px solid #fed7aa; }
        
        tfoot td { border-top: 2px solid #374151; font-weight: 800; padding: 10px 8px; font-size: 10pt; }
        
        .footer { margin-top: 24px; text-align: center; font-size: 8pt; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 12px; }
        
        @media print {
          body { padding: 0; }
          @page { size: A4 landscape; margin: 10mm; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>NSS Auto Spares</h1>
        <h2>Low Stock Items Report</h2>
        <p>${dateStr}${supplierName ? ` &bull; Supplier: ${supplierName}` : ' &bull; All Suppliers'}</p>
      </div>

      <div class="summary-row">
        <div class="summary-item">
          <div class="label">Total Items</div>
          <div class="value">${parts.length}</div>
        </div>
        <div class="summary-item">
          <div class="label">Total Stock Qty</div>
          <div class="value">${parts.reduce((sum, p) => sum + p.stock_qty, 0)}</div>
        </div>
        <div class="summary-item">
          <div class="label">Total Buy Value</div>
          <div class="value">${formatLKR(totalBuyValue)}</div>
        </div>
        <div class="summary-item">
          <div class="label">Total Sell Value</div>
          <div class="value">${formatLKR(totalSellValue)}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 5%">#</th>
            <th style="width: 25%">Part Name</th>
            <th style="width: 12%">Part No.</th>
            <th style="width: 10%">Brand</th>
            <th style="width: 12%">Supplier</th>
            <th style="width: 8%">Location</th>
            <th class="c" style="width: 7%">Stock</th>
            <th class="r" style="width: 10%">Buy Price</th>
            <th class="r" style="width: 11%">Sell Price</th>
          </tr>
        </thead>
        <tbody>
          ${parts.map((part, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td><div class="part-name">${part.name}</div></td>
              <td><span class="part-number">${part.part_number}</span></td>
              <td>${part.brand || "-"}</td>
              <td>${part.supplier_details?.name || "N/A"}</td>
              <td>${part.rack_location || "-"}</td>
              <td class="c"><span class="stock-badge stock-low">${part.stock_qty}</span></td>
              <td class="r">${formatLKR(part.buy_price)}</td>
              <td class="r">${formatLKR(part.sell_price)}</td>
            </tr>
          `).join("")}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="6" style="text-align: right;">TOTALS</td>
            <td class="c">${parts.reduce((sum, p) => sum + p.stock_qty, 0)}</td>
            <td class="r">${formatLKR(totalBuyValue)}</td>
            <td class="r">${formatLKR(totalSellValue)}</td>
          </tr>
        </tfoot>
      </table>

      <div class="footer">
        Generated on ${new Date().toLocaleString()} &bull; NSS Auto Spares Management System
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open("", "_blank");
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.onload = () => { printWindow.print(); };
};

// --- Bulk Upload Conflict Resolution Modal ---
// One field per conflicting part: let the user keep the existing value, take
// the new value from the Excel sheet, or type a custom value instead.

// Normalizes a vehicle display string for comparison/dedup — collapses any
// run of whitespace to a single space and lowercases, so cosmetic differences
// (extra spaces, casing) between an existing catalog entry and a freshly
// Excel-parsed one don't get treated as a real conflict/duplicate.
const normalizeVehicleName = (v) => String(v).replace(/\s+/g, " ").trim().toLowerCase();

const CONFLICT_FIELDS = [
  { key: "name", label: "Part Name" },
  { key: "brand", label: "Brand" },
  { key: "supplier", label: "Supplier" },
  {
    key: "buy_price",
    label: "Cost Price (LKR)",
    numeric: true,
    alwaysShow: true,
    // Weighted-average cost across the existing stock and the incoming Excel quantity,
    // same formula as the single-part Quick Restock preview.
    combined: (c) => {
      const existingQty = Number(c.existing.stock_qty) || 0;
      const newQty = Number(c.new.stock_qty) || 0;
      const existingPrice = Number(c.existing.buy_price) || 0;
      const newPrice = Number(c.new.buy_price) || 0;
      const totalQty = existingQty + newQty;
      if (totalQty <= 0) return existingPrice;
      return Math.round(((existingQty * existingPrice + newQty * newPrice) / totalQty) * 100) / 100;
    },
  },
  { key: "sell_price", label: "Selling Price (LKR)", numeric: true, alwaysShow: true },
  {
    key: "stock_qty",
    label: "Stock Quantity",
    numeric: true,
    alwaysShow: true,
    combined: (c) => (Number(c.existing.stock_qty) || 0) + (Number(c.new.stock_qty) || 0),
  },
  { key: "rack_location", label: "Rack / Bin Location" },
  {
    key: "compatible_vehicles",
    label: "Fits Vehicles",
    isList: true,
    // Union of existing + Excel vehicles, de-duplicated (whitespace/case-insensitive).
    combined: (c) => {
      const existingList = Array.isArray(c.existing.compatible_vehicles) ? c.existing.compatible_vehicles : [];
      const newList = Array.isArray(c.new.compatible_vehicles) ? c.new.compatible_vehicles : [];
      const seen = new Set();
      const result = [];
      [...existingList, ...newList].forEach((v) => {
        const key = normalizeVehicleName(v);
        if (key && !seen.has(key)) {
          seen.add(key);
          result.push(String(v).replace(/\s+/g, " ").trim());
        }
      });
      return result;
    },
  },
];

const formatConflictFieldValue = (field, value) => {
  if (field.isList) return Array.isArray(value) ? value.join(", ") : "";
  if (value === null || value === undefined) return "";
  return String(value);
};

const buildInitialResolutions = (conflicts) => {
  const initial = {};
  conflicts.forEach((c) => {
    const fields = {};
    CONFLICT_FIELDS.forEach((f) => {
      // Skip fields the sheet didn't provide at all (e.g. no "Fits Vehicles" column)
      if (f.isList && c.new.compatible_vehicles === null) return;
      fields[f.key] = { choice: "existing", value: formatConflictFieldValue(f, c.existing[f.key]) };
    });
    initial[c.part_number] = fields;
  });
  return initial;
};

const BulkUploadInvoiceModal = ({ fileName, onCancel, onConfirm, isUploading }) => {
  const [invoiceNumber, setInvoiceNumber] = useState("");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-red-700 px-5 py-4 text-white flex items-center justify-between">
          <h3 className="font-bold text-lg">Confirm Import</h3>
          <button onClick={onCancel} className="hover:bg-red-600 p-1 rounded-full transition-colors">
            <XCircle size={20} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-gray-600">
            Importing <span className="font-mono font-semibold text-gray-800">{fileName}</span>.
            Optionally attach an invoice number to this restock batch.
          </p>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Invoice Number <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              autoFocus
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="e.g. Invoice #123"
              className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(invoiceNumber.trim())}
            disabled={isUploading}
            className="px-5 py-2 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {isUploading ? "Uploading..." : "Confirm & Upload"}
          </button>
        </div>
      </div>
    </div>
  );
};

const BulkUploadConflictModal = ({ conflicts, onClose, onSubmit, isSubmitting, onCancelUpload, isCancelling }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [resolutions, setResolutions] = useState(() => buildInitialResolutions(conflicts));

  const total = conflicts.length;
  const current = conflicts[stepIndex];
  const currentFields = resolutions[current.part_number] || {};

  const setChoice = (fieldKey, choice) => {
    const fieldConfig = CONFLICT_FIELDS.find((f) => f.key === fieldKey);
    let value;
    if (choice === "existing") value = formatConflictFieldValue(fieldConfig, current.existing[fieldKey]);
    else if (choice === "new") value = formatConflictFieldValue(fieldConfig, current.new[fieldKey]);
    else if (choice === "combined") value = formatConflictFieldValue(fieldConfig, fieldConfig.combined(current));
    else value = currentFields[fieldKey]?.value || "";

    setResolutions((prev) => ({
      ...prev,
      [current.part_number]: {
        ...prev[current.part_number],
        [fieldKey]: { choice, value },
      },
    }));
  };

  const setCustomValue = (fieldKey, value) => {
    setResolutions((prev) => ({
      ...prev,
      [current.part_number]: {
        ...prev[current.part_number],
        [fieldKey]: { choice: "custom", value },
      },
    }));
  };

  const handleFinish = () => {
    const payload = conflicts.map((c) => {
      const fields = resolutions[c.part_number];
      const result = { part_number: c.part_number };
      CONFLICT_FIELDS.forEach((f) => {
        const fieldState = fields[f.key];
        if (!fieldState) return;
        if (f.isList) {
          result[f.key] = fieldState.value
            .split(/[,;]+/)
            .map((s) => s.trim())
            .filter(Boolean);
        } else if (f.numeric) {
          result[f.key] = parseFloat(fieldState.value) || 0;
        } else {
          result[f.key] = fieldState.value;
        }
      });
      return result;
    });
    onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-scale-in">
        <div className="bg-red-700 p-4 text-white flex justify-between items-center shrink-0">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              <AlertTriangle size={20} /> Resolve Duplicate Part
            </h3>
            <p className="text-red-100 text-sm">
              Part {stepIndex + 1} of {total} — Part Number:{" "}
              <span className="font-mono">{current.part_number}</span>
            </p>
          </div>
          <button onClick={onClose} disabled={isCancelling} className="hover:bg-red-600 p-1 rounded-full disabled:opacity-50">
            <XCircle size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {CONFLICT_FIELDS.map((f) => {
            const fieldState = currentFields[f.key];
            if (!fieldState) return null;
            const existingVal = formatConflictFieldValue(f, current.existing[f.key]);
            const newVal = formatConflictFieldValue(f, current.new[f.key]);
            const same = f.isList
              ? (() => {
                  const a = (Array.isArray(current.existing[f.key]) ? current.existing[f.key] : [])
                    .map(normalizeVehicleName)
                    .filter(Boolean)
                    .sort();
                  const b = (Array.isArray(current.new[f.key]) ? current.new[f.key] : [])
                    .map(normalizeVehicleName)
                    .filter(Boolean)
                    .sort();
                  return a.length === b.length && a.every((v, i) => v === b[i]);
                })()
              : existingVal === newVal;
            const showChooser = f.alwaysShow || !same;

            if (!showChooser) {
              // No conflict on this field (and it's not one of the always-show fields) —
              // just display it for context, no choice needed.
              return (
                <div key={f.key} className="border border-gray-100 rounded-xl p-3 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-500 text-sm">{f.label}</span>
                    <span className="text-xs text-gray-400">(no conflict)</span>
                  </div>
                  <div className="text-sm text-gray-700 mt-1 truncate">
                    {existingVal || <span className="italic text-gray-400">empty</span>}
                  </div>
                </div>
              );
            }

            return (
              <div key={f.key} className="border border-gray-200 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-700 text-sm">{f.label}</span>
                  {same && <span className="text-xs text-gray-400">(same value)</span>}
                </div>
                <div className={`grid grid-cols-1 ${f.combined ? "sm:grid-cols-2 md:grid-cols-4" : "sm:grid-cols-3"} gap-2`}>
                  <button
                    type="button"
                    onClick={() => setChoice(f.key, "existing")}
                    className={`text-left px-3 py-2 rounded-lg border text-sm ${
                      fieldState.choice === "existing"
                        ? "border-red-600 bg-red-50 text-red-800"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <div className="text-xs uppercase text-gray-400 mb-0.5">
                      Existing
                      {f.isList && ` (${Array.isArray(current.existing[f.key]) ? current.existing[f.key].length : 0})`}
                    </div>
                    <div className="truncate">
                      {existingVal || <span className="italic text-gray-400">empty</span>}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setChoice(f.key, "new")}
                    className={`text-left px-3 py-2 rounded-lg border text-sm ${
                      fieldState.choice === "new"
                        ? "border-red-600 bg-red-50 text-red-800"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <div className="text-xs uppercase text-gray-400 mb-0.5">
                      From Excel
                      {f.isList && ` (${Array.isArray(current.new[f.key]) ? current.new[f.key].length : 0})`}
                    </div>
                    <div className="truncate">
                      {newVal || <span className="italic text-gray-400">empty</span>}
                    </div>
                  </button>
                  {f.combined && (
                    <button
                      type="button"
                      onClick={() => setChoice(f.key, "combined")}
                      className={`text-left px-3 py-2 rounded-lg border text-sm ${
                        fieldState.choice === "combined"
                          ? "border-red-600 bg-red-50 text-red-800"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <div className="text-xs uppercase text-gray-400 mb-0.5">
                        Combined
                        {f.isList && ` (${f.combined(current).length})`}
                      </div>
                      <div className="truncate">
                        {formatConflictFieldValue(f, f.combined(current)) || (
                          <span className="italic text-gray-400">empty</span>
                        )}
                      </div>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setChoice(f.key, "custom")}
                    className={`text-left px-3 py-2 rounded-lg border text-sm ${
                      fieldState.choice === "custom"
                        ? "border-red-600 bg-red-50 text-red-800"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <div className="text-xs uppercase text-gray-400 mb-0.5">Custom</div>
                    <div className="truncate">
                      {fieldState.choice === "custom" ? fieldState.value || "Type below" : "Enter your own"}
                    </div>
                  </button>
                </div>
                {fieldState.choice === "custom" && (
                  <input
                    autoFocus
                    value={fieldState.value}
                    onChange={(e) => setCustomValue(f.key, e.target.value)}
                    className="w-full mt-2 p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none"
                    placeholder={
                      f.isList ? "e.g. Toyota Corolla 2015, Honda Civic 2018" : `Enter ${f.label.toLowerCase()}`
                    }
                    type={f.numeric ? "number" : "text"}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-gray-100 flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={onCancelUpload}
              disabled={isCancelling}
              title="Delete the newly-created parts from this file and drop all pending conflicts — nothing from this upload will be kept."
              className="px-4 py-2 rounded-lg border border-red-300 text-red-600 font-semibold hover:bg-red-50 disabled:opacity-50"
            >
              {isCancelling ? "Cancelling..." : "Cancel Entire Upload"}
            </button>
            <button
              onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
              disabled={stepIndex === 0}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 font-semibold disabled:opacity-40"
            >
              Back
            </button>
          </div>
          {stepIndex < total - 1 ? (
            <button
              onClick={() => setStepIndex((i) => Math.min(total - 1, i + 1))}
              className="px-5 py-2 rounded-lg bg-red-700 text-white font-bold hover:bg-red-800"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700 disabled:opacity-50"
            >
              {isSubmitting ? "Applying..." : `Apply to All ${total} Part(s)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const InventoryPage = () => {
  // ── Cache ────────────────────────────────────────────────────────────────
  const { allParts, partsLoading: loading, invalidateParts } = useParts();

  const [showForm, setShowForm] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [uploadConflicts, setUploadConflicts] = useState([]);
  const [uploadCreatedCount, setUploadCreatedCount] = useState(0);
  const [isResolvingConflicts, setIsResolvingConflicts] = useState(false);
  const [pendingUploadFile, setPendingUploadFile] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [bulkInvoiceNumber, setBulkInvoiceNumber] = useState("");
  const [pendingCreatedPartIds, setPendingCreatedPartIds] = useState([]);
  const [isCancellingUpload, setIsCancellingUpload] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockInitialPart, setRestockInitialPart] = useState(null);

  // ── Filter States ────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [suppliers, setSuppliers] = useState([]);

  const [stockFilter, setStockFilter] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("filter") || "all";
  });

  const [lowStockThreshold, setLowStockThreshold] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const val = parseInt(params.get("low_stock_threshold"), 10);
    return isNaN(val) ? 2 : val;
  });

  // Sort order — defaults to most-sold-first
  const [sortBy, setSortBy] = useState("most_sold");

  // ── Alert & Modal States ─────────────────────────────────────────────────
  const [alertInfo, setAlertInfo] = useState({ type: "", message: "" });
  const [deleteId, setDeleteId] = useState(null);
  const [selectedPart, setSelectedPart] = useState(null);
  const pressTimer = useRef(null);

  const startPress = (part) => {
    pressTimer.current = setTimeout(() => {
      setSelectedPart(part);
    }, 500);
  };

  const endPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  // ── Load suppliers once (small list, no need to cache) ──────────────────
  useEffect(() => {
    fetchSuppliers()
      .then(setSuppliers)
      .catch((err) => console.error("Failed to load suppliers", err));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Client-side filtering — instant, zero network calls ──────────────────
  const parts = useMemo(() => {
    let result = allParts;

    // Text search: name, part_number, brand, compatible vehicles, description
    if (searchTerm.trim()) {
      const keywords = searchTerm.trim().toLowerCase().split(/\s+/);
      result = result.filter((p) =>
        keywords.every((keyword) =>
          p.name?.toLowerCase().includes(keyword) ||
          p.part_number?.toLowerCase().includes(keyword) ||
          p.description?.toLowerCase().includes(keyword) ||
          p.brand?.toLowerCase().includes(keyword) ||
          p.compatible_vehicles?.some(
            (v) =>
              typeof v === "object" &&
              (
                (v.make?.toLowerCase() || "").includes(keyword) ||
                (v.model?.toLowerCase() || "").includes(keyword) ||
                String(v.year || "").includes(keyword)
              )
          )
        )
      );
    }

    // Brand filter
    if (selectedBrand.trim()) {
      const b = selectedBrand.trim().toLowerCase();
      result = result.filter((p) => p.brand?.toLowerCase().includes(b));
    }

    // Supplier filter
    if (selectedSupplier) {
      result = result.filter(
        (p) => String(p.supplier) === String(selectedSupplier)
      );
    }

    // Stock status filters
    if (stockFilter === "out") {
      result = result.filter((p) => p.stock_qty === 0);
    } else if (stockFilter === "low") {
      const threshold = parseInt(lowStockThreshold, 10);
      result = result.filter(
        (p) => p.stock_qty > 0 && p.stock_qty <= (isNaN(threshold) ? 2 : threshold)
      );
    } else if (stockFilter === "no_price") {
      result = result.filter(
        (p) =>
          !p.buy_price ||
          parseFloat(p.buy_price) <= 0 ||
          !p.sell_price ||
          parseFloat(p.sell_price) <= 0 ||
          !p.image
      );
    }

    // Sorting — applied last, always on a copy so allParts is never mutated
    const num = (v) => {
      const n = parseFloat(v);
      return isNaN(n) ? 0 : n;
    };
    if (sortBy === "most_sold") {
      result = [...result].sort((a, b) => num(b.total_sold) - num(a.total_sold));
    } else if (sortBy === "least_sold") {
      result = [...result].sort((a, b) => num(a.total_sold) - num(b.total_sold));
    } else if (sortBy === "price_high") {
      result = [...result].sort((a, b) => num(b.sell_price) - num(a.sell_price));
    } else if (sortBy === "price_low") {
      result = [...result].sort((a, b) => num(a.sell_price) - num(b.sell_price));
    }

    return result;
  }, [allParts, searchTerm, selectedBrand, selectedSupplier, stockFilter, lowStockThreshold, sortBy]);

  // ── Filter handlers — just update state, useMemo does the rest ───────────
  const handleStockFilter = (filter) => setStockFilter(filter);

  const handleSupplierChange = (supplierId) => setSelectedSupplier(supplierId);

  const handleThresholdChange = (val) => setLowStockThreshold(val);

  const handleClearFilters = () => {
    setSearchTerm("");
    setSelectedBrand("");
    setSelectedSupplier("");
    setStockFilter("all");
    setLowStockThreshold(2);
    setSortBy("most_sold");
  };

  const handleDownloadReport = () => {
    if (parts.length === 0) {
      setAlertInfo({ type: "error", message: "No items to download." });
      return;
    }
    const supplierName = selectedSupplier
      ? suppliers.find(s => String(s.id) === String(selectedSupplier))?.name || ""
      : "";
    // Simple reorder list — just part name & part number
    generateReorderListPDF(parts, supplierName);
  };

  const handleEdit = (part) => {
    setEditingPart(part);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleFileSelected = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setPendingUploadFile(file);
    setShowInvoiceModal(true);
  };

  const handleConfirmedUpload = async (file, invoiceNumber) => {
    setIsUploading(true);
    setBulkInvoiceNumber(invoiceNumber);
    setAlertInfo({ type: "info", message: "Uploading and processing Excel file... Please wait." });

    try {
      const response = await bulkUploadParts(file, invoiceNumber);
      if (response.conflicts && response.conflicts.length > 0) {
        setUploadConflicts(response.conflicts);
        setUploadCreatedCount(response.created || 0);
        setPendingCreatedPartIds(response.created_part_ids || []);
        setAlertInfo({
          type: "info",
          message: `Created ${response.created} new part(s). ${response.conflicts.length} part(s) already exist — resolve them below.`,
        });
      } else {
        setAlertInfo({ type: "success", message: response.message || "Excel file processed successfully!" });
      }
      invalidateParts();
    } catch (error) {
      console.error("Upload Error:", error);
      const errorMsg = error.response?.data?.error || "Failed to upload file.";
      setAlertInfo({ type: "error", message: errorMsg });
    } finally {
      setIsUploading(false);
      setShowInvoiceModal(false);
      setPendingUploadFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleResolveConflicts = async (resolutions) => {
    setIsResolvingConflicts(true);
    try {
      const response = await resolveBulkUploadConflicts(resolutions, bulkInvoiceNumber);
      const createdMsg = uploadCreatedCount > 0 ? `Added ${uploadCreatedCount} new part(s) and updated` : "Updated";
      const updatedCount = response.updated ?? resolutions.length;
      setAlertInfo({ type: "success", message: `${createdMsg} ${updatedCount} existing part(s).` });
      invalidateParts();
      setUploadConflicts([]);
      setUploadCreatedCount(0);
      setBulkInvoiceNumber("");
      setPendingCreatedPartIds([]);
    } catch (error) {
      console.error("Resolve Conflicts Error:", error);
      const errorMsg = error.response?.data?.error || "Failed to update parts.";
      setAlertInfo({ type: "error", message: errorMsg });
    } finally {
      setIsResolvingConflicts(false);
    }
  };

  const handleCancelBulkUpload = async () => {
    setIsCancellingUpload(true);
    try {
      await cancelBulkUpload(pendingCreatedPartIds);
      setAlertInfo({ type: "info", message: "Upload cancelled — no changes were kept." });
      invalidateParts();
    } catch (error) {
      console.error("Cancel Upload Error:", error);
      const errorMsg = error.response?.data?.error || "Failed to cancel upload.";
      setAlertInfo({ type: "error", message: errorMsg });
    } finally {
      setIsCancellingUpload(false);
      setUploadConflicts([]);
      setUploadCreatedCount(0);
      setBulkInvoiceNumber("");
      setPendingCreatedPartIds([]);
    }
  };

  // Step A: Trigger Delete Modal
  const confirmDelete = (id) => {
    setDeleteId(id);
  };

  // Step B: Execute Delete
  const executeDelete = async () => {
    if (!deleteId) return;
    try {
      await deletePart(deleteId);
      setAlertInfo({ type: "success", message: "Part deleted successfully!" });
      invalidateParts();
    } catch (error) {
      setAlertInfo({
        type: "error",
        message: "Failed to delete part. It may be linked to past sales.",
      });
    } finally {
      setDeleteId(null);
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingPart(null);
  };

  const handleFormSubmit = async (formData) => {
    setAlertInfo({ type: "", message: "" });
    try {
      if (editingPart) {
        await updatePart(editingPart.id, formData);
        setAlertInfo({ type: "success", message: "Part Updated Successfully!" });
      } else {
        const response = await createPart(formData);
        if (response.message) {
          setAlertInfo({ type: "success", message: response.message });
        } else {
          setAlertInfo({ type: "success", message: "New Part Added Successfully!" });
        }
      }
      invalidateParts();
      handleFormClose();
    } catch (error) {
      console.error("Save Error:", error);
      if (error.response && error.response.data) {
        const errorData = error.response.data;
        const errorMessages = Object.values(errorData).flat().join("\n");
        setAlertInfo({ type: "error", message: `Failed to save:\n${errorMessages}` });
      } else {
        setAlertInfo({ type: "error", message: "Network error. Please check connection." });
      }
    }
  };

  // Helper to render vehicle name safely from Object or ID
  const renderVehicleName = (v) => {
    if (typeof v === "object" && v !== null) {
      return `${v.make} ${v.model}`;
    }
    return "Vehicle";
  };

  // Determine if download button should show
  const showDownloadButton = stockFilter === "low" || stockFilter === "out" || stockFilter === "no_price";

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gray-50 relative">
      {/* --- DETAILS MODAL --- */}
      <PartDetailsModal
        part={selectedPart}
        onClose={() => setSelectedPart(null)}
        onPartUpdated={invalidateParts}
        onRestock={(part) => {
          setSelectedPart(null);
          setRestockInitialPart(part);
          setShowRestockModal(true);
        }}
      />

      {/* --- QUICK RESTOCK MODAL --- */}
      {showRestockModal && (
        <QuickRestockModal
          initialPart={restockInitialPart}
          onClose={() => { setShowRestockModal(false); setRestockInitialPart(null); }}
          onSuccess={(msg) => {
            setAlertInfo({ type: "success", message: msg });
            invalidateParts();
          }}
        />
      )}

      {/* --- BULK UPLOAD INVOICE CONFIRM MODAL --- */}
      {showInvoiceModal && pendingUploadFile && (
        <BulkUploadInvoiceModal
          fileName={pendingUploadFile.name}
          isUploading={isUploading}
          onCancel={() => {
            setShowInvoiceModal(false);
            setPendingUploadFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
          onConfirm={(invoiceNumber) => handleConfirmedUpload(pendingUploadFile, invoiceNumber)}
        />
      )}

      {/* --- BULK UPLOAD CONFLICT RESOLUTION MODAL --- */}
      {uploadConflicts.length > 0 && (
        <BulkUploadConflictModal
          conflicts={uploadConflicts}
          isSubmitting={isResolvingConflicts}
          onClose={() => { setUploadConflicts([]); setUploadCreatedCount(0); setBulkInvoiceNumber(""); setPendingCreatedPartIds([]); }}
          onSubmit={handleResolveConflicts}
          onCancelUpload={handleCancelBulkUpload}
          isCancelling={isCancellingUpload}
        />
      )}

      {/* --- CONFIRM MODAL --- */}
      <ConfirmModal
        isOpen={!!deleteId}
        title="Delete Part?"
        message="Are you sure you want to delete this part? This cannot be undone."
        onConfirm={executeDelete}
        onCancel={() => setDeleteId(null)}
      />

      {/* --- TOAST ALERT --- */}
      {alertInfo.message && (
        <AlertComponent
          type={alertInfo.type}
          message={alertInfo.message}
          onClose={() => setAlertInfo({ type: "", message: "" })}
        />
      )}

      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-red-900 flex items-center gap-2">
            <Package className="w-8 h-8" /> Inventory Management
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            Manage spare parts, stock levels, and prices.
          </p>
        </div>
        <div className="flex flex-col md:flex-row w-full md:w-auto gap-2">
          <input
            type="file"
            accept=".xlsx, .xls"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileSelected}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full md:w-auto px-4 py-2 rounded-lg shadow transition flex items-center justify-center gap-2 font-bold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
          >
            <Download size={20} className="rotate-180" />
            {isUploading ? "Uploading..." : "Import Excel"}
          </button>
          <a
            href={bulkUploadTemplate}
            download="bulk upload template.xlsx"
            title="Download Template"
            aria-label="Download Template"
            className="p-2 rounded-lg shadow transition flex items-center justify-center text-white bg-gray-600 hover:bg-gray-700 shrink-0"
          >
            <Download size={20} />
          </a>
          <button
            onClick={() => setShowRestockModal(true)}
            className="w-full md:w-auto px-4 py-2 rounded-lg shadow transition flex items-center justify-center gap-2 font-bold text-white bg-blue-600 hover:bg-blue-700"
          >
            <Package size={20} />
            Quick Restock
          </button>
          <button
            onClick={() => {
              if (showForm) handleFormClose();
              else setShowForm(true);
            }}
            className={`w-full md:w-auto px-6 py-2 rounded-lg shadow transition flex items-center justify-center gap-2 font-bold text-white ${
              showForm
                ? "bg-gray-500 hover:bg-gray-600"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            <Plus
              size={20}
              className={
                showForm
                  ? "rotate-45 transition-transform"
                  : "transition-transform"
              }
            />
            {showForm ? "Close Form" : "Add New Part"}
          </button>
        </div>
      </div>

      {/* Add/Edit Part Form */}
      {showForm && (
        <AddPartForm
          onSubmit={handleFormSubmit}
          onCancel={handleFormClose}
          editingPart={editingPart}
        />
      )}

      {/* Search & Filter Bar */}
      <div className="bg-white px-4 py-3 rounded-lg shadow-sm border border-gray-200 mb-4 flex flex-col md:flex-row gap-2 items-stretch md:items-center">
        {/* Search — clear button lives inside the input */}
        <div className="relative flex-[2] min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
          <input
            type="text"
            placeholder="Search by Name, Vehicle Model, Brand, or Part No..."
            className={`w-full h-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none text-sm pl-9 ${searchTerm ? "pr-8" : "pr-3"}`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {(searchTerm || selectedBrand || selectedSupplier || stockFilter !== "all" || sortBy !== "most_sold") && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors"
              title="Clear all filters"
            >
              <XCircle size={17} />
            </button>
          )}
        </div>

        {/* Brand */}
        <div className="flex-1 min-w-0">
          <input
            type="text"
            placeholder="Filter by Brand"
            className="w-full h-10 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none text-sm"
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
          />
        </div>

        {/* Supplier */}
        <div className="flex-1 min-w-0">
          <select
            value={selectedSupplier}
            onChange={(e) => handleSupplierChange(e.target.value)}
            className="w-full h-10 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none bg-white text-sm text-gray-700"
          >
            <option value="">All Suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Sort */}
        <div className="flex-1 min-w-0">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full h-10 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none bg-white text-sm text-gray-700"
          >
            <option value="most_sold">Sort: Most Sold</option>
            <option value="least_sold">Sort: Least Sold</option>
            <option value="price_high">Sort: Price High → Low</option>
            <option value="price_low">Sort: Price Low → High</option>
          </select>
        </div>
      </div>

      {/* Quick Filters + Download Button */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <button
          onClick={() => handleStockFilter("all")}
          className={`px-4 py-1.5 rounded-full text-sm font-bold border transition-colors ${
            stockFilter === "all"
              ? "bg-gray-800 text-white border-gray-800"
              : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
          }`}
        >
          All Parts
        </button>
        <button
          onClick={() => handleStockFilter("low")}
          className={`px-4 py-1.5 rounded-full text-sm font-bold border transition-colors flex items-center gap-1 ${
            stockFilter === "low"
              ? "bg-orange-500 text-white border-orange-500 shadow-sm"
              : "bg-white text-orange-600 border-orange-200 hover:bg-orange-50"
          }`}
        >
          Low Stock
        </button>
        {stockFilter === "low" && (
          <div className="flex items-center gap-1.5 bg-orange-50 text-orange-600 border border-orange-200 px-3 py-1 rounded-full text-sm font-bold shadow-sm transition-all duration-300 animate-fadeIn">
            <span className="text-orange-700 text-xs font-semibold">Qty &le;</span>
            <input
              type="number"
              min="0"
              value={lowStockThreshold}
              onChange={(e) => handleThresholdChange(e.target.value)}
              className="w-12 bg-white text-orange-700 border border-orange-200 rounded text-center py-0.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
        )}
        <button
          onClick={() => handleStockFilter("out")}
          className={`px-4 py-1.5 rounded-full text-sm font-bold border transition-colors flex items-center gap-1 ${
            stockFilter === "out"
              ? "bg-red-600 text-white border-red-600 shadow-sm"
              : "bg-white text-red-600 border-red-200 hover:bg-red-50"
          }`}
        >
          Out of Stock
        </button>
        <button
          onClick={() => handleStockFilter("no_price")}
          className={`px-4 py-1.5 rounded-full text-sm font-bold border transition-colors flex items-center gap-1 ${
            stockFilter === "no_price"
              ? "bg-purple-600 text-white border-purple-600 shadow-sm"
              : "bg-white text-purple-600 border-purple-200 hover:bg-purple-50"
          }`}
        >
          Invalid Price / No Image
        </button>

        {/* Download Report Button - visible when filtering by stock status */}
        {showDownloadButton && parts.length > 0 && (
          <button
            onClick={handleDownloadReport}
            className="ml-auto px-4 py-1.5 rounded-full text-sm font-bold border border-gray-800 bg-gray-800 text-white hover:bg-gray-900 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Download size={14} />
            Download Report ({parts.length})
          </button>
        )}
      </div>

      {/* Parts Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-700 mb-2"></div>
          <p>Loading Inventory...</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-6">
          {parts.length === 0 ? (
            <div className="col-span-full text-center py-10 bg-white rounded shadow-sm">
              <Package size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 text-lg">
                No parts found matching your criteria.
              </p>
            </div>
          ) : (
            parts.map((part) => (
              <div
                key={part.id}
                className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col relative group select-none cursor-pointer"
                onContextMenu={(e) => { e.preventDefault(); }} // Prevent mobile context menu on long press
                onMouseDown={() => startPress(part)}
                onMouseUp={endPress}
                onMouseLeave={endPress}
                onTouchStart={() => startPress(part)}
                onTouchEnd={endPress}
                onTouchMove={endPress}
                onClick={endPress}
              >
                {/* --- Action Buttons (Visible on Hover for Desktop, Always for Mobile if needed, but keeping clean for now) --- */}
                <div className="absolute top-2 right-2 flex gap-1 z-10 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEdit(part); }}
                    onMouseDown={(e) => { e.stopPropagation(); endPress(); }}
                    onTouchStart={(e) => { e.stopPropagation(); endPress(); }}
                    className="bg-white/90 backdrop-blur-sm p-1.5 rounded-full shadow-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-gray-100"
                    title="Edit Part"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); confirmDelete(part.id); }}
                    onMouseDown={(e) => { e.stopPropagation(); endPress(); }}
                    onTouchStart={(e) => { e.stopPropagation(); endPress(); }}
                    className="bg-white/90 backdrop-blur-sm p-1.5 rounded-full shadow-sm text-red-500 hover:text-red-700 hover:bg-red-50 border border-gray-100"
                    title="Delete Part"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Image Section */}
                <div className="h-32 md:h-48 bg-gray-100 relative group-hover:opacity-95 transition-opacity overflow-hidden">
                  {part.image ? (
                   <>
                    {/* Skeleton Loader (Visible while image loads) */}
                    <div className="absolute inset-0 bg-gray-200 animate-pulse z-0">
                        <div className="h-full w-full flex items-center justify-center">
                            <Package size={24} className="text-gray-300 opacity-20" />
                        </div>
                    </div>
                    
                    {/* Actual Image (Fades in on load) */}
                    <img
                      src={part.image}
                      alt={part.name}
                      loading="lazy"
                      onLoad={(e) => e.target.classList.remove('opacity-0')}
                      className="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-500 z-10"
                    />
                   </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-50">
                      <Package size={32} opacity={0.2} className="md:w-12 md:h-12" />
                    </div>
                  )}
                  {/* Stock Badge */}
                  <div className="absolute bottom-1 left-1 md:bottom-2 md:left-2 z-10">
                    {part.stock_qty <= 1 ? (
                      <span className="bg-red-500 text-white text-[10px] md:text-xs font-bold px-1.5 py-0.5 rounded shadow flex items-center gap-1">
                        <AlertTriangle size={10} className="md:w-3 md:h-3" /> Low
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Content Section */}
                <div className="p-3 md:p-5 flex-1 flex flex-col">
                  <div className="mb-1 md:mb-2">
                    <h2 className="text-sm md:text-lg font-bold text-gray-800 leading-snug line-clamp-2 md:line-clamp-none">
                      {part.name}
                    </h2>
                    <p className="text-[10px] md:text-xs text-gray-400 font-mono mt-0.5 truncate">
                      {part.part_number}
                    </p>
                  </div>

                  <div className="flex gap-2 mb-2">
                    <span className="bg-red-50 text-red-800 text-[10px] md:text-xs font-semibold px-1.5 py-0.5 rounded border border-red-100 truncate max-w-full">
                      {part.brand || "No Brand"}
                    </span>
                  </div>

                  {/* Compatible Vehicles (Hidden on very small screens if needed, or compacted) */}
                  <div className="mb-2 hidden md:block">
                    <p className="text-[10px] text-gray-400 uppercase font-bold mb-1 flex items-center gap-1">
                      <Car size={10} /> Fits:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {part.compatible_vehicles &&
                      part.compatible_vehicles.length > 0 ? (
                        part.compatible_vehicles.slice(0, 3).map((v, i) => (
                          <span
                            key={i}
                            className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200 truncate max-w-[100px]"
                          >
                            {renderVehicleName(v)}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-gray-400 italic">
                          Universal
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-0.5 md:space-y-1 mb-2 md:mb-4 flex-1">
                     <p className="text-[10px] md:text-xs text-gray-500 flex items-center gap-1 truncate">
                      <MapPin size={10} className="md:w-3 md:h-3" /> {part.rack_location}
                    </p>
                  </div>

                  {/* Price Footer */}
                  <div className="flex justify-between items-end border-t border-gray-100 pt-2 mt-auto">
                    <div>
                      <p className="text-[10px] md:text-xs text-gray-400 hidden md:block">
                        Selling Price
                      </p>
                      <p className="text-sm md:text-xl font-bold text-red-700">
                        LKR {part.sell_price}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] md:text-xs text-gray-400 mb-0.5">Qty</p>
                      <span
                        className={`font-bold text-sm md:text-lg ${
                          part.stock_qty <= 1
                            ? "text-red-600"
                            : "text-gray-800"
                        }`}
                      >
                        {part.stock_qty}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default InventoryPage;
