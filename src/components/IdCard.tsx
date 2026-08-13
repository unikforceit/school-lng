"use client";

import { useState } from "react";
import type { Role } from "@/lib/auth";

export type IdCardPerson={key:string;id:string;name:string;role:Role;email:string;details:string;grade:number;className:string;bloodType:string;photoUrl:string;qrCode:string};

export default function IdCard({people,currentKey,school,academicYear}:{people:IdCardPerson[];currentKey:string;school:string;academicYear:string}){
  const [selectedKey,setSelectedKey]=useState(currentKey);
  const person=people.find(item=>item.key===selectedKey)??people[0];
  if(!person)return <p role="alert" className="rounded-xl bg-red-50 p-5 text-red-700">No identity record is available.</p>;
  const initials=person.name.split(/\s+/).filter(Boolean).map(part=>part[0]).slice(0,2).join("").toUpperCase();
  return <div className="space-y-5">
    <header className="id-card-controls flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#0c2237] p-6 text-white">
      <div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#efa900]">Identity center</p><h1 className="mt-2 text-2xl font-bold">Student Smart Card</h1><p className="mt-1 text-sm text-slate-300">Secure QR verification · print at actual size (85.6 × 53.98 mm).</p></div>
      <button type="button" onClick={()=>window.print()} className="rounded-lg bg-[#efa900] px-5 py-3 font-bold text-[#0c2237] transition hover:bg-[#ffc43d]">Print / Save PDF</button>
    </header>
    {people.length>1&&<label className="id-card-controls block max-w-lg text-sm font-semibold">Choose an authorized student<select value={person.key} onChange={event=>setSelectedKey(event.target.value)} className="mt-2 w-full rounded-lg border bg-white p-3">{people.map(item=><option key={item.key} value={item.key}>{item.name} — {item.className} — {item.id}</option>)}</select></label>}
    <section aria-label="ID card print preview" className="rounded-2xl border border-dashed border-slate-300 bg-slate-100 p-3 sm:p-8">
      <article aria-label={`${person.name} school identity card`} className="id-card-print-area relative mx-auto aspect-[1.586/1] w-full max-w-[540px] overflow-hidden rounded-[22px] border border-slate-200 bg-white text-[#0c2237] shadow-2xl">
        <div aria-hidden="true" className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[#efa900]"/>
        <div aria-hidden="true" className="absolute -bottom-28 -left-16 h-56 w-56 rounded-full bg-[#fff1c4]"/>
        <div className="absolute inset-x-0 top-0 h-3 bg-[#0c2237]"/>
        <div className="relative flex h-full flex-col p-[5.2%]">
          <header className="flex items-start justify-between gap-4">
            <div className="min-w-0"><p className="truncate text-[clamp(.72rem,2.2vw,1rem)] font-black uppercase tracking-[.12em]">{school}</p><p className="mt-0.5 text-[clamp(.52rem,1.6vw,.7rem)] font-semibold uppercase tracking-[.18em] text-[#b77900]">Official identification</p></div>
            <span className="relative rounded-full bg-[#0c2237] px-3 py-1 text-[clamp(.5rem,1.5vw,.68rem)] font-bold uppercase tracking-wider text-white">{person.role}</span>
          </header>
          <div className="mt-[5%] grid min-h-0 flex-1 grid-cols-[24%_1fr_25%] items-center gap-[4%]">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-full border-4 border-[#efa900] bg-[#fff5d8] text-[clamp(1.3rem,5vw,2.15rem)] font-black" aria-label={`${person.name} photo`}>{person.photoUrl?<img src={person.photoUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer"/>:initials}</div>
            <div className="min-w-0 self-center">
              <p className="text-[clamp(.52rem,1.6vw,.7rem)] font-semibold uppercase tracking-[.16em] text-slate-400">Card holder</p>
              <h2 className="mt-1 truncate text-[clamp(1rem,4vw,1.7rem)] font-black leading-tight">{person.name}</h2>
              <p className="mt-1 truncate text-[clamp(.58rem,1.8vw,.78rem)] font-semibold text-[#b77900]">{person.details}</p>
              <dl className="mt-[5%] grid grid-cols-2 gap-x-3 gap-y-[4%] text-[clamp(.52rem,1.6vw,.7rem)]">
                <div><dt className="uppercase tracking-wider text-slate-400">ID number</dt><dd className="truncate font-black tracking-wide">{person.id}</dd></div>
                <div><dt className="uppercase tracking-wider text-slate-400">Blood type</dt><dd className="truncate font-black">{person.bloodType}</dd></div>
                <div><dt className="uppercase tracking-wider text-slate-400">Grade</dt><dd className="truncate font-semibold">{person.grade}</dd></div>
                <div><dt className="uppercase tracking-wider text-slate-400">Class</dt><dd className="truncate font-semibold">{person.className}</dd></div>
              </dl>
            </div>
            <div className="relative self-end text-center">
              {/* QR images are generated server-side from a signed, expiring verification token. */}
              <img src={person.qrCode} alt={`QR code to verify ${person.name}'s ID card`} className="aspect-square w-full rounded-lg bg-white p-1"/>
              <p className="mt-1 text-[clamp(.45rem,1.35vw,.58rem)] font-bold uppercase tracking-wider">Scan to verify</p>
            </div>
          </div>
          <footer className="mt-[3%] flex items-end justify-between gap-3 border-t border-slate-200 pt-[2.5%] text-[clamp(.48rem,1.45vw,.64rem)]"><span className="font-semibold text-slate-500">Academic year <strong className="text-[#0c2237]">{academicYear}</strong></span><span className="font-black uppercase tracking-[.16em]">SIME Secure ID</span></footer>
        </div>
      </article>
    </section>
  </div>;
}
