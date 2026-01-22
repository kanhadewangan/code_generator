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
  import { orchestrator,codeGenerator } from "../services/llm";
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
      // ---------- PHASE 1: APP CODE ----------
      const appResponse = await client.chat.completions.create({
        model: process.env.MODEL_NAME!,
        messages: [
          {
            role: "user",
            content: codeGenerator(title, description, initialPrompt),
          },
        ],
        response_format: { type: "json_object" },
      });

      if (!appResponse.choices.length) {
        throw new Error("No response from app generator");
      }

      const appRaw = appResponse?.choices[0].message.content!;
      const appData = JSON.parse(appRaw);

      if (!Array.isArray(appData.files)) {
        throw new Error("Invalid app output: files[] missing");
      }

      // ---------- PHASE 2: INFRA ----------
      const infraResponse = await client.chat.completions.create({
        model: process.env.MODEL_NAME!,
        messages: [
          {
            role: "user",
            content: orchestrator(title),
          },
        ],
        response_format: { type: "json_object" },
      });

      if (!infraResponse.choices.length) {
        throw new Error("No response from infra generator");
      }
      if(!infraResponse?.choices[0].message.content){
        throw new Error("Empty infra response content");
      }

      const infraRaw = infraResponse.choices[0].message.content!;
      const infraData = JSON.parse(infraRaw);

      if (!Array.isArray(infraData.files)) {
        throw new Error("Invalid infra output: files[] missing");
      }

      // ---------- MERGE ----------
      const allFiles = [...appData.files, ...infraData.files];

      // ---------- VALIDATE INFRA ----------
      const requiredFiles = ["Dockerfile", ".dockerignore", "docker-compose.yml"];
      for (const f of requiredFiles) {
        if (!allFiles.some(file => file.path === f)) {
          throw new Error(`Missing infra file: ${f}`);
        }
      }

      // ---------- UPLOAD ----------
      const projectId = crypto.randomUUID();

      for (const file of allFiles) {
        await s3Client.send(
          new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME!,
            Key: `projects/${projectId}/files/${file.path}`,
            Body: file.content,
            ContentType: mime.lookup(file.path) || "text/plain",
          })
        );
      }

      const project = await prisma.projects.create({
        data: {
          id: projectId,
          title,
          description,
          initialPrompt,
          userId: req.userId,
          projectLink: `projects/${projectId}/files`,
        },
      });

      res.json({ project });

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Project generation failed" });
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
