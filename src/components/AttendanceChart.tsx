"use client"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Image from 'next/image';

// #region Sample data
const data = [
  {
    name: 'Mon',
    present: 60,
    absent: 40,
  },
  {
    name: 'Tue',
    present: 70,
    absent: 60,
  },
  {
    name: 'Wed',
    present: 65,
    absent: 55,
  },
  {
    name: 'Thu',
    present: 90,
    absent: 75,
  },
  {
    name: 'Fri',
    present: 60,
    absent: 50,
  },
  {
    name: 'Sat',
    present: 65,
    absent: 55,
  },
];

const AttendanceChart = () => {
    return (
        <div className="bg-white rounded-lg p-4 h-full">
            <div className='flex justify-between items-center'>
                <h1 className='text-lg font-semibold'>Attendance</h1>
                <Image src="/moreDark.png" alt="" width={20} height={20}/>
            </div>
            <BarChart
                style={{ width: '100%', maxWidth: '700px', maxHeight: '70vh', aspectRatio: 1.618 }}
                responsive
                data={data}
                barSize={20}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ddd"/>
                <XAxis dataKey="name" axisLine={false} tick={{fill:"#d1d5db"}}  tickLine={false}/>
                <YAxis width="auto" axisLine={false} tick={{fill:"#d1d5db"}}  tickLine={false}/>
                <Tooltip />
                <Legend align="left" verticalAlign='top' wrapperStyle={{paddingTop:"20px", paddingBottom:"40px"}}/>
                <Bar dataKey="present" fill="#8884d8" activeBar={{ fill: 'pink', stroke: 'blue' }} radius={[10, 10, 0, 0]} legendType='circle' />
                <Bar dataKey="absent" fill="#82ca9d" activeBar={{ fill: 'gold', stroke: 'purple' }} radius={[10, 10, 0, 0]} legendType='circle' />
            </BarChart>
        </div>
    )
}

export default AttendanceChart 