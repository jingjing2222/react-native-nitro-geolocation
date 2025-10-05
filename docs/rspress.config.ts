import * as path from 'node:path';
import { defineConfig } from 'rspress/config';

export default defineConfig({
  root: path.join(__dirname, 'docs'),
  title: 'My Site',
  icon: '/logo.png',
  logo: '/logo.png',
  logoText: "react-native-nitro-geolocation",
  themeConfig: {
    socialLinks: [
      {
        icon: 'github',
        mode: 'link',
        content: 'https://github.com/jingjing2222/react-native-nitro-geolocation',
      },
    ],
  },
});
