import express from 'express';
const project = express.Router();
import prisma from '../prisma/src/prisma';
import dotenv from 'dotenv';
import { isAuthenticated } from './auth';
import fs from 'fs';
import path from 'path';
import client from './auth/openai';
dotenv.config({
    path: '.env'
})
 

project.post('/create', isAuthenticated, async (req, res) => {


    const { title, description, initialPrompt } = req.body;
    try {
        const res = await client.chat.completions.create({
            model: process.env.MODEL_NAME!,
            messages: [{ role: "user", content: initialPrompt }],

            response_format: { type: "json_object" },
        }); const data = JSON.parse(output as string);


          for (const file of data.files) {
            const filePath = path.join(process.cwd(), file.path);
            fs.writeFileSync(filePath, file.content);
            console.log(`✅ Created ${file.path}`);
        }
        const newProject = await prisma.projects.create({
            data: {
                title,
                description,
                initialPrompt,
                userId: req.userId as string
            }
        })
        res.status(201).json({
            project: newProject
        })
    }




    catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Error creating project' });
    }
})

project.get('/auth-check', isAuthenticated, async (req, res) => {
    res.status(200).json({ message: 'User is authenticated', userId: req.userId as unknown });
});


export default project;