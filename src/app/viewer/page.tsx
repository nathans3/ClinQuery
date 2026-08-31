"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DocumentViewer } from "@/components/DocumentViewer";

function ViewerInner() {
  const params = useSearchParams();
  const docId = params.get("docId") ?? "";
  const page = Number(params.get("page") || "1");
  const search = params.get("search") || "";

  return (
    <main className="viewer-shell">
      <header className="viewer-header">
        <Link href="/">← Back to chat</Link>
        <div>
          <h1>Document</h1>
          {search ? (
            <p>
              Jumping to page {page} and highlighting the cited passage
            </p>
          ) : null}
        </div>
      </header>
      <DocumentViewer docId={docId} page={page} search={search} />
    </main>
  );
}

export default function ViewerPage() {
  return (
    <Suspense fallback={<main className="viewer-shell">Loading document…</main>}>
      <ViewerInner />
    </Suspense>
  );
}
