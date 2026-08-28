"use client";
import CsvBulkActions from "@/components/CsvBulkActions";

const columns=[
 {key:"studentId",label:"Student ID",required:true,sample:"GIN-2026-2001"},{key:"name",label:"Full name",required:true,sample:"Mamadou Camara"},{key:"email",label:"Email",required:true,sample:"mamadou@ecole.gn"},{key:"phone",label:"Phone",sample:"+224 620 10 20 30"},{key:"grade",label:"Level",required:true,sample:10},{key:"className",label:"Class",required:true,sample:"10e-A"},{key:"address",label:"Address",sample:"Conakry, Guinée"},{key:"gender",label:"Gender",sample:"unspecified"},{key:"bloodType",label:"Blood type",sample:"Unknown"},{key:"photoUrl",label:"Photo URL",sample:""},
];
export default function StudentCsvToolbar({rows,canImport}:{rows:Array<Record<string,unknown>>;canImport:boolean}){return <CsvBulkActions title="Students" columns={columns} rows={rows} importUrl="/api/students/bulk" canImport={canImport} onImported={async()=>window.location.reload()}/>}
