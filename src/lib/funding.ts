// Totals every grant in content/honours.json in rupees, so the headline figure and the ledger
// stay right when an award is added. "INR 2.2M", "JPY 7.8M", "USD 1,930" are read as written;
// an explicit "value" (in the award's currency) wins over the rounded label.
import h from "../../content/honours.json";

type Grant = (typeof h.grants)[number] & { value?: number };
const rate = h.rates as unknown as Record<string, number>;

export function parse(amount: string) {
  const m = /^([A-Z]{3})\s+([\d.,]+)\s*([KM]?)$/.exec(amount.trim());
  if (!m) return null;
  const n = parseFloat(m[2].replace(/,/g, "")) * (m[3] === "M" ? 1e6 : m[3] === "K" ? 1e3 : 1);
  return { cur: m[1], n };
}

export const items = (h.grants as Grant[])
  .filter((g) => g.amount)
  .map((g) => {
    const p = parse(g.amount!)!;
    const native = g.value ?? p.n;
    return { ...g, cur: p.cur, inr: native * rate[p.cur] };
  })
  .sort((a, b) => b.inr - a.inr);

export const total = items.reduce((s, g) => s + g.inr, 0);
export const byKind = (k: string) => items.filter((g) => g.kind === k).reduce((s, g) => s + g.inr, 0);

// INR 8.1M and its lakh reading, the two ways Indian readers meet a figure this size
export const fmtM = (inr: number) => `INR ${(inr / 1e6).toFixed(1)}M`;
export const fmtLakh = (inr: number) => `₹${Math.round(inr / 1e5)} lakh`;
export const fmtShort = (inr: number) => (inr >= 1e6 ? fmtM(inr) : `INR ${Math.round(inr / 1e3)}K`);
