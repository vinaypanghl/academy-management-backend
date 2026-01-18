import { getSupabaseClient, success, error, getAuthenticatedUser } from "../_shared/utils.ts";
import { ROLES } from "../_shared/constants.ts";

Deno.serve(async (req: Request) => {
    // ✅ Handle CORS preflight
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

        // ✅ Authenticate Supabase user
        const authUser = await getAuthenticatedUser(req);
        const role = authUser.user_metadata?.role;
        const academyExternalId = authUser.user_metadata?.academy_id;

        // ✅ Only academies or admins can create classes
        if (![ROLES.ACADEMY, ROLES.ADMIN].includes(role)) {
            return error("You don't have permission to create classes");
        }

        // ✅ Find academy record by external_id
        const { data: academy, error: academyError } = await supabase
            .from("academies")
            .select("id")
            .eq("academy_id", academyExternalId)
            .single();

        if (academyError || !academy) {
            return error("Academy not found for this user");
        }

        // ✅ Parse request body
        const body = await req.json();
        const { class_name, section, academic_year } = body;

        if (!class_name || !academic_year) {
            return error("Missing required fields: class_name, academic_year");
        }

        // ✅ Check for duplicates
        const { data: existingClass } = await supabase
            .from("class_sections")
            .select("*")
            .eq("academy_id", academy.id)
            .eq("class_name", class_name)
            .eq("section", section || "")
            .eq("academic_year", academic_year)
            .maybeSingle();

        if (existingClass) {
            return error("This class section already exists for the given academic year");
        }

        // ✅ Create class section
        const { data: classSection, error: classError } = await supabase
            .from("class_sections")
            .insert({
                academy_id: academy.id, // Use internal UUID
                class_name,
                section: section || null,
                academic_year,
            })
            .select()
            .single();

        if (classError) {
            return error(classError.message);
        }

        return success({
            message: "Class created successfully",
            class: classSection,
        });
    } catch (err: any) {
        console.error("Function error:", err);
        return error(err.message || "Internal server error", 500);
    }
});
