// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: false },
  ssr: false,
  modules: ['coily/nuxt', '@placement/vue/nuxt'],
  compatibilityDate: '2026-07-17',
})
