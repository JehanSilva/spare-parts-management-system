import React from "react";

// Deterministic tint per name, so the same supplier/contact always shows the
// same colour instead of shuffling between renders.
const AVATAR_TINTS = [
  "bg-red-100 text-red-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-purple-100 text-purple-700",
  "bg-cyan-100 text-cyan-700",
];

export const initialsOf = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";

export const tintFor = (name = "") => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash + name.charCodeAt(i)) % AVATAR_TINTS.length;
  return AVATAR_TINTS[hash];
};

/**
 * Circular badge tinted from `name` — initials by default, or an icon when the
 * name isn't something initials read well from (a number plate, say). Shared by
 * the supplier, vehicle and model cards plus their forms.
 */
const AvatarBadge = ({ name, icon: Icon, iconSize = 20, size = "w-12 h-12 text-sm", className = "" }) => (
  <div
    className={`${size} rounded-full flex items-center justify-center font-extrabold shrink-0 ${tintFor(
      name
    )} ${className}`}
  >
    {Icon ? <Icon size={iconSize} /> : initialsOf(name)}
  </div>
);

export default AvatarBadge;
