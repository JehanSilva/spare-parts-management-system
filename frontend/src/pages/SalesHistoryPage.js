import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchSales, fetchParts, updateSale, cancelSale, reverseSale, markSaleAsPaid } from "../services/api";
import BillingDocument from "../components/BillingDocument";
import WhatsAppShareFlow from "../components/WhatsAppShareFlow";
import { useSettings } from "../context/SettingsContext";
import AlertComponent from "../components/AlertComponent";
import {
  Search,
  FileText,
  ChevronDown,
  ChevronUp,
  Calendar,
  User,
  Car,
  Printer,
  Hash,
  Tag,
  Edit2,
  XCircle,
  AlertCircle,
  Trash2,
  UserCheck,
  Wallet,
  CheckCircle,
  RotateCcw,
  MessageCircle,
} from "lucide-react";

// --- Edit Sale Modal Component ---
const EditSaleModal = ({ isOpen, sale, onClose, onSave }) => {
  const [customerName, setCustomerName] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");

  useEffect(() => {
    if (sale) {
      setCustomerName(sale.customer_name);
      setVehicleNumber(sale.vehicle_number || "");
    }
  }, [sale]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-scale-in">
        <div className="bg-red-700 p-4 text-white flex justify-between items-center">
          <h3 className="font-bold text-lg">Edit Sale Details</h3>
          <button onClick={onClose} className="hover:bg-red-600 p-1 rounded-full"><XCircle size={20}/></button>
        </div>
        <div className="p-6 space-y-4 text-left">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Customer Name</label>
            <input 
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
              placeholder="Enter customer name"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Vehicle Number</label>
            <input 
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none font-mono"
              placeholder="e.g. CAS-1234"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
            <button 
              onClick={() => onSave({ customer_name: customerName, vehicle_number: vehicleNumber })}
              className="flex-1 py-2.5 bg-red-700 text-white rounded-xl font-bold hover:bg-red-800 transition shadow-lg shadow-red-200"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Cancel Sale Modal Component ---
const CancelSaleModal = ({ isOpen, sale, onClose, onConfirm }) => {
  const [reasonOption, setReasonOption] = useState("");
  const [otherReason, setOtherReason] = useState("");

  useEffect(() => {
    if (isOpen) {
      setReasonOption("");
      setOtherReason("");
    }
  }, [isOpen]);

  if (!isOpen || !sale) return null;

  const predefinedReasons = [
    "Customer Return / Exchange",
    "Billing Error / Incorrect Invoice",
    "Order Cancelled by Customer",
    "Duplicate Transaction",
  ];

  const handleConfirm = () => {
    const finalReason = reasonOption === "Other" ? otherReason.trim() : reasonOption;
    onConfirm(finalReason);
  };

  const isConfirmDisabled = 
    !reasonOption || 
    (reasonOption === "Other" && !otherReason.trim());

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-scale-in">
        <div className="bg-red-700 p-4 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <AlertCircle size={20} />
            <h3 className="font-bold text-lg">Cancel Sale</h3>
          </div>
          <button onClick={onClose} className="hover:bg-red-600 p-1 rounded-full">
            <XCircle size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4 text-left">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
            <p className="font-semibold mb-1">Warning: This action cannot be undone.</p>
            <p>Cancelling this sale will return all items back to inventory stock levels.</p>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Select Reason for Cancellation
            </label>
            <div className="space-y-2">
              {predefinedReasons.map((reason) => (
                <label
                  key={reason}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                    reasonOption === reason
                      ? "border-red-600 bg-red-50 text-red-950 font-semibold"
                      : "border-gray-200 hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="cancelReason"
                    value={reason}
                    checked={reasonOption === reason}
                    onChange={(e) => setReasonOption(e.target.value)}
                    className="mt-1 text-red-600 focus:ring-red-500 border-gray-300"
                  />
                  <span>{reason}</span>
                </label>
              ))}
              <label
                className={`flex flex-col gap-2 p-3 rounded-xl border cursor-pointer transition ${
                  reasonOption === "Other"
                    ? "border-red-600 bg-red-50 text-red-950 font-semibold"
                    : "border-gray-200 hover:bg-gray-50 text-gray-700"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="cancelReason"
                    value="Other"
                    checked={reasonOption === "Other"}
                    onChange={(e) => setReasonOption(e.target.value)}
                    className="mt-1 text-red-600 focus:ring-red-500 border-gray-300"
                  />
                  <span>Other (Write custom reason)</span>
                </div>
                {reasonOption === "Other" && (
                  <textarea
                    value={otherReason}
                    onChange={(e) => setOtherReason(e.target.value)}
                    className="w-full mt-1 p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none text-gray-800 font-normal"
                    placeholder="Enter custom cancellation reason..."
                    rows={3}
                  />
                )}
              </label>
            </div>
          </div>
          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-300 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition"
            >
              Close
            </button>
            <button
              onClick={handleConfirm}
              disabled={isConfirmDisabled}
              className={`flex-1 py-2.5 rounded-xl font-bold text-white transition shadow-lg ${
                isConfirmDisabled
                  ? "bg-gray-300 cursor-not-allowed shadow-none"
                  : "bg-red-700 hover:bg-red-800 shadow-red-200"
              }`}
            >
              Confirm Cancellation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Reverse Sale Modal Component ---
const ReverseSaleModal = ({ isOpen, sale, onClose, onConfirm, loading }) => {
  if (!isOpen || !sale) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-scale-in">
        <div className="bg-amber-600 p-4 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <RotateCcw size={20} />
            <h3 className="font-bold text-lg">Reverse Sale</h3>
          </div>
          <button onClick={onClose} className="hover:bg-amber-500 p-1 rounded-full">
            <XCircle size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4 text-left">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
            <p className="font-semibold mb-1">This will remove the sale from history.</p>
            <p>
              Stock will be restored and this invoice for{" "}
              <span className="font-bold">{sale.customer_name}</span> will reopen as an
              editable repair in the POS page, where it can be corrected and completed again.
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition">
              Close
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 py-2.5 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition shadow-lg shadow-amber-200 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? "Reversing..." : (<><RotateCcw size={16} /> Reverse Sale</>)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Mark Credit as Received Modal Component ---
const MarkPaidModal = ({ isOpen, sale, onClose, onConfirm, loading }) => {
  const [mode, setMode] = useState("full"); // "full" | "partial"
  const [partialAmount, setPartialAmount] = useState("");

  useEffect(() => {
    if (isOpen) {
      setMode("full");
      setPartialAmount("");
    }
  }, [isOpen]);

  if (!isOpen || !sale) return null;

  const formatLKR = (amount) =>
    new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

  const dueAmount = parseFloat(sale.total_amount || 0) - parseFloat(sale.amount_paid || 0);
  const parsedPartial = parseFloat(partialAmount);
  const isPartialValid = partialAmount !== "" && !isNaN(parsedPartial) && parsedPartial > 0 && parsedPartial <= dueAmount;
  const canConfirm = mode === "full" || isPartialValid;

  const handleConfirmClick = () => {
    onConfirm(mode === "partial" ? parsedPartial : undefined);
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-scale-in">
        <div className="bg-green-700 p-4 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Wallet size={20} />
            <h3 className="font-bold text-lg">Settle Balance</h3>
          </div>
          <button onClick={onClose} className="hover:bg-green-600 p-1 rounded-full"><XCircle size={20} /></button>
        </div>
        <div className="p-6 space-y-4 text-left">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-900">
            <p>
              <span className="font-bold">{sale.customer_name}</span> owes{" "}
              <span className="font-bold">{formatLKR(dueAmount)}</span> on this sale.
              {sale.payment_status === "PARTIAL" && (
                <span className="block text-xs text-green-700 mt-1">
                  ({formatLKR(sale.amount_paid)} already received of {formatLKR(sale.total_amount)} total)
                </span>
              )}
            </p>
          </div>
          {sale.credit_note && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800 italic">
              "{sale.credit_note}"
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("full")}
              className={`py-2 rounded-lg text-sm font-bold border transition-colors ${mode === "full" ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}
            >
              Full Amount
            </button>
            <button
              type="button"
              onClick={() => setMode("partial")}
              className={`py-2 rounded-lg text-sm font-bold border transition-colors ${mode === "partial" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}
            >
              Partial Amount
            </button>
          </div>

          {mode === "partial" && (
            <div>
              <label className="text-xs font-semibold text-blue-700 mb-1 block">Amount Received Now</label>
              <input
                type="number"
                min="0"
                step="0.01"
                autoFocus
                value={partialAmount}
                onChange={(e) => setPartialAmount(e.target.value)}
                placeholder={`Up to ${formatLKR(dueAmount)}`}
                className="w-full px-3 py-2 text-sm bg-blue-50 border border-blue-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder-blue-300"
              />
              {partialAmount !== "" && !isPartialValid ? (
                <p className="text-xs text-red-600 mt-1">Enter an amount greater than 0 and up to {formatLKR(dueAmount)}.</p>
              ) : isPartialValid ? (
                <p className="text-xs text-blue-600 mt-1 font-medium">
                  Remaining balance after this payment: {formatLKR(dueAmount - parsedPartial)}
                </p>
              ) : null}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
            <button
              onClick={handleConfirmClick}
              disabled={loading || !canConfirm}
              className="flex-1 py-2.5 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition shadow-lg shadow-green-200 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? "Saving..." : (<><CheckCircle size={16} /> {mode === "partial" ? "Record Payment" : "Mark as Received"}</>)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const SalesHistoryPage = () => {
  const navigate = useNavigate();
  // Billing method (Home → Options): "Receipt" or "Invoice".
  const { documentLabel } = useSettings();
  const [sales, setSales] = useState([]);
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("ALL"); // ALL | CREDIT
  const [expandedSaleId, setExpandedSaleId] = useState(null);

  // --- Modal & Alert State ---
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [saleToEdit, setSaleToEdit] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [saleToCancel, setSaleToCancel] = useState(null);
  const [saleToReverse, setSaleToReverse] = useState(null);
  const [reverseLoading, setReverseLoading] = useState(false);
  const [saleToMarkPaid, setSaleToMarkPaid] = useState(null);
  const [markPaidLoading, setMarkPaidLoading] = useState(false);
  const [alertInfo, setAlertInfo] = useState({ type: "", message: "" });

  // --- Printing State ---
  // Plain window.print() + CSS (see the .receipt-print-only / print:hidden
  // classes below), rather than react-to-print's iframe-based approach —
  // iOS Safari doesn't reliably scope window.print() to an offscreen iframe's
  // content and falls back to printing the whole page instead of the receipt.
  const [selectedSaleForPrint, setSelectedSaleForPrint] = useState(null);

  // --- WhatsApp Sharing State (flow lives in WhatsAppShareFlow) ---
  const [saleToShare, setSaleToShare] = useState(null);

  useEffect(() => {
    if (!selectedSaleForPrint) return;
    // Let the Receipt content paint before invoking the print dialog.
    const t = setTimeout(() => window.print(), 50);
    const handleAfterPrint = () => setSelectedSaleForPrint(null);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [selectedSaleForPrint]);

  // --- Enrich Sale Items with Part Numbers ---
  const getEnrichedSale = (sale) => {
    const enrichedItems = sale.items.map((item) => {
      const partId = item.part || item.part_id;
      const originalPart = parts.find((p) => p.id === partId);

      return {
        ...item,
        part_number: originalPart ? originalPart.part_number : "N/A",
        part_name:
          item.part_name || (originalPart ? originalPart.name : "Unknown"),
      };
    });
    return { ...sale, items: enrichedItems };
  };

  const printReceipt = (sale, e) => {
    e.stopPropagation();
    const enriched = getEnrichedSale(sale);
    setSelectedSaleForPrint(enriched);
  };

  const shareToWhatsApp = (sale, e) => {
    e.stopPropagation();
    // Same part-number enrichment the printed document gets.
    setSaleToShare(getEnrichedSale(sale));
  };

  // --- Load Data ---
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [salesData, partsData] = await Promise.all([
          fetchSales(),
          fetchParts(),
        ]);
        setSales(salesData);
        setParts(partsData);
      } catch (error) {
        console.error("Failed to load data", error);
      }
      setLoading(false);
    };
    loadData();
  }, []);

  const toggleExpand = (id) => {
    setExpandedSaleId(expandedSaleId === id ? null : id);
  };

  const handleEditClick = (sale, e) => {
    e.stopPropagation();
    setSaleToEdit(sale);
    setIsEditModalOpen(true);
  };

  const handleUpdateSale = async (updatedData) => {
    try {
      const result = await updateSale(saleToEdit.id, updatedData);
      setSales(sales.map(s => s.id === result.id ? result : s));
      setIsEditModalOpen(false);
      setAlertInfo({ type: "success", message: "Sale updated successfully!" });
    } catch (error) {
      setAlertInfo({ type: "error", message: "Failed to update sale." });
    }
  };

  const handleCancelClick = (sale, e) => {
    e.stopPropagation();
    setSaleToCancel(sale);
    setShowCancelConfirm(true);
  };

  const getPartNumber = (partId) => {
    const p = parts.find((part) => part.id === partId);
    return p ? p.part_number : "";
  };

  const handleExecuteCancel = async (cancelReason) => {
    try {
      const result = await cancelSale(saleToCancel.id, { cancel_reason: cancelReason });
      setSales(sales.map(s => s.id === result.id ? result : s));
      setShowCancelConfirm(false);
      setAlertInfo({ type: "success", message: "Sale cancelled and stock restored!" });
    } catch (error) {
      setAlertInfo({ type: "error", message: "Failed to cancel sale." });
    }
  };

  const handleReverseClick = (sale, e) => {
    e.stopPropagation();
    setSaleToReverse(sale);
  };

  const handleExecuteReverse = async () => {
    setReverseLoading(true);
    try {
      const cart = await reverseSale(saleToReverse.id);
      setSales(sales.filter((s) => s.id !== saleToReverse.id));
      localStorage.setItem("pos_active_cart_id", cart.id);
      setSaleToReverse(null);
      navigate("/pos");
    } catch (error) {
      setAlertInfo({ type: "error", message: error.response?.data?.error || "Failed to reverse sale." });
    } finally {
      setReverseLoading(false);
    }
  };

  const handleMarkPaidClick = (sale, e) => {
    e.stopPropagation();
    setSaleToMarkPaid(sale);
  };

  const handleConfirmMarkPaid = async (amount) => {
    setMarkPaidLoading(true);
    try {
      const result = await markSaleAsPaid(saleToMarkPaid.id, amount);
      setSales(sales.map(s => s.id === result.id ? result : s));
      setSaleToMarkPaid(null);
      const stillDue = parseFloat(result.total_amount) - parseFloat(result.amount_paid || 0);
      setAlertInfo({
        type: "success",
        message: stillDue > 0
          ? `Partial payment recorded — ${formatLKR(stillDue)} still due.`
          : "Marked as received — credit settled!",
      });
    } catch (error) {
      setAlertInfo({ type: "error", message: error.response?.data?.error || "Failed to record payment." });
    } finally {
      setMarkPaidLoading(false);
    }
  };

  const outstandingCreditSales = sales.filter((s) => s.payment_status === "CREDIT" || s.payment_status === "PARTIAL");
  const outstandingCreditTotal = outstandingCreditSales.reduce(
    (sum, s) => sum + (parseFloat(s.total_amount || 0) - parseFloat(s.amount_paid || 0)),
    0
  );

  const filteredSales = sales.filter((sale) => {
    const searchLower = searchTerm.trim().toLowerCase();

    // Check if the sale matches the search term (Customer, Vehicle, ID, or Items)
    const matchSearch =
      !searchTerm.trim() ||
      sale.customer_name.toLowerCase().includes(searchLower) ||
      (sale.vehicle_number && sale.vehicle_number.toLowerCase().includes(searchLower)) ||
      sale.id.includes(searchTerm.trim()) ||
      sale.items.some((item) => {
        const pName = (item.part_name || "").toLowerCase();
        const pNum = getPartNumber(item.part || item.part_id).toLowerCase();
        return pName.includes(searchLower) || pNum.includes(searchLower);
      });

    // Check if the sale matches the selected date
    // sale.created_at is typically "YYYY-MM-DDTHH:MM..."
    const matchDate = !filterDate || sale.created_at.startsWith(filterDate);

    const matchPayment = paymentFilter !== "CREDIT" || sale.payment_status === "CREDIT" || sale.payment_status === "PARTIAL";

    return matchSearch && matchDate && matchPayment;
  });

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString("en-LK", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatLKR = (amount) => {
    return new Intl.NumberFormat("en-LK", {
      style: "currency",
      currency: "LKR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };


  return (
    <>
    <div className="p-4 md:p-8 min-h-screen bg-gray-50 print:hidden">
      {alertInfo.message && (
        <AlertComponent 
          type={alertInfo.type} 
          message={alertInfo.message} 
          onClose={() => setAlertInfo({ type: "", message: "" })} 
        />
      )}

      <CancelSaleModal 
        isOpen={showCancelConfirm}
        sale={saleToCancel}
        onClose={() => setShowCancelConfirm(false)}
        onConfirm={handleExecuteCancel}
      />

      <EditSaleModal
        isOpen={isEditModalOpen}
        sale={saleToEdit}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleUpdateSale}
      />

      <ReverseSaleModal
        isOpen={!!saleToReverse}
        sale={saleToReverse}
        onClose={() => setSaleToReverse(null)}
        onConfirm={handleExecuteReverse}
        loading={reverseLoading}
      />

      <MarkPaidModal
        isOpen={!!saleToMarkPaid}
        sale={saleToMarkPaid}
        onClose={() => setSaleToMarkPaid(null)}
        onConfirm={handleConfirmMarkPaid}
        loading={markPaidLoading}
      />

      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-red-900 flex items-center gap-2">
          <FileText className="w-6 h-6 md:w-8 md:h-8" /> Sales History
        </h1>
        <p className="text-gray-600 mt-1 text-sm md:text-base">
          View past invoices and regenerate receipts.
        </p>
      </div>

      {/* Outstanding Credit Summary — informational only. The filter toggle
          lives solely in the always-visible Filters Area below so there's
          exactly one control for it, and it stays reachable even after
          every outstanding sale has been settled and this banner disappears. */}
      {outstandingCreditSales.length > 0 && (
        <div className="max-w-3xl w-full mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg text-amber-700">
            <Wallet size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Outstanding Credit</p>
            <p className="text-lg font-extrabold text-amber-900">{formatLKR(outstandingCreditTotal)} <span className="text-xs font-medium text-amber-600">across {outstandingCreditSales.length} sale{outstandingCreditSales.length > 1 ? "s" : ""}</span></p>
          </div>
        </div>
      )}

      {/* Filters Area */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 max-w-3xl w-full">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search Customer, Vehicle, Invoice, Part Name/No..."
            className="w-full pl-10 p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-red-500 outline-none text-[16px] md:text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Date Filter — no custom left icon: iOS Safari's native date-input
            renderer doesn't reliably make room for padding-based overlays,
            and ends up clipping its own placeholder text instead. The
            native calendar affordance (desktop and mobile) is enough on
            its own; bg-white + appearance-none keeps iOS from applying its
            own greyed-out control background. */}
        <div className="relative md:w-56 shrink-0">
          <input
            type="date"
            className="w-full pr-10 p-3 border border-gray-300 rounded-lg shadow-sm bg-white appearance-none focus:ring-2 focus:ring-red-500 outline-none text-[16px] md:text-sm text-gray-700"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
          {filterDate && (
            <button
              onClick={() => setFilterDate("")}
              className="absolute right-3 top-3.5 text-gray-400 hover:text-red-500"
              title="Clear Date"
            >
              <XCircle size={16} />
            </button>
          )}
        </div>

        {/* Payment Status Filter — always available (not tied to whether
            there's currently outstanding credit) so it can always be
            toggled back to "All Sales". */}
        <button
          type="button"
          onClick={() => setPaymentFilter(paymentFilter === "CREDIT" ? "ALL" : "CREDIT")}
          className={`shrink-0 px-4 py-3 rounded-lg text-sm font-bold border transition-colors flex items-center justify-center gap-2 ${
            paymentFilter === "CREDIT"
              ? "bg-amber-600 text-white border-amber-600"
              : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
          }`}
        >
          <Wallet size={16} />
          {paymentFilter === "CREDIT" ? "Credit Only" : "All Sales"}
        </button>
      </div>

      {/* --- CONTENT --- */}
      {loading ? (
        <div className="text-center py-20 text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-700 mx-auto mb-2"></div>
          Loading Records...
        </div>
      ) : filteredSales.length === 0 ? (
        <div className="p-8 text-center text-gray-400 bg-white rounded shadow">
          No sales found.
        </div>
      ) : (
        <>
          {/* =========================================
              MOBILE VIEW (Cards)
             ========================================= */}
          <div className="md:hidden space-y-4">
            {filteredSales.map((sale) => (
              <div
                key={sale.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
              >
                {/* Card Header */}
                <div
                  className="p-4 flex justify-between items-start cursor-pointer active:bg-gray-50"
                  onClick={() => toggleExpand(sale.id)}
                >
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        #{sale.id.substring(0, 8)}
                      </span>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Calendar size={10} /> {formatDate(sale.created_at)}
                      </span>
                    </div>
                    <h3 className="font-bold text-gray-800 text-lg">
                      {sale.customer_name}
                    </h3>
                    <div className="flex justify-between items-center mt-2">
                       <div className="flex flex-col gap-1">
                          <span className="text-sm text-gray-600 flex items-center gap-1">
                            <Car
                              size={14}
                              className={
                                sale.vehicle_number
                                  ? "text-orange-500"
                                  : "text-gray-300"
                              }
                            />
                            {sale.vehicle_number || "No Vehicle"}
                          </span>
                          {sale.status === 'CANCELLED' && (
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold uppercase w-fit">
                                <XCircle size={10} /> Cancelled
                              </span>
                              <span className="text-[10px] text-gray-500 italic max-w-[200px] truncate" title={sale.cancel_reason || "Not specified"}>
                                ({sale.cancel_reason || "Not specified"})
                              </span>
                            </div>
                          )}
                          {sale.status !== 'CANCELLED' && sale.payment_status === 'CREDIT' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold uppercase w-fit mt-1">
                              <UserCheck size={10} /> Credit — Pending
                            </span>
                          )}
                          {sale.status !== 'CANCELLED' && sale.payment_status === 'PARTIAL' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold uppercase w-fit mt-1">
                              <Wallet size={10} /> Partial — Due {formatLKR(parseFloat(sale.total_amount) - parseFloat(sale.amount_paid || 0))}
                            </span>
                          )}
                       </div>
                      <span className={`text-lg font-bold ${sale.status === 'CANCELLED' ? 'text-gray-400 line-through' : sale.payment_status === 'CREDIT' ? 'text-amber-700' : sale.payment_status === 'PARTIAL' ? 'text-blue-700' : 'text-green-700'}`}>
                        {formatLKR(sale.total_amount)}
                      </span>
                    </div>
                  </div>
                  <div className="ml-3 mt-1 text-gray-400">
                    {expandedSaleId === sale.id ? (
                      <ChevronUp size={20} />
                    ) : (
                      <ChevronDown size={20} />
                    )}
                  </div>
                </div>

                {/* Expanded Details (Mobile) */}
                {expandedSaleId === sale.id && (
                  <div className="bg-gray-50 p-4 border-t border-gray-100 text-sm">
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <button
                        onClick={(e) => printReceipt(sale, e)}
                        disabled={sale.status === 'CANCELLED'}
                        className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 ${
                          sale.status === 'CANCELLED'
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-gray-800 text-white hover:bg-gray-900'
                        }`}
                        title={sale.status === 'CANCELLED' ? `Cannot print ${documentLabel.toLowerCase()} for cancelled sales` : `Print ${documentLabel}`}
                      >
                        <Printer size={16} /> {documentLabel}
                      </button>
                      <button
                        onClick={(e) => handleEditClick(sale, e)}
                        className="flex-1 bg-white border border-gray-300 text-gray-700 py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-all active:scale-95"
                      >
                        <Edit2 size={16} /> Edit
                      </button>
                    </div>

                    {sale.status !== 'CANCELLED' && (
                      <button
                        onClick={(e) => shareToWhatsApp(sale, e)}
                        className="w-full bg-emerald-600 text-white py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all active:scale-95 mb-3 font-bold shadow-sm"
                        title={`Share ${documentLabel.toLowerCase()} to WhatsApp`}
                      >
                        <MessageCircle size={16} /> Share to WhatsApp
                      </button>
                    )}

                    {sale.status !== 'CANCELLED' && (sale.payment_status === 'CREDIT' || sale.payment_status === 'PARTIAL') && (
                      <button
                        onClick={(e) => handleMarkPaidClick(sale, e)}
                        className="w-full bg-green-50 text-green-700 py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-green-100 transition-all active:scale-95 mb-3 font-bold border border-green-200"
                      >
                        <Wallet size={16} /> Mark as Received
                      </button>
                    )}

                    {sale.status !== 'CANCELLED' ? (
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <button
                          onClick={(e) => handleReverseClick(sale, e)}
                          className="bg-amber-50 text-amber-700 py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-amber-100 transition-all active:scale-95 font-bold border border-amber-100"
                        >
                          <RotateCcw size={16} /> Reverse
                        </button>
                        <button
                          onClick={(e) => handleCancelClick(sale, e)}
                          className="bg-red-50 text-red-600 py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-red-100 transition-all active:scale-95 font-bold border border-red-100"
                        >
                          <Trash2 size={16} /> Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="bg-red-50 text-red-800 border border-red-100 rounded-xl p-3.5 mb-4 text-xs">
                        <span className="font-bold block uppercase tracking-wider text-[10px] text-red-700 mb-1">Reason for Cancellation</span>
                        <p className="italic font-medium">"{sale.cancel_reason || "Not specified"}"</p>
                      </div>
                    )}

                    {sale.payment_status === 'PARTIAL' && (
                      <div className="bg-blue-50 text-blue-800 border border-blue-100 rounded-xl p-3.5 mb-4 text-xs flex justify-between">
                        <span>
                          <span className="font-bold block uppercase tracking-wider text-[10px] text-blue-700 mb-1">Paid Now</span>
                          {formatLKR(sale.amount_paid)}
                        </span>
                        <span className="text-right">
                          <span className="font-bold block uppercase tracking-wider text-[10px] text-blue-700 mb-1">Balance Due</span>
                          {formatLKR(parseFloat(sale.total_amount) - parseFloat(sale.amount_paid || 0))}
                        </span>
                      </div>
                    )}

                    {sale.credit_note && (
                      <div className="bg-amber-50 text-amber-800 border border-amber-100 rounded-xl p-3.5 mb-4 text-xs">
                        <span className="font-bold block uppercase tracking-wider text-[10px] text-amber-700 mb-1">
                          Credit Note {sale.payment_status === 'PAID' && '(Settled)'}
                        </span>
                        <p className="italic font-medium">"{sale.credit_note}"</p>
                      </div>
                    )}

                    {(sale.mileage != null || sale.notes) && (
                      <div className="bg-blue-50 text-blue-800 border border-blue-100 rounded-xl p-3.5 mb-4 text-xs space-y-1">
                        {sale.mileage != null && (
                          <p><span className="font-bold uppercase tracking-wider text-[10px] text-blue-700">Mileage:</span> {sale.mileage.toLocaleString()} km</p>
                        )}
                        {sale.notes && (
                          <p className="italic font-medium">"{sale.notes}"</p>
                        )}
                      </div>
                    )}

                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">
                      Purchased Items
                    </h4>
                    <div className="space-y-3">
                      {sale.items.map((item, idx) => {
                        const discount = parseFloat(item.discount || 0);
                        const originalPrice = parseFloat(item.unit_price);
                        const finalPrice = originalPrice - discount;
                        const lineTotal = finalPrice * item.quantity;

                        return (
                          <div
                            key={idx}
                            className="flex justify-between border-b border-gray-200 pb-2 last:border-0"
                          >
                            <div>
                              <p className="font-medium text-gray-700">
                                {item.part_name || "Unknown Part"}
                              </p>
                              <p className="text-[10px] text-gray-500 font-mono flex items-center gap-1">
                                <Hash size={10} />
                                {getPartNumber(item.part || item.part_id)}
                              </p>

                              {/* Price Calculation Display */}
                              <div className="text-xs text-gray-500 mt-0.5">
                                {item.quantity} x
                                {discount > 0 ? (
                                  <span className="ml-1">
                                    <span className="line-through text-gray-400 text-[10px] mr-1">
                                      {formatLKR(originalPrice)}
                                    </span>
                                    <span className="text-green-600 font-bold">
                                      {formatLKR(finalPrice)}
                                    </span>
                                  </span>
                                ) : (
                                  <span className="ml-1">
                                    {formatLKR(originalPrice)}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="text-right">
                              <p className="font-bold text-gray-800">
                                {formatLKR(lineTotal)}
                              </p>
                              {discount > 0 && (
                                <p className="text-[9px] text-red-500 flex items-center justify-end gap-0.5">
                                  <Tag size={8} /> -
                                  {formatLKR(discount * item.quantity)}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* =========================================
              DESKTOP VIEW (Table)
             ========================================= */}
          <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden border border-gray-200">
            <table className="w-full text-left">
              <thead className="bg-gray-100 text-gray-700 uppercase text-xs font-bold">
                <tr>
                  <th className="p-4">Invoice ID</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Vehicle</th>
                  <th className="p-4 text-right">Total Amount</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSales.map((sale) => (
                  <React.Fragment key={sale.id}>
                    <tr
                      className={`hover:bg-red-50 transition cursor-pointer ${
                        expandedSaleId === sale.id ? "bg-red-50" : ""
                      }`}
                      onClick={() => toggleExpand(sale.id)}
                    >
                      <td className="p-4 font-mono text-xs text-gray-500">
                        #{sale.id.substring(0, 8)}
                      </td>
                      <td className="p-4 text-sm text-gray-600 flex items-center gap-2">
                        <Calendar size={14} className="text-gray-400" />
                        {formatDate(sale.created_at)}
                      </td>
                      <td className="p-4 font-bold text-gray-800">
                        <div className="flex items-center gap-2">
                          <User size={14} className="text-blue-500" />
                          {sale.customer_name}
                        </div>
                      </td>
                      <td className="p-4 text-sm text-gray-600">
                        {sale.vehicle_number ? (
                          <span className="flex items-center gap-2">
                            <Car size={14} className="text-orange-500" />
                            {sale.vehicle_number}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex flex-col items-end">
                          <span className={`font-bold ${sale.status === 'CANCELLED' ? 'text-gray-400 line-through' : sale.payment_status === 'CREDIT' ? 'text-amber-700' : sale.payment_status === 'PARTIAL' ? 'text-blue-700' : 'text-green-700'}`}>
                            {formatLKR(sale.total_amount)}
                          </span>
                          {sale.status === 'CANCELLED' && (
                            <div className="flex flex-col items-end">
                              <span className="text-[9px] text-red-500 font-bold uppercase tracking-tighter">Cancelled</span>
                              <span className="text-[10px] text-gray-400 font-normal italic max-w-[150px] truncate" title={sale.cancel_reason || "Not specified"}>
                                ({sale.cancel_reason || "Not specified"})
                              </span>
                            </div>
                          )}
                          {sale.status !== 'CANCELLED' && sale.payment_status === 'CREDIT' && (
                            <span className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[9px] font-bold uppercase">
                              <UserCheck size={9} /> Credit — Pending
                            </span>
                          )}
                          {sale.status !== 'CANCELLED' && sale.payment_status === 'PARTIAL' && (
                            <span className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold uppercase">
                              <Wallet size={9} /> Due {formatLKR(parseFloat(sale.total_amount) - parseFloat(sale.amount_paid || 0))}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-center text-gray-400">
                        <div className="flex justify-center items-center">
                          {/* Expansion Toggle Chevron */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(sale.id);
                            }}
                            className="p-2 hover:bg-gray-100 text-gray-500 rounded-lg transition"
                            title={expandedSaleId === sale.id ? "Hide Details" : "Show Details"}
                          >
                            <div className={`transition-transform duration-300 ${expandedSaleId === sale.id ? 'rotate-180' : ''}`}>
                              <ChevronDown size={20} />
                            </div>
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Detail Row (Desktop) */}
                    {expandedSaleId === sale.id && (
                      <tr className="bg-gray-50">
                        <td
                          colSpan="6"
                          className="p-4 border-t border-gray-200 shadow-inner"
                        >
                          <div className="ml-4 pl-4 border-l-2 border-red-300">
                            {/* Desktop Row Actions */}
                            <div className="flex flex-wrap gap-3 mb-6 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm max-w-4xl">
                              <button
                                onClick={(e) => printReceipt(sale, e)}
                                disabled={sale.status === 'CANCELLED'}
                                className={`px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-bold transition shadow-sm hover:shadow active:scale-95 ${
                                  sale.status === 'CANCELLED'
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-transparent'
                                  : 'bg-slate-900 hover:bg-slate-800 text-white border border-transparent'
                                }`}
                                title={sale.status === 'CANCELLED' ? `Cannot print ${documentLabel.toLowerCase()} for cancelled sales` : `Print ${documentLabel}`}
                              >
                                <Printer size={15} />
                                <span>Print {documentLabel}</span>
                              </button>

                              {sale.status !== 'CANCELLED' && (
                                <button
                                  onClick={(e) => shareToWhatsApp(sale, e)}
                                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center gap-2 text-xs font-bold transition shadow-sm hover:shadow active:scale-95"
                                >
                                  <MessageCircle size={15} />
                                  <span>Share on WhatsApp</span>
                                </button>
                              )}

                              <button
                                onClick={(e) => handleEditClick(sale, e)}
                                className="px-4 py-2 bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 rounded-xl flex items-center gap-2 text-xs font-bold transition shadow-sm hover:shadow active:scale-95"
                              >
                                <Edit2 size={15} />
                                <span>Edit Sale</span>
                              </button>

                              {sale.status !== 'CANCELLED' && (sale.payment_status === 'CREDIT' || sale.payment_status === 'PARTIAL') && (
                                <button
                                  onClick={(e) => handleMarkPaidClick(sale, e)}
                                  className="px-4 py-2 bg-white border border-green-200 text-green-700 hover:bg-green-50 rounded-xl flex items-center gap-2 text-xs font-bold transition shadow-sm hover:shadow active:scale-95"
                                >
                                  <Wallet size={15} />
                                  <span>Mark as Received</span>
                                </button>
                              )}

                              {sale.status !== 'CANCELLED' && (
                                <button
                                  onClick={(e) => handleReverseClick(sale, e)}
                                  className="px-4 py-2 bg-white border border-amber-200 text-amber-600 hover:bg-amber-50 rounded-xl flex items-center gap-2 text-xs font-bold transition shadow-sm hover:shadow active:scale-95"
                                >
                                  <RotateCcw size={15} />
                                  <span>Reverse & Redo</span>
                                </button>
                              )}

                              {sale.status !== 'CANCELLED' ? (
                                <button
                                  onClick={(e) => handleCancelClick(sale, e)}
                                  className="px-4 py-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-2 text-xs font-bold transition shadow-sm hover:shadow active:scale-95 ml-auto"
                                >
                                  <Trash2 size={15} />
                                  <span>Cancel Sale</span>
                                </button>
                              ) : (
                                <div className="px-4 py-2 bg-gray-50 border border-gray-100 text-gray-400 rounded-xl flex items-center gap-2 text-xs font-bold cursor-not-allowed ml-auto">
                                  <Trash2 size={15} className="text-gray-300" />
                                  <span>Cancelled</span>
                                </div>
                              )}
                            </div>
                             {sale.status === 'CANCELLED' && (
                               <div className="bg-red-50 text-red-800 border border-red-100 rounded-xl p-4 mb-4 text-sm max-w-xl">
                                 <span className="font-bold block uppercase tracking-wider text-xs text-red-700 mb-1">Reason for Cancellation</span>
                                 <p className="italic font-medium">"{sale.cancel_reason || "Not specified"}"</p>
                               </div>
                             )}
                             {sale.payment_status === 'PARTIAL' && (
                               <div className="bg-blue-50 text-blue-800 border border-blue-100 rounded-xl p-4 mb-4 text-sm max-w-xl flex justify-between">
                                 <span>
                                   <span className="font-bold block uppercase tracking-wider text-xs text-blue-700 mb-1">Paid Now</span>
                                   {formatLKR(sale.amount_paid)}
                                 </span>
                                 <span className="text-right">
                                   <span className="font-bold block uppercase tracking-wider text-xs text-blue-700 mb-1">Balance Due</span>
                                   {formatLKR(parseFloat(sale.total_amount) - parseFloat(sale.amount_paid || 0))}
                                 </span>
                               </div>
                             )}
                             {sale.credit_note && (
                               <div className="bg-amber-50 text-amber-800 border border-amber-100 rounded-xl p-4 mb-4 text-sm max-w-xl">
                                 <span className="font-bold block uppercase tracking-wider text-xs text-amber-700 mb-1">
                                   Credit Note {sale.payment_status === 'PAID' && '(Settled)'}
                                 </span>
                                 <p className="italic font-medium">"{sale.credit_note}"</p>
                               </div>
                             )}
                             {(sale.mileage != null || sale.notes) && (
                               <div className="bg-blue-50 text-blue-800 border border-blue-100 rounded-xl p-4 mb-4 text-sm max-w-xl space-y-1">
                                 {sale.mileage != null && (
                                   <p><span className="font-bold uppercase tracking-wider text-xs text-blue-700">Mileage:</span> {sale.mileage.toLocaleString()} km</p>
                                 )}
                                 {sale.notes && (
                                   <p className="italic font-medium">"{sale.notes}"</p>
                                 )}
                               </div>
                             )}
                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">
                              Purchased Items
                            </h4>
                            <table className="w-full max-w-4xl text-sm">
                              <thead>
                                <tr className="text-gray-400 border-b border-gray-200">
                                  <th className="pb-2 text-left w-[35%]">
                                    Part Details
                                  </th>
                                  <th className="pb-2 text-center w-[10%]">
                                    Qty
                                  </th>
                                  <th className="pb-2 text-right w-[15%]">
                                    Original Price
                                  </th>
                                  <th className="pb-2 text-right w-[15%] text-red-500">
                                    Discount
                                  </th>
                                  <th className="pb-2 text-right w-[15%]">
                                    Final Price
                                  </th>
                                  <th className="pb-2 text-right w-[10%]">
                                    Total
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {sale.items.map((item, idx) => {
                                  const discount = parseFloat(
                                    item.discount || 0,
                                  );
                                  const originalPrice = parseFloat(
                                    item.unit_price,
                                  );
                                  const finalPrice = originalPrice - discount;
                                  const lineTotal = finalPrice * item.quantity;

                                  return (
                                    <tr
                                      key={idx}
                                      className="border-b border-gray-100 last:border-0"
                                    >
                                      <td className="py-2 text-gray-700 font-medium">
                                        <div>
                                          {item.part_name || "Unknown Part"}
                                        </div>
                                        <div className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
                                          <Hash size={10} />
                                          {getPartNumber(
                                            item.part || item.part_id,
                                          )}
                                        </div>
                                      </td>
                                      <td className="py-2 text-center">
                                        {item.quantity}
                                      </td>

                                      {/* --- FIXED: Original Price Column --- */}
                                      <td className="py-2 text-right text-gray-500">
                                        {discount > 0 ? (
                                          <span className="line-through text-xs mr-2">
                                            {formatLKR(originalPrice)}
                                          </span>
                                        ) : (
                                          /* Show normal price if no discount */
                                          <span>
                                            {formatLKR(originalPrice)}
                                          </span>
                                        )}
                                      </td>

                                      {/* Discount */}
                                      <td className="py-2 text-right text-red-500 font-medium">
                                        {discount > 0
                                          ? `-${formatLKR(discount)}`
                                          : "-"}
                                      </td>

                                      {/* Final Price */}
                                      <td className="py-2 text-right font-medium text-green-700">
                                        {formatLKR(finalPrice)}
                                      </td>

                                      {/* Line Total */}
                                      <td className="py-2 text-right font-bold text-gray-800">
                                        {formatLKR(lineTotal)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>

    <WhatsAppShareFlow
      sale={saleToShare}
      onClose={() => setSaleToShare(null)}
      onAlert={setAlertInfo}
    />

    {/* Receipt/Invoice (per Options → Billing Method) — invisible on screen,
        only rendered for window.print() */}
    <div className="hidden print:block">
      {selectedSaleForPrint && <BillingDocument sale={selectedSaleForPrint} />}
    </div>
    </>
  );
};

export default SalesHistoryPage;
