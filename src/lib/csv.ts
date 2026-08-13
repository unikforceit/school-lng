export type CsvColumn={key:string;label:string;required?:boolean;sample?:string|number};

function escapeCell(value:unknown){
  const text=String(value??"");
  return /[",\r\n]/.test(text)?`"${text.replaceAll('"','""')}"`:text;
}

export function createCsv(columns:CsvColumn[],rows:Array<Record<string,unknown>>){
  return [columns.map(column=>escapeCell(column.key)).join(","),...rows.map(row=>columns.map(column=>escapeCell(row[column.key])).join(","))].join("\r\n");
}

export function parseCsv(text:string){
  const rows:string[][]=[];let row:string[]=[],cell="",quoted=false;
  for(let index=0;index<text.length;index+=1){const character=text[index];if(quoted){if(character==='"'&&text[index+1]==='"'){cell+='"';index+=1}else if(character==='"')quoted=false;else cell+=character}else if(character==='"')quoted=true;else if(character===","){row.push(cell);cell=""}else if(character==="\n"){row.push(cell.replace(/\r$/, ""));rows.push(row);row=[];cell=""}else cell+=character}
  if(quoted)throw new Error("CSV contains an unclosed quoted value.");
  if(cell||row.length){row.push(cell.replace(/\r$/, ""));rows.push(row)}
  const nonEmpty=rows.filter(values=>values.some(value=>value.trim()));
  if(nonEmpty.length<2)throw new Error("CSV must include a header and at least one data row.");
  const headers=nonEmpty[0].map(value=>value.trim().replace(/^\uFEFF/,""));
  if(new Set(headers).size!==headers.length||headers.some(header=>!header))throw new Error("CSV headers must be unique and non-empty.");
  return nonEmpty.slice(1).map((values,rowIndex)=>{if(values.length>headers.length)throw new Error(`Row ${rowIndex+2} has more values than headers.`);return Object.fromEntries(headers.map((header,index)=>[header,(values[index]??"").trim()]))});
}
