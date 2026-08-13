import { z } from "zod";
import type { Role } from "@/lib/auth";

export const resourceTypes = ["teachers", "parents", "subjects", "classes", "lessons", "exams", "assignments", "results", "attendance", "events", "messages", "announcements"] as const;
export type ResourceType = typeof resourceTypes[number];
export const resourceTypeSchema = z.enum(resourceTypes);

const field = (name: string, label: string, type: "text" | "number" | "date" | "time" | "email" = "text", required = true) => ({ name, label, type, required });
export const resourceConfig: Record<ResourceType, { title: string; primary: string; fields: ReturnType<typeof field>[] }> = {
  teachers: { title: "Teachers", primary: "name", fields: [field("teacherId", "Teacher ID"), field("name", "Full name"), field("email", "Email", "email"), field("phone", "Phone", "text", false), field("subjects", "Subjects"), field("classes", "Classes"), field("address", "Address", "text", false)] },
  parents: { title: "Parents", primary: "name", fields: [field("name", "Full name"), field("students", "Students"), field("email", "Email", "email"), field("phone", "Phone", "text", false), field("address", "Address", "text", false)] },
  subjects: { title: "Subjects", primary: "name", fields: [field("name", "Subject name"), field("teachers", "Teachers")] },
  classes: { title: "Classes", primary: "name", fields: [field("name", "Class name"), field("capacity", "Capacity", "number"), field("grade", "Grade", "number"), field("supervisor", "Supervisor")] },
  lessons: { title: "Lessons", primary: "subject", fields: [field("subject", "Subject"), field("class", "Class"), field("teacher", "Teacher")] },
  exams: { title: "Exams", primary: "subject", fields: [field("subject", "Subject"), field("class", "Class"), field("teacher", "Teacher"), field("date", "Date", "date")] },
  assignments: { title: "Assignments", primary: "subject", fields: [field("subject", "Subject"), field("class", "Class"), field("teacher", "Teacher"), field("dueDate", "Due date", "date")] },
  results: { title: "Results", primary: "student", fields: [field("subject", "Subject"), field("student", "Student"), field("score", "Score", "number"), field("teacher", "Teacher"), field("class", "Class"), field("date", "Date", "date"), field("type", "Type")] },
  attendance: { title: "Attendance", primary: "student", fields: [field("student", "Student"), field("class", "Class"), field("date", "Date", "date"), field("status", "Status"), field("note", "Note", "text", false)] },
  events: { title: "Events", primary: "title", fields: [field("title", "Title"), field("class", "Class"), field("date", "Date", "date"), field("startTime", "Start time", "time"), field("endTime", "End time", "time")] },
  messages: { title: "Messages", primary: "subject", fields: [field("subject", "Subject"), field("recipient", "Recipient"), field("body", "Message"), field("status", "Status"), field("date", "Date", "date")] },
  announcements: { title: "Announcements", primary: "title", fields: [field("title", "Title"), field("class", "Audience/Class"), field("date", "Date", "date")] },
};

export const resourcePayloadSchema = z.record(z.string(), z.union([z.string().trim().max(500), z.number().finite()])).refine((value) => Object.keys(value).length > 0 && Object.keys(value).length <= 20, "Resource requires 1-20 fields");

const readAccess: Record<Role, readonly ResourceType[]> = {
  superadmin: [],
  admin: resourceTypes,
  teacher: ["teachers", "subjects", "classes", "lessons", "exams", "assignments", "results", "attendance", "events", "messages", "announcements"],
  student: ["teachers", "subjects", "classes", "lessons", "exams", "assignments", "results", "attendance", "events", "messages", "announcements"],
  parent: ["teachers", "subjects", "classes", "lessons", "exams", "assignments", "results", "attendance", "events", "messages", "announcements"],
};

export function canReadResource(role: Role, type: ResourceType) {
  return readAccess[role].includes(type);
}

export function readableResourceTypes(role: Role) {
  return readAccess[role];
}

export function canWriteResource(role: Role, type: ResourceType) {
  return role === "admin" || (role === "teacher" && ["lessons", "exams", "assignments", "results", "attendance", "events", "messages", "announcements"].includes(type));
}
