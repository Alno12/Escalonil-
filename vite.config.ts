/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

/**
 * O app é publicado em uma subrota do GitHub Pages:
 *   https://alno12.github.io/Escalonil-/
 * Por isso `base` precisa terminar com "/" e ser usado também pelo manifest
 * e pelo service worker. Pode ser sobrescrito com BASE_PATH (ex.: "/" local).
 */
const base = process.env.BASE_PATH ?? '/Escalonil-/'

/**
 * Nos previews de pull request o service worker se AUTODESTRÓI.
 *
 * O app atualiza sob demanda (`registerType: 'prompt'`), que é o certo para
 * quem usa: ninguém é interrompido no meio de um plantão. Só que todos os
 * previews de uma PR moram no MESMO endereço, e o service worker da build
 * anterior continua servindo o cache antigo até alguém tocar em "Atualizar" —
 * e recarregar a página não adianta. Isso já custou rodadas inteiras de teste
 * num aparelho, com correções que nunca chegaram a rodar.
 *
 * `selfDestroying` publica um service worker que se desregistra e limpa os
 * caches. Daí em diante o preview é sempre a build de agora.
 *
 * A publicação de verdade — o `main` do Netlify e o GitHub Pages — não passa
 * por aqui: o `CONTEXT` do Netlify só vale "deploy-preview" nas PRs.
 */
const isDeployPreview = process.env.CONTEXT === 'deploy-preview'

export default defineConfig({
  base,
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    VitePWA({
      // "prompt": o usuário decide quando atualizar (ver UpdatePrompt.tsx).
      registerType: 'prompt',
      selfDestroying: isDeployPreview,
      injectRegister: null,
      includeAssets: ['favicon-32.png', 'apple-touch-icon.png', 'icons/*.png'],
      manifest: {
        id: base,
        name: 'Escalonil — Plantões',
        short_name: 'Escalonil',
        description:
          'Organize seus plantões, horas trabalhadas e recebimentos. Funciona offline, os dados ficam só no seu aparelho.',
        lang: 'pt-BR',
        dir: 'ltr',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        // O ícone é amarelo: a tela de abertura usa o fundo CLARO do app, não
        // o amarelo dele — senão o ícone some dentro do próprio fundo. E o app
        // abre no claro por padrão, então é o que aparece logo em seguida.
        background_color: '#f2f2f7',
        theme_color: '#f4f5f8',
        categories: ['medical', 'productivity', 'finance'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
  },
})
