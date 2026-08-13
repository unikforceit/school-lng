"use client";
import CsvBulkActions from "@/components/CsvBulkActions";

const columns=[
 {key:"studentId",label:"Student ID",required:true,sample:"SIME-2001"},{key:"name",label:"Full name",required:true,sample:"Example Student"},{key:"email",label:"Email",required:true,sample:"student@example.edu"},{key:"phone",label:"Phone",sample:"+8801700000000"},{key:"grade",label:"Grade",required:true,sample:8},{key:"className",label:"Class",required:true,sample:"8-A"},{key:"address",label:"Address",sample:"Dhaka"},{key:"gender",label:"Gender",sample:"unspecified"},{key:"bloodType",label:"Blood type",sample:"Unknown"},{key:"photoUrl",label:"Photo URL",sample:""},
];
export default function StudentCsvToolbar({rows,canImport}:{rows:Array<Record<string,unknown>>;canImport:boolean}){return <CsvBulkActions title="Students" columns={columns} rows={rows} importUrl="/api/students/bulk" canImport={canImport} onImported={async()=>window.location.reload()}/>}
