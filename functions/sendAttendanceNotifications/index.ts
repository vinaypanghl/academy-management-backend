import { getSupabaseClient, success, error } from "../_shared/utils.ts";

Deno.serve(async (req: Request) => {
    try {
        const supabase = getSupabaseClient();
        const {
            academy_id,
            class_name,
            class_section,
            lecture_no,
            attendance_type,
            date,
        } = await req.json();

        // Fetch attendance for this lecture
        const { data: attendanceList } = await supabase
            .from("student_attendance")
            .select(`
        student_id,
        status,
        is_late,
        students (
          id,
          first_name
        )
      `)
            .eq("academy_id", academy_id)
            .eq("class_name", class_name)
            .eq("class_section", class_section)
            .eq("attendance_date", date)
            .eq("lecture_no", lecture_no);

        for (const record of attendanceList || []) {
            let message = "";

            if (attendance_type === "ARRIVAL") {
                if (record.status === "PRESENT") {
                    message = "Your child has safely reached the academy.";
                } else {
                    message =
                        "Your child is not at school today. Please contact the academy.";
                }
            }

            // ⏰ LATE ARRIVAL (Lecture 2 but was absent in lecture 1)
            if (record.is_late) {
                message = "Your child reached the academy late today.";
            }

            if (attendance_type === "DEPARTURE") {
                if (record.status === "PRESENT") {
                    message = "Your child has safely left the academy.";
                } else {
                    message =
                        "Your child is not currently at the academy. Please contact immediately.";
                }
            }

            if (!message) continue;

            // Insert notification
            await supabase.from("notifications").insert({
                academy_id,
                student_id: record.student_id,
                message,
                type: "ATTENDANCE",
                created_at: new Date().toISOString(),
            });
        }

        return success({ message: "Notifications sent" });
    } catch (err: any) {
        console.error("sendAttendanceNotifications error", err);
        return error(err.message);
    }
});
