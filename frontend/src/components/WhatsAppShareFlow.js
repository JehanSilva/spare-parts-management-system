import React, { useState, useRef, useEffect } from "react";
import html2canvas from "html2canvas";
import { MessageCircle, XCircle, Users, Phone, UserCheck, ChevronRight, Loader2 } from "lucide-react";
import BillingDocument from "./BillingDocument";
import { useSettings } from "../context/SettingsContext";
import { updateCustomer } from "../services/api";

// Chrome won't composite a transform animation on an <svg>, so a plain
// `animate-spin` icon freezes solid the moment html2canvas seizes the main
// thread — which is precisely when the spinner matters. Spinning a promoted
// wrapper element keeps the animation on the compositor instead; see
// .animate-spin-composited in index.css.
const Spinner = ({ size = 18, className = "" }) => (
  <span className={`animate-spin-composited inline-flex shrink-0 ${className}`}>
    <Loader2 size={size} />
  </span>
);

// Lets the cashier pick how to send the document: straight to the registered
// customer's number (only offered when one is on file), by picking a chat in
// WhatsApp itself, or by typing a one-off number.
const ShareOptionsModal = ({
  customerName,
  customerPhone,
  documentLabel,
  busyKey,
  preparing,
  onCancel,
  onSelect,
}) => {
  // The share sheet is the only route that can attach the image itself; the
  // number-based ones hand it over via the clipboard instead.
  const attachesImage = isMobileDevice() && canShareFiles();
  const insecure = isInsecureContext();
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
      subtitle: attachesImage
        ? `Attaches the ${documentLabel.toLowerCase()} — pick the chat in WhatsApp`
        : "Opens WhatsApp so you can pick the chat",
    },
    {
      key: "manual",
      icon: Phone,
      title: "Enter a number",
      subtitle: "Type the number to send the document to",
    },
  ].filter(Boolean);
  const busy = !!busyKey;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm print:hidden"
      onClick={busy ? undefined : onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-green-600 px-5 py-4 text-white flex items-center justify-between">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <MessageCircle size={18} /> Share to WhatsApp
          </h3>
          <button
            onClick={onCancel}
            disabled={busy}
            className="hover:bg-green-700 p-1 rounded-full transition-colors disabled:opacity-40"
          >
            <XCircle size={20} />
          </button>
        </div>
        <div className="p-4">
          {/* The options stay mounted underneath the cover so the modal keeps
              its height — and so the spinner is already painted when
              html2canvas seizes the main thread. */}
          <div className="relative space-y-2">
            {options.map(({ key, icon: Icon, title, subtitle }) => {
              const isBusy = busyKey === key;
              return (
                <button
                  key={key}
                  onClick={() => onSelect(key)}
                  disabled={busy || preparing}
                  className={`w-full flex items-center gap-3 p-3 text-left border rounded-xl transition-colors disabled:cursor-not-allowed ${
                    isBusy
                      ? "border-green-500 bg-green-50"
                      : "border-gray-200 hover:border-green-500 hover:bg-green-50 disabled:opacity-50"
                  }`}
                >
                  <span className="p-2 bg-green-100 text-green-700 rounded-lg shrink-0">
                    {isBusy ? <Spinner size={18} /> : <Icon size={18} />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-gray-800">{title}</span>
                    <span className="block text-xs text-gray-500 truncate">
                      {isBusy ? "Preparing document..." : subtitle}
                    </span>
                  </span>
                  {!isBusy && <ChevronRight size={18} className="text-gray-400 shrink-0" />}
                </button>
              );
            })}
            {insecure ? (
              <p className="px-3 py-2 text-[11px] leading-snug font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-lg">
                This page isn't on https, so the browser blocks attaching and
                copying images. WhatsApp will open with the sale details as text
                only — use the hosted site to send the{" "}
                {documentLabel.toLowerCase()} itself.
              </p>
            ) : (
              <p className="px-1 pt-1 text-[11px] leading-snug text-gray-400">
                Sending to a number opens that exact chat with the{" "}
                {documentLabel.toLowerCase()} image copied — long-press the
                message box and paste it.
              </p>
            )}

            {preparing && (
              <div className="absolute -inset-2 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-white/90 backdrop-blur-[2px] text-center">
                <Spinner size={32} className="text-green-600" />
                <div>
                  <p className="text-sm font-bold text-gray-800">
                    Preparing {documentLabel.toLowerCase()} image...
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Sharing options unlock once it's ready.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Prompts for a one-off phone number to send the document to — either because
// the customer has none on file yet, or because the cashier chose to type one.
const PhoneEntryModal = ({ onCancel, onBack, onSubmit, isSaving, preparing, documentLabel }) => {
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
      onClick={isSaving ? undefined : onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-green-600 px-5 py-4 text-white flex items-center justify-between">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <MessageCircle size={18} /> Enter WhatsApp Number
          </h3>
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="hover:bg-green-700 p-1 rounded-full transition-colors disabled:opacity-40"
          >
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
            disabled={isSaving}
            className="px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {onBack ? "Back" : "Cancel"}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving || preparing}
            className="px-5 py-2 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-70 flex items-center gap-2"
          >
            {(isSaving || preparing) && <Spinner size={16} />}
            {preparing
              ? `Preparing ${documentLabel.toLowerCase()}...`
              : isSaving
              ? "Sharing..."
              : "Share"}
          </button>
        </div>
      </div>
    </div>
  );
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
  // Revoking straight away cancels the download in some browsers before it
  // has read the blob.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
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

// navigator.share and navigator.clipboard are secure-context APIs: over plain
// http:// on a LAN IP (a dev server reached from a phone, say) the browser
// doesn't define them at all, so neither attaching nor copying the image can
// work no matter what the page does. Worth saying out loud rather than
// silently degrading.
const isInsecureContext = () =>
  typeof window !== "undefined" && window.isSecureContext === false;

// iOS puts a confirmation sheet in front of every download and files it away
// in Files, where attaching it to a chat is a multi-step hunt. Worse, that
// sheet swallows the wa.me hand-off that follows, which reads as the button
// doing nothing at all — so iOS never gets the download route.
const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// Resolves once the browser has painted a frame. html2canvas blocks the main
// thread outright — on a phone for a second or more — and anything rendered
// after it starts stays invisible until it finishes, so spinners must be on
// screen *before* the work begins. Tailwind's animate-spin is a compositor
// transform, so it keeps turning through the freeze once it's painted.
const nextPaint = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

// Whether this browser can put a file into the native share sheet at all.
// Probed with a throwaway PNG so the answer is available synchronously,
// before the real document has finished rasterising.
const canShareFiles = () => {
  if (!navigator.share || !navigator.canShare) return false;
  try {
    const probe = new File([new Uint8Array(1)], "probe.png", { type: "image/png" });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
};

// Copying the image to the clipboard is what makes the straight-to-the-chat
// route usable: the cashier long-presses the WhatsApp message box and pastes
// it, instead of hunting for a downloaded file. Safari only honours clipboard
// writes started inside the tap that triggered them, so the *pending*
// rasterise promise is handed to ClipboardItem rather than awaited first —
// the spec allows a Promise<Blob> for exactly this case. Never await anything
// before calling this.
const copyImageToClipboard = (filePromise) => {
  if (!filePromise || typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    return Promise.resolve(false);
  }
  
  const png = filePromise.then((file) => {
    if (!file) throw new Error("Document image could not be rendered");
    return file;
  });

  const fallbackWrite = () => filePromise.then((file) => {
    if (!file) return false;
    return navigator.clipboard.write([new ClipboardItem({ "image/png": file })])
      .then(() => true)
      .catch((e) => {
        console.error("Fallback clipboard write failed", e);
        return false;
      });
  });

  try {
    return navigator.clipboard
      .write([new ClipboardItem({ "image/png": png })])
      .then(() => true)
      .catch((err) => {
        console.warn("Promise-based clipboard write failed, attempting Blob fallback...", err);
        return fallbackWrite();
      });
  } catch (err) {
    console.warn("ClipboardItem does not support Promise, attempting Blob fallback...", err);
    return fallbackWrite();
  }
};

// Popup blockers only allow window.open() while the tap that triggered it is
// still active, which it no longer is once sharing has finished its async
// work — on mobile the link is silently swallowed. Navigate the current tab
// there instead: wa.me hands off to the WhatsApp app, and the POS page is
// still sitting there on the way back.
const openWhatsApp = (url) => {
  if (isMobileDevice()) {
    window.location.href = url;
    return;
  }
  window.open(url, "_blank");
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
  // Which option is mid-share, so its row can show a spinner instead of the
  // modal simply vanishing while the document is still being rasterised.
  const [busyOption, setBusyOption] = useState(null);
  // Locally-entered number, so the "registered number" option can appear on a
  // re-share within the same session even before the sale data is refetched.
  const [phoneOverride, setPhoneOverride] = useState(null);
  // Promise of the rasterised document, started as soon as the flow opens.
  const filePromiseRef = useRef(null);
  // Drives the "preparing" spinner: this, not the tap, is the part that
  // actually takes time on a phone.
  const [documentReady, setDocumentReady] = useState(false);

  // navigator.share() only works while the tap that triggered it still counts
  // as a user activation, and rasterising the document takes far longer than
  // that window allows (iOS Safari rejects after *any* await). So capture the
  // document up-front, while the cashier is still choosing a recipient, and
  // keep the share call itself as close to the tap as possible.
  useEffect(() => {
    if (!sale) {
      filePromiseRef.current = null;
      return;
    }
    setStep("options");
    setPhoneOverride(null);
    setBusyOption(null);
    setDocumentReady(false);

    let cancelled = false;
    let timeoutId;
    const fileName = `${documentLabel.toLowerCase()}-${sale.id.substring(0, 8)}.png`;
    const prepare = async () => {
      // Get the modal and its spinner on screen before the main thread locks
      // up, otherwise the cashier stares at a frozen, unmarked UI.
      await nextPaint();
      await waitForImagesToLoad(documentRef.current);
      const canvas = await html2canvas(documentRef.current, {
        scale: isMobileDevice() ? 1 : 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      return blob ? new File([blob], fileName, { type: "image/png" }) : null;
    };

    // A rasterise that never settles would leave the cover spinning forever
    // with every option disabled, so cap the wait and fall through to a
    // text-only share rather than trapping the cashier in the modal.
    const promise = Promise.race([
      prepare(),
      new Promise((resolve) => {
        timeoutId = setTimeout(() => {
          console.error("Timed out rendering document for WhatsApp share");
          resolve(null);
        }, 12000);
      }),
    ])
      .catch((err) => {
        console.error("Failed to render document for WhatsApp share", err);
        return null;
      })
      .finally(() => clearTimeout(timeoutId));
    filePromiseRef.current = promise;
    promise.then(() => {
      if (!cancelled) setDocumentReady(true);
    });

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [sale, documentLabel]);

  useEffect(() => {
    onSharingChange?.(sharing);
  }, [sharing, onSharingChange]);

  if (!sale) return null;

  const customerPhone = phoneOverride || sale.customer_phone || null;

  const buildCaption = () => {
    let msg = `Hi ${sale.customer_name || "Customer"},\n\n` +
      `Please see the attached receipt for your recent service at NSS Auto Engineers.\n\n` +
      `Invoice: #${sale.id.substring(0, 8).toUpperCase()}`;
    if (sale.vehicle_number) {
      msg += ` | Vehicle: ${sale.vehicle_number}`;
    }
    msg += ` | Total: LKR ${parseFloat(sale.total_amount).toLocaleString()}\n\n` +
      `Thank you, and drive safely.`;
    return msg;
  };

  // Sri Lankan numbers are stored locally (e.g. "0765722909"); wa.me needs
  // the full international number with no leading zero or plus sign.
  const formatPhoneForWhatsApp = (phone) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.startsWith("0")) return `94${digits.slice(1)}`;
    return digits;
  };

  // Two routes, because no browser API does both halves of the job:
  //   * `phone` is null — the "let me pick the chat" option. On mobile the
  //     native share sheet handles it and attaches the image itself, which is
  //     the one way to get a real attachment out of a browser.
  //   * `phone` is set — wa.me opens that exact chat with the caption ready,
  //     but can never carry a file, so the image goes to the clipboard for the
  //     cashier to paste into the message box (falling back to a download when
  //     the browser won't write images to the clipboard).
  const share = async (phone) => {
    const caption = buildCaption();
    const filePromise = filePromiseRef.current;
    const useShareSheet = !phone && isMobileDevice() && canShareFiles();
    // Started before the first await, or Safari rejects the write outright.
    const clipboardCopy = useShareSheet ? null : copyImageToClipboard(filePromise);

    setSharing(true);
    // Usually already resolved by now; awaiting only matters when the cashier
    // picks a recipient faster than the document renders.
    const file = await (filePromise || Promise.resolve(null));

    try {
      if (useShareSheet && file && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: caption, title: documentLabel });
          return;
        } catch (err) {
          // Backing out of the share sheet isn't a failure.
          if (err?.name === "AbortError") return;
          // Anything else — an expired activation, a target that refuses the
          // file — falls through to the link below rather than dead-ending on
          // an error the cashier can do nothing about.
          console.error("Native share failed, falling back to wa.me link", err);
        }
      }

      const copied = clipboardCopy ? await clipboardCopy : false;
      // Only worth downloading when the clipboard route didn't work — the
      // cashier would otherwise have to dig the file out of Downloads/Files —
      // and never on iOS, where the download sheet blocks the hand-off.
      let downloaded = false;
      if (!copied && file && !isIOS()) {
        try {
          downloadBlob(file, file.name);
          downloaded = true;
        } catch (err) {
          console.error("Failed to download document image", err);
        }
      }

      if (copied) {
        onAlert?.({
          type: "success",
          message: `${documentLabel} image copied — long-press the WhatsApp message box and paste it.`,
        });
      } else if (downloaded) {
        onAlert?.({
          type: "info",
          message: `${documentLabel} image saved — attach it in the WhatsApp chat that just opened.`,
        });
      } else if (isInsecureContext()) {
        onAlert?.({
          type: "error",
          message: `Sharing the ${documentLabel.toLowerCase()} image needs a secure (https) connection — sent the sale details as text only.`,
        });
      } else {
        onAlert?.({
          type: "error",
          message: `Couldn't prepare the ${documentLabel.toLowerCase()} image — the sale details were shared as text only.`,
        });
      }

      const recipient = phone ? formatPhoneForWhatsApp(phone) : "";
      // On mobile the wa.me hand-off takes over the current tab, which would
      // cancel a download that has only just started — give it a moment first.
      if (downloaded) await new Promise((resolve) => setTimeout(resolve, 400));
      openWhatsApp(`https://wa.me/${recipient}?text=${encodeURIComponent(caption)}`);
    } finally {
      setSharing(false);
      setBusyOption(null);
      onClose?.();
    }
  };

  const handleOptionSelect = (option) => {
    if (option === "manual") {
      setStep("phone");
      return;
    }
    setBusyOption(option);
    share(option === "registered" ? customerPhone : null);
  };

  const handlePhoneSubmit = (phone) => {
    setPhoneOverride(phone);
    // Only backfill the customer record when it has no number yet — a typed-in
    // one-off number must not overwrite an already-registered one. Deliberately
    // not awaited: the clipboard write inside share() has to start within the
    // tap that triggered it, and it's non-fatal if saving the number fails.
    if (sale.customer && !sale.customer_phone) {
      updateCustomer(sale.customer, { phone }).catch(() => {});
    }
    share(phone);
  };

  return (
    <>
      {step === "options" && (
        <ShareOptionsModal
          customerName={sale.customer_name}
          customerPhone={customerPhone}
          documentLabel={documentLabel}
          busyKey={busyOption}
          preparing={!documentReady}
          onCancel={onClose}
          onSelect={handleOptionSelect}
        />
      )}

      {step === "phone" && (
        <PhoneEntryModal
          onCancel={onClose}
          onBack={() => setStep("options")}
          onSubmit={handlePhoneSubmit}
          isSaving={sharing}
          preparing={!documentReady}
          documentLabel={documentLabel}
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
