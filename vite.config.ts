import { defineConfig } from 'vite';

export default defineConfig({
  base: '/texsnap/',
  test: {
    environment: 'jsdom',
  },
});
