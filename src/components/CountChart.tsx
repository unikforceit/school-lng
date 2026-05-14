"use client"
import Image from 'next/image';
import { RadialBarChart, RadialBar, Legend, Tooltip, ResponsiveContainer } from 'recharts';

// #region Sample data
const data = [
  {
    name: 'Total',
    count: 103,
    fill: '#ffffff',
  },
  {
    name: 'Girls',
    count: 53,
    fill: '#e4d66c',
  },
  {
    name: 'Boys',
    count: 53,
    fill: '#d26f79',
  },
  
];

const CountChart = () =>{
    return (
        <div className="bg-white rounded-xl w-full h-full p-4">
         {/* TITLE */}
          <div className='flex justify-between items-center'>
          <h1 className='text-lg font-semibold'>Students</h1>
          <Image src="/moreDark.png" alt="" width={20} height={20}/>
          </div>
         {/* CHART */}
         <div className="relative w-full h-[75%]">
            <ResponsiveContainer>
            <RadialBarChart cx="50%" cy="58%" innerRadius="40%" outerRadius="100%" barSize={35} data={data}>
                <RadialBar
                    background
                    dataKey="count"
                    />
            </RadialBarChart>
            </ResponsiveContainer>
            <Image src="/maleFemale.png" alt="" width={50} height={50} className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-x-1/2'/>
            </div>
          {/*BTOTOM */}
            <div className="flex justify-center gap-16">

            {/* Girls */}
            <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-400 rounded-full"></div>
                <div className="flex flex-col">
                <h1 className="font-bold">1,234</h1>
                <h2 className="text-xs text-gray-400">Girls (55%)</h2>
                </div>
            </div>

            {/* Boys */}
            <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-400 rounded-full"></div>
                <div className="flex flex-col">
                <h1 className="font-bold">1,234</h1>
                <h2 className="text-xs text-gray-400">Boys (45%)</h2>
                </div>
            </div>

            </div>
        </div>
    )
}

export default CountChart