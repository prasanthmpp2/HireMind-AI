import { z } from "zod";

const optionalString = (max: number) => z.string().max(max).optional().or(z.literal(""));

const personalSchema = z.object({
  name: z.string().min(1, "Name is required").max(80),
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  phone: z.string().min(1, "Phone is required").max(20),
  address: optionalString(120),
  linkedin: optionalString(120),
  github: optionalString(120),
  photo: optionalString(500000),
  summary: optionalString(500)
});

const educationSchema = z.object({
  degree: optionalString(100),
  institution: optionalString(120),
  year: optionalString(12),
  score: optionalString(20)
});

const experienceSchema = z.object({
  company: optionalString(120),
  role: optionalString(120),
  duration: optionalString(60),
  description: optionalString(1200)
});

const projectSchema = z.object({
  name: optionalString(120),
  link: optionalString(160),
  description: optionalString(1200),
  tech: optionalString(120)
});

const certificationSchema = z.object({
  name: optionalString(120),
  issuer: optionalString(120),
  year: optionalString(12)
});

export const resumeSchema = z.object({
  personal: personalSchema,
  education: z.array(educationSchema).min(1),
  experience: z.array(experienceSchema).min(1),
  projects: z.array(projectSchema).min(1),
  skills: z.array(z.string().max(40)).max(30),
  certifications: z.array(certificationSchema).min(1)
});

export type ResumeSchema = z.infer<typeof resumeSchema>;
