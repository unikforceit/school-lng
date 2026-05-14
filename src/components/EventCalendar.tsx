"use client"
import { useState } from "react";
import Calendar from "react-calendar";
import 'react-calendar/dist/Calendar.css';
import Image from "next/image";

type ValuePiece = Date | null;

type Value = ValuePiece | [ValuePiece, ValuePiece];

// TEMPORARY

const events = [
    {
        id:1,
        title:"Gamified school management system",
        time:"12:00PM - 2:00 PM",
        description:"SIME School Managemet system",
    },
    {
        id:2,
        title: "Smart academic gamified engine",
        time: "12:00 PM - 2:00 PM",
        description:"L'intelligence prédictive au service d'une éducation proactive" 
    },

    {
        id:3,
        title: "Smart academic gamified engine",
        time: "12:00 PM - 2:00 PM",
        description:"L'intelligence prédictive au service d'une éducation proactive" 
    }
]

const EventCalendar = () => {
    const [value, onChange] = useState<Value>(new Date());
    return (
        <div className="bg-white p-4 rounded-md">
            <Calendar onChange={onChange} value={value}/>
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold my-4">Events</h1>
                <Image src="/moreDark.png" alt="" width={20} height={20}/>
            </div>
            <div className="flex flex-col gap-4">
                {events.map(event=> (
                    <div className="p-5 rounded-md border-2 border-gray-100 border-t-5 odd:border-t-sageSky even:border-t-sageYellow" key={event.id}>
                        <div className="flex items-center justify-between">
                            <h1 className="font-semibold text-gray-600">{event.title}</h1>
                            <span className="text-gray-300 text-xs">{event.title}</span>
                        </div>
                        <p className="mt-2 text-gray-400">{event.description}</p>
                    </div>
                ))}
            </div>
            </div>
    );
};

export default EventCalendar