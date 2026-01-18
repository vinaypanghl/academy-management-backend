import { getSupabaseClient, success, error, getAuthenticatedUser } from "../_shared/utils.ts";
import { ROLES } from "../_shared/constants.ts";

Deno.serve(async (req: Request) => {
    // ✅ CORS preflight
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

        // ✅ Authenticated user
        const authUser = await getAuthenticatedUser(req);
        const role = authUser.user_metadata?.role;
        const academyExternalId = authUser.user_metadata?.academy_id;

        if (![ROLES.ACADEMY, ROLES.ADMIN, ROLES.TEACHER].includes(role)) {
            return error("You don't have permission to view classes");
        }

        // ✅ Resolve internal academy UUID
        const { data: academy, error: academyError } = await supabase
            .from("academies")
            .select("id")
            .eq("academy_id", academyExternalId)
            .single();

        if (academyError || !academy) {
            return error("Academy not found for this user");
        }

        // ✅ Fetch classes
        const { data: classes, error: classesError } = await supabase
            .from("class_sections")
            .select("*")
            .eq("academy_id", academy.id)
            .order("class_name", { ascending: true });

        if (classesError) {
            return error(classesError.message);
        }

        return success({ classes });
    } catch (err: any) {
        console.error("Function error:", err);
        return error(err.message || "Internal server error", 500);
    }
});
