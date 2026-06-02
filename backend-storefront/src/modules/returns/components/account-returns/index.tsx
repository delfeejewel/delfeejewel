import { Undo2, Clock, CheckCircle2, XCircle, Package, Repeat } from "lucide-react"

import { convertToLocale } from "@lib/util/money"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import type { ReturnRequest, ReturnStatus } from "@modules/returns/types"
import { RETURN_REASON_LABELS } from "@modules/returns/types"

const STATUS_META: Record<
  ReturnStatus,
  { label: string; cls: string; Icon: any }
> = {
  pending: {
    label: "Pending Review",
    cls: "bg-amber-100 text-amber-700",
    Icon: Clock,
  },
  approved: {
    label: "Approved",
    cls: "bg-blue-100 text-blue-700",
    Icon: CheckCircle2,
  },
  rejected: { label: "Rejected", cls: "bg-red-100 text-red-700", Icon: XCircle },
  received: {
    label: "Received",
    cls: "bg-blue-100 text-blue-700",
    Icon: Package,
  },
  completed: {
    label: "Completed",
    cls: "bg-green-100 text-green-700",
    Icon: CheckCircle2,
  },
  canceled: {
    label: "Canceled",
    cls: "bg-gray-100 text-gray-600",
    Icon: XCircle,
  },
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export default function AccountReturns({
  requests,
}: {
  requests: ReturnRequest[]
}) {
  return (
    <div className="w-full" data-testid="returns-page-wrapper">
      <header className="mb-8 tablet:mb-10">
        <h1 className="font-wittgenstein text-[28px] tablet:text-[36px] font-bold text-[var(--color-plum)] mb-1.5">
          Returns
        </h1>
        <p className="text-[14px] text-[var(--color-text-muted)]">
          Track the status of return requests for your past orders.
        </p>
      </header>

      {requests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[var(--color-lavender)] flex flex-col items-center gap-4 py-16 px-6 text-center">
          <div className="w-14 h-14 rounded-full bg-[var(--color-lavender)] flex items-center justify-center">
            <Undo2 className="w-6 h-6 text-[var(--color-plum)]" strokeWidth={1.6} />
          </div>
          <h2 className="font-wittgenstein text-[20px] font-semibold text-[var(--color-plum)]">
            No returns yet
          </h2>
          <p className="text-[14px] text-[var(--color-text-muted)] max-w-sm">
            If something isn&apos;t right with a delivered order, you can
            request a return from that order&apos;s details page.
          </p>
          <LocalizedClientLink
            href="/account/orders"
            className="mt-1 px-6 py-3 rounded-full bg-[var(--color-gold)] text-[var(--color-plum-deep)] text-[12px] font-bold uppercase tracking-wider hover:brightness-105 transition-all"
          >
            View My Orders
          </LocalizedClientLink>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {requests.map((r) => {
            const m = STATUS_META[r.status]
            const Icon = m.Icon
            return (
              <article
                key={r.id}
                className="rounded-2xl bg-white border border-[var(--color-lavender)] p-5 small:p-6"
              >
                <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-plum)]">
                        {r.type === "exchange" ? "Exchange" : "Return"}{" "}
                        {r.id.slice(-8).toUpperCase()}
                      </span>
                      {r.type === "exchange" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-lavender)] text-[var(--color-plum)] text-[10px] font-bold uppercase tracking-wider">
                          <Repeat size={10} />
                          Exchange
                        </span>
                      )}
                    </div>
                    <p className="text-[12.5px] text-[var(--color-text-muted)]">
                      Submitted on {fmt(r.created_at)}
                    </p>
                  </div>
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ${m.cls}`}
                  >
                    <Icon size={13} />
                    <span className="text-[11px] font-bold uppercase tracking-wider">
                      {r.type === "exchange" && r.status === "received"
                        ? "Awaiting replacement"
                        : r.type === "exchange" && r.status === "completed"
                        ? "Replacement shipped"
                        : m.label}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 small:grid-cols-2 gap-x-6 gap-y-3 text-[13px] mb-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] font-semibold mb-0.5">
                      Reason
                    </p>
                    <p className="text-[var(--color-text-primary)]">
                      {RETURN_REASON_LABELS[r.reason as keyof typeof RETURN_REASON_LABELS] ||
                        r.reason}
                    </p>
                  </div>
                  {r.type === "refund" ? (
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] font-semibold mb-0.5">
                        Estimated refund
                      </p>
                      <p className="font-semibold text-[var(--color-plum)] tabular-nums">
                        {r.refund_amount
                          ? convertToLocale({
                              amount: r.refund_amount,
                              currency_code: r.currency_code,
                            })
                          : "—"}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] font-semibold mb-0.5">
                        Replacement order
                      </p>
                      <p className="font-semibold text-[var(--color-plum)]">
                        {r.replacement_order_id
                          ? r.replacement_order_id.slice(-8).toUpperCase()
                          : "Pending"}
                      </p>
                    </div>
                  )}
                </div>

                {r.status === "rejected" && r.rejected_reason && (
                  <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-100">
                    <p className="text-[12px] text-red-700">
                      <strong>Reason:</strong> {r.rejected_reason}
                    </p>
                  </div>
                )}

                {r.message && (
                  <p className="text-[12.5px] text-[var(--color-text-secondary)] italic border-l-2 border-[var(--color-lavender)] pl-3 mb-3">
                    “{r.message}”
                  </p>
                )}

                <LocalizedClientLink
                  href={`/account/orders/details/${r.order_id}`}
                  className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--color-plum)] hover:text-[var(--color-plum-deep)]"
                >
                  View related order →
                </LocalizedClientLink>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
