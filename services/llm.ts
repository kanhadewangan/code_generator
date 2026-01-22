import OpenAI from "openai";


const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY!,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "codegen-to-files",
  },
});


function orchestrator(title: string) {
  return `You are an automated infrastructure code generator for a secure, sandboxed execution environment.
Based on the project title: "${title}", generate ONLY these infrastructure files:
- Dockerfile
- .dockerignore
- docker-compose.yml

STRICT RULES:
- Return ONLY valid JSON
- Do NOT include explanations or markdown
- Do NOT generate application source code
- Do NOT reference or recreate application files
- Do NOT add extra keys or text

JSON OUTPUT SHAPE (MUST MATCH):
{
  "files": [
    { "path": "Dockerfile", "content": "string" },
    { "path": ".dockerignore", "content": "string" },
    { "path": "docker-compose.yml", "content": "string" }
  ]
}

INFRA REQUIREMENTS:
- Use a minimal base image based on the app type 
- Multi-stage build; final image runs as NON-ROOT user
- Do NOT bake secrets or .env files
- Expose only the required app port
- Keep OS packages minimal; no shells unless required

COMPOSE SECURITY:
- Bind services to 127.0.0.1
- Set CPU and memory limits
- Prefer read-only root filesystem; disable privilege escalation
- Do NOT mount the Docker socket
- Avoid writable volumes unless necessary

FILE RULES:
- Each file is a separate entry in "files"
- Never combine multiple files in one content string
- Do NOT mention other files inside file contents
- Paths must be exactly: Dockerfile, .dockerignore, docker-compose.yml

Generate the infrastructure files now.`;
}

function codeGenerator(title: string, description: string, initialPrompt: string) {
  return `You are a project generation orchestrator.

Your task is to generate a project based on the following requirements:
- Title: ${title}
- Description: ${description}
- Initial Prompt: ${initialPrompt}

Return ONLY valid JSON with this schema:
{
  "files": [{ "path": "string", "content": "string" }]
}

IMPORTANT:
- Generate ONLY application source code
- Do NOT generate Dockerfile, docker-compose.yml, or .dockerignore
- Each file must have a valid path and content
- Ensure all files are properly formatted`

}

export { orchestrator ,codeGenerator};

export default client;