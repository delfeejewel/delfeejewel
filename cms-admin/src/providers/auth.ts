import { AuthProvider } from "@refinedev/core"
import { supabaseClient } from "./supabase"

export const authProvider: AuthProvider = {
  login: async ({ email, password }) => {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return { success: false, error: { name: "Login Error", message: error.message } }
    }

    return { success: true, redirectTo: "/" }
  },

  logout: async () => {
    const { error } = await supabaseClient.auth.signOut()
    if (error) {
      return { success: false, error: { name: "Logout Error", message: error.message } }
    }
    return { success: true, redirectTo: "/login" }
  },

  check: async () => {
    const { data } = await supabaseClient.auth.getSession()
    if (data?.session) {
      return { authenticated: true }
    }
    return { authenticated: false, redirectTo: "/login" }
  },

  // Role comes ONLY from app_metadata, which users cannot modify themselves.
  // (user_metadata is writable via supabase.auth.updateUser(), so trusting it
  // would let a user grant themselves the "developer" role.) Defaults to the
  // most restrictive role ("admin") when none is set.
  getPermissions: async () => {
    const { data } = await supabaseClient.auth.getUser()
    const u = data?.user
    return (u?.app_metadata?.role || "admin") as string
  },

  getIdentity: async () => {
    const { data } = await supabaseClient.auth.getUser()
    if (data?.user) {
      return {
        id: data.user.id,
        name: data.user.email,
        avatar: `https://ui-avatars.com/api/?name=${data.user.email}&background=4db6ac&color=fff`,
      }
    }
    return null
  },

  onError: async (error) => {
    if (error?.status === 401) {
      return { logout: true }
    }
    return { error }
  },
}
