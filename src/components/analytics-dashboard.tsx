"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyticsPayload } from "@/types/etsy";

const COLORS = ["#0E7490", "#CA8A04", "#4F46E5", "#DC2626", "#059669", "#7C3AED", "#B45309"];

function getCurrentMonth() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

export function AnalyticsDashboard() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [selectedListingId, setSelectedListingId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);

  const hasData = (analytics?.rowCount ?? 0) > 0;

  async function fetchAnalytics(targetMonth: string, listingId?: string) {
    setIsLoading(true);
    setError("");

    try {
      const query = new URLSearchParams({ month: targetMonth });
      if (listingId) {
        query.set("listingId", listingId);
      }

      const response = await fetch(`/api/analytics?${query.toString()}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Analytics alınamadı.");
      }

      setAnalytics(payload as AnalyticsPayload);
      setSelectedListingId((payload as AnalyticsPayload).selectedListingId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analytics yükleme hatası.";
      setError(message);
      setAnalytics(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function uploadCsv() {
    if (!file) {
      setError("Lütfen bir CSV dosyası seçin.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("month", month);

      const response = await fetch("/api/upload-csv", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "CSV yükleme başarısız.");
      }

      await fetchAnalytics(month);
      setFile(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "CSV yükleme hatası.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  const listingOptions = useMemo(() => analytics?.listingSummary ?? [], [analytics]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 via-amber-50 to-white text-slate-900">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
        <section className="rounded-2xl border border-cyan-100 bg-white/95 p-5 shadow-sm backdrop-blur">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Etsy Sipariş Analiz Paneli</h1>
          <p className="mt-1 text-sm text-slate-600">
            CSV dosyanı yükle, verileri Google Sheets&apos;e kaydet ve ürün performansını anlık incele.
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-[180px_1fr_auto_auto]">
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
            />

            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
            />

            <button
              onClick={uploadCsv}
              disabled={isLoading}
              className="h-11 rounded-lg bg-cyan-700 px-4 font-medium text-white disabled:opacity-60"
            >
              CSV Yukle
            </button>

            <button
              onClick={() => fetchAnalytics(month)}
              disabled={isLoading}
              className="h-11 rounded-lg border border-cyan-700 px-4 font-medium text-cyan-700 disabled:opacity-60"
            >
              Analizi Getir
            </button>
          </div>

          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Toplam Satilan Adet</p>
            <p className="mt-2 text-3xl font-semibold">{analytics?.totalQuantity ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Toplam Satir</p>
            <p className="mt-2 text-3xl font-semibold">{analytics?.rowCount ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Aktif Listing</p>
            <p className="mt-2 text-3xl font-semibold">{analytics?.listingSummary.length ?? 0}</p>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold">Urun Payi (Adet ve Yuzde)</h2>
            {!hasData ? (
              <p className="mt-4 text-sm text-slate-500">Gosterilecek veri yok.</p>
            ) : (
              <div className="h-80 pt-2">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={analytics?.productShare ?? []}
                      dataKey="quantity"
                      nameKey="itemName"
                      outerRadius={110}
                      label={({ payload }) => {
                        const point = payload as { itemName?: string; percentage?: number } | undefined;
                        if (!point?.itemName) {
                          return "";
                        }

                        return `${point.itemName} %${point.percentage ?? 0}`;
                      }}
                    >
                      {(analytics?.productShare ?? []).map((entry, index) => (
                        <Cell key={entry.itemName} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold">Listing Bazli Satis Adedi</h2>
            {!hasData ? (
              <p className="mt-4 text-sm text-slate-500">Gosterilecek veri yok.</p>
            ) : (
              <div className="h-80 pt-2">
                <ResponsiveContainer>
                  <BarChart data={analytics?.listingSummary ?? []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="listingId" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="quantity" fill="#0E7490" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg font-semibold">Secilen Listing Icin Gunluk Satis</h2>
            <select
              value={selectedListingId}
              onChange={(event) => {
                const value = event.target.value;
                setSelectedListingId(value);
                fetchAnalytics(month, value);
              }}
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
            >
              {listingOptions.map((listing) => (
                <option key={listing.listingId} value={listing.listingId}>
                  {listing.listingId} - {listing.itemName}
                </option>
              ))}
            </select>
          </div>

          {!hasData ? (
            <p className="mt-4 text-sm text-slate-500">Gosterilecek veri yok.</p>
          ) : (
            <div className="mt-3 grid gap-4 xl:grid-cols-[2fr_1fr]">
              <div className="h-80">
                <ResponsiveContainer>
                  <LineChart data={analytics?.listingDaily ?? []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="quantity" stroke="#CA8A04" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Gun</th>
                      <th className="px-3 py-2 text-right">Adet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analytics?.listingDaily ?? []).map((row) => (
                      <tr key={row.day} className="border-t border-slate-100">
                        <td className="px-3 py-2">{row.day}</td>
                        <td className="px-3 py-2 text-right font-medium">{row.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Eyalet Bazli Satin Alim Siralamasi</h2>
          {!hasData ? (
            <p className="mt-4 text-sm text-slate-500">Gosterilecek veri yok.</p>
          ) : (
            <div className="mt-3 grid gap-4 xl:grid-cols-[2fr_1fr]">
              <div className="h-80">
                <ResponsiveContainer>
                  <BarChart data={analytics?.stateRanking ?? []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="shipState" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="quantity" fill="#1D4ED8" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Eyalet</th>
                      <th className="px-3 py-2 text-right">Adet</th>
                      <th className="px-3 py-2 text-right">Siparis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analytics?.stateRanking ?? []).map((row) => (
                      <tr key={row.shipState} className="border-t border-slate-100">
                        <td className="px-3 py-2">{row.shipState}</td>
                        <td className="px-3 py-2 text-right font-medium">{row.quantity}</td>
                        <td className="px-3 py-2 text-right">{row.orderCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
