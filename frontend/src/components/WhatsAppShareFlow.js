import React, { useState, useRef, useEffect } from "react";
import html2canvas from "html2canvas";
import { MessageCircle, XCircle, Users, Phone, UserCheck, ChevronRight } from "lucide-react";
import BillingDocument from "./BillingDocument";
import { useSettings } from "../context/SettingsContext";
import { updateCustomer } from "../services/api";

// Lets the cashier pick how to send the document: straight to the registered
// customer's number (only offered when one is on file), by picking a chat in
// WhatsApp itself, or by typing a one-off number.
const ShareOptionsModal = ({ customerName, customerPhone, onCancel, onSelect }) => {
  const options = [
    customerPhone && {
      key: "registered",
      icon: UserCheck,
      title: "Send to registered number",
      subtitle: `${customerName || "Customer"} — ${customerPhone}`,
    },
    {
      key: "contacts",
      icon: Users,
      title: "Choose from WhatsApp contacts",
      subtitle: "Opens WhatsApp so you can pick the chat",
    },
    {
      key: "manual",
      icon: Phone,
      title: "Enter a number",
      subtitle: "Type the number to send the document to",
    },
  ].filter(Boolean);

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm print:hidden"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-green-600 px-5 py-4 text-white flex items-center justify-between">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <MessageCircle size={18} /> Share to WhatsApp
          </h3>
          <button onClick={onCancel} className="hover:bg-green-700 p-1 rounded-full transition-colors">
            <XCircle size={20} />
          </button>
        </div>
        <div className="p-4 space-y-2">
          {options.map(({ key, icon: Icon, title, subtitle }) => (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className="w-full flex items-center gap-3 p-3 text-left border border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-colors"
            >
              <span className="p-2 bg-green-100 text-green-700 rounded-lg shrink-0">
                <Icon size={18} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-gray-800">{title}</span>
                <span className="block text-xs text-gray-500 truncate">{subtitle}</span>
              </span>
              <ChevronRight size={18} className="text-gray-400 shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// Prompts for a one-off phone number to send the document to — either because
// the customer has none on file yet, or because the cashier chose to type one.
const PhoneEntryModal = ({ onCancel, onBack, onSubmit, isSaving }) => {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 9) {
      setError("Enter a valid phone number.");
      return;
    }
    onSubmit(phone.trim());
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm print:hidden"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-green-600 px-5 py-4 text-white flex items-center justify-between">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <MessageCircle size={18} /> Enter WhatsApp Number
          </h3>
          <button onClick={onCancel} className="hover:bg-green-700 p-1 rounded-full transition-colors">
            <XCircle size={20} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-gray-600">
            Enter the WhatsApp number to send this document to.
          </p>
          <input
            autoFocus
            type="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="e.g. 0771234567"
            className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onBack || onCancel}
            className="px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {onBack ? "Back" : "Cancel"}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-5 py-2 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {isSaving ? "Sharing..." : "Share"}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * The full "share this sale to WhatsApp" flow — option chooser, phone entry,
 * and rasterising the receipt/invoice — reused by POS and Sales History.
 *
 * Render it with `sale` set to the sale being shared (null when idle); it
 * renders its own off-screen copy of the document to capture. Call `onClose`
 * when finished, and `onAlert({type, message})` to surface messages in the
 * host page's alert component.
 */
const WhatsAppShareFlow = ({ sale, onClose, onAlert, onSharingChange }) => {
  const { documentLabel } = useSettings();
  const documentRef = useRef(null);
  const [step, setStep] = useState("options"); // "options" | "phone"
  const [sharing, setSharing] = useState(false);
  // Locally-entered number, so the "registered number" option can appear on a
  // re-share within the same session even before the sale data is refetched.
  const [phoneOverride, setPhoneOverride] = useState(null);

  useEffect(() => {
    if (sale) {
      setStep("options");
      setPhoneOverride(null);
    }
  }, [sale]);

  useEffect(() => {
    onSharingChange?.(sharing);
  }, [sharing, onSharingChange]);

  if (!sale) return null;

  const customerPhone = phoneOverride || sale.customer_phone || null;

  // No per-item lines — the attached document already itemises the sale.
  const buildCaption = () =>
    `Hi ${sale.customer_name}, thank you for your purchase at NSS Auto Spares!\n\n` +
    `Invoice #${sale.id.substring(0, 8).toUpperCase()}\n` +
    (sale.vehicle_number ? `Vehicle: ${sale.vehicle_number}\n` : "") +
    `\nTotal: LKR ${parseFloat(sale.total_amount).toLocaleString()}\n\n` +
    `Thank you for your business!`;

  // Sri Lankan numbers are stored locally (e.g. "0765722909"); wa.me needs
  // the full international number with no leading zero or plus sign.
  const formatPhoneForWhatsApp = (phone) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.startsWith("0")) return `94${digits.slice(1)}`;
    return digits;
  };

  // Only phones/tablets reliably offer WhatsApp (or another chat app) as a
  // real target in the native share sheet for a file. Desktop browsers that
  // report canShare()===true (e.g. Chrome on macOS) still only expose a
  // generic "Copy" action there, which round-trips through the clipboard and
  // produces duplicated/garbled pastes in WhatsApp Desktop/Web — so desktop
  // is always treated as "can't share a file" and gets the download+link
  // fallback instead, regardless of what canShare() reports.
  const isMobileDevice = () => {
    if (navigator.userAgentData) return !!navigator.userAgentData.mobile;
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  };

  // html2canvas can fire before a freshly-mounted <img> (the logo) has
  // finished loading, silently capturing a blank spot where it should be.
  const waitForImagesToLoad = async (container) => {
    const imgs = Array.from(container.querySelectorAll("img"));
    await Promise.all(
      imgs.map((img) =>
        img.complete
          ? img.decode?.().catch(() => {})
          : new Promise((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            })
      )
    );
  };

  const downloadBlob = (blob, fileName) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // `phone` may be null — that's the "pick a contact in WhatsApp yourself"
  // path, where wa.me is opened without a recipient so WhatsApp shows its own
  // chat chooser.
  const share = async (phone) => {
    setSharing(true);
    try {
      await waitForImagesToLoad(documentRef.current);
      const canvas = await html2canvas(documentRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      const caption = buildCaption();
      const fileName = `${documentLabel.toLowerCase()}-${sale.id.substring(0, 8)}.png`;

      if (blob && isMobileDevice()) {
        const file = new File([blob], fileName, { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], text: caption, title: documentLabel });
          return;
        }
      }

      // Desktop (or a mobile browser without file-share support): wa.me can
      // only pre-fill text, never attach a file, so download the document
      // image separately and let the cashier attach it themselves in the
      // WhatsApp chat that just opened.
      if (blob) downloadBlob(blob, fileName);
      const recipient = phone ? formatPhoneForWhatsApp(phone) : "";
      window.open(`https://wa.me/${recipient}?text=${encodeURIComponent(caption)}`, "_blank");
      if (blob) {
        onAlert?.({
          type: "info",
          message: `${documentLabel} image downloaded — attach it in the WhatsApp chat that just opened.`,
        });
      }
    } catch (err) {
      if (err?.name !== "AbortError") {
        onAlert?.({ type: "error", message: `Failed to share ${documentLabel.toLowerCase()}.` });
      }
    } finally {
      setSharing(false);
      onClose?.();
    }
  };

  const handleOptionSelect = (option) => {
    if (option === "manual") {
      setStep("phone");
      return;
    }
    share(option === "registered" ? customerPhone : null);
  };

  const handlePhoneSubmit = async (phone) => {
    setPhoneOverride(phone);
    // Only backfill the customer record when it has no number yet — a typed-in
    // one-off number must not overwrite an already-registered one.
    if (sale.customer && !sale.customer_phone) {
      try {
        await updateCustomer(sale.customer, { phone });
      } catch {
        // Non-fatal — still share the document even if saving the phone failed.
      }
    }
    await share(phone);
  };

  return (
    <>
      {step === "options" && !sharing && (
        <ShareOptionsModal
          customerName={sale.customer_name}
          customerPhone={customerPhone}
          onCancel={onClose}
          onSelect={handleOptionSelect}
        />
      )}

      {step === "phone" && !sharing && (
        <PhoneEntryModal
          onCancel={onClose}
          onBack={() => setStep("options")}
          onSubmit={handlePhoneSubmit}
          isSaving={sharing}
        />
      )}

      {/* The document to rasterise — kept off-screen rather than display:none
          (html2canvas can't capture a hidden element) and never printed, since
          the host page renders its own copy for that. */}
      <div className="fixed top-0 -left-[9999px] print:hidden" aria-hidden="true">
        <BillingDocument ref={documentRef} sale={sale} />
      </div>
    </>
  );
};

export default WhatsAppShareFlow;
