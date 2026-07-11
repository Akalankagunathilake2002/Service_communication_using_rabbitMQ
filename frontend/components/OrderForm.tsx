"use client";

import { useState } from "react";
import { ORDER_API_URL } from "@/lib/config";

interface ItemRow {
  sku: string;
  qty: number;
  price: number;
}

const EMPTY_ITEM: ItemRow = { sku: "", qty: 1, price: 0 };

export default function OrderForm() {
  const [customer, setCustomer] = useState("ada");
  const [items, setItems] = useState<ItemRow[]>([{ sku: "sku-1", qty: 1, price: 19.99 }]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateItem(index: number, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`${ORDER_API_URL}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer, items }),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      setResult(`Order ${data.order_id.slice(0, 8)}… created — total $${data.total.toFixed(2)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create order");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border p-5"
      style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
    >
      <h2 className="mb-4 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        Create order
      </h2>

      <label className="mb-3 block text-xs" style={{ color: "var(--text-secondary)" }}>
        Customer
        <input
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
          required
          className="mt-1 block w-full rounded border bg-transparent px-2 py-1.5 text-sm"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
        />
      </label>

      <div className="mb-3 space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-end gap-2">
            <label className="flex-1 text-xs" style={{ color: "var(--text-secondary)" }}>
              SKU
              <input
                value={item.sku}
                onChange={(e) => updateItem(i, { sku: e.target.value })}
                required
                className="mt-1 block w-full rounded border bg-transparent px-2 py-1.5 text-sm"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </label>
            <label className="w-16 text-xs" style={{ color: "var(--text-secondary)" }}>
              Qty
              <input
                type="number"
                min={1}
                value={item.qty}
                onChange={(e) => updateItem(i, { qty: Number(e.target.value) })}
                required
                className="mt-1 block w-full rounded border bg-transparent px-2 py-1.5 text-sm"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </label>
            <label className="w-24 text-xs" style={{ color: "var(--text-secondary)" }}>
              Price
              <input
                type="number"
                min={0}
                step="0.01"
                value={item.price}
                onChange={(e) => updateItem(i, { price: Number(e.target.value) })}
                required
                className="mt-1 block w-full rounded border bg-transparent px-2 py-1.5 text-sm"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </label>
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => removeItem(i)}
                className="mb-1.5 rounded border px-2 py-1.5 text-xs"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addItem}
        className="mb-4 text-xs underline"
        style={{ color: "var(--series-1)" }}
      >
        + add item
      </button>

      <button
        type="submit"
        disabled={submitting}
        className="block w-full rounded px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        style={{ background: "var(--series-1)" }}
      >
        {submitting ? "Submitting…" : "Place order"}
      </button>

      {result && (
        <p className="mt-3 text-xs" style={{ color: "var(--status-good)" }}>
          {result}
        </p>
      )}
      {error && (
        <p className="mt-3 text-xs" style={{ color: "var(--status-critical)" }}>
          {error}
        </p>
      )}
    </form>
  );
}
