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

        const currentRole = authUser.user_metadata?.role;
        const academyExternalId = authUser.user_metadata?.academy_id;

        // 🔒 Permission
        if (![ROLES.ACADEMY, ROLES.ADMIN].includes(currentRole)) {
            return error("Unauthorized");
        }

        // 🔹 Resolve academy UUID (same pattern as createStudent)
        const { data: academy, error: academyError } = await supabase
            .from("academies")
            .select("id")
            .eq("academy_id", academyExternalId)
            .single();

        if (academyError || !academy) {
            return error("Academy not found for this user");
        }

        const academyId = academy.id;

        const body = await req.json();
        const { role, display_name, email, phone, password } = body;

        if (!role || !password || (!email && !phone)) {
            return error("role, password and email or phone are required");
        }

        // 🔒 Allowed roles
        if (![ROLES.ADMIN, ROLES.TEACHER].includes(role)) {
            return error("Only Admin or Teacher can be created");
        }

        // 🔒 Admin cannot create Admin
        if (currentRole === ROLES.ADMIN && role !== ROLES.TEACHER) {
            return error("Admin can only create Teacher");
        }

        // 🔹 Create auth user
        const { data, error: createError } =
            await supabase.auth.admin.createUser({
                email,
                phone,
                password,
                email_confirm: !!email,
                phone_confirm: !!phone,
                user_metadata: {
                    role,
                    academy_id: academyId, // UUID
                    display_name: display_name || email || phone,
                },
            });

        if (createError || !data.user) {
            return error(createError?.message || "Failed to create user");
        }

        const userId = data.user.id;

        // 🔹 Teacher domain creation
        if (role === ROLES.TEACHER) {
            // teachers table
            const { error: teacherError } = await supabase
                .from("teachers")
                .insert({
                    id: userId,
                });

            if (teacherError) {
                return error("Teacher creation failed: " + teacherError.message);
            }

            // teacher_academy_map
            const { error: mapError } = await supabase
                .from("teacher_academy_map")
                .insert({
                    teacher_id: userId,
                    academy_id: academyId,
                });

            if (mapError) {
                return error("Teacher-academy mapping failed: " + mapError.message);
            }
        }

        return success({
            message: `${role} created successfully`,
            user: {
                id: userId,
                email: data.user.email,
                phone: data.user.phone,
                role,
                display_name: display_name || email || phone,
            },
        });

    } catch (err: any) {
        console.error("createUser error:", err);
        return error(err.message || "Internal server error", 500);
    }
});
