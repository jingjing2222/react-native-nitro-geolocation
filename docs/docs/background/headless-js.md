# Android Headless JS

Register task at app root, outside React components:

```ts
import {
  registerBackgroundTask,
  type BackgroundEvent,
} from 'react-native-nitro-geolocation/background';

registerBackgroundTask(async (event: BackgroundEvent) => {
  if (event.type === 'location') {
    console.log('Headless location', event.location);
  }
});
```

Headless JS is Android-only. On iOS, read stored events after app initialization.
