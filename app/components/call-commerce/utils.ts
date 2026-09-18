export function formatCallCommerceDate(value: any) {
  if (!value) return '—';
  const raw = value?.value || value;
  const date = new Date(raw);
  return Number.isNaN(date.getTime())
    ? String(raw)
    : date.toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
}
