import express from "express";
import { type Response, type Request } from "express";
const project = express.Router();
import prisma from "../prisma/src/prisma";
import dotenv from "dotenv";
import { isAuthenticated } from "./auth";
import client from "../services/openai";
import s3Client from "../services/bucket";
import { PutObjectCommand } from "@aws-sdk/client-s3";

dotenv.config({
  path: ".env",
});

project.post(
  "/create",
  isAuthenticated,
  async (req: Request, res: Response) => {
    const { title, description, initialPrompt } = req.body;
    try {
      const aiResponse = await client.chat.completions.create({
        model: process.env.MODEL_NAME!,
        messages: [
          {
            role: "user",
            content: `
You are an automated code generator used in a secure backend system.

CRITICAL RULES (MUST FOLLOW):
- Return ONLY valid JSON
- Do NOT explain anything
- Do NOT include markdown
- Do NOT include comments outside files
- Do NOT return partial output

The response MUST strictly match this JSON schema:

{
  "files": [
    {
      "path": "string",
      "content": "string"
    }
  ]
}

Rules:
- "files" must always be an array
- Every generated file MUST be inside the "files" array
- Even config-only output MUST be wrapped as files
- Each file must contain COMPLETE content as plain text
- Paths must be valid relative file paths (e.g. src/index.ts)

Project details:
- Title: "${title}"
- Description: "${description}"
- Initial Prompt: "${initialPrompt}"

Docker / Sandbox Requirements (MANDATORY):
- Generate a Dockerfile that runs the app in an ISOLATED sandbox container
- Use a minimal base image (node:20-alpine or equivalent)
- Run as a NON-ROOT user
- Do NOT include OS package managers or shells beyond what is required
- Do NOT bake secrets or .env files into the image
- Expose only the required application port
- Include a .dockerignore file
- Include a docker-compose.yml that:
  - binds only to 127.0.0.1
  - enforces CPU and memory limits
  - uses read-only filesystem where possible
  - disables privilege escalation (no-new-privileges)

Task:
Generate ALL necessary source files AND sandbox Docker configuration files required to build and run this project securely in an isolated container.
`,
          },
        ],

        response_format: { type: "json_object" },
      });
      const requiredFiles = [
        "Dockerfile",
        ".dockerignore",
        "docker-compose.yml",
      ];

      if (aiResponse.choices.length === 0)
        return res.status(500).json({ error: "No response from AI model" });
      const data = JSON.parse(aiResponse.choices[0].message.content as string);

      if (!data || typeof data !== "object" || !Array.isArray(data.files)) {
        console.error("AI RESPONSE:", data);
        throw new Error(
          "Invalid AI response format. Expected data.files array",
        );
      }
      for (const file of requiredFiles) {
        if (!data.files.some((f) => f.path === file)) {
          throw new Error(`Missing required sandbox file: ${file}`);
        }
      }

      // Upload files directly to S3 instead of local filesystem
      for (const file of data.files) {
        const fileParam = {
          Bucket: process.env.AWS_S3_BUCKET_NAME!,
          Key: `projects/${title}/files/${file.path}`,
          Body: file.content,
          ContentType: "text/plain", // Adjust based on file type
        };
        await s3Client.send(new PutObjectCommand(fileParam));
        console.log(`✅ Uploaded ${file.path} to S3`);
      }
      const newProject = await prisma.projects.create({
        data: {
          title,
          description,
          initialPrompt,
          userId: req.userId,
          projectLink: `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_S3_BUCKET_REGION}.amazonaws.com/projects/${title}/files/`,
        },
      });
      res.json({
        project: newProject,
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Error creating project" });
    }
  },
);

project.get("/auth-check", isAuthenticated, async (req, res) => {
  res
    .status(200)
    .json({ message: "User is authenticated", userId: req.userId as unknown });
  console.log("Authenticated user ID:", req.userId);
});

export default project;
