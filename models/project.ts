  import express from "express";
  import { type Response, type Request } from "express";
  const project = express.Router();
  import prisma from "../prisma/src/prisma";
  import dotenv from "dotenv";
  import { isAuthenticated } from "./auth";
  import client from "../services/llm";
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
      const appResponse = await client.chat.completions.create({
    model: process.env.MODEL_NAME!,
    messages: [
      {
        role: "user",
        content: `You are a project generation orchestrator.

Your task is to generate a project based on the following requirements:
- Title: ${title}
- Description: ${description}
- Initial Prompt: ${initialPrompt}

Return ONLY valid JSON with this schema:
{
  "files": [{ "path": "string", "content": "string" }]
}

IMPORTANT:
- Generate ONLY application source code
- Do NOT generate Dockerfile, docker-compose.yml, or .dockerignore
- Each file must have a valid path and content
- Ensure all files are properly formatted`
      }
    ],
    response_format: { type: "json_object" }
  });
        const aiResponse = appResponse as any;
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

        // const requiredFiles = ["Dockerfile", ".dockerignore", "docker-compose.yml"];
        // for (const file of requiredFiles) {
        //   if (!data.files.some((f: any) => f.path === file)) {
        //     throw new Error(`Missing required sandbox file: ${file}`);
        //   }
        // }

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
