import dotenv from "dotenv";
dotenv.config({
  path: "../.env",
});
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
const s3Client = new S3Client({
  region: process.env.AWS_S3_BUCKET_REGION,
  credentials: {
    accessKeyId: process.env.AWS_IAM_USER_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_IAM_USER_SECRET_ACCESS_KEY!,
  },
});





const getObjectSignedUrl = async(key: string) => {
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: key,
  });


};
const listProjectFiles = async(str:string) => {
  const command = new ListObjectsV2Command({
    Bucket: process.env.AWS_S3_BUCKET_NAME!,
    Prefix: str,
  });
  const response = await s3Client.send(command);
}


const command = new GetObjectCommand({
  Bucket: process.env.AWS_S3_BUCKET_NAME!,
  Key: "",
});
  // const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // URL valid for 1 hour
  //  console.log("Signed URL:", signedUrl);
  async function attachDownloadUrls(files: any[]) {
  return Promise.all(
    files.map(async (file) => {
      const command = new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME!,
        Key: file.Key,
      });

      const url = await getSignedUrl(s3Client, command, {
        expiresIn: 600,
      });

      return {
        ...file,
        downloadUrl: url,
      };
    })
  );
}

attachDownloadUrls([
  { Key: "projects/1f172c33-2ac2-4d86-901c-f0e036c8dafe/files/Dockerfile" },
  { Key: "projects/1f172c33-2ac2-4d86-901c-f0e036c8dafe/files/.dockerignore" },
  { Key: "projects/1f172c33-2ac2-4d86-901c-f0e036c8dafe/files/docker-compose.yml" },
]).then((filesWithUrls) => {
  projectUrls.push(...filesWithUrls.map(file => file.downloadUrl));
  console.log("Files with download URLs:", projectUrls);
}).catch((error) => {
  console.error("Error attaching download URLs:", error);
});


export { getObjectSignedUrl };
export default s3Client;
