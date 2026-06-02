import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Assigns the "developer" role to the first admin user (you).
 * Run once after setup: npx medusa exec src/scripts/assign-developer-role.ts
 *
 * After this, new team members invited via admin will default to "admin" role.
 * You can then promote them via POST /admin/set-role if needed.
 */
export default async function assignDeveloperRole({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const userModule = container.resolve(Modules.USER)

  try {
    // Get all admin users
    const users = await userModule.listUsers()

    if (!users?.length) {
      logger.error("No admin users found.")
      return
    }

    logger.info("")
    logger.info("═══════════════════════════════════════════════")
    logger.info("  Assigning Developer Role")
    logger.info("═══════════════════════════════════════════════")
    logger.info("")

    const primaryUser = users[0] as any
    logger.info(`  User found: ${primaryUser.email}`)

    // Assign developer role — updateUsers accepts array of {id, ...data}
    await userModule.updateUsers([{
      id: primaryUser.id,
      metadata: { role: "developer" },
    }])

    logger.info(`  ✓ ${primaryUser.email} → developer`)

    // Mark remaining users as admin (if any)
    for (let i = 1; i < users.length; i++) {
      const user = users[i] as any
      const existingRole = user.metadata?.role
      if (!existingRole) {
        await userModule.updateUsers([{
          id: user.id,
          metadata: { role: "admin" },
        }])
        logger.info(`  ✓ ${user.email} → admin`)
      } else {
        logger.info(`  → ${user.email} → already has role: ${existingRole}`)
      }
    }

    logger.info("")
    logger.info("Done! Role assignments:")
    logger.info("  • developer — full access (settings, regions, tax, etc.)")
    logger.info("  • admin — products, orders, customers only")
    logger.info("")
    logger.info("Protected routes (POST/DELETE blocked for admin role):")
    logger.info("  /admin/regions, /admin/tax-regions, /admin/tax-rates")
    logger.info("  /admin/stock-locations, /admin/sales-channels")
    logger.info("  /admin/payment-providers, /admin/shipping-options")
    logger.info("  /admin/store, /admin/users, /admin/invites")
    logger.info("")
    logger.info("To change a user's role later:")
    logger.info("  POST /admin/set-role { user_id: '...', role: 'developer' }")
    logger.info("")
  } catch (error: any) {
    logger.error(`Failed: ${error.message}`)
  }
}
