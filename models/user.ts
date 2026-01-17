import express from 'express';
const user = express.Router();
import prisma from '../prisma/src/prisma';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import {type UserType, type UserLoginType} from '../zod/user.zod';
dotenv.config({
    path: '.env'
})

user.post('/register',async (req, res) => {
    const { email, name, password }: UserType  = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_SALT_ROUNDS as string));
        const newUser = await prisma.user.create({
            data: {
                email,
                name,
                password: hashedPassword,
            },
        });

        const token = jwt.sign({ userId: newUser.id}, process.env.JSON_WEB_TOKEN_SECRET as string, {
            expiresIn: '1h',
        });
        res.status(201).json({ token });
    } catch (error) {
        res.status(500).json({ error: 'Error creating user' });
    }

})

user.post('/login',async(req,res)=>{
    const { email ,password}: UserLoginType = req.body;
    try{
        const user  = await prisma.user.findFirst({
            where:{ email , password}
        })
        if(!user  ){
            return  res.status(401).json({ error: 'Invalid email or password' });
        }
        const isPasswordValid = await bcrypt.compare(password,user.password);
        if(!isPasswordValid){   
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        const token = jwt.sign({ userId: user.id}, process.env.JSON_WEB_TOKEN_SECRET as string, {
            expiresIn: '1h',
        });
        res.status(200).json({ token });
    }
    catch(error){
        res.status(500).json({ error: 'Error logging in user' });
    }
})


user.put('/update-password',async(req, res)=>{
    const { email, oldPassword, newPassword } = req.body;
    try{
        const user = await prisma.user.findUnique({
            where:{email,password:oldPassword},

        })
        if(!user){
            return res.status(404).json({ error: 'User not found' });
        }

        const isOldPasswordValid = await bcrypt.compare(oldPassword,user.password);
        if(!isOldPasswordValid){
            return res.status(401).json({ error: 'Invalid old password' });
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_SALT_ROUNDS as string));
        await prisma.user.update({
            where:{ email },
            data:{ password:hashedNewPassword },
        })
        res.status(200).json({ message: 'Password updated successfully' });
    }
    catch(error){
        res.status(500).json({ error: 'Error updating password' });
    }
})

user.delete('/delete-account',(req , res)=>{
    const { email , password} = req.body;
    try{
        const user = prisma.user.findUnique({
            where:{ email , password}
        })
        if(!user){
            return res.status(404).json({ error: 'User not found' });
        }
        prisma.user.delete({
            where:{ email , password}
        })
        res.status(200).json({ message: 'User account deleted successfully' });

    }
    catch(error){
        res.status(500).json({ error: 'Error deleting user account' });
    }
}
)

export default user;