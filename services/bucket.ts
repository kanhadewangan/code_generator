import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_IAM_USER_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_IAM_USER_SECRET_ACCESS_KEY!,
  },
});


export default s3Client;
