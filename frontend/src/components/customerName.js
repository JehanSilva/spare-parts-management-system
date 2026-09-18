// How a customer's name is shown across the app. The honorific is stored apart
// from the name (so search, sorting and initials stay on the real name), and
// joined back together only for display — mirrors Customer.display_name in
// inventory/models.py.

// The everyday ones, offered as a dropdown. Anything else is typed free-hand,
// so this list never has to be exhaustive.
export const NAME_PREFIXES = ["Mr.", "Mrs.", "Ms.", "Miss", "Dr.", "Rev.", "Ven.", "Hon."];

/**
 * "Mr. Jehan Silva" for a customer object from the API. Falls back to the bare
 * name, which is also what older records and walk-ins carry.
 */
export const customerDisplayName = (customer) => {
  if (!customer) return "";
  if (customer.display_name) return customer.display_name;
  return `${customer.name_prefix || ""} ${customer.name || ""}`.trim();
};
