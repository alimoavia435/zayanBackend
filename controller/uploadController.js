// import { PutObjectCommand } from "@aws-sdk/client-s3";
// import r2 from "../config/r2.js";

// export const uploadToR2 = async (file) => {
//   const fileKey = `uploads/${Date.now()}-${file.originalname}`;

//   await r2.send(
//     new PutObjectCommand({
//       Bucket: process.env.R2_BUCKET_NAME,
//       Key: fileKey,
//       Body: file.buffer,
//       ContentType: file.mimetype
//     })
//   );

//   return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET_NAME}/${fileKey}`;
// };

import { PutObjectCommand } from "@aws-sdk/client-s3";
import r2 from "../config/r2.js";

export const uploadToR2 = async (file) => {
  const fileKey = `uploads/${Date.now()}-${file.originalname}`;

  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileKey,
      Body: file.buffer,
      ContentType: file.mimetype
    })
  );

  // ✅ Return public URL instead of private endpoint
  return `https://pub-8f83f33eecb6437994c344a20b6d98df.r2.dev/${fileKey}`;
};
