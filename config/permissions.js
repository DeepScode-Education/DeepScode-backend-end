// config/permissions.js
//
// Central permission registry for the common Staff Dashboard.
//
// IMPORTANT:
// - Role defaults are kept for backward compatibility.
// - Super Admin receives every permission automatically.
// - Individual staff overrides are stored on User.permissionOverrides.
// - Frontend can use PERMISSION_GROUPS through GET /api/permissions/catalog
//   to build a clean permission-management UI without duplicating the
//   permission registry.

const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard.view",
  DASHBOARD_STUDENTS: "dashboard.students",
  DASHBOARD_LEADS: "dashboard.leads",
  DASHBOARD_FEES: "dashboard.fees",
  DASHBOARD_ATTENDANCE: "dashboard.attendance",
  DASHBOARD_LIVE_CLASSES: "dashboard.live_classes",
  DASHBOARD_REPORTS: "dashboard.reports",

  STUDENTS_VIEW: "students.view",
  STUDENTS_CREATE: "students.create",
  STUDENTS_EDIT: "students.edit",
  STUDENTS_DELETE: "students.delete",

  LEADS_VIEW: "leads.view",
  LEADS_CREATE: "leads.create",
  LEADS_EDIT: "leads.edit",
  LEADS_DELETE: "leads.delete",
  LEADS_ASSIGN: "leads.assign",

  ADMISSIONS_VIEW: "admissions.view",
  ADMISSIONS_CREATE: "admissions.create",
  ADMISSIONS_EDIT: "admissions.edit",

  FEES_VIEW: "fees.view",
  FEES_CREATE: "fees.create",
  FEES_EDIT: "fees.edit",
  FEES_DELETE: "fees.delete",

  PAYMENTS_VIEW: "payments.view",
  PAYMENTS_CREATE: "payments.create",
  PAYMENTS_EDIT: "payments.edit",

  COURSES_VIEW: "courses.view",
  COURSES_CREATE: "courses.create",
  COURSES_EDIT: "courses.edit",
  COURSES_DELETE: "courses.delete",

  BATCHES_VIEW: "batches.view",
  BATCHES_CREATE: "batches.create",
  BATCHES_EDIT: "batches.edit",
  BATCHES_DELETE: "batches.delete",

  LIVE_CLASSES_VIEW: "live_classes.view",
  LIVE_CLASSES_MANAGE: "live_classes.manage",

  ATTENDANCE_VIEW: "attendance.view",
  ATTENDANCE_MANAGE: "attendance.manage",

  EMPLOYEES_VIEW: "employees.view",
  EMPLOYEES_CREATE: "employees.create",
  EMPLOYEES_EDIT: "employees.edit",
  EMPLOYEES_DELETE: "employees.delete",
  EMPLOYEES_PERMISSIONS: "employees.permissions",

  LEAVE_VIEW: "leave.view",
  LEAVE_CREATE: "leave.create",
  LEAVE_APPROVE: "leave.approve",
  LEAVE_REJECT: "leave.reject",

  DOCUMENTS_VIEW: "documents.view",
  DOCUMENTS_UPLOAD: "documents.upload",
  DOCUMENTS_DELETE: "documents.delete",

  REPORTS_VIEW: "reports.view",

  PROFILE_VIEW: "profile.view",
  PROFILE_EDIT: "profile.edit",

  PAYROLL_VIEW: "payroll.view",
  PAYROLL_MANAGE: "payroll.manage",
};

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

// This metadata is intentionally backend-owned so the frontend can render
// permission screens consistently without maintaining another permission list.
const PERMISSION_GROUPS = [
  {
    key: "dashboard",
    label: "Dashboard",
    permissions: [
      { permission: "dashboard.view", label: "View Dashboard" },
      { permission: "dashboard.students", label: "Students Dashboard Data" },
      { permission: "dashboard.leads", label: "Leads Dashboard Data" },
      { permission: "dashboard.fees", label: "Fees Dashboard Data" },
      { permission: "dashboard.attendance", label: "Attendance Dashboard Data" },
      { permission: "dashboard.live_classes", label: "Live Classes Dashboard Data" },
      { permission: "dashboard.reports", label: "Reports Dashboard Data" },
    ],
  },
  {
    key: "students",
    label: "Students",
    permissions: [
      { permission: "students.view", label: "View" },
      { permission: "students.create", label: "Create" },
      { permission: "students.edit", label: "Edit" },
      { permission: "students.delete", label: "Delete" },
       { permission: "students.approve", label: "Approve" },
    { permission: "students.reject", label: "Reject" },
    ],
  },
  {
    key: "leads",
    label: "Leads",
    permissions: [
      { permission: "leads.view", label: "View" },
      { permission: "leads.create", label: "Create" },
      { permission: "leads.edit", label: "Edit" },
      { permission: "leads.delete", label: "Delete" },
      { permission: "leads.assign", label: "Assign" },
    ],
  },
  {
    key: "admissions",
    label: "Admissions",
    permissions: [
      { permission: "admissions.view", label: "View" },
      { permission: "admissions.create", label: "Create" },
      { permission: "admissions.edit", label: "Edit" },
    ],
  },
  {
    key: "fees",
    label: "Fees",
    permissions: [
      { permission: "fees.view", label: "View" },
      { permission: "fees.create", label: "Create" },
      { permission: "fees.edit", label: "Edit" },
      { permission: "fees.delete", label: "Delete" },
    ],
  },
  {
    key: "payments",
    label: "Payments",
    permissions: [
      { permission: "payments.view", label: "View" },
      { permission: "payments.create", label: "Create" },
      { permission: "payments.edit", label: "Edit" },
    ],
  },
  {
    key: "courses",
    label: "Courses",
    permissions: [
      { permission: "courses.view", label: "View" },
      { permission: "courses.create", label: "Create" },
      { permission: "courses.edit", label: "Edit" },
      { permission: "courses.delete", label: "Delete" },
    ],
  },
  {
    key: "batches",
    label: "Batches",
    permissions: [
      { permission: "batches.view", label: "View" },
      { permission: "batches.create", label: "Create" },
      { permission: "batches.edit", label: "Edit" },
      { permission: "batches.delete", label: "Delete" },
    ],
  },
  {
    key: "live_classes",
    label: "Live Classes",
    permissions: [
      { permission: "live_classes.view", label: "View" },
      { permission: "live_classes.manage", label: "Manage" },
    ],
  },
  {
    key: "attendance",
    label: "Attendance",
    permissions: [
      { permission: "attendance.view", label: "View" },
      { permission: "attendance.manage", label: "Manage" },
    ],
  },
  {
    key: "employees",
    label: "Employees",
    permissions: [
      { permission: "employees.view", label: "View" },
      { permission: "employees.create", label: "Create" },
      { permission: "employees.edit", label: "Edit" },
      { permission: "employees.delete", label: "Delete" },
      { permission: "employees.permissions", label: "Manage Permissions" },
    ],
  },
  {
    key: "leave",
    label: "Leave",
    permissions: [
      { permission: "leave.view", label: "View" },
      { permission: "leave.create", label: "Create" },
      { permission: "leave.approve", label: "Approve" },
      { permission: "leave.reject", label: "Reject" },
    ],
  },
  {
    key: "documents",
    label: "Documents",
    permissions: [
      { permission: "documents.view", label: "View" },
      { permission: "documents.upload", label: "Upload" },
      { permission: "documents.delete", label: "Delete" },
    ],
  },
  {
    key: "reports",
    label: "Reports",
    permissions: [
      { permission: "reports.view", label: "View" },
    ],
  },
  {
    key: "profile",
    label: "My Account / Profile",
    permissions: [
      { permission: "profile.view", label: "View Profile" },
      { permission: "profile.edit", label: "Edit Profile" },
    ],
  },
  {
    key: "payroll",
    label: "Payroll",
    permissions: [
      { permission: "payroll.view", label: "View" },
      { permission: "payroll.manage", label: "Manage" },
    ],
  },
];

const ROLE_DEFAULT_PERMISSIONS = {
  super_admin: ALL_PERMISSIONS,

  admin: [
    "dashboard.view",
    "dashboard.students",
    "dashboard.leads",
    "dashboard.fees",
    "dashboard.attendance",
    "dashboard.live_classes",
    "dashboard.reports",

    "students.view",
    "students.create",
    "students.edit",
    "students.delete",

    "leads.view",
    "leads.create",
    "leads.edit",
    "leads.delete",
    "leads.assign",

    "admissions.view",
    "admissions.create",
    "admissions.edit",

    "fees.view",
    "fees.create",
    "fees.edit",
    "fees.delete",

    "payments.view",
    "payments.create",
    "payments.edit",

    "courses.view",
    "courses.create",
    "courses.edit",
    "courses.delete",

    "batches.view",
    "batches.create",
    "batches.edit",
    "batches.delete",

    "live_classes.view",
    "live_classes.manage",

    "attendance.view",
    "attendance.manage",

    "employees.view",
    "employees.create",
    "employees.edit",
    "employees.permissions",

    "leave.view",
    "leave.approve",
    "leave.reject",

    "documents.view",
    "documents.upload",
    "documents.delete",

    "reports.view",

    "profile.view",
    "profile.edit",

    "payroll.view",
    "payroll.manage",
  ],

  counsellor: [
    "dashboard.view",
    "dashboard.students",
    "dashboard.leads",
    "dashboard.fees",

    "students.view",
    "students.create",
    "students.edit",

    "leads.view",
    "leads.create",
    "leads.edit",

    "admissions.view",
    "admissions.create",
    "admissions.edit",

    "profile.view",
    "profile.edit",

    "leave.view",
    "leave.create",

    "attendance.view",
  ],

  mentor: [
    "dashboard.view",
    "dashboard.students",
    "dashboard.attendance",
    "dashboard.live_classes",

    "students.view",

    "courses.view",
    "batches.view",

    "live_classes.view",
    "live_classes.manage",

    "attendance.view",
    "attendance.manage",

    "documents.view",
    "documents.upload",

    "profile.view",
    "profile.edit",

    "leave.view",
    "leave.create",
  ],

  accountant: [
    "dashboard.view",
    "dashboard.students",
    "dashboard.fees",
    "dashboard.reports",

    "students.view",

    "fees.view",
    "fees.create",
    "fees.edit",

    "payments.view",
    "payments.create",
    "payments.edit",

    "reports.view",

    "profile.view",
    "profile.edit",

    "leave.view",
    "leave.create",
  ],

  coordinator: [
    "dashboard.view",
    "dashboard.students",
    "dashboard.attendance",
    "dashboard.live_classes",

    "students.view",
    "students.edit",

    "courses.view",

    "batches.view",
    "batches.create",
    "batches.edit",

    "attendance.view",
    "attendance.manage",

    "live_classes.view",
    "live_classes.manage",

    "profile.view",
    "profile.edit",

    "leave.view",
    "leave.create",
  ],

  hr: [
    "dashboard.view",
    "dashboard.attendance",

    "employees.view",
    "employees.create",
    "employees.edit",

    "attendance.view",
    "attendance.manage",

    "leave.view",
    "leave.approve",
    "leave.reject",

    "documents.view",
    "documents.upload",
    "documents.delete",

    "profile.view",
    "profile.edit",
  ],

  receptionist: [
    "dashboard.view",
    "dashboard.students",
    "dashboard.leads",

    "students.view",
    "students.create",

    "leads.view",
    "leads.create",

    "admissions.view",
    "admissions.create",

    "profile.view",
    "profile.edit",

    "leave.view",
    "leave.create",
  ],

  student: [],
};

module.exports = {
  PERMISSIONS,
  ALL_PERMISSIONS,
  PERMISSION_GROUPS,
  ROLE_DEFAULT_PERMISSIONS,
};
