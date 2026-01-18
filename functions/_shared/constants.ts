export const ROLES = {
    ACADEMY: "academy",
    ADMIN: "admin",
    TEACHER: "teacher",
    PARENT: "parent"
};

export const TABLES = {
    ACADEMIES: "academies",
    STUDENTS: "students",
    PARENTS: "parents",
    TEACHERS: "teachers",

    // Mapping tables
    PARENT_STUDENT_MAP: "parent_student_map",
    PARENT_ACADEMY_MAP: "parent_academy_map",
    TEACHER_ACADEMY_MAP: "teacher_academy_map",
    TEACHER_CLASS_MAP: "teacher_class_map",

    // Attendance
    STUDENT_ATTENDANCE: "student_attendance",

    // Notifications
    NOTIFICATIONS: "notifications",

    // Academics
    CLASS_SECTIONS: "class_sections",
    STUDENT_RECORDS: "student_records",
    ASSIGNMENTS: "assignments",
    ASSIGNMENT_SUBMISSIONS: "assignment_submissions",

    // Communication
    ANNOUNCEMENTS: "announcements",
    MEETINGS: "meetings",
};

export const STORAGE = {
    REPORT_CARD_BUCKET: "report-cards"   // create this bucket in Supabase Storage (or change name)
};