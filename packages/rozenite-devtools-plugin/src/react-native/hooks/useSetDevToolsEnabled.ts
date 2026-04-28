import { useEffect } from "react";

declare const __DEV__: boolean;

export const useSetDevToolsEnabled = () => {
  useEffect(() => {
    if (typeof __DEV__ === "undefined" || __DEV__ !== true) {
      return;
    }

    globalThis.__geolocationDevToolsEnabled = true;
  }, []);
};
