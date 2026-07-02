import { defineRouteConfig } from "@medusajs/admin-sdk"
import { CloudArrowUp } from "@medusajs/icons"
import {
  Container,
  Heading,
  Text,
  Button,
  Badge,
  Table,
  toast,
} from "@medusajs/ui"
import { useRef, useState } from "react"

type Plan = {
  line: number
  sku: string
  title: string
  action: "create" | "update" | "error"
  messages: string[]
}

type Result = Plan & { ok: boolean; result?: string }

const actionBadge = (a: Plan["action"]) =>
  a === "create" ? "green" : a === "update" ? "blue" : "red"

const ProductImportPage = () => {
  const fileRef = useRef<HTMLInputElement>(null)
  const [csv, setCsv] = useState("")
  const [fileName, setFileName] = useState("")
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [summary, setSummary] = useState<any>(null)
  const [results, setResults] = useState<Result[] | null>(null)
  const [busy, setBusy] = useState<"" | "preview" | "apply">("")

  const reset = () => {
    setPlans(null)
    setSummary(null)
    setResults(null)
  }

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFileName(f.name)
    reset()
    const reader = new FileReader()
    reader.onload = () => setCsv(String(reader.result || ""))
    reader.readAsText(f)
  }

  const preview = async () => {
    if (!csv.trim()) {
      toast.error("Choose a CSV file first.")
      return
    }
    setBusy("preview")
    setResults(null)
    try {
      const res = await fetch("/admin/products/import", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || "Preview failed")
      setPlans(data.plans)
      setSummary(data.summary)
    } catch (e: any) {
      toast.error(e?.message || "Preview failed")
    } finally {
      setBusy("")
    }
  }

  const apply = async () => {
    setBusy("apply")
    try {
      const res = await fetch("/admin/products/import/apply", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || "Import failed")
      setResults(data.results)
      setSummary(data.summary)
      setPlans(null)
      const s = data.summary
      toast.success(
        `Imported: ${s.created} created, ${s.updated} updated` +
          (s.failed ? `, ${s.failed} failed` : "")
      )
    } catch (e: any) {
      toast.error(e?.message || "Import failed")
    } finally {
      setBusy("")
    }
  }

  const importable =
    plans && (summary?.create > 0 || summary?.update > 0)

  return (
    <Container>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <Heading level="h1">Import Products</Heading>
          <Text size="small" style={{ color: "var(--fg-subtle)", marginTop: 4 }}>
            Upload a supplier CSV to create new products or re-sync price &amp;
            stock for existing ones (matched by SKU).
          </Text>
        </div>

        {/* Step 1 — choose file */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={onFile}
            style={{ display: "none" }}
          />
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            Choose CSV…
          </Button>
          {fileName && <Text size="small">{fileName}</Text>}
          <Button
            variant="primary"
            onClick={preview}
            disabled={!csv || busy !== ""}
            isLoading={busy === "preview"}
          >
            Preview
          </Button>
          <a href="/admin/products/import" style={{ marginLeft: "auto" }}>
            <Button variant="transparent">Download template</Button>
          </a>
        </div>

        {/* Summary */}
        {summary && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {results ? (
              <>
                <Badge color="green">{summary.created} created</Badge>
                <Badge color="blue">{summary.updated} updated</Badge>
                {summary.failed > 0 && (
                  <Badge color="red">{summary.failed} failed</Badge>
                )}
              </>
            ) : (
              <>
                <Badge color="green">{summary.create} to create</Badge>
                <Badge color="blue">{summary.update} to update</Badge>
                {summary.error > 0 && (
                  <Badge color="red">{summary.error} error</Badge>
                )}
              </>
            )}
          </div>
        )}

        {/* Preview / result table */}
        {(plans || results) && (
          <div style={{ overflowX: "auto" }}>
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>#</Table.HeaderCell>
                  <Table.HeaderCell>SKU</Table.HeaderCell>
                  <Table.HeaderCell>Title</Table.HeaderCell>
                  <Table.HeaderCell>{results ? "Result" : "Action"}</Table.HeaderCell>
                  <Table.HeaderCell>Notes</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {(results || plans || []).map((r: any) => (
                  <Table.Row key={`${r.line}-${r.sku}`}>
                    <Table.Cell>{r.line}</Table.Cell>
                    <Table.Cell>{r.sku || "—"}</Table.Cell>
                    <Table.Cell>{r.title || "—"}</Table.Cell>
                    <Table.Cell>
                      {results ? (
                        <Badge color={r.ok ? "green" : "red"}>
                          {r.ok ? r.result || "ok" : "failed"}
                        </Badge>
                      ) : (
                        <Badge color={actionBadge(r.action)}>{r.action}</Badge>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="xsmall" style={{ color: "var(--fg-subtle)" }}>
                        {(r.messages || []).join(" ")}
                      </Text>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        )}

        {/* Step 2 — confirm */}
        {importable && !results && (
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Button
              variant="primary"
              onClick={apply}
              isLoading={busy === "apply"}
              disabled={busy !== ""}
            >
              Import {summary.create + summary.update} product(s)
            </Button>
            {summary.error > 0 && (
              <Text size="small" style={{ color: "var(--fg-subtle)" }}>
                {summary.error} error row(s) will be skipped.
              </Text>
            )}
          </div>
        )}
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Import Products",
  icon: CloudArrowUp,
})

export default ProductImportPage
