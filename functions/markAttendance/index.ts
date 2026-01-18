import {
    getSupabaseClient,
    success,
    error,
    getAuthenticatedUser,
} from "../_shared/utils.ts";
import { ROLES } from "../_shared/constants.ts";

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
        });
    }

    try {
        const supabase = getSupabaseClient();
        const authUser = await getAuthenticatedUser(req);

        const role = authUser.user_metadata?.role;
        const academyExternalId = authUser.user_metadata?.academy_id;

        if (role !== ROLES.TEACHER) {
            return error("Only teachers can mark attendance");
        }

        // Resolve academy UUID
        const { data: academy } = await supabase
            .from("academies")
            .select("id")
            .eq("academy_id", academyExternalId)
            .single();

        if (!academy) return error("Academy not found");

        const body = await req.json();
        const { class_name, class_section, records } = body;

        if (!class_name || !class_section || !Array.isArray(records)) {
            return error("Invalid attendance payload");
        }

        const today = new Date().toISOString().split("T")[0];

        for (const record of records) {
            const { student_id, status } = record;

            // Count today's attendance
            const { count } = await supabase
                .from("attendance")
                .select("id", { count: "exact", head: true })
                .eq("student_id", student_id)
                .eq("attendance_date", today);

            if ((count ?? 0) >= 2) {
                return error("Attendance already marked twice for today");
            }

            // Insert attendance
            await supabase.from("attendance").insert({
                academy_id: academy.id,
                class_name,
                class_section,
                student_id,
                status,
                attendance_date: today,
            });

            // Determine attendance type
            const isFirst = (count ?? 0) === 0;
            const isSecond = (count ?? 0) === 1;

            // Fetch parent
            const { data: parentMap } = await supabase
                .from("parent_student_map")
                .select("parent_id")
                .eq("student_id", student_id)
                .maybeSingle();

            if (!parentMap) continue;

            let message = null;

            if (isFirst && status === "PRESENT") {
                message = "Your child has reached school";
            }

            if (isSecond && status === "PRESENT") {
                message = "Your child has left the school";
            }

            if (isSecond && status === "ABSENT") {
                message =
                    "Your child is not at school if not on leave. Please contact academy.";
            }

            if (message) {
                await supabase.from("notifications").insert({
                    academy_id: academy.id,
                    parent_id: parentMap.parent_id,
                    student_id,
                    message,
                    type: "ATTENDANCE",
                });
            }
        }

        return success({ message: "Attendance marked successfully" });

    } catch (err: any) {
        console.error("markAttendance error:", err);
        return error(err.message || "Internal server error", 500);
    }
});
