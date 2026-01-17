import z from 'zod';

export const UserSchema = z.object({
    email: z.string().email().min(5).max(255),
    name: z.string().min(3).max(100),
    password: z.string().min(8).max(100),
})


export const UserLoginSchema = z.object({
    email: z.string().email().min(5).max(255),
    password: z.string().min(8).max(100),
})

export type UserType = z.infer<typeof UserSchema>;
export type UserLoginType = z.infer<typeof UserLoginSchema>;