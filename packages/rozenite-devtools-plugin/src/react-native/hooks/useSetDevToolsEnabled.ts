import { useEffect } from "react";
import {
  installDevtoolsRuntime,
  uninstallDevtoolsRuntime
} from "../devtoolsRuntime";

export const useSetDevToolsEnabled = () => {
  useEffect(() => {
    installDevtoolsRuntime();
    globalThis.__geolocationDevToolsEnabled = true;

    return () => {
      globalThis.__geolocationDevToolsEnabled = false;
      uninstallDevtoolsRuntime();
    };
  }, []);
};
