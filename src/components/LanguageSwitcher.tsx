"use client";

import { languages, type Language } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";

export default function LanguageSwitcher({dark=false,compact=false}:{dark?:boolean;compact?:boolean}){
  const {language,setLanguage,t}=useLanguage();
  return <label className={`language-switcher inline-flex min-h-10 items-center gap-2 rounded-xl border px-2 ${dark?"border-white/20 bg-white/10 text-white":"border-slate-200 bg-white text-slate-700"}`}>
    <span aria-hidden="true">🌐</span><span className={compact?"sr-only":"hidden text-xs font-semibold xl:inline"}>{t("language")}</span>
    <select aria-label={t("language")} value={language} onChange={event=>setLanguage(event.target.value as Language)} className="min-h-9 max-w-28 bg-transparent text-xs font-bold outline-none">
      {languages.map(item=><option key={item.code} value={item.code} className="text-slate-900">{item.native}</option>)}
    </select>
  </label>;
}
