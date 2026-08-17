import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function getSupabaseClient() {
  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseKey)
    throw new Error("SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is required.");
  return createClient(supabaseUrl, supabaseKey);
}

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// ── Expanded tech & tool lists for fallback ──────────────────────────────────
const COMMON_TECH = [
  "React", "Angular", "Vue", "Svelte", "Next.js", "Nuxt", "Node.js",
  "Python", "Java", "C#", "C++", "Go", "Rust", "Ruby", "PHP", "Kotlin",
  "Swift", "Dart", "Flutter", "React Native", "TypeScript", "JavaScript",
  "SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis", "DynamoDB",
  "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform", "Ansible",
  "GraphQL", "REST", "gRPC", "Kafka", "RabbitMQ", "Elasticsearch",
  "Tailwind", "SASS", "CSS", "HTML", "Express", "NestJS", "FastAPI",
  "Django", "Flask", "Laravel", "Spring", "Rails", "Supabase", "Firebase",
  "Git", "GitHub Actions", "Jenkins", "CI/CD", "Linux", "Bash",
  "TensorFlow", "PyTorch", "Pandas", "NumPy", "Tableau", "Power BI",
  "Figma", "Adobe XD", "Photoshop", "Illustrator", "After Effects",
  "Premiere", "Blender", "InDesign", "Sketch", "Framer", "Webflow",
];

const COMMON_TOOLS = [
  "Figma", "Sketch", "Adobe XD", "Photoshop", "Illustrator", "InDesign",
  "After Effects", "Premiere", "Blender", "Cinema 4D", "Jira", "Trello",
  "Slack", "Notion", "Confluence", "Git", "GitHub", "GitLab", "Bitbucket",
  "VS Code", "IntelliJ", "WebStorm", "PyCharm", "Postman", "Insomnia",
  "Docker", "Kubernetes", "Terraform", "Ansible", "Jenkins", "CircleCI",
  "Framer", "Webflow", "WordPress", "Shopify", "HubSpot", "Salesforce",
  "Google Analytics", "Mixpanel", "Amplitude", "Hotjar", "Miro",
];

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const { candidate_id, resume_text } = await req.json();

    if (!candidate_id || !resume_text) {
      return NextResponse.json(
        { error: "Missing candidate_id or resume_text" },
        { status: 400 },
      );
    }

    let extractedData: Record<string, any> = {};

    // ── LLM enrichment ───────────────────────────────────────────────────
    if (openai) {
      try {
        // Send up to 8000 chars — markdown is more compact than raw text
        const textChunk = resume_text.substring(0, 8000);

        const completion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content:
                "You are a recruitment data parser. Extract structured fields from a CV/resume. " +
                "The input may be Markdown with headings, lists, and tables. " +
                "Use section headings (## Work Experience, ## Education, ## Skills, etc.) to guide extraction. " +
                "Return ONLY valid JSON. Never include explanations or markdown fences.",
            },
            {
              role: "user",
              content: `CV Text (Markdown):\n${textChunk}\n\n---\n\nExtract this JSON structure. Be thorough — extract everything available:\n\n` +
                `{\n` +
                `  "technologies": [{ "name": "React", "years": 2 }],    // programming languages, frameworks, databases, cloud, devops\n` +
                `  "tools": [{ "name": "Figma", "years": 3 }],           // design tools, project mgmt, analytics, IDEs\n` +
                `  "work_history": [{ "company": "Google", "title": "Senior Engineer", "start_date": "2020-01", "end_date": "2023-06", "years": 3, "brief": "Led team of 5..." }],\n` +
                `  "years_experience": 8,                                  // total years (number only)\n` +
                `  "education": [{ "degree": "BSc Computer Science", "school": "Cairo University", "year": "2018" }],\n` +
                `  "certifications": [{ "name": "AWS Solutions Architect", "issuer": "Amazon", "year": "2022" }],\n` +
                `  "languages": [{ "language": "Arabic", "proficiency": "Native" }, { "language": "English", "proficiency": "Fluent" }],\n` +
                `  "soft_skills": ["Leadership", "Communication", "Problem Solving"],  // non-technical skills\n` +
                `  "industry_experience": ["FinTech", "Healthcare"],     // industries the candidate has worked in\n` +
                `  "seniority_level": "Senior",                          // Junior | Mid-Level | Senior | Lead | Manager | Director | Executive\n` +
                `  "summary": "Experienced full-stack developer..."       // 1-2 sentence professional summary\n` +
                `}\n\n` +
                `IMPORTANT:\n` +
                `- Use section headings to find Education, Certifications, Languages blocks\n` +
                `- "years" in work_history should be number of years at that specific role (calculate from dates if available, otherwise estimate)\n` +
                `- "years_experience" should be TOTAL years across all roles\n` +
                `- "start_date" / "end_date" use YYYY-MM format when possible, otherwise YYYY\n` +
                `- Omit arrays/objects that have no data (don't include empty arrays)\n` +
                `- For Arabic names/companies, preserve the original text`,
            },
          ],
          response_format: { type: "json_object" },
        });

        extractedData = JSON.parse(completion.choices[0].message.content || "{}");
      } catch (e) {
        console.error("OpenAI Parsing Failed:", e);
      }
    }

    // ── Regex fallback when LLM unavailable or failed ────────────────────
    if (Object.keys(extractedData).length === 0) {
      const foundTech = COMMON_TECH
        .filter((t) => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(resume_text))
        .map((t) => ({ name: t, years: 1 }));

      const foundTools = COMMON_TOOLS
        .filter((t) => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(resume_text))
        .map((t) => ({ name: t, years: 1 }));

      // Date range extraction for work history
      const historyRegex =
        /((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\s*\d{4}\s*[-–to]\s*(Present|Now|Current|\d{4}))/gi;
      const work_history: Array<Record<string, any>> = [];
      let match: RegExpExecArray | null;
      while ((match = historyRegex.exec(resume_text)) !== null) {
        const start = Math.max(0, match.index - 80);
        const end = Math.min(resume_text.length, match.index + 120);
        const context = resume_text.substring(start, end).replace(/\s+/g, " ").trim();
        work_history.push({ company: "Unknown", title: context, years: 1 });
      }

      extractedData = {
        technologies: foundTech,
        tools: foundTools,
        work_history: work_history.slice(0, 5),
      };
    }

    // ── Flatten soft_skills array for DB storage ─────────────────────────
    if (Array.isArray(extractedData.soft_skills)) {
      extractedData.soft_skills = extractedData.soft_skills.join(", ");
    }

    // ── Update candidate in DB ───────────────────────────────────────────
    const updatePayload: Record<string, any> = {};

    // Only include fields that exist in extractedData
    for (const key of [
      "technologies",
      "tools",
      "work_history",
      "years_experience",
      "education",
      "certifications",
      "languages",
      "soft_skills",
      "industry_experience",
      "seniority_level",
      "summary",
    ]) {
      if (extractedData[key] !== undefined && extractedData[key] !== null) {
        updatePayload[key] = extractedData[key];
      }
    }

    // Always update years_experience_total if years_experience was extracted
    if (extractedData.years_experience && !updatePayload.years_experience_total) {
      updatePayload.years_experience_total = extractedData.years_experience;
    }

    if (Object.keys(updatePayload).length > 0) {
      const { error } = await supabase
        .from("candidates")
        .update(updatePayload)
        .eq("id", candidate_id);

      if (error) throw error;
    }

    return NextResponse.json({
      success: true,
      data: extractedData,
      fields_enriched: Object.keys(updatePayload),
    });
  } catch (err: any) {
    console.error("Enrichment Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
