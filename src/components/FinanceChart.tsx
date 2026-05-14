"use client"
import Image from "next/image";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

// #region Sample data
const data = [
  {
    name: 'Jan',
    income: 4000,
    expense: 2400,
    amt: 2400,
  },
  {
    name: 'Feb',
    income: 3000,
    expense: 1398,
    amt: 2210,
  },
  {
    name: 'Mar',
    income: 2000,
    expense: 9800,
    amt: 2290,
  },
  {
    name: 'Apr',
    income: 2780,
    expense: 3908,
    amt: 2000,
  },
  {
    name: 'May',
    income: 1890,
    expense: 4800,
    amt: 2181,
  },
  {
    name: 'Jun',
    income: 2390,
    expense: 3800,
    amt: 2500,
  },
  {
    name: 'Jul',
    income: 3490,
    expense: 4300,
    amt: 2100,
  },
  {
    name: 'Aug',
    income: 3490,
    expense: 4300,
    amt: 2100,
  },

  {
    name: 'Sep',
    income: 3490,
    expense: 4300,
    amt: 2100,
  },

  {
    name: 'Oct',
    income: 3490,
    expense: 4300,
    amt: 2100,
  },

  {
    name: 'Nov',
    income: 3490,
    expense: 4300,
    amt: 2100,
  },

  {
    name: 'Dec',
    income: 3490,
    expense: 4300,
    amt: 2100,
  },
];

const FinanceChart = () => {
    return (
        <div className="bg-white rounded-xl w-full h-full p-4">
            <div className='flex justify-between items-center'>
                <h1 className='text-lg font-semibold'>FinanceChart</h1>
                <Image src="/moreDark.png" alt="" width={20} height={20}/>
            </div>
           <LineChart
                style={{ width: '100%', maxWidth: '100%', height: '100%', maxHeight: '70vh', aspectRatio: 1.618 }}
                responsive
                data={data}
                margin={{
                    top: 5,
                    right: 0,
                    left: 0,
                    bottom: 5,
                }}
             >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-3)" />
            <XAxis dataKey="name" stroke="var(--color-text-3)" axisLine={false} tick={{fill:"#d1d5db"}}  tickLine={false}/>
            <YAxis width="auto" stroke="var(--color-text-3)" axisLine={false} tick={{fill:"#d1d5db"}}  tickLine={false} />
            <Tooltip
                cursor={{
                stroke: 'var(--color-border-2)',
                }}
                contentStyle={{
                backgroundColor: 'var(--color-surface-raised)',
                borderColor: 'var(--color-border-2)',
                }}
            />
            <Legend align="center" verticalAlign='top' wrapperStyle={{paddingTop:"10px", paddingBottom:"30px"}}/>
            <Line
                type="monotone"
                dataKey="income"
                stroke="#8884D8"
                activeDot={{ r: 8, stroke: 'var(--color-surface-base)' }}
            />
            <Line
                type="monotone"
                dataKey="expense"
                stroke="#CFCEFF"
                activeDot={{ stroke: 'var(--color-surface-base)' }}
            />
            </LineChart>

        </div>
    )
}

export default FinanceChart