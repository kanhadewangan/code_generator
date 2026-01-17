import express from 'express';
const app = express();
import prisma from './prisma/src/prisma';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import user from './models/user';
import project from './models/project';
dotenv.config({
    path: '.env'
});
app.use(express.json());

app.use('/api/v1/users',user);
app.use('/api/v1/projects', project);




app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});