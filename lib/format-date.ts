const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2027-02-09" -> "9 Feb 2027" — a fixed 3-letter month abbreviation, since Intl's "short" style inconsistently returns "Sept" instead of "Sep" depending on the runtime's ICU data. */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return `${day} ${SHORT_MONTHS[month - 1]} ${year}`;
}
