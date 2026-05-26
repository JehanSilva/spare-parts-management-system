import React, { useEffect, useState, useRef } from "react";
import {
  fetchEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  fetchAttendanceSheet,
  markAttendanceSheet,
  fetchPayroll,
  generatePayrollDrafts,
  updatePayroll,
  payPayroll,
} from "../services/api";
import AlertComponent from "../components/AlertComponent";
import ConfirmModal from "../components/ConfirmModal";
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  Calendar,
  DollarSign,
  Printer,
  Save,
  Check,
  User,
  Phone,
  Mail,
  MapPin,
  XCircle,
} from "lucide-react";
import { useReactToPrint } from "react-to-print";

const EmployeePage = () => {
  const [activeTab, setActiveTab] = useState("employees"); // employees, attendance, payroll
  const [employees, setEmployees] = useState([]);
  const [empLoading, setEmpLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Daily Attendance States
  const [attendanceDate, setAttendanceDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [attendanceList, setAttendanceList] = useState([]);
  const [attLoading, setAttLoading] = useState(false);
  const [attSaving, setAttSaving] = useState(false);

  // Payroll States
  const [payrollMonth, setPayrollMonth] = useState(new Date().getMonth() + 1); // 1-12
  const [payrollYear, setPayrollYear] = useState(new Date().getFullYear());
  const [payrollList, setPayrollList] = useState([]);
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [selectedPayRecord, setSelectedPayRecord] = useState(null); // for print payslip

  // Modal / Form States
  const [showEmpForm, setShowEmpForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [empFormData, setEmpFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone_numbers: [{ type: "Personal", number: "" }],
    address: "",
    role: "",
    salary_type: "DAILY",
    salary_rate: "",
    is_active: true,
  });

  const [showPayrollEditModal, setShowPayrollEditModal] = useState(false);
  const [payrollEditData, setPayrollEditData] = useState({
    id: null,
    employee_name: "",
    allowances: "0.00",
    deductions: "0.00",
  });

  // Alert State
  const [alertInfo, setAlertInfo] = useState({ type: "", message: "" });

  // Delete State
  const [deleteEmpId, setDeleteEmpId] = useState(null);

  // --- Print Payslip Ref & Handler ---
  const payslipPrintRef = useRef();
  const handlePrintPayslip = useReactToPrint({
    contentRef: payslipPrintRef,
    documentTitle: `Payslip-${selectedPayRecord?.employee_details?.first_name || "Employee"}-${payrollYear}-${payrollMonth}`,
  });

  // --- Load Data functions ---
  const loadEmployees = async () => {
    setEmpLoading(true);
    try {
      const data = await fetchEmployees();
      setEmployees(data);
    } catch (error) {
      console.error("Failed to load employees", error);
      setAlertInfo({ type: "error", message: "Failed to load employee directory." });
    } finally {
      setEmpLoading(false);
    }
  };

  const loadAttendance = async (date) => {
    setAttLoading(true);
    try {
      const data = await fetchAttendanceSheet(date);
      setAttendanceList(data);
    } catch (error) {
      console.error("Failed to load attendance", error);
      setAlertInfo({ type: "error", message: "Failed to load attendance sheet." });
    } finally {
      setAttLoading(false);
    }
  };

  const loadPayroll = async (month, year) => {
    setPayrollLoading(true);
    try {
      const data = await fetchPayroll(month, year);
      setPayrollList(data);
    } catch (error) {
      console.error("Failed to load payroll list", error);
      setAlertInfo({ type: "error", message: "Failed to load payroll records." });
    } finally {
      setPayrollLoading(false);
    }
  };

  // --- Effects ---
  useEffect(() => {
    if (activeTab === "employees") {
      loadEmployees();
    } else if (activeTab === "attendance") {
      loadAttendance(attendanceDate);
    } else if (activeTab === "payroll") {
      loadPayroll(payrollMonth, payrollYear);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "attendance") {
      loadAttendance(attendanceDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendanceDate]);

  // --- Employee Action Handlers ---
  const handleAddEmployeeClick = () => {
    setEditingEmployee(null);
    setEmpFormData({
      first_name: "",
      last_name: "",
      email: "",
      phone_numbers: [{ type: "Personal", number: "" }],
      address: "",
      role: "",
      salary_type: "DAILY",
      salary_rate: "",
      is_active: true,
    });
    setShowEmpForm(true);
  };

  const handleEditEmployeeClick = (emp) => {
    setEditingEmployee(emp);
    setEmpFormData({
      first_name: emp.first_name,
      last_name: emp.last_name,
      email: emp.email || "",
      phone_numbers: emp.phone_numbers && emp.phone_numbers.length > 0
        ? emp.phone_numbers
        : [{ type: "Personal", number: "" }],
      address: emp.address || "",
      role: emp.role,
      salary_type: emp.salary_type,
      salary_rate: emp.salary_rate,
      is_active: emp.is_active,
    });
    setShowEmpForm(true);
  };

  const handleEmpFormSubmit = async (e) => {
    e.preventDefault();
    setSaveLoading(true);
    try {
      const cleanedPhoneNumbers = empFormData.phone_numbers.filter(
        (p) => p.number && p.number.trim() !== ""
      );
      const payload = {
        ...empFormData,
        phone_numbers: cleanedPhoneNumbers,
      };
      if (editingEmployee) {
        await updateEmployee(editingEmployee.id, payload);
        setAlertInfo({ type: "success", message: "Employee details updated successfully!" });
      } else {
        await createEmployee(payload);
        setAlertInfo({ type: "success", message: "Employee registered successfully!" });
      }
      loadEmployees();
      setShowEmpForm(false);
    } catch (error) {
      console.error("Error saving employee", error);
      const serverMessage = error.response?.data 
        ? Object.values(error.response.data).flat().join(" ")
        : "Failed to save employee.";
      setAlertInfo({ type: "error", message: serverMessage });
    } finally {
      setSaveLoading(false);
    }
  };

  const executeDeleteEmployee = async () => {
    if (!deleteEmpId) return;
    const idToDelete = deleteEmpId;
    setDeleteEmpId(null);
    try {
      await deleteEmployee(idToDelete);
      setAlertInfo({ type: "success", message: "Employee removed successfully." });
      loadEmployees();
    } catch (error) {
      console.error("Failed to remove employee", error);
      setAlertInfo({ type: "error", message: "Failed to remove employee." });
    }
  };

  const handleToggleActiveStatus = async (emp) => {
    try {
      const updatedData = {
        ...emp,
        is_active: !emp.is_active,
      };
      await updateEmployee(emp.id, updatedData);
      setAlertInfo({
        type: "success",
        message: `${emp.first_name} ${emp.last_name} is now ${
          !emp.is_active ? "Active" : "Inactive"
        }.`,
      });
      loadEmployees();
    } catch (error) {
      console.error("Failed to toggle status", error);
      setAlertInfo({ type: "error", message: "Failed to update employee status." });
    }
  };

  // --- Attendance Action Handlers ---
  const handleAttendanceStatusChange = (index, status) => {
    setAttendanceList((prev) =>
      prev.map((att, i) => (i === index ? { ...att, status } : att))
    );
  };

  const handleAttendanceNotesChange = (index, notes) => {
    setAttendanceList((prev) =>
      prev.map((att, i) => (i === index ? { ...att, notes } : att))
    );
  };

  const saveAttendanceSheet = async () => {
    setAttSaving(true);
    try {
      const payload = {
        date: attendanceDate,
        attendances: attendanceList.map((att) => ({
          employee: att.employee,
          status: att.status,
          notes: att.notes || "",
        })),
      };
      await markAttendanceSheet(payload);
      setAlertInfo({ type: "success", message: "Attendance saved successfully for " + attendanceDate });
      loadAttendance(attendanceDate);
    } catch (error) {
      console.error("Failed to save attendance", error);
      setAlertInfo({ type: "error", message: "Failed to save daily attendance sheet." });
    } finally {
      setAttSaving(false);
    }
  };

  // --- Payroll Action Handlers ---
  const handleCalculatePayroll = async () => {
    setPayrollLoading(true);
    try {
      const payload = { month: payrollMonth, year: payrollYear };
      await generatePayrollDrafts(payload);
      setAlertInfo({ type: "success", message: "Payroll drafts generated successfully!" });
      loadPayroll(payrollMonth, payrollYear);
    } catch (error) {
      console.error("Failed to calculate payroll", error);
      setAlertInfo({ type: "error", message: "Failed to generate monthly payroll drafts." });
    } finally {
      setPayrollLoading(false);
    }
  };

  const handleOpenPayrollEdit = (rec) => {
    setPayrollEditData({
      id: rec.id,
      employee_name: `${rec.employee_details?.first_name} ${rec.employee_details?.last_name}`,
      allowances: rec.allowances,
      deductions: rec.deductions,
    });
    setShowPayrollEditModal(true);
  };

  const handlePayrollEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        allowances: parseFloat(payrollEditData.allowances) || 0,
        deductions: parseFloat(payrollEditData.deductions) || 0,
      };
      await updatePayroll(payrollEditData.id, payload);
      setAlertInfo({ type: "success", message: "Payroll adjustments updated successfully!" });
      setShowPayrollEditModal(false);
      loadPayroll(payrollMonth, payrollYear);
    } catch (error) {
      console.error("Failed to update payroll adjustments", error);
      setAlertInfo({ type: "error", message: "Failed to save adjustments." });
    }
  };

  const handlePaySalary = async (rec) => {
    try {
      await payPayroll(rec.id);
      setAlertInfo({ type: "success", message: `Salary marked as Paid for ${rec.employee_details?.first_name}!` });
      loadPayroll(payrollMonth, payrollYear);
    } catch (error) {
      console.error("Failed to mark paid", error);
      setAlertInfo({ type: "error", message: "Failed to mark salary as paid." });
    }
  };

  const triggerPrintPayslip = (rec) => {
    setSelectedPayRecord(rec);
    setTimeout(() => {
      handlePrintPayslip();
    }, 100);
  };

  // --- Filtering ---
  const filteredEmployees = employees.filter((emp) => {
    const searchLower = searchTerm.toLowerCase();
    const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
    const matchesPhone = emp.phone_numbers && Array.isArray(emp.phone_numbers) && emp.phone_numbers.some(
      (p) => p.number && p.number.includes(searchTerm)
    );
    const matchesSearch =
      fullName.includes(searchLower) ||
      (emp.role && emp.role.toLowerCase().includes(searchLower)) ||
      matchesPhone;
    return matchesSearch;
  });

  const months = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
  ];

  const years = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear - 3; y <= currentYear + 1; y++) {
    years.push(y);
  }

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gray-50 relative">
      <ConfirmModal
        isOpen={!!deleteEmpId}
        title="Remove Employee?"
        message="Are you sure you want to remove this employee? If they have history, they will be deactivated instead."
        onConfirm={executeDeleteEmployee}
        onCancel={() => setDeleteEmpId(null)}
      />

      {alertInfo.message && (
        <AlertComponent
          type={alertInfo.type}
          message={alertInfo.message}
          onClose={() => setAlertInfo({ type: "", message: "" })}
        />
      )}

      {/* --- HEADER --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 print:hidden">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-red-900 flex items-center gap-2">
            <Users className="w-6 h-6 md:w-8 md:h-8" /> Employees & Payroll
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            Manage staff registries, trace daily attendance logs, and compile monthly salaries.
          </p>
        </div>

        {activeTab === "employees" && (
          <button
            onClick={handleAddEmployeeClick}
            className="w-full md:w-auto px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2"
          >
            <Plus size={20} /> Add Employee
          </button>
        )}
      </div>

      {/* --- TABS --- */}
      <div className="flex border-b border-gray-200 mb-6 bg-white p-1.5 rounded-2xl shadow-sm gap-2 print:hidden">
        <button
          onClick={() => setActiveTab("employees")}
          className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 ${
            activeTab === "employees"
              ? "bg-red-900 text-white shadow-sm"
              : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
          }`}
        >
          <Users size={18} /> Staff Registry
        </button>
        <button
          onClick={() => setActiveTab("attendance")}
          className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 ${
            activeTab === "attendance"
              ? "bg-red-900 text-white shadow-sm"
              : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
          }`}
        >
          <Calendar size={18} /> Daily Attendance
        </button>
        <button
          onClick={() => setActiveTab("payroll")}
          className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 ${
            activeTab === "payroll"
              ? "bg-red-900 text-white shadow-sm"
              : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
          }`}
        >
          <DollarSign size={18} /> Monthly Payroll
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: EMPLOYEES REGISTRY */}
      {/* ========================================================================= */}
      {activeTab === "employees" && (
        <div className="print:hidden">
          {/* Search bar */}
          <div className="relative mb-6 w-full md:max-w-md">
            <Search className="absolute left-3 top-3.5 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by name, designation, phone..."
              className="w-full pl-10 p-3 bg-white border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-red-500 focus:outline-none transition-all duration-200 text-sm font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {empLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-900 mb-2"></div>
              <p>Fetching staff registry...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredEmployees.length === 0 ? (
                <div className="col-span-full text-center py-16 bg-white rounded-3xl shadow-sm border border-gray-100">
                  <Users size={48} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 italic">No employees found matching "{searchTerm}".</p>
                </div>
              ) : (
                filteredEmployees.map((emp) => (
                  <div
                    key={emp.id}
                    className={`bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border-t-4 p-5 relative group ${
                      emp.is_active ? "border-red-800" : "border-gray-400 opacity-75"
                    }`}
                  >
                    {/* Active/Inactive status tag & Toggle switch */}
                    <div className="absolute top-4 right-4 flex items-center gap-2">
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                          emp.is_active
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-gray-100 text-gray-600 border-gray-300"
                        }`}
                      >
                        {emp.is_active ? "Active" : "Inactive"}
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={emp.is_active}
                          onChange={() => handleToggleActiveStatus(emp)}
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-800"></div>
                      </label>
                    </div>

                    {/* Employee Info */}
                    <div className="flex items-center gap-3.5 mb-4">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          emp.is_active ? "bg-red-50 text-red-900" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        <User size={24} />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-gray-800 leading-tight">
                          {emp.first_name} {emp.last_name}
                        </h2>
                        <span className="text-xs text-red-700/80 font-bold tracking-wide uppercase">
                          {emp.role}
                        </span>
                      </div>
                    </div>

                    <div className="w-full h-px bg-gray-100 my-4"></div>

                    {/* Details */}
                    <div className="space-y-2.5 text-xs text-gray-600">
                      <div className="flex flex-col gap-1.5">
                        {emp.phone_numbers && emp.phone_numbers.length > 0 ? (
                          emp.phone_numbers.map((p, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <Phone size={14} className="text-gray-400 shrink-0" />
                              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200/50">
                                {p.type}
                              </span>
                              <span className="font-semibold text-gray-700">{p.number}</span>
                            </div>
                          ))
                        ) : (
                          <div className="flex items-center gap-2">
                            <Phone size={14} className="text-gray-400 shrink-0" />
                            <span className="italic text-gray-400">No phone numbers</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2.5">
                        <Mail size={14} className="text-gray-400 shrink-0" />
                        <span className="truncate">{emp.email || <span className="italic text-gray-400">No email</span>}</span>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <MapPin size={14} className="text-gray-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2 leading-relaxed">
                          {emp.address || <span className="italic text-gray-400">No address</span>}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 bg-gray-50/80 p-2.5 rounded-xl border border-gray-100/60 font-semibold text-gray-700">
                        <DollarSign size={14} className="text-red-700 shrink-0" />
                        <div>
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block leading-none">
                            Salary rate
                          </span>
                          <span className="text-sm font-bold text-gray-800">
                            LKR {parseFloat(emp.salary_rate).toLocaleString()}
                          </span>
                          <span className="text-[11px] text-red-700 ml-1 font-bold">
                            /{emp.salary_type === "DAILY" ? "day" : "month"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Edit/Delete overlay */}
                    <div className="flex gap-2 justify-end mt-4 pt-3 border-t border-gray-50 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEditEmployeeClick(emp)}
                        className="px-3.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-900 transition rounded-lg text-xs font-bold flex items-center gap-1"
                      >
                        <Edit2 size={12} /> Edit
                      </button>
                      {emp.is_active && (
                        <button
                          onClick={() => setDeleteEmpId(emp.id)}
                          className="px-3.5 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-900 transition rounded-lg text-xs font-bold flex items-center gap-1"
                        >
                          <Trash2 size={12} /> Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DAILY ATTENDANCE */}
      {/* ========================================================================= */}
      {activeTab === "attendance" && (
        <div className="print:hidden">
          <div className="bg-white p-6 rounded-3xl border border-gray-200/80 shadow-sm max-w-4xl mx-auto">
            {/* Header / Date selector */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 pb-5 mb-6 gap-4">
              <div>
                <h2 className="text-xl font-extrabold text-gray-800">Attendance Sheet</h2>
                <p className="text-gray-400 text-xs mt-1">Select date and log presence statuses below.</p>
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-red-700" />
                <input
                  type="date"
                  className="p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-red-500 focus:outline-none font-bold text-gray-700 text-sm bg-white"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                />
              </div>
            </div>

            {attLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-900 mb-2"></div>
                <p>Loading attendance record...</p>
              </div>
            ) : attendanceList.length === 0 ? (
              <div className="text-center py-16">
                <Users size={48} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 italic">No active employees registered to mark attendance.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {attendanceList.map((att, idx) => (
                  <div
                    key={att.employee}
                    className="flex flex-col lg:flex-row lg:items-center justify-between p-4 bg-gray-50 hover:bg-gray-100/50 rounded-2xl border border-gray-200/40 transition duration-150 gap-4"
                  >
                    {/* Employee Profile */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-100 text-red-800 rounded-xl flex items-center justify-center font-bold">
                        {att.employee_name ? att.employee_name.charAt(0) : "E"}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-800 leading-tight">
                          {att.employee_name}
                        </h3>
                        <span className="text-[10px] bg-white border border-gray-200 text-gray-500 px-2 py-0.5 rounded-full font-bold uppercase mt-1 inline-block">
                          {att.employee_role}
                        </span>
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex flex-wrap items-center gap-3 lg:gap-6">
                      {/* Segmented status buttons */}
                      <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-200/70 select-none">
                        {[
                          { value: "PRESENT", label: "Present", color: "bg-green-500 text-white" },
                          { value: "HALF_DAY", label: "Half Day", color: "bg-orange-500 text-white" },
                          { value: "PAID_LEAVE", label: "Paid Leave", color: "bg-blue-500 text-white" },
                          { value: "ABSENT", label: "Absent", color: "bg-red-500 text-white" },
                        ].map((btn) => {
                          const isSelected = att.status === btn.value;
                          return (
                            <button
                              key={btn.value}
                              type="button"
                              onClick={() => handleAttendanceStatusChange(idx, btn.value)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 ${
                                isSelected
                                  ? btn.color + " shadow-sm font-black scale-105"
                                  : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                              }`}
                            >
                              {btn.label}
                            </button>
                          );
                        })}
                      </div>

                      {/* Notes input */}
                      <input
                        type="text"
                        placeholder="Optional remarks/notes..."
                        className="p-2 border border-gray-200 rounded-xl bg-white text-xs font-medium focus:ring-2 focus:ring-red-500 focus:outline-none max-w-[200px]"
                        value={att.notes || ""}
                        onChange={(e) => handleAttendanceNotesChange(idx, e.target.value)}
                      />
                    </div>
                  </div>
                ))}

                {/* Save button */}
                <div className="pt-6 border-t border-gray-100 flex justify-end">
                  <button
                    onClick={saveAttendanceSheet}
                    disabled={attSaving}
                    className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-md flex items-center gap-2 hover:-translate-y-0.5 transition duration-150 disabled:bg-gray-400"
                  >
                    {attSaving ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <Save size={18} />
                    )}
                    Save Daily Attendance Sheet
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PAYROLL CALCULATOR */}
      {/* ========================================================================= */}
      {activeTab === "payroll" && (
        <div className="print:hidden">
          {/* Controls box */}
          <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex flex-col">
                <label className="text-[10px] text-gray-400 font-extrabold uppercase mb-1">Month</label>
                <select
                  className="p-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:ring-2 focus:ring-red-500 font-bold text-gray-700 text-sm cursor-pointer min-w-[130px]"
                  value={payrollMonth}
                  onChange={(e) => setPayrollMonth(parseInt(e.target.value))}
                >
                  {months.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] text-gray-400 font-extrabold uppercase mb-1">Year</label>
                <select
                  className="p-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:ring-2 focus:ring-red-500 font-bold text-gray-700 text-sm cursor-pointer min-w-[100px]"
                  value={payrollYear}
                  onChange={(e) => setPayrollYear(parseInt(e.target.value))}
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleCalculatePayroll}
              disabled={payrollLoading}
              className="w-full md:w-auto px-6 py-3 bg-red-800 hover:bg-red-900 text-white font-bold rounded-xl shadow hover:-translate-y-0.5 transition duration-150 flex items-center justify-center gap-2 disabled:bg-gray-400"
            >
              <DollarSign size={18} /> Generate/Recalculate Salaries
            </button>
          </div>

          {/* Payroll List */}
          {payrollLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-900 mb-2"></div>
              <p>Compiling payroll computations...</p>
            </div>
          ) : payrollList.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm">
              <DollarSign size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 italic">No payroll drafts loaded. Click "Generate/Recalculate Salaries" above to initialize.</p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
              {/* DESKTOP TABLE VIEW */}
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs font-bold uppercase tracking-wider">
                    <tr>
                      <th className="p-4 pl-6">Employee Details</th>
                      <th className="p-4 text-center">Type</th>
                      <th className="p-4 text-right">Wage Rate</th>
                      <th className="p-4 text-center">Attendance Logs</th>
                      <th className="p-4 text-right">Base salary</th>
                      <th className="p-4 text-right">Allowances</th>
                      <th className="p-4 text-right">Deductions</th>
                      <th className="p-4 text-right font-black text-gray-700">Net salary</th>
                      <th className="p-4 text-center">Status</th>
                      <th className="p-4 text-center pr-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {payrollList.map((rec) => {
                      const isPaid = rec.status === "PAID";
                      return (
                        <tr key={rec.id} className="hover:bg-gray-50/50 transition">
                          {/* Profile details */}
                          <td className="p-4 pl-6">
                            <div className="font-bold text-gray-800">
                              {rec.employee_details?.first_name} {rec.employee_details?.last_name}
                            </div>
                            <span className="text-[10px] font-bold text-red-800/80 uppercase">
                              {rec.employee_details?.role}
                            </span>
                          </td>
                          {/* Type */}
                          <td className="p-4 text-center font-bold text-xs">
                            <span
                              className={`px-2 py-0.5 rounded-full border ${
                                rec.employee_details?.salary_type === "DAILY"
                                  ? "bg-purple-50 text-purple-700 border-purple-200"
                                  : "bg-blue-50 text-blue-700 border-blue-200"
                              }`}
                            >
                              {rec.employee_details?.salary_type}
                            </span>
                          </td>
                          {/* Rate */}
                          <td className="p-4 text-right font-semibold text-gray-700 text-sm">
                            {parseFloat(rec.employee_details?.salary_rate).toLocaleString()}
                          </td>
                          {/* Attendance counts */}
                          <td className="p-4 text-center text-xs font-semibold text-gray-500">
                            {rec.employee_details?.salary_type === "DAILY" ? (
                              <div className="flex flex-col leading-tight">
                                <span>
                                  Pr: <strong className="text-green-600">{parseFloat(rec.days_present)}</strong>
                                </span>
                                <span>
                                  Lv: <strong className="text-blue-500">{parseFloat(rec.days_paid_leave)}</strong>
                                </span>
                                <span>
                                  Ab: <strong className="text-red-500">{parseFloat(rec.days_absent)}</strong>
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400 font-normal italic">Fixed Rate</span>
                            )}
                          </td>
                          {/* Base Salary */}
                          <td className="p-4 text-right font-bold text-gray-800 text-sm">
                            {parseFloat(rec.base_salary).toLocaleString()}
                          </td>
                          {/* Allowances */}
                          <td className="p-4 text-right text-green-600 font-bold text-sm">
                            +{parseFloat(rec.allowances).toLocaleString()}
                          </td>
                          {/* Deductions */}
                          <td className="p-4 text-right text-red-500 font-bold text-sm">
                            -{parseFloat(rec.deductions).toLocaleString()}
                          </td>
                          {/* Net Salary */}
                          <td className="p-4 text-right font-black text-gray-800 text-sm bg-gray-50/30">
                            {parseFloat(rec.net_salary).toLocaleString()}
                          </td>
                          {/* Status */}
                          <td className="p-4 text-center">
                            <span
                              className={`text-[9px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                                isPaid
                                  ? "bg-green-50 text-green-700 border-green-200"
                                  : "bg-yellow-50 text-yellow-700 border-yellow-200"
                              }`}
                            >
                              {rec.status}
                            </span>
                          </td>
                          {/* Actions */}
                          <td className="p-4 text-center pr-6">
                            <div className="flex items-center justify-center gap-1.5">
                              {!isPaid && (
                                <>
                                  <button
                                    onClick={() => handleOpenPayrollEdit(rec)}
                                    className="p-1.5 bg-gray-100 hover:bg-red-50 hover:text-red-800 rounded-lg text-gray-500 transition-colors"
                                    title="Edit Allowances/Deductions"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    onClick={() => handlePaySalary(rec)}
                                    className="p-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition-colors font-bold text-xs"
                                    title="Mark Paid"
                                  >
                                    <Check size={13} />
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => triggerPrintPayslip(rec)}
                                className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition-colors"
                                title="Print Payslip"
                              >
                                <Printer size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ADD/EDIT EMPLOYEE */}
      {/* ========================================================================= */}
      {showEmpForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 animate-scale-in">
            <div className="bg-gradient-to-r from-red-900 to-red-800 p-6 text-white flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Users size={22} />
                {editingEmployee ? "Edit Employee Details" : "Register New Employee"}
              </h2>
              <button
                onClick={() => setShowEmpForm(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition"
              >
                <XCircle size={22} />
              </button>
            </div>

            <form onSubmit={handleEmpFormSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-400 font-extrabold uppercase mb-1.5">First name</label>
                  <input
                    type="text"
                    required
                    className="p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none text-sm font-semibold"
                    value={empFormData.first_name}
                    onChange={(e) => setEmpFormData({ ...empFormData, first_name: e.target.value })}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-400 font-extrabold uppercase mb-1.5">Last name</label>
                  <input
                    type="text"
                    required
                    className="p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none text-sm font-semibold"
                    value={empFormData.last_name}
                    onChange={(e) => setEmpFormData({ ...empFormData, last_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-400 font-extrabold uppercase mb-1.5">Role / Designation</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mechanic, Cashier, Storekeeper"
                    className="p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none text-sm font-semibold"
                    value={empFormData.role}
                    onChange={(e) => setEmpFormData({ ...empFormData, role: e.target.value })}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-400 font-extrabold uppercase mb-1.5">Email address</label>
                  <input
                    type="email"
                    className="p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none text-sm font-semibold"
                    value={empFormData.email}
                    onChange={(e) => setEmpFormData({ ...empFormData, email: e.target.value })}
                  />
                </div>
              </div>

              {/* Dynamic Phone Numbers */}
              <div className="flex flex-col gap-2 bg-gray-50/50 p-3.5 rounded-2xl border border-gray-100">
                <label className="text-[10px] text-gray-400 font-extrabold uppercase flex justify-between items-center">
                  <span>Phone Numbers</span>
                  <button
                    type="button"
                    onClick={() =>
                      setEmpFormData({
                        ...empFormData,
                        phone_numbers: [...empFormData.phone_numbers, { type: "Personal", number: "" }],
                      })
                    }
                    className="text-red-700 hover:text-red-900 font-bold text-xs flex items-center gap-1 transition-colors"
                  >
                    <Plus size={14} /> Add Number
                  </button>
                </label>
                <div className="space-y-2.5 max-h-[150px] overflow-y-auto pr-1">
                  {empFormData.phone_numbers.length === 0 ? (
                    <p className="text-xs text-gray-400 italic py-2">No phone numbers added yet.</p>
                  ) : (
                    empFormData.phone_numbers.map((phoneObj, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <select
                          className="p-2.5 border border-gray-200 rounded-xl bg-white text-xs font-semibold focus:ring-2 focus:ring-red-500 focus:outline-none w-[105px] shrink-0"
                          value={phoneObj.type}
                          onChange={(e) => {
                            const updated = [...empFormData.phone_numbers];
                            updated[index].type = e.target.value;
                            setEmpFormData({ ...empFormData, phone_numbers: updated });
                          }}
                        >
                          <option value="Personal">Personal</option>
                          <option value="Home">Home</option>
                          <option value="Parents">Parents</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Phone number"
                          className="p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none text-xs font-semibold flex-1"
                          value={phoneObj.number}
                          onChange={(e) => {
                            const updated = [...empFormData.phone_numbers];
                            updated[index].number = e.target.value;
                            setEmpFormData({ ...empFormData, phone_numbers: updated });
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = empFormData.phone_numbers.filter((_, idx) => idx !== index);
                            setEmpFormData({ ...empFormData, phone_numbers: updated });
                          }}
                          className="p-2.5 text-red-600 hover:bg-red-50 rounded-xl transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] text-gray-400 font-extrabold uppercase mb-1.5">Home address</label>
                <textarea
                  rows={2}
                  className="p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none text-sm font-semibold"
                  value={empFormData.address}
                  onChange={(e) => setEmpFormData({ ...empFormData, address: e.target.value })}
                />
              </div>

              {/* Inactive Toggle Switch in Modal */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div>
                  <span className="text-xs font-bold text-gray-700 block">Employment Status</span>
                  <span className="text-[10px] text-gray-400">Mark employee as active or inactive</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={empFormData.is_active}
                    onChange={(e) => setEmpFormData({ ...empFormData, is_active: e.target.checked })}
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-800"></div>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-400 font-extrabold uppercase mb-1.5">Salary payment type</label>
                  <select
                    className="p-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-red-500 focus:outline-none text-sm font-semibold"
                    value={empFormData.salary_type}
                    onChange={(e) => setEmpFormData({ ...empFormData, salary_type: e.target.value })}
                  >
                    <option value="DAILY">Daily Paid</option>
                    <option value="MONTHLY">Monthly Paid</option>
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-400 font-extrabold uppercase mb-1.5">
                    Salary rate (LKR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder={empFormData.salary_type === "DAILY" ? "Rate per day" : "Salary per month"}
                    className="p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none text-sm font-semibold"
                    value={empFormData.salary_rate}
                    onChange={(e) => setEmpFormData({ ...empFormData, salary_rate: e.target.value })}
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEmpForm(false)}
                  className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveLoading}
                  className="px-5 py-2.5 bg-red-800 hover:bg-red-900 text-white font-bold rounded-xl text-sm flex items-center gap-1.5"
                >
                  {saveLoading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                  Save Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ADJUST ALLOWANCES/DEDUCTIONS */}
      {/* ========================================================================= */}
      {showPayrollEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 animate-scale-in">
            <div className="bg-gradient-to-r from-red-900 to-red-800 p-5 text-white flex justify-between items-center">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <DollarSign size={20} /> Adjust Salary Parameters
              </h2>
              <button
                onClick={() => setShowPayrollEditModal(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition"
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handlePayrollEditSubmit} className="p-5 space-y-4">
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs">
                <span className="text-gray-400 font-bold uppercase tracking-wider block">Employee</span>
                <strong className="text-gray-700 text-sm mt-0.5 block">{payrollEditData.employee_name}</strong>
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] text-gray-400 font-extrabold uppercase mb-1.5">Allowances / Bonuses (LKR)</label>
                <input
                  type="number"
                  step="0.01"
                  className="p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none text-sm font-semibold"
                  value={payrollEditData.allowances}
                  onChange={(e) => setPayrollEditData({ ...payrollEditData, allowances: e.target.value })}
                />
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] text-gray-400 font-extrabold uppercase mb-1.5">Deductions / Advances (LKR)</label>
                <input
                  type="number"
                  step="0.01"
                  className="p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none text-sm font-semibold"
                  value={payrollEditData.deductions}
                  onChange={(e) => setPayrollEditData({ ...payrollEditData, deductions: e.target.value })}
                />
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPayrollEditModal(false)}
                  className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-red-800 hover:bg-red-900 text-white font-bold rounded-xl text-sm"
                >
                  Save Adjustments
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PRINT-ONLY COMPONENT: PAYSLIP INVOICE */}
      {/* ========================================================================= */}
      <div className="hidden">
        {selectedPayRecord && (
          <div
            ref={payslipPrintRef}
            className="p-12 text-gray-800 font-sans max-w-4xl mx-auto border border-gray-300 rounded bg-white relative"
          >
            {/* Header */}
            <div className="flex justify-between items-start border-b border-gray-300 pb-6">
              <div>
                <h1 className="text-2xl font-black uppercase text-red-900">NSS AUTO SPARES</h1>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  No. 128, Kandy Road, Kurunegala<br />
                  info@nssauto.lk | +94 77 123 4567
                </p>
              </div>
              <div className="text-right">
                <h2 className="text-xl font-bold uppercase text-gray-600">SALARY SLIP</h2>
                <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                  <p>
                    Period: <strong>{months.find((m) => m.value === payrollMonth)?.label} {payrollYear}</strong>
                  </p>
                  <p>
                    Date: <strong>{new Date().toLocaleDateString()}</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Employee Block */}
            <div className="grid grid-cols-2 gap-6 my-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">EMPLOYEE DETAILS</p>
                <h3 className="text-base font-bold text-gray-800 mt-1">
                  {selectedPayRecord.employee_details?.first_name} {selectedPayRecord.employee_details?.last_name}
                </h3>
                <p className="text-xs font-bold text-red-900 mt-0.5 uppercase tracking-wide">
                  {selectedPayRecord.employee_details?.role}
                </p>
              </div>
              <div className="text-right font-medium">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">SALARY STRUCTURE</p>
                <p className="text-xs text-gray-700 mt-1">
                  Payment Type: <strong>{selectedPayRecord.employee_details?.salary_type}</strong>
                </p>
                <p className="text-xs text-gray-700">
                  Rate: <strong>LKR {parseFloat(selectedPayRecord.employee_details?.salary_rate).toLocaleString()}</strong>
                </p>
              </div>
            </div>

            {/* Summary Details */}
            {selectedPayRecord.employee_details?.salary_type === "DAILY" && (
              <div className="mb-6">
                <table className="w-full border border-collapse border-gray-200 text-xs">
                  <thead className="bg-gray-100 font-bold uppercase tracking-wide">
                    <tr>
                      <th className="border border-gray-200 p-2 text-center">Days Present</th>
                      <th className="border border-gray-200 p-2 text-center">Days Paid Leave</th>
                      <th className="border border-gray-200 p-2 text-center">Days Absent</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="text-center font-bold text-gray-700">
                      <td className="border border-gray-200 p-2.5 text-green-700">{parseFloat(selectedPayRecord.days_present)}</td>
                      <td className="border border-gray-200 p-2.5 text-blue-600">{parseFloat(selectedPayRecord.days_paid_leave)}</td>
                      <td className="border border-gray-200 p-2.5 text-red-600">{parseFloat(selectedPayRecord.days_absent)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Calculations Breakdown */}
            <div className="my-8 space-y-3.5">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider pb-1 border-b border-dashed border-gray-200">
                PAYSLIP BREAKDOWN
              </h3>

              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Base Salary</span>
                <span className="font-semibold text-gray-800">LKR {parseFloat(selectedPayRecord.base_salary).toLocaleString()}</span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-green-600 font-semibold">Allowances & Bonuses (+)</span>
                <span className="font-semibold text-green-600">+LKR {parseFloat(selectedPayRecord.allowances).toLocaleString()}</span>
              </div>

              <div className="flex justify-between items-center text-sm pb-4 border-b border-gray-150">
                <span className="text-red-500 font-semibold">Deductions & Advances (-)</span>
                <span className="font-semibold text-red-500">-LKR {parseFloat(selectedPayRecord.deductions).toLocaleString()}</span>
              </div>

              <div className="flex justify-between items-center text-lg font-black text-gray-800 pt-3 bg-red-50/50 p-3 rounded-lg border border-red-100">
                <span className="uppercase tracking-wide">Net Salary Paid</span>
                <span>LKR {parseFloat(selectedPayRecord.net_salary).toLocaleString()}</span>
              </div>
            </div>

            {/* Footer Signatures */}
            <div className="grid grid-cols-2 gap-12 mt-20 pt-10 text-xs">
              <div className="text-center">
                <div className="w-48 border-b border-gray-400 mx-auto mb-2"></div>
                <p className="text-gray-500">Prepared By</p>
              </div>
              <div className="text-center">
                <div className="w-48 border-b border-gray-400 mx-auto mb-2"></div>
                <p className="text-gray-500">Employee Signature</p>
              </div>
            </div>

            {/* Paid Stamp */}
            {selectedPayRecord.status === "PAID" && (
              <div className="absolute top-20 right-20 border-4 border-green-500 text-green-500 font-black uppercase text-sm px-4 py-2 rounded-lg rotate-12 select-none pointer-events-none opacity-60">
                PAID
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeePage;
