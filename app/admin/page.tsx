import {
  cookies,
} from 'next/headers';

import {
  redirect,
} from 'next/navigation';

import AdminDashboard
  from '../components/admin/AdminDashboard';

import {
  SESSION_COOKIE_NAME,
} from '@/lib/auth/config';

import {
  verifyGrowthOsSession,
} from '@/lib/auth/session';

import {
  requirePlatformAdminUser,
} from '@/lib/auth/platform-admin';


// ============================================================
// ADMIN PAGE
//
// SERVER-SIDE PLATFORM ADMIN GATE.
//
// Access requires:
//
// valid Growth OS session
//        ↓
// growthos_control.platform_admins
//        ↓
// active platform admin
//
// Brand role is deliberately NOT used for platform access.
// ============================================================

export default async function AdminPage() {

  // ==========================================================
  // 1. SESSION COOKIE
  // ==========================================================

  const cookieStore =
    await cookies();


  const sessionToken =
    cookieStore
      .get(
        SESSION_COOKIE_NAME
      )
      ?.value;


  if (!sessionToken) {

    redirect(
      '/login'
    );

  }


  // ==========================================================
  // 2. VERIFY GROWTH OS SESSION
  // ==========================================================

  let session;


  try {

    session =
      await verifyGrowthOsSession(
        sessionToken
      );

  } catch {

    redirect(
      '/login'
    );

  }


  // ==========================================================
  // 3. PLATFORM ADMIN AUTHORIZATION
  //
  // Do not use session.role here.
  //
  // session.role is the CLIENT / BRAND membership role.
  // ==========================================================

  try {

    await requirePlatformAdminUser(
      session.userId
    );

  } catch {

    // Authenticated Growth OS user,
    // but not a platform administrator.

    redirect(
      '/'
    );

  }


  // ==========================================================
  // 4. ADMIN APP
  // ==========================================================

  return (
    <AdminDashboard />
  );

}