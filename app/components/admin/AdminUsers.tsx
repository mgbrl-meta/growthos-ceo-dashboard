'use client';

import {
  type ReactNode,
  useMemo,
  useState,
} from 'react';

import {
  ArrowLeft,
  Building2,
  ChevronRight,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from 'lucide-react';

import {
  type AdminUser,
  type UserModulePermission,
  type UserRole,
  type UserScope,
  type UserStatus,
  useAdminStore,
} from './AdminStore';


// ============================================================
// ROLE CONFIG
// ============================================================

const CLIENT_ROLES: {
  value: UserRole;
  label: string;
  description: string;
}[] = [

  {
    value:
      'client_owner',

    label:
      'Owner',

    description:
      'Primary workspace owner with administrative responsibility.',
  },

  {
    value:
      'client_admin',

    label:
      'Admin',

    description:
      'Manages workspace users, configuration and operational access.',
  },

  {
    value:
      'manager',

    label:
      'Manager',

    description:
      'Manages day-to-day Growth OS workflows and assigned modules.',
  },

  {
    value:
      'analyst',

    label:
      'Analyst',

    description:
      'Analysis-focused access across assigned intelligence modules.',
  },

  {
    value:
      'operator',

    label:
      'Operator',

    description:
      'Operational access for execution-focused workflows.',
  },

  {
    value:
      'viewer',

    label:
      'Viewer',

    description:
      'Read-oriented access with limited operational control.',
  },

];


// ============================================================
// MAIN
// ============================================================

export default function AdminUsers() {


  // ==========================================================
  // SHARED STORE
  // ==========================================================

  const {
    users,
    setUsers,
    clients,
    plans,
    modules,
    getClient,
    getPlan,
    getClientUserCount,
    getUserModuleAccess,
  } =
    useAdminStore();


  // ==========================================================
  // LOCAL UI
  // ==========================================================

  const [
    search,
    setSearch,
  ] =
    useState(
      ''
    );


  const [
    scopeFilter,
    setScopeFilter,
  ] =
    useState<
      'all'
      |
      UserScope
    >(
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
    selectedUserId,
    setSelectedUserId,
  ] =
    useState<
      string |
      null
    >(
      null
    );


  const [
    addOpen,
    setAddOpen,
  ] =
    useState(
      false
    );


  // ==========================================================
  // ADD USER FORM
  // ==========================================================

  const [
    newName,
    setNewName,
  ] =
    useState(
      ''
    );


  const [
    newEmail,
    setNewEmail,
  ] =
    useState(
      ''
    );


  const [
    newScope,
    setNewScope,
  ] =
    useState<UserScope>(
      'client'
    );


  const [
    newClientId,
    setNewClientId,
  ] =
    useState(
      clients[0]?.id ||
      ''
    );


  const [
    newRole,
    setNewRole,
  ] =
    useState<UserRole>(
      'viewer'
    );


  const [
    newStatus,
    setNewStatus,
  ] =
    useState<UserStatus>(
      'invited'
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

            if (
              scopeFilter !==
                'all'
              &&
              user.scope !==
                scopeFilter
            ) {

              return false;

            }


            if (
              clientFilter !==
                'all'
              &&
              user.clientId !==
                clientFilter
            ) {

              return false;

            }


            if (!query) {

              return true;

            }


            const client =
              user.clientId
                ? getClient(
                    user.clientId
                  )
                : undefined;


            return (

              user.name
                .toLowerCase()
                .includes(
                  query
                )

              ||

              user.email
                .toLowerCase()
                .includes(
                  query
                )

              ||

              formatRole(
                user.role
              )
                .toLowerCase()
                .includes(
                  query
                )

              ||

              (
                client?.name ||
                ''
              )
                .toLowerCase()
                .includes(
                  query
                )

            );

          }
        );

      },
      [
        users,
        search,
        scopeFilter,
        clientFilter,
        clients,
      ]
    );


  // ==========================================================
  // SELECTED USER
  // ==========================================================

  const selectedUser =
    users.find(
      user =>
        user.id ===
        selectedUserId
    )
    ||
    null;


  // ==========================================================
  // ADD USER LIMIT
  // ==========================================================

  const selectedNewClient =
    newScope ===
      'client'

      ? getClient(
          newClientId
        )

      : undefined;


  const selectedNewPlan =
    selectedNewClient
      ? getPlan(
          selectedNewClient.planId
        )
      : undefined;


  const selectedNewClientUserCount =
    selectedNewClient
      ? getClientUserCount(
          selectedNewClient.id
        )
      : 0;


  const userLimit =
    selectedNewPlan
      ?.maxUsers
    ??
    null;


  const clientAtUserLimit =
    newScope ===
      'client'
    &&
    userLimit !==
      null
    &&
    selectedNewClientUserCount >=
      userLimit;


  // ==========================================================
  // CREATE USER
  // ==========================================================

  function createUser() {

    const name =
      newName.trim();


    const email =
      newEmail
        .trim()
        .toLowerCase();


    if (
      !name
      ||
      !email
    ) {

      return;

    }


    if (
      newScope ===
        'client'
      &&
      (
        !newClientId
        ||
        clientAtUserLimit
      )
    ) {

      return;

    }


    const idBase =
      email
        .replace(
          /[^a-z0-9]+/g,
          '-'
        )
        .replace(
          /^-|-$/g,
          ''
        );


    const user:
      AdminUser = {

      id:
        `${idBase}-${Date.now()}`,

      name,

      email,

      scope:
        newScope,

      clientId:
        newScope ===
          'client'

          ? newClientId

          : null,

      role:
        newScope ===
          'platform'

          ? 'platform_admin'

          : newRole,

      status:
        newStatus,

      modulePermissions:
        {},

      createdAt:
        new Date()
          .toLocaleDateString(
            'en-IN',
            {
              day:
                '2-digit',

              month:
                'short',

              year:
                'numeric',
            }
          ),

    };


    setUsers(
      previous => [
        user,
        ...previous,
      ]
    );


    resetForm();


    setAddOpen(
      false
    );


    setSelectedUserId(
      user.id
    );

  }


  // ==========================================================
  // RESET
  // ==========================================================

  function resetForm() {

    setNewName(
      ''
    );


    setNewEmail(
      ''
    );


    setNewScope(
      'client'
    );


    setNewClientId(
      clients[0]?.id ||
      ''
    );


    setNewRole(
      'viewer'
    );


    setNewStatus(
      'invited'
    );

  }


  // ==========================================================
  // UPDATE USER
  // ==========================================================

  function updateUser(
    updatedUser:
      AdminUser
  ) {

    setUsers(
      previous =>
        previous.map(
          user =>

            user.id ===
              updatedUser.id

              ? updatedUser

              : user
        )
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

        onChange={
          updateUser
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
          TOOLBAR
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
            Manage platform administrators, client users, roles and module-level access.
          </p>

        </div>


        <div
          className="
            flex
            flex-col
            gap-2

            sm:flex-row
            sm:flex-wrap
          "
        >

          <div
            className="
              relative

              w-full

              sm:w-[230px]
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

              placeholder="Search users"

              className="
                h-8
                w-full

                rounded-[8px]

                border
                border-slate-300

                bg-white

                pl-8
                pr-3

                text-[11px]

                outline-none

                focus:border-violet-400
                focus:ring-2
                focus:ring-violet-100
              "

            />

          </div>


          <select

            value={
              scopeFilter
            }

            onChange={
              event =>
                setScopeFilter(
                  event.target.value as
                    'all'
                    |
                    UserScope
                )
            }

            className="
              h-8

              rounded-[8px]

              border
              border-slate-300

              bg-white

              px-2.5

              text-[10px]
              font-medium

              text-slate-700
            "
          >

            <option value="all">
              All Scopes
            </option>

            <option value="platform">
              Platform
            </option>

            <option value="client">
              Client
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

            className="
              h-8

              rounded-[8px]

              border
              border-slate-300

              bg-white

              px-2.5

              text-[10px]
              font-medium

              text-slate-700
            "
          >

            <option value="all">
              All Clients
            </option>


            {clients.map(
              client => (

                <option
                  key={
                    client.id
                  }
                  value={
                    client.id
                  }
                >
                  {client.name}
                </option>

              )
            )}

          </select>


          <button

            type="button"

            onClick={() => {

              setNewClientId(
                clients[0]?.id ||
                ''
              );


              setAddOpen(
                true
              );

            }}

            className="
              inline-flex
              h-8
              items-center
              justify-center
              gap-1.5

              rounded-[8px]

              bg-slate-950

              px-3

              text-[10px]
              font-semibold

              text-white

              hover:bg-slate-800
            "
          >

            <Plus
              size={14}
            />

            Add User

          </button>

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
          label="Total Users"
          value={
            users.length
          }
        />


        <SummaryCard
          label="Platform Admins"
          value={
            users.filter(
              user =>
                user.scope ===
                'platform'
            ).length
          }
        />


        <SummaryCard
          label="Client Users"
          value={
            users.filter(
              user =>
                user.scope ===
                'client'
            ).length
          }
        />


        <SummaryCard
          label="Active"
          value={
            users.filter(
              user =>
                user.status ===
                'active'
            ).length
          }
        />

      </section>


      {/* =====================================================
          USER TABLE
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
            Users
          </h3>


          <p
            className="
              mt-0.5

              text-[9px]

              text-slate-500
            "
          >
            {filteredUsers.length} user{filteredUsers.length === 1 ? '' : 's'}
          </p>

        </div>


        <div className="overflow-x-auto">

          <table
            className="
              min-w-[1000px]
              w-full

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
                  Scope
                </TableHeader>

                <TableHeader>
                  Client
                </TableHeader>

                <TableHeader>
                  Role
                </TableHeader>

                <TableHeader>
                  Status
                </TableHeader>

                <TableHeader>
                  Module Access
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

                  const client =
                    user.clientId
                      ? getClient(
                          user.clientId
                        )
                      : undefined;


                  const enabledModules =
                    modules.filter(
                      module =>
                        getUserModuleAccess(
                          user,
                          module.id
                        ).enabled
                    ).length;


                  return (

                    <tr

                      key={
                        user.id
                      }

                      className="
                        border-b
                        border-slate-100

                        last:border-0

                        hover:bg-slate-50/70
                      "
                    >

                      <td className="px-3 py-2">

                        <div
                          className="
                            flex
                            items-center
                            gap-2.5
                          "
                        >

                          <UserIcon
                            scope={
                              user.scope
                            }
                          />


                          <div className="min-w-0">

                            <div
                              className="
                                text-[11px]
                                font-semibold

                                text-slate-900
                              "
                            >
                              {user.name}
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
                              {user.email}
                            </div>

                          </div>

                        </div>

                      </td>


                      <td className="px-3 py-2">

                        <ScopeBadge
                          scope={
                            user.scope
                          }
                        />

                      </td>


                      <td
                        className="
                          px-3
                          py-2

                          text-[10px]
                          font-medium

                          text-slate-600
                        "
                      >
                        {client?.name ||
                          'Platform'}
                      </td>


                      <td
                        className="
                          px-3
                          py-2

                          text-[10px]
                          font-medium

                          text-slate-700
                        "
                      >
                        {formatRole(
                          user.role
                        )}
                      </td>


                      <td className="px-3 py-2">

                        <UserStatusBadge
                          status={
                            user.status
                          }
                        />

                      </td>


                      <td
                        className="
                          px-3
                          py-2

                          text-[10px]
                          font-semibold

                          text-slate-800
                        "
                      >
                        {enabledModules}
                      </td>


                      <td
                        className="
                          px-3
                          py-2

                          text-[9px]

                          text-slate-500
                        "
                      >
                        {user.createdAt}
                      </td>


                      <td className="px-3 py-2 text-right">

                        <button

                          type="button"

                          onClick={() =>
                            setSelectedUserId(
                              user.id
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

                          Manage

                          <ChevronRight
                            size={12}
                          />

                        </button>

                      </td>

                    </tr>

                  );

                }
              )}

            </tbody>

          </table>

        </div>

      </section>


      {/* =====================================================
          ADD USER MODAL
      ===================================================== */}

      {addOpen && (

        <div
          className="
            fixed
            inset-0
            z-[100]

            flex
            items-center
            justify-center

            bg-slate-950/40

            p-4

            backdrop-blur-[2px]
          "
        >

          <div
            className="
              w-full
              max-w-[580px]

              rounded-[14px]

              border
              border-slate-200

              bg-white

              shadow-xl
            "
          >

            <div
              className="
                flex
                items-center
                justify-between

                border-b
                border-slate-200

                px-4
                py-3
              "
            >

              <div>

                <h3
                  className="
                    text-[14px]
                    font-semibold

                    text-slate-950
                  "
                >
                  Add User
                </h3>


                <p
                  className="
                    mt-0.5

                    text-[9px]

                    text-slate-500
                  "
                >
                  Create platform or client-level Growth OS access.
                </p>

              </div>


              <button

                type="button"

                onClick={() => {

                  setAddOpen(
                    false
                  );


                  resetForm();

                }}

                className="
                  flex
                  h-7
                  w-7
                  items-center
                  justify-center

                  rounded-[7px]

                  text-slate-400

                  hover:bg-slate-100
                "
              >

                <X
                  size={15}
                />

              </button>

            </div>


            <div className="space-y-3 p-4">


              <div
                className="
                  grid
                  grid-cols-1
                  gap-3

                  md:grid-cols-2
                "
              >

                <FormField
                  label="Name"
                >

                  <input

                    value={
                      newName
                    }

                    onChange={
                      event =>
                        setNewName(
                          event.target.value
                        )
                    }

                    placeholder="User name"

                    className="gos-input w-full"

                  />

                </FormField>


                <FormField
                  label="Email"
                >

                  <input

                    type="email"

                    value={
                      newEmail
                    }

                    onChange={
                      event =>
                        setNewEmail(
                          event.target.value
                        )
                    }

                    placeholder="name@company.com"

                    className="gos-input w-full"

                  />

                </FormField>

              </div>


              <FormField
                label="Access Scope"
              >

                <select

                  value={
                    newScope
                  }

                  onChange={
                    event => {

                      const scope =
                        event.target.value as UserScope;


                      setNewScope(
                        scope
                      );


                      if (
                        scope ===
                        'platform'
                      ) {

                        setNewRole(
                          'platform_admin'
                        );

                      } else {

                        setNewRole(
                          'viewer'
                        );

                      }

                    }
                  }

                  className="gos-input w-full"

                >

                  <option value="client">
                    Client Workspace
                  </option>

                  <option value="platform">
                    Platform Admin
                  </option>

                </select>

              </FormField>


              {newScope ===
                'client' && (

                <>

                  <FormField
                    label="Client"
                  >

                    <select

                      value={
                        newClientId
                      }

                      onChange={
                        event =>
                          setNewClientId(
                            event.target.value
                          )
                      }

                      className="gos-input w-full"

                    >

                      {clients.map(
                        client => {

                          const plan =
                            getPlan(
                              client.planId
                            );


                          const count =
                            getClientUserCount(
                              client.id
                            );


                          const limit =
                            plan
                              ?.maxUsers
                            ??
                            null;


                          return (

                            <option
                              key={
                                client.id
                              }
                              value={
                                client.id
                              }
                            >
                              {client.name}
                              {' · '}
                              {count}/
                              {limit ===
                                null
                                ? '∞'
                                : limit}
                              {' users'}
                            </option>

                          );

                        }
                      )}

                    </select>

                  </FormField>


                  <FormField
                    label="Role"
                  >

                    <select

                      value={
                        newRole
                      }

                      onChange={
                        event =>
                          setNewRole(
                            event.target.value as UserRole
                          )
                      }

                      className="gos-input w-full"

                    >

                      {CLIENT_ROLES.map(
                        role => (

                          <option
                            key={
                              role.value
                            }
                            value={
                              role.value
                            }
                          >
                            {role.label}
                          </option>

                        )
                      )}

                    </select>

                  </FormField>

                </>

              )}


              <FormField
                label="Initial Status"
              >

                <select

                  value={
                    newStatus
                  }

                  onChange={
                    event =>
                      setNewStatus(
                        event.target.value as UserStatus
                      )
                  }

                  className="gos-input w-full"

                >

                  <option value="invited">
                    Invited
                  </option>

                  <option value="active">
                    Active
                  </option>

                  <option value="suspended">
                    Suspended
                  </option>

                </select>

              </FormField>


              {newScope ===
                'client'
                &&
                selectedNewClient && (

                <div
                  className={`
                    rounded-[9px]

                    border

                    px-3
                    py-2.5

                    ${
                      clientAtUserLimit

                        ? `
                          border-red-200
                          bg-red-50
                        `

                        : `
                          border-slate-200
                          bg-slate-50
                        `
                    }
                  `}
                >

                  <div
                    className="
                      flex
                      items-center
                      justify-between
                      gap-3
                    "
                  >

                    <div>

                      <p
                        className="
                          text-[10px]
                          font-semibold

                          text-slate-800
                        "
                      >
                        User allowance
                      </p>


                      <p
                        className="
                          mt-0.5

                          text-[9px]

                          text-slate-500
                        "
                      >
                        {selectedNewPlan?.name ||
                          'No Plan'}
                      </p>

                    </div>


                    <span
                      className={`
                        text-[11px]
                        font-semibold

                        ${
                          clientAtUserLimit

                            ? 'text-red-700'

                            : 'text-slate-800'
                        }
                      `}
                    >
                      {selectedNewClientUserCount}
                      {' / '}
                      {userLimit ===
                        null
                        ? 'Unlimited'
                        : userLimit}
                    </span>

                  </div>


                  {clientAtUserLimit && (

                    <p
                      className="
                        mt-2

                        text-[9px]
                        font-medium

                        text-red-700
                      "
                    >
                      This client has reached the user limit for its assigned plan.
                    </p>

                  )}

                </div>

              )}

            </div>


            <div
              className="
                flex
                justify-end
                gap-2

                border-t
                border-slate-200

                px-4
                py-3
              "
            >

              <button

                type="button"

                onClick={() => {

                  setAddOpen(
                    false
                  );


                  resetForm();

                }}

                className="
                  h-8

                  rounded-[8px]

                  border
                  border-slate-200

                  px-3

                  text-[10px]
                  font-semibold

                  text-slate-600
                "
              >
                Cancel
              </button>


              <button

                type="button"

                disabled={
                  !newName.trim()
                  ||
                  !newEmail.trim()
                  ||
                  (
                    newScope ===
                      'client'
                    &&
                    (
                      !newClientId
                      ||
                      clientAtUserLimit
                    )
                  )
                }

                onClick={
                  createUser
                }

                className="
                  h-8

                  rounded-[8px]

                  bg-slate-950

                  px-3

                  text-[10px]
                  font-semibold

                  text-white

                  disabled:cursor-not-allowed
                  disabled:opacity-40
                "
              >
                Add User
              </button>

            </div>

          </div>

        </div>

      )}

    </div>

  );

}


// ============================================================
// USER DETAIL
// ============================================================

function UserDetail({

  user,

  onBack,

  onChange,

}: {

  user:
    AdminUser;

  onBack:
    () => void;

  onChange:
    (
      user:
        AdminUser
    ) => void;

}) {


  const {
    clients,
    modules,
    getClient,
    getPlan,
    getClientModuleAccess,
    getUserModuleAccess,
  } =
    useAdminStore();


  const client =
    user.clientId
      ? getClient(
          user.clientId
        )
      : undefined;


  const plan =
    client
      ? getPlan(
          client.planId
        )
      : undefined;


  const finalModuleCount =
    modules.filter(
      module =>
        getUserModuleAccess(
          user,
          module.id
        ).enabled
    ).length;


  const explicitPermissionCount =
    Object
      .values(
        user.modulePermissions
      )
      .filter(
        value =>
          value !==
          'inherit'
      )
      .length;


  // ==========================================================
  // SET MODULE PERMISSION
  // ==========================================================

  function setModulePermission(

    moduleId:
      string,

    permission:
      UserModulePermission

  ) {

    if (
      permission ===
      'inherit'
    ) {

      const nextPermissions = {
        ...user.modulePermissions,
      };


      delete nextPermissions[
        moduleId
      ];


      onChange({

        ...user,

        modulePermissions:
          nextPermissions,

      });


      return;

    }


    onChange({

      ...user,

      modulePermissions: {

        ...user.modulePermissions,

        [moduleId]:
          permission,

      },

    });

  }


  // ==========================================================
  // UI
  // ==========================================================

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

            lg:flex-row
            lg:items-center
            lg:justify-between
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

                text-slate-500

                hover:bg-slate-50
              "
            >

              <ArrowLeft
                size={14}
              />

            </button>


            <UserIcon
              scope={
                user.scope
              }
              large
            />


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
                  {user.name}
                </h2>


                <ScopeBadge
                  scope={
                    user.scope
                  }
                />


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
                {user.email}
                {' · '}
                {formatRole(
                  user.role
                )}
              </p>

            </div>

          </div>


          <select

            value={
              user.status
            }

            onChange={
              event =>
                onChange({

                  ...user,

                  status:
                    event.target.value as UserStatus,

                })
            }

            className="
              h-8

              rounded-[8px]

              border
              border-slate-300

              bg-white

              px-2.5

              text-[10px]
              font-medium

              text-slate-700
            "
          >

            <option value="active">
              Active
            </option>

            <option value="invited">
              Invited
            </option>

            <option value="suspended">
              Suspended
            </option>

          </select>

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
          label="Scope"
          value={
            user.scope ===
              'platform'

              ? 'Platform'

              : 'Client'
          }
        />


        <SummaryCard
          label="Role"
          value={
            formatRole(
              user.role
            )
          }
        />


        <SummaryCard
          label="Module Access"
          value={
            finalModuleCount
          }
        />


        <SummaryCard
          label="Overrides"
          value={
            explicitPermissionCount
          }
        />

      </section>


      {/* =====================================================
          IDENTITY & ROLE
      ===================================================== */}

      <section className="gos-panel !p-3.5">

        <h3 className="gos-section-title">
          Identity & Role
        </h3>


        <div
          className="
            mt-3

            grid
            grid-cols-1
            gap-3

            md:grid-cols-2
          "
        >

          <FormField
            label="Name"
          >

            <input

              value={
                user.name
              }

              onChange={
                event =>
                  onChange({

                    ...user,

                    name:
                      event.target.value,

                  })
              }

              className="gos-input w-full"

            />

          </FormField>


          <FormField
            label="Email"
          >

            <input

              type="email"

              value={
                user.email
              }

              onChange={
                event =>
                  onChange({

                    ...user,

                    email:
                      event.target.value,

                  })
              }

              className="gos-input w-full"

            />

          </FormField>


          {user.scope ===
            'client' && (

            <>

              <FormField
                label="Client"
              >

                <select

                  value={
                    user.clientId ||
                    ''
                  }

                  onChange={
                    event =>
                      onChange({

                        ...user,

                        clientId:
                          event.target.value,

                        modulePermissions:
                          {},

                      })
                  }

                  className="gos-input w-full"

                >

                  {clients.map(
                    item => (

                      <option
                        key={
                          item.id
                        }
                        value={
                          item.id
                        }
                      >
                        {item.name}
                      </option>

                    )
                  )}

                </select>

              </FormField>


              <FormField
                label="Role"
              >

                <select

                  value={
                    user.role
                  }

                  onChange={
                    event =>
                      onChange({

                        ...user,

                        role:
                          event.target.value as UserRole,

                      })
                  }

                  className="gos-input w-full"

                >

                  {CLIENT_ROLES.map(
                    role => (

                      <option
                        key={
                          role.value
                        }
                        value={
                          role.value
                        }
                      >
                        {role.label}
                      </option>

                    )
                  )}

                </select>

              </FormField>

            </>

          )}

        </div>

      </section>


      {/* =====================================================
          CLIENT CONTEXT
      ===================================================== */}

      {user.scope ===
        'client' && (

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
              Client Context
            </h3>


            <div className="mt-3 space-y-2">

              <ValueRow
                label="Client"
                value={
                  client?.name ||
                  'Not Assigned'
                }
              />


              <ValueRow
                label="Plan"
                value={
                  plan?.name ||
                  'No Plan'
                }
              />


              <ValueRow
                label="Client Status"
                value={
                  client
                    ? formatClientStatus(
                        client.status
                      )
                    : 'Unknown'
                }
              />

            </div>

          </section>


          <section className="gos-panel !p-3.5">

            <h3 className="gos-section-title">
              Access Rule
            </h3>


            <p
              className="
                mt-2

                text-[9px]
                leading-4

                text-slate-500
              "
            >
              A user can restrict access below the client entitlement, but cannot unlock a module the client does not have.
            </p>


            <div
              className="
                mt-3

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
                  text-[9px]
                  font-semibold

                  text-violet-800
                "
              >
                Client entitlement → User permission → Final access
              </p>

            </div>

          </section>

        </section>

      )}


      {/* =====================================================
          MODULE ACCESS
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
            Module Access
          </h3>


          <p
            className="
              mt-0.5

              text-[9px]

              text-slate-500
            "
          >
            Review client entitlement, user permission and final module access.
          </p>

        </div>


        <div className="overflow-x-auto">

          <table
            className="
              min-w-[900px]
              w-full

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
                  Module
                </TableHeader>

                <TableHeader>
                  Client Access
                </TableHeader>

                <TableHeader>
                  User Permission
                </TableHeader>

                <TableHeader>
                  Final Access
                </TableHeader>

                <TableHeader>
                  Module Status
                </TableHeader>

              </tr>

            </thead>


            <tbody>

              {modules.map(
                module => {

                  const finalAccess =
                    getUserModuleAccess(
                      user,
                      module.id
                    );


                  const clientAccess =
                    user.scope ===
                      'client'
                    &&
                    client

                      ? getClientModuleAccess(
                          client,
                          module.id
                        )

                      : null;


                  return (

                    <tr
                      key={
                        module.id
                      }

                      className="
                        border-b
                        border-slate-100

                        last:border-0

                        hover:bg-slate-50/70
                      "
                    >

                      <td className="px-3 py-2">

                        <div>

                          <div
                            className="
                              text-[10px]
                              font-semibold

                              text-slate-900
                            "
                          >
                            {module.name}
                          </div>


                          <div
                            className="
                              mt-0.5

                              max-w-[300px]

                              truncate

                              text-[8px]

                              text-slate-500
                            "
                          >
                            {module.description}
                          </div>

                        </div>

                      </td>


                      <td className="px-3 py-2">

                        {user.scope ===
                          'platform' ? (

                          <AccessBadge
                            enabled
                            enabledLabel="Platform"
                            disabledLabel="Disabled"
                          />

                        ) : (

                          <AccessBadge

                            enabled={
                              Boolean(
                                clientAccess?.enabled
                              )
                            }

                            enabledLabel="Enabled"

                            disabledLabel="Disabled"

                          />

                        )}

                      </td>


                      <td className="px-3 py-2">

                        {user.scope ===
                          'platform' ? (

                          <span
                            className="
                              text-[9px]
                              font-medium

                              text-slate-400
                            "
                          >
                            Platform Admin
                          </span>

                        ) : (

                          <select

                            value={
                              finalAccess.permission
                            }

                            onChange={
                              event =>
                                setModulePermission(
                                  module.id,
                                  event.target.value as UserModulePermission
                                )
                            }

                            className="
                              h-7

                              rounded-[7px]

                              border
                              border-slate-300

                              bg-white

                              px-2

                              text-[9px]
                              font-medium

                              text-slate-700
                            "
                          >

                            <option value="inherit">
                              Inherit Client
                            </option>

                            <option
                              value="enabled"
                              disabled={
                                !finalAccess.clientEnabled
                              }
                            >
                              Allow
                            </option>

                            <option value="disabled">
                              Deny
                            </option>

                          </select>

                        )}

                      </td>


                      <td className="px-3 py-2">

                        <AccessBadge

                          enabled={
                            finalAccess.enabled
                          }

                          enabledLabel="Enabled"

                          disabledLabel="Disabled"

                        />

                      </td>


                      <td className="px-3 py-2">

                        <ModuleStatusBadge
                          status={
                            module.status
                          }
                        />

                      </td>

                    </tr>

                  );

                }
              )}

            </tbody>

          </table>

        </div>

      </section>

    </div>

  );

}


// ============================================================
// USER ICON
// ============================================================

function UserIcon({

  scope,

  large =
    false,

}: {

  scope:
    UserScope;

  large?:
    boolean;

}) {

  const Icon =
    scope ===
      'platform'

      ? ShieldCheck

      : UserRound;


  return (

    <div
      className={`
        flex
        shrink-0
        items-center
        justify-center

        rounded-[9px]

        ${
          scope ===
            'platform'

            ? `
              bg-violet-50
              text-violet-600
            `

            : `
              bg-blue-50
              text-blue-600
            `
        }

        ${
          large

            ? `
              h-9
              w-9
            `

            : `
              h-8
              w-8
            `
        }
      `}
    >

      <Icon
        size={
          large
            ? 17
            : 15
        }
      />

    </div>

  );

}


// ============================================================
// SCOPE BADGE
// ============================================================

function ScopeBadge({

  scope,

}: {

  scope:
    UserScope;

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
          scope ===
            'platform'

            ? `
              border-violet-200
              bg-violet-50
              text-violet-700
            `

            : `
              border-blue-200
              bg-blue-50
              text-blue-700
            `
        }
      `}
    >
      {scope ===
        'platform'

        ? 'Platform'

        : 'Client'
      }
    </span>

  );

}


// ============================================================
// USER STATUS
// ============================================================

function UserStatusBadge({

  status,

}: {

  status:
    UserStatus;

}) {

  const config =

    status ===
      'active'

      ? {
          label:
            'Active',

          cls:
            'border-emerald-200 bg-emerald-50 text-emerald-700',
        }

      : status ===
          'invited'

        ? {
            label:
              'Invited',

            cls:
              'border-blue-200 bg-blue-50 text-blue-700',
          }

        : {
            label:
              'Suspended',

            cls:
              'border-red-200 bg-red-50 text-red-700',
          };


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

        ${config.cls}
      `}
    >
      {config.label}
    </span>

  );

}


// ============================================================
// ACCESS BADGE
// ============================================================

function AccessBadge({

  enabled,

  enabledLabel,

  disabledLabel,

}: {

  enabled:
    boolean;

  enabledLabel:
    string;

  disabledLabel:
    string;

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
          enabled

            ? `
              border-emerald-200
              bg-emerald-50
              text-emerald-700
            `

            : `
              border-slate-200
              bg-slate-100
              text-slate-500
            `
        }
      `}
    >
      {enabled
        ? enabledLabel
        : disabledLabel
      }
    </span>

  );

}


// ============================================================
// MODULE STATUS
// ============================================================

function ModuleStatusBadge({

  status,

}: {

  status:
    string;

}) {

  const active =
    status ===
      'active';


  const draft =
    status ===
      'draft';


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
          active

            ? `
              border-emerald-200
              bg-emerald-50
              text-emerald-700
            `

            : draft

              ? `
                border-amber-200
                bg-amber-50
                text-amber-700
              `

              : `
                border-red-200
                bg-red-50
                text-red-700
              `
        }
      `}
    >
      {capitalize(
        status
      )}
    </span>

  );

}


// ============================================================
// SUMMARY
// ============================================================

function SummaryCard({

  label,

  value,

}: {

  label:
    string;

  value:
    string |
    number;

}) {

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
        className="
          mt-1.5

          text-[18px]
          font-semibold
          tracking-[-0.03em]

          text-slate-950
        "
      >
        {value}
      </p>

    </div>

  );

}


// ============================================================
// VALUE ROW
// ============================================================

function ValueRow({

  label,

  value,

}: {

  label:
    string;

  value:
    string;

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
          text-[9px]

          text-slate-500
        "
      >
        {label}
      </span>


      <span
        className="
          text-[10px]
          font-semibold

          text-slate-800
        "
      >
        {value}
      </span>

    </div>

  );

}


// ============================================================
// FORM FIELD
// ============================================================

function FormField({

  label,

  children,

}: {

  label:
    string;

  children:
    ReactNode;

}) {

  return (

    <label className="block">

      <span
        className="
          mb-1.5
          block

          text-[9px]
          font-semibold
          uppercase
          tracking-[0.05em]

          text-slate-500
        "
      >
        {label}
      </span>


      {children}

    </label>

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

        text-[9px]
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

function formatRole(
  role:
    UserRole
) {

  const labels:
    Record<
      UserRole,
      string
    > = {

    platform_admin:
      'Platform Admin',

    client_owner:
      'Owner',

    client_admin:
      'Admin',

    manager:
      'Manager',

    analyst:
      'Analyst',

    operator:
      'Operator',

    viewer:
      'Viewer',

  };


  return labels[
    role
  ];

}


function formatClientStatus(
  status:
    string
) {

  if (
    status ===
    'active'
  ) {

    return 'Active';

  }


  if (
    status ===
    'setup'
  ) {

    return 'Setup Required';

  }


  return 'Suspended';

}


function capitalize(
  value:
    string
) {

  return (
    value
      .charAt(
        0
      )
      .toUpperCase()
    +
    value.slice(
      1
    )
  );

}