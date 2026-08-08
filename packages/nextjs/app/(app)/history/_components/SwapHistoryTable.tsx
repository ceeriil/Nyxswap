"use client";

import { useMemo, useRef, useState } from "react";
import type { SwapRecord } from "../_lib/mockSwapHistory";
import { amountColumn, pairColumn, priceColumn, timeColumn, traderColumn, txColumn } from "./swapHistoryColumns";
import {
  type FilterFn,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDownIcon, ChevronUpDownIcon, ChevronUpIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";

const ROW_HEIGHT = 52;
const MAX_VIEWPORT_HEIGHT = 520;
const PAGE_SIZE_OPTIONS = [25, 50, 100, "All"] as const;
type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];
// Large enough to cover the "handle 10,000 rows easily" target without the
// awkwardness of Infinity/records.length as a pagination page size.
const ALL_PAGE_SIZE = 100_000;

const globalFilterFn: FilterFn<SwapRecord> = (row, _columnId, filterValue) => {
  const q = String(filterValue).toLowerCase().trim();
  if (!q) return true;
  const r = row.original;
  return (
    r.tokenIn.toLowerCase().includes(q) ||
    r.tokenOut.toLowerCase().includes(q) ||
    r.trader.toLowerCase().includes(q) ||
    r.txHash.toLowerCase().includes(q)
  );
};

type Props = {
  records: SwapRecord[];
  showTrader?: boolean;
  highlightId?: string | null;
};

// TanStack Table owns columns/sorting/search/pagination; TanStack Virtual
// windows whatever the current page resolves to, so even "All" on a
// multi-thousand-row feed stays a handful of DOM nodes — see history spec's
// "handle 10,000 rows easily".
export const SwapHistoryTable = ({ records, showTrader, highlightId }: Props) => {
  const [sorting, setSorting] = useState<SortingState>([{ id: "time", desc: true }]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [pageSizeOption, setPageSizeOption] = useState<PageSizeOption>(25);
  const [pageIndex, setPageIndex] = useState(0);

  const pageSize = pageSizeOption === "All" ? ALL_PAGE_SIZE : pageSizeOption;

  const columns = useMemo(
    () =>
      showTrader
        ? [timeColumn, pairColumn, amountColumn, priceColumn, traderColumn, txColumn]
        : [timeColumn, pairColumn, amountColumn, priceColumn, txColumn],
    [showTrader],
  );

  const table = useReactTable({
    data: records,
    columns,
    state: { sorting, globalFilter, pagination: { pageIndex, pageSize } },
    onSortingChange: setSorting,
    onGlobalFilterChange: value => {
      setGlobalFilter(value);
      setPageIndex(0);
    },
    onPaginationChange: updater => {
      const next = typeof updater === "function" ? updater({ pageIndex, pageSize }) : updater;
      setPageIndex(next.pageIndex);
    },
    globalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const { rows } = table.getRowModel();
  const filteredCount = table.getFilteredRowModel().rows.length;

  const scrollRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  const containerHeight = Math.min(MAX_VIEWPORT_HEIGHT, Math.max(rows.length, 1) * ROW_HEIGHT);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-56 flex-1 items-center gap-2 rounded-xl border border-base-300 bg-base-200/60 px-3 py-2">
          <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-base-content/50" />
          <input
            type="text"
            placeholder="Search pair, address, or tx hash"
            className="w-full bg-transparent text-sm outline-none placeholder:text-base-content/40"
            value={globalFilter}
            onChange={e => {
              setGlobalFilter(e.target.value);
              setPageIndex(0);
            }}
          />
        </label>

        <select
          className="select select-sm select-bordered w-auto"
          value={pageSizeOption}
          onChange={e => {
            const value = e.target.value;
            setPageSizeOption(value === "All" ? "All" : (Number(value) as PageSizeOption));
            setPageIndex(0);
          }}
        >
          {PAGE_SIZE_OPTIONS.map(opt => (
            <option key={opt} value={opt}>
              {opt === "All" ? "All rows" : `${opt} / page`}
            </option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-base-300 bg-base-200/40 py-12 text-center text-sm text-base-content/60">
          {globalFilter ? `No swaps match "${globalFilter}".` : "No swaps yet."}
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="overflow-auto rounded-2xl border border-base-300"
          style={{ height: containerHeight }}
        >
          <table style={{ display: "grid", width: table.getTotalSize(), minWidth: "100%" }}>
            <thead className="sticky top-0 z-10 bg-base-200/95 backdrop-blur" style={{ display: "grid" }}>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id} style={{ display: "flex", width: "100%" }}>
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      style={{ display: "flex", width: header.getSize() }}
                      className="items-center px-3 py-2 text-left text-xs font-medium text-base-content/60"
                    >
                      <button
                        type="button"
                        disabled={!header.column.getCanSort()}
                        onClick={header.column.getToggleSortingHandler()}
                        className={`flex items-center gap-1 ${
                          header.column.getCanSort() ? "cursor-pointer select-none hover:text-base-content" : ""
                        }`}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() &&
                          (header.column.getIsSorted() === "asc" ? (
                            <ChevronUpIcon className="h-3 w-3" />
                          ) : header.column.getIsSorted() === "desc" ? (
                            <ChevronDownIcon className="h-3 w-3" />
                          ) : (
                            <ChevronUpDownIcon className="h-3 w-3 opacity-40" />
                          ))}
                      </button>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody
              style={{
                display: "grid",
                height: rowVirtualizer.getTotalSize(),
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map(virtualRow => {
                const row = rows[virtualRow.index];
                return (
                  <tr
                    key={row.id}
                    className={`text-sm transition-colors duration-1000 ${
                      row.original.id === highlightId ? "bg-primary/10" : ""
                    }`}
                    style={{
                      display: "flex",
                      position: "absolute",
                      transform: `translateY(${virtualRow.start}px)`,
                      width: "100%",
                      height: ROW_HEIGHT,
                    }}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td
                        key={cell.id}
                        style={{ display: "flex", width: cell.column.getSize() }}
                        className="items-center px-3"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between px-1 text-xs text-base-content/60">
        <span>
          {filteredCount} swap{filteredCount === 1 ? "" : "s"}
          {globalFilter && ` matching "${globalFilter}"`}
        </span>
        {pageSizeOption !== "All" && table.getPageCount() > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-xs"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              Prev
            </button>
            <span>
              Page {pageIndex + 1} of {table.getPageCount()}
            </span>
            <button
              type="button"
              className="btn btn-xs"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
