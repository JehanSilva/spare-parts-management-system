import React, { useState } from "react";
import { NAME_PREFIXES } from "../customerName";

/**
 * Honorific picker that sits in front of a customer's name field.
 *
 * A dropdown of the everyday titles plus "Other…", which swaps in a text box —
 * a fixed list would have no room for Eng., Capt. or a company title, and a
 * plain text box on its own invites "Mr" / "Mr." / "MR" across customers.
 *
 * Emits the prefix string, or "" for no prefix.
 */
const NamePrefixSelect = ({ value = "", onChange, className = "", selectClassName = "" }) => {
  // A stored prefix that isn't in the list (typed earlier, or seeded by an
  // import) has to open in the text box, or editing would silently drop it.
  const [custom, setCustom] = useState(() => Boolean(value) && !NAME_PREFIXES.includes(value));

  if (custom) {
    return (
      <div className={className}>
        <input
          type="text"
          value={value}
          autoFocus
          maxLength={20}
          placeholder="Title"
          onChange={(e) => onChange(e.target.value)}
          // Leaving it empty means the user changed their mind — go back to the
          // list rather than stranding them in a blank box.
          onBlur={() => {
            if (!value.trim()) setCustom(false);
          }}
          className={`w-full px-2 py-2 text-sm bg-white border border-gray-300 rounded-lg text-center focus:outline-none focus:ring-1 focus:ring-blue-400 ${selectClassName}`}
        />
      </div>
    );
  }

  return (
    <div className={className}>
      <select
        value={value}
        onChange={(e) => {
          if (e.target.value === "__other__") {
            setCustom(true);
            onChange("");
            return;
          }
          onChange(e.target.value);
        }}
        className={`w-full px-2 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 ${selectClassName}`}
      >
        <option value="">—</option>
        {NAME_PREFIXES.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
        <option value="__other__">Other…</option>
      </select>
    </div>
  );
};

export default NamePrefixSelect;
