import { defineRouteConfig } from "@medusajs/admin-sdk"
import { GridList } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Select,
  Table,
  Text,
} from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"

/**
 * Catalogue — a product list with the bits Medusa's built-in list doesn't give
 * us: numbered pagination, and filters for Collection and Category (the
 * built-in list only filters by status / type / tag / sales channel / dates).
 *
 * Deliberately a separate page rather than an attempt to patch the built-in
 * list: that list ships as a compiled bundle, so injecting filters into it
 * would mean brittle DOM surgery. Rows link straight into the native product
 * detail page, so this is purely a better way in — nothing is duplicated.
 */

const PAGE_SIZE = 20

type Product = {
  id: string
  title: string
  status: string
  thumbnail: string | null
  collection?: { id: string; title: string } | null
  categories?: { id: string; name: string }[]
  variants?: { id: string }[]
}

type Option = { value: string; label: string }

const statusColor = (s: string) =>
  s === "published" ? "green" : s === "draft" ? "grey" : "orange"

/** Compact page list: 1 … 4 5 [6] 7 8 … 15 */
function pageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const out: (number | "…")[] = [1]
  const from = Math.max(2, current - 1)
  const to = Math.min(total - 1, current + 1)
  if (from > 2) out.push("…")
  for (let p = from; p <= to; p++) out.push(p)
  if (to < total - 1) out.push("…")
  out.push(total)
  return out
}

const CataloguePage = () => {
  const [products, setProducts] = useState<Product[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")
  const [status, setStatus] = useState("all")
  const [collectionId, setCollectionId] = useState("all")
  const [categoryId, setCategoryId] = useState("all")

  const [collections, setCollections] = useState<Option[]>([])
  const [categories, setCategories] = useState<Option[]>([])

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  // Debounce the search box so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  // Any filter change resets to page 1 — otherwise you can land on a page that
  // no longer exists and see an empty table.
  useEffect(() => {
    setPage(1)
  }, [debounced, status, collectionId, categoryId])

  useEffect(() => {
    Promise.all([
      fetch("/admin/collections?limit=100&fields=id,title", {
        credentials: "include",
      }).then((r) => r.json()),
      fetch("/admin/product-categories?limit=200&fields=id,name", {
        credentials: "include",
      }).then((r) => r.json()),
    ])
      .then(([col, cat]) => {
        setCollections(
          (col?.collections || []).map((c: any) => ({
            value: c.id,
            label: c.title,
          }))
        )
        setCategories(
          (cat?.product_categories || []).map((c: any) => ({
            value: c.id,
            label: c.name,
          }))
        )
      })
      .catch(() => {
        /* filters just stay empty */
      })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String((page - 1) * PAGE_SIZE),
      order: "-created_at",
      fields:
        "id,title,status,thumbnail,collection.id,collection.title,categories.id,categories.name,variants.id",
    })
    if (debounced) params.set("q", debounced)
    // `status` is validated as an array — a scalar `status=draft` 400s.
    if (status !== "all") params.append("status[]", status)
    if (collectionId !== "all") params.set("collection_id", collectionId)
    if (categoryId !== "all") params.set("category_id", categoryId)

    try {
      const res = await fetch(`/admin/products?${params.toString()}`, {
        credentials: "include",
      })
      const body = await res.json()
      setProducts(body?.products || [])
      setCount(body?.count ?? 0)
    } catch {
      setProducts([])
      setCount(0)
    } finally {
      setLoading(false)
    }
  }, [page, debounced, status, collectionId, categoryId])

  useEffect(() => {
    load()
  }, [load])

  const showing = useMemo(() => {
    if (!count) return "0 products"
    const from = (page - 1) * PAGE_SIZE + 1
    const to = Math.min(page * PAGE_SIZE, count)
    return `${from}–${to} of ${count} products`
  }, [page, count])

  const clearAll = () => {
    setSearch("")
    setStatus("all")
    setCollectionId("all")
    setCategoryId("all")
  }

  const filtersActive =
    !!search || status !== "all" || collectionId !== "all" || categoryId !== "all"

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h1">Catalogue</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Browse products by status, collection or category. Newest first.
          </Text>
        </div>
        <Text size="small" className="text-ui-fg-subtle">
          {showing}
        </Text>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 px-6 py-3">
        <Input
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56"
        />
        <Select value={status} onValueChange={setStatus}>
          <Select.Trigger className="w-40">
            <Select.Value placeholder="Status" />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="all">All statuses</Select.Item>
            <Select.Item value="published">Published</Select.Item>
            <Select.Item value="draft">Draft</Select.Item>
            <Select.Item value="proposed">Proposed</Select.Item>
          </Select.Content>
        </Select>

        <Select value={collectionId} onValueChange={setCollectionId}>
          <Select.Trigger className="w-48">
            <Select.Value placeholder="Collection" />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="all">All collections</Select.Item>
            {collections.map((c) => (
              <Select.Item key={c.value} value={c.value}>
                {c.label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>

        <Select value={categoryId} onValueChange={setCategoryId}>
          <Select.Trigger className="w-48">
            <Select.Value placeholder="Category" />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="all">All categories</Select.Item>
            {categories.map((c) => (
              <Select.Item key={c.value} value={c.value}>
                {c.label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>

        {filtersActive && (
          <Button size="small" variant="transparent" onClick={clearAll}>
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="px-6 py-2">
        {loading ? (
          <Text size="small" className="text-ui-fg-subtle py-6">
            Loading…
          </Text>
        ) : products.length === 0 ? (
          <Text size="small" className="text-ui-fg-subtle py-6">
            No products match these filters.
          </Text>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Product</Table.HeaderCell>
                <Table.HeaderCell>Collection</Table.HeaderCell>
                <Table.HeaderCell>Category</Table.HeaderCell>
                <Table.HeaderCell>Variants</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {products.map((p) => (
                <Table.Row
                  key={p.id}
                  className="cursor-pointer"
                  onClick={() => {
                    window.location.href = `/app/products/${p.id}`
                  }}
                >
                  <Table.Cell>
                    <div className="flex items-center gap-3">
                      {p.thumbnail ? (
                        <img
                          src={p.thumbnail}
                          alt=""
                          className="h-8 w-8 rounded object-cover"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded bg-ui-bg-component" />
                      )}
                      <Text size="small" weight="plus">
                        {p.title}
                      </Text>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="small" className="text-ui-fg-subtle">
                      {p.collection?.title || "—"}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="small" className="text-ui-fg-subtle">
                      {p.categories?.length
                        ? p.categories.map((c) => c.name).join(", ")
                        : "—"}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="small" className="text-ui-fg-subtle">
                      {p.variants?.length ?? 0}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge size="2xsmall" color={statusColor(p.status) as any}>
                      {p.status}
                    </Badge>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </div>

      {/* Numbered pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4">
          <Text size="small" className="text-ui-fg-subtle">
            Page {page} of {totalPages}
          </Text>
          <div className="flex items-center gap-1">
            <Button
              size="small"
              variant="secondary"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </Button>
            {pageWindow(page, totalPages).map((p, i) =>
              p === "…" ? (
                <Text
                  key={`gap-${i}`}
                  size="small"
                  className="text-ui-fg-muted px-1"
                >
                  …
                </Text>
              ) : (
                <Button
                  key={p}
                  size="small"
                  variant={p === page ? "primary" : "transparent"}
                  onClick={() => setPage(p)}
                >
                  {p}
                </Button>
              )
            )}
            <Button
              size="small"
              variant="secondary"
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Catalogue",
  icon: GridList,
})

export default CataloguePage
