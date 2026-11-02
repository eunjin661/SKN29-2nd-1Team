export function csvCell(value) {
  let text = String(value ?? '')
  // Keep external text as text when the CSV is opened by spreadsheet software.
  if (typeof value === 'string' && (/^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text))) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}
