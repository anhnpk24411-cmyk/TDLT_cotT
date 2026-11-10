/**
 * Vietnamese currency, percentage, and date formatters.
 */

const vndFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('vi-VN', {
  maximumFractionDigits: 0,
});

export function formatVND(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return '0 ₫';
  return vndFormatter.format(Math.round(amount));
}

export function formatNumberVN(val: number): string {
  if (isNaN(val) || val === null || val === undefined) return '0';
  return numberFormatter.format(Math.round(val));
}

export function formatPercent(decimal: number, fractionDigits = 1): string {
  if (isNaN(decimal) || decimal === null || decimal === undefined) return '0%';
  const pct = decimal * 100;
  return `${pct.toLocaleString('vi-VN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}%`;
}

export function formatPoints(pp: number, fractionDigits = 2): string {
  if (isNaN(pp) || pp === null || pp === undefined) return '0 pp';
  return `${pp.toLocaleString('vi-VN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })} pp`;
}

export function formatDateVN(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    // YYYY-MM-DD -> DD/MM/YYYY
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
