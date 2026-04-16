"use client";

import React, { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import type { Transaction } from "../hooks/useFinancialData";

interface TransactionTableProps {
  transactions: Transaction[];
  onAddTransaction?: () => void;
}

const PAGE_SIZE = 15;

const TYPE_LABELS: Record<string, string> = {
  INCOME: "Income",
  EXPENSE: "Expense",
  EQUITY: "Equity",
  "OWNER DRAWING": "Drawing",
};

const TYPE_STYLES: Record<string, string> = {
  INCOME: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  EXPENSE: "bg-red-500/10 text-red-400 border-red-500/20",
  EQUITY: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "OWNER DRAWING": "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

const AMOUNT_STYLES: Record<string, string> = {
  INCOME: "text-emerald-400",
  EXPENSE: "text-red-400",
  EQUITY: "text-blue-400",
  "OWNER DRAWING": "text-purple-400",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function TransactionTable({ transactions, onAddTransaction }: TransactionTableProps) {
  console.log(
    "[TransactionTable] received", transactions.length, "rows",
    transactions.length > 0
      ? `| first: { date: "${transactions[0].transaction_date}", amount: ${transactions[0].amount} (${typeof transactions[0].amount}), type: "${transactions[0].type}" }`
      : "| (empty array)"
  );

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "INCOME" | "EXPENSE" | "EQUITY" | "OWNER DRAWING">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);

  // Bug 1: Reset to page 1 whenever the transaction set changes (date range switch).
  // Without this, switching from a range with 40 results to one with 8 while on
  // page 3 leaves the paginated slice empty — blank table with no error shown.
  useEffect(() => { setPage(1); }, [transactions]);

  const categories = useMemo(() => {
    const cats = new Set(transactions.map((t) => t.category));
    return Array.from(cats).sort();
  }, [transactions]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return transactions.filter((t) => {
      const matchSearch =
        !q ||
        t.description.toLowerCase().includes(q) ||
        (t.payee?.toLowerCase().includes(q) ?? false) ||
        t.category.toLowerCase().includes(q);
      const matchType = typeFilter === "all" || t.type === typeFilter;
      const matchCat = categoryFilter === "all" || t.category === categoryFilter;
      return matchSearch && matchType && matchCat;
    });
  }, [transactions, search, typeFilter, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function resetPage<T>(setter: React.Dispatch<React.SetStateAction<T>>) {
    return (v: T) => { setter(v); setPage(1); };
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Transactions</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} transaction{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
        {onAddTransaction && (
          <Button size="sm" onClick={onAddTransaction} className="h-8 gap-1.5 shrink-0">
            <Plus className="w-3.5 h-3.5" />
            <span>Add Transaction</span>
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by description, client, or category…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 h-9 bg-secondary border-border text-sm"
          />
        </div>
        <Select
          value={typeFilter}
          onValueChange={resetPage<"all" | "INCOME" | "EXPENSE" | "EQUITY" | "OWNER DRAWING">(
            (v) => setTypeFilter(v as "all" | "INCOME" | "EXPENSE" | "EQUITY" | "OWNER DRAWING")
          )}
        >
          <SelectTrigger className="h-9 w-full sm:w-[140px] bg-secondary border-border text-sm">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="INCOME">Income</SelectItem>
            <SelectItem value="EXPENSE">Expense</SelectItem>
            <SelectItem value="EQUITY">Equity</SelectItem>
            <SelectItem value="OWNER DRAWING">Drawing</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={resetPage(setCategoryFilter)}>
          <SelectTrigger className="h-9 w-full sm:w-[160px] bg-secondary border-border text-sm">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs font-medium text-muted-foreground pb-3 pr-4 whitespace-nowrap">
                Date
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground pb-3 pr-4">
                Description
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground pb-3 pr-4 hidden sm:table-cell">
                Category
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground pb-3 pr-4 hidden md:table-cell">
                Client
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground pb-3 pr-4">
                Type
              </th>
              <th className="text-right text-xs font-medium text-muted-foreground pb-3">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-12 text-center text-muted-foreground text-sm"
                >
                  No transactions found
                </td>
              </tr>
            ) : (
              paginated.map((tx) => (
                <tr
                  key={tx.id}
                  className="border-b border-border/50 hover:bg-secondary/40 transition-colors duration-150"
                >
                  <td className="py-3 pr-4 text-muted-foreground whitespace-nowrap text-xs">
                    {formatDate(tx.transaction_date)}
                  </td>
                  <td className="py-3 pr-4 text-foreground font-medium max-w-[180px] truncate">
                    {tx.description}
                  </td>
                  <td className="py-3 pr-4 hidden sm:table-cell text-muted-foreground text-xs">
                    {tx.category}
                  </td>
                  <td className="py-3 pr-4 hidden md:table-cell text-muted-foreground text-xs">
                    {tx.payee || "—"}
                  </td>
                  <td className="py-3 pr-4">
                    <Badge
                      variant="secondary"
                      className={cn(
                        "flex items-center gap-1 w-fit text-xs px-2 py-0.5 border",
                        TYPE_STYLES[tx.type] ?? "bg-secondary text-muted-foreground border-border"
                      )}
                    >
                      {tx.type === "INCOME" || tx.type === "EQUITY" ? (
                        <ArrowUpRight className="w-3 h-3" />
                      ) : (
                        <ArrowDownLeft className="w-3 h-3" />
                      )}
                      {TYPE_LABELS[tx.type] ?? tx.type}
                    </Badge>
                  </td>
                  <td
                    className={cn(
                      "py-3 text-right font-semibold whitespace-nowrap",
                      AMOUNT_STYLES[tx.type] ?? "text-foreground"
                    )}
                  >
                    {tx.type === "INCOME" || tx.type === "EQUITY" ? "+" : "−"}
                    {formatCurrency(tx.amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages} · {filtered.length} results
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
