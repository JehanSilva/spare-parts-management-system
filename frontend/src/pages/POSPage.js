import React, { useState, useEffect, useRef, useMemo, memo, useCallback } from "react";
import { createSale, fetchActiveCarts, syncActiveCarts, lookupVehicle, createCustomerVehicle, updateCustomerVehicle } from "../services/api";
import { useParts } from "../context/PartsContext";
import { useSettings } from "../context/SettingsContext";
import BillingDocument from "../components/BillingDocument";
import WhatsAppShareFlow from "../components/WhatsAppShareFlow";
import AlertComponent from "../components/AlertComponent";
import ConfirmModal from "../components/ConfirmModal";
import PartDetailsModal from "../components/PartDetailsModal";
import CustomerLinkPicker from "../components/CustomerLinkPicker";
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CheckCircle,
  Printer,
  Car,
  Package,
  AlertTriangle,
  ArrowLeft,
  ChevronUp,
  XCircle,
  Tag,
  RefreshCw,
  UserPlus,
  UserCheck,
  BadgeCheck,
  Loader2,
  Wallet,
  Wrench,
  Gauge,
  StickyNote,
  Pencil,
  MessageCircle,
} from "lucide-react";

// --- MEMOIZED PRODUCT ITEM COMPONENT ---
const ProductItem = memo(({ part, onAddToCart, onShowDetails }) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const pressTimer = useRef(null);
  const isLongPress = useRef(false);

  const startPress = () => {
    isLongPress.current = false;
    pressTimer.current = setTimeout(() => {
      onShowDetails(part);
      isLongPress.current = true;
    }, 500); // 500ms for long press
  };

  const endPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
    }
  };

  const handleClick = (e) => {
    if (isLongPress.current) {
      isLongPress.current = false;
      return;
    }
    onAddToCart(part);
  };

  return (
    <div
      onClick={handleClick}
      onContextMenu={(e) => { e.preventDefault(); }} // Prevent mobile context menu on long press
      onMouseDown={startPress}
      onMouseUp={endPress}
      onMouseLeave={endPress}
      onTouchStart={startPress}
      onTouchEnd={endPress}
      onTouchMove={endPress}
      className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col relative group cursor-pointer active:scale-95 touch-manipulation"
    >
      <div className="h-20 md:h-24 bg-gray-100 relative">
        {part.image ? (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 bg-gray-200 animate-pulse z-0">
                <div className="h-full w-full flex items-center justify-center">
                  <Package size={24} className="text-gray-300 opacity-20" />
                </div>
              </div>
            )}
            <img
              src={part.image}
              alt={part.name}
              loading="lazy"
              decoding="async"
              onLoad={() => setImgLoaded(true)}
              className={`w-full h-full object-cover transition-opacity duration-500 ${imgLoaded ? "opacity-100" : "opacity-0"
                }`}
            />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 bg-gray-50">
            <Package size={24} />
          </div>
        )}
        <div className="absolute bottom-1.5 left-1.5">
          {part.stock_qty < 2 ? (
            <span className="bg-red-500 text-white text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
              <AlertTriangle size={10} /> Low ({part.stock_qty})
            </span>
          ) : (
            <span className="bg-white/90 backdrop-blur text-gray-700 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm border border-gray-100">
              {part.stock_qty} available
            </span>
          )}
        </div>
      </div>
      <div className="p-2 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-bold text-gray-800 text-[11px] md:text-xs leading-snug line-clamp-2">
            {part.name}
          </h3>
          <p className="text-[10px] text-gray-400 font-mono mt-0.5">
            {part.part_number}
          </p>
        </div>
        <div className="mt-1.5 pt-1.5 border-t border-gray-50 flex items-center justify-between">
          <p className="text-[10px] text-gray-500 truncate">{part.brand}</p>
          <p className="text-xs font-bold text-red-600 shrink-0">
            {parseFloat(part.sell_price).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
});

// --- VEHICLE / CUSTOMER LOOKUP MODAL ---
const VehicleCustomerModal = ({
  isOpen,
  onClose,
  vehicleNumber,
  onVehicleNumberChange,
  vehicleLookupStatus,
  linkedVehicle,
  linkedCustomer,
  vehicleLabel,
  vehicleForm,
  setVehicleForm,
  vehicleSaving,
  onSaveVehicle,
  linkPickerOpen,
  setLinkPickerOpen,
  onCustomerSelected,
  onUnlinkCustomer,
  unlinkingCustomer,
  vehicleNumberInputRef,
  mileage,
  onMileageChange,
  notes,
  onNotesChange,
}) => {
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [confirmUnlinkOpen, setConfirmUnlinkOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDetailsExpanded(false);
      setConfirmUnlinkOpen(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const vehicleDetails = [
    linkedVehicle?.year && { label: "Year", value: linkedVehicle.year },
    linkedVehicle?.color && { label: "Color", value: linkedVehicle.color },
    linkedVehicle?.current_mileage != null && { label: "Mileage", value: `${linkedVehicle.current_mileage.toLocaleString()} km` },
  ].filter(Boolean);

  return (
    <>
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gray-900 p-4 text-white flex justify-between items-center shrink-0">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Car size={20} /> Vehicle & Customer
          </h3>
          <button onClick={onClose} className="hover:bg-white/10 p-1 rounded-full">
            <XCircle size={20} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3">
          {/* 1. Vehicle Number with smart lookup — always the first, primary action */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Vehicle No.
            </label>
            <div className="relative">
              <Car size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={vehicleNumberInputRef}
                value={vehicleNumber}
                onChange={(e) => onVehicleNumberChange(e.target.value)}
                className={`w-full pl-7 pr-7 py-2 bg-gray-50 border rounded-lg focus:bg-white outline-none text-sm transition-all ${vehicleLookupStatus === "found"
                    ? "border-green-400 focus:ring-1 focus:ring-green-400"
                    : vehicleLookupStatus === "not_found"
                      ? "border-amber-400 focus:ring-1 focus:ring-amber-400"
                      : "border-gray-200 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  }`}
                placeholder="Plate number..."
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                {vehicleLookupStatus === "searching" && <Loader2 size={13} className="text-gray-400 animate-spin" />}
                {vehicleLookupStatus === "found" && <BadgeCheck size={14} className="text-green-500" />}
                {vehicleLookupStatus === "not_found" && <UserPlus size={13} className="text-amber-500" />}
              </div>
            </div>
          </div>

          {/* 2. Vehicle state — save as standalone master data, no customer required */}
          {vehicleLookupStatus === "not_found" && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
              <p className="text-[11px] text-amber-700 font-medium">Vehicle not registered yet</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Make (e.g. Toyota)"
                  value={vehicleForm.make}
                  onChange={(e) => setVehicleForm((p) => ({ ...p, make: e.target.value }))}
                  className="w-1/2 px-2.5 py-2 text-sm bg-white border border-amber-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
                <input
                  type="text"
                  placeholder="Model (e.g. Corolla)"
                  value={vehicleForm.model}
                  onChange={(e) => setVehicleForm((p) => ({ ...p, model: e.target.value }))}
                  className="w-1/2 px-2.5 py-2 text-sm bg-white border border-amber-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>
              <button
                onClick={onSaveVehicle}
                disabled={vehicleSaving}
                className="w-full py-1.5 text-xs font-bold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-60"
              >
                {vehicleSaving ? "Saving..." : "Save Vehicle"}
              </button>
            </div>
          )}

          {vehicleLookupStatus === "found" && linkedVehicle && (
            <div className="bg-green-50 border border-green-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setDetailsExpanded((v) => !v)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left"
              >
                <Car size={12} className="text-green-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-green-800 truncate">
                    {[vehicleNumber, vehicleLabel].filter(Boolean).join(" · ")}
                  </p>
                  {vehicleDetails.length > 0 && (
                    <p className="text-[10px] text-green-600 truncate">
                      {vehicleDetails.map((d) => `${d.label}: ${d.value}`).join(" · ")}
                    </p>
                  )}
                </div>
                <ChevronUp size={12} className={`text-green-500 shrink-0 transition-transform ${detailsExpanded ? "" : "-rotate-90"}`} />
              </button>

              {detailsExpanded && (
                <div className="px-2.5 pb-2.5 pt-1.5 border-t border-green-200 space-y-1">
                  {linkedVehicle?.notes && (
                    <div className="text-[11px]">
                      <span className="text-green-600 block">Notes</span>
                      <span className="font-medium text-green-900">{linkedVehicle.notes}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => onVehicleNumberChange("")}
                    className="w-full mt-1.5 py-1.5 text-[11px] font-bold text-green-700 bg-white border border-green-300 rounded-lg hover:bg-green-100"
                  >
                    Change Vehicle
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 3. Job Details — mileage/notes for THIS repair, both optional
              ("if available"), independent of vehicle/customer link status */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Job Details (optional)</p>
            <div className="relative">
              <Gauge size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="number"
                min="0"
                value={mileage}
                onChange={(e) => onMileageChange(e.target.value)}
                placeholder="Current mileage (km), e.g. 45000"
                className="w-full pl-7 pr-2.5 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-400"
              />
            </div>
            <div className="relative">
              <StickyNote size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
              <textarea
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
                rows={2}
                placeholder="Notes about this repair, e.g. Replaced brake pads, checked alignment"
                className="w-full pl-7 pr-2.5 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-400 resize-none"
              />
            </div>
          </div>

          {/* 4. Link Customer — always optional, and independent of whether a
              vehicle is entered at all (works for a "customer only" sale too).
              Once linked, the only action is Unlink — to pick a different
              customer, unlink first, which reopens the search/create picker. */}
          {linkedCustomer && !linkPickerOpen ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-0.5">Linked Customer</p>
                  <p className="text-xs font-bold text-blue-900 truncate">{linkedCustomer.name}</p>
                  {(linkedCustomer.phone || linkedCustomer.email) && (
                    <p className="text-[10px] text-blue-600 truncate">
                      {[linkedCustomer.phone, linkedCustomer.email].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {linkedCustomer.address && (
                    <p className="text-[10px] text-blue-600 truncate">{linkedCustomer.address}</p>
                  )}
                </div>
                <button
                  onClick={() => setConfirmUnlinkOpen(true)}
                  disabled={unlinkingCustomer}
                  className="shrink-0 px-2.5 py-1 text-[10px] font-bold text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-60"
                >
                  {unlinkingCustomer ? "..." : "Unlink"}
                </button>
              </div>
            </div>
          ) : linkPickerOpen ? (
            <CustomerLinkPicker onSelect={onCustomerSelected} onCancel={() => setLinkPickerOpen(false)} />
          ) : (
            <button
              type="button"
              onClick={() => setLinkPickerOpen(true)}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-gray-500 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 border border-dashed border-gray-300 hover:border-blue-300 rounded-xl py-2.5 transition-colors"
            >
              <UserPlus size={13} /> Link a customer (optional)
            </button>
          )}
        </div>
      </div>
    </div>

    <ConfirmModal
      isOpen={confirmUnlinkOpen}
      title="Unlink Customer?"
      message={`Remove ${linkedCustomer?.name || "this customer"} from this vehicle/job?`}
      onConfirm={() => { setConfirmUnlinkOpen(false); onUnlinkCustomer(); }}
      onCancel={() => setConfirmUnlinkOpen(false)}
      confirmLabel="Unlink"
    />
    </>
  );
};

// --- PAYMENT MODE MODAL ---
const PaymentModal = ({
  isOpen,
  onClose,
  paymentMode,
  setPaymentMode,
  partialAmountPaid,
  setPartialAmountPaid,
  creditNote,
  setCreditNote,
  totalAmount,
  isCredit,
  partialAmountInputRef,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gray-900 p-4 text-white flex justify-between items-center shrink-0">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Wallet size={20} /> Payment
          </h3>
          <button onClick={onClose} className="hover:bg-white/10 p-1 rounded-full">
            <XCircle size={20} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3">
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => { setPaymentMode("PAID"); onClose(); }}
              className={`py-2 rounded-lg text-[11px] font-bold border transition-colors ${paymentMode === "PAID" ? "bg-red-600 text-white border-red-600" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}
            >
              Full Payment
            </button>
            <button
              type="button"
              onClick={() => setPaymentMode("PARTIAL")}
              className={`py-2 rounded-lg text-[11px] font-bold border transition-colors ${paymentMode === "PARTIAL" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}
            >
              Partial
            </button>
            <button
              type="button"
              onClick={() => setPaymentMode("CREDIT")}
              className={`py-2 rounded-lg text-[11px] font-bold border transition-colors ${paymentMode === "CREDIT" ? "bg-amber-500 text-white border-amber-500" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}
            >
              Full Credit
            </button>
          </div>

          {paymentMode === "PARTIAL" && (
            <div>
              <label className="text-[11px] font-semibold text-blue-700 mb-1 block">Amount Received Now</label>
              <input
                ref={partialAmountInputRef}
                type="number"
                min="0"
                step="0.01"
                value={partialAmountPaid}
                onChange={(e) => setPartialAmountPaid(e.target.value)}
                placeholder="e.g. 5000"
                className="w-full px-2.5 py-2 text-sm bg-blue-50 border border-blue-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder-blue-300"
              />
              <p className="text-[11px] text-blue-600 mt-1 font-medium">
                Balance on credit: LKR{" "}
                {Math.max(totalAmount - (parseFloat(partialAmountPaid) || 0), 0).toLocaleString()}
              </p>
            </div>
          )}

          {isCredit && (
            <textarea
              value={creditNote}
              onChange={(e) => setCreditNote(e.target.value)}
              placeholder="Credit note (optional) — e.g. will pay balance by Friday"
              rows={2}
              className="w-full px-2.5 py-2 text-xs bg-amber-50 border border-amber-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none placeholder-amber-400/70"
            />
          )}

          {paymentMode !== "PAID" && (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 text-xs font-bold text-white bg-gray-800 rounded-lg hover:bg-gray-900"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// --- REPAIR / LABOR ITEM MODAL ---
// Doubles as the "add" and "edit" form for a labor line item — editItem
// (when passed) seeds the fields and onAdd is called with the same id back
// so the caller can tell an edit from a fresh add.
const LaborItemModal = ({ isOpen, onClose, onAdd, editItem }) => {
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");

  useEffect(() => {
    if (isOpen) {
      setDescription(editItem ? editItem.name : "");
      setPrice(editItem ? String(editItem.sell_price) : "");
    }
  }, [isOpen, editItem]);

  if (!isOpen) return null;

  const canAdd = description.trim().length > 0 && parseFloat(price) > 0;
  const isEdit = !!editItem;

  const handleAdd = () => {
    if (!canAdd) return;
    onAdd(description.trim(), price, editItem ? editItem.id : null);
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gray-900 p-4 text-white flex justify-between items-center shrink-0">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Wrench size={20} /> {isEdit ? "Edit Repair / Labor" : "Add Repair / Labor"}
          </h3>
          <button onClick={onClose} className="hover:bg-white/10 p-1 rounded-full">
            <XCircle size={20} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Description *
            </label>
            <input
              type="text"
              autoFocus
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Brake pad replacement labor"
              className="w-full px-2.5 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:bg-white outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Price (LKR) *
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 3500"
              className="w-full px-2.5 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:bg-white outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={!canAdd}
            className="w-full py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50"
          >
            {isEdit ? "Save Changes" : "Add to Cart"}
          </button>
        </div>
      </div>
    </div>
  );
};

const POSPage = () => {
  // ── Parts cache ──────────────────────────────────────────────────────────
  const { allParts, partsLoading, invalidateParts } = useParts();
  // Billing method (Home → Options): "Receipt" or "Invoice".
  const { documentLabel } = useSettings();
  const [selectedPart, setSelectedPart] = useState(null);

  const [carts, setCarts] = useState([]);
  const [activeCartId, setActiveCartId] = useState("");
  const [cartsLoading, setCartsLoading] = useState(true);
  const isInitialLoadCompleted = useRef(false);
  const syncTimer = useRef(null);

  // Load carts from database on mount
  useEffect(() => {
    const loadCarts = async () => {
      setCartsLoading(true);
      try {
        const data = await fetchActiveCarts();
        const mapped = data.map((c) => ({
          id: c.id,
          customerName: c.customer_name,
          vehicleNumber: c.vehicle_number,
          customerId: c.customer || null,
          customerDetails: c.customer_details || null,
          items: c.items,
          mileage: c.mileage != null ? String(c.mileage) : "",
          notes: c.notes || "",
        }));

        if (mapped.length > 0) {
          setCarts(mapped);

          // Set active cart id
          const savedActiveId = localStorage.getItem("pos_active_cart_id");
          if (savedActiveId && mapped.some((c) => c.id === savedActiveId)) {
            setActiveCartId(savedActiveId);
          } else {
            setActiveCartId(mapped[0].id);
          }
        } else {
          // Initialize with a single default cart
          const newId = "cart_" + Date.now();
          const initialCarts = [
            {
              id: newId,
              customerName: "",
              vehicleNumber: "",
              customerId: null,
              customerDetails: null,
              items: [],
              mileage: "",
              notes: "",
            },
          ];
          setCarts(initialCarts);
          setActiveCartId(newId);

          // Sync this initial cart to the backend immediately
          await syncActiveCarts(initialCarts.map((c) => ({
            id: c.id,
            customer_name: c.customerName,
            vehicle_number: c.vehicleNumber,
            customer: c.customerId || null,
            items: c.items,
            mileage: c.mileage ? parseInt(c.mileage) : null,
            notes: c.notes || "",
          })));
        }
        // Only mark load as complete on success to prevent sync of empty state on failure
        isInitialLoadCompleted.current = true;
      } catch (error) {
        console.error("Failed to load active carts", error);
        setAlertInfo({ type: "error", message: "Failed to load ongoing repairs from database." });
      } finally {
        setCartsLoading(false);
      }
    };
    loadCarts();
  }, []);

  // Debounced sync to backend
  useEffect(() => {
    if (!isInitialLoadCompleted.current || cartsLoading) {
      return;
    }

    if (syncTimer.current) {
      clearTimeout(syncTimer.current);
    }

    syncTimer.current = setTimeout(async () => {
      try {
        const payload = carts.map((c) => ({
          id: c.id,
          customer_name: c.customerName,
          vehicle_number: c.vehicleNumber,
          customer: c.customerId || null,
          items: c.items,
          mileage: c.mileage ? parseInt(c.mileage) : null,
          notes: c.notes || "",
        }));
        await syncActiveCarts(payload);
      } catch (error) {
        console.error("Failed to sync carts to database", error);
      }
    }, 500); // 500ms debounce

    return () => {
      if (syncTimer.current) {
        clearTimeout(syncTimer.current);
      }
    };
  }, [carts, cartsLoading]);

  // Pull latest active carts from database
  const refreshCarts = async () => {
    setCartsLoading(true);
    try {
      const data = await fetchActiveCarts();
      const mapped = data.map((c) => ({
        id: c.id,
        customerName: c.customer_name,
        vehicleNumber: c.vehicle_number,
        customerId: c.customer || null,
        customerDetails: c.customer_details || null,
        items: c.items,
        mileage: c.mileage != null ? String(c.mileage) : "",
        notes: c.notes || "",
      }));
      if (mapped.length > 0) {
        setCarts(mapped);
        if (!activeCartId || !mapped.some((c) => c.id === activeCartId)) {
          setActiveCartId(mapped[0].id);
        }
        setAlertInfo({ type: "success", message: "Repairs synced with database." });
      } else {
        const newId = "cart_" + Date.now();
        const initialCarts = [
          {
            id: newId,
            customerName: "",
            vehicleNumber: "",
            customerId: null,
            customerDetails: null,
            items: [],
            mileage: "",
            notes: "",
          },
        ];
        setCarts(initialCarts);
        setActiveCartId(newId);
        await syncActiveCarts(initialCarts.map((c) => ({
          id: c.id,
          customer_name: c.customerName,
          vehicle_number: c.vehicleNumber,
          customer: c.customerId || null,
          items: c.items,
          mileage: c.mileage ? parseInt(c.mileage) : null,
          notes: c.notes || "",
        })));
      }
      // Only mark load as complete on success to prevent sync of empty state on failure
      isInitialLoadCompleted.current = true;
    } catch (error) {
      console.error("Failed to sync repairs", error);
      setAlertInfo({ type: "error", message: "Failed to sync repairs with database." });
    } finally {
      setCartsLoading(false);
    }
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [mobileView, setMobileView] = useState("products");
  const [visibleCount, setVisibleCount] = useState(20);

  const [cartToDelete, setCartToDelete] = useState(null);
  const [laborModalOpen, setLaborModalOpen] = useState(false);
  const [editingLaborItem, setEditingLaborItem] = useState(null);
  const [showNoCustomerConfirm, setShowNoCustomerConfirm] = useState(false);
  const [itemToRemove, setItemToRemove] = useState(null);
  const [showMileageWarning, setShowMileageWarning] = useState(false);
  const [mileageOverrideConfirmed, setMileageOverrideConfirmed] = useState(false);

  // Derived active cart states
  const activeCart = useMemo(() => {
    return (
      carts.find((c) => c.id === activeCartId) ||
      carts[0] || { id: "default", customerName: "", vehicleNumber: "", items: [], mileage: "", notes: "" }
    );
  }, [carts, activeCartId]);

  const cart = activeCart.items;
  const customerName = activeCart.customerName;
  const vehicleNumber = activeCart.vehicleNumber;
  const mileage = activeCart.mileage || "";
  const notes = activeCart.notes || "";

  // Persist active cart selection locally
  useEffect(() => {
    if (activeCartId) {
      localStorage.setItem("pos_active_cart_id", activeCartId);
    }
  }, [activeCartId]);

  const [loading, setLoading] = useState(false);
  const [saleSuccess, setSaleSuccess] = useState(null);

  // Alerts
  const [alertInfo, setAlertInfo] = useState({ type: "", message: "" });
  const [showConfirm, setShowConfirm] = useState(false);

  // --- Vehicle Lookup State ---
  // linkedVehicle is the full CustomerVehicle registry object (including a
  // nested customer_details, which may be null) — vehicle and customer are
  // independent master data, so a vehicle can exist/be used without ever
  // being linked to a customer. selectedCustomer covers the "customer only,
  // no vehicle" sale path, where there's nothing to attach a link to.
  const [vehicleLookupStatus, setVehicleLookupStatus] = useState("idle"); // idle | searching | found | not_found
  const [linkedVehicle, setLinkedVehicle] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const linkedCustomer = linkedVehicle?.customer_details || selectedCustomer;
  const [vehicleForm, setVehicleForm] = useState({ make: "", model: "" });
  const [vehicleSaving, setVehicleSaving] = useState(false);
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const [unlinkingCustomer, setUnlinkingCustomer] = useState(false);
  const vehicleLookupTimer = useRef(null);
  // Bumped on every lookup kicked off (typing or tab switch) so a slower,
  // now-superseded in-flight request can detect it's stale and no-op instead
  // of overwriting newer state when it eventually resolves.
  const vehicleLookupRequestRef = useRef(0);
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [focusVehicleOnOpen, setFocusVehicleOnOpen] = useState(false);
  const vehicleNumberInputRef = useRef(null);

  // Cache of vehicle_number -> { make, model } (or null if unregistered) so
  // the "Active Repairs" tab bar can show make/model for every repair tab,
  // not just the currently active one.
  const [vehicleInfoByNumber, setVehicleInfoByNumber] = useState({});
  const cacheVehicleInfo = useCallback((veh, vehicle) => {
    const key = (veh || "").trim().toUpperCase();
    if (!key) return;
    setVehicleInfoByNumber((prev) => ({
      ...prev,
      [key]: { make: vehicle?.make || "", model: vehicle?.model || "" },
    }));
  }, []);

  // --- Payment Mode State: PAID (full) | PARTIAL (part now, part on credit) | CREDIT (pay later) ---
  const [paymentMode, setPaymentMode] = useState("PAID");
  const [creditNote, setCreditNote] = useState("");
  const [partialAmountPaid, setPartialAmountPaid] = useState("");
  const isCredit = paymentMode !== "PAID";
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [focusPartialOnOpen, setFocusPartialOnOpen] = useState(false);
  const partialAmountInputRef = useRef(null);

  // Plain window.print() + CSS (see the print:hidden / print:block classes
  // in the success screen below), rather than react-to-print's iframe-based
  // approach — iOS Safari doesn't reliably scope window.print() to an
  // offscreen iframe's content and falls back to printing the whole page.
  const handlePrint = () => window.print();

  // ── Share receipt/invoice to WhatsApp ──────────────────────────────────
  // The flow itself (option chooser, phone entry, rasterising) lives in the
  // shared WhatsAppShareFlow, which Sales History reuses.
  const [saleToShare, setSaleToShare] = useState(null);
  const [whatsappSharing, setWhatsappSharing] = useState(false);


  // ── Client-side search — instant, zero network calls ──────────────────
  const filteredParts = useMemo(() => {
    if (!searchTerm.trim()) return allParts;
    const keywords = searchTerm.trim().toLowerCase().split(/\s+/);
    return allParts.filter((p) =>
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
  }, [allParts, searchTerm]);

  // Reset visible count when search term changes
  useEffect(() => {
    setVisibleCount(20);
  }, [searchTerm]);

  // 2.5 Multi-Cart Actions
  const handleAddNewCart = () => {
    const newId = "cart_" + Date.now();
    const newCart = {
      id: newId,
      customerName: "",
      vehicleNumber: "",
      items: [],
      mileage: "",
      notes: "",
    };
    setCarts((prev) => [...prev, newCart]);
    setActiveCartId(newId);
    setAlertInfo({ type: "success", message: "New repair cart created." });
  };

  const handleDeleteCart = (cartId) => {
    const targetCart = carts.find((c) => c.id === cartId);
    if (!targetCart) return;

    if (targetCart.items.length > 0) {
      setCartToDelete(cartId);
    } else {
      executeDeleteCart(cartId);
    }
  };

  const executeDeleteCart = (cartId) => {
    setCarts((prev) => {
      const remaining = prev.filter((c) => c.id !== cartId);
      if (remaining.length === 0) {
        const newId = "cart_" + Date.now();
        setActiveCartId(newId);
        return [{ id: newId, customerName: "", vehicleNumber: "", items: [], mileage: "", notes: "" }];
      }
      if (activeCartId === cartId) {
        setActiveCartId(remaining[0].id);
      }
      return remaining;
    });
    setCartToDelete(null);
    setAlertInfo({ type: "success", message: "Repair cart discarded." });
  };

  // Mileage/notes are per-job details — optional, entered "if available",
  // and scoped to whichever repair cart is currently active.
  const handleMileageChange = (value) => {
    setCarts((prev) => prev.map((c) => (c.id === activeCartId ? { ...c, mileage: value } : c)));
    setMileageOverrideConfirmed(false);
  };
  const handleNotesChange = (value) => {
    setCarts((prev) => prev.map((c) => (c.id === activeCartId ? { ...c, notes: value } : c)));
  };

  const handleVehicleNumberChange = (veh) => {
    const upperVeh = veh.toUpperCase();
    // Editing the plate invalidates whatever vehicle/customer was previously
    // linked to it, so clear the cart's customerName along with the lookup
    // state below — otherwise a stale name lingers after switching to an
    // unregistered/different plate.
    setCarts((prev) =>
      prev.map((c) => (c.id === activeCartId ? { ...c, vehicleNumber: upperVeh, customerName: "" } : c))
    );
    // Reset lookup state
    setLinkedVehicle(null);
    setSelectedCustomer(null);
    setLinkPickerOpen(false);
    setMileageOverrideConfirmed(false);
    setVehicleForm({ make: "", model: "" });
    setVehicleLookupStatus("idle");

    // Debounce vehicle number lookup
    if (vehicleLookupTimer.current) clearTimeout(vehicleLookupTimer.current);
    // Invalidate any lookup already in flight for a previous plate number —
    // cancelling the timer above only stops ones that hadn't fired yet; this
    // guards against a slower request resolving after a newer edit and
    // clobbering the current (correct) state with stale results.
    const requestId = ++vehicleLookupRequestRef.current;
    if (upperVeh.length >= 3) {
      setVehicleLookupStatus("searching");
      vehicleLookupTimer.current = setTimeout(async () => {
        try {
          const result = await lookupVehicle(upperVeh);
          if (vehicleLookupRequestRef.current !== requestId) return; // superseded by a newer edit
          if (result.found) {
            setLinkedVehicle(result.vehicle);
            cacheVehicleInfo(upperVeh, result.vehicle);
            setVehicleLookupStatus("found");
            // Auto-fill customer name if this vehicle already has a linked customer
            if (result.vehicle.customer_details) {
              setCarts((prev) =>
                prev.map((c) =>
                  c.id === activeCartId ? { ...c, customerName: result.vehicle.customer_details.name } : c
                )
              );
            }
          } else {
            setVehicleLookupStatus("not_found");
          }
        } catch {
          if (vehicleLookupRequestRef.current === requestId) setVehicleLookupStatus("idle");
        }
      }, 600);
    }
  };

  // Register the current (unregistered) plate as a new standalone vehicle —
  // independent master data, no customer required. Linking one is a
  // separate, optional step (see handleCustomerSelected below).
  const handleSaveVehicle = async () => {
    setVehicleSaving(true);
    try {
      const payload = { vehicle_number: vehicleNumber.trim() };
      if (vehicleForm.make.trim()) payload.make = vehicleForm.make.trim();
      if (vehicleForm.model.trim()) payload.model = vehicleForm.model.trim();
      const newVehicle = await createCustomerVehicle(payload);
      setLinkedVehicle(newVehicle);
      cacheVehicleInfo(vehicleNumber, newVehicle);
      setVehicleLookupStatus("found");
      setAlertInfo({ type: "success", message: `${newVehicle.vehicle_number} added to the vehicle registry!` });
    } catch (err) {
      setAlertInfo({ type: "error", message: err.response?.data?.vehicle_number?.[0] || "Failed to save vehicle." });
    } finally {
      setVehicleSaving(false);
    }
  };

  // Link (or, if there's no vehicle yet, simply select) a customer — chosen
  // via the shared CustomerLinkPicker, which handles searching existing
  // customers or creating a new one.
  const handleCustomerSelected = async (customer) => {
    try {
      if (linkedVehicle) {
        setLinkedVehicle(await updateCustomerVehicle(linkedVehicle.id, { customer: customer.id }));
        setCarts((prev) =>
          prev.map((c) => (c.id === activeCartId ? { ...c, customerName: customer.name } : c))
        );
      } else {
        // Customer-only path (no vehicle): stamp the real id + details onto
        // the cart itself so this link survives a tab switch or reload —
        // selectedCustomer alone is transient state.
        setSelectedCustomer(customer);
        setCarts((prev) =>
          prev.map((c) =>
            c.id === activeCartId
              ? { ...c, customerName: customer.name, customerId: customer.id, customerDetails: customer }
              : c
          )
        );
      }
      setLinkPickerOpen(false);
    } catch {
      setAlertInfo({ type: "error", message: "Failed to link customer." });
    }
  };

  const handleUnlinkCustomer = async () => {
    setUnlinkingCustomer(true);
    try {
      if (linkedVehicle) {
        setLinkedVehicle(await updateCustomerVehicle(linkedVehicle.id, { customer: null }));
        setCarts((prev) =>
          prev.map((c) => (c.id === activeCartId ? { ...c, customerName: "" } : c))
        );
      } else {
        setSelectedCustomer(null);
        setCarts((prev) =>
          prev.map((c) =>
            c.id === activeCartId ? { ...c, customerName: "", customerId: null, customerDetails: null } : c
          )
        );
      }
    } catch {
      setAlertInfo({ type: "error", message: "Failed to unlink customer." });
    } finally {
      setUnlinkingCustomer(false);
    }
  };

  // Re-resolve the vehicle/customer link for whichever cart becomes active
  // (each cart keeps its own vehicleNumber, but the lookup result was only
  // ever held in this shared state, so switching tabs used to wipe it).
  useEffect(() => {
    setVehicleModalOpen(false);
    setLinkPickerOpen(false);
    setVehicleForm({ make: "", model: "" });
    setPaymentMode("PAID");
    setCreditNote("");
    setPartialAmountPaid("");
    setPaymentModalOpen(false);

    setLinkedVehicle(null);
    // Restore a customer-only link (no vehicle) from the cart itself — this
    // is what makes that link survive a tab switch or a full page reload,
    // instead of only ever living in this transient state.
    setSelectedCustomer(activeCart.customerDetails || null);
    setMileageOverrideConfirmed(false);
    if (vehicleLookupTimer.current) clearTimeout(vehicleLookupTimer.current);
    // Invalidate any lookup still in flight from before the switch (e.g. one
    // kicked off by typing on the previous cart) so its stale result can't
    // bleed into whichever cart is now displayed.
    const requestId = ++vehicleLookupRequestRef.current;

    const veh = vehicleNumber.trim().toUpperCase();
    if (veh.length >= 3) {
      setVehicleLookupStatus("searching");
      lookupVehicle(veh)
        .then((result) => {
          if (vehicleLookupRequestRef.current !== requestId) return;
          if (result.found) {
            setLinkedVehicle(result.vehicle);
            cacheVehicleInfo(veh, result.vehicle);
            setVehicleLookupStatus("found");
          } else {
            setVehicleLookupStatus("not_found");
          }
        })
        .catch(() => {
          if (vehicleLookupRequestRef.current === requestId) setVehicleLookupStatus("idle");
        });
    } else {
      setVehicleLookupStatus("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCartId]);

  // Resolve make/model for every repair tab's vehicle number (not just the
  // active one) so the "Active Repairs" bar can show it for all tabs.
  const cartVehicleNumbers = carts.map((c) => (c.vehicleNumber || "").trim().toUpperCase()).join("|");
  useEffect(() => {
    let ignore = false;
    const numbers = Array.from(new Set(cartVehicleNumbers.split("|").filter((v) => v.length >= 3)));
    const missing = numbers.filter((v) => !(v in vehicleInfoByNumber));
    missing.forEach((veh) => {
      lookupVehicle(veh)
        .then((result) => {
          if (ignore) return;
          setVehicleInfoByNumber((prev) =>
            veh in prev ? prev : { ...prev, [veh]: result.found ? { make: result.vehicle?.make || "", model: result.vehicle?.model || "" } : null }
          );
        })
        .catch(() => {
          if (!ignore) {
            setVehicleInfoByNumber((prev) => (veh in prev ? prev : { ...prev, [veh]: null }));
          }
        });
    });
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartVehicleNumbers]);

  // Focus the Vehicle No. field once the modal opens in response to the
  // Complete Sale required-field guard (see handleCheckout).
  useEffect(() => {
    if (vehicleModalOpen && focusVehicleOnOpen) {
      const t = setTimeout(() => vehicleNumberInputRef.current?.focus(), 50);
      setFocusVehicleOnOpen(false);
      return () => clearTimeout(t);
    }
  }, [vehicleModalOpen, focusVehicleOnOpen]);

  // Focus the partial-amount field once the Payment modal opens in response
  // to the Complete Sale required-field guard (see handleCheckout).
  useEffect(() => {
    if (paymentModalOpen && focusPartialOnOpen) {
      const t = setTimeout(() => partialAmountInputRef.current?.focus(), 50);
      setFocusPartialOnOpen(false);
      return () => clearTimeout(t);
    }
  }, [paymentModalOpen, focusPartialOnOpen]);

  // 3. Add to Cart
  const addToCart = useCallback((part) => {
    setCarts((prevCarts) => {
      return prevCarts.map((c) => {
        if (c.id !== activeCartId) return c;

        const prevCart = c.items;
        const existingItem = prevCart.find((item) => item.id === part.id);

        let newItems;
        if (existingItem) {
          if (existingItem.quantity + 1 > part.stock_qty) {
            setAlertInfo({
              type: "error",
              message: `Not enough stock! Only ${part.stock_qty} available.`,
            });
            return c;
          }
          newItems = prevCart.map((item) =>
            item.id === part.id ? { ...item, quantity: item.quantity + 1 } : item
          );
        } else {
          if (part.stock_qty < 1) {
            setAlertInfo({ type: "error", message: "Item is Out of Stock!" });
            return c;
          }
          newItems = [
            { ...part, quantity: 1, discountAmount: 0, discountPercentInput: "" },
            ...prevCart,
          ];
        }
        return { ...c, items: newItems };
      });
    });
  }, [activeCartId]);

  // 3.5 Add (or edit) a Repair/Labor line item — priced by hand, not tied to
  // the Part catalog or stock. Shaped with the same field names (name/
  // sell_price/quantity/discountAmount/discountPercentInput) a Part-spread
  // cart item already has, so quantity/discount handling and totals work
  // unchanged. When editItemId is set (editing an existing line via the
  // pencil button) the item is updated in place instead of prepended.
  const handleAddLaborItem = (description, price, editItemId) => {
    setCarts((prev) =>
      prev.map((c) => {
        if (c.id !== activeCartId) return c;

        if (editItemId) {
          const newItems = c.items.map((item) => {
            if (item.id !== editItemId) return item;
            const newPrice = parseFloat(price);
            let discountAmount = item.discountAmount || 0;
            if (discountAmount > newPrice) discountAmount = newPrice;
            return { ...item, name: description, sell_price: newPrice, discountAmount };
          });
          return { ...c, items: newItems };
        }

        const newItem = {
          id: `labor_${Date.now()}`,
          item_type: "LABOR",
          name: description,
          sell_price: parseFloat(price),
          quantity: 1,
          discountAmount: 0,
          discountPercentInput: "",
        };
        return { ...c, items: [newItem, ...c.items] };
      })
    );
    setLaborModalOpen(false);
    setEditingLaborItem(null);
  };

  const handleOpenEditLabor = (item) => {
    setEditingLaborItem(item);
    setLaborModalOpen(true);
  };

  // 4. Remove from Cart
  const removeFromCart = (id) => {
    setCarts((prev) =>
      prev.map((c) =>
        c.id === activeCartId
          ? { ...c, items: c.items.filter((item) => item.id !== id) }
          : c
      )
    );
  };

  const handleConfirmRemoveItem = () => {
    if (itemToRemove) removeFromCart(itemToRemove.id);
    setItemToRemove(null);
  };

  // 5. Update Quantity
  const updateQuantity = (id, delta) => {
    setCarts((prev) =>
      prev.map((c) => {
        if (c.id !== activeCartId) return c;

        const newItems = c.items.map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            if (newQty > item.stock_qty) {
              setAlertInfo({
                type: "error",
                message: `Max stock is ${item.stock_qty}`,
              });
              return item;
            }
            return newQty > 0 ? { ...item, quantity: newQty } : item;
          }
          return item;
        });
        return { ...c, items: newItems };
      })
    );
  };

  // 5.5 Update Discount Amount
  const updateDiscountAmount = (id, amountStr) => {
    setCarts((prev) =>
      prev.map((c) => {
        if (c.id !== activeCartId) return c;

        const newItems = c.items.map((item) => {
          if (item.id === id) {
            if (amountStr === "") {
              return {
                ...item,
                discountAmount: 0,
                discountPercentInput: "",
              };
            }

            let amount = parseFloat(amountStr);
            if (isNaN(amount)) amount = 0;
            if (amount < 0) amount = 0;

            const sellPrice = parseFloat(item.sell_price || 0);
            if (amount > sellPrice) amount = sellPrice;

            const percent = sellPrice > 0 ? (amount / sellPrice) * 100 : 0;

            return {
              ...item,
              discountAmount: amount,
              discountPercentInput: parseFloat(percent.toFixed(2)).toString(),
            };
          }
          return item;
        });
        return { ...c, items: newItems };
      })
    );
  };

  // 5.6 Update Discount Percent
  const updateDiscountPercent = (id, percentStr) => {
    setCarts((prev) =>
      prev.map((c) => {
        if (c.id !== activeCartId) return c;

        const newItems = c.items.map((item) => {
          if (item.id === id) {
            if (percentStr === "") {
              return {
                ...item,
                discountAmount: 0,
                discountPercentInput: "",
              };
            }

            let percent = parseFloat(percentStr);
            if (isNaN(percent)) percent = 0;
            if (percent < 0) percent = 0;
            if (percent > 100) percent = 100;

            const sellPrice = parseFloat(item.sell_price || 0);
            let amount = (percent / 100) * sellPrice;
            amount = Math.round(amount * 100) / 100;

            return {
              ...item,
              discountAmount: amount,
              discountPercentInput: percentStr,
            };
          }
          return item;
        });
        return { ...c, items: newItems };
      })
    );
  };

  const handleClearCartRequest = () => {
    if (cart.length === 0) return;
    setShowConfirm(true);
  };

  const executeClearCart = () => {
    setCarts((prev) =>
      prev.map((c) =>
        c.id === activeCartId
          ? { ...c, customerName: "", vehicleNumber: "", items: [], mileage: "", notes: "" }
          : c
      )
    );
    setShowConfirm(false);
    setAlertInfo({ type: "success", message: "Cart cleared successfully." });
  };

  // 6. Calculate Totals (Visual Only) - Memoized
  const totalAmount = useMemo(() => {
    return cart.reduce((sum, item) => {
      const originalPrice = parseFloat(item.sell_price) || 0;
      const discountVal = parseFloat(item.discountAmount) || 0;
      const finalPrice = originalPrice - discountVal;
      return sum + finalPrice * item.quantity;
    }, 0);
  }, [cart]);

  const totalItems = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const vehicleLabel = useMemo(
    () => [linkedVehicle?.make, linkedVehicle?.model].filter(Boolean).join(" "),
    [linkedVehicle]
  );

  // 7. Checkout Logic (The Critical Part)
  // Entry point for the "Complete Sale" button. A cart with no vehicle or
  // customer linked (e.g. a walk-in bringing in just parts) is allowed to
  // check out — we just confirm that's intentional first, rather than
  // blocking it outright.
  const handleCheckout = () => {
    if (cart.length === 0) {
      setAlertInfo({
        type: "error",
        message: "Cart is empty. Add items first.",
      });
      return;
    }
    const enteredMileage = mileage ? parseInt(mileage, 10) : null;
    const lastMileage = linkedVehicle?.current_mileage;
    if (
      !mileageOverrideConfirmed &&
      enteredMileage != null &&
      lastMileage != null &&
      enteredMileage < lastMileage
    ) {
      setShowMileageWarning(true);
      return;
    }
    if (!customerName) {
      setShowNoCustomerConfirm(true);
      return;
    }
    proceedCheckout();
  };

  const handleConfirmMileageWarning = () => {
    setShowMileageWarning(false);
    setMileageOverrideConfirmed(true);
    if (!customerName) {
      setShowNoCustomerConfirm(true);
    } else {
      proceedCheckout(true);
    }
  };

  const handleConfirmNoCustomerCheckout = () => {
    setShowNoCustomerConfirm(false);
    proceedCheckout(mileageOverrideConfirmed);
  };

  const proceedCheckout = async (forceMileageUpdate = false) => {
    let partialPaidNow = 0;
    if (paymentMode === "PARTIAL") {
      partialPaidNow = parseFloat(partialAmountPaid);
      if (!partialAmountPaid || isNaN(partialPaidNow) || partialPaidNow <= 0 || partialPaidNow >= totalAmount) {
        setAlertInfo({
          type: "error",
          message: "Enter a valid amount received now — greater than 0 and less than the total.",
        });
        setPaymentModalOpen(true);
        setFocusPartialOnOpen(true);
        return;
      }
    }

    setLoading(true);

    const fallbackCustomerName = vehicleLabel || vehicleNumber || "Walk-in Customer";

    const salePayload = {
      customer_name: customerName || fallbackCustomerName,
      vehicle_number: vehicleNumber,
      mileage: mileage ? parseInt(mileage) : null,
      force_mileage_update: forceMileageUpdate,
      notes: notes.trim(),
      ...(linkedCustomer ? { customer: linkedCustomer.id } : {}),
      payment_status: paymentMode,
      ...(isCredit ? { credit_note: creditNote.trim() } : {}),
      ...(paymentMode === "PARTIAL" ? { amount_paid: partialPaidNow } : {}),
      items: cart.map((item) => {
        const originalPrice = parseFloat(item.sell_price) || 0;
        const discountAmount = parseFloat(item.discountAmount) || 0;

        if (item.item_type === "LABOR") {
          return {
            item_type: "LABOR",
            description: item.name,
            quantity: parseInt(item.quantity),
            unit_price: originalPrice,
            discount: discountAmount,
          };
        }

        return {
          item_type: "PART",
          part_id: item.id,
          quantity: parseInt(item.quantity),
          unit_price: originalPrice,
          discount: discountAmount,
          warranty: item.warranty || 0,
        };
      }),
    };

    console.log("🚀 Sending Sale Payload:", salePayload);

    try {
      const result = await createSale(salePayload);

      const enrichedItems = result.items.map((saleItem) => {
        const partId = saleItem.part || saleItem.part_id;
        const originalPart = allParts.find((p) => p.id === partId);
        return {
          ...saleItem,
          part_number: originalPart ? originalPart.part_number : "",
          part_name: originalPart
            ? originalPart.name
            : saleItem.part_name || "Unknown",
        };
      });

      // Capture the customer's phone now — linkedCustomer is about to be reset
      // to the next active cart's customer as soon as activeCartId changes below.
      const enrichedSale = { ...result, items: enrichedItems, customer_phone: linkedCustomer?.phone || result.customer_phone || null };
      setSaleSuccess(enrichedSale);

      setCarts((prev) => {
        const remaining = prev.filter((c) => c.id !== activeCartId);
        if (remaining.length === 0) {
          const newId = "cart_" + Date.now();
          setActiveCartId(newId);
          return [{ id: newId, customerName: "", vehicleNumber: "", customerId: null, customerDetails: null, items: [], mileage: "", notes: "" }];
        } else {
          setActiveCartId(remaining[0].id);
          return remaining;
        }
      });

      // Invalidate cache so stock levels update across all pages
      invalidateParts();

      setAlertInfo({
        type: "success",
        message:
          paymentMode === "CREDIT"
            ? "Sale completed and recorded as Credit (Pay Later)."
            : paymentMode === "PARTIAL"
              ? "Sale completed with a partial payment. Balance recorded as due."
              : "Sale completed successfully!",
      });
    } catch (error) {
      console.error("Sale Error:", error);
      const serverMessage =
        error.response?.data?.error || "Connection to server failed.";
      setAlertInfo({ type: "error", message: `Sale Failed: ${serverMessage}` });
    }
    setLoading(false);
  };

  // --- MAIN LAYOUT DATA ---
  const visibleParts = useMemo(() => {
    return filteredParts.slice(0, visibleCount);
  }, [filteredParts, visibleCount]);

  // --- MAIN LAYOUT & SUCCESS SCREEN ---
  const successDue = saleSuccess
    ? parseFloat(saleSuccess.total_amount) - parseFloat(saleSuccess.amount_paid || 0)
    : 0;

  return saleSuccess ? (
    <>
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50/50 p-4 animate-fade-in backdrop-blur-sm print:hidden">
      <div className="bg-white rounded-[2rem] shadow-2xl shadow-gray-200/50 p-8 md:p-10 max-w-lg w-full text-center relative overflow-hidden">

        {/* Success Icon */}
        <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce-slow ring-8 ${saleSuccess.payment_status === "CREDIT" ? "bg-amber-50 ring-amber-50/50" : saleSuccess.payment_status === "PARTIAL" ? "bg-blue-50 ring-blue-50/50" : "bg-green-50 ring-green-50/50"
          }`}>
          {saleSuccess.payment_status === "CREDIT" ? (
            <UserCheck className="text-amber-500 w-12 h-12" strokeWidth={3} />
          ) : saleSuccess.payment_status === "PARTIAL" ? (
            <Wallet className="text-blue-500 w-12 h-12" strokeWidth={3} />
          ) : (
            <CheckCircle className="text-green-500 w-12 h-12" strokeWidth={3} />
          )}
        </div>

        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-800 mb-2 tracking-tight">
          {saleSuccess.payment_status === "CREDIT" ? "Sale Recorded on Credit" : saleSuccess.payment_status === "PARTIAL" ? "Partial Payment Recorded" : "Payment Successful!"}
        </h1>
        <p className="text-gray-400 mb-8 font-medium">
          Transaction ID <span className="text-gray-600 font-mono">#{saleSuccess.id.substring(0, 8)}</span>
        </p>

        {/* Receipt Summary - Softened */}
        <div className="bg-gray-50/80 rounded-2xl p-6 mb-8 text-left space-y-4">
          <div className="flex justify-between items-center pb-4 border-b border-gray-100 border-dashed">
            <span className="text-gray-400 text-sm font-medium uppercase tracking-wide">
              {saleSuccess.payment_status === "PAID" ? "Total Paid" : "Amount Due"}
            </span>
            <span className="text-2xl font-black text-gray-800">
              LKR {(saleSuccess.payment_status === "PAID" ? parseFloat(saleSuccess.total_amount) : successDue).toLocaleString()}
            </span>
          </div>
          {saleSuccess.payment_status === "PARTIAL" && (
            <div className="flex justify-between items-center text-sm -mt-2">
              <span className="text-gray-500">Received Now</span>
              <span className="font-bold text-blue-700">LKR {parseFloat(saleSuccess.amount_paid).toLocaleString()} / {parseFloat(saleSuccess.total_amount).toLocaleString()}</span>
            </div>
          )}
          <div className="space-y-2 pt-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">Customer</span>
              <span className="font-bold text-gray-700">{saleSuccess.customer_name}</span>
            </div>
            {saleSuccess.vehicle_number && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Vehicle</span>
                <span className="font-bold text-gray-700 flex items-center gap-1.5"><Car size={14} className="text-gray-400" />{saleSuccess.vehicle_number}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">Items</span>
              <span className="font-bold text-gray-700">{saleSuccess.items.length} purchased</span>
            </div>
            {saleSuccess.payment_status === "CREDIT" && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Payment</span>
                <span className="font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full text-xs">Credit (Pay Later)</span>
              </div>
            )}
            {saleSuccess.payment_status === "PARTIAL" && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Payment</span>
                <span className="font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full text-xs">Partial — Balance on Credit</span>
              </div>
            )}
            {saleSuccess.payment_status !== "PAID" && saleSuccess.credit_note && (
              <div className="text-xs text-gray-500 italic bg-amber-50/60 border border-amber-100 rounded-lg px-2.5 py-1.5 mt-1">
                "{saleSuccess.credit_note}"
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handlePrint}
              className="flex-1 bg-slate-900 text-white px-5 py-3.5 rounded-xl shadow-md shadow-slate-100 hover:shadow-lg hover:bg-slate-800 hover:translate-y-[-1px] active:translate-y-0 flex items-center justify-center gap-2 font-bold text-sm transition-all duration-200 whitespace-nowrap"
            >
              <Printer size={18} /> {documentLabel}
            </button>
            <button
              onClick={() => setSaleToShare(saleSuccess)}
              disabled={whatsappSharing}
              className="flex-1 bg-emerald-600 text-white px-5 py-3.5 rounded-xl shadow-md shadow-emerald-100 hover:shadow-lg hover:bg-emerald-500 hover:translate-y-[-1px] active:translate-y-0 flex items-center justify-center gap-2 font-bold text-sm transition-all duration-200 disabled:opacity-60 whitespace-nowrap"
            >
              <MessageCircle size={18} /> {whatsappSharing ? "Preparing..." : "Share to WhatsApp"}
            </button>
          </div>
          <button
            onClick={() => setSaleSuccess(null)}
            className="w-full bg-red-600 text-white px-5 py-3.5 rounded-xl shadow-md shadow-red-100 hover:shadow-lg hover:bg-red-700 hover:translate-y-[-1px] active:translate-y-0 font-bold flex items-center justify-center gap-2 transition-all duration-200"
          >
            <Plus size={18} /> New Sale
          </button>
        </div>
      </div>
    </div>

    <WhatsAppShareFlow
      sale={saleToShare}
      onClose={() => setSaleToShare(null)}
      onAlert={setAlertInfo}
      onSharingChange={setWhatsappSharing}
    />

    {/* Receipt/Invoice (per Options → Billing Method) — rendered off-screen
        and only positioned normally for print. */}
    <div className="fixed top-0 -left-[9999px] print:static print:left-auto">
      <BillingDocument sale={saleSuccess} />
    </div>
    </>
  ) : (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-gray-100 overflow-hidden relative">
      <PartDetailsModal part={selectedPart} onClose={() => setSelectedPart(null)} />
      {alertInfo.message && (
        <AlertComponent
          type={alertInfo.type}
          message={alertInfo.message}
          onClose={() => setAlertInfo({ type: "", message: "" })}
        />
      )}

      <ConfirmModal
        isOpen={showConfirm}
        title="Clear Cart?"
        message="Are you sure you want to clear the entire cart?"
        onConfirm={executeClearCart}
        onCancel={() => setShowConfirm(false)}
      />

      <ConfirmModal
        isOpen={!!cartToDelete}
        title="Discard Repair Cart?"
        message="Are you sure you want to discard this repair cart? All items added will be lost."
        onConfirm={() => executeDeleteCart(cartToDelete)}
        onCancel={() => setCartToDelete(null)}
      />

      <ConfirmModal
        isOpen={!!itemToRemove}
        title="Remove Item?"
        message={`Remove "${itemToRemove?.name || "this item"}" from the cart?`}
        onConfirm={handleConfirmRemoveItem}
        onCancel={() => setItemToRemove(null)}
        confirmLabel="Remove Item"
      />

      <ConfirmModal
        isOpen={showMileageWarning}
        title="Mileage Lower Than Last Recorded"
        message={
          `The entered mileage (${mileage ? parseInt(mileage, 10).toLocaleString() : ""} km) is less than ` +
          `the last recorded mileage for this vehicle (${linkedVehicle?.current_mileage?.toLocaleString() || ""} km). ` +
          `Continue anyway?`
        }
        onConfirm={handleConfirmMileageWarning}
        onCancel={() => setShowMileageWarning(false)}
        confirmLabel="Continue Anyway"
      />

      <ConfirmModal
        isOpen={showNoCustomerConfirm}
        title={vehicleNumber ? "No Customer Linked" : "No Vehicle or Customer Linked"}
        message={
          vehicleNumber
            ? "This sale has no customer attached. Continue anyway?"
            : "This sale has no vehicle or customer attached. Continue anyway?"
        }
        onConfirm={handleConfirmNoCustomerCheckout}
        onCancel={() => setShowNoCustomerConfirm(false)}
        confirmLabel="Continue Anyway"
        tone="info"
      />

      <VehicleCustomerModal
        isOpen={vehicleModalOpen}
        onClose={() => setVehicleModalOpen(false)}
        vehicleNumber={vehicleNumber}
        onVehicleNumberChange={handleVehicleNumberChange}
        vehicleLookupStatus={vehicleLookupStatus}
        linkedVehicle={linkedVehicle}
        linkedCustomer={linkedCustomer}
        vehicleLabel={vehicleLabel}
        vehicleForm={vehicleForm}
        setVehicleForm={setVehicleForm}
        vehicleSaving={vehicleSaving}
        onSaveVehicle={handleSaveVehicle}
        linkPickerOpen={linkPickerOpen}
        setLinkPickerOpen={setLinkPickerOpen}
        onCustomerSelected={handleCustomerSelected}
        onUnlinkCustomer={handleUnlinkCustomer}
        unlinkingCustomer={unlinkingCustomer}
        vehicleNumberInputRef={vehicleNumberInputRef}
        mileage={mileage}
        onMileageChange={handleMileageChange}
        notes={notes}
        onNotesChange={handleNotesChange}
      />

      <PaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        paymentMode={paymentMode}
        setPaymentMode={setPaymentMode}
        partialAmountPaid={partialAmountPaid}
        setPartialAmountPaid={setPartialAmountPaid}
        creditNote={creditNote}
        setCreditNote={setCreditNote}
        totalAmount={totalAmount}
        isCredit={isCredit}
        partialAmountInputRef={partialAmountInputRef}
      />

      <LaborItemModal
        isOpen={laborModalOpen}
        onClose={() => {
          setLaborModalOpen(false);
          setEditingLaborItem(null);
        }}
        onAdd={handleAddLaborItem}
        editItem={editingLaborItem}
      />

      {/* TOP BAR: ACTIVE CARTS MANAGEMENT */}
      <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 z-30 shadow-sm shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-red-50 text-red-600 p-1.5 rounded-lg">
            <Car size={20} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-extrabold text-gray-800 text-sm tracking-tight leading-none">Active Repairs</h1>
              <button
                onClick={refreshCarts}
                disabled={cartsLoading}
                className="text-gray-400 hover:text-red-600 p-0.5 rounded-full hover:bg-gray-100 transition-colors"
                title="Sync Repairs with Database"
              >
                <RefreshCw size={12} className={cartsLoading ? "animate-spin" : ""} />
              </button>
            </div>
            <span className="text-[10px] text-gray-400 font-semibold">{carts.length} ongoing repair{carts.length > 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Scrollable Cart Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none flex-1 max-w-full sm:max-w-[75%] md:max-w-[80%] pb-1 sm:pb-0">
          {carts.map((c, index) => {
            const isActive = c.id === activeCartId;
            const displayName = c.vehicleNumber
              ? c.vehicleNumber
              : (c.customerName ? c.customerName : `Repair ${index + 1}`);
            const cartVehicleInfo = c.vehicleNumber
              ? vehicleInfoByNumber[c.vehicleNumber.trim().toUpperCase()]
              : null;
            const subText = c.vehicleNumber && cartVehicleInfo
              ? [cartVehicleInfo.make, cartVehicleInfo.model].filter(Boolean).join(" ")
              : "";

            return (
              <div
                key={c.id}
                onClick={() => setActiveCartId(c.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border-2 transition-all duration-200 shrink-0 cursor-pointer select-none relative group ${isActive
                    ? "bg-red-50 border-red-500 text-red-700 shadow-sm"
                    : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 hover:border-gray-300"
                  }`}
              >
                <Car size={13} className={isActive ? "text-red-500" : "text-gray-400"} />
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold whitespace-nowrap leading-none">
                    {displayName}
                  </span>
                  {subText && (
                    <span className="text-[9px] text-gray-400 font-medium whitespace-nowrap leading-none mt-1">
                      {subText}
                    </span>
                  )}
                </div>
                {c.items.length > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold leading-none ${isActive ? "bg-red-200 text-red-800" : "bg-gray-200 text-gray-700"
                    }`}>
                    {c.items.length}
                  </span>
                )}
                {/* Delete Cart button - show only if we have more than 1 cart */}
                {carts.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCart(c.id);
                    }}
                    className="text-gray-400 hover:text-red-600 p-0.5 rounded-full hover:bg-gray-200 transition-colors ml-1 shrink-0"
                    title="Delete Cart"
                  >
                    <XCircle size={14} />
                  </button>
                )}
              </div>
            );
          })}

          {/* Add New Cart Button */}
          <button
            onClick={handleAddNewCart}
            className="flex items-center justify-center p-2 rounded-xl border border-dashed border-gray-300 hover:border-gray-500 text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 active:scale-95 transition-all shrink-0 w-8 h-8"
            title="Add New Cart/Repair"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* LEFT SIDE: PRODUCT LIST */}
        <div
          className={`w-full md:w-3/5 flex flex-col h-full bg-gray-50 transition-all duration-300 ${mobileView === "cart" ? "hidden md:flex" : "flex"
            }`}
        >
          <div className="p-3 bg-white shadow-sm z-10">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search part name, number, brand..."
                className="w-full pl-10 p-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white transition-colors focus:ring-2 focus:ring-red-500 outline-none text-base md:text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 pb-24 md:pb-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-2.5">
              {partsLoading ? (
                /* Skeleton Loader Grid */
                Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="bg-white border border-gray-100 rounded-xl p-0 overflow-hidden shadow-sm animate-pulse">
                    <div className="h-20 md:h-24 bg-gray-200"></div>
                    <div className="p-2 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      <div className="flex justify-between pt-2">
                        <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                visibleParts.map((part) => (
                  <ProductItem
                    key={part.id}
                    part={part}
                    onAddToCart={addToCart}
                    onShowDetails={setSelectedPart}
                  />
                ))
              )}
            </div>

            {/* Load More Button */}
            {visibleCount < filteredParts.length && (
              <div className="mt-6 flex flex-col items-center justify-center pb-8">
                <p className="text-xs text-gray-400 mb-2 font-medium">
                  Showing {visibleCount} of {filteredParts.length} parts
                </p>
                <button
                  onClick={() => setVisibleCount((prev) => prev + 20)}
                  className="group relative bg-white border-2 border-red-50 text-red-600 font-bold py-2.5 px-8 rounded-full hover:bg-red-50 hover:border-red-100 active:scale-95 transition-all shadow-sm hover:shadow-md flex items-center gap-2"
                >
                  <span>Load More Parts</span>
                  <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-extrabold group-hover:bg-red-200 transition-colors">
                    +{filteredParts.length - visibleCount}
                  </span>
                  <ChevronUp className="rotate-180 w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SIDE: CART */}
        <div
          className={`w-full md:w-2/5 bg-white border-l border-gray-200 flex flex-col h-full shadow-xl z-20 
          ${mobileView === "products" ? "hidden md:flex" : "flex"}
      `}
        >
          {/* Mobile Header for Cart View */}
          <div className="md:hidden p-3 bg-white border-b border-gray-100 flex items-center justify-between">
            <button
              onClick={() => setMobileView("products")}
              className="flex items-center gap-1 text-gray-600 font-medium active:bg-gray-100 px-2 py-1 rounded"
            >
              <ArrowLeft size={18} /> Back to Products
            </button>
            <h2 className="font-bold text-gray-800">Your Cart</h2>
            <div className="w-8"></div> {/* Spacer */}
          </div>

          <div className="hidden md:flex p-4 bg-gray-900 text-white shadow-md z-10 justify-between items-center">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" /> Current Sale
            </h2>
            {cart.length > 0 && (
              <button
                onClick={handleClearCartRequest}
                className="text-xs bg-red-600 hover:bg-red-500 text-white px-2.5 py-1.5 rounded-full flex items-center gap-1 transition"
              >
                <Trash2 size={12} /> Clear
              </button>
            )}
          </div>

          <div className="shrink-0 px-3 pt-3">
            <button
              onClick={() => setLaborModalOpen(true)}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-dashed border-blue-200 hover:border-blue-300 rounded-xl py-2 transition-colors"
            >
              <Wrench size={13} /> Add Repair / Labor
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 bg-gray-50/50">
            {cart.length === 0 ? (
              <div className="text-center text-gray-400 mt-20 flex flex-col items-center">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <ShoppingCart size={32} className="opacity-40" />
                </div>
                <p className="text-lg font-semibold text-gray-500">Cart is empty</p>
                <p className="text-sm">Select items to start a sale</p>
              </div>
            ) : (
              cart.map((item) => {
                const original = parseFloat(item.sell_price) || 0;
                const discountVal = parseFloat(item.discountAmount) || 0;
                const final = original - discountVal;

                // Calculate remaining unit profitability based on buy_price
                const buyPrice = parseFloat(item.buy_price || 0);
                const currentProfit = final - buyPrice;
                const currentMargin = final > 0 ? ((currentProfit / final) * 100).toFixed(1) : "0.0";
                const currentMarkup = buyPrice > 0 ? ((currentProfit / buyPrice) * 100).toFixed(1) : "0.0";

                let profitColorClass = "bg-green-50 text-green-700 border-green-100";
                let profitText = `Margin: ${currentMargin}% (Markup: ${currentMarkup}%)`;

                if (currentProfit === 0) {
                  profitColorClass = "bg-amber-50 text-amber-700 border-amber-100";
                  profitText = "Break Even (0%)";
                } else if (currentProfit < 0) {
                  profitColorClass = "bg-red-50 text-red-700 border-red-200 animate-pulse font-bold";
                  profitText = `Loss: Margin: ${currentMargin}%`;
                }

                const percentValue = item.discountPercentInput !== undefined
                  ? item.discountPercentInput
                  : (item.discountAmount ? parseFloat(((item.discountAmount / original) * 100).toFixed(2)).toString() : '');

                return (
                  <div
                    key={item.id}
                    className="flex flex-col bg-white p-3 rounded-xl shadow-sm border border-gray-200"
                  >
                    {/* Row 1: Title, details and remove */}
                    <div className="flex justify-between items-start mb-2.5">
                      <div className="flex-1 pr-2">
                        <h4 className="font-bold text-sm text-gray-800 line-clamp-2">
                          {item.name}
                        </h4>
                        {item.item_type === "LABOR" ? (
                          <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wide flex items-center gap-1">
                            <Wrench size={10} /> Repair / Labor
                          </p>
                        ) : (
                          <p className="text-[10px] text-gray-500 font-mono">
                            {item.part_number} • {item.brand}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {item.item_type === "LABOR" && (
                          <button
                            onClick={() => handleOpenEditLabor(item)}
                            className="text-gray-300 hover:text-blue-500 p-1.5 hover:bg-blue-50 rounded-full transition-colors"
                            title="Edit description/price"
                          >
                            <Pencil size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => setItemToRemove(item)}
                          className="text-gray-300 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-full transition-colors"
                        >
                          <XCircle size={18} />
                        </button>
                      </div>
                    </div>

                    {/* Row 2: Quantity controls & Final Price */}
                    <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-gray-100 border-dashed">
                      {/* Quantity Control */}
                      <div className="flex items-center bg-gray-100 rounded-lg h-9">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-9 h-full flex items-center justify-center hover:text-red-600 active:bg-gray-200 rounded-l-lg transition-colors"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-8 text-center text-sm font-bold">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-9 h-full flex items-center justify-center hover:text-green-600 active:bg-gray-200 rounded-r-lg transition-colors"
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      {/* Price Display */}
                      <div className="text-right">
                        {item.discountAmount > 0 && (
                          <p className="text-[10px] text-gray-400 line-through">
                            {original.toLocaleString()}
                          </p>
                        )}
                        <p className={`font-bold text-sm ${item.discountAmount > 0 ? "text-amber-600" : "text-gray-800"}`}>
                          LKR {final.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Row 3: Discounts Inputs & Profitability badge */}
                    <div className="mt-2.5 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          <Tag size={12} className="text-gray-400" />
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Discount</span>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Rupee Input */}
                          <div className={`flex items-center border rounded-lg h-8 px-2 gap-1 transition-all ${item.discountAmount > 0 ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-white'}`}>
                            <span className={`text-[10px] font-bold ${item.discountAmount > 0 ? 'text-amber-500' : 'text-gray-400'}`}>LKR</span>
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={item.discountAmount === 0 ? '' : item.discountAmount}
                              onChange={(e) => updateDiscountAmount(item.id, e.target.value)}
                              className="w-14 text-center bg-transparent outline-none text-xs font-semibold text-gray-700 placeholder-gray-300"
                            />
                          </div>

                          {/* Percentage Input */}
                          <div className={`flex items-center border rounded-lg h-8 px-2 gap-1 transition-all ${item.discountAmount > 0 ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-white'}`}>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              placeholder="0"
                              value={percentValue}
                              onChange={(e) => updateDiscountPercent(item.id, e.target.value)}
                              className="w-10 text-center bg-transparent outline-none text-xs font-semibold text-gray-700 placeholder-gray-300"
                            />
                            <span className={`text-[10px] font-bold ${item.discountAmount > 0 ? 'text-amber-500' : 'text-gray-400'}`}>%</span>
                          </div>
                        </div>
                      </div>

                      {/* Profitability Badge — not meaningful for labor (no buy_price/cost) */}
                      {item.item_type !== "LABOR" && (
                        <div className="flex items-center justify-between text-[10px] pt-1">
                          <span className="text-gray-400 font-medium">Remaining Profit:</span>
                          <span className={`px-2 py-0.5 rounded-md font-medium text-[10px] border tracking-tight ${profitColorClass}`}>
                            {profitText}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* BOTTOM ACTION AREA */}
          <div className="shrink-0 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-30 flex flex-col">

            {/* Compact Vehicle/Customer summary — opens VehicleCustomerModal for lookup/registration */}
            <div className="p-3 pb-2">
              <button
                type="button"
                onClick={() => setVehicleModalOpen(true)}
                className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-2 border text-left transition-colors ${vehicleLookupStatus === "found"
                    ? linkedCustomer ? "bg-green-50 border-green-200 hover:bg-green-100" : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                    : vehicleLookupStatus === "not_found"
                      ? "bg-red-50 border-red-200 hover:bg-red-100"
                      : vehicleNumber.trim()
                        ? "bg-gray-50 border-gray-200 hover:bg-gray-100"
                        : "bg-red-50 border-red-200 hover:bg-red-100"
                  }`}
              >
                <Car
                  size={14}
                  className={
                    vehicleLookupStatus === "found"
                      ? linkedCustomer ? "text-green-600 shrink-0" : "text-gray-400 shrink-0"
                      : vehicleLookupStatus === "not_found"
                        ? "text-red-500 shrink-0"
                        : vehicleNumber.trim()
                          ? "text-gray-400 shrink-0"
                          : "text-red-500 shrink-0"
                  }
                />
                <div className="flex-1 min-w-0">
                  {vehicleLookupStatus === "found" ? (
                    <>
                      <p className={`text-xs font-bold truncate ${linkedCustomer ? "text-green-800" : "text-gray-700"}`}>
                        {[vehicleNumber, vehicleLabel].filter(Boolean).join(" · ")}
                      </p>
                      <p className={`text-[10px] truncate ${linkedCustomer ? "text-green-600" : "text-gray-400"}`}>
                        {linkedCustomer ? [linkedCustomer.name, linkedCustomer.phone].filter(Boolean).join(" · ") : "No customer linked"}
                      </p>
                    </>
                  ) : vehicleLookupStatus === "not_found" ? (
                    <>
                      <p className="text-xs font-bold text-red-700 truncate">{vehicleNumber}</p>
                      <p className="text-[10px] text-red-500 truncate">Not registered — tap to add</p>
                    </>
                  ) : vehicleNumber.trim() ? (
                    <>
                      <p className="text-xs font-bold text-gray-700 truncate">{vehicleNumber}</p>
                      <p className="text-[10px] text-gray-400 truncate">
                        {vehicleLookupStatus === "searching" ? "Searching..." : "No customer linked"}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs font-bold text-red-600">
                      + Add Vehicle / Customer <span className="font-normal text-red-400">(Required)</span>
                    </p>
                  )}
                </div>
                {vehicleLookupStatus === "found" && linkedCustomer && (
                  <span className="text-[9px] font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full shrink-0">Linked</span>
                )}
                <ChevronUp size={13} className="text-gray-400 -rotate-90 shrink-0" />
              </button>
            </div>

            {/* Pinned: Total + Checkout (always visible regardless of lookup panel state) */}
            <div className="px-3 pt-2 pb-3 border-t border-gray-100">

              {/* Compact Payment summary — opens PaymentModal for mode/amount/note */}
              <button
                type="button"
                onClick={() => setPaymentModalOpen(true)}
                className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-2 mb-2 border text-left transition-colors ${paymentMode === "PAID"
                    ? "bg-gray-50 border-gray-200 hover:bg-gray-100"
                    : paymentMode === "PARTIAL"
                      ? "bg-blue-50 border-blue-200 hover:bg-blue-100"
                      : "bg-amber-50 border-amber-200 hover:bg-amber-100"
                  }`}
              >
                <Wallet size={14} className={isCredit ? "text-amber-600 shrink-0" : "text-gray-400 shrink-0"} />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold truncate ${paymentMode === "PAID" ? "text-gray-700" : paymentMode === "PARTIAL" ? "text-blue-800" : "text-amber-800"}`}>
                    {paymentMode === "PAID" ? "Full Payment" : paymentMode === "PARTIAL" ? "Partial Payment" : "Full Credit"}
                  </p>
                  <p className={`text-[10px] truncate ${paymentMode === "PAID" ? "text-gray-400" : paymentMode === "PARTIAL" ? "text-blue-600" : "text-amber-600"}`}>
                    {paymentMode === "PARTIAL"
                      ? `LKR ${Math.max(totalAmount - (parseFloat(partialAmountPaid) || 0), 0).toLocaleString()} due`
                      : paymentMode === "CREDIT"
                        ? (creditNote.trim() || "No note added")
                        : "Pay in full at checkout"}
                  </p>
                </div>
                <ChevronUp size={13} className="text-gray-400 -rotate-90 shrink-0" />
              </button>

              <div className="flex justify-between items-end mb-2.5">
                <span className="text-sm font-medium text-gray-500">
                  {paymentMode === "PAID" ? "Total Amount" : paymentMode === "PARTIAL" ? "Balance Due" : "Amount Due"}
                </span>
                <div className="text-right">
                  <span className="text-2xl font-bold text-gray-900 tracking-tight">
                    <span className="text-base text-gray-400 font-normal mr-1">LKR</span>
                    {(paymentMode === "PARTIAL"
                      ? Math.max(totalAmount - (parseFloat(partialAmountPaid) || 0), 0)
                      : totalAmount
                    ).toLocaleString()}
                  </span>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={loading || cart.length === 0}
                className={`w-full py-3.5 rounded-xl text-white font-bold text-lg shadow-lg transition-all flex justify-center items-center gap-2
                  ${loading
                    ? "bg-gray-300 cursor-not-allowed shadow-none"
                    : paymentMode === "CREDIT"
                      ? "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-[0.98] shadow-amber-200"
                      : paymentMode === "PARTIAL"
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 active:scale-[0.98] shadow-blue-200"
                        : "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 active:scale-[0.98] shadow-red-200"
                  }`}
              >
                {loading ? (
                  <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing...</span>
                ) : paymentMode === "CREDIT" ? (
                  <>Complete Sale (Credit) <UserCheck size={20} /></>
                ) : paymentMode === "PARTIAL" ? (
                  <>Complete Sale (Partial) <Wallet size={20} /></>
                ) : (
                  <>Complete Sale <CheckCircle size={20} /></>
                )}
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* MOBILE FLOATING BAR */}
      {mobileView === "products" && (
        <div className="md:hidden fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-md border-t border-gray-200 p-3 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-40 pb-safe">
          <div className="flex gap-3">
            <div className="flex-1 flex flex-col justify-center px-2">
              <span className="text-xs text-gray-500 font-medium">{totalItems} items</span>
              <span className="text-lg font-bold text-gray-900">LKR {totalAmount.toLocaleString()}</span>
            </div>
            <button
              onClick={() => setMobileView("cart")}
              className="flex-1 bg-gray-900 text-white px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              View Cart <ChevronUp size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default POSPage;
