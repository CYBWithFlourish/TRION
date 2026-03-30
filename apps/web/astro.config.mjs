import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  server: {
    port: 3001
  },
  vite: {
    ssr: {
      noExternal: ['@mysten/sui', '@mysten/dapp-kit', '@mysten/dapp-kit-react', '@mysten/dapp-kit-core']
    }
  }
});
