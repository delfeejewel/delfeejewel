"use client"

import {
  CheckCircle2,
  Truck,
  Bike,
  PackageCheck,
  XCircle,
  Undo2,
} from "lucide-react"

import { cn } from "@lib/utils/cn"
import { convertToLocale } from "@lib/util/money"

export type OrderHistoryEntry = {
  status: string
  at: string
  courier?: string | null
}

type StepKey = "placed" | "shipped" | "out_for_delivery" | "delivered"

const STEPS: Array<{ key: StepKey; label: string; desc: string; Icon: any }> = [
  {
    key: "placed",
    label: "Order Placed",
    desc: "We've received your order",
    Icon: CheckCircle2,
  },
  { key: "shipped", label: "Shipped", desc: "On the way to you", Icon: Truck },
  {
    key: "out_for_delivery",
    label: "Out for Delivery",
    desc: "Almost there",
    Icon: Bike,
  },
  {
    key: "delivered",
    label: "Delivered",
    desc: "Order completed",
    Icon: PackageCheck,
  },
]

function classify(raw: string): StepKey | "rto" | null {
  const s = (raw || "").toLowerCase().trim()
  if (!s) return null
  if (s.includes("rto")) return "rto"
  if (s.includes("delivered")) return "delivered"
  if (s.includes("out for delivery")) return "out_for_delivery"
  if (
    s.includes("transit") ||
    s.includes("shipped") ||
    s.includes("picked") ||
    s.includes("dispatch")
  ) {
    return "shipped"
  }
  return "placed"
}

function fmtDateTime(d?: string | null) {
  if (!d) return null
  try {
    const date = new Date(d)
    return (
      date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) +
      " • " +
      date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    )
  } catch {
    return null
  }
}

type Props = {
  createdAt: string
  history?: OrderHistoryEntry[]
  isCanceled?: boolean
  rtoProcessedAt?: string | null
  rtoRefundAmount?: number | null
  currencyCode?: string
}

export default function OrderTimeline({
  createdAt,
  history = [],
  isCanceled,
  rtoProcessedAt,
  rtoRefundAmount,
  currencyCode,
}: Props) {
  const isRto = history.some((e) => classify(e.status) === "rto")

  if (isCanceled) {
    return (
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-lg"
        style={{
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.2)",
        }}
      >
        <XCircle className="w-5 h-5 text-red-500" />
        <span className="text-sm font-medium text-red-600">
          Order Cancelled
        </span>
      </div>
    )
  }

  if (isRto) {
    const rtoEvent = [...history]
      .reverse()
      .find((e) => classify(e.status) === "rto")
    const refundLabel =
      rtoProcessedAt && rtoRefundAmount && rtoRefundAmount > 0 && currencyCode
        ? `Refund of ${convertToLocale({
            amount: rtoRefundAmount,
            currency_code: currencyCode,
          })} processed • ${fmtDateTime(rtoProcessedAt)}`
        : rtoProcessedAt
          ? `Return processed • ${fmtDateTime(rtoProcessedAt)}`
          : null
    return (
      <div className="flex flex-col gap-2">
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-lg"
          style={{
            background: "rgba(234,179,8,0.08)",
            border: "1px solid rgba(234,179,8,0.25)",
          }}
        >
          <Undo2 className="w-5 h-5 text-amber-600" />
          <span className="text-sm font-medium text-amber-700">
            Returned to origin{" "}
            {rtoEvent?.at && `• ${fmtDateTime(rtoEvent.at)}`}
          </span>
        </div>
        {refundLabel && (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-lg"
            style={{
              background: "rgba(34,197,94,0.08)",
              border: "1px solid rgba(34,197,94,0.25)",
            }}
          >
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-700">
              {refundLabel}
            </span>
          </div>
        )}
      </div>
    )
  }

  const stepDates: Record<StepKey, string | null> = {
    placed: createdAt,
    shipped: null,
    out_for_delivery: null,
    delivered: null,
  }
  for (const ev of history) {
    const k = classify(ev.status)
    if (k && k !== "rto" && k in stepDates) {
      stepDates[k] = ev.at
    }
  }

  const reachedFlags = STEPS.map((s) => !!stepDates[s.key])
  const lastReachedIdx = reachedFlags.lastIndexOf(true)
  const steps = STEPS.map((s, i) => ({
    ...s,
    completed: i <= lastReachedIdx,
    active: i === lastReachedIdx,
    timestamp: stepDates[s.key],
  }))

  return (
    <div className="w-full">
      {/* Desktop horizontal */}
      <div className="hidden small:flex items-start justify-between relative">
        <div
          className="absolute top-5 left-0 right-0 h-[2px] mx-10"
          style={{ background: "var(--color-border)" }}
        >
          <div
            className="h-full transition-all duration-500"
            style={{
              background: "var(--color-accent)",
              width: `${
                (Math.max(0, lastReachedIdx) / (steps.length - 1)) * 100
              }%`,
            }}
          />
        </div>

        {steps.map((step) => {
          const Icon = step.Icon
          const on = step.completed || step.active
          return (
            <div
              key={step.key}
              className="flex flex-col items-center text-center relative z-10 flex-1"
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300",
                  on ? "text-white" : "text-gray-400"
                )}
                style={{
                  background: on
                    ? "var(--color-accent)"
                    : "var(--color-bg-secondary)",
                  border: on ? "none" : "2px solid var(--color-border)",
                }}
              >
                <Icon className="w-5 h-5" strokeWidth={1.6} />
              </div>
              <span
                className="text-xs font-medium mt-3"
                style={{
                  color: on
                    ? "var(--color-text-primary)"
                    : "var(--color-text-muted)",
                }}
              >
                {step.label}
              </span>
              <span
                className="text-[11px] mt-1"
                style={{ color: "var(--color-text-muted)" }}
              >
                {step.timestamp ? fmtDateTime(step.timestamp) : step.desc}
              </span>
            </div>
          )
        })}
      </div>

      {/* Mobile vertical */}
      <div className="small:hidden flex flex-col gap-0">
        {steps.map((step, i) => {
          const Icon = step.Icon
          const on = step.completed || step.active
          return (
            <div key={step.key} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                    on ? "text-white" : "text-gray-400"
                  )}
                  style={{
                    background: on
                      ? "var(--color-accent)"
                      : "var(--color-bg-secondary)",
                    border: on ? "none" : "2px solid var(--color-border)",
                  }}
                >
                  <Icon className="w-4 h-4" strokeWidth={1.6} />
                </div>
                {i < steps.length - 1 && (
                  <div
                    className="w-[2px] h-8 my-1"
                    style={{
                      background: step.completed
                        ? "var(--color-accent)"
                        : "var(--color-border)",
                    }}
                  />
                )}
              </div>

              <div className="pb-6">
                <span
                  className="text-sm font-medium block"
                  style={{
                    color: on
                      ? "var(--color-text-primary)"
                      : "var(--color-text-muted)",
                  }}
                >
                  {step.label}
                </span>
                <span
                  className="block text-xs mt-0.5"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {step.timestamp ? fmtDateTime(step.timestamp) : step.desc}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
