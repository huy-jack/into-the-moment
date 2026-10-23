// All fixed values from the design spec.

// Host limits
export const MAX_FUNCTION_S = 300;
export const PAID_CALL_TIMEOUT_MS = 250_000;
export const PROVIDER_SDK_RETRIES = 0;

// Photos
export const WORKING_COPY_MAX_PX = 2048;
export const REKOGNITION_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_MIN_SIDE_PX = 512;
export const FACE_MIN_HEIGHT_PX = 128; // my call: tune in B1
export const SHARPNESS_MIN = 20; // my call: tune in B1
export const REFS_MAX = 4;
export const USER_PHOTOS_MIN = 1;
export const USER_PHOTOS_MAX = 4;

// Template geometry
export const FACE_SMALL_RATIO = 0.15;
export const REPAIR_CROP_PAD = 0.3;

// Routing and scoring
export const CHILD_AGE = 18;
export const FACE_T_DEFAULT = 80;
export const GEN_RETRIES_MAX = 1;
export const RATE_LIMIT_DEFAULT_WAIT_MS = 10_000;

// Jobs
export const STUCK_AFTER_MS = 600_000;
export const POLL_FAST_MS = 2000;
export const POLL_SLOW_MS = 5000;
export const POLL_SLOW_AFTER_MS = 30_000;

// Caps
export const JOB_CAP_PER_HOUR = 20;
export const UPLOAD_CAP_PER_MONTH = 1500;
export const SPEND_CAP_USD_DEFAULT = 10;
export const HARNESS_MAX_SPEND_USD = 6;

// Access and storage
export const SIGNED_URL_TTL_S = 3600;
export const SESSION_COOKIE = 'cs_session';
export const SESSION_TTL_MS = 8 * 24 * 60 * 60 * 1000;
export const UPLOAD_MAX_BYTES = 15 * 1024 * 1024;
export const UPLOAD_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Output image target (about 1.5 MP, like 1024x1536)
export const OUTPUT_TARGET_PX = 1_572_864;
export const OUTPUT_MIN_PX = 655_360;
export const OUTPUT_MAX_PX = 8_294_400;
export const OUTPUT_MAX_RATIO = 3;
