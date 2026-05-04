import React, { useEffect, useState, useRef, useCallback } from "react";
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
  fetchParts,
  deletePart,
  createPart,
  updatePart,
  fetchSuppliers,
  bulkUploadParts,
} from "../services/api";
import AddPartForm from "../components/forms/AddPartForm";
import QuickRestockModal from "../components/forms/QuickRestockModal";
import AlertComponent from "../components/AlertComponent";
import ConfirmModal from "../components/ConfirmModal";

const PartDetailsModal = ({ part, onClose }) => {
  if (!part) return null;
  
  // Helper to render vehicle name safely from Object or ID
  const renderVehicleName = (v) => {
    if (typeof v === "object" && v !== null) {
      return `${v.make} ${v.model}`;
    }
    return "Vehicle";
  };

  // Calculate profit margin
  const totalSold = part.total_sold || 0;
  const totalRevenue = part.total_revenue || 0;
  const totalCost = part.total_cost || 0;
  const totalProfit = totalRevenue - totalCost;
  const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-scale-in flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="bg-red-700 p-4 text-white flex justify-between items-center shrink-0">
          <h3 className="font-bold text-lg flex items-center gap-2"><Package size={20} /> Part Details</h3>
          <button onClick={onClose} className="hover:bg-red-600 p-1 rounded-full transition-colors"><XCircle size={20}/></button>
        </div>
        <div className="p-6 overflow-y-auto w-full">
          <div className="flex flex-col sm:flex-row gap-6 mb-6">
            {part.image ? (
              <img src={part.image} alt={part.name} className="w-full sm:w-40 h-48 sm:h-40 object-cover rounded-xl border border-gray-200 shadow-sm shrink-0" />
            ) : (
              <div className="w-full h-48 sm:w-40 sm:h-40 flex items-center justify-center bg-gray-50 rounded-xl border border-gray-200 text-gray-400 shrink-0">
                <Package size={48} opacity={0.3} />
              </div>
            )}
            <div className="flex-1 w-full overflow-hidden">
               <h2 className="text-xl sm:text-2xl font-bold text-gray-800 leading-tight mb-2 break-words">{part.name}</h2>
               <p className="text-sm text-gray-500 font-mono mb-3 py-1 px-2 bg-gray-100 rounded inline-block break-all">
                 Part No: {part.part_number}
               </p>
               {part.brand && (
                 <div className="mb-3">
                   <span className="bg-red-50 text-red-800 text-xs font-bold px-2.5 py-1 rounded-md border border-red-100 uppercase tracking-wide inline-block break-words">{part.brand}</span>
                 </div>
               )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
             <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex flex-col">
               <p className="text-xs text-gray-500 mb-1 flex items-center gap-1 shrink-0"><AlertTriangle size={12} /> Stock Qty</p>
               <div className="flex items-center gap-2">
                 <p className={`text-xl font-bold break-words ${part.stock_qty <= 1 ? "text-red-600" : "text-gray-800"}`}>
                   {part.stock_qty}
                 </p>
                 {part.stock_qty <= 1 && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full uppercase shrink-0">Low</span>}
               </div>
             </div>
             <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
               <p className="text-xs text-gray-500 mb-1 flex items-center gap-1 shrink-0"><MapPin size={12} /> Location</p>
               <p className="text-lg sm:text-xl font-bold text-gray-800 break-words">{part.rack_location || "N/A"}</p>
             </div>
             <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
               <p className="text-xs text-gray-500 mb-1 shrink-0">Buy Price</p>
               <p className="text-lg font-bold text-gray-800 break-words">LKR {part.buy_price}</p>
             </div>
             <div className="bg-red-50 p-3 rounded-xl border border-red-100">
               <p className="text-xs text-red-500 mb-1 font-semibold shrink-0">Sell Price</p>
               <p className="text-lg font-bold text-red-700 break-words">LKR {part.sell_price}</p>
             </div>
             
             {/* New Supplier and Description fields */}
             <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 col-span-2 sm:col-span-1">
               <p className="text-xs text-gray-500 mb-1 shrink-0">Supplier</p>
               <p className="text-md font-bold text-gray-800 break-words">{part.supplier_details?.name || "N/A"}</p>
             </div>
             
             {part.description && (
               <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 col-span-2 sm:col-span-1">
                 <p className="text-xs text-gray-500 mb-1 shrink-0">Description</p>
                 <p className="text-sm text-gray-800 break-words whitespace-pre-wrap">{part.description}</p>
               </div>
             )}
             
             {/* New Sales and Profit Fields */}
             <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex flex-col">
               <p className="text-xs text-blue-500 mb-1 shrink-0 font-semibold">Total Sold</p>
               <p className="text-xl font-bold text-blue-800 break-words">{totalSold} units</p>
             </div>
             <div className="bg-green-50 p-3 rounded-xl border border-green-100 flex flex-col">
               <p className="text-xs text-green-600 mb-1 shrink-0 font-semibold">Profit Margin</p>
               <p className="text-xl font-bold text-green-800 break-words">{profitMargin}%</p>
             </div>
          </div>

          <div>
             <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-1 border-b pb-2 shrink-0"><Car size={16} /> Compatible Vehicles</h4>
             <div className="flex flex-wrap gap-2 mt-3">
               {part.compatible_vehicles && part.compatible_vehicles.length > 0 ? (
                 part.compatible_vehicles.map((v, i) => (
                   <span key={i} className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1.5 rounded-md border border-gray-200 truncate max-w-[150px]" title={renderVehicleName(v)}>
                     {renderVehicleName(v)}
                   </span>
                 ))
               ) : (
                 <span className="text-sm text-gray-500 italic">Universal Fit / No specific vehicles</span>
               )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

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

const InventoryPage = () => {
  const [parts, setParts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [editingPart, setEditingPart] = useState(null);
  const [showRestockModal, setShowRestockModal] = useState(false);

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  
  const [stockFilter, setStockFilter] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("filter") || "all";
  });

  // Alert & Modal States
  const [alertInfo, setAlertInfo] = useState({ type: "", message: "" });
  const [deleteId, setDeleteId] = useState(null);
  const [selectedPart, setSelectedPart] = useState(null); // For details modal
  const pressTimer = useRef(null);
  const debounceTimer = useRef(null);

  const startPress = (part) => {
    pressTimer.current = setTimeout(() => {
      setSelectedPart(part);
    }, 500); // 500ms for long press
  };

  const endPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
    }
  };

  // --- Load suppliers on mount ---
  useEffect(() => {
    const loadSuppliers = async () => {
      try {
        const data = await fetchSuppliers();
        setSuppliers(data);
      } catch (err) {
        console.error("Failed to load suppliers", err);
      }
    };
    loadSuppliers();
  }, []);

  // --- 1. Load Data ---
  const loadData = useCallback(async (search, brand, stock, supplier) => {
    setLoading(true);
    try {
      const partsData = await fetchParts({
        search: search,
        brand: brand,
        ...(stock !== "all" && { stock_status: stock }),
        ...(supplier && { supplier: supplier }),
      });
      setParts(partsData);
    } catch (error) {
      console.error("Failed to load parts", error);
      setAlertInfo({
        type: "error",
        message: "Failed to load inventory data.",
      });
    }
    setLoading(false);
  }, []);

  // Initial load
  useEffect(() => {
    loadData(searchTerm, selectedBrand, stockFilter, selectedSupplier);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Debounced live search: fires on searchTerm or selectedBrand change ---
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      loadData(searchTerm, selectedBrand, stockFilter, selectedSupplier);
    }, 400);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [searchTerm, selectedBrand]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- 2. Action Handlers ---

  const handleStockFilter = (filter) => {
    setStockFilter(filter);
    
    // Trigger load data immediately with the new filter
    setLoading(true);
    fetchParts({
      search: searchTerm,
      brand: selectedBrand,
      ...(filter !== "all" && { stock_status: filter }),
      ...(selectedSupplier && { supplier: selectedSupplier }),
    }).then(data => {
      setParts(data);
      setLoading(false);
    }).catch(() => { setLoading(false); });
  };

  const handleSupplierChange = (supplierId) => {
    setSelectedSupplier(supplierId);
    
    // Trigger load data immediately with the new supplier
    setLoading(true);
    fetchParts({
      search: searchTerm,
      brand: selectedBrand,
      ...(stockFilter !== "all" && { stock_status: stockFilter }),
      ...(supplierId && { supplier: supplierId }),
    }).then(data => {
      setParts(data);
      setLoading(false);
    }).catch(() => { setLoading(false); });
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setSelectedBrand("");
    setSelectedSupplier("");
    setStockFilter("all");
    loadData("", "", "all", "");
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

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setAlertInfo({ type: "info", message: "Uploading and processing Excel file... Please wait." });

    try {
      const response = await bulkUploadParts(file);
      setAlertInfo({ type: "success", message: response.message || "Excel file processed successfully!" });
      loadData(searchTerm, selectedBrand, stockFilter, selectedSupplier);
    } catch (error) {
      console.error("Upload Error:", error);
      const errorMsg = error.response?.data?.error || "Failed to upload file.";
      setAlertInfo({ type: "error", message: errorMsg });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = ""; // Reset input
      }
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
      loadData(searchTerm, selectedBrand, stockFilter, selectedSupplier);
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

  // --- 3. Form Submit Handler (Handles Images via FormData) ---
  const handleFormSubmit = async (formData) => {
    setAlertInfo({ type: "", message: "" });

    try {
      if (editingPart) {
        // Update Part
        await updatePart(editingPart.id, formData);
        setAlertInfo({
          type: "success",
          message: "Part Updated Successfully!",
        });
      } else {
        // Create Part
        const response = await createPart(formData);

        // Handle "Smart Update" messages
        if (response.message) {
          setAlertInfo({ type: "success", message: response.message });
        } else {
          setAlertInfo({
            type: "success",
            message: "New Part Added Successfully!",
          });
        }
      }

      loadData(searchTerm, selectedBrand, stockFilter, selectedSupplier);
      handleFormClose();
    } catch (error) {
      console.error("Save Error:", error);

      if (error.response && error.response.data) {
        const errorData = error.response.data;
        const errorMessages = Object.values(errorData).flat().join("\n");
        setAlertInfo({
          type: "error",
          message: `Failed to save:\n${errorMessages}`,
        });
      } else {
        setAlertInfo({
          type: "error",
          message: "Network error. Please check connection.",
        });
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
      <PartDetailsModal part={selectedPart} onClose={() => setSelectedPart(null)} />

      {/* --- QUICK RESTOCK MODAL --- */}
      {showRestockModal && (
        <QuickRestockModal
          onClose={() => setShowRestockModal(false)}
          onSuccess={(msg) => {
            setAlertInfo({ type: "success", message: msg });
            loadData(searchTerm, selectedBrand, stockFilter, selectedSupplier);
          }}
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
        <div className="flex w-full md:w-auto gap-2">
          <input
            type="file"
            accept=".xlsx, .xls"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full md:w-auto px-4 py-2 rounded-lg shadow transition flex items-center justify-center gap-2 font-bold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
          >
            <Download size={20} className="rotate-180" />
            {isUploading ? "Uploading..." : "Import Excel"}
          </button>
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

      {/* Search & Filter Bar — live search, no submit button */}
      <div
        className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4 grid grid-cols-1 md:grid-cols-4 gap-3"
      >
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-3 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by Name, Vehicle Model, Brand, or Part No..."
            className="w-full pl-10 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-red-500 focus:outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <input
          type="text"
          placeholder="Filter by Brand"
          className="p-2 border border-gray-300 rounded focus:ring-2 focus:ring-red-500 focus:outline-none"
          value={selectedBrand}
          onChange={(e) => setSelectedBrand(e.target.value)}
        />
        <div className="flex gap-2">
          <select
            value={selectedSupplier}
            onChange={(e) => handleSupplierChange(e.target.value)}
            className="flex-1 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-red-500 focus:outline-none bg-white text-gray-700"
          >
            <option value="">All Suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {(searchTerm || selectedBrand || selectedSupplier || stockFilter !== "all") && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="bg-white border border-red-200 text-red-600 px-3 py-2 rounded hover:bg-red-50 flex items-center justify-center gap-1 font-bold transition-colors shrink-0"
              title="Clear all filters"
            >
              <XCircle size={18} />
            </button>
          )}
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
