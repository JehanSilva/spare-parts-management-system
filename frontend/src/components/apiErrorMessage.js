/**
 * Turn an Axios error into something readable in an alert.
 *
 * DRF hands back a field->errors object, which is what the pages here expect.
 * But a server error (or a proxy) answers with a plain HTML/text body instead,
 * and `Object.values("<html>…")` splits a *string* into one entry per
 * character — joining those with newlines renders the page one letter per
 * line. So strings are handled before the object case.
 */
export const apiErrorMessage = (error, fallback = "Network error. Please check connection.") => {
  const data = error?.response?.data;

  if (data === null || data === undefined) return fallback;

  if (typeof data === "string") {
    const text = data.trim();
    // An HTML error page is noise in a toast — name the status instead.
    if (!text || text.startsWith("<")) {
      return error.response.status
        ? `Server error (${error.response.status}). Check the backend logs.`
        : fallback;
    }
    return text;
  }

  if (Array.isArray(data)) return data.flat().join("\n");

  if (typeof data === "object") {
    const messages = Object.entries(data)
      .map(([field, value]) => {
        const text = Array.isArray(value) ? value.flat().join(" ") : String(value);
        // DRF puts non-field errors under "detail"/"non_field_errors" — those
        // read better without a label in front of them.
        return field === "detail" || field === "non_field_errors"
          ? text
          : `${field}: ${text}`;
      })
      .filter(Boolean);
    if (messages.length) return messages.join("\n");
  }

  return fallback;
};
