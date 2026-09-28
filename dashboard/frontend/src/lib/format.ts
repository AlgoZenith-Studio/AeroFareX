import React from 'react';

/**
 * Formatting at the render boundary only (design rule 7: integer paise in state
 * and props; rupees appear only here).
 */
export const inr = (paise: number, decimals = 0) =>
  `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;

export const points = (value: number, decimals = 1) => value.toFixed(decimals);

export const signed = (value: number, decimals = 1, suffix = '') =>
  `${value > 0 ? '+' : value < 0 ? '−' : '±'}${Math.abs(value).toFixed(decimals)}${suffix}`;

export const pct = (ratio: number, decimals = 0) => `${(ratio * 100).toFixed(decimals)}%`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const shortDate = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
export const longDate = (iso: string) => `${shortDate(iso)} ${iso.slice(0, 4)}`;

export const istTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });

export const relativeTime = (iso: string, now = Date.now()) => {
  const mins = Math.round((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
};

/**
 * Renders a string such that ONLY numeric tokens (digits, decimals, signed numbers, percentages)
 * are wrapped in <span className="num font-bold"> (Google Sans Bold font), while preserving non-numeric
 * text (labels, titles, units, names) in the surrounding container's font (AFX Serif / display font).
 */
export function renderValueWithNum(val: string | number | null | undefined): React.ReactNode {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (!str) return str;

  // Split string into numeric parts and non-numeric text parts
  const parts = str.split(/([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?%?x?)/g);
  return parts.map((part, index) => {
    if (/^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?%?x?$/.test(part)) {
      return React.createElement('span', { key: index, className: 'num font-bold' }, part);
    }
    return React.createElement(React.Fragment, { key: index }, part);
  });
}

