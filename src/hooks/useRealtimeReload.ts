"use client";
import { useEffect,useRef } from "react";

export function useRealtimeReload(reload:()=>void){const current=useRef(reload);current.current=reload;useEffect(()=>{let timer:ReturnType<typeof setTimeout>|undefined;const listener=()=>{if(timer)clearTimeout(timer);timer=setTimeout(()=>current.current(),150)};window.addEventListener("sime:realtime",listener);return()=>{window.removeEventListener("sime:realtime",listener);if(timer)clearTimeout(timer)}},[])}
