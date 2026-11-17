/**
 * Vehicle facts a printed sale document shows, derived once so the A4 Invoice
 * and the 80mm Receipt can never disagree.
 *
 * `Sale.vehicle_number` is free text; the make/model and the last known
 * odometer reading live in the vehicle registry, which the API attaches to
 * every sale as `vehicle_details` (SaleSerializer.get_vehicle_details).
 */
export const getVehicleInfo = (sale) => {
  const details = sale?.vehicle_details || null;

  // Prefer the reading taken on this job, dated this job. A job often doesn't
  // record a new one, so fall back to the vehicle's last known reading — and
  // print the date it was actually taken, otherwise the figure reads as
  // today's when it may be months old.
  let mileage = sale?.mileage ?? null;
  let recordedAt = mileage != null ? sale?.created_at : null;

  if (mileage == null && details?.current_mileage != null) {
    mileage = details.current_mileage;
    recordedAt = details.mileage_updated_at || null;
  }

  const plate = sale?.vehicle_number || "";
  const makeModel = details ? [details.make, details.model].filter(Boolean).join(" ") : "";
  const mileageLabel = mileage != null ? `${Number(mileage).toLocaleString()} km` : "";
  const mileageDate = recordedAt ? new Date(recordedAt).toLocaleDateString("en-GB") : "";

  return {
    plate,
    makeModel,
    mileageLabel,
    mileageDate,
    // Single-line forms, for the A4 invoice where vertical space is what
    // decides how many sheets a long sale costs. Empty when there's nothing
    // to say, so the caller can drop the line entirely.
    vehicleLine: [plate, makeModel].filter(Boolean).join(" · "),
    mileageLine: mileageLabel
      ? mileageDate
        ? `${mileageLabel} (rec. ${mileageDate})`
        : mileageLabel
      : "",
  };
};

/**
 * The name a saved sale document gets, e.g.
 * "KT-8352 Perodua Viva Elite - Invoice 006A38F4". Without a vehicle it's
 * named after the customer. Characters a file name can't hold are dropped.
 */
export const billingFileName = (sale, documentLabel = "Invoice") => {
  if (!sale) return documentLabel;
  const { plate, makeModel } = getVehicleInfo(sale);
  const who = [plate, makeModel].filter(Boolean).join(" ") || sale.customer_name || "";
  const id = sale.id ? String(sale.id).substring(0, 8).toUpperCase() : "";
  const name = [who, `${documentLabel} ${id}`.trim()].filter(Boolean).join(" - ");
  return name.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
};

/**
 * window.print() with the page title set to `title`, which browsers use as
 * the suggested file name for "Save as PDF". The old title comes back once
 * the dialog closes (or after a fallback delay where afterprint isn't fired).
 */
export const printWithTitle = (title) => {
  const previous = document.title;
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    document.title = previous;
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  document.title = title;
  window.print();
  // print() blocks until the dialog closes in most browsers; this covers the rest.
  setTimeout(restore, 1000);
};

export default getVehicleInfo;
