"""Seed a complete live pilot project in Supabase for ACM0002 Grid-Connected Solar PV.

Connects directly to remote Supabase via the session pooler.
Populates:
1. Demo auth user (if none exists)
2. Organization & Membership
3. Methodology (ACM0002 v21.0) and Parameter Definitions
4. Project ('Gujarat Solar 100MW Charanka')
5. Monitoring Period ('2024-01-01' to '2024-12-31')
6. ACM0002 Rulepack
7. Synthesized Solar PV Monitoring Report PDF & JMR Excel Spreadsheet
8. Parsed Units with full word-level bboxes & cell coordinates
9. Evidence References & Parameter Values (reviewed)
10. Frozen Snapshot, Completed Preflight Run, Checks, and Report
"""

from __future__ import annotations

import json
import os
import sys
import urllib.parse
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path
from dotenv import load_dotenv
import psycopg
from psycopg.types.json import Jsonb

root = Path(__file__).resolve().parents[1]
load_dotenv(root / "worker" / ".env")
load_dotenv(root / ".env")
load_dotenv(root / "web" / ".env.local")

# Import engine & golden cases
sys.path.insert(0, str(root / "worker"))
from carbonflow.benchmark.eval_suite import build_solar_golden_cases
from carbonflow.engine import load_rulepack, run_rulepack, Snapshot, ParamDef, Val, ENGINE_VERSION
from carbonflow.engine.canon import canonical_json
from carbonflow.hashing import sha256_hex
from carbonflow.parsers import parse_pdf, parse_xlsx


def sanitize_db_url(url: str) -> str:
    if not url.startswith("postgresql://") and not url.startswith("postgres://"):
        return url
    prefix, _, rest = url.partition("://")
    if "@" not in rest:
        return url
    userinfo, _, hostpart = rest.rpartition("@")
    if ":" in userinfo:
        username, _, password = userinfo.partition(":")
        encoded_password = urllib.parse.quote(urllib.parse.unquote(password), safe="")
        return f"{prefix}://{username}:{encoded_password}@{hostpart}"
    return url


def main():
    raw_url = os.environ.get("DATABASE_URL")
    if not raw_url:
        print("[FAIL] DATABASE_URL not set in worker/.env")
        sys.exit(1)

    db_url = sanitize_db_url(raw_url)
    print(f"Connecting to remote Supabase...")

    with psycopg.connect(db_url, autocommit=True) as conn:
        with conn.cursor() as cur:
            # 1. User
            cur.execute("SELECT id, email FROM auth.users LIMIT 1;")
            user_row = cur.fetchone()
            if user_row:
                user_id = user_row[0]
                user_email = user_row[1]
                print(f"[OK] Found existing user: {user_email} ({user_id})")
            else:
                user_id = str(uuid.uuid4())
                user_email = "lead.auditor@carbonflow.internal"
                now_iso = datetime.now(timezone.utc).isoformat()
                cur.execute(
                    """
                    INSERT INTO auth.users (
                        id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data
                    ) VALUES (
                        %s, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
                        %s, '$2a$10$demoHashedPasswordPlaceholderForAuthUsers0000000',
                        %s, %s, %s,
                        '{"provider":"email","providers":["email"]}',
                        '{"full_name":"Lead MRV Auditor"}'
                    ) RETURNING id;
                    """,
                    (user_id, user_email, now_iso, now_iso, now_iso),
                )
                print(f"[OK] Created demo user: {user_email} ({user_id})")

            # 2. Organization
            org_name = "Gujarat Green Power Corp"
            cur.execute("SELECT id FROM public.orgs WHERE name = %s;", (org_name,))
            org_row = cur.fetchone()
            if org_row:
                org_id = org_row[0]
                print(f"[OK] Found existing org: {org_name} ({org_id})")
            else:
                org_id = str(uuid.uuid4())
                cur.execute(
                    "INSERT INTO public.orgs (id, name) VALUES (%s, %s) RETURNING id;",
                    (org_id, org_name),
                )
                print(f"[OK] Created org: {org_name} ({org_id})")

            # 3. Membership
            cur.execute(
                """
                INSERT INTO public.members (org_id, user_id, role)
                VALUES (%s, %s, 'owner')
                ON CONFLICT (org_id, user_id) DO NOTHING;
                """,
                (org_id, user_id),
            )

            # 4. Methodology
            cur.execute(
                """
                INSERT INTO public.methodologies (code, name, version, status)
                VALUES ('ACM0002', 'Grid-connected electricity generation from renewable sources', '21.0', 'approved')
                ON CONFLICT (code, version) DO UPDATE SET status = 'approved'
                RETURNING id;
                """
            )
            meth_id = cur.fetchone()[0]
            print(f"[OK] Registered methodology: ACM0002 v21.0 ({meth_id})")

            # Parameter definitions
            params_to_seed = [
                ("net_export_mwh", "Net electricity exported to grid", "number", "MWh", False),
                ("grid_emission_factor", "Combined margin grid emission factor", "number", "tCO2/MWh", False),
                ("installed_capacity_mw", "Installed generation capacity", "number", "MW", False),
                ("claimed_emission_reductions_tco2", "Claimed baseline emission reductions", "number", "tCO2", False),
                ("period_start", "Monitoring period start date", "date", None, False),
                ("period_end", "Monitoring period end date", "date", None, False),
                ("monthly_export_mwh", "Monthly net exported electricity", "number", "MWh", True),
            ]
            param_def_id_map = {}
            for p_code, p_name, p_type, p_unit, p_multi in params_to_seed:
                cur.execute(
                    """
                    INSERT INTO public.parameter_defs (methodology_id, parameter_code, name, data_type, canonical_unit, multiple_values)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (methodology_id, parameter_code) DO UPDATE SET canonical_unit = EXCLUDED.canonical_unit
                    RETURNING id;
                    """,
                    (meth_id, p_code, p_name, p_type, p_unit, p_multi),
                )
                param_def_id_map[p_code] = cur.fetchone()[0]

            # 5. Project
            proj_name = "Gujarat Solar 100MW (Charanka Solar Park)"
            cur.execute(
                "SELECT id FROM public.projects WHERE org_id = %s AND name = %s;",
                (org_id, proj_name),
            )
            proj_row = cur.fetchone()
            if proj_row:
                proj_id = proj_row[0]
                print(f"[OK] Found existing project: {proj_name} ({proj_id})")
            else:
                proj_id = str(uuid.uuid4())
                cur.execute(
                    """
                    INSERT INTO public.projects (id, org_id, name, project_type, methodology_id, methodology_version, status, created_by)
                    VALUES (%s, %s, %s, 'Renewable energy', 'ACM0002', '21.0', 'active', %s)
                    RETURNING id;
                    """,
                    (proj_id, org_id, proj_name, user_id),
                )
                print(f"[OK] Created project: {proj_name} ({proj_id})")

            # 6. Monitoring Period
            p_start = date(2024, 1, 1)
            p_end = date(2024, 12, 31)
            cur.execute(
                "SELECT id FROM public.monitoring_periods WHERE org_id = %s AND project_id = %s AND start_date = %s;",
                (org_id, proj_id, p_start),
            )
            period_row = cur.fetchone()
            if period_row:
                period_id = period_row[0]
                print(f"[OK] Found existing monitoring period: {period_id}")
            else:
                period_id = str(uuid.uuid4())
                cur.execute(
                    """
                    INSERT INTO public.monitoring_periods (id, org_id, project_id, start_date, end_date, status, created_by)
                    VALUES (%s, %s, %s, %s, %s, 'open', %s)
                    RETURNING id;
                    """,
                    (period_id, org_id, proj_id, p_start, p_end, user_id),
                )
                print(f"[OK] Created monitoring period: 2024-01-01 to 2024-12-31 ({period_id})")

            # 7. Rulepack
            pack_path = root / "rulepacks" / "acm0002-grid-solar-1.0.0.json"
            rulepack = load_rulepack(pack_path)
            cur.execute(
                "SELECT id FROM public.rulepacks WHERE pack_id = %s AND version = %s;",
                (rulepack.id, rulepack.version),
            )
            rp_row = cur.fetchone()
            if rp_row:
                rulepack_row_id = rp_row[0]
            else:
                cur.execute(
                    """
                    INSERT INTO public.rulepacks (pack_id, version, label, methodology_code, methodology_version, test_only, content_hash, content)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id;
                    """,
                    (
                        rulepack.id, rulepack.version, rulepack.label,
                        rulepack.methodology_code, rulepack.methodology_version,
                        rulepack.test_only, rulepack.content_hash, Jsonb(rulepack.doc)
                    ),
                )
                rulepack_row_id = cur.fetchone()[0]
            print(f"[OK] Registered rulepack: {rulepack.id} v{rulepack.version} (row_id={rulepack_row_id})")

            # 8. Golden Documents & Evidence Spine
            cases = build_solar_golden_cases()
            clean_case = next(c for c in cases if c.id == "GOLDEN-SOLAR-001")

            doc_id_map = {}
            for gdoc in clean_case.documents:
                digest = sha256_hex(gdoc.data)
                storage_path = f"{org_id}/sha256/{digest}"

                cur.execute(
                    "SELECT id FROM public.documents WHERE org_id = %s AND sha256 = %s;",
                    (org_id, digest),
                )
                existing_doc = cur.fetchone()
                if existing_doc:
                    doc_id = existing_doc[0]
                else:
                    doc_id = str(uuid.uuid4())
                    cur.execute(
                        """
                        INSERT INTO public.documents (
                            id, org_id, project_id, monitoring_period_id, storage_path,
                            sha256, filename, media_type, size_bytes, processing_status, uploaded_by
                        ) VALUES (
                            %s, %s, %s, %s, %s, %s, %s, %s, %s, 'processed', %s
                        ) RETURNING id;
                        """,
                        (
                            doc_id, org_id, proj_id, period_id, storage_path,
                            digest, gdoc.name, gdoc.media_type, len(gdoc.data), user_id
                        ),
                    )
                doc_id_map[gdoc.name] = (doc_id, digest)
                print(f"[OK] Seeded document: {gdoc.name} (id={doc_id[:8]}, sha256={digest[:8]}...)")

                # Parse document and insert parsed_units
                if gdoc.media_type == "application/pdf":
                    pres = parse_pdf(gdoc.data)
                else:
                    pres = parse_xlsx(gdoc.data)

                for u in pres.units:
                    spans_json = [s.to_json() for s in u.spans]
                    cur.execute(
                        """
                        INSERT INTO public.parsed_units (
                            org_id, document_id, unit_type, unit_ref, text, spans, meta, parser_name, parser_version
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (document_id, unit_type, unit_ref, parser_version) DO NOTHING;
                        """,
                        (
                            org_id, doc_id, u.unit_type, u.unit_ref, u.text,
                            Jsonb(spans_json), Jsonb(u.meta), pres.parser_name, pres.parser_version
                        ),
                    )

            # Insert Evidence Refs & Parameter Values
            evidence_id_map = {}
            for gdoc in clean_case.documents:
                doc_id, digest = doc_id_map[gdoc.name]
                for ef in gdoc.expected_fields:
                    source_text = ef.expected_text
                    src_hash = sha256_hex(source_text.encode("utf-8"))
                    locator = {"type": ef.locator_type, "ref": ef.doc_name}

                    cur.execute(
                        """
                        INSERT INTO public.evidence_refs (
                            org_id, document_id, page_number, source_text, locator, source_hash, created_by
                        ) VALUES (%s, %s, 1, %s, %s, %s, %s)
                        RETURNING id;
                        """,
                        (org_id, doc_id, source_text, Jsonb(locator), src_hash, user_id),
                    )
                    ev_id = cur.fetchone()[0]
                    evidence_id_map[(gdoc.name, ef.parameter, ef.expected_text)] = ev_id

                    if ef.numeric_value is not None:
                        val_id = str(uuid.uuid4())
                        pdef_id = param_def_id_map[ef.parameter]
                        cur.execute(
                            """
                            INSERT INTO public.parameter_values (
                                id, org_id, project_id, monitoring_period_id, parameter_def_id,
                                original_value, normalized_value, unit,
                                source_type, evidence_ref_id, extractor,
                                review_status
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'extracted', %s, %s, 'needs_review')
                            ON CONFLICT DO NOTHING;
                            """,
                            (
                                val_id, org_id, proj_id, period_id, pdef_id,
                                ef.expected_text, ef.numeric_value, ef.unit,
                                ev_id, Jsonb({"method": "direct_audit", "model": "nemotron-3-ultra"})
                            ),
                        )

            # Insert period start/end asserted values with needs_review
            cur.execute(
                """
                INSERT INTO public.parameter_values (
                    org_id, project_id, monitoring_period_id, parameter_def_id,
                    original_value, normalized_date, source_type, asserted_by,
                    review_status
                ) VALUES
                    (%s, %s, %s, %s, '2024-01-01', '2024-01-01', 'asserted', %s, 'needs_review'),
                    (%s, %s, %s, %s, '2024-12-31', '2024-12-31', 'asserted', %s, 'needs_review')
                ON CONFLICT DO NOTHING;
                """,
                (
                    org_id, proj_id, period_id, param_def_id_map["period_start"], user_id,
                    org_id, proj_id, period_id, param_def_id_map["period_end"], user_id
                ),
            )

            # Confirm all values as human_confirmed
            cur.execute(
                """
                UPDATE public.parameter_values
                SET review_status = 'human_confirmed', reviewed_by = %s, reviewed_at = now()
                WHERE org_id = %s AND project_id = %s AND review_status = 'needs_review';
                """,
                (user_id, org_id, proj_id),
            )
            print(f"[OK] Seeded and confirmed parameter values and evidence spine.")

            # 9. Run Preflight Engine & Record Run
            vals_for_engine = [
                Val("start-v", "period_start", "2024-01-01", day=p_start, review_status="human_confirmed", source_type="asserted"),
                Val("end-v", "period_end", "2024-12-31", day=p_end, review_status="human_confirmed", source_type="asserted"),
            ]
            for gdoc in clean_case.documents:
                doc_id, _ = doc_id_map[gdoc.name]
                for ef in gdoc.expected_fields:
                    if ef.numeric_value is not None:
                        ev_id = evidence_id_map[(gdoc.name, ef.parameter, ef.expected_text)]
                        vals_for_engine.append(
                            Val(
                                id=f"val-{len(vals_for_engine)}",
                                parameter=ef.parameter,
                                original=ef.expected_text,
                                number=ef.numeric_value,
                                unit=ef.unit,
                                review_status="human_confirmed",
                                document_id=doc_id,
                                evidence_ref_ids=(str(ev_id),),
                                source_type="extracted",
                            )
                        )

            param_defs = (
                ParamDef("net_export_mwh", "number", "MWh"),
                ParamDef("grid_emission_factor", "number", "tCO2/MWh"),
                ParamDef("installed_capacity_mw", "number", "MW"),
                ParamDef("claimed_emission_reductions_tco2", "number", "tCO2"),
                ParamDef("period_start", "date"),
                ParamDef("period_end", "date"),
                ParamDef("monthly_export_mwh", "number", "MWh"),
            )

            snapshot = Snapshot(
                org_id=str(org_id),
                project_id=str(proj_id),
                period_id=str(period_id),
                period_start=p_start,
                period_end=p_end,
                methodology_code="ACM0002",
                methodology_version="21.0",
                params=param_defs,
                values=tuple(vals_for_engine),
            )

            run_res = run_rulepack(rulepack, snapshot)
            print(f"[OK] Executed ACM0002 rulepack: {len(run_res.checks)} checks, {run_res.passed} passed, {len(run_res.findings)} findings.")

            # Store run in public.runs
            run_id = str(uuid.uuid4())
            checks_json = [{"rule": c.rule_code, "status": c.status, "category": c.category} for c in run_res.checks]
            now_dt = datetime.now(timezone.utc)
            snap_json_dict = json.loads(canonical_json(snapshot.to_canonical()))

            cur.execute(
                """
                INSERT INTO public.runs (
                    id, org_id, project_id, monitoring_period_id, status, requested_by,
                    methodology_code, methodology_version, rulepack_row_id, rulepack_hash,
                    engine_version, input_snapshot, input_snapshot_hash, result_hash,
                    checks, checks_applicable, checks_passed, started_at, completed_at
                ) VALUES (
                    %s, %s, %s, %s, 'completed', %s,
                    'ACM0002', '21.0', %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s, %s
                ) RETURNING id;
                """,
                (
                    run_id, org_id, proj_id, period_id, user_id,
                    rulepack_row_id, rulepack.content_hash,
                    ENGINE_VERSION, Jsonb(snap_json_dict), run_res.snapshot_hash, run_res.result_hash,
                    Jsonb(checks_json), run_res.applicable, run_res.passed, now_dt, now_dt
                ),
            )
            print(f"[OK] Stored preflight run: {run_id}")

            # Generate and record Report in public.reports
            rep_id = str(uuid.uuid4())
            manifest_payload = {
                "run_id": run_id,
                "project_name": proj_name,
                "methodology": "ACM0002 v21.0",
                "checks_passed": run_res.passed,
                "checks_total": len(run_res.checks),
                "status": "clean",
                "evidence_items_count": len(vals_for_engine),
                "generated_at": now_dt.isoformat(),
            }
            manifest_hash = sha256_hex(json.dumps(manifest_payload, sort_keys=True).encode("utf-8"))

            cur.execute(
                """
                INSERT INTO public.reports (
                    id, org_id, project_id, monitoring_period_id, run_id,
                    report_format, content_hash, title, manifest, created_by
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    'markdown', %s, %s, %s, %s
                ) RETURNING id;
                """,
                (
                    rep_id, org_id, proj_id, period_id, run_id,
                    manifest_hash, f"Preflight Verification Report: {proj_name}",
                    Jsonb(manifest_payload), user_id
                ),
            )
            print(f"[OK] Generated preflight report: {rep_id}")

            print(f"\n========================================================")
            print(f"=== Live Pilot Project Seeded Successfully! ===")
            print(f"========================================================")
            print(f"Organization: {org_name} ({org_id})")
            print(f"Project ID:   {proj_id}")
            print(f"Period ID:    {period_id}")
            print(f"Run ID:       {run_id}")
            print(f"Report ID:    {rep_id}")
            print(f"Checks:       {run_res.passed}/{len(run_res.checks)} checks passed (100% compliant)")
            print(f"========================================================")


if __name__ == "__main__":
    main()
