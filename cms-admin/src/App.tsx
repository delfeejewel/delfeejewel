import { Refine, Authenticated } from "@refinedev/core"
import { RefineThemes, ThemedLayoutV2, ThemedTitleV2, notificationProvider, AuthPage } from "@refinedev/antd"
import { BrowserRouter, Routes, Route, Outlet, Navigate } from "react-router-dom"
import routerProvider, { NavigateToResource } from "@refinedev/react-router-v6"
import { ConfigProvider, App as AntdApp, theme } from "antd"
import "@refinedev/antd/dist/reset.css"

import { supabaseDataProvider, supabaseLiveProvider } from "./providers/supabase"
import { authProvider } from "./providers/auth"
import { CustomSider } from "./components/custom-sider"
import { Homepage, HomepageOverview, HomepagePromo, HomepageReviews, HomepageExperience, HomepageFindStore } from "./pages/homepage"
import { Settings } from "./pages/settings"
import { HeroSlideCreate, HeroSlideEdit } from "./pages/hero-slides"
import { ReviewCreate, ReviewEdit } from "./pages/reviews"
import { PromoBannerCreate, PromoBannerEdit } from "./pages/promo-banners"
import { PageList, PageCreate, PageEdit } from "./pages/cms-pages"
import { CustomSectionList, CustomSectionCreate, CustomSectionEdit } from "./pages/custom-sections"
import { ExperienceCreate, ExperienceEdit } from "./pages/experience"
import { Header } from "./pages/header"
import { Footer } from "./pages/footer"
import { MenuList, MenuCreate, MenuEdit } from "./pages/menus"
import { Notifications, NotificationsText, NotificationsWhatsapp } from "./pages/notifications"
import { EmailSettings } from "./pages/email-settings"
import { EmailTemplates } from "./pages/email-templates"

const App = () => {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ConfigProvider theme={{
        ...RefineThemes.Green,
        algorithm: theme.darkAlgorithm,
      }}>
        <AntdApp>
          <Refine
            routerProvider={routerProvider}
            dataProvider={supabaseDataProvider}
            liveProvider={supabaseLiveProvider}
            authProvider={authProvider}
            notificationProvider={notificationProvider}
            resources={[
              {
                name: "homepage",
                list: "/homepage",
                meta: { label: "Homepage" },
              },
              {
                name: "cms_pages",
                list: "/pages",
                create: "/pages/create",
                edit: "/pages/edit/:id",
                meta: { label: "Pages" },
              },
              {
                name: "cms_hero_slides",
                list: "/hero-slides",
                create: "/hero-slides/create",
                edit: "/hero-slides/edit/:id",
                meta: { label: "Hero Slides", parent: "homepage", hide: true },
              },
              {
                name: "cms_reviews",
                list: "/reviews",
                create: "/reviews/create",
                edit: "/reviews/edit/:id",
                meta: { label: "Reviews", parent: "homepage", hide: true },
              },
              {
                name: "cms_promo_banners",
                list: "/promo-banners",
                create: "/promo-banners/create",
                edit: "/promo-banners/edit/:id",
                meta: { label: "Promo Banners", parent: "homepage", hide: true },
              },
              {
                name: "cms_experience_features",
                list: "/experience",
                create: "/experience/create",
                edit: "/experience/edit/:id",
                meta: { label: "Experience", parent: "homepage", hide: true },
              },
              {
                name: "cms_custom_sections",
                list: "/sections",
                create: "/sections/create",
                edit: "/sections/edit/:id",
                meta: { label: "Sections" },
              },
              {
                name: "header",
                list: "/header",
                meta: { label: "Header" },
              },
              {
                name: "footer",
                list: "/footer",
                meta: { label: "Footer" },
              },
              {
                name: "cms_menus",
                list: "/menus",
                create: "/menus/create",
                edit: "/menus/edit/:id",
                meta: { label: "Menus" },
              },
              {
                name: "settings",
                list: "/settings",
                meta: { label: "Store Info" },
              },
              {
                name: "notifications",
                list: "/notifications",
                meta: { label: "Notifications" },
              },
              {
                name: "cms_email_sender",
                meta: { label: "Email Settings", hide: true },
              },
              {
                name: "cms_email_templates",
                meta: { label: "Email Templates", hide: true },
              },
            ]}
            options={{
              syncWithLocation: true,
              liveMode: "auto",
            }}
          >
            <Routes>
              <Route
                element={
                  <Authenticated key="main" fallback={<Navigate to="/login" />}>
                    <ThemedLayoutV2
                      Sider={() => <CustomSider />}
                    >
                      <Outlet />
                    </ThemedLayoutV2>
                  </Authenticated>
                }
              >
                <Route index element={<NavigateToResource resource="homepage" />} />

                {/* Homepage settings — nested routes */}
                <Route path="/homepage" element={<Homepage />}>
                  <Route index element={<HomepageOverview />} />
                  <Route path="promo" element={<HomepagePromo />} />
                  <Route path="reviews" element={<HomepageReviews />} />
                  <Route path="experience" element={<HomepageExperience />} />
                  <Route path="find-store" element={<HomepageFindStore />} />
                </Route>

                {/* Hero Slides CRUD */}
                <Route path="/hero-slides" element={<Navigate to="/homepage" replace />} />
                <Route path="/hero-slides/create" element={<HeroSlideCreate />} />
                <Route path="/hero-slides/edit/:id" element={<HeroSlideEdit />} />

                {/* Reviews CRUD */}
                <Route path="/reviews" element={<Navigate to="/homepage/reviews" replace />} />
                <Route path="/reviews/create" element={<ReviewCreate />} />
                <Route path="/reviews/edit/:id" element={<ReviewEdit />} />

                {/* Promo Banners CRUD */}
                <Route path="/promo-banners" element={<Navigate to="/homepage/promo" replace />} />
                <Route path="/promo-banners/create" element={<PromoBannerCreate />} />
                <Route path="/promo-banners/edit/:id" element={<PromoBannerEdit />} />


                {/* Experience CRUD */}
                <Route path="/experience" element={<Navigate to="/homepage/experience" replace />} />
                <Route path="/experience/create" element={<ExperienceCreate />} />
                <Route path="/experience/edit/:id" element={<ExperienceEdit />} />

                {/* Static Pages CRUD */}
                <Route path="/pages" element={<PageList />} />
                <Route path="/pages/create" element={<PageCreate />} />
                <Route path="/pages/edit/:id" element={<PageEdit />} />

                {/* Custom Sections */}
                <Route path="/sections" element={<CustomSectionList />} />
                <Route path="/sections/create" element={<CustomSectionCreate />} />
                <Route path="/sections/edit/:id" element={<CustomSectionEdit />} />

                {/* Header & Footer */}
                <Route path="/header" element={<Header />} />
                <Route path="/footer" element={<Footer />} />

                {/* Menus */}
                <Route path="/menus" element={<MenuList />} />
                <Route path="/menus/create" element={<MenuCreate />} />
                <Route path="/menus/edit/:id" element={<MenuEdit />} />

                {/* Settings */}
                <Route path="/settings" element={<Settings />} />

                {/* Notifications — Email (Settings/Templates), Text, WhatsApp */}
                <Route path="/notifications" element={<Notifications />}>
                  <Route index element={<Navigate to="/notifications/email/settings" replace />} />
                  <Route path="email/settings" element={<EmailSettings />} />
                  <Route path="email/templates" element={<EmailTemplates />} />
                  <Route path="text" element={<NotificationsText />} />
                  <Route path="whatsapp" element={<NotificationsWhatsapp />} />
                </Route>
              </Route>
              <Route
                element={
                  <Authenticated key="auth" fallback={<Outlet />}>
                    <NavigateToResource resource="homepage" />
                  </Authenticated>
                }
              >
                <Route path="/login" element={
                  <AuthPage
                    type="login"
                    title={<h2 style={{ textAlign: "center", marginBottom: 0 }}>Store CMS</h2>}
                  />
                } />
              </Route>
            </Routes>
          </Refine>
        </AntdApp>
      </ConfigProvider>
    </BrowserRouter>
  )
}

export default App
