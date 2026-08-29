import OSS from "ali-oss";

export function getOssConfig() {
  const region = process.env.OSS_REGION;
  const bucket = process.env.OSS_BUCKET;
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID;
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET;

  if (!region || !bucket || !accessKeyId || !accessKeySecret) {
    throw new Error(
      "OSS configuration is incomplete. Set OSS_REGION, OSS_BUCKET, OSS_ACCESS_KEY_ID, and OSS_ACCESS_KEY_SECRET."
    );
  }

  return {
    region,
    bucket,
    accessKeyId,
    accessKeySecret,
    endpoint: process.env.OSS_ENDPOINT || undefined,
  };
}

function validateObjectKey(objectKey: string): string {
  if (
    objectKey.startsWith("/") ||
    objectKey.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    throw new Error("OSS object key is invalid.");
  }
  return objectKey;
}

function getVideoContentType(objectKey: string): string | undefined {
  const extension = objectKey.split(".").pop()?.toLowerCase();
  return {
    mp4: "video/mp4",
    m4v: "video/mp4",
    webm: "video/webm",
    ogv: "video/ogg",
    mov: "video/quicktime",
  }[extension ?? ""];
}

export function getOssPlaybackUrl(requestedObjectKey?: string): string {
  const objectKey = requestedObjectKey || process.env.OSS_VIDEO_OBJECT_KEY;
  if (!objectKey) {
    throw new Error("OSS_VIDEO_OBJECT_KEY is not configured.");
  }

  const expires = Number(process.env.OSS_SIGNED_URL_EXPIRES_SECONDS ?? 3600);
  if (!Number.isInteger(expires) || expires <= 0) {
    throw new Error("OSS_SIGNED_URL_EXPIRES_SECONDS must be a positive integer.");
  }

  const client = new OSS({
    ...getOssConfig(),
    ...(process.env.OSS_STS_TOKEN ? { stsToken: process.env.OSS_STS_TOKEN } : {}),
  });
  const validatedObjectKey = validateObjectKey(objectKey);
  const contentType = getVideoContentType(validatedObjectKey);
  return client.signatureUrl(validatedObjectKey, {
    expires,
    response: {
      "content-disposition": "inline",
      ...(contentType ? { "content-type": contentType } : {}),
    },
  });
}
