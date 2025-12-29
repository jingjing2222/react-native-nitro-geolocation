import { useEffect } from "react";

export const useSetDevToolsEnabled = () => {
  useEffect(() => {
    globalThis.__geolocationDevToolsEnabled = true;
  }, []);
};
