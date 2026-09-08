'use client';

import {
  useState,
} from 'react';

import {
  Building2,
  Boxes,
  CreditCard,
  Database,
  History,
  LayoutDashboard,
  Plug,
  Settings,
  Users,
} from 'lucide-react';

import AdminClients
  from './AdminClients';

import AdminPlans
  from './AdminPlans';

import AdminModules
  from './AdminModules';

import AdminUsers
  from './AdminUsers';

import AdminIntegrations
  from './AdminIntegrations';

import AdminDataOperations
  from './AdminDataOperations';

import AdminSyncHistory
  from './AdminSyncHistory';

import AdminOverview
  from './AdminOverview';  

import AdminSystem
  from './AdminSystem';  


// ============================================================
// TYPES
// ============================================================

type AdminTab =
  | 'Overview'
  | 'Clients'
  | 'Plans'
  | 'Modules'
  | 'Users'
  | 'Integrations'
  | 'Data Operations'
  | 'Sync History'
  | 'System';


// ============================================================
// ADMIN DASHBOARD
// ============================================================

export default function AdminDashboard() {


  const [
    activeTab,
    setActiveTab,
  ] =
    useState<AdminTab>(
      'Overview'
    );


  return (

    <main
      className="
        min-h-screen
        bg-[#f5f6f8]
      "
    >

      <div
        className="
          flex
          min-h-screen
        "
      >


        {/* ====================================================
            ADMIN SIDEBAR
        ==================================================== */}

        <aside
          className="
            sticky
            top-0

            h-screen
            w-[220px]
            shrink-0

            border-r
            border-slate-800

            bg-[#111827]

            text-white
          "
        >


          {/* ==================================================
              BRAND
          ================================================== */}

          <div
            className="
              flex
              h-[60px]
              items-center
              gap-3

              border-b
              border-white/5

              px-3
            "
          >

            <div
              className="
                flex
                h-9
                w-9
                items-center
                justify-center

                rounded-xl

                bg-gradient-to-br
                from-violet-500
                to-blue-500

                text-[11px]
                font-semibold
              "
            >
              G
            </div>


            <div>

              <div
                className="
                  text-[14px]
                  font-semibold
                "
              >
                Growth OS
              </div>


              <div
                className="
                  text-[9px]
                  font-medium
                  uppercase
                  tracking-[0.12em]

                  text-slate-500
                "
              >
                Admin
              </div>

            </div>

          </div>


          {/* ==================================================
              NAVIGATION
          ================================================== */}

          <nav
            className="
              space-y-1

              px-2
              py-3
            "
          >

            <AdminNavItem
              label="Overview"
              icon={LayoutDashboard}
              active={activeTab === 'Overview'}
              onClick={() => setActiveTab('Overview')}
            />


            <AdminNavItem
              label="Clients"
              icon={Building2}
              active={activeTab === 'Clients'}
              onClick={() => setActiveTab('Clients')}
            />


            <AdminNavItem
              label="Plans"
              icon={CreditCard}
              active={activeTab === 'Plans'}
              onClick={() => setActiveTab('Plans')}
            />


            <AdminNavItem
              label="Modules"
              icon={Boxes}
              active={activeTab === 'Modules'}
              onClick={() => setActiveTab('Modules')}
            />


            <AdminNavItem
              label="Users"
              icon={Users}
              active={activeTab === 'Users'}
              onClick={() => setActiveTab('Users')}
            />


            <AdminNavItem
              label="Integrations"
              icon={Plug}
              active={activeTab === 'Integrations'}
              onClick={() => setActiveTab('Integrations')}
            />


            <AdminNavItem
              label="Data Operations"
              icon={Database}
              active={activeTab === 'Data Operations'}
              onClick={() => setActiveTab('Data Operations')}
            />


            {/* =================================================
                SYNC HISTORY
            ================================================= */}

            <AdminNavItem
              label="Sync History"
              icon={History}
              active={activeTab === 'Sync History'}
              onClick={() => setActiveTab('Sync History')}
            />


            <AdminNavItem
              label="System"
              icon={Settings}
              active={activeTab === 'System'}
              onClick={() => setActiveTab('System')}
            />

          </nav>

        </aside>


        {/* ====================================================
            ADMIN APPLICATION
        ==================================================== */}

        <section
          className="
            min-w-0
            flex-1
          "
        >


          {/* ==================================================
              ADMIN HEADER
          ================================================== */}

          <header
            className="
              sticky
              top-0
              z-40

              border-b
              border-slate-200/80

              bg-white/95

              backdrop-blur-xl
            "
          >

            <div
              className="
                flex
                min-h-[60px]
                items-center
                justify-between

                gap-3

                px-3
              "
            >

              <div className="min-w-0">

                <div
                  className="
                    text-[9px]
                    font-semibold
                    uppercase
                    tracking-[0.18em]

                    text-violet-600
                  "
                >
                  Growth OS Admin
                </div>


                <h1
                  className="
                    mt-0.5

                    truncate

                    text-[18px]
                    font-semibold
                    tracking-[-0.035em]

                    text-slate-950
                  "
                >
                  {getAdminTitle(
                    activeTab
                  )}
                </h1>


                <p
                  className="
                    mt-0.5

                    hidden

                    text-[11px]
                    text-slate-400

                    xl:block
                  "
                >
                  {getAdminSubtitle(
                    activeTab
                  )}
                </p>

              </div>

            </div>

          </header>


          {/* ==================================================
              WORKSPACE
          ================================================== */}

          <div
            className="
              mx-auto
              max-w-[1880px]

              px-3
              py-3
            "
          >


            {/* ================================================
                OVERVIEW
            ================================================ */}

            {activeTab ===
              'Overview' && (

              <AdminOverview />

            )}


            {/* ================================================
                CLIENTS
            ================================================ */}

            {activeTab ===
              'Clients' && (

              <AdminClients />

            )}


            {/* ================================================
                PLANS
            ================================================ */}

            {activeTab ===
              'Plans' && (

              <AdminPlans />

            )}


            {/* ================================================
                MODULES
            ================================================ */}

            {activeTab ===
              'Modules' && (

              <AdminModules />

            )}


            {/* ================================================
                USERS
            ================================================ */}

            {activeTab ===
              'Users' && (

              <AdminUsers />

            )}


            {/* ================================================
                INTEGRATIONS
            ================================================ */}

            {activeTab ===
              'Integrations' && (

              <AdminIntegrations />

            )}


            {/* ================================================
                DATA OPERATIONS
            ================================================ */}

            {activeTab ===
              'Data Operations' && (

              <AdminDataOperations />

            )}


            {/* ================================================
                SYNC HISTORY
            ================================================ */}

            {activeTab ===
              'Sync History' && (

              <AdminSyncHistory />

            )}


            {/* ================================================
                SYSTEM
            ================================================ */}

            {activeTab ===
              'System' && (

               <AdminSystem />

            )}

          </div>

        </section>

      </div>

    </main>

  );

}


// ============================================================
// ADMIN NAV ITEM
// ============================================================

function AdminNavItem({

  label,

  icon:
    Icon,

  active,

  onClick,

}: {

  label:
    string;

  icon:
    any;

  active:
    boolean;

  onClick:
    () => void;

}) {

  return (

    <button

      type="button"

      onClick={
        onClick
      }

      className={`
        flex
        h-[34px]
        w-full
        items-center

        gap-3

        rounded-xl

        px-3

        text-left
        text-[12px]
        font-semibold

        transition

        ${
          active

            ? `
              bg-white
              text-slate-950
              shadow-sm
            `

            : `
              text-slate-300

              hover:bg-white/[0.08]
              hover:text-white
            `
        }
      `}
    >

      <Icon
        size={16}
        strokeWidth={
          active
            ? 2.3
            : 1.8
        }
      />


      <span>
        {label}
      </span>

    </button>

  );

}


// ============================================================
// PLACEHOLDER
// ============================================================

function AdminPlaceholder({

  title,

  description,

}: {

  title:
    string;

  description:
    string;

}) {

  return (

    <section
      className="
        gos-panel
        !p-4
      "
    >

      <div className="max-w-2xl">

        <p
          className="
            text-[9px]
            font-semibold
            uppercase
            tracking-[0.16em]

            text-violet-600
          "
        >
          Admin
        </p>


        <h2
          className="
            mt-1

            text-[15px]
            font-semibold
            tracking-[-0.03em]

            text-slate-950
          "
        >
          {title}
        </h2>


        <p
          className="
            mt-1.5

            text-[11px]
            leading-5

            text-slate-500
          "
        >
          {description}
        </p>


        <span
          className="
            mt-3
            inline-flex

            rounded-full

            bg-slate-100

            px-2.5
            py-1

            text-[9px]
            font-semibold

            text-slate-500
          "
        >
          Admin shell ready
        </span>

      </div>

    </section>

  );

}


// ============================================================
// HEADER CONTENT
// ============================================================

function getAdminTitle(
  activeTab:
    AdminTab
) {

  const titles:
    Record<
      AdminTab,
      string
    > = {

    Overview:
      'Platform Overview',

    Clients:
      'Clients',

    Plans:
      'Plans',

    Modules:
      'Modules',

    Users:
      'Users & Access',

    Integrations:
      'Integrations',

    'Data Operations':
      'Data Operations',

    'Sync History':
      'Sync History',

    System:
      'System',

  };


  return titles[
    activeTab
  ];

}


function getAdminSubtitle(
  activeTab:
    AdminTab
) {

  const subtitles:
    Record<
      AdminTab,
      string
    > = {

    Overview:
      'Manage Growth OS clients, modules, plans and platform operations.',

    Clients:
      'Create, configure and manage client workspaces.',

    Plans:
      'Define plan-level module entitlement and access.',

    Modules:
      'Manage standard modules, custom modules and client assignments.',

    Users:
      'Manage platform users, client users, roles and permissions.',

    Integrations:
      'Review and manage client integration setup and status.',

    'Data Operations':
      'Monitor data ingestion, processing and operational health.',

    'Sync History':
      'Review ingestion runs, failures, processing volume and retry history.',

    System:
      'Manage platform-level configuration and infrastructure controls.',

  };


  return subtitles[
    activeTab
  ];

}