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
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
        });
    }

    try {
        const supabase = getSupabaseClient();
        const authUser = await getAuthenticatedUser(req);

        const role = authUser.user_metadata?.role;
        const academyExternalId = authUser.user_metadata?.academy_id;

        // 🔒 Only teachers allowed
        if (role !== ROLES.TEACHER) {
            return error("Only teachers can fetch students");
        }

        if (!academyExternalId) {
            return error("Academy not associated with teacher");
        }

        // 🔹 Resolve internal academy UUID
        const { data: academy, error: academyError } = await supabase
            .from("academies")
            .select("id")
            .eq("academy_id", academyExternalId)
            .single();

        if (academyError || !academy) {
            return error("Academy not found");
        }

        // 🔹 Read query params
        const url = new URL(req.url);
        const class_name = url.searchParams.get("class_name");
        const class_section = url.searchParams.get("class_section");
        const academic_year = url.searchParams.get("academic_year");

        // 🔹 Base query
        let query = supabase
            .from("students")
            .select(`
          id,
          first_name,
          last_name,
          roll_no,
          class_name,
          class_section,
          academic_year
        `)
            .eq("academy_id", academy.id)
            .order("roll_no", { ascending: true });

        // 🔹 Optional filters
        if (class_name) {
            query = query.eq("class_name", class_name);
        }

        if (class_section) {
            query = query.eq("class_section", class_section);
        }

        if (academic_year) {
            query = query.eq("academic_year", academic_year);
        }

        const { data: students, error: studentsError } = await query;

        if (studentsError) {
            return error(studentsError.message);
        }

        return success({
            students,
        });
    } catch (err: any) {
        console.error("fetchTeacherStudents error:", err);
        return error(err.message || "Internal server error", 500);
    }
});
