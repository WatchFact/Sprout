declare namespace Cloudflare {
  interface Env {
    MODERATOR_EMAILS?: string;
    AUTH_PASSWORD_PEPPER?: string;
    TWO_FACTOR_ENCRYPTION_KEY?: string;
    RESEND_API_KEY?: string;
    VERIFICATION_EMAIL_FROM?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
