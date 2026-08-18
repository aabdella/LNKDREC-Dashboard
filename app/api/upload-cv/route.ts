import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { inspectPdf, emptyResult, type PdfInspectionResult } from "@/lib/pdfInspector";

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function getSupabaseForUploadCv() {
  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseKey)
    throw new Error("SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is required.");
  return createClient(supabaseUrl, supabaseKey);
}

// ── Regex helpers (no backslash escaping issues) ─────────────────────────────
const R = {
  email: new RegExp("[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+[.][a-zA-Z0-9_-]+", "i"),
  phone: new RegExp("[+]?[0-9][0-9 \\-().]{8,15}[0-9]", "i"),
  linkedin: new RegExp("linkedin[.]com/in/[a-zA-Z0-9_%\\-]+", "i"),
  behance: new RegExp("behance[.]net/[a-zA-Z0-9_\\-]+", "i"),
  dribbble: new RegExp("dribbble[.]com/[a-zA-Z0-9_\\-]+", "i"),
  github: new RegExp("github[.]com/[a-zA-Z0-9_\\-]+", "i"),
  // Broader location detection — common cities/regions
  location: new RegExp(
    "Cairo|Alexandria|Giza|Remote|Egypt|Maadi|Nasr City|October|Zayed|Heliopolis|Dokki|New Cairo|Shorouk|Obour|Smart Village|Dubai|Abu Dhabi|Sharjah|Riyadh|Jeddah|Doha|Kuwait|Manama|Muscat|Amman|Beirut|London|Berlin|Paris|New York|San Francisco|Toronto|Sydney",
    "i",
  ),
  exp: new RegExp("([0-9]+)[+]?[ \\t]*(years?|yrs?)", "i"),
};

function matchesTech(tech: string, text: string): boolean {
  try {
    const safe = tech
      .split("+").join("[+]")
      .split(".").join("[.]")
      .split("(").join("[(]")
      .split(")").join("[)]")
      .split("#").join("[#]");
    return new RegExp(safe, "i").test(text);
  } catch {
    return false;
  }
}

// ── Expanded tech & role taxonomies ──────────────────────────────────────────

const TECH_KEYWORDS = [
  "React", "Next.js", "Node.js", "TypeScript", "JavaScript", "Python", "Django",
  "Flask", "SQL", "PostgreSQL", "MongoDB", "AWS", "Docker", "Kubernetes", "Git",
  "Figma", "Adobe XD", "Photoshop", "Illustrator", "InDesign", "After Effects",
  "Premiere", "Blender", "Unity", "C#", "C++", "Java", "Spring", "Kotlin",
  "Swift", "Flutter", "Dart", "Go", "Rust", "Ruby", "Rails", "PHP", "Laravel",
  "Vue", "Angular", "Svelte", "GraphQL", "Redis", "Terraform", "Ansible",
  "Jenkins", "GitHub Actions", "CI/CD", "Linux", "Bash", "PowerShell",
  "Tailwind", "SASS", "CSS", "HTML", "Express", "NestJS", "FastAPI", "Supabase",
  "Firebase", "Prisma", "MySQL", "DynamoDB", "Elasticsearch", "Kafka",
  "RabbitMQ", "gRPC", "REST", "Webpack", "Vite", "Three.js", "WebGL",
  "TensorFlow", "PyTorch", "Pandas", "NumPy", "Tableau", "Power BI", "Excel",
  "Jira", "Confluence", "Figma", "Notion", "Slack", "VS Code", "Vim",
  "Android", "iOS", "React Native", "Xamarin", "Electron", "Tauri",
];

const ROLE_TITLES = [
  "Graphic Designer", "UI Designer", "UX Designer", "Product Designer",
  "Frontend Developer", "Backend Developer", "Full Stack Developer",
  "Art Director", "Senior Designer", "Junior Designer",
  "DevOps Engineer", "Data Engineer", "Data Scientist", "Machine Learning Engineer",
  "QA Engineer", "QA Lead", "Test Automation Engineer",
  "Project Manager", "Product Manager", "Scrum Master", "Tech Lead",
  "Engineering Manager", "CTO", "VP of Engineering",
  "Software Engineer", "Software Developer", "Web Developer", "Mobile Developer",
  "iOS Developer", "Android Developer", "React Native Developer",
  "Cloud Architect", "Solutions Architect", "System Administrator",
  "Security Engineer", "Network Engineer", "Database Administrator",
  "Business Analyst", "Technical Writer", "IT Support",
  "Content Creator", "Video Editor", "Motion Designer", "3D Artist",
  "Copywriter", "Marketing Manager", "SEO Specialist", "Social Media Manager",
  "Account Manager", "Sales Representative", "Customer Success Manager",
];

// ── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseForUploadCv();
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const filePath = `unvetted/${fileName}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from("candidates_resumes")
      .upload(filePath, buffer, {
        contentType: file.type || "application/pdf",
        upsert: false,
      });
    if (uploadError) {
      return NextResponse.json({ error: "Upload failed: " + uploadError.message }, { status: 500 });
    }
    const { data } = supabase.storage.from("candidates_resumes").getPublicUrl(filePath);
    const publicUrl = data?.publicUrl ?? "";

    // ── pdf-inspector: classify + extract ──────────────────────────────────
    let inspection: PdfInspectionResult;
    try {
      inspection = await inspectPdf(buffer);
    } catch {
      inspection = emptyResult();
    }

    // Use raw text for regex extraction (more content, better pattern matches).
    // Structured markdown is richer for LLM enrichment — store that in resume_text.
    const rawText = inspection.text || "";
    const pdfText = inspection.markdown || rawText;

    // ── Regex extraction (use rawText for more content, better matches) ────
    const emailMatch = rawText.match(R.email);
    const phoneMatch = rawText.match(R.phone);
    const linkedinMatch = rawText.match(R.linkedin);
    const behanceMatch = rawText.match(R.behance);
    const dribbbleMatch = rawText.match(R.dribbble);
    const githubMatch = rawText.match(R.github);
    const locationMatch = rawText.match(R.location);
    const expMatch = rawText.match(R.exp);

    const linkedinUrl = linkedinMatch ? `https://${linkedinMatch[0]}` : "";
    const portfolioUrl =
      behanceMatch  ? `https://${behanceMatch[0]}` :
      dribbbleMatch ? `https://${dribbbleMatch[0]}` :
      githubMatch   ? `https://${githubMatch[0]}` : "";
    const location = locationMatch ? locationMatch[0] : "Remote";
    let yearsExp = expMatch ? parseInt(expMatch[1]) : 0;
    if (yearsExp > 40) yearsExp = 0;

    // Role detection from expanded taxonomy (use rawText for broader matching)
    const titlePattern = ROLE_TITLES.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    const titleMatch = rawText.match(new RegExp(`(${titlePattern})`, "i"));
    const title = titleMatch ? titleMatch[0] : "Candidate";

    // Name detection: prefer the first non-empty heading or line
    // Strip markdown heading markers (#, ##, etc.) instead of skipping those lines entirely
    const lines = pdfText
      .split("\n")
      .map((l) => l.trim())
      .map((l) => l.replace(/^#{1,6}\s+/, ""))
      .filter((l) => l.length > 0 && l.length < 100 && !l.startsWith("http"));
    const potentialName =
      lines.length > 0
        ? lines[0].substring(0, 100)
        : file.name.replace(/\.pdf$/i, "");

    // Technologies (use rawText for broader matching)
    const technologies = TECH_KEYWORDS
      .filter((t) => matchesTech(t, rawText))
      .map((t) => ({ name: t, years: 1 }));

    // Work history — regex date ranges with surrounding context
    const workHistory: Array<{ company: string; title: string; years: number }> = [];
    const months = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec";
    const dateRangeRegex = new RegExp(
      `((${months})?[ \\t]*[0-9]{4}[ \\t]*(-|to|–|—)[ \\t]*(Present|Now|Current|(${months})?[ \\t]*[0-9]{4}))`,
      "gi",
    );
    let m: RegExpExecArray | null;
    while ((m = dateRangeRegex.exec(rawText)) !== null) {
      const ctx = rawText
        .substring(Math.max(0, m.index - 80), Math.min(rawText.length, m.index + 120))
        .replace(/\s+/g, " ")
        .trim();
      workHistory.push({ company: "Unknown Company", title: ctx, years: 1 });
    }

    // ── Build extracted candidate ──────────────────────────────────────────
    const extractedData = {
      full_name: potentialName,
      title,
      email: emailMatch ? emailMatch[0] : "",
      phone: phoneMatch ? phoneMatch[0] : "",
      location,
      years_experience_total: yearsExp,
      linkedin_url: linkedinUrl,
      portfolio_url: portfolioUrl,
      resume_url: publicUrl,
      resume_text: pdfText,
      source: "PDF Upload",
      match_score: 10,
      match_reason: "Parsed from PDF. Please review extracted fields.",
      status: "New",
      uploaded_at: new Date().toISOString(),
      technologies,
      tools: [],
      work_history: workHistory.slice(0, 3),
      // pdf-inspector metadata — exposed for UI/triage
      _pdf_meta: {
        pdf_type: String(inspection.pdfType),
        confidence: inspection.confidence,
        page_count: inspection.pageCount,
        pages_needing_ocr: inspection.pagesNeedingOcr,
        has_scanned_pages: inspection.hasScannedPages,
        is_fully_scanned: inspection.isFullyScanned,
        pages_with_tables: inspection.pagesWithTables,
        pages_with_columns: inspection.pagesWithColumns,
      },
    };

    return NextResponse.json({
      success: true,
      candidate: extractedData,
      table: "none",
      extracted_only: true,
    });
  } catch (err: any) {
    console.error("Server Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
