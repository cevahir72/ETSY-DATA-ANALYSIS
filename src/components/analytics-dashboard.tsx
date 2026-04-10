"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

const TAB_ITEMS = [
  { key: "product", label: "Product Share" },
  { key: "listing", label: "By Listing" },
  { key: "daily", label: "Daily Listing" },
  { key: "state", label: "By State" },
] as const;

type ChartTab = (typeof TAB_ITEMS)[number]["key"];

const BANNER_SLIDES = [
  {
    title: "Upload CSV, Get Insights Fast",
    subtitle: "Transform Etsy exports into clean, visual analytics in seconds.",
    className: "from-cyan-600 via-blue-600 to-indigo-700",
  },
  {
    title: "Track Listing Performance",
    subtitle: "Compare listing IDs, product share, and daily sales trends at a glance.",
    className: "from-amber-500 via-orange-500 to-rose-600",
  },
  {
    title: "Know Your Top States",
    subtitle: "Discover where orders come from and optimize your inventory decisions.",
    className: "from-emerald-600 via-teal-600 to-cyan-700",
  },
] as const;

const MONTH_NAMES_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const MONTH_NAMES_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function getCurrentMonth() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

function formatMonthLabel(monthValue: string) {
  const [yearText, monthText] = monthValue.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  if (!year || monthIndex < 0 || monthIndex > 11) {
    return monthValue;
  }

  return `${MONTH_NAMES_FULL[monthIndex]} ${year}`;
}

export function AnalyticsDashboard() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [selectedListingId, setSelectedListingId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [activeTab, setActiveTab] = useState<ChartTab>("product");
  const [activeBanner, setActiveBanner] = useState(0);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);

  const [monthYear] = month.split("-");
  const activeYear = Number(monthYear) || new Date().getFullYear();
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 8 }, (_, idx) => currentYear - 4 + idx);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveBanner((prev) => (prev + 1) % BANNER_SLIDES.length);
    }, 6000);

    return () => window.clearInterval(timer);
  }, []);

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
        throw new Error(payload.error ?? "Failed to fetch analytics.");
      }

      setAnalytics(payload as AnalyticsPayload);
      setSelectedListingId((payload as AnalyticsPayload).selectedListingId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analytics loading failed.";
      setError(message);
      setAnalytics(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function uploadCsv() {
    if (!file) {
      setError("Please select a CSV file.");
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
        throw new Error(payload.error ?? "CSV upload failed.");
      }

      await fetchAnalytics(month);
      setFile(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "CSV upload failed.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  const listingOptions = useMemo(() => analytics?.listingSummary ?? [], [analytics]);

  const productShareForChart = useMemo(() => {
    const data = analytics?.productShare ?? [];
    if (data.length <= 16) {
      return data;
    }

    const main = data.slice(0, 15);
    const others = data.slice(15);
    const otherQuantity = others.reduce((sum, row) => sum + row.quantity, 0);
    const otherPercentage = Number(others.reduce((sum, row) => sum + row.percentage, 0).toFixed(2));

    return [
      ...main,
      {
        itemName: "Others",
        quantity: otherQuantity,
        percentage: otherPercentage,
      },
    ];
  }, [analytics]);

  const listingForChart = useMemo(() => (analytics?.listingSummary ?? []).slice(0, 25), [analytics]);
  const stateForChart = useMemo(() => (analytics?.stateRanking ?? []).slice(0, 25), [analytics]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 via-amber-50 to-white text-slate-900">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
        <section className="rounded-2xl border border-cyan-100 bg-white/95 p-5 shadow-sm backdrop-blur">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Etsy Order Analytics Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">
            Upload your CSV, sync data to PostgreSQL, and analyze product performance instantly.
          </p>

          <div className="relative mt-4 overflow-hidden rounded-xl border border-cyan-100 shadow-sm">
            <div
              className="flex transition-transform duration-700 ease-out"
              style={{ transform: `translateX(-${activeBanner * 100}%)` }}
            >
              {BANNER_SLIDES.map((slide) => (
                <div key={slide.title} className="min-w-full">
                  <div
                    className={`relative h-36 bg-gradient-to-r ${slide.className} px-5 py-4 text-white md:h-40 md:px-7 md:py-5`}
                  >
                    <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/20 blur-2xl" />
                    <div className="absolute -bottom-10 right-24 h-32 w-32 rounded-full bg-black/20 blur-2xl" />
                    <div className="relative z-10">
                      <p className="text-xl font-semibold tracking-tight md:text-2xl">{slide.title}</p>
                      <p className="mt-2 max-w-2xl text-sm text-white/90 md:text-base">{slide.subtitle}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="absolute bottom-3 left-4 flex gap-1.5">
              {BANNER_SLIDES.map((slide, idx) => (
                <button
                  key={slide.title}
                  onClick={() => setActiveBanner(idx)}
                  className={`h-2.5 rounded-full transition-all ${
                    activeBanner === idx ? "w-7 bg-white" : "w-2.5 bg-white/50"
                  }`}
                  aria-label={`Go to banner ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[220px_1fr_auto_auto]">
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsMonthPickerOpen((prev) => !prev)}
                className="flex h-11 w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700"
              >
                <span className="truncate">{formatMonthLabel(month)}</span>
                <span className="text-slate-400">▾</span>
              </button>

              {isMonthPickerOpen ? (
                <div className="absolute left-0 top-12 z-30 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                  <select
                    value={activeYear}
                    onChange={(event) => {
                      const selectedYear = Number(event.target.value);
                      const [, monthPart] = month.split("-");
                      setMonth(`${selectedYear}-${monthPart}`);
                    }}
                    className="mb-3 h-9 w-full rounded-md border border-slate-300 px-2 text-sm"
                  >
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>

                  <div className="grid grid-cols-4 gap-1.5">
                    {MONTH_NAMES_SHORT.map((monthName, idx) => {
                      const monthValue = `${activeYear}-${String(idx + 1).padStart(2, "0")}`;
                      const isActive = monthValue === month;
                      return (
                        <button
                          key={monthName}
                          type="button"
                          onClick={() => {
                            setMonth(monthValue);
                            setIsMonthPickerOpen(false);
                          }}
                          className={`h-8 rounded-md text-xs font-medium ${
                            isActive
                              ? "bg-cyan-700 text-white"
                              : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {monthName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex h-11 items-center gap-2 rounded-lg border border-slate-300 px-2 text-sm">
              <label
                htmlFor="csv-file-input"
                className="inline-flex h-8 items-center rounded-md bg-slate-100 px-3 text-slate-700 hover:bg-slate-200"
              >
                Choose File
              </label>
              <span className="truncate text-slate-500">{file?.name ?? "No file selected"}</span>
              <input
                id="csv-file-input"
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="sr-only"
              />
            </div>

            <button
              onClick={uploadCsv}
              disabled={isLoading}
              className="h-11 rounded-lg bg-cyan-700 px-4 font-medium text-white disabled:opacity-60"
            >
              Upload CSV
            </button>

            <button
              onClick={() => fetchAnalytics(month)}
              disabled={isLoading}
              className="h-11 rounded-lg border border-cyan-700 px-4 font-medium text-cyan-700 disabled:opacity-60"
            >
              Load Analytics
            </button>
          </div>

          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Total Units Sold</p>
            <p className="mt-2 text-3xl font-semibold">{analytics?.totalQuantity ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Total Rows</p>
            <p className="mt-2 text-3xl font-semibold">{analytics?.rowCount ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Active Listings</p>
            <p className="mt-2 text-3xl font-semibold">{analytics?.listingSummary.length ?? 0}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
            {TAB_ITEMS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  activeTab === tab.key
                    ? "bg-cyan-700 text-white"
                    : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {!hasData ? (
            <p className="mt-4 text-sm text-slate-500">No data to display.</p>
          ) : null}

          {hasData && activeTab === "product" ? (
            <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
              <div className="h-[560px] rounded-xl border border-slate-200 p-2">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={productShareForChart} dataKey="quantity" nameKey="itemName" outerRadius={170}>
                      {productShareForChart.map((entry, index) => (
                        <Cell key={entry.itemName} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value} units`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="max-h-[560px] overflow-y-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Product</th>
                      <th className="px-3 py-2 text-right">Units</th>
                      <th className="px-3 py-2 text-right">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analytics?.productShare ?? []).map((row, index) => (
                      <tr key={row.itemName} className="border-t border-slate-100">
                        <td className="px-3 py-2">
                          <span
                            className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="align-middle">{row.itemName}</span>
                        </td>
                        <td className="px-3 py-2 text-right font-medium">{row.quantity}</td>
                        <td className="px-3 py-2 text-right">{row.percentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {hasData && activeTab === "listing" ? (
            <div className="mt-4 grid gap-4 xl:grid-cols-[1.8fr_1fr]">
              <div className="h-[560px] rounded-xl border border-slate-200 p-2">
                <ResponsiveContainer>
                  <BarChart data={listingForChart} layout="vertical" margin={{ left: 50, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="listingId" type="category" width={120} />
                    <Tooltip />
                    <Bar dataKey="quantity" fill="#0E7490" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="max-h-[560px] overflow-y-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Listing</th>
                      <th className="px-3 py-2 text-right">Units</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analytics?.listingSummary ?? []).map((row) => (
                      <tr key={row.listingId} className="border-t border-slate-100">
                        <td className="px-3 py-2">{row.listingId}</td>
                        <td className="px-3 py-2 text-right font-medium">{row.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {hasData && activeTab === "daily" ? (
            <div className="mt-4">
              <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h2 className="text-lg font-semibold">Daily Sales for Selected Listing</h2>
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

              <div className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
                <div className="h-[560px] rounded-xl border border-slate-200 p-2">
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

                <div className="max-h-[560px] overflow-y-auto rounded-xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left">Day</th>
                        <th className="px-3 py-2 text-right">Units</th>
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
            </div>
          ) : null}

          {hasData && activeTab === "state" ? (
            <div className="mt-4 grid gap-4 xl:grid-cols-[1.8fr_1fr]">
              <div className="h-[560px] rounded-xl border border-slate-200 p-2">
                <ResponsiveContainer>
                  <BarChart data={stateForChart} layout="vertical" margin={{ left: 40, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="shipState" type="category" width={80} />
                    <Tooltip />
                    <Bar dataKey="quantity" fill="#1D4ED8" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="max-h-[560px] overflow-y-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left">State</th>
                      <th className="px-3 py-2 text-right">Units</th>
                      <th className="px-3 py-2 text-right">Orders</th>
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
          ) : null}
        </section>
      </main>
    </div>
  );
}
