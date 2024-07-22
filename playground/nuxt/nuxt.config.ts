// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: false },
  ssr: false,
  modules: ['@nuxt/eslint', '@coily/vue/nuxt', '@placement/vue/nuxt'],
  compatibilityDate: '2024-07-16',
})
