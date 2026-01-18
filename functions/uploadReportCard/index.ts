import { getSupabaseClient, getAuthenticatedUser, success, error, base64ToUint8Array } from "../_shared/utils.ts";
import { TABLES, STORAGE, ROLES } from "../_shared/constants.ts";

export async function handler(req: Request): Promise<Response> {
    try {
        if (req.method !== "POST") return error("Only POST allowed", 405);

        const user = await getAuthenticatedUser(req);  // verify token
        const supabase = getSupabaseClient();

        // Get role + academy_id for logged user
        const { data: roleData, error: roleErr } = await supabase
            .from(TABLES.USERS)
            .select("role, academy_id")
            .eq("id", user.id)
            .single();

        if (roleErr || !roleData) return error("User role not found");
        const { role, academy_id } = roleData;

        if (![ROLES.TEACHER, ROLES.ADMIN, ROLES.ACADEMY].includes(role)) {
            return error("Access denied: Only teacher/admin/academy can upload report cards", 403);
        }

        const body = await req.json();
        const { student_id, file_name, file_base64, content_type = "application/pdf" } = body;
        if (!student_id || !file_name || !file_base64) return error("Missing required fields");

        const bucket = STORAGE.REPORT_CARD_BUCKET;
        const path = `${academy_id}/${student_id}/${file_name}`;
        const fileBytes = base64ToUint8Array(file_base64);

        const uploadRes = await supabase.storage.from(bucket).upload(path, fileBytes, {
            contentType: content_type,
            upsert: true
        });
        if (uploadRes.error) return error(uploadRes.error.message);

        const { data: signedUrlData, error: signedErr } = await supabase.storage
            .from(bucket)
            .createSignedUrl(path, 60 * 60 * 24 * 7);

        if (signedErr) return error(signedErr.message);

        const report_card_url = signedUrlData.signedUrl;

        // Insert a student record
        const { data: record, error: insertErr } = await supabase
            .from(TABLES.STUDENT_RECORDS)
            .insert({
                student_id,
                teacher_id: user.id,
                report_card_url,
                created_at: new Date()
            })
            .select()
            .single();

        if (insertErr) return error(insertErr.message);

        return success({ message: "Report card uploaded successfully", record });
    } catch (err) {
        return error(err.message, 401);
    }
}

Deno.serve(handler);
