SciSketch Integration Guidelines

Project Context

You are integrating **SciSketch** (an open-source AI-powered biological
diagram generator) into an existing **BioSketch** web application.
SciSketch analyzes scientific text and generates visual diagrams with
biological entities (proteins, molecules, organs) connected by
relationships (activation, inhibition, conversion).

What is SciSketch?

**SciSketch** is a Python-based backend service that:

- Extracts biological entities from scientific abstracts using GPT/LLM

- Identifies relationships between entities (activation, inhibition,
  conversion, etc.)

- Matches entities to icons from a 50,000+ biological icon database

- Generates diagram layouts with optimal node positioning

- Outputs structured data (JSON) for visualization

**GitHub Repository**:
[[https://github.com/stevensusas/SciSketch]{.underline}](https://github.com/stevensusas/SciSketch)\
**License**: Open source (no restrictive license)

Integration Architecture

Current BioSketch Stack

- **Frontend**: React + TypeScript + Vite

- **Backend**: Node.js + Express + tRPC

- **Database**: MySQL/PostgreSQL (for icons and user data)

- **Hosting**: Lovable platform

SciSketch Integration Options

**RECOMMENDED: Option 1 - TypeScript Reimplementation (Already Done in
Reference)**

- Port SciSketch\'s Python logic to TypeScript/Node.js

- Integrate directly into existing Express backend

- Use modern LLM APIs (Gemini, GPT-4, Claude)

- Single codebase, easier maintenance

**Alternative: Option 2 - Python Microservice**

- Keep SciSketch as separate Python service

- Deploy on Railway/Render/Fly.io

- BioSketch calls SciSketch via REST API

- Requires managing two deployments

Core SciSketch Functionality to Integrate

1\. Entity Extraction

**Purpose**: Identify biological components from text

**Input**: Scientific abstract or paper text

> \"The MAPK pathway involves sequential phosphorylation. Growth factors
> activate RAS, which activates RAF kinase. RAF phosphorylates MEK,
> which then phosphorylates ERK.\"

**Output**: List of entities with types

> \[
>
> {\"name\": \"Growth Factor\", \"type\": \"molecule\"},
>
> {\"name\": \"RAS\", \"type\": \"protein\"},
>
> {\"name\": \"RAF\", \"type\": \"enzyme\"},
>
> {\"name\": \"MEK\", \"type\": \"enzyme\"},
>
> {\"name\": \"ERK\", \"type\": \"enzyme\"}
>
> \]

**LLM Prompt Template**:

> You are a biological entity extraction expert. Extract all biological
> entities from the following text and classify them into types:
> protein, molecule, organ, cell, enzyme, pathway, process, structure.
>
> Text: {input_text}
>
> Return a JSON array with format: \[{\"name\": \"entity_name\",
> \"type\": \"entity_type\"}\]

2\. Relationship Detection

**Purpose**: Identify connections between entities

**Input**: Text + extracted entities

**Output**: Relationships with types

> \[
>
> {\"from\": \"Growth Factor\", \"to\": \"RAS\", \"type\":
> \"activation\", \"label\": \"activates\"},
>
> {\"from\": \"RAS\", \"to\": \"RAF\", \"type\": \"activation\",
> \"label\": \"activates\"},
>
> {\"from\": \"RAF\", \"to\": \"MEK\", \"type\": \"activation\",
> \"label\": \"phosphorylates\"},
>
> {\"from\": \"MEK\", \"to\": \"ERK\", \"type\": \"activation\",
> \"label\": \"phosphorylates\"}
>
> \]

**Relationship Types**:

- [activation]{.underline} - One entity activates another

- [inhibition]{.underline} - One entity inhibits another

- [conversion]{.underline} - One entity converts to another

- [transport]{.underline} - One entity transports another

- [binding]{.underline} - Two entities bind together

- [arrow]{.underline} - Generic directional relationship

**LLM Prompt Template**:

> Given these biological entities: {entities}
>
> And this text: {input_text}
>
> Identify all relationships between entities. For each relationship,
> specify:
>
> \- from: source entity name
>
> \- to: target entity name
>
> \- type: activation, inhibition, conversion, transport, binding, or
> arrow
>
> \- label: short description (e.g., \"activates\", \"inhibits\",
> \"converts to\")
>
> Return JSON array: \[{\"from\": \"\...\", \"to\": \"\...\", \"type\":
> \"\...\", \"label\": \"\...\"}\]

3\. Icon Matching

**Purpose**: Find appropriate visual icons for each entity

**Input**: Entity name + type **Output**: Icon URL from database

**Database Schema** (you need to create):

> CREATE TABLE icons (
>
> id INT PRIMARY KEY,
>
> name VARCHAR(255),
>
> category VARCHAR(100), \-- protein, molecule, organ, cell, etc.
>
> keywords TEXT, \-- searchable keywords
>
> tier INT, \-- 1 (exact match), 2 (category match), 3 (generic)
>
> icon_url VARCHAR(500), \-- CDN URL to SVG icon
>
> source VARCHAR(100) \-- bioicons, flaticon, etc.
>
> );

**Matching Algorithm**:

1.  **Tier 1 (Exact Match)**: Search for exact entity name in database

2.  **Tier 2 (Category Match)**: Search by entity type (e.g., all
    \"protein\" icons)

3.  **Tier 3 (Generic Fallback)**: Use generic icon for that category

**LLM-Assisted Matching** (if database search fails):

> Given entity: \"{entity_name}\" of type \"{entity_type}\"
>
> From this list of available icons:
>
> {icon_list}
>
> Which icon best represents this entity? Return the icon ID.

4\. Layout Generation

**Purpose**: Position nodes optimally to minimize overlaps

**Input**: Entities + relationships

**Output**: X,Y coordinates for each node

> \[
>
> {\"id\": \"elem_001\", \"x\": 100, \"y\": 200},
>
> {\"id\": \"elem_002\", \"x\": 300, \"y\": 200},
>
> {\"id\": \"elem_003\", \"x\": 500, \"y\": 200}
>
> \]

**Layout Algorithms**:

- **Hierarchical**: Left-to-right or top-to-bottom flow (for pathways)

- **Force-Directed**: Physics simulation to spread nodes apart

- **Circular**: Arrange nodes in a circle (for cycles)

Implementation Steps for Lovable

Step 1: Set Up Backend API Endpoint

Create a new tRPC procedure or REST endpoint:

> // server/routes/diagram.ts or server/routers.ts
>
> export const diagramRouter = router({
>
> generate: protectedProcedure
>
> .input(z.object({
>
> paperContent: z.string(),
>
> generationMethod: z.enum(\[\'text\', \'image\'\]),
>
> }))
>
> .mutation(async ({ input, ctx }) =\> {
>
> // 1. Extract entities
>
> const entities = await extractEntities(input.paperContent);
>
> // 2. Detect relationships
>
> const relationships = await detectRelationships(
>
> input.paperContent,
>
> entities
>
> );
>
> // 3. Match icons
>
> const entitiesWithIcons = await matchIcons(entities);
>
> // 4. Generate layout
>
> const layout = await generateLayout(
>
> entitiesWithIcons,
>
> relationships
>
> );
>
> // 5. Save to database
>
> const diagram = await db.diagram.create({
>
> userId: ctx.user.id,
>
> title: extractTitle(input.paperContent),
>
> elements: entitiesWithIcons,
>
> connections: relationships,
>
> layout: layout,
>
> });
>
> return diagram;
>
> }),
>
> });

Step 2: Implement Entity Extraction

> // server/services/sciSketchService.ts
>
> import { invokeLLM } from \'./llmService\';
>
> export async function extractEntities(text: string) {
>
> const prompt = \`You are a biological entity extraction expert.
> Extract all biological entities from the following text and classify
> them into types: protein, molecule, organ, cell, enzyme, pathway,
> process, structure.
>
> Text: \${text}
>
> Return a JSON array with format: \[{\"name\": \"entity_name\",
> \"type\": \"entity_type\"}\]\`;
>
> const response = await invokeLLM({
>
> messages: \[
>
> { role: \'system\', content: \'You are a biological entity extraction
> expert.\' },
>
> { role: \'user\', content: prompt }
>
> \],
>
> response_format: {
>
> type: \'json_schema\',
>
> json_schema: {
>
> name: \'entity_extraction\',
>
> strict: true,
>
> schema: {
>
> type: \'object\',
>
> properties: {
>
> entities: {
>
> type: \'array\',
>
> items: {
>
> type: \'object\',
>
> properties: {
>
> name: { type: \'string\' },
>
> type: { type: \'string\', enum: \[\'protein\', \'molecule\',
> \'organ\', \'cell\', \'enzyme\', \'pathway\', \'process\',
> \'structure\'\] }
>
> },
>
> required: \[\'name\', \'type\'\]
>
> }
>
> }
>
> },
>
> required: \[\'entities\'\]
>
> }
>
> }
>
> }
>
> });
>
> const result = JSON.parse(response.choices\[0\].message.content);
>
> return result.entities;
>
> }

Step 3: Implement Relationship Detection

> export async function detectRelationships(text: string, entities:
> Entity\[\]) {
>
> const entityNames = entities.map(e =\> e.name).join(\', \');
>
> const prompt = \`Given these biological entities: \${entityNames}
>
> And this text: \${text}
>
> Identify all relationships between entities. For each relationship,
> specify:
>
> \- from: source entity name (must be from the entity list)
>
> \- to: target entity name (must be from the entity list)
>
> \- type: activation, inhibition, conversion, transport, binding, or
> arrow
>
> \- label: short description (e.g., \"activates\", \"inhibits\",
> \"converts to\")
>
> Return JSON array: \[{\"from\": \"\...\", \"to\": \"\...\", \"type\":
> \"\...\", \"label\": \"\...\"}\]\`;
>
> const response = await invokeLLM({
>
> messages: \[
>
> { role: \'system\', content: \'You are a biological relationship
> detection expert.\' },
>
> { role: \'user\', content: prompt }
>
> \],
>
> response_format: {
>
> type: \'json_schema\',
>
> json_schema: {
>
> name: \'relationship_detection\',
>
> strict: true,
>
> schema: {
>
> type: \'object\',
>
> properties: {
>
> relationships: {
>
> type: \'array\',
>
> items: {
>
> type: \'object\',
>
> properties: {
>
> from: { type: \'string\' },
>
> to: { type: \'string\' },
>
> type: { type: \'string\', enum: \[\'activation\', \'inhibition\',
> \'conversion\', \'transport\', \'binding\', \'arrow\'\] },
>
> label: { type: \'string\' }
>
> },
>
> required: \[\'from\', \'to\', \'type\', \'label\'\]
>
> }
>
> }
>
> },
>
> required: \[\'relationships\'\]
>
> }
>
> }
>
> }
>
> });
>
> const result = JSON.parse(response.choices\[0\].message.content);
>
> return result.relationships;
>
> }

Step 4: Implement Icon Matching

> export async function matchIcons(entities: Entity\[\]) {
>
> const entitiesWithIcons = \[\];
>
> for (const entity of entities) {
>
> // Tier 1: Exact match
>
> let icon = await db.icon.findFirst({
>
> where: {
>
> name: { equals: entity.name, mode: \'insensitive\' },
>
> tier: 1
>
> }
>
> });
>
> // Tier 2: Category match
>
> if (!icon) {
>
> icon = await db.icon.findFirst({
>
> where: {
>
> category: entity.type,
>
> tier: 2
>
> }
>
> });
>
> }
>
> // Tier 3: Generic fallback
>
> if (!icon) {
>
> icon = await db.icon.findFirst({
>
> where: {
>
> category: entity.type,
>
> tier: 3
>
> }
>
> });
>
> }
>
> entitiesWithIcons.push({
>
> \...entity,
>
> iconUrl: icon?.icon_url \|\| \'/default-icon.svg\',
>
> tier: icon?.tier \|\| 3
>
> });
>
> }
>
> return entitiesWithIcons;
>
> }

Step 5: Implement Layout Generation

> export async function generateLayout(entities: Entity\[\],
> relationships: Relationship\[\]) {
>
> // Simple hierarchical layout (left-to-right)
>
> const positions = \[\];
>
> const xSpacing = 200;
>
> const ySpacing = 150;
>
> // Build adjacency list
>
> const graph = new Map();
>
> entities.forEach(e =\> graph.set(e.name, \[\]));
>
> relationships.forEach(r =\> {
>
> if (graph.has(r.from)) {
>
> graph.get(r.from).push(r.to);
>
> }
>
> });
>
> // Topological sort (simplified)
>
> const visited = new Set();
>
> const layers = \[\];
>
> function dfs(node: string, layer: number) {
>
> if (visited.has(node)) return;
>
> visited.add(node);
>
> if (!layers\[layer\]) layers\[layer\] = \[\];
>
> layers\[layer\].push(node);
>
> const neighbors = graph.get(node) \|\| \[\];
>
> neighbors.forEach(n =\> dfs(n, layer + 1));
>
> }
>
> // Find root nodes (no incoming edges)
>
> const hasIncoming = new Set(relationships.map(r =\> r.to));
>
> const roots = entities.filter(e =\> !hasIncoming.has(e.name));
>
> roots.forEach(root =\> dfs(root.name, 0));
>
> // Assign positions
>
> layers.forEach((layer, layerIndex) =\> {
>
> layer.forEach((nodeName, nodeIndex) =\> {
>
> const entity = entities.find(e =\> e.name === nodeName);
>
> positions.push({
>
> id: entity.name,
>
> x: layerIndex \* xSpacing + 100,
>
> y: nodeIndex \* ySpacing + 100,
>
> width: 140,
>
> height: 100
>
> });
>
> });
>
> });
>
> return positions;
>
> }

Step 6: Create Frontend UI

> // components/DiagramGenerator.tsx
>
> import { useState } from \'react\';
>
> import { trpc } from \'@/lib/trpc\';
>
> export function DiagramGenerator() {
>
> const \[paperText, setPaperText\] = useState(\'\');
>
> const generateMutation = trpc.diagram.generate.useMutation();
>
> const handleGenerate = async () =\> {
>
> const result = await generateMutation.mutateAsync({
>
> paperContent: paperText,
>
> generationMethod: \'text\'
>
> });
>
> // Navigate to diagram editor
>
> router.push(\`/diagram/\${result.id}\`);
>
> };
>
> return (
>
> \<div className=\"p-6\"\>
>
> \<h2\>Generate Biological Diagram\</h2\>
>
> \<textarea
>
> value={paperText}
>
> onChange={(e) =\> setPaperText(e.target.value)}
>
> placeholder=\"Paste scientific abstract or paper text here\...\"
>
> className=\"w-full h-64 p-4 border rounded\"
>
> /\>
>
> \<button
>
> onClick={handleGenerate}
>
> disabled={generateMutation.isPending}
>
> className=\"mt-4 px-6 py-2 bg-blue-500 text-white rounded\"
>
> \>
>
> {generateMutation.isPending ? \'Generating\...\' : \'Generate
> Diagram\'}
>
> \</button\>
>
> \</div\>
>
> );
>
> }

Database Schema

Icons Table

> CREATE TABLE icons (
>
> id SERIAL PRIMARY KEY,
>
> name VARCHAR(255) NOT NULL,
>
> category VARCHAR(100) NOT NULL,
>
> keywords TEXT,
>
> tier INT NOT NULL DEFAULT 3,
>
> icon_url VARCHAR(500) NOT NULL,
>
> source VARCHAR(100),
>
> created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
>
> );
>
> CREATE INDEX idx_icons_name ON icons(name);
>
> CREATE INDEX idx_icons_category ON icons(category);
>
> CREATE INDEX idx_icons_tier ON icons(tier);

Diagrams Table

> CREATE TABLE diagrams (
>
> id SERIAL PRIMARY KEY,
>
> user_id INT NOT NULL,
>
> title VARCHAR(255),
>
> description TEXT,
>
> paper_content TEXT,
>
> generation_method VARCHAR(50),
>
> elements JSONB NOT NULL,
>
> connections JSONB NOT NULL,
>
> layout JSONB,
>
> created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
>
> updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
>
> );

Icon Database Setup

Option 1: Use Existing Icon Libraries

- **BioIcons**:
  [[https://bioicons.com/]{.underline}](https://bioicons.com/) (2,000+
  biological icons)

- **Flaticon**:
  [[https://www.flaticon.com/]{.underline}](https://www.flaticon.com/)
  (search \"biology\", \"medical\")

- **Noun Project**:
  [[https://thenounproject.com/]{.underline}](https://thenounproject.com/)
  (biological symbols)

Option 2: Scrape and Import

> \# Python script to populate icon database
>
> import requests
>
> import json
>
> icons = \[
>
> {\"name\": \"DNA\", \"category\": \"molecule\", \"tier\": 1,
> \"icon_url\": \"https://cdn.example.com/dna.svg\"},
>
> {\"name\": \"Protein\", \"category\": \"protein\", \"tier\": 2,
> \"icon_url\": \"https://cdn.example.com/protein.svg\"},
>
> \# \... 50,000 more icons
>
> \]
>
> for icon in icons:
>
> db.execute(\"INSERT INTO icons (name, category, tier, icon_url) VALUES
> (?, ?, ?, ?)\",
>
> icon\[\'name\'\], icon\[\'category\'\], icon\[\'tier\'\],
> icon\[\'icon_url\'\])

LLM API Configuration

Using OpenAI

> import OpenAI from \'openai\';
>
> const openai = new OpenAI({
>
> apiKey: process.env.OPENAI_API_KEY
>
> });
>
> export async function invokeLLM(params) {
>
> const response = await openai.chat.completions.create({
>
> model: \'gpt-4o\',
>
> messages: params.messages,
>
> response_format: params.response_format,
>
> temperature: 0.3
>
> });
>
> return response;
>
> }

Using Gemini (Google)

> import { GoogleGenerativeAI } from \'@google/generative-ai\';
>
> const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
>
> export async function invokeLLM(params) {
>
> const model = genAI.getGenerativeModel({ model: \'gemini-1.5-pro\' });
>
> const result = await model.generateContent({
>
> contents: params.messages.map(m =\> ({
>
> role: m.role === \'user\' ? \'user\' : \'model\',
>
> parts: \[{ text: m.content }\]
>
> })),
>
> generationConfig: {
>
> responseMimeType: \'application/json\'
>
> }
>
> });
>
> return {
>
> choices: \[{
>
> message: {
>
> content: result.response.text()
>
> }
>
> }\]
>
> };
>
> }

Testing and Validation

Test Cases

**Test 1: Simple Pathway**

> Input: \"Insulin binds to insulin receptor, activating IRS1, which
> activates PI3K.\"
>
> Expected Entities: Insulin, Insulin Receptor, IRS1, PI3K
>
> Expected Relationships:
>
> \- Insulin → Insulin Receptor (binding)
>
> \- Insulin Receptor → IRS1 (activation)
>
> \- IRS1 → PI3K (activation)

**Test 2: Complex Network**

> Input: \"MAPK pathway: Growth factor activates RAS, RAS activates RAF,
> RAF phosphorylates MEK, MEK phosphorylates ERK. ERK inhibits RAF
> through negative feedback.\"
>
> Expected: 5 entities, 5 relationships (including 1 inhibition)

Validation Metrics

- **Entity Extraction Accuracy**: % of correctly identified entities

- **Relationship Accuracy**: % of correct relationships

- **Icon Match Quality**: % of Tier 1 matches vs Tier 2/3

- **Layout Quality**: Minimize edge crossings, maintain readability

Cost Estimates

Per Diagram Generation

- **Entity Extraction**: \~1,000 tokens input, \~500 tokens output

- **Relationship Detection**: \~800 tokens input, \~400 tokens output

- **Layout Generation**: \~500 tokens input, \~300 tokens output

**Total per diagram**: \~2,300 input + \~1,200 output tokens

Monthly Costs (OpenAI GPT-4o)

  -------------------------------------------------------------------------
  Users    Diagrams/mo      Input Tokens     Output Tokens      Cost
  -------- ---------------- ---------------- ------------------ -----------
  100      1,000            2.3M             1.2M               \~\$18

  1,000    10,000           23M              12M                \~\$180

  10,000   100,000          230M             120M               \~\$1,800
  -------------------------------------------------------------------------

Monthly Costs (Gemini)

\~10x cheaper than OpenAI

Deployment Checklist

- Set up LLM API keys (OpenAI or Gemini)

- Create database tables (icons, diagrams)

- Populate icon database (at least 1,000 icons to start)

- Implement backend API endpoints

- Create frontend UI for text input

- Add diagram visualization (Canvas.js or SVG)

- Test with sample scientific abstracts

- Add error handling and loading states

- Implement rate limiting (prevent abuse)

- Set up monitoring and logging

Reference Implementation

The current BioSketch project (built with Manus) already has a complete
TypeScript implementation of SciSketch. You can reference:

- **Entity Extraction**: [server/sciSketchService.ts]{.underline} →
  [extractElements()]{.underline}

- **Relationship Detection**: [server/sciSketchService.ts]{.underline} →
  [generateConnections()]{.underline}

- **Icon Matching**: [server/sciSketchService.ts]{.underline} →
  [matchIcons()]{.underline}

- **Layout Generation**: [server/sciSketchService.ts]{.underline} →
  [generateLayout()]{.underline}

- **Frontend UI**: [client/src/pages/DiagramGenerator.tsx]{.underline}

- **Canvas Rendering**:
  [client/src/components/CanvasEditor.tsx]{.underline}

Prompt for Lovable

Use this prompt when instructing Lovable:

> I want to integrate SciSketch functionality into my existing BioSketch
> web application. SciSketch is an open-source AI-powered biological
> diagram generator that:
>
> 1\. Extracts biological entities (proteins, molecules, organs) from
> scientific text using LLM
>
> 2\. Detects relationships between entities (activation, inhibition,
> conversion)
>
> 3\. Matches entities to icons from a biological icon database
>
> 4\. Generates optimal diagram layouts
>
> 5\. Outputs structured data for visualization
>
> Please implement the following:
>
> 1\. Backend API endpoint \`/api/diagram/generate\` that accepts
> scientific text input
>
> 2\. Entity extraction using OpenAI/Gemini with structured JSON output
>
> 3\. Relationship detection between extracted entities
>
> 4\. Icon matching system (create icons table in database)
>
> 5\. Layout generation algorithm (hierarchical left-to-right flow)
>
> 6\. Frontend UI with textarea for text input and \"Generate Diagram\"
> button
>
> 7\. Diagram visualization using Canvas or SVG
>
> Reference the detailed implementation guide in the attached document
> for:
>
> \- Exact LLM prompt templates
>
> \- Database schema
>
> \- Code examples for each function
>
> \- Testing procedures
>
> The integration should be seamless with my existing React +
> TypeScript + tRPC stack.

Support and Resources

- **SciSketch GitHub**:
  [[https://github.com/stevensusas/SciSketch]{.underline}](https://github.com/stevensusas/SciSketch)

- **BioIcons**:
  [[https://bioicons.com/]{.underline}](https://bioicons.com/)

- **OpenAI API Docs**:
  [[https://platform.openai.com/docs]{.underline}](https://platform.openai.com/docs)

- **Gemini API Docs**:
  [[https://ai.google.dev/docs]{.underline}](https://ai.google.dev/docs)

Next Steps

4.  Share this document with Lovable

5.  Lovable will implement the backend API and frontend UI

6.  Populate the icon database (start with 1,000-5,000 icons)

7.  Test with sample scientific abstracts

8.  Iterate and improve based on results

9.  Deploy to production

Good luck with the integration! 🚀
