import { usePermissions } from "@refinedev/core"

// True when the logged-in user has the developer role (unlocks dev-only controls
// such as changing a page's template). Everyone else is treated as admin.
export function useIsDeveloper(): boolean {
  const { data } = usePermissions<string>()
  return data === "developer"
}
