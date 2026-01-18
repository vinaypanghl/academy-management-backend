import { getSupabaseClient, success, error } from "../_shared/utils.ts";
import { TABLES } from "../_shared/constants.ts";

export async function handler(req: Request): Promise<Response> {
    try {
        const supabase = getSupabaseClient();
        if (req.method !== "POST") return error("Only POST allowed", 405);

        const body = await req.json();
        const { academy_id, class_section_id, teacher_id, title, description, due_date } = body;

        if (!academy_id || !class_section_id || !teacher_id || !title) {
            return error("Missing required fields: academy_id, class_section_id, teacher_id, title");
        }

        const payload: any = {
            academy_id,
            class_section_id,
            teacher_id,
            title,
            description,
            due_date: due_date ? new Date(due_date) : null
        };

        const { data: assignment, error: insertErr } = await supabase
            .from(TABLES.ASSIGNMENTS)
            .insert(payload)
            .select()
            .single();

        if (insertErr) return error(insertErr.message);

        return success({ message: "Assignment created", assignment });
    } catch (err) {
        return error(err.message);
    }
}

Deno.serve(handler);
