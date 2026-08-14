"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { isLanguage, languages, translate, type Language, type TranslationKey } from "@/lib/i18n";

type Value={language:Language;setLanguage:(value:Language)=>void;t:(key:TranslationKey)=>string;direction:"ltr"|"rtl"};
const Context=createContext<Value|null>(null);

export default function LanguageProvider({children}:{children:React.ReactNode}){
  const [language,setLanguageState]=useState<Language>("en");
  useEffect(()=>{const saved=localStorage.getItem("sime-language");if(isLanguage(saved))setLanguageState(saved);else{const browser=navigator.language.slice(0,2);if(isLanguage(browser))setLanguageState(browser)}},[]);
  const direction=languages.find(item=>item.code===language)?.direction||"ltr";
  useEffect(()=>{document.documentElement.lang=language;document.documentElement.dir=direction;document.cookie=`sime_language=${language}; Path=/; Max-Age=31536000; SameSite=Lax`},[language,direction]);
  const setLanguage=(value:Language)=>{localStorage.setItem("sime-language",value);setLanguageState(value)};
  const value=useMemo<Value>(()=>({language,setLanguage,t:key=>translate(language,key),direction}),[language,direction]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useLanguage(){const value=useContext(Context);if(!value)throw new Error("useLanguage must be used inside LanguageProvider");return value}
