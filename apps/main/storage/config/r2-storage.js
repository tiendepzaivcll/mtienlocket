const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  HeadObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

let _s3 = null;
const getS3Client = () => {
  if (!_s3) {
    const accessKeyId = process.env.R2_ACCESS_KEY || "";
    const secretAccessKey = process.env.R2_SECRET_KEY || "";
    if (!accessKeyId || !secretAccessKey) {
      console.error("❌ R2 credentials missing: R2_ACCESS_KEY or R2_SECRET_KEY not set");
    }
    _s3 = new S3Client({
      endpoint: process.env.R2_ENDPOINT,
      region: "auto",
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return _s3;
};

module.exports = {
  get s3() { return getS3Client(); },
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  HeadObjectCommand,
  getSignedUrl,
};
