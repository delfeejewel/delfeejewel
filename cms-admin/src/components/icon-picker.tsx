import { useState, useMemo } from "react"
import { Modal, Input, Typography, Tabs } from "antd"
import { icons, type LucideIcon } from "lucide-react"

const { Text } = Typography
const { Search } = Input

// Build categorized icon list from all lucide icons
const ALL_ICONS = Object.entries(icons).map(([name, Icon]) => ({
  name: name
    .replace(/([A-Z])/g, " $1")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-"),
  label: name.replace(/([A-Z])/g, " $1").trim(),
  Icon: Icon as LucideIcon,
  // Simple category detection from name
  category: detectCategory(name),
}))

function detectCategory(name: string): string {
  const n = name.toLowerCase()
  if (/arrow|chevron|move|corner|align|maximize|minimize|expand|shrink/.test(n)) return "Arrows & Direction"
  if (/cart|shop|store|bag|credit|wallet|receipt|tag|barcode|package|truck|shipping/.test(n)) return "Commerce"
  if (/heart|star|thumb|smile|frown|meh|award|trophy|crown|gem|diamond|sparkle/.test(n)) return "Reactions & Rewards"
  if (/user|users|person|contact|badge|id/.test(n)) return "People"
  if (/phone|mail|message|inbox|send|at|globe|link|share|rss/.test(n)) return "Communication"
  if (/calendar|clock|timer|watch|alarm|hourglass/.test(n)) return "Time"
  if (/lock|unlock|shield|key|eye|scan|fingerprint/.test(n)) return "Security"
  if (/file|folder|document|book|clipboard|note|pen|edit|copy|save/.test(n)) return "Files & Editing"
  if (/image|camera|video|film|play|pause|music|mic|volume|speaker/.test(n)) return "Media"
  if (/sun|moon|cloud|rain|snow|wind|umbrella|thermometer|zap|flame|droplet/.test(n)) return "Weather & Nature"
  if (/home|building|map|pin|navigation|compass|flag|globe/.test(n)) return "Places"
  if (/setting|gear|wrench|tool|hammer|filter|sliders|toggle/.test(n)) return "Settings"
  if (/chart|bar|pie|trending|activity|percent|hash|binary/.test(n)) return "Data & Charts"
  if (/check|x|plus|minus|circle|square|triangle|hexagon|octagon/.test(n)) return "Shapes & Status"
  if (/gift|cake|party|balloon|confetti|ribbon/.test(n)) return "Celebration"
  if (/refresh|rotate|repeat|undo|redo|loader|download|upload/.test(n)) return "Actions"
  return "General"
}

const CATEGORIES = [...new Set(ALL_ICONS.map((i) => i.category))].sort()

export function IconPicker({
  value,
  onChange,
}: {
  value?: string
  onChange?: (val: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState("All")

  const selectedIcon = ALL_ICONS.find((i) => i.name === value)

  const filtered = useMemo(() => {
    let list = ALL_ICONS
    if (activeCategory !== "All") {
      list = list.filter((i) => i.category === activeCategory)
    }
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((i) => i.label.toLowerCase().includes(q) || i.name.includes(q))
    }
    return list
  }, [search, activeCategory])

  const handleSelect = (name: string) => {
    onChange?.(name)
    setOpen(false)
    setSearch("")
  }

  return (
    <>
      {/* Trigger button */}
      <div
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 16px",
          borderRadius: 8,
          border: "1px solid #333",
          cursor: "pointer",
          minWidth: 200,
          background: "#1a1a1a",
        }}
      >
        {selectedIcon ? (
          <>
            <selectedIcon.Icon size={20} strokeWidth={1.5} color="#4db6ac" />
            <Text style={{ color: "#ccc" }}>{selectedIcon.label}</Text>
          </>
        ) : (
          <Text style={{ color: "#666" }}>Click to select an icon...</Text>
        )}
      </div>

      {/* Modal */}
      <Modal
        title="Select an Icon"
        open={open}
        onCancel={() => { setOpen(false); setSearch("") }}
        footer={null}
        width={720}
        styles={{ body: { padding: "16px 0" } }}
      >
        {/* Search */}
        <div style={{ padding: "0 24px 12px" }}>
          <Search
            placeholder="Search icons..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            autoFocus
          />
        </div>

        {/* Category tabs */}
        <div style={{ padding: "0 24px 8px", overflowX: "auto" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <CategoryTag
              label="All"
              active={activeCategory === "All"}
              count={ALL_ICONS.length}
              onClick={() => setActiveCategory("All")}
            />
            {CATEGORIES.map((cat) => (
              <CategoryTag
                key={cat}
                label={cat}
                active={activeCategory === cat}
                count={ALL_ICONS.filter((i) => i.category === cat).length}
                onClick={() => setActiveCategory(cat)}
              />
            ))}
          </div>
        </div>

        {/* Icon grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
            gap: 4,
            maxHeight: 400,
            overflowY: "auto",
            padding: "8px 24px",
          }}
        >
          {filtered.length === 0 && (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 40 }}>
              <Text type="secondary">No icons found</Text>
            </div>
          )}
          {filtered.map(({ name, label, Icon }) => {
            const selected = value === name
            return (
              <div
                key={name}
                onClick={() => handleSelect(name)}
                title={label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  padding: "10px 4px",
                  borderRadius: 8,
                  cursor: "pointer",
                  border: selected ? "2px solid #4db6ac" : "1px solid transparent",
                  background: selected ? "rgba(77,182,172,0.1)" : "transparent",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  if (!selected) e.currentTarget.style.background = "rgba(255,255,255,0.04)"
                }}
                onMouseLeave={(e) => {
                  if (!selected) e.currentTarget.style.background = "transparent"
                }}
              >
                <Icon size={22} strokeWidth={1.5} color={selected ? "#4db6ac" : "#999"} />
                <Text
                  style={{
                    fontSize: 8,
                    color: selected ? "#4db6ac" : "#666",
                    textAlign: "center",
                    lineHeight: 1.2,
                    maxWidth: "100%",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </Text>
              </div>
            )
          })}
        </div>

        {/* Footer count */}
        <div style={{ padding: "8px 24px 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {filtered.length} icons {search ? `matching "${search}"` : activeCategory !== "All" ? `in ${activeCategory}` : "total"}
          </Text>
        </div>
      </Modal>
    </>
  )
}

function CategoryTag({
  label,
  active,
  count,
  onClick,
}: {
  label: string
  active: boolean
  count: number
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "4px 10px",
        borderRadius: 16,
        fontSize: 11,
        cursor: "pointer",
        background: active ? "rgba(77,182,172,0.15)" : "rgba(255,255,255,0.04)",
        border: active ? "1px solid #4db6ac" : "1px solid rgba(255,255,255,0.08)",
        color: active ? "#4db6ac" : "#888",
        transition: "all 0.15s ease",
        whiteSpace: "nowrap",
      }}
    >
      {label} <span style={{ opacity: 0.6 }}>({count})</span>
    </div>
  )
}
