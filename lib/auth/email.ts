import 'server-only';


// ============================================================
// TRANSACTIONAL EMAIL
//
// V1 provider: Resend HTTP API.
//
// No SDK dependency is required.
// ============================================================

function env(
  name:
    string
) {

  return String(
    process.env[name]
    ||
    ''
  ).trim();

}


function requireEmailConfig() {

  const apiKey =
    env(
      'RESEND_API_KEY'
    );


  const from =
    env(
      'GROWTHOS_EMAIL_FROM'
    );


  if (
    !apiKey
    ||
    !from
  ) {

    throw new Error(
      'Transactional email is not configured. RESEND_API_KEY and GROWTHOS_EMAIL_FROM are required.'
    );

  }


  return {
    apiKey,
    from,
  };

}


export function getGrowthOSPublicBaseUrl(
  fallbackOrigin?:
    string | null
) {

  const configured =
    env(
      'GROWTHOS_PUBLIC_BASE_URL'
    );


  const value =
    configured
    ||
    String(
      fallbackOrigin
      ||
      ''
    ).trim();


  return value
    .replace(
      /\/$/,
      ''
    );

}


function escapeHtml(
  value:
    string
) {

  return String(
    value
    ||
    ''
  )
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&#039;'
    );

}


export async function sendGrowthOSEmail(
  input: {

    to:
      string;

    subject:
      string;

    html:
      string;

    text:
      string;

    idempotencyKey?:
      string;

  }
) {

  const {
    apiKey,
    from,
  } =
    requireEmailConfig();


  const response =
    await fetch(
      'https://api.resend.com/emails',
      {

        method:
          'POST',

        headers: {

          Authorization:
            `Bearer ${apiKey}`,

          'Content-Type':
            'application/json',

          ...(input.idempotencyKey
            ? {
                'Idempotency-Key':
                  input.idempotencyKey,
              }
            : {}),

        },

        body:
          JSON.stringify({

            from,

            to: [
              input.to,
            ],

            subject:
              input.subject,

            html:
              input.html,

            text:
              input.text,

          }),

      }
    );


  const raw =
    await response.text();


  if (!response.ok) {

    throw new Error(
      `Transactional email failed with HTTP ${response.status}: ${raw.slice(0, 300)}`
    );

  }


  try {

    return JSON.parse(
      raw
    );

  } catch {

    return {
      ok:
        true,
    };

  }

}


export async function sendGrowthOSPasswordResetEmail(
  input: {

    to:
      string;

    resetUrl:
      string;

    tokenId:
      string;

  }
) {

  const safeUrl =
    escapeHtml(
      input.resetUrl
    );


  await sendGrowthOSEmail({

    to:
      input.to,

    subject:
      'Reset your Growth OS password',

    idempotencyKey:
      `password-reset/${input.tokenId}`,

    text:
      `Reset your Growth OS password: ${input.resetUrl}\n\nThis link expires in 30 minutes. If you did not request this, you can ignore this email.`,

    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111827">
        <h2 style="margin:0 0 12px">Reset your Growth OS password</h2>
        <p style="color:#475569;line-height:1.6">Use the secure link below to choose a new password.</p>
        <p style="margin:24px 0">
          <a href="${safeUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">Reset password</a>
        </p>
        <p style="color:#64748b;font-size:13px;line-height:1.6">This link expires in 30 minutes and can be used once. If you did not request this, you can ignore this email.</p>
      </div>
    `,

  });

}


export async function sendGrowthOSInviteEmail(
  input: {

    to:
      string;

    inviteUrl:
      string;

    tokenId:
      string;

    workspaceName?:
      string | null;

  }
) {

  const safeUrl =
    escapeHtml(
      input.inviteUrl
    );


  const workspace =
    escapeHtml(
      input.workspaceName
      ||
      'Growth OS'
    );


  await sendGrowthOSEmail({

    to:
      input.to,

    subject:
      'You have been invited to Growth OS',

    idempotencyKey:
      `growthos-invite/${input.tokenId}`,

    text:
      `You have been invited to ${input.workspaceName || 'Growth OS'}. Set your password here: ${input.inviteUrl}\n\nThis link expires in 72 hours.`,

    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111827">
        <h2 style="margin:0 0 12px">You have been invited to Growth OS</h2>
        <p style="color:#475569;line-height:1.6">Your access to ${workspace} is ready. Set your password to activate your login.</p>
        <p style="margin:24px 0">
          <a href="${safeUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">Set password</a>
        </p>
        <p style="color:#64748b;font-size:13px;line-height:1.6">This link expires in 72 hours and can be used once.</p>
      </div>
    `,

  });

}
