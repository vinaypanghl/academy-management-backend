import { getSupabaseClient, success, error } from "../_shared/utils.ts";
import { TABLES } from "../_shared/constants.ts";

export async function handler(req: Request): Promise<Response> {
    try {
        const supabase = getSupabaseClient();
        if (req.method !== "GET") return error("Only GET allowed", 405);

        const url = new URL(req.url);
        const student_id = url.searchParams.get("student_id");
        if (!student_id) return error("Missing student_id query param");

        // fetch student
        const { data: records, error: recordsErr } = await supabase
            .from(TABLES.STUDENT_RECORDS)
            .select("id,teacher_id,academic_year,subject,grade,attendance_percentage,behavior_notes,report_card_url,created_at")
            .eq("student_id", student_id)
            .order("created_at", { ascending: false });

        if (recordsErr) return error(recordsErr.message);

        // compute average attendance if numbers present
        const attendanceVals = records
            .map((r: any) => r.attendance_percentage)
            .filter((v: any) => typeof v === "number");

        const avgAttendance =
            attendanceVals.length > 0
                ? attendanceVals.reduce((a: number, b: number) => a + b, 0) / attendanceVals.length
                : null;

        return success({ student_id, avgAttendance, records });
    } catch (err) {
        return error(err.message);
    }
}

Deno.serve(handler);
