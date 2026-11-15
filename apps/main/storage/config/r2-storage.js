const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  HeadObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { getStorageConfig } = require("./storage-env");

let _s3 = null;
const getS3Client = () => {
  if (!_s3) {
    const { endpoint, accessKeyId, secretAccessKey } = getStorageConfig(process.env, { requireMedia: false });
    _s3 = new S3Client({
      endpoint,
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
  // Keep importing routes and the health endpoint independent of R2 setup.
  s3: { send: (command) => getS3Client().send(command) },
  getS3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  HeadObjectCommand,
  getSignedUrl,
};
