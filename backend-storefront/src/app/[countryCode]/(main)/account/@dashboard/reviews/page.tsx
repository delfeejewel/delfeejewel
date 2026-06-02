import { Metadata } from "next"

import { getMyReviews } from "@lib/data/reviews"
import AccountReviews from "@modules/reviews/components/account-reviews"

export const metadata: Metadata = {
  title: "My Reviews",
  description: "Review the pieces you've purchased.",
}

export default async function ReviewsPage() {
  const { pending, submitted } = await getMyReviews()

  return <AccountReviews pending={pending} submitted={submitted} />
}
