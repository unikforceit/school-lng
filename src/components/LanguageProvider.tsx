"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { isLanguage, languages, translate, type Language, type TranslationKey } from "@/lib/i18n";

type Value={language:Language;setLanguage:(value:Language)=>void;t:(key:TranslationKey)=>string;direction:"ltr"|"rtl"};
const Context=createContext<Value|null>(null);

const storageKey="school-ing-language";

export default function LanguageProvider({children,initialLanguage}:{children:React.ReactNode;initialLanguage:Language}){
  const [language,setLanguageState]=useState<Language>(initialLanguage);
  const direction=languages.find(item=>item.code===language)?.direction||"ltr";
  useEffect(()=>{
    document.documentElement.lang=language;
    document.documentElement.dir=direction;
    document.cookie=`sime_language=${language}; Path=/; Max-Age=31536000; SameSite=Lax`;
    try{localStorage.setItem(storageKey,language)}catch{}
  },[language,direction]);
  useEffect(()=>{const sync=(event:StorageEvent)=>{if(event.key===storageKey&&isLanguage(event.newValue))setLanguageState(event.newValue)};window.addEventListener("storage",sync);return()=>window.removeEventListener("storage",sync)},[]);
  const setLanguage=useCallback((value:Language)=>{if(isLanguage(value))setLanguageState(value)},[]);
  const value=useMemo<Value>(()=>({language,setLanguage,t:key=>translate(language,key),direction}),[language,direction]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useLanguage(){const value=useContext(Context);if(!value)throw new Error("useLanguage must be used inside LanguageProvider");return value}
