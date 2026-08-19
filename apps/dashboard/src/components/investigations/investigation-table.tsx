"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel, useReactTable } from "@tanstack/react-table";
import { IconArrowRight, IconRefresh, IconSearch } from "@tabler/icons-react";
import { engine } from "@/lib/api";
import type { Investigation } from "@/lib/types";
import { formatDate, titleCase } from "@/lib/format";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RiskBadge, StatusBadge } from "@/components/dashboard/status";

const helper = createColumnHelper<Investigation>();

export function InvestigationTable() {
  const [filter, setFilter] = useState("");
  const query = useQuery({ queryKey: ["investigations", 50], queryFn: () => engine.investigations(50, 0), refetchInterval: 20_000 });
  const data = query.data?.items ?? [];

  const columns = useMemo(() => [
    helper.accessor("query", {
      header: "Target",
      cell: ({ row, getValue }) => <div className="min-w-[220px]"><Link href={`/investigations/${row.original.id}`} className="font-medium hover:underline">{getValue()}</Link><div className="mt-1 font-mono text-[10px] text-muted-foreground">{row.original.profile} · {row.original.origin}</div></div>
    }),
    helper.accessor("status", { header: "Status", cell: (info) => <StatusBadge status={info.getValue()} /> }),
    helper.accessor("risk_level", { header: "Risk", cell: (info) => <RiskBadge risk={info.getValue()} /> }),
    helper.accessor("source_count", { header: "Sources", cell: (info) => <span className="font-mono text-xs text-muted-foreground">{info.getValue() ?? 0}</span> }),
    helper.accessor("created_at", { header: "Created", cell: (info) => <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(info.getValue())}</span> }),
    helper.display({ id: "open", header: "", cell: ({ row }) => <Link href={`/investigations/${row.original.id}`} aria-label={`Open ${row.original.query}`} className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"><IconArrowRight size={15} /></Link> })
  ], []);

  const table = useReactTable({ data, columns, state: { globalFilter: filter }, onGlobalFilterChange: setFilter, getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel() });

  return (
    <div className="page-shell">
      <div className="page-header">
        <div><p className="page-eyebrow">Investigation history</p><h1 className="page-title">Investigations</h1><p className="page-description">Search, review and trace every manually initiated or monitoring-generated investigation.</p></div>
        <Link href="/investigations/new" className={buttonVariants()}>New investigation</Link>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm"><IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} /><Input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter target, status, risk…" className="pl-9" /></div>
          <div className="flex items-center gap-2"><span className="font-mono text-[10px] text-muted-foreground">{table.getFilteredRowModel().rows.length} records</span><Button variant="outline" size="sm" onClick={() => query.refetch()} disabled={query.isFetching}><IconRefresh className={query.isFetching ? "animate-spin" : ""} /> Refresh</Button></div>
        </div>
        <Table>
          <TableHeader>{table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => <TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>)}</TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => <TableRow key={row.id}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>)}
          </TableBody>
        </Table>
        {!table.getRowModel().rows.length && <div className="data-empty">{query.isLoading ? "Loading investigations…" : filter ? "No investigations match this filter." : "No investigations have been created yet."}</div>}
      </Card>
      <p className="mt-3 text-[11px] leading-5 text-muted-foreground">Status and risk values originate from the investigation workflow. {titleCase("completed")} investigations retain evidence references according to the configured retention policy.</p>
    </div>
  );
}
