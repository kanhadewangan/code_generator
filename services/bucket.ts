import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
const s3Client = new S3Client({
  region: 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_IAM_USER_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_IAM_USER_SECRET_ACCESS_KEY!,
  },
});



const getObjectSignedUrl = async(key: string) => {
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET_NAME!,
    Key: key,
  });

  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // URL valid for 1 hour
  return signedUrl;
};

getObjectSignedUrl("example-key")

export { getObjectSignedUrl };
export default s3Client;
