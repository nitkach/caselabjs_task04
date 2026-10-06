import { z } from "zod";

const emailSchema = z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((email) => email.toLowerCase());

const passwordSchema = z.string().min(8).max(72);

export const registerSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
});

export const loginSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
