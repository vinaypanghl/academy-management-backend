import {
    getSupabaseClient,
    success,
    error,
    getAuthenticatedUser,
} from "../_shared/utils.ts";
import { ROLES, TABLES } from "../_shared/constants.ts";

/* Generate unique student ID */
function generateUniqueStudentId() {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `STU-${new Date().getFullYear()}-${randomSuffix}`;
}

/* Create or fetch parent by auth_user_id */
async function getOrCreateParent(
    supabase: any,
    academyId: string,
    parent: any
) {
    let authUserId = parent.auth_user_id;

    if (!authUserId) {
    const { data: newAuthUser, error: authError } =
        await supabase.auth.admin.createUser({
        phone: parent.phone || undefined,
        email: parent.email || undefined,
        user_metadata: {
            display_name: parent.display_name,
            role: "PARENT",
        },
        });

    if (authError) throw new Error(authError.message);

    authUserId = newAuthUser.user.id;
    }

    // 1️⃣ Check if parent already exists
    const { data: existingParent } = await supabase
        .from("parents")
        .select("id")
        .eq("auth_user_id", parent.auth_user_id)
        .maybeSingle();

    if (existingParent) {
        // Optional address update
        if (parent.address) {
            await supabase
                .from("parents")
                .update({ address: parent.address })
                .eq("id", existingParent.id);
        }

        // Ensure academy mapping exists
        await supabase
            .from("parent_academy_map")
            .upsert({
                parent_id: existingParent.id,
                academy_id: academyId,
            });

        return existingParent.id;
    }

    // 2️⃣ Create new parent
    const { data: newParent, error: parentError } = await supabase
        .from("parents")
        .insert({
            auth_user_id: authUserId,
            address: parent.address || null,
        })
        .select("id")
        .single();

    if (parentError) throw new Error(parentError.message);

    // 3️⃣ Map parent to academy
    const { error: mapError } = await supabase
        .from("parent_academy_map")
        .insert({
            parent_id: newParent.id,
            academy_id: academyId,
        });

    if (mapError) throw new Error(mapError.message);

    return newParent.id;
}

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

        // Permission check
        if (![ROLES.ACADEMY, ROLES.ADMIN].includes(role)) {
            return error("You do not have permission to create students");
        }

        // Resolve internal academy UUID
        const { data: academy, error: academyError } = await supabase
            .from("academies")
            .select("id")
            .eq("academy_id", academyExternalId)
            .single();

        if (academyError || !academy) {
            return error("Academy not found for this user");
        }

        const body = await req.json();
        const {
            first_name,
            last_name,
            date_of_birth,
            registration_no,
            aadhar_no,
            roll_no,
            class_name,
            class_section,
            academic_year,
            parent_id,
            updated_parent,
            new_parents = [],
        } = body;

        if (!first_name || !date_of_birth || !registration_no || !class_name || !academic_year) {
            return error("Missing required student fields");
        }

        // Enforce 1 parent per student
        if ((parent_id ? 1 : 0) + new_parents.length > 1) {
            return error("One student can have only one parent");
        }

        // Uniqueness checks
        const { data: existingReg } = await supabase
            .from(TABLES.STUDENTS)
            .select("id")
            .eq("registration_no", registration_no)
            .maybeSingle();

        if (existingReg) return error("Student with this registration number already exists");

        if (aadhar_no) {
            const { data: existingAadhar } = await supabase
                .from(TABLES.STUDENTS)
                .select("id")
                .eq("aadhar_no", aadhar_no)
                .maybeSingle();

            if (existingAadhar) return error("Student with this Aadhar number already exists");
        }

        // Generate student_id
        let student_id = "";
        for (let i = 0; i < 5; i++) {
            const candidate = generateUniqueStudentId();
            const { data } = await supabase
                .from(TABLES.STUDENTS)
                .select("id")
                .eq("student_id", candidate)
                .maybeSingle();

            if (!data) {
                student_id = candidate;
                break;
            }
        }

        if (!student_id) return error("Failed to generate unique student ID");

        // Create student
        const { data: student, error: studentError } = await supabase
            .from(TABLES.STUDENTS)
            .insert({
                academy_id: academy.id,
                student_id,
                registration_no,
                aadhar_no,
                first_name,
                last_name,
                date_of_birth,
                roll_no,
                class_name,
                class_section,
                academic_year,
                is_active: true,
            })
            .select()
            .single();

        if (studentError) return error(studentError.message);

        // Parent handling
        let finalParentId: string | null = null;

        if (parent_id) {
            finalParentId = parent_id;

            if (updated_parent?.address) {
                await supabase
                    .from("parents")
                    .update({ address: updated_parent.address })
                    .eq("id", parent_id);
            }
        } else if (new_parents.length === 1) {
            finalParentId = await getOrCreateParent(
                supabase,
                academy.id,
                new_parents[0]
            );
        }

        // Parent → Student mapping
        if (finalParentId) {
            const { error: mapError } = await supabase
                .from("parent_student_map")
                .insert({
                    parent_id: finalParentId,
                    student_id: student.id,
                    relationship:
                        updated_parent?.relationship ||
                        new_parents[0]?.relationship ||
                        "Guardian",
                });

            if (mapError) return error(mapError.message);
        }

        return success({
            message: "Student created successfully",
            student,
            parent_id: finalParentId,
        });
    } catch (err: any) {
        console.error("createStudent error:", err);
        return error(err.message || "Internal server error", 500);
    }
});
