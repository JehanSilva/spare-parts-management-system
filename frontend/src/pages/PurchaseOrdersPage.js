import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShoppingCart,
  Truck,
  Printer,
  Send,
  PackageCheck,
  Ban,
  Trash2,
  Package,
  XCircle,
  Loader2,
  ArrowRight,
  Undo2,
} from "lucide-react";
import {
  fetchPurchaseOrders,
  updatePurchaseOrder,
  deletePurchaseOrderItem,
  markPurchaseOrderOrdered,
  receivePurchaseOrder,
  cancelPurchaseOrder,
  deletePurchaseOrder,
  revertPurchaseOrder,
} from "../services/api";
import { useParts } from "../context/PartsContext";
import AlertComponent from "../components/AlertComponent";
import ConfirmModal from "../components/ConfirmModal";
import CopyButton from "../components/CopyButton";
import PurchaseOrderDocument from "../components/PurchaseOrderDocument";
import { apiErrorMessage } from "../components/apiErrorMessage";

const formatAmount = (amount) =>
  new Intl.NumberFormat("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    parseFloat(amount) || 0
  );

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "";

const TABS = [
  { status: "DRAFT", label: "Drafts" },
  { status: "ORDERED", label: "Ordered" },
  { status: "RECEIVED", label: "Received" },
  { status: "CANCELLED", label: "Cancelled" },
];

const STATUS_STYLE = {
  DRAFT: "bg-amber-100 text-amber-700",
  ORDERED: "bg-blue-100 text-blue-700",
  RECEIVED: "bg-green-100 text-green-700",
  CANCELLED: "bg-gray-200 text-gray-600",
};

const receivedSummary = (po) =>
  po.items
    .filter((i) => i.received_quantity > 0)
    .map((i) => `${i.received_quantity} × ${i.part_name}`)
    .join(", ");

const CONFIRM_TEXT = {
  delete: {
    title: "Delete purchase order?",
    message: (po) => `${po.po_number} for ${po.supplier_name} will be permanently removed.`,
    label: "Yes, Delete It",
  },
  cancel: {
    title: "Cancel purchase order?",
    message: (po) => `${po.po_number} will be marked as cancelled. Stock is not affected.`,
    label: "Yes, Cancel It",
  },
  revert: {
    title: "Revert to Ordered?",
    message: (po) =>
      `${po.po_number} goes back to Ordered and the received stock (${receivedSummary(po)}) is removed from inventory, along with any selling price change. You can then fix the quantities and costs and receive it again.`,
    label: "Yes, Revert It",
  },
};

const isEditable = (po) => po.status === "DRAFT" || po.status === "ORDERED";

// A number field that saves itself when it loses focus, and only if the value
// actually changed — the order list is edited in place, not through a form.
const InlineNumber = ({ value, onCommit, disabled, className = "", decimal = false }) => {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  if (disabled) return <span className={className}>{value}</span>;

  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value.replace(decimal ? /[^0-9.]/g : /[^0-9]/g, ""))}
      onBlur={() => {
        if (draft !== String(value)) onCommit(draft, () => setDraft(String(value)));
      }}
      onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
      inputMode={decimal ? "decimal" : "numeric"}
      className={`p-1.5 border border-gray-300 rounded-lg text-right text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none ${className}`}
    />
  );
};

// --- Receive delivery: confirm what actually arrived, then book it into stock ---
const ReceiveModal = ({ po, onClose, onReceived }) => {
  const [rows, setRows] = useState(() =>
    po.items.map((i) => ({
      id: i.id,
      received_quantity: String(i.quantity),
      unit_price: String(i.unit_price),
      // Pre-filled with the part's current price; only sent if it's changed.
      sell_price: i.current_sell_price != null ? String(i.current_sell_price) : "",
    }))
  );
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const setRow = (id, field, value) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const updated = await receivePurchaseOrder(po.id, {
        invoice_number: invoiceNumber,
        items: rows.map((r) => {
          const item = po.items.find((i) => i.id === r.id);
          const priceChanged =
            r.sell_price !== "" && parseFloat(r.sell_price) !== parseFloat(item.current_sell_price);
          return {
            id: r.id,
            received_quantity: parseInt(r.received_quantity, 10) || 0,
            unit_price: r.unit_price || "0",
            ...(priceChanged ? { sell_price: r.sell_price } : {}),
          };
        }),
      });
      onReceived(updated);
    } catch (err) {
      setError(apiErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-green-100 bg-green-50 flex items-center gap-3">
          <div className="p-2 rounded-full bg-green-100 text-green-700">
            <PackageCheck size={20} />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Receive {po.po_number}</h3>
            <p className="text-xs text-gray-500">
              Confirm what arrived from {po.supplier_name}. Received quantities are added to stock.
            </p>
          </div>
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600">
            <XCircle size={20} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Supplier invoice number <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            placeholder="e.g. INV-2041"
            className="w-full sm:w-64 p-2 border border-gray-300 rounded-lg text-sm mb-5 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
          />

          <div className="hidden sm:flex gap-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            <span className="flex-1">Item</span>
            <span className="w-16 text-right">Ordered</span>
            <span className="w-20 text-right">Received</span>
            <span className="w-28 text-right">Unit Cost</span>
            <span className="w-28 text-right">Sell Price</span>
          </div>
          {po.items.map((item) => {
            const row = rows.find((r) => r.id === item.id);
            const sellChanged =
              row.sell_price !== "" && parseFloat(row.sell_price) !== parseFloat(item.current_sell_price);
            return (
              <div
                key={item.id}
                className="flex flex-wrap sm:flex-nowrap items-center gap-2 py-2 border-b border-gray-100 last:border-0"
              >
                <div className="flex-1 min-w-[12rem]">
                  <p className="text-sm font-semibold text-gray-800">{item.part_name}</p>
                  <p className="text-[11px] text-gray-500 font-mono">{item.part_number}</p>
                </div>
                <span className="w-16 text-right text-sm text-gray-500">{item.quantity}</span>
                <input
                  value={row.received_quantity}
                  onChange={(e) => setRow(item.id, "received_quantity", e.target.value.replace(/[^0-9]/g, ""))}
                  inputMode="numeric"
                  className="w-20 p-1.5 border border-gray-300 rounded-lg text-right text-sm font-bold focus:ring-2 focus:ring-green-500 outline-none"
                />
                <input
                  value={row.unit_price}
                  onChange={(e) => setRow(item.id, "unit_price", e.target.value.replace(/[^0-9.]/g, ""))}
                  inputMode="decimal"
                  className="w-28 p-1.5 border border-gray-300 rounded-lg text-right text-sm focus:ring-2 focus:ring-green-500 outline-none"
                />
                <input
                  value={row.sell_price}
                  onChange={(e) => setRow(item.id, "sell_price", e.target.value.replace(/[^0-9.]/g, ""))}
                  inputMode="decimal"
                  disabled={item.current_sell_price == null}
                  placeholder="—"
                  title={
                    sellChanged
                      ? `Changing from ${formatAmount(item.current_sell_price)}`
                      : "Current selling price — change it to reprice this part"
                  }
                  className={`w-28 p-1.5 border rounded-lg text-right text-sm focus:ring-2 focus:ring-green-500 outline-none disabled:bg-gray-50 ${
                    sellChanged ? "border-amber-400 bg-amber-50 font-bold text-amber-800" : "border-gray-300"
                  }`}
                />
              </div>
            );
          })}
          <p className="mt-3 text-xs text-gray-400">
            Set Received to 0 for anything that didn&rsquo;t arrive. The unit cost updates each
            part&rsquo;s average buy price, the same as Quick Restock. Sell Price shows the
            current selling price — change it only if you want to reprice the part (changed
            prices are highlighted).
          </p>
          {error && <p className="mt-3 text-sm text-red-600 font-medium">{error}</p>}
        </div>

        <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 text-sm font-bold rounded-xl bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 flex items-center gap-2"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <PackageCheck size={16} />}
            Receive into Stock
          </button>
        </div>
      </div>
    </div>
  );
};

// --- One purchase order ---
const PurchaseOrderCard = ({ po, onChange, onAction, onError }) => {
  const editable = isEditable(po);
  const [notes, setNotes] = useState(po.notes || "");
  useEffect(() => setNotes(po.notes || ""), [po.notes]);

  const save = async (data, revert) => {
    try {
      onChange(await updatePurchaseOrder(po.id, data));
    } catch (err) {
      if (revert) revert();
      onError(err);
    }
  };

  const removeItem = async (itemId) => {
    try {
      onChange(await deletePurchaseOrderItem(itemId));
    } catch (err) {
      onError(err);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 bg-gray-50 border-b border-gray-100">
        <div className="p-2 bg-white rounded-xl border border-gray-200 text-gray-600">
          <Truck size={20} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-900 truncate">{po.supplier_name || "No supplier"}</h3>
            <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUS_STYLE[po.status]}`}>
              {po.status.toLowerCase()}
            </span>
          </div>
          <p className="text-xs text-gray-500">
            <span className="font-mono font-semibold">{po.po_number}</span>
            {" · "}created {formatDate(po.created_at)}
            {po.ordered_at && ` · ordered ${formatDate(po.ordered_at)}`}
            {po.received_at && ` · received ${formatDate(po.received_at)}`}
            {po.invoice_number && ` · invoice ${po.invoice_number}`}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-gray-500">{po.total_quantity} units</p>
          <p className="font-bold text-gray-900">LKR {formatAmount(po.total_amount)}</p>
        </div>
      </div>

      {/* Items */}
      <div className="px-5 py-3 overflow-x-auto">
        {po.items.length === 0 ? (
          <p className="text-sm text-gray-400 italic py-2">No items on this order.</p>
        ) : (
          <table className="w-full text-sm min-w-[36rem]">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-wider text-gray-400 text-left">
                <th className="py-2 font-bold">Item</th>
                <th className="py-2 font-bold text-right">In Stock</th>
                <th className="py-2 font-bold text-right">{po.status === "RECEIVED" ? "Ordered" : "Qty"}</th>
                {po.status === "RECEIVED" && <th className="py-2 font-bold text-right">Received</th>}
                <th className="py-2 font-bold text-right">Unit Cost</th>
                <th className="py-2 font-bold text-right">Amount</th>
                {editable && <th className="w-8" />}
              </tr>
            </thead>
            <tbody>
              {po.items.map((item) => (
                <tr key={item.id} className="border-t border-gray-100">
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-3">
                      {item.image ? (
                        <img src={item.image} alt="" className="w-9 h-9 rounded-lg object-cover border border-gray-100 shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-300 shrink-0">
                          <Package size={16} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 truncate">{item.part_name}</p>
                        <div className="flex items-center gap-0.5 text-[11px] text-gray-500 font-mono">
                          <span className="truncate">{item.part_number}</span>
                          <CopyButton text={item.part_number} label="part number" size={11} />
                          {item.brand && <span className="truncate">• {item.brand}</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2 text-right text-gray-500">{item.current_stock ?? "—"}</td>
                  <td className="py-2 text-right font-bold text-gray-900">
                    <InlineNumber
                      value={item.quantity}
                      disabled={!editable}
                      className="w-16"
                      onCommit={(v, revert) => save({ items: [{ id: item.id, quantity: v }] }, revert)}
                    />
                  </td>
                  {po.status === "RECEIVED" && (
                    <td className="py-2 text-right font-bold text-green-700">{item.received_quantity}</td>
                  )}
                  <td className="py-2 text-right text-gray-700">
                    <InlineNumber
                      value={item.unit_price}
                      disabled={!editable}
                      decimal
                      className="w-24"
                      onCommit={(v, revert) => save({ items: [{ id: item.id, unit_price: v }] }, revert)}
                    />
                  </td>
                  <td className="py-2 text-right font-semibold text-gray-900">{formatAmount(item.line_total)}</td>
                  {editable && (
                    <td className="py-2 text-right">
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                        title="Remove item"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {editable ? (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== (po.notes || "") && save({ notes })}
            placeholder="Notes for the supplier (optional) — printed on the order"
            rows={2}
            className="mt-3 w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
          />
        ) : (
          po.notes && <p className="mt-3 text-sm text-gray-600 whitespace-pre-wrap">{po.notes}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 px-5 py-3 border-t border-gray-100">
        <button
          onClick={() => onAction("print", po)}
          disabled={po.items.length === 0}
          className="px-3 py-2 text-sm font-semibold rounded-xl bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 disabled:opacity-50"
        >
          <Printer size={15} /> Print
        </button>
        {po.status === "DRAFT" && (
          <button
            onClick={() => onAction("order", po)}
            disabled={po.items.length === 0}
            className="px-3 py-2 text-sm font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1.5 disabled:opacity-50"
            title="Close this draft — new items for this supplier will start a new order"
          >
            <Send size={15} /> Mark as Ordered
          </button>
        )}
        {editable && (
          <button
            onClick={() => onAction("receive", po)}
            disabled={po.items.length === 0}
            className="px-3 py-2 text-sm font-bold rounded-xl bg-green-600 text-white hover:bg-green-700 flex items-center gap-1.5 disabled:opacity-50"
          >
            <PackageCheck size={15} /> Receive Delivery
          </button>
        )}
        {po.status === "RECEIVED" && (
          <button
            onClick={() => onAction("revert", po)}
            className="px-3 py-2 text-sm font-semibold rounded-xl bg-white border border-amber-300 text-amber-700 hover:bg-amber-50 flex items-center gap-1.5"
            title="Undo this receipt to correct quantities or costs"
          >
            <Undo2 size={15} /> Revert to Ordered
          </button>
        )}
        <div className="ml-auto flex gap-2">
          {po.status === "ORDERED" && (
            <button
              onClick={() => onAction("cancel", po)}
              className="px-3 py-2 text-sm font-semibold rounded-xl text-gray-500 hover:bg-gray-100 flex items-center gap-1.5"
            >
              <Ban size={15} /> Cancel Order
            </button>
          )}
          {po.status !== "RECEIVED" && (
            <button
              onClick={() => onAction("delete", po)}
              className="px-3 py-2 text-sm font-semibold rounded-xl text-red-600 hover:bg-red-50 flex items-center gap-1.5"
            >
              <Trash2 size={15} /> Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const PurchaseOrdersPage = () => {
  const { invalidateParts } = useParts();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("DRAFT");
  const [alertInfo, setAlertInfo] = useState({ type: "", message: "" });
  const [confirm, setConfirm] = useState(null); // { kind: "cancel" | "delete" | "revert", po }
  const [receivingPo, setReceivingPo] = useState(null);
  const [printJob, setPrintJob] = useState(null); // { po, at } — `at` re-triggers a reprint

  useEffect(() => {
    fetchPurchaseOrders()
      .then(setOrders)
      .catch((err) => setAlertInfo({ type: "error", message: apiErrorMessage(err) }))
      .finally(() => setLoading(false));
  }, []);

  // Print once the chosen order has rendered into the hidden print copy.
  useEffect(() => {
    if (printJob) window.print();
  }, [printJob]);

  const replaceOrder = (updated) =>
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  const showError = (err) => setAlertInfo({ type: "error", message: apiErrorMessage(err) });

  const handleAction = async (kind, po) => {
    if (kind === "print") {
      setPrintJob({ po, at: Date.now() });
    } else if (kind === "receive") {
      setReceivingPo(po);
    } else if (kind === "order") {
      try {
        replaceOrder(await markPurchaseOrderOrdered(po.id));
        setAlertInfo({
          type: "success",
          message: `${po.po_number} marked as ordered. New items for ${po.supplier_name} will start a new order.`,
        });
      } catch (err) {
        showError(err);
      }
    } else {
      setConfirm({ kind, po });
    }
  };

  const handleConfirm = async () => {
    const { kind, po } = confirm;
    setConfirm(null);
    try {
      if (kind === "delete") {
        await deletePurchaseOrder(po.id);
        setOrders((prev) => prev.filter((o) => o.id !== po.id));
        setAlertInfo({ type: "success", message: `${po.po_number} deleted.` });
      } else if (kind === "revert") {
        replaceOrder(await revertPurchaseOrder(po.id));
        invalidateParts();
        setTab("ORDERED");
        setAlertInfo({
          type: "success",
          message: `${po.po_number} reverted to Ordered — the received stock was removed. Correct it and receive it again.`,
        });
      } else {
        replaceOrder(await cancelPurchaseOrder(po.id));
        setAlertInfo({ type: "success", message: `${po.po_number} cancelled.` });
      }
    } catch (err) {
      showError(err);
    }
  };

  const counts = TABS.reduce(
    (acc, t) => ({ ...acc, [t.status]: orders.filter((o) => o.status === t.status).length }),
    {}
  );
  const visible = orders.filter((o) => o.status === tab);

  return (
    <>
      <div className="min-h-screen bg-gray-50 p-4 md:p-8 print:hidden">
        <div className="max-w-6xl mx-auto w-full">
          {alertInfo.message && (
            <AlertComponent
              type={alertInfo.type}
              message={alertInfo.message}
              onClose={() => setAlertInfo({ type: "", message: "" })}
            />
          )}

          <ConfirmModal
            isOpen={Boolean(confirm)}
            title={CONFIRM_TEXT[confirm?.kind]?.title}
            message={confirm ? CONFIRM_TEXT[confirm.kind].message(confirm.po) : ""}
            confirmLabel={CONFIRM_TEXT[confirm?.kind]?.label}
            onConfirm={handleConfirm}
            onCancel={() => setConfirm(null)}
          />

          {receivingPo && (
            <ReceiveModal
              po={receivingPo}
              onClose={() => setReceivingPo(null)}
              onReceived={(updated) => {
                setReceivingPo(null);
                replaceOrder(updated);
                invalidateParts();
                setAlertInfo({
                  type: "success",
                  message: `${updated.po_number} received — stock updated.`,
                });
              }}
            />
          )}

          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-700">
              <ShoppingCart size={26} />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Purchase Orders</h1>
              <p className="text-gray-500 mt-0.5">
                Parts to order, grouped by supplier. Add items with the cart button on the Inventory page.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {TABS.map((t) => (
              <button
                key={t.status}
                onClick={() => setTab(t.status)}
                className={`px-4 py-1.5 rounded-full text-sm font-bold border transition-colors ${
                  tab === t.status
                    ? "bg-gray-800 text-white border-gray-800"
                    : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {t.label}
                {counts[t.status] > 0 && <span className="ml-1.5 opacity-70">{counts[t.status]}</span>}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
              <ShoppingCart size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No {TABS.find((t) => t.status === tab).label.toLowerCase()} purchase orders.</p>
              {tab === "DRAFT" && (
                <Link
                  to="/inventory"
                  className="inline-flex items-center gap-1 mt-3 text-sm font-semibold text-red-700 hover:underline"
                >
                  Go to Inventory to add parts <ArrowRight size={14} />
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {visible.map((po) => (
                <PurchaseOrderCard
                  key={po.id}
                  po={po}
                  onChange={replaceOrder}
                  onAction={handleAction}
                  onError={showError}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Print copy — hidden on screen, the only thing window.print() emits. */}
      <div className="hidden print:block">
        {printJob && <PurchaseOrderDocument purchaseOrder={printJob.po} />}
      </div>
    </>
  );
};

export default PurchaseOrdersPage;
