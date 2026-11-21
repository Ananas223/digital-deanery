import { THEME_STORAGE_KEY } from "./theme";

/** Trusted static UI initializer; no session, request or environment data. */
export const THEME_BOOTSTRAP =
  '(function(){var p="system";try{var s=localStorage.getItem(' +
  JSON.stringify(THEME_STORAGE_KEY) +
  ');if(s==="light"||s==="dark")p=s;}catch(e){}var d=document.documentElement;var m=document.querySelector("meta[name=\\"color-scheme\\"]");var c=p==="system"?"light dark":p;d.dataset.themePreference=p;d.dataset.theme=p==="dark"||(p==="system"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light";d.style.colorScheme=c;if(m)m.content=c;})();';
