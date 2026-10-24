import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSession } from "@/lib/context";

const ALLOWED_MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
};

const MAX_FILE_BYTES = 52428800; // 50 MB

export async function POST(req: NextRequest) {
  try {
    const { supabase, org, user, guest } = await getSession();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;
    const monitoringPeriodId = (formData.get("monitoringPeriodId") as string | null) || null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const mediaType = ALLOWED_MIME_TYPES[ext];
    if (!mediaType) {
      return NextResponse.json(
        { error: "Unsupported file type. Only PDF, XLSX, and CSV are accepted." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }
    if (buffer.length > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `File exceeds maximum allowed size of 50 MB (${(buffer.length / (1024 * 1024)).toFixed(1)} MB)` },
        { status: 400 }
      );
    }

    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

    if (guest || !org || !user) {
      // Guest demo simulation
      return NextResponse.json({
        ok: true,
        guest: true,
        document: {
          id: `sim-doc-${Date.now()}`,
          filename: file.name,
          media_type: mediaType,
          size_bytes: buffer.length,
          sha256,
          processing_status: "uploaded",
          created_at: new Date().toISOString(),
        },
      });
    }

    if (org.role === "viewer") {
      return NextResponse.json({ error: "Viewers do not have permission to upload documents." }, { status: 403 });
    }

    const storagePath = `${org.id}/sha256/${sha256}`;

    // Upload to Supabase Storage bucket 'documents'
    const { error: storageErr } = await supabase.storage.from("documents").upload(storagePath, buffer, {
      contentType: mediaType,
      upsert: true,
    });

    if (storageErr) {
      console.error("Storage upload error:", storageErr);
      // If error is not duplicate, report error
      if (!storageErr.message?.includes("already exists")) {
        return NextResponse.json({ error: `Storage error: ${storageErr.message}` }, { status: 500 });
      }
    }

    // Check for duplicate in this org
    const { data: duplicates } = await supabase
      .from("documents")
      .select("id")
      .eq("org_id", org.id)
      .eq("sha256", sha256)
      .limit(1);

    const duplicateOfId = duplicates && duplicates.length > 0 ? duplicates[0].id : null;

    // Register document in public.documents
    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .insert({
        org_id: org.id,
        project_id: projectId,
        monitoring_period_id: monitoringPeriodId,
        storage_path: storagePath,
        sha256,
        filename: file.name.slice(0, 255),
        media_type: mediaType,
        size_bytes: buffer.length,
        processing_status: "uploaded",
        duplicate_of_id: duplicateOfId,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (docErr || !doc) {
      console.error("Document insert error:", docErr);
      return NextResponse.json({ error: docErr?.message || "Failed to register document" }, { status: 500 });
    }

    // Enqueue parse_document job
    const { error: jobErr } = await supabase.from("jobs").insert({
      org_id: org.id,
      document_id: doc.id,
      kind: "parse_document",
      payload: {},
    });

    if (jobErr) {
      console.error("Job enqueue error:", jobErr);
    }

    return NextResponse.json({
      ok: true,
      document: doc,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal upload error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
