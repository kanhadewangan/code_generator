import express from "express";
import { type Response, type Request } from "express";
const project = express.Router();
import prisma from "../prisma/src/prisma";
import dotenv from "dotenv";
import { isAuthenticated } from "./auth";
import client from "../services/openai";
import s3Client from "../services/bucket";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import mime from "mime-types";
dotenv.config({
  path: ".env",
});

project.post(
  "/create",
  isAuthenticated,
  async (req: Request, res: Response) => {
    const { title, description, initialPrompt } = req.body;
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const aiResponse = await client.chat.completions.create({
        model: process.env.MODEL_NAME!,
        messages: [
          {
            role: "user",
            content: `You are an automated code generator used in a secure backend system. 
            CRITICAL RULES (MUST FOLLOW): - Return ONLY valid JSON - Do NOT explain anything 
            - Do NOT include markdown - Do NOT include comments outside files 
            - Do NOT return partial output The response MUST strictly match this JSON schema: { "files": [ { "path": "string", "content": "string" } ] } 
            Rules: 
            - "files" must always be an array - Every generated file MUST be inside the "files" array 
            - Even config-only output MUST be wrapped as files - Each file must contain COMPLETE content as plain text 
            - Paths must be valid relative file paths (e.g. src/index.ts) Project details: - Title: "${title}" - Description: "${description}" 
            - Initial Prompt: "${initialPrompt}" Docker / Sandbox Requirements (MANDATORY):
            - Generate also Dockerfile that runs the app in an ISOLATED sandbox container 
            - Use a minimal base image ( equivalent) - Run as a NON-ROOT user 
            - Do NOT include OS package managers or shells beyond what is required 
            - Do NOT bake secrets or .env files into the image - Expose only the required application port 
            - Include DockerFile commands to install dependencies and run the app - Apply multiple layers to optimize build caching 
            - Include any necessary configuration files for the app to run - Include a .dockerignore file 
            - Include a docker-compose.yml that: - binds only to 127.0.0.1 - enforces CPU and memory limits 
            - uses read-only filesystem where possible - disables privilege escalation (no-new-privileges) 
            - mounts any necessary volumes as read-only - Ensure all security best practices for Docker containers are followed 
            - Use environment variables for any configuration/secrets needed to run the project. Generate the complete project structure and all necessary files according to these specifications. 
            also create a folder structure that is suitable for a production-grade application. 
            also generate necessary configuration files based on the generated code 
            also generate a readme.md file with instructions on how to build and run the project using Docker.
            Your response MUST be a single valid JSON object without any extra text.
            IMPORTANT:
            All file contents MUST be valid JSON-escaped strings.
        - Escape newlines as \\n
        - Escape double quotes as \\\"
        - Do NOT include unescaped " characters inside content
MANDATORY OUTPUT REQUIREMENTS (DO NOT SKIP):
- You MUST generate the following files:
  - Dockerfile
  - .dockerignore
  - docker-compose.yml
If any of these files are missing, the response is INVALID.
Generate these files FIRST before any other files.
CRITICAL FILE SEPARATION RULE:
- Each entry in "files" MUST represent exactly ONE file
- NEVER combine multiple files in a single "content"
- NEVER include another file name inside a file's content
- If you violate this rule, the response is INVALID


            Now, generate the project files as per the above requirements.`,
          }
        ],
        response_format: { type: "json_object" },
      });

      if (!aiResponse.choices.length) {
        return res.status(500).json({ error: "No response from AI model" });
      }

      const raw = aiResponse.choices[0].message.content as string;

      let data;
      try {
        data = JSON.parse(raw);
        for (const f of data.files) {
  if (
    f.content.includes("Dockerfile\n") ||
    f.content.includes(".dockerignore") ||
    f.content.includes("docker-compose")
  ) {
    throw new Error(
      `Invalid AI output: multiple files detected inside ${f.path}`
    );
  }
}

      } catch {
        console.error("INVALID AI JSON:", raw.slice(0, 500));
        return res.status(500).json({ error: "Invalid JSON from AI model" });
      }

      if (!Array.isArray(data.files)) {
        throw new Error("Invalid AI response format: missing files[]");
      }

      const requiredFiles = ["Dockerfile", ".dockerignore", "docker-compose.yml"];
      for (const file of requiredFiles) {
        if (!data.files.some((f: any) => f.path === file)) {
          throw new Error(`Missing required sandbox file: ${file}`);
        }
      }

      const projectId = crypto.randomUUID();
      const uploadedFiles = [];

      for (const file of data.files) {
        const key = `projects/${projectId}/files/${file.path}`;

        await s3Client.send(
          new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME!,
            Key: key,
            Body: file.content,
            ContentType: mime.lookup(file.path) || "text/plain",
          })
        );

        uploadedFiles.push(key);
      }

      const newProject = await prisma.projects.create({
        data: {
          id: projectId,
          title,
          description,
          initialPrompt,
          userId: req.userId,
          projectLink: `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_S3_BUCKET_REGION}.amazonaws.com/projects/${projectId}/files/`,
        },
      });

      res.json({ project: newProject });

    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error creating project" });
    }
  }
);


project.get("/auth-check", isAuthenticated, async (req, res) => {
  res
    .status(200)
    .json({ message: "User is authenticated", userId: req.userId as unknown });
  console.log("Authenticated user ID:", req.userId);
});

export default project;
