"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Role } from "@/lib/auth";
import { canReadResource, type ResourceType } from "@/lib/resources";
import { useLanguage } from "@/components/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n";

type Item={label:TranslationKey;href:string;icon:string;resource?:ResourceType;roles?:Role[]};
const academy:Item[]=[
  {label:"subjects",href:"/list/subjects",icon:"/subject.png",resource:"subjects"},{label:"classes",href:"/list/classes",icon:"/class.png",resource:"classes"},{label:"lessons",href:"/list/lessons",icon:"/lesson.png",resource:"lessons"},{label:"exams",href:"/list/exams",icon:"/exam.png",resource:"exams"},{label:"assignments",href:"/list/assignments",icon:"/assignment.png",resource:"assignments"},{label:"results",href:"/list/results",icon:"/result.png",resource:"results"},{label:"attendance",href:"/list/attendance",icon:"/attendance.png",resource:"attendance"},
];
const communication:Item[]=[{label:"events",href:"/list/events",icon:"/calendar.png",resource:"events"},{label:"messages",href:"/list/messages",icon:"/message.png",resource:"messages"},{label:"announcements",href:"/list/announcements",icon:"/announcement.png",resource:"announcements"}];

export default function Menu({role,apiVisible=false,expanded=false}:{role:Role;apiVisible?:boolean;expanded?:boolean}){
  const pathname=usePathname();
  const {t}=useLanguage();
  const [academyOpen,setAcademyOpen]=useState(pathname.startsWith("/list/subjects")||pathname.startsWith("/list/classes")||pathname.startsWith("/list/lessons")||pathname.startsWith("/list/exams")||pathname.startsWith("/list/assignments")||pathname.startsWith("/list/results")||pathname.startsWith("/list/attendance"));
  const [gameOpen,setGameOpen]=useState(pathname.startsWith("/gamification"));
  const allowed=(items:Item[])=>items.filter(item=>(!item.resource||canReadResource(role,item.resource))&&(!item.roles||item.roles.includes(role)));
  const main:Item[]=role==="superadmin"?[
    {label:"overview",href:"/superadmin",icon:"/home.png"},{label:"schools",href:"/superadmin/schools",icon:"/class.png"},{label:"licenses",href:"/superadmin/licenses",icon:"/result.png"},{label:"schoolUsers",href:"/superadmin/users",icon:"/teacher.png"},{label:"developerApi",href:"/superadmin/api",icon:"/message.png"},{label:"auditLog",href:"/superadmin/audit",icon:"/attendance.png"},{label:"platformSettings",href:"/superadmin/settings",icon:"/setting.png"},{label:"idCards",href:"/superadmin/id-card",icon:"/profile.png"},
  ]:[
    {label:"home",href:`/${role}`,icon:"/home.png"},{label:"sageAi",href:"/ai",icon:"/message.png"},{label:"idCards",href:"/id-card",icon:"/profile.png"},...(role==="admin"&&apiVisible?[{label:"developerApi",href:"/developer",icon:"/message.png"} as Item]:[]),{label:"teachers",href:"/list/teachers",icon:"/teacher.png",resource:"teachers"},{label:"students",href:"/list/students",icon:"/student.png",roles:["admin","teacher"]},{label:"parents",href:"/list/parents",icon:"/parent.png",resource:"parents"},...(role==="admin"||role==="teacher"?[{label:"earlyIntervention",href:"/interventions",icon:"/attendance.png"} as Item]:[]),
  ];
  const game:Item[]=role==="superadmin"?[]:[{label:"overallClass",href:"/gamification",icon:"/result.png"},...(role==="admin"?[{label:"gameRules",href:"/gamification/settings",icon:"/setting.png"} as Item]:[])];
  const itemView=(item:Item,nested=false)=>{const active=pathname===item.href||(item.href!=="/superadmin"&&pathname.startsWith(`${item.href}/`));return <Link key={item.href} title={t(item.label)} aria-current={active?"page":undefined} href={item.href} className={`flex h-12 items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200 ${expanded?"justify-start":"justify-center lg:justify-start"} ${nested?(expanded?"ps-10 pe-3":"lg:ps-10 lg:pe-3"):(expanded?"px-3.5":"lg:px-3.5")} ${active?"bg-[#fff7e7] text-[#9a6900]":"text-[#50545b] hover:bg-[#fbfaf6] hover:text-[#102039]"}`}><span className="flex h-6 w-6 shrink-0 items-center justify-center"><Image src={item.icon} alt="" width={nested?16:19} height={nested?16:19}/></span><span className={`${expanded?"block":"hidden lg:block"} truncate`}>{t(item.label)}</span></Link>};
  async function logout(){await fetch("/api/auth/logout",{method:"POST"}).catch(()=>undefined);window.location.assign(role==="superadmin"?"/superadmin/sign-in":"/sign-in")}
  const buttonClass=`flex h-12 w-full items-center gap-3 rounded-xl text-sm font-medium text-[#50545b] transition-all duration-200 hover:bg-[#fbfaf6] hover:text-[#102039] ${expanded?"justify-start px-3.5":"justify-center px-0 lg:justify-start lg:px-3.5"}`;
  return <nav aria-label={t("mainNavigation")} className="flex min-h-[calc(100vh-105px)] flex-col justify-between gap-8 pb-2">
    <div className="space-y-1">{allowed(main).map(item=>itemView(item))}{role!=="superadmin"&&<><button type="button" aria-expanded={academyOpen} onClick={()=>setAcademyOpen(value=>!value)} className={buttonClass} title={t("academy")}><span className="flex h-6 w-6 shrink-0 items-center justify-center"><Image src="/subject.png" alt="" width={19} height={19}/></span><span className={`${expanded?"block":"hidden lg:block"} flex-1 text-start`}>{t("academy")}</span><span aria-hidden="true" className={`${expanded?"block":"hidden lg:block"} text-xs transition ${academyOpen?"rotate-180":""}`}>⌄</span></button>{academyOpen&&<div className={`space-y-1 border-s border-amber-100 ${expanded?"ms-6":"lg:ms-6"}`}>{allowed(academy).map(item=>itemView(item,true))}</div>}<button type="button" aria-expanded={gameOpen} onClick={()=>setGameOpen(value=>!value)} className={buttonClass} title={t("gamification")}><span className="flex h-6 w-6 shrink-0 items-center justify-center"><Image src="/result.png" alt="" width={19} height={19}/></span><span className={`${expanded?"block":"hidden lg:block"} flex-1 text-start`}>{t("gamification")}</span><span aria-hidden="true" className={`${expanded?"block":"hidden lg:block"} text-xs transition ${gameOpen?"rotate-180":""}`}>⌄</span></button>{gameOpen&&<div className={`space-y-1 border-s border-amber-100 ${expanded?"ms-6":"lg:ms-6"}`}>{game.map(item=>itemView(item,true))}</div>}{allowed(communication).map(item=>itemView(item))}</>}</div>
    <div className="space-y-1 border-t border-slate-100 pt-3">{itemView({label:"profile",href:role==="superadmin"?"/superadmin/profile":"/profile",icon:"/profile.png"})}{role!=="superadmin"&&itemView({label:"settings",href:role==="admin"?"/admin/settings":"/settings",icon:"/setting.png"})}<button type="button" title={t("logout")} onClick={()=>void logout()} className={`${buttonClass} text-red-600 hover:bg-red-50 hover:text-red-700`}><span className="flex h-6 w-6 shrink-0 items-center justify-center"><Image src="/logout.png" alt="" width={19} height={19}/></span><span className={expanded?"block":"hidden lg:block"}>{t("logout")}</span></button></div>
  </nav>;
}
