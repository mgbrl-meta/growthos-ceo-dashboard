'use client';

import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ArrowLeft,
  Building2,
  ChevronRight,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  XCircle,
} from 'lucide-react';


// ============================================================
// TYPES
// ============================================================

type UserStatus =
  | 'active'
  | 'inactive'
  | 'suspended';


type MembershipStatus =
  | 'active'
  | 'inactive';


type MembershipRole =
  | 'owner'
  | 'admin'
  | 'analyst'
  | 'viewer';


type AdminUserMembership = {

  membershipId:
    string;

  workspaceId:
    string;

  workspaceName:
    string | null;

  brandId:
    string;

  brandName:
    string | null;

  role:
    MembershipRole;

  status:
    MembershipStatus;

  isDefault:
    boolean;

  createdAt:
    string | null;

  updatedAt:
    string | null;

};


type AdminUser = {

  userId:
    string;

  email:
    string | null;

  fullName:
    string | null;

  status:
    UserStatus | null;

  createdAt:
    string | null;

  updatedAt:
    string | null;

  lastLoginAt:
    string | null;

  memberships:
    AdminUserMembership[];

};


type AdminUsersResponse = {

  ok:
    boolean;

  scope?:
    string;

  summary?: {

    totalUsers:
      number;

    activeUsers:
      number;

    inactiveUsers:
      number;

    suspendedUsers:
      number;

    memberships:
      number;

    activeMemberships:
      number;

    clients:
      number;

  };

  users?:
    AdminUser[];

  meta?: {

    durationMs?:
      number;

    source?:
      string;

    readOnly?:
      boolean;

  };

  error?:
    string;

};


// ============================================================
// FILTER TYPES
// ============================================================

type UserStatusFilter =
  | 'all'
  | UserStatus;


type RoleFilter =
  | 'all'
  | MembershipRole;


// ============================================================
// MAIN
// ============================================================

export default function AdminUsers() {


  // ==========================================================
  // SERVER DATA
  // ==========================================================

  const [
    data,
    setData,
  ] =
    useState<
      AdminUsersResponse |
      null
    >(
      null
    );


  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );


  const [
    error,
    setError,
  ] =
    useState<
      string |
      null
    >(
      null
    );


  // ==========================================================
  // FILTERS
  // ==========================================================

  const [
    search,
    setSearch,
  ] =
    useState(
      ''
    );


  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState<UserStatusFilter>(
      'all'
    );


  const [
    clientFilter,
    setClientFilter,
  ] =
    useState(
      'all'
    );


  const [
    roleFilter,
    setRoleFilter,
  ] =
    useState<RoleFilter>(
      'all'
    );


  const [
    selectedUserId,
    setSelectedUserId,
  ] =
    useState<
      string |
      null
    >(
      null
    );


  // ==========================================================
  // LOAD
  // ==========================================================

  async function loadUsers() {

    setLoading(
      true
    );


    setError(
      null
    );


    try {

      const response =
        await fetch(
          '/api/admin/users',
          {

            cache:
              'no-store',

            credentials:
              'same-origin',

          }
        );


      const json:
        AdminUsersResponse =
          await response.json();


      if (
        !response.ok
        ||
        !json.ok
      ) {

        throw new Error(
          json.error
          ||
          'Unable to load Admin Users'
        );

      }


      setData(
        json
      );

    } catch (
      error: any
    ) {

      console.error(
        'ADMIN_USERS_UI_ERROR',
        error
      );


      setData(
        null
      );


      setError(
        String(
          error?.message
          ||
          'Unable to load Admin Users'
        )
      );

    } finally {

      setLoading(
        false
      );

    }

  }


  useEffect(
    () => {

      loadUsers();

    },
    []
  );


  // ==========================================================
  // USERS
  // ==========================================================

  const users =
    data?.users
    ||
    [];


  // ==========================================================
  // CLIENT OPTIONS
  // ==========================================================

  const clients =
    useMemo(
      () => {

        const map =
          new Map<
            string,
            string
          >();


        users.forEach(
          user => {

            user.memberships.forEach(
              membership => {

                const key =
                  getMembershipClientKey(
                    membership
                  );


                const label =
                  getMembershipClientName(
                    membership
                  );


                map.set(
                  key,
                  label
                );

              }
            );

          }
        );


        return Array
          .from(
            map.entries()
          )
          .map(
            (
              [
                value,
                label,
              ]
            ) => ({

              value,

              label,

            })
          )
          .sort(
            (
              a,
              b
            ) =>
              a.label.localeCompare(
                b.label
              )
          );

      },
      [
        users,
      ]
    );


  // ==========================================================
  // FILTERED USERS
  // ==========================================================

  const filteredUsers =
    useMemo(
      () => {

        const query =
          search
            .trim()
            .toLowerCase();


        return users.filter(
          user => {


            // --------------------------------------------------
            // USER STATUS
            // --------------------------------------------------

            if (
              statusFilter !==
                'all'
              &&
              user.status !==
                statusFilter
            ) {

              return false;

            }


            // --------------------------------------------------
            // CLIENT
            // --------------------------------------------------

            if (
              clientFilter !==
                'all'
              &&
              !user.memberships.some(
                membership =>
                  getMembershipClientKey(
                    membership
                  ) ===
                  clientFilter
              )
            ) {

              return false;

            }


            // --------------------------------------------------
            // ROLE
            // --------------------------------------------------

            if (
              roleFilter !==
                'all'
              &&
              !user.memberships.some(
                membership =>
                  membership.role ===
                  roleFilter
              )
            ) {

              return false;

            }


            // --------------------------------------------------
            // SEARCH
            // --------------------------------------------------

            if (!query) {

              return true;

            }


            const membershipText =
              user.memberships
                .map(
                  membership =>
                    [

                      membership.workspaceId,
                      membership.workspaceName,
                      membership.brandId,
                      membership.brandName,
                      membership.role,
                      membership.status,

                    ]
                      .filter(
                        Boolean
                      )
                      .join(
                        ' '
                      )
                )
                .join(
                  ' '
                );


            const haystack =
              [

                user.userId,
                user.email,
                user.fullName,
                user.status,
                membershipText,

              ]
                .filter(
                  Boolean
                )
                .join(
                  ' '
                )
                .toLowerCase();


            return haystack.includes(
              query
            );

          }
        );

      },
      [
        users,
        search,
        statusFilter,
        clientFilter,
        roleFilter,
      ]
    );


  // ==========================================================
  // SUMMARY
  // ==========================================================

  const summary =
    data?.summary
    ||
    {

      totalUsers:
        users.length,

      activeUsers:
        users.filter(
          user =>
            user.status ===
            'active'
        ).length,

      inactiveUsers:
        users.filter(
          user =>
            user.status ===
            'inactive'
        ).length,

      suspendedUsers:
        users.filter(
          user =>
            user.status ===
            'suspended'
        ).length,

      memberships:
        users.reduce(
          (
            total,
            user
          ) =>
            total
            +
            user.memberships.length,
          0
        ),

      activeMemberships:
        users.reduce(
          (
            total,
            user
          ) =>
            total
            +
            user.memberships.filter(
              membership =>
                membership.status ===
                'active'
            ).length,
          0
        ),

      clients:
        clients.length,

    };


  // ==========================================================
  // SELECTED USER
  // ==========================================================

  const selectedUser =
    users.find(
      user =>
        user.userId ===
        selectedUserId
    )
    ||
    null;


  // ==========================================================
  // LOADING
  // ==========================================================

  if (
    loading
    &&
    !data
  ) {

    return (

      <section className="gos-panel !p-4">

        <p
          className="
            text-[10px]

            text-slate-500
          "
        >
          Loading Users...
        </p>

      </section>

    );

  }


  // ==========================================================
  // ERROR
  // ==========================================================

  if (
    error
    &&
    !data
  ) {

    return (

      <section
        className="
          rounded-[10px]

          border
          border-red-200

          bg-red-50

          p-4
        "
      >

        <div
          className="
            flex
            items-start
            justify-between
            gap-3
          "
        >

          <div
            className="
              flex
              items-start
              gap-2
            "
          >

            <XCircle
              size={15}
              className="
                mt-0.5
                shrink-0

                text-red-600
              "
            />


            <div>

              <p
                className="
                  text-[10px]
                  font-semibold

                  text-red-800
                "
              >
                Unable to load Users
              </p>


              <p
                className="
                  mt-1

                  text-[9px]

                  text-red-700
                "
              >
                {error}
              </p>

            </div>

          </div>


          <button

            type="button"

            onClick={
              loadUsers
            }

            className="
              h-7

              rounded-[7px]

              border
              border-red-200

              bg-white

              px-2.5

              text-[9px]
              font-semibold

              text-red-700
            "
          >
            Retry
          </button>

        </div>

      </section>

    );

  }


  // ==========================================================
  // DETAIL
  // ==========================================================

  if (
    selectedUser
  ) {

    return (

      <UserDetail

        user={
          selectedUser
        }

        onBack={() =>
          setSelectedUserId(
            null
          )
        }

      />

    );

  }


  // ==========================================================
  // LIST
  // ==========================================================

  return (

    <div className="space-y-3">


      {/* =====================================================
          HEADER
      ===================================================== */}

      <section
        className="
          gos-card

          flex
          flex-col
          gap-3

          p-3

          xl:flex-row
          xl:items-center
          xl:justify-between
        "
      >

        <div>

          <h2
            className="
              text-[14px]
              font-semibold
              tracking-[-0.025em]

              text-slate-950
            "
          >
            Users & Access
          </h2>


          <p
            className="
              mt-0.5

              text-[10px]

              text-slate-500
            "
          >
            Global Growth OS user registry with workspace, brand, role and membership access.
          </p>

        </div>


        <button

          type="button"

          onClick={
            loadUsers
          }

          disabled={
            loading
          }

          className="
            inline-flex
            h-8
            items-center
            gap-1.5

            rounded-[8px]

            border
            border-slate-200

            bg-white

            px-3

            text-[9px]
            font-semibold

            text-slate-700

            hover:bg-slate-50

            disabled:opacity-60
          "
        >

          <RefreshCw
            size={12}

            className={
              loading
                ? 'animate-spin'
                : ''
            }
          />

          Refresh

        </button>

      </section>


      {/* =====================================================
          SUMMARY
      ===================================================== */}

      <section
        className="
          grid
          grid-cols-2
          gap-2

          md:grid-cols-4
          xl:grid-cols-7
        "
      >

        <SummaryCard
          label="Users"
          value={
            summary.totalUsers
          }
        />


        <SummaryCard
          label="Active"
          value={
            summary.activeUsers
          }
          tone="green"
        />


        <SummaryCard
          label="Inactive"
          value={
            summary.inactiveUsers
          }
          tone="slate"
        />


        <SummaryCard
          label="Suspended"
          value={
            summary.suspendedUsers
          }
          tone="red"
        />


        <SummaryCard
          label="Memberships"
          value={
            summary.memberships
          }
          tone="violet"
        />


        <SummaryCard
          label="Active Access"
          value={
            summary.activeMemberships
          }
          tone="green"
        />


        <SummaryCard
          label="Clients"
          value={
            summary.clients
          }
        />

      </section>


      {/* =====================================================
          FILTERS
      ===================================================== */}

      <section
        className="
          gos-panel

          flex
          flex-col
          gap-2

          !p-3

          xl:flex-row
          xl:items-center
        "
      >

        <div
          className="
            relative

            w-full

            xl:max-w-[340px]
          "
        >

          <Search
            size={14}

            className="
              absolute
              left-2.5
              top-1/2

              -translate-y-1/2

              text-slate-400
            "
          />


          <input

            value={
              search
            }

            onChange={
              event =>
                setSearch(
                  event.target.value
                )
            }

            placeholder="Search name, email, client, role..."

            className="
              h-8
              w-full

              rounded-[8px]

              border
              border-slate-300

              bg-white

              pl-8
              pr-3

              text-[10px]

              outline-none

              focus:border-violet-400
              focus:ring-2
              focus:ring-violet-100
            "

          />

        </div>


        <select

          value={
            statusFilter
          }

          onChange={
            event =>
              setStatusFilter(
                event.target.value as UserStatusFilter
              )
          }

          className="gos-input"
        >

          <option value="all">
            All User Status
          </option>

          <option value="active">
            Active
          </option>

          <option value="inactive">
            Inactive
          </option>

          <option value="suspended">
            Suspended
          </option>

        </select>


        <select

          value={
            clientFilter
          }

          onChange={
            event =>
              setClientFilter(
                event.target.value
              )
          }

          className="gos-input"
        >

          <option value="all">
            All Clients
          </option>


          {clients.map(
            client => (

              <option

                key={
                  client.value
                }

                value={
                  client.value
                }

              >
                {client.label}
              </option>

            )
          )}

        </select>


        <select

          value={
            roleFilter
          }

          onChange={
            event =>
              setRoleFilter(
                event.target.value as RoleFilter
              )
          }

          className="gos-input"
        >

          <option value="all">
            All Roles
          </option>

          <option value="owner">
            Owner
          </option>

          <option value="admin">
            Admin
          </option>

          <option value="analyst">
            Analyst
          </option>

          <option value="viewer">
            Viewer
          </option>

        </select>


        <div
          className="
            ml-auto

            whitespace-nowrap

            text-[9px]

            text-slate-500
          "
        >
          {filteredUsers.length}
          {' / '}
          {users.length}
          {' users'}
        </div>

      </section>


      {/* =====================================================
          USER TABLE
      ===================================================== */}

      <section className="gos-panel !p-0">

        <div
          className="
            flex
            items-center
            justify-between

            border-b
            border-slate-200

            px-3
            py-2.5
          "
        >

          <div>

            <h3 className="gos-section-title">
              Growth OS Users
            </h3>


            <p
              className="
                mt-0.5

                text-[9px]

                text-slate-500
              "
            >
              One row per Growth OS identity. Brand access is represented through memberships.
            </p>

          </div>


          {(
            search
            ||
            statusFilter !==
              'all'
            ||
            clientFilter !==
              'all'
            ||
            roleFilter !==
              'all'
          ) && (

            <button

              type="button"

              onClick={() => {

                setSearch(
                  ''
                );

                setStatusFilter(
                  'all'
                );

                setClientFilter(
                  'all'
                );

                setRoleFilter(
                  'all'
                );

              }}

              className="
                text-[9px]
                font-semibold

                text-violet-600
              "
            >
              Clear filters
            </button>

          )}

        </div>


        <div className="overflow-x-auto">

          <table
            className="
              w-full
              min-w-[1200px]

              border-collapse
            "
          >

            <thead>

              <tr
                className="
                  border-b
                  border-slate-200

                  bg-slate-50
                "
              >

                <TableHeader>
                  User
                </TableHeader>

                <TableHeader>
                  Status
                </TableHeader>

                <TableHeader>
                  Memberships
                </TableHeader>

                <TableHeader>
                  Clients
                </TableHeader>

                <TableHeader>
                  Roles
                </TableHeader>

                <TableHeader>
                  Default
                </TableHeader>

                <TableHeader>
                  Last Login
                </TableHeader>

                <TableHeader>
                  Created
                </TableHeader>

                <TableHeader align="right">
                  Action
                </TableHeader>

              </tr>

            </thead>


            <tbody>

              {filteredUsers.map(
                user => {

                  const activeMemberships =
                    user.memberships.filter(
                      membership =>
                        membership.status ===
                        'active'
                    );


                  const roles =
                    Array.from(
                      new Set(
                        activeMemberships.map(
                          membership =>
                            membership.role
                        )
                      )
                    );


                  const defaultMembership =
                    user.memberships.find(
                      membership =>
                        membership.isDefault
                    );


                  return (

                    <tr

                      key={
                        user.userId
                      }

                      className="
                        border-b
                        border-slate-100

                        last:border-0

                        hover:bg-slate-50/70
                      "
                    >


                      {/* USER */}

                      <td className="px-3 py-2.5">

                        <div
                          className="
                            flex
                            items-center
                            gap-2.5
                          "
                        >

                          <div
                            className="
                              flex
                              h-8
                              w-8
                              shrink-0
                              items-center
                              justify-center

                              rounded-[8px]

                              bg-violet-50

                              text-violet-600
                            "
                          >
                            <UserRound
                              size={15}
                            />
                          </div>


                          <div className="min-w-0">

                            <div
                              className="
                                max-w-[240px]

                                truncate

                                text-[10px]
                                font-semibold

                                text-slate-900
                              "
                            >
                              {getUserDisplayName(
                                user
                              )}
                            </div>


                            <div
                              className="
                                mt-0.5
                                max-w-[260px]

                                truncate

                                text-[9px]

                                text-slate-500
                              "
                            >
                              {user.email
                                ||
                                user.userId}
                            </div>

                          </div>

                        </div>

                      </td>


                      {/* STATUS */}

                      <td className="px-3 py-2.5">

                        <UserStatusBadge
                          status={
                            user.status
                          }
                        />

                      </td>


                      {/* MEMBERSHIPS */}

                      <td
                        className="
                          px-3
                          py-2.5

                          text-[10px]
                          font-semibold

                          text-slate-800
                        "
                      >
                        {user.memberships.length}
                      </td>


                      {/* CLIENTS */}

                      <td className="px-3 py-2.5">

                        <div
                          className="
                            max-w-[260px]

                            text-[9px]

                            text-slate-600
                          "
                        >
                          {formatMembershipClients(
                            user.memberships
                          )}
                        </div>

                      </td>


                      {/* ROLES */}

                      <td className="px-3 py-2.5">

                        <div
                          className="
                            flex
                            flex-wrap
                            gap-1
                          "
                        >

                          {roles.length >
                            0 ? (

                            roles.map(
                              role => (

                                <RoleBadge

                                  key={
                                    role
                                  }

                                  role={
                                    role
                                  }

                                />

                              )
                            )

                          ) : (

                            <span
                              className="
                                text-[9px]

                                text-slate-400
                              "
                            >
                              —
                            </span>

                          )}

                        </div>

                      </td>


                      {/* DEFAULT */}

                      <td
                        className="
                          px-3
                          py-2.5

                          text-[9px]

                          text-slate-600
                        "
                      >
                        {defaultMembership

                          ? getMembershipClientName(
                              defaultMembership
                            )

                          : '—'}
                      </td>


                      {/* LAST LOGIN */}

                      <td
                        className="
                          px-3
                          py-2.5

                          text-[9px]

                          text-slate-500
                        "
                      >
                        {formatTimestamp(
                          user.lastLoginAt
                        )
                        ||
                        'Never'}
                      </td>


                      {/* CREATED */}

                      <td
                        className="
                          px-3
                          py-2.5

                          text-[9px]

                          text-slate-500
                        "
                      >
                        {formatTimestamp(
                          user.createdAt
                        )
                        ||
                        '—'}
                      </td>


                      {/* ACTION */}

                      <td className="px-3 py-2.5 text-right">

                        <button

                          type="button"

                          onClick={() =>
                            setSelectedUserId(
                              user.userId
                            )
                          }

                          className="
                            inline-flex
                            h-7
                            items-center
                            gap-1

                            rounded-[7px]

                            border
                            border-slate-200

                            bg-white

                            px-2.5

                            text-[9px]
                            font-semibold

                            text-slate-700

                            hover:bg-slate-50
                          "
                        >

                          Inspect

                          <ChevronRight
                            size={12}
                          />

                        </button>

                      </td>

                    </tr>

                  );

                }
              )}


              {filteredUsers.length ===
                0 && (

                <tr>

                  <td

                    colSpan={
                      9
                    }

                    className="
                      px-4
                      py-14

                      text-center

                      text-[10px]

                      text-slate-500
                    "
                  >
                    No users match the selected filters.
                  </td>

                </tr>

              )}

            </tbody>

          </table>

        </div>

      </section>


      {/* =====================================================
          SOURCE
      ===================================================== */}

      <section
        className="
          rounded-[9px]

          border
          border-violet-200

          bg-violet-50

          px-3
          py-2.5
        "
      >

        <p
          className="
            text-[8px]
            leading-4

            text-violet-700
          "
        >
          Source of truth: growthos_control.users and growthos_control.brand_memberships. Admin Users is read-only; workspace access management remains under the relevant client's Settings → Users & Access.
        </p>


        {data?.meta?.durationMs !==
          undefined && (

          <p
            className="
              mt-1

              text-[8px]

              text-violet-500
            "
          >
            API runtime: {formatNumber(
              data.meta.durationMs
            )} ms
          </p>

        )}

      </section>

    </div>

  );

}


// ============================================================
// USER DETAIL
// ============================================================

function UserDetail({

  user,

  onBack,

}: {

  user:
    AdminUser;

  onBack:
    () => void;

}) {


  const defaultMembership =
    user.memberships.find(
      membership =>
        membership.isDefault
    )
    ||
    null;


  const activeMemberships =
    user.memberships.filter(
      membership =>
        membership.status ===
        'active'
    ).length;


  return (

    <div className="space-y-3">


      {/* =====================================================
          HEADER
      ===================================================== */}

      <section className="gos-panel !p-3">

        <div
          className="
            flex
            flex-col
            gap-3

            md:flex-row
            md:items-center
            md:justify-between
          "
        >

          <div
            className="
              flex
              items-center
              gap-3
            "
          >

            <button

              type="button"

              onClick={
                onBack
              }

              className="
                flex
                h-8
                w-8
                shrink-0
                items-center
                justify-center

                rounded-[8px]

                border
                border-slate-200

                bg-white

                hover:bg-slate-50
              "
            >
              <ArrowLeft
                size={14}
              />
            </button>


            <div
              className="
                flex
                h-9
                w-9
                shrink-0
                items-center
                justify-center

                rounded-[9px]

                bg-violet-50

                text-violet-600
              "
            >
              <ShieldCheck
                size={17}
              />
            </div>


            <div className="min-w-0">

              <div
                className="
                  flex
                  flex-wrap
                  items-center
                  gap-2
                "
              >

                <h2
                  className="
                    text-[15px]
                    font-semibold

                    text-slate-950
                  "
                >
                  {getUserDisplayName(
                    user
                  )}
                </h2>


                <UserStatusBadge
                  status={
                    user.status
                  }
                />

              </div>


              <p
                className="
                  mt-0.5

                  text-[9px]

                  text-slate-500
                "
              >
                {user.email
                  ||
                  user.userId}
              </p>

            </div>

          </div>


          <span
            className="
              rounded-full

              border
              border-slate-200

              bg-slate-50

              px-2.5
              py-1

              text-[8px]
              font-semibold

              text-slate-500
            "
          >
            Read Only
          </span>

        </div>

      </section>


      {/* =====================================================
          SUMMARY
      ===================================================== */}

      <section
        className="
          grid
          grid-cols-2
          gap-2

          md:grid-cols-4
        "
      >

        <SummaryCard
          label="Status"
          value={
            formatUserStatus(
              user.status
            )
          }
        />


        <SummaryCard
          label="Memberships"
          value={
            user.memberships.length
          }
          tone="violet"
        />


        <SummaryCard
          label="Active Access"
          value={
            activeMemberships
          }
          tone="green"
        />


        <SummaryCard
          label="Default Brand"
          value={
            defaultMembership

              ? getMembershipClientName(
                  defaultMembership
                )

              : 'None'
          }
        />

      </section>


      {/* =====================================================
          IDENTITY
      ===================================================== */}

      <section
        className="
          grid
          grid-cols-1
          gap-3

          lg:grid-cols-2
        "
      >

        <section className="gos-panel !p-3.5">

          <h3 className="gos-section-title">
            Identity
          </h3>


          <div className="mt-3 space-y-2">

            <ValueRow
              label="User ID"
              value={
                user.userId
              }
              mono
            />


            <ValueRow
              label="Full Name"
              value={
                user.fullName
                ||
                '—'
              }
            />


            <ValueRow
              label="Email"
              value={
                user.email
                ||
                '—'
              }
            />


            <ValueRow
              label="User Status"
              value={
                formatUserStatus(
                  user.status
                )
              }
            />

          </div>

        </section>


        <section className="gos-panel !p-3.5">

          <h3 className="gos-section-title">
            Lifecycle
          </h3>


          <div className="mt-3 space-y-2">

            <ValueRow
              label="Created"
              value={
                formatTimestamp(
                  user.createdAt
                )
                ||
                '—'
              }
            />


            <ValueRow
              label="Updated"
              value={
                formatTimestamp(
                  user.updatedAt
                )
                ||
                '—'
              }
            />


            <ValueRow
              label="Last Login"
              value={
                formatTimestamp(
                  user.lastLoginAt
                )
                ||
                'Never'
              }
            />

          </div>

        </section>

      </section>


      {/* =====================================================
          MEMBERSHIPS
      ===================================================== */}

      <section className="gos-panel !p-0">

        <div
          className="
            border-b
            border-slate-200

            px-3
            py-2.5
          "
        >

          <h3 className="gos-section-title">
            Brand Memberships
          </h3>


          <p
            className="
              mt-0.5

              text-[9px]

              text-slate-500
            "
          >
            All workspace and brand access assigned to this Growth OS identity.
          </p>

        </div>


        <div className="overflow-x-auto">

          <table
            className="
              w-full
              min-w-[1000px]

              border-collapse
            "
          >

            <thead>

              <tr
                className="
                  border-b
                  border-slate-200

                  bg-slate-50
                "
              >

                <TableHeader>
                  Brand
                </TableHeader>

                <TableHeader>
                  Workspace
                </TableHeader>

                <TableHeader>
                  Role
                </TableHeader>

                <TableHeader>
                  Status
                </TableHeader>

                <TableHeader>
                  Default
                </TableHeader>

                <TableHeader>
                  Created
                </TableHeader>

                <TableHeader>
                  Updated
                </TableHeader>

              </tr>

            </thead>


            <tbody>

              {user.memberships.map(
                membership => (

                  <tr

                    key={
                      membership.membershipId
                    }

                    className="
                      border-b
                      border-slate-100

                      last:border-0
                    "
                  >


                    <td className="px-3 py-2.5">

                      <div
                        className="
                          flex
                          items-center
                          gap-2
                        "
                      >

                        <div
                          className="
                            flex
                            h-7
                            w-7
                            shrink-0
                            items-center
                            justify-center

                            rounded-[7px]

                            bg-blue-50

                            text-blue-600
                          "
                        >
                          <Building2
                            size={13}
                          />
                        </div>


                        <div>

                          <div
                            className="
                              text-[10px]
                              font-semibold

                              text-slate-900
                            "
                          >
                            {getMembershipClientName(
                              membership
                            )}
                          </div>


                          <div
                            className="
                              mt-0.5

                              font-mono
                              text-[8px]

                              text-slate-500
                            "
                          >
                            {membership.brandId}
                          </div>

                        </div>

                      </div>

                    </td>


                    <td
                      className="
                        px-3
                        py-2.5

                        font-mono
                        text-[8px]

                        text-slate-500
                      "
                    >
                      {membership.workspaceId}
                    </td>


                    <td className="px-3 py-2.5">

                      <RoleBadge
                        role={
                          membership.role
                        }
                      />

                    </td>


                    <td className="px-3 py-2.5">

                      <MembershipStatusBadge
                        status={
                          membership.status
                        }
                      />

                    </td>


                    <td
                      className="
                        px-3
                        py-2.5

                        text-[9px]
                        font-semibold

                        text-slate-600
                      "
                    >
                      {membership.isDefault
                        ? 'Yes'
                        : '—'}
                    </td>


                    <td
                      className="
                        px-3
                        py-2.5

                        text-[9px]

                        text-slate-500
                      "
                    >
                      {formatTimestamp(
                        membership.createdAt
                      )
                      ||
                      '—'}
                    </td>


                    <td
                      className="
                        px-3
                        py-2.5

                        text-[9px]

                        text-slate-500
                      "
                    >
                      {formatTimestamp(
                        membership.updatedAt
                      )
                      ||
                      '—'}
                    </td>

                  </tr>

                )
              )}


              {user.memberships.length ===
                0 && (

                <tr>

                  <td

                    colSpan={
                      7
                    }

                    className="
                      px-4
                      py-12

                      text-center

                      text-[10px]

                      text-slate-500
                    "
                  >
                    This user currently has no brand memberships.
                  </td>

                </tr>

              )}

            </tbody>

          </table>

        </div>

      </section>


      {/* =====================================================
          OWNERSHIP
      ===================================================== */}

      <section
        className="
          rounded-[10px]

          border
          border-violet-200

          bg-violet-50

          p-3
        "
      >

        <p
          className="
            text-[9px]
            font-semibold

            text-violet-800
          "
        >
          Access ownership
        </p>


        <p
          className="
            mt-1

            text-[8px]
            leading-4

            text-violet-600
          "
        >
          Admin Users provides global visibility into Growth OS identities and brand memberships. User creation and membership changes should use a dedicated authenticated access-management flow rather than local frontend state.
        </p>

      </section>

    </div>

  );

}


// ============================================================
// SUMMARY CARD
// ============================================================

function SummaryCard({

  label,

  value,

  tone =
    'default',

}: {

  label:
    string;

  value:
    string |
    number;

  tone?:
    | 'default'
    | 'green'
    | 'red'
    | 'violet'
    | 'slate';

}) {


  const cls =
    tone ===
      'green'

      ? 'text-emerald-700'

      : tone ===
          'red'

        ? 'text-red-700'

        : tone ===
            'violet'

          ? 'text-violet-700'

          : tone ===
              'slate'

            ? 'text-slate-500'

            : 'text-slate-950';


  return (

    <div
      className="
        gos-card

        min-h-[66px]

        px-3
        py-2.5
      "
    >

      <p className="gos-label">
        {label}
      </p>


      <p
        className={`
          mt-1.5

          truncate

          text-[18px]
          font-semibold
          tracking-[-0.03em]

          ${cls}
        `}
      >
        {value}
      </p>

    </div>

  );

}


// ============================================================
// USER STATUS BADGE
// ============================================================

function UserStatusBadge({

  status,

}: {

  status:
    UserStatus |
    null;

}) {


  if (
    status ===
    'active'
  ) {

    return (

      <span
        className="
          inline-flex

          rounded-full

          border
          border-emerald-200

          bg-emerald-50

          px-2
          py-0.5

          text-[8px]
          font-semibold

          text-emerald-700
        "
      >
        Active
      </span>

    );

  }


  if (
    status ===
    'suspended'
  ) {

    return (

      <span
        className="
          inline-flex

          rounded-full

          border
          border-red-200

          bg-red-50

          px-2
          py-0.5

          text-[8px]
          font-semibold

          text-red-700
        "
      >
        Suspended
      </span>

    );

  }


  return (

    <span
      className="
        inline-flex

        rounded-full

        border
        border-slate-200

        bg-slate-100

        px-2
        py-0.5

        text-[8px]
        font-semibold

        text-slate-600
      "
    >
      {status ===
        'inactive'

        ? 'Inactive'

        : 'Unknown'}
    </span>

  );

}


// ============================================================
// MEMBERSHIP STATUS BADGE
// ============================================================

function MembershipStatusBadge({

  status,

}: {

  status:
    MembershipStatus;

}) {

  return (

    <span
      className={`
        inline-flex

        rounded-full

        border

        px-2
        py-0.5

        text-[8px]
        font-semibold

        ${
          status ===
            'active'

            ? `
              border-emerald-200
              bg-emerald-50
              text-emerald-700
            `

            : `
              border-slate-200
              bg-slate-100
              text-slate-600
            `
        }
      `}
    >
      {status ===
        'active'

        ? 'Active'

        : 'Inactive'}
    </span>

  );

}


// ============================================================
// ROLE BADGE
// ============================================================

function RoleBadge({

  role,

}: {

  role:
    MembershipRole;

}) {


  const cls =
    role ===
      'owner'

      ? 'border-violet-200 bg-violet-50 text-violet-700'

      : role ===
          'admin'

        ? 'border-blue-200 bg-blue-50 text-blue-700'

        : 'border-slate-200 bg-slate-50 text-slate-600';


  return (

    <span
      className={`
        inline-flex

        rounded-full

        border

        px-2
        py-0.5

        text-[8px]
        font-semibold

        ${cls}
      `}
    >
      {formatRole(
        role
      )}
    </span>

  );

}


// ============================================================
// VALUE ROW
// ============================================================

function ValueRow({

  label,

  value,

  mono =
    false,

}: {

  label:
    string;

  value:
    string;

  mono?:
    boolean;

}) {

  return (

    <div
      className="
        flex
        min-h-[38px]
        items-center
        justify-between
        gap-3

        rounded-[8px]

        border
        border-slate-200

        bg-slate-50

        px-3
      "
    >

      <span
        className="
          shrink-0

          text-[9px]

          text-slate-500
        "
      >
        {label}
      </span>


      <span
        title={
          value
        }
        className={`
          max-w-[68%]

          truncate

          text-right
          text-[10px]
          font-semibold

          text-slate-800

          ${
            mono
              ? 'font-mono text-[8px]'
              : ''
          }
        `}
      >
        {value}
      </span>

    </div>

  );

}


// ============================================================
// TABLE HEADER
// ============================================================

function TableHeader({

  children,

  align =
    'left',

}: {

  children:
    ReactNode;

  align?:
    'left'
    |
    'right';

}) {

  return (

    <th
      className={`
        h-8

        px-3

        text-[8px]
        font-semibold
        uppercase
        tracking-[0.05em]

        text-slate-500

        ${
          align ===
            'right'

            ? 'text-right'

            : 'text-left'
        }
      `}
    >
      {children}
    </th>

  );

}


// ============================================================
// HELPERS
// ============================================================

function getUserDisplayName(
  user:
    AdminUser
) {

  return (
    user.fullName
    ||
    user.email
    ||
    user.userId
  );

}


function getMembershipClientKey(
  membership:
    AdminUserMembership
) {

  return [
    membership.workspaceId,
    membership.brandId,
  ].join(
    ':'
  );

}


function getMembershipClientName(
  membership:
    AdminUserMembership
) {

  return (
    membership.brandName
    ||
    membership.workspaceName
    ||
    membership.brandId
    ||
    membership.workspaceId
  );

}


function formatMembershipClients(
  memberships:
    AdminUserMembership[]
) {

  if (
    memberships.length ===
    0
  ) {

    return 'No access';

  }


  const names =
    Array.from(
      new Set(
        memberships.map(
          membership =>
            getMembershipClientName(
              membership
            )
        )
      )
    );


  if (
    names.length <=
    2
  ) {

    return names.join(
      ', '
    );

  }


  return `${names
    .slice(
      0,
      2
    )
    .join(
      ', '
    )} +${names.length - 2}`;

}


function formatRole(
  role:
    MembershipRole
) {

  const labels:
    Record<
      MembershipRole,
      string
    > = {

    owner:
      'Owner',

    admin:
      'Admin',

    analyst:
      'Analyst',

    viewer:
      'Viewer',

  };


  return labels[
    role
  ];

}


function formatUserStatus(
  status:
    UserStatus |
    null
) {

  if (!status) {

    return 'Unknown';

  }


  return status
    .charAt(
      0
    )
    .toUpperCase()
  +
  status.slice(
    1
  );

}


function formatTimestamp(
  value:
    string |
    null
) {

  if (!value) {

    return null;

  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return value;

  }


  return date.toLocaleString(
    'en-IN',
    {

      dateStyle:
        'medium',

      timeStyle:
        'short',

    }
  );

}


function formatNumber(
  value:
    number
) {

  return new Intl.NumberFormat(
    'en-IN',
    {
      maximumFractionDigits:
        0,
    }
  ).format(
    value
  );

}